from enum import Enum

from pydantic import BaseModel, Field


class OutputFormat(str, Enum):
    KML = "kml"
    GPKG = "gpkg"


class SuggestedColumns(BaseModel):
    longitude: str | None = None
    latitude: str | None = None
    name: str | None = None
    category: str | None = None


class CsvInspection(BaseModel):
    filename: str
    columns: list[str]
    total_rows: int
    suggested_columns: SuggestedColumns


class ConversionOptions(BaseModel):
    longitude_column: str
    latitude_column: str
    name_column: str | None = None
    category_column: str | None = None
    output_format: OutputFormat
    grid_width_m: float = Field(default=153.0, gt=0, le=10_000)
    grid_height_m: float = Field(default=153.0, gt=0, le=10_000)
    fill_opacity: float = Field(default=0.6, ge=0, le=1)
