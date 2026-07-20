import asyncio
import sqlite3
import xml.etree.ElementTree as ET

import geopandas as gpd
import httpx
import pandas as pd

from app.main import app
from app.services.geometry_service import build_grid_features
from app.services.gpkg_service import write_gpkg
from app.services.kml_service import KML_NAMESPACE, write_kml

def test_kml_and_gpkg_outputs(
    tmp_path, sample_dataframe: pd.DataFrame, conversion_options
) -> None:
    result = build_grid_features(sample_dataframe, conversion_options)
    kml_path = tmp_path / "coverage_grid.kml"
    gpkg_path = tmp_path / "coverage_grid.gpkg"

    write_kml(result.geographic, kml_path, 0.6)
    write_gpkg(result.geographic, gpkg_path)

    assert kml_path.exists() and kml_path.stat().st_size > 0
    assert gpkg_path.exists() and gpkg_path.stat().st_size > 0

    root = ET.parse(kml_path).getroot()
    placemarks = root.findall(f".//{{{KML_NAMESPACE}}}Placemark")
    styles = root.findall(f".//{{{KML_NAMESPACE}}}Style")
    assert len(placemarks) == result.valid_rows
    assert len(styles) == 2
    assert all(
        placemark.find(f"{{{KML_NAMESPACE}}}description") is not None
        and placemark.find(f"{{{KML_NAMESPACE}}}ExtendedData") is not None
        for placemark in placemarks
    )
    fill_colors = {
        element.text
        for element in root.findall(
            f".//{{{KML_NAMESPACE}}}PolyStyle/{{{KML_NAMESPACE}}}color"
        )
    }
    assert {"990000FF", "9950B000"}.issubset(fill_colors)
    icon_colors = {
        element.text
        for element in root.findall(
            f".//{{{KML_NAMESPACE}}}IconStyle/{{{KML_NAMESPACE}}}color"
        )
    }
    assert icon_colors == {"FF0000FF"}
    points = root.findall(f".//{{{KML_NAMESPACE}}}Point")
    assert len(points) == result.valid_rows
    first_center = points[0].find(f"{{{KML_NAMESPACE}}}coordinates")
    assert first_center is not None
    assert first_center.text == "110.4340000000,-7.0456700000,0"

    gpkg = gpd.read_file(gpkg_path, layer="coverage_grid", engine="pyogrio")
    centers = gpd.read_file(gpkg_path, layer="coverage_centers", engine="pyogrio")
    assert len(gpkg) == result.valid_rows
    assert len(centers) == result.valid_rows
    assert gpkg.geometry.geom_type.eq("Polygon").all()
    assert centers.geometry.geom_type.eq("Point").all()
    assert centers.geometry.x.iloc[0] == 110.434
    assert centers.geometry.y.iloc[0] == -7.04567
    assert {
        "avg_rsrp",
        "total_subscriber_count",
        "red_cov_category",
        "style_color",
    }.issubset(gpkg.columns)
    with sqlite3.connect(gpkg_path) as connection:
        stored_styles = connection.execute(
            "SELECT f_table_name, useAsDefault, styleQML FROM layer_styles ORDER BY f_table_name"
        ).fetchall()
    assert [row[0] for row in stored_styles] == ["coverage_centers", "coverage_grid"]
    assert all(row[1] == 1 for row in stored_styles)
    assert "singleSymbol" in stored_styles[0][2]
    assert "255,0,0,255" in stored_styles[0][2]
    assert 'name="size_unit" type="QString" value="Pixel"' in stored_styles[0][2]
    assert "categorizedSymbol" in stored_styles[1][2]


def test_api_inspect_convert_metadata_and_non_csv_rejection() -> None:
    csv_bytes = (
        b"geohash7,latitude_geohash7,longitude_geohash7,avg_rsrp,"
        b"total_subscriber_count,red_cov_category\n"
        b"qqwxbvr,-7.04567,110.434,-105.316,43,RED ENGINEERING\n"
        b"bad,95,110.435,-98.210,28,BAD NON POTENTIAL\n"
    )

    async def exercise_api() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            inspection = await client.post(
                "/api/csv/inspect",
                files={"file": ("coverage.csv", csv_bytes, "text/csv")},
            )
            assert inspection.status_code == 200
            assert inspection.json()["total_rows"] == 2

            response = await client.post(
                "/api/convert",
                files={"file": ("coverage.csv", csv_bytes, "text/csv")},
                data={
                    "longitude_column": "longitude_geohash7",
                    "latitude_column": "latitude_geohash7",
                    "name_column": "geohash7",
                    "category_column": "red_cov_category",
                    "output_format": "kml",
                },
            )
            assert response.status_code == 200
            assert response.headers["x-total-rows"] == "2"
            assert response.headers["x-valid-rows"] == "1"
            assert response.headers["x-invalid-rows"] == "1"
            assert "coverage_grid.kml" in response.headers["content-disposition"]

            rejected = await client.post(
                "/api/csv/inspect",
                files={"file": ("coverage.txt", csv_bytes, "text/plain")},
            )
            assert rejected.status_code == 400
            assert "Only .csv" in rejected.json()["detail"]

    asyncio.run(exercise_api())
