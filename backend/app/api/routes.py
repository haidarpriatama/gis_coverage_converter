import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Annotated

from collections.abc import AsyncIterator

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import ValidationError

from app.schemas.conversion import ConversionOptions, CsvInspection, OutputFormat
from app.services.csv_service import (
    CsvValidationError,
    inspect_csv_path,
    parse_csv_path,
    validate_csv_filename,
)
from app.services.geometry_service import build_grid_features
from app.services.gpkg_service import write_gpkg
from app.services.kml_service import write_kml
from app.utils.filenames import output_filename, safe_csv_filename

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


def _max_upload_bytes() -> int:
    raw_value = os.getenv("MAX_UPLOAD_SIZE_MB", "1024")
    try:
        size_mb = max(1, int(raw_value))
    except ValueError:
        size_mb = 1024
    return size_mb * 1024 * 1024


async def _save_upload_to_temp(upload: UploadFile) -> tuple[str, Path]:
    limit = _max_upload_bytes()
    temporary_directory = tempfile.mkdtemp(prefix="coverage-upload-")
    upload_path = Path(temporary_directory) / safe_csv_filename(upload.filename)
    total_size = 0
    try:
        with upload_path.open("wb") as output:
            while chunk := await upload.read(1024 * 1024):
                total_size += len(chunk)
                if total_size > limit:
                    raise HTTPException(
                        status_code=413,
                        detail=f"The file exceeds the {limit // (1024 * 1024)} MB upload limit.",
                    )
                output.write(chunk)
    except Exception:
        _cleanup_directory(temporary_directory)
        raise
    finally:
        await upload.close()

    if total_size == 0:
        _cleanup_directory(temporary_directory)
        raise HTTPException(status_code=400, detail="The CSV file is empty.")
    return temporary_directory, upload_path


def _cleanup_directory(path: str) -> None:
    shutil.rmtree(path, ignore_errors=True)


async def _stream_file_and_cleanup(path: Path, temporary_directory: str) -> AsyncIterator[bytes]:
    try:
        with path.open("rb") as source:
            while chunk := source.read(1024 * 1024):
                yield chunk
    finally:
        _cleanup_directory(temporary_directory)


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/csv/inspect", response_model=CsvInspection)
async def inspect_csv_endpoint(file: Annotated[UploadFile, File(...)]) -> CsvInspection:
    temporary_directory: str | None = None
    try:
        validate_csv_filename(file.filename)
        temporary_directory, upload_path = await _save_upload_to_temp(file)
        return inspect_csv_path(safe_csv_filename(file.filename), upload_path)
    except CsvValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        if temporary_directory:
            _cleanup_directory(temporary_directory)


@router.post("/convert", response_class=Response)
async def convert_csv_endpoint(
    file: Annotated[UploadFile, File(...)],
    longitude_column: Annotated[str, Form(...)],
    latitude_column: Annotated[str, Form(...)],
    output_format: Annotated[OutputFormat, Form(...)],
    name_column: Annotated[str | None, Form()] = None,
    category_column: Annotated[str | None, Form()] = None,
    grid_width_m: Annotated[float, Form(gt=0, le=10_000)] = 153.0,
    grid_height_m: Annotated[float, Form(gt=0, le=10_000)] = 153.0,
    fill_opacity: Annotated[float, Form(ge=0, le=1)] = 0.6,
) -> Response:
    temporary_directory: str | None = None
    try:
        validate_csv_filename(file.filename)
        temporary_directory, upload_path = await _save_upload_to_temp(file)
        parsed = parse_csv_path(upload_path)
        options = ConversionOptions(
            longitude_column=longitude_column,
            latitude_column=latitude_column,
            name_column=name_column or None,
            category_column=category_column or None,
            output_format=output_format,
            grid_width_m=grid_width_m,
            grid_height_m=grid_height_m,
            fill_opacity=fill_opacity,
        )
        result = build_grid_features(parsed.dataframe, options)

        extension = options.output_format.value
        download_name = output_filename(file.filename or "upload.csv", extension)
        temporary_directory = tempfile.mkdtemp(prefix="coverage-grid-")
        output_path = Path(temporary_directory) / download_name

        if options.output_format == OutputFormat.KML:
            write_kml(result.geographic, output_path, options.fill_opacity)
            media_type = "application/vnd.google-earth.kml+xml"
        else:
            write_gpkg(result.geographic, output_path)
            media_type = "application/geopackage+sqlite3"

        streaming_directory = temporary_directory
        temporary_directory = None
        return StreamingResponse(
            _stream_file_and_cleanup(output_path, streaming_directory),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Total-Rows": str(result.total_rows),
                "X-Valid-Rows": str(result.valid_rows),
                "X-Invalid-Rows": str(result.invalid_rows),
            },
        )
    except (CsvValidationError, ValidationError) as exc:
        if temporary_directory:
            _cleanup_directory(temporary_directory)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        if temporary_directory:
            _cleanup_directory(temporary_directory)
        logger.exception("Conversion failed")
        raise HTTPException(
            status_code=500,
            detail="The conversion could not be completed. Check the CSV structure and server logs.",
        ) from exc
