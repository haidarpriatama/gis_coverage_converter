from pathlib import Path

import geopandas as gpd


def write_gpkg(geodataframe: gpd.GeoDataFrame, output_path: Path) -> None:
    data = geodataframe.to_crs("EPSG:4326")
    data.to_file(
        output_path,
        layer="coverage_grid",
        driver="GPKG",
        engine="pyogrio",
        index=False,
    )
