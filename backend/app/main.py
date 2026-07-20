import os
from collections.abc import Awaitable, Callable

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.datastructures import MutableHeaders
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.types import Message, Receive, Scope, Send

from app.api.routes import router
from app.config import max_upload_bytes

LIMITED_UPLOAD_PATHS = {"/api/csv/inspect", "/api/convert"}
MULTIPART_OVERHEAD_BYTES = 2 * 1024 * 1024
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


class RequestBodyTooLarge(Exception):
    pass


class RequestBodyLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope.get("method") != "POST"
            or scope.get("path") not in LIMITED_UPLOAD_PATHS
        ):
            await self.app(scope, receive, send)
            return

        limit = max_upload_bytes() + MULTIPART_OVERHEAD_BYTES
        headers = dict(scope.get("headers", []))
        raw_content_length = headers.get(b"content-length")
        if raw_content_length:
            try:
                content_length = int(raw_content_length)
            except ValueError:
                content_length = -1
            if content_length < 0 or content_length > limit:
                await self._reject(send)
                return

        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise RequestBodyTooLarge
            return message

        async def tracked_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except RequestBodyTooLarge:
            if response_started:
                raise
            await self._reject(send)

    @staticmethod
    async def _reject(send: Send) -> None:
        detail = b'{"detail":"The request body exceeds the configured upload limit."}'
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(detail)).encode("ascii")),
                    (b"cache-control", b"no-store"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": detail})


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        async def send_with_security_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.setdefault("X-Content-Type-Options", "nosniff")
                headers.setdefault("X-Frame-Options", "DENY")
                headers.setdefault("Referrer-Policy", "no-referrer")
                headers.setdefault(
                    "Permissions-Policy",
                    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
                )
                headers.setdefault("Cache-Control", "no-store")
            await send(message)

        await self.app(scope, receive, send_with_security_headers)


def _comma_separated_env(name: str, fallback: str = "") -> list[str]:
    return [value.strip() for value in os.getenv(name, fallback).split(",") if value.strip()]


environment = os.getenv("ENVIRONMENT", "development").strip().lower()
production = environment == "production"
app = FastAPI(
    title="CSV Coverage Grid Converter API",
    version="1.0.0",
    description="Temporary CSV-to-KML/GeoPackage coverage grid conversion service.",
    docs_url=None if production else "/docs",
    redoc_url=None if production else "/redoc",
    openapi_url=None if production else "/openapi.json",
)

configured_origins = os.getenv("FRONTEND_ORIGINS") or os.getenv("FRONTEND_ORIGIN")
if not configured_origins:
    if production:
        raise RuntimeError("FRONTEND_ORIGINS is required in production.")
    configured_origins = "http://localhost:3000"
frontend_origins = [value.strip() for value in configured_origins.split(",") if value.strip()]
if production and (
    "*" in frontend_origins
    or any(not origin.startswith("https://") for origin in frontend_origins)
):
    raise RuntimeError("FRONTEND_ORIGINS must contain explicit HTTPS origins in production.")

trusted_hosts = _comma_separated_env("TRUSTED_HOSTS")
if production and not trusted_hosts:
    raise RuntimeError("TRUSTED_HOSTS is required in production.")
if trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "Origin", "X-Requested-With"],
    expose_headers=[
        "Content-Disposition",
        "X-Total-Rows",
        "X-Valid-Rows",
        "X-Invalid-Rows",
        "X-Duplicate-Rows",
    ],
)
app.add_middleware(RequestBodyLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.include_router(router)
