import pandas as pd
import pytest

from app.schemas.conversion import ConversionOptions, OutputFormat


@pytest.fixture
def sample_dataframe() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "geohash7": ["qqwxbvr", "qqwxbvs", "invalid"],
            "latitude_geohash7": [-7.04567, -7.04610, 120],
            "longitude_geohash7": [110.434, 110.435, "not-a-number"],
            "avg_rsrp": [-105.316, -98.210, -70],
            "total_subscriber_count": [43, 28, 10],
            "red_cov_category": ["RED ENGINEERING", "BAD NON POTENTIAL", "RED OPTIM"],
        }
    )


@pytest.fixture
def conversion_options() -> ConversionOptions:
    return ConversionOptions(
        longitude_column="longitude_geohash7",
        latitude_column="latitude_geohash7",
        name_column="geohash7",
        category_column="red_cov_category",
        output_format=OutputFormat.KML,
    )
