import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

app = FastAPI(
    title="CSV Coverage Grid Converter API",
    version="1.0.0",
    description="Temporary CSV-to-KML/GeoPackage coverage grid conversion service.",
)

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    expose_headers=[
        "Content-Disposition",
        "X-Total-Rows",
        "X-Valid-Rows",
        "X-Invalid-Rows",
    ],
)
app.include_router(router)
