from pathlib import Path

import geopandas as gpd

from app.cli import main


CSV_CONTENT = """geohash7,latitude_geohash7,longitude_geohash7,avg_rsrp,total_subscriber_count,red_cov_category
qqwxbvr,-7.04567,110.434,-105.316,43,RED ENGINEERING
qqwxbvs,invalid,110.435,-98.210,28,BAD NON POTENTIAL
"""


def test_cli_creates_kml_with_default_columns(tmp_path: Path, capsys) -> None:
    input_path = tmp_path / "coverage.csv"
    input_path.write_text(CSV_CONTENT, encoding="utf-8")

    exit_code = main([str(input_path), "--format", "kml"])

    output_path = tmp_path / "coverage_grid.kml"
    assert exit_code == 0
    assert output_path.exists()
    assert "1 exported" in capsys.readouterr().out


def test_cli_creates_gpkg_with_grid_and_point_layers(tmp_path: Path) -> None:
    input_path = tmp_path / "coverage.csv"
    input_path.write_text(CSV_CONTENT, encoding="utf-8")

    exit_code = main([str(input_path), "--format", "gpkg"])

    output_path = tmp_path / "coverage_grid.gpkg"
    assert exit_code == 0
    assert len(gpd.read_file(output_path, layer="coverage_grid", engine="pyogrio")) == 1
    assert len(gpd.read_file(output_path, layer="coverage_points", engine="pyogrio")) == 1


def test_cli_does_not_overwrite_without_force(tmp_path: Path, capsys) -> None:
    input_path = tmp_path / "coverage.csv"
    output_path = tmp_path / "result.kml"
    input_path.write_text(CSV_CONTENT, encoding="utf-8")
    output_path.write_text("keep", encoding="utf-8")

    exit_code = main(
        [str(input_path), "--format", "kml", "--output", str(output_path)]
    )

    assert exit_code == 2
    assert output_path.read_text(encoding="utf-8") == "keep"
    assert "Use --force" in capsys.readouterr().err
