import csv
import io
from dataclasses import dataclass

import pandas as pd

from app.schemas.conversion import CsvInspection, SuggestedColumns

DEFAULT_COLUMNS = {
    "longitude": "longitude_geohash7",
    "latitude": "latitude_geohash7",
    "name": "geohash7",
    "category": "red_cov_category",
}


class CsvValidationError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedCsv:
    dataframe: pd.DataFrame
    delimiter: str
    encoding: str


def validate_csv_filename(filename: str | None) -> None:
    if not filename or not filename.lower().endswith(".csv"):
        raise CsvValidationError("Only .csv files are accepted.")


def _decode_csv(content: bytes) -> tuple[str, str]:
    if not content or not content.strip():
        raise CsvValidationError("The CSV file is empty.")

    for encoding in ("utf-8-sig", "utf-8"):
        try:
            return content.decode(encoding), encoding
        except UnicodeDecodeError:
            continue

    # Windows-1252 is a conservative fallback for CSV exports from spreadsheet apps.
    try:
        return content.decode("cp1252"), "cp1252"
    except UnicodeDecodeError as exc:
        raise CsvValidationError("The CSV encoding is not supported. Use UTF-8.") from exc


def _detect_delimiter(text: str) -> str:
    sample = text[:8192]
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;").delimiter
    except csv.Error:
        first_line = sample.splitlines()[0] if sample.splitlines() else ""
        return ";" if first_line.count(";") > first_line.count(",") else ","


def parse_csv(content: bytes) -> ParsedCsv:
    text, encoding = _decode_csv(content)
    delimiter = _detect_delimiter(text)
    try:
        dataframe = pd.read_csv(
            io.StringIO(text),
            sep=delimiter,
            skip_blank_lines=True,
            low_memory=False,
        )
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeError) as exc:
        raise CsvValidationError(f"The CSV file could not be parsed: {exc}") from exc

    dataframe.columns = [str(column).strip() for column in dataframe.columns]
    if dataframe.columns.empty or all(column.startswith("Unnamed:") for column in dataframe.columns):
        raise CsvValidationError("The CSV file must contain a header row.")
    if len(set(dataframe.columns)) != len(dataframe.columns):
        raise CsvValidationError("The CSV contains duplicate column names.")
    if dataframe.empty:
        raise CsvValidationError("The CSV file contains no data rows.")
    return ParsedCsv(dataframe=dataframe, delimiter=delimiter, encoding=encoding)


def inspect_csv(filename: str, content: bytes) -> CsvInspection:
    validate_csv_filename(filename)
    parsed = parse_csv(content)
    columns = list(parsed.dataframe.columns)
    suggestions = {
        key: preferred if preferred in columns else None
        for key, preferred in DEFAULT_COLUMNS.items()
    }
    return CsvInspection(
        filename=filename,
        columns=columns,
        total_rows=len(parsed.dataframe),
        suggested_columns=SuggestedColumns(**suggestions),
    )
