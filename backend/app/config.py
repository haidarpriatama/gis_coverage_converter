import os


def max_upload_bytes() -> int:
    raw_value = os.getenv("MAX_UPLOAD_SIZE_MB", "1024")
    try:
        size_mb = max(1, int(raw_value))
    except ValueError:
        size_mb = 1024
    return size_mb * 1024 * 1024
