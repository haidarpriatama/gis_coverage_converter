import math

import pandas as pd
import pytest
from pyproj import Transformer
from shapely.geometry import Point

from app.services.geometry_service import build_grid_features
from app.utils.colors import category_to_hex


def test_valid_coordinates_invalid_rows_geometry_and_attributes(
    sample_dataframe: pd.DataFrame, conversion_options
) -> None:
    result = build_grid_features(sample_dataframe, conversion_options)

    assert result.total_rows == 3
    assert result.valid_rows == 2
    assert result.invalid_rows == 1
    assert result.duplicate_rows == 0
    assert len(result.projected) == len(result.geographic) == 2

    to_projected = Transformer.from_crs(
        "EPSG:4326", result.projected_crs, always_xy=True
    )
    point_is_not_forced_to_cell_center = False
    for index, polygon in enumerate(result.projected.geometry):
        min_x, min_y, max_x, max_y = polygon.bounds
        assert max_x - min_x == pytest.approx(153, abs=0.001)
        assert max_y - min_y == pytest.approx(153, abs=0.001)
        assert min_x / 153 == pytest.approx(round(min_x / 153), abs=1e-9)
        assert min_y / 153 == pytest.approx(round(min_y / 153), abs=1e-9)

        source_x, source_y = to_projected.transform(
            result.projected.iloc[index]["longitude_geohash7"],
            result.projected.iloc[index]["latitude_geohash7"],
        )
        source_point = Point(source_x, source_y)
        assert polygon.covers(source_point)
        point_is_not_forced_to_cell_center |= not source_point.equals_exact(
            polygon.centroid, tolerance=1e-6
        )

    assert point_is_not_forced_to_cell_center
    assert result.projected.geometry.iloc[0].intersection(
        result.projected.geometry.iloc[1]
    ).area == pytest.approx(0, abs=1e-9)

    first = result.geographic.iloc[0]
    assert math.isclose(first["avg_rsrp"], -105.316)
    assert first["total_subscriber_count"] == 43
    assert first["red_cov_category"] == "RED ENGINEERING"
    assert first["style_color"] == "#FF0000"


def test_duplicate_rows_in_same_snapped_cell_keep_first(conversion_options) -> None:
    dataframe = pd.DataFrame(
        {
            "geohash7": ["first", "duplicate"],
            "latitude_geohash7": [-7.04567, -7.04567],
            "longitude_geohash7": [110.434, 110.434],
            "avg_rsrp": [-105.316, -80.0],
            "total_subscriber_count": [43, 99],
            "red_cov_category": ["RED ENGINEERING", "NOT RED COV"],
        }
    )

    result = build_grid_features(dataframe, conversion_options)

    assert result.total_rows == 2
    assert result.valid_rows == 1
    assert result.invalid_rows == 1
    assert result.duplicate_rows == 1
    assert result.geographic.iloc[0]["geohash7"] == "first"
    assert result.geographic.iloc[0]["avg_rsrp"] == pytest.approx(-105.316)


def test_coordinate_boundaries_are_valid(conversion_options) -> None:
    coordinate_only_options = conversion_options.model_copy(
        update={"name_column": None, "category_column": None}
    )
    for longitude, latitude in ((-180, -79), (180, 83)):
        dataframe = pd.DataFrame(
            {
                "longitude_geohash7": [longitude],
                "latitude_geohash7": [latitude],
            }
        )
        result = build_grid_features(dataframe, coordinate_only_options)
        assert result.valid_rows == 1


def test_all_invalid_coordinates_fail(conversion_options) -> None:
    dataframe = pd.DataFrame(
        {
            "longitude_geohash7": [181, "x", None],
            "latitude_geohash7": [0, -91, None],
        }
    )
    coordinate_only_options = conversion_options.model_copy(
        update={"name_column": None, "category_column": None}
    )
    with pytest.raises(ValueError, match="no valid coordinate"):
        build_grid_features(dataframe, coordinate_only_options)


@pytest.mark.parametrize(
    ("category", "expected"),
    [
        ("BAD NON POTENTIAL", "#00B050"),
        ("NOT RED COV", "#0000FF"),
        ("RED ENGINEERING", "#FF0000"),
        ("RED OPTIM", "#FFFF00"),
        ("UNKNOWN", "#808080"),
    ],
)
def test_category_colors(category: str, expected: str) -> None:
    assert category_to_hex(category) == expected
