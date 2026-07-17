from dataclasses import dataclass

import geopandas as gpd
import pandas as pd
from pyproj import Transformer
from shapely.geometry import box
from shapely.ops import transform

from app.schemas.conversion import ConversionOptions
from app.services.csv_service import CsvValidationError
from app.utils.colors import category_to_hex
from app.utils.crs import utm_crs_for_coordinate


@dataclass(frozen=True)
class GridBuildResult:
    geographic: gpd.GeoDataFrame
    projected: gpd.GeoDataFrame
    total_rows: int
    valid_rows: int
    invalid_rows: int
    projected_crs: str


def _optional_series(dataframe: pd.DataFrame, column: str | None) -> pd.Series:
    if column and column in dataframe.columns:
        return dataframe.loc[:, column]
    return pd.Series([None] * len(dataframe), index=dataframe.index, dtype="object")


def _validate_selected_columns(dataframe: pd.DataFrame, options: ConversionOptions) -> None:
    for label, column in (
        ("longitude", options.longitude_column),
        ("latitude", options.latitude_column),
    ):
        if not column:
            raise CsvValidationError(f"The {label} column is required.")
        if column not in dataframe.columns:
            raise CsvValidationError(f'The selected {label} column "{column}" was not found.')

    for label, column in (("name", options.name_column), ("category", options.category_column)):
        if column and column not in dataframe.columns:
            raise CsvValidationError(f'The selected {label} column "{column}" was not found.')


def _as_nullable_integer(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    integer_mask = numeric.dropna().mod(1).eq(0).all()
    return numeric.astype("Int64") if integer_mask else numeric.astype("Float64")


def build_grid_features(
    dataframe: pd.DataFrame,
    options: ConversionOptions,
) -> GridBuildResult:
    _validate_selected_columns(dataframe, options)
    longitude = pd.to_numeric(dataframe[options.longitude_column], errors="coerce")
    latitude = pd.to_numeric(dataframe[options.latitude_column], errors="coerce")
    if longitude.notna().sum() == 0:
        raise CsvValidationError(
            "The selected longitude column contains no valid numeric values."
        )
    if latitude.notna().sum() == 0:
        raise CsvValidationError(
            "The selected latitude column contains no valid numeric values."
        )

    valid_mask = longitude.between(-180, 180) & latitude.between(-90, 90)
    valid_mask &= longitude.notna() & latitude.notna()
    total_rows = len(dataframe)
    valid_rows = int(valid_mask.sum())
    if valid_rows == 0:
        raise CsvValidationError("Conversion failed because no valid coordinate rows were found.")

    valid = dataframe.loc[valid_mask].copy()
    valid_longitude = longitude.loc[valid_mask].astype(float)
    valid_latitude = latitude.loc[valid_mask].astype(float)

    center_longitude = float(valid_longitude.median())
    center_latitude = float(valid_latitude.median())
    projected_crs = utm_crs_for_coordinate(center_longitude, center_latitude)
    to_projected = Transformer.from_crs("EPSG:4326", projected_crs, always_xy=True)
    to_geographic = Transformer.from_crs(projected_crs, "EPSG:4326", always_xy=True)

    half_width = options.grid_width_m / 2
    half_height = options.grid_height_m / 2
    projected_polygons = []
    for lon, lat in zip(valid_longitude, valid_latitude, strict=True):
        center_x, center_y = to_projected.transform(lon, lat)
        projected_polygons.append(
            box(
                center_x - half_width,
                center_y - half_height,
                center_x + half_width,
                center_y + half_height,
            )
        )

    name_values = _optional_series(valid, options.name_column).reset_index(drop=True)
    category_values = _optional_series(valid, options.category_column).reset_index(drop=True)
    avg_rsrp = pd.to_numeric(
        _optional_series(valid, "avg_rsrp").reset_index(drop=True), errors="coerce"
    )
    subscriber_count = _as_nullable_integer(
        _optional_series(valid, "total_subscriber_count").reset_index(drop=True)
    )

    attributes = pd.DataFrame(
        {
            "geohash7": name_values.map(lambda value: None if pd.isna(value) else str(value)),
            "latitude_geohash7": valid_latitude.to_numpy(),
            "longitude_geohash7": valid_longitude.to_numpy(),
            "avg_rsrp": avg_rsrp,
            "total_subscriber_count": subscriber_count,
            "red_cov_category": category_values.map(
                lambda value: None if pd.isna(value) else str(value)
            ),
        }
    ).reset_index(drop=True)
    attributes["style_color"] = attributes["red_cov_category"].map(category_to_hex)

    projected = gpd.GeoDataFrame(attributes, geometry=projected_polygons, crs=projected_crs)
    geographic_polygons = [transform(to_geographic.transform, polygon) for polygon in projected_polygons]
    geographic = gpd.GeoDataFrame(attributes.copy(), geometry=geographic_polygons, crs="EPSG:4326")

    return GridBuildResult(
        geographic=geographic,
        projected=projected,
        total_rows=total_rows,
        valid_rows=valid_rows,
        invalid_rows=total_rows - valid_rows,
        projected_crs=projected_crs.to_string(),
    )
