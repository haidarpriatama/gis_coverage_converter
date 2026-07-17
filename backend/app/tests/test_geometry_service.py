import math

import pandas as pd
import pytest

from app.services.geometry_service import build_grid_features


def test_valid_coordinates_invalid_rows_geometry_and_attributes(
    sample_dataframe: pd.DataFrame, conversion_options
) -> None:
    result = build_grid_features(sample_dataframe, conversion_options)

    assert result.total_rows == 3
    assert result.valid_rows == 2
    assert result.invalid_rows == 1
    assert len(result.projected) == len(result.geographic) == 2

    first_polygon = result.projected.geometry.iloc[0]
    min_x, min_y, max_x, max_y = first_polygon.bounds
    assert max_x - min_x == pytest.approx(153, abs=0.001)
    assert max_y - min_y == pytest.approx(153, abs=0.001)

    centroid = first_polygon.centroid
    assert centroid.x == pytest.approx((min_x + max_x) / 2, abs=1e-9)
    assert centroid.y == pytest.approx((min_y + max_y) / 2, abs=1e-9)

    first = result.geographic.iloc[0]
    assert math.isclose(first["avg_rsrp"], -105.316)
    assert first["total_subscriber_count"] == 43
    assert first["red_cov_category"] == "RED ENGINEERING"
    assert first["style_color"] == "#FF0000"


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
