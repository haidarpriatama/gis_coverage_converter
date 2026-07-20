import csv
import io
from dataclasses import dataclass
from pathlib import Path

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


ENCODINGS = ("utf-8-sig", "utf-8", "cp1252")


def _decode_csv(content: bytes) -> tuple[str, str]:
    if not content or not content.strip():
        raise CsvValidationError("The CSV file is empty.")

    for encoding in ENCODINGS[:-1]:
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


def _decode_sample(path: Path) -> tuple[str, str]:
    with path.open("rb") as source:
        sample = source.read(65536)
    if not sample or not sample.strip():
        raise CsvValidationError("The CSV file is empty.")

    for encoding in ENCODINGS:
        try:
            return sample.decode(encoding), encoding
        except UnicodeDecodeError:
            continue
    raise CsvValidationError("The CSV encoding is not supported. Use UTF-8.")


def parse_csv_path(path: Path) -> ParsedCsv:
    sample_text, preferred_encoding = _decode_sample(path)
    delimiter = _detect_delimiter(sample_text)
    encodings = [preferred_encoding, *[encoding for encoding in ENCODINGS if encoding != preferred_encoding]]
    last_error: Exception | None = None

    for encoding in encodings:
        try:
            dataframe = pd.read_csv(
                path,
                sep=delimiter,
                encoding=encoding,
                skip_blank_lines=True,
                low_memory=False,
            )
            break
        except UnicodeDecodeError as exc:
            last_error = exc
            continue
        except (pd.errors.ParserError, pd.errors.EmptyDataError) as exc:
            raise CsvValidationError(f"The CSV file could not be parsed: {exc}") from exc
    else:
        raise CsvValidationError("The CSV encoding is not supported. Use UTF-8.") from last_error

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
    return inspect_parsed_csv(filename, parsed)


def inspect_csv_path(filename: str, path: Path) -> CsvInspection:
    validate_csv_filename(filename)
    parsed = parse_csv_path(path)
    return inspect_parsed_csv(filename, parsed)


def inspect_parsed_csv(filename: str, parsed: ParsedCsv) -> CsvInspection:
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
