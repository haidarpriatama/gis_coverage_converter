import pytest

from app.services.csv_service import CsvValidationError, inspect_csv, parse_csv


def test_inspect_detects_semicolon_bom_and_defaults() -> None:
    content = (
        "\ufeffgeohash7;latitude_geohash7;longitude_geohash7;avg_rsrp;"
        "total_subscriber_count;red_cov_category\n"
        "qqwxbvr;-7.04567;110.434;-105.316;43;RED ENGINEERING\n"
    ).encode("utf-8")

    parsed = parse_csv(content)
    inspection = inspect_csv("coverage.csv", content)

    assert parsed.delimiter == ";"
    assert inspection.total_rows == 1
    assert inspection.suggested_columns.longitude == "longitude_geohash7"
    assert inspection.suggested_columns.latitude == "latitude_geohash7"
    assert inspection.suggested_columns.name == "geohash7"
    assert inspection.suggested_columns.category == "red_cov_category"


@pytest.mark.parametrize("filename", ["coverage.txt", "coverage", "coverage.csv.exe"])
def test_non_csv_file_is_rejected(filename: str) -> None:
    with pytest.raises(CsvValidationError, match="Only .csv"):
        inspect_csv(filename, b"longitude,latitude\n110,-7")


def test_empty_csv_is_rejected() -> None:
    with pytest.raises(CsvValidationError, match="empty"):
        parse_csv(b"")
