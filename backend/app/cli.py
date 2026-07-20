import argparse
import sys
from pathlib import Path

from pydantic import ValidationError

from app.schemas.conversion import ConversionOptions, OutputFormat
from app.services.csv_service import (
    DEFAULT_COLUMNS,
    CsvValidationError,
    parse_csv_path,
    validate_csv_filename,
)
from app.services.geometry_service import build_grid_features
from app.services.gpkg_service import write_gpkg
from app.services.kml_service import write_kml
from app.utils.filenames import output_filename


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="csv-coverage-grid",
        description="Convert CSV longitude/latitude rows into an aligned coverage grid.",
    )
    parser.add_argument("input", type=Path, help="Path to the input CSV file.")
    parser.add_argument(
        "--format",
        dest="output_format",
        choices=[item.value for item in OutputFormat],
        required=True,
        help="Output format: kml or gpkg.",
    )
    parser.add_argument("--output", type=Path, help="Optional output file path.")
    parser.add_argument(
        "--longitude-column",
        default=DEFAULT_COLUMNS["longitude"],
        help=f'Longitude column (default: {DEFAULT_COLUMNS["longitude"]}).',
    )
    parser.add_argument(
        "--latitude-column",
        default=DEFAULT_COLUMNS["latitude"],
        help=f'Latitude column (default: {DEFAULT_COLUMNS["latitude"]}).',
    )
    parser.add_argument(
        "--name-column",
        help=f'Grid name column (auto: {DEFAULT_COLUMNS["name"]} when available).',
    )
    parser.add_argument(
        "--category-column",
        help=f'Category column (auto: {DEFAULT_COLUMNS["category"]} when available).',
    )
    parser.add_argument("--grid-width", type=float, default=153.0, help="Grid width in meters.")
    parser.add_argument("--grid-height", type=float, default=153.0, help="Grid height in meters.")
    parser.add_argument("--opacity", type=float, default=0.6, help="KML fill opacity, from 0 to 1.")
    parser.add_argument("--force", action="store_true", help="Overwrite an existing output file.")
    return parser


def _optional_column(explicit: str | None, default: str, columns: list[str]) -> str | None:
    if explicit:
        return explicit
    return default if default in columns else None


def _output_path(input_path: Path, requested: Path | None, extension: str) -> Path:
    if requested is None:
        return input_path.with_name(output_filename(input_path.name, extension))
    if requested.suffix and requested.suffix.lower() != f".{extension}":
        raise CsvValidationError(f'The output file must use the ".{extension}" extension.')
    return requested if requested.suffix else requested.with_suffix(f".{extension}")


def convert(args: argparse.Namespace) -> Path:
    input_path = args.input.expanduser().resolve()
    if not input_path.is_file():
        raise CsvValidationError(f'The input CSV was not found: "{input_path}".')
    validate_csv_filename(input_path.name)

    parsed = parse_csv_path(input_path)
    columns = list(parsed.dataframe.columns)
    output_format = OutputFormat(args.output_format)
    options = ConversionOptions(
        longitude_column=args.longitude_column,
        latitude_column=args.latitude_column,
        name_column=_optional_column(args.name_column, DEFAULT_COLUMNS["name"], columns),
        category_column=_optional_column(
            args.category_column,
            DEFAULT_COLUMNS["category"],
            columns,
        ),
        output_format=output_format,
        grid_width_m=args.grid_width,
        grid_height_m=args.grid_height,
        fill_opacity=args.opacity,
    )
    output_path = _output_path(input_path, args.output, output_format.value).expanduser().resolve()
    if output_path == input_path:
        raise CsvValidationError("The output path must be different from the input CSV.")
    if output_path.exists() and not args.force:
        raise CsvValidationError(
            f'The output already exists: "{output_path}". Use --force to replace it.'
        )

    result = build_grid_features(parsed.dataframe, options)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    try:
        if output_format == OutputFormat.KML:
            write_kml(result.geographic, output_path, options.fill_opacity)
        else:
            write_gpkg(result.geographic, output_path)
    except Exception:
        output_path.unlink(missing_ok=True)
        raise

    print(f"Output : {output_path}")
    print(f"Rows   : {result.total_rows} total, {result.valid_rows} exported")
    print(f"Skipped: {result.invalid_rows} ({result.duplicate_rows} duplicate grid cells)")
    return output_path


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        convert(args)
    except (CsvValidationError, ValidationError, OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"Conversion failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
