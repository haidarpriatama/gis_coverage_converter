import re
from pathlib import Path


def safe_csv_filename(filename: str | None) -> str:
    raw_name = Path(filename or "upload.csv").name
    safe_name = re.sub(r"[^A-Za-z0-9._ -]", "_", raw_name).strip(". ")
    return safe_name or "upload.csv"


def output_filename(input_filename: str, extension: str) -> str:
    stem = Path(safe_csv_filename(input_filename)).stem
    safe_stem = re.sub(r"\s+", "_", stem).strip("_") or "coverage"
    return f"{safe_stem}_grid.{extension.lower()}"
