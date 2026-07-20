#!/usr/bin/env python3
import argparse
import asyncio
import statistics
import time
from pathlib import Path

import httpx

FRONTEND_HEADERS = (
    "content-security-policy",
    "referrer-policy",
    "x-content-type-options",
    "x-frame-options",
    "permissions-policy",
    "strict-transport-security",
)
BACKEND_HEADERS = (
    "cache-control",
    "referrer-policy",
    "x-content-type-options",
    "x-frame-options",
    "permissions-policy",
)


def require_headers(response: httpx.Response, names: tuple[str, ...], service: str) -> None:
    missing = [name for name in names if not response.headers.get(name)]
    if missing:
        raise RuntimeError(f"{service} missing security headers: {', '.join(missing)}")


async def health_latency(client: httpx.AsyncClient, url: str, requests: int) -> list[float]:
    async def measure() -> float:
        started = time.perf_counter()
        response = await client.get(url)
        response.raise_for_status()
        return (time.perf_counter() - started) * 1000

    return await asyncio.gather(*(measure() for _ in range(requests)))


async def run(args: argparse.Namespace) -> None:
    frontend_url = args.frontend_url.rstrip("/")
    backend_url = args.backend_url.rstrip("/")
    csv_path = args.csv.resolve()
    if not csv_path.is_file():
        raise FileNotFoundError(csv_path)

    timeout = httpx.Timeout(args.timeout, connect=30)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        started = time.perf_counter()
        frontend = await client.get(frontend_url)
        frontend.raise_for_status()
        frontend_ms = (time.perf_counter() - started) * 1000
        require_headers(frontend, FRONTEND_HEADERS, "frontend")

        health_url = f"{backend_url}/api/health"
        health = await client.get(health_url)
        health.raise_for_status()
        require_headers(health, BACKEND_HEADERS, "backend")
        if health.json() != {"status": "ok"}:
            raise RuntimeError("Unexpected backend health response")

        cors = await client.options(
            f"{backend_url}/api/convert",
            headers={
                "Origin": frontend_url,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        cors.raise_for_status()
        if cors.headers.get("access-control-allow-origin") != frontend_url:
            raise RuntimeError("Backend CORS does not allow the deployed frontend origin")

        hostile_cors = await client.options(
            f"{backend_url}/api/convert",
            headers={
                "Origin": "https://attacker.invalid",
                "Access-Control-Request-Method": "POST",
            },
        )
        if hostile_cors.headers.get("access-control-allow-origin"):
            raise RuntimeError("Backend CORS unexpectedly allows an unrelated origin")

        rejected = await client.post(
            f"{backend_url}/api/csv/inspect",
            files={"file": ("payload.txt", b"not csv", "text/plain")},
        )
        if rejected.status_code != 400:
            raise RuntimeError("Non-CSV upload was not rejected")

        inspect_started = time.perf_counter()
        with csv_path.open("rb") as source:
            inspection = await client.post(
                f"{backend_url}/api/csv/inspect",
                files={"file": (csv_path.name, source, "text/csv")},
            )
        inspection.raise_for_status()
        inspect_seconds = time.perf_counter() - inspect_started
        payload = inspection.json()
        suggestions = payload["suggested_columns"]

        convert_started = time.perf_counter()
        with csv_path.open("rb") as source:
            conversion = await client.post(
                f"{backend_url}/api/convert",
                files={"file": (csv_path.name, source, "text/csv")},
                data={
                    "longitude_column": suggestions["longitude"] or "longitude_geohash7",
                    "latitude_column": suggestions["latitude"] or "latitude_geohash7",
                    "name_column": suggestions["name"] or "",
                    "category_column": suggestions["category"] or "",
                    "output_format": "kml",
                },
            )
        conversion.raise_for_status()
        convert_seconds = time.perf_counter() - convert_started
        if b"<kml" not in conversion.content[:512]:
            raise RuntimeError("Conversion response is not a KML document")

        latencies = await health_latency(client, health_url, args.health_requests)

    p95_index = max(0, round(0.95 * len(latencies)) - 1)
    p95 = sorted(latencies)[p95_index]
    print("Production checks passed")
    print(f"Frontend response: {frontend_ms:.1f} ms")
    print(f"Inspect {csv_path.stat().st_size / 1024:.1f} KiB: {inspect_seconds:.3f} s")
    print(f"Convert KML: {convert_seconds:.3f} s ({len(conversion.content) / 1024:.1f} KiB)")
    print(
        f"Health latency ({len(latencies)} concurrent): "
        f"median {statistics.median(latencies):.1f} ms, p95 {p95:.1f} ms"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke, security-header, and latency checks")
    parser.add_argument("--frontend-url", required=True)
    parser.add_argument("--backend-url", required=True)
    parser.add_argument("--csv", type=Path, default=Path("sample-data/redcov_banyumanik.csv"))
    parser.add_argument("--health-requests", type=int, default=20)
    parser.add_argument("--timeout", type=float, default=900)
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
