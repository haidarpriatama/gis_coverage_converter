import sqlite3
import xml.etree.ElementTree as ET
from pathlib import Path

import geopandas as gpd
import pandas as pd

from app.utils.colors import CENTER_POINT_COLOR, category_to_hex


def _rgba(hex_color: str, alpha: int = 255) -> str:
    value = hex_color.lstrip("#")
    red, green, blue = (int(value[index : index + 2], 16) for index in (0, 2, 4))
    return f"{red},{green},{blue},{alpha}"


def _symbol_layer(symbol: ET.Element, geometry_type: str, hex_color: str) -> None:
    if geometry_type == "fill":
        layer = ET.SubElement(
            symbol,
            "layer",
            {"class": "SimpleFill", "enabled": "1", "locked": "0", "pass": "0"},
        )
        options = {
            "color": _rgba(hex_color, 153),
            "outline_color": _rgba(hex_color),
            "outline_style": "solid",
            "outline_width": "0.3",
            "outline_width_unit": "MM",
            "style": "solid",
        }
    else:
        layer = ET.SubElement(
            symbol,
            "layer",
            {"class": "SimpleMarker", "enabled": "1", "locked": "0", "pass": "0"},
        )
        options = {
            "color": _rgba(hex_color),
            "name": "circle",
            "outline_color": "255,255,255,255",
            "outline_style": "solid",
            "outline_width": "1",
            "outline_width_unit": "Pixel",
            "scale_method": "diameter",
            "size": "8",
            "size_unit": "Pixel",
        }

    option_map = ET.SubElement(layer, "Option", {"type": "Map"})
    for name, value in options.items():
        ET.SubElement(
            option_map,
            "Option",
            {"name": name, "type": "QString", "value": value},
        )


def _qgis_style(data: gpd.GeoDataFrame, geometry_type: str) -> str:
    root = ET.Element(
        "qgis",
        {"version": "3.34.0", "styleCategories": "Symbology", "labelsEnabled": "0"},
    )
    if geometry_type == "marker":
        renderer = ET.SubElement(
            root,
            "renderer-v2",
            {
                "type": "singleSymbol",
                "symbollevels": "0",
                "enableorderby": "0",
                "forceraster": "0",
            },
        )
        symbols_element = ET.SubElement(renderer, "symbols")
        symbol = ET.SubElement(
            symbols_element,
            "symbol",
            {
                "name": "0",
                "type": geometry_type,
                "alpha": "1",
                "clip_to_extent": "1",
                "force_rhr": "0",
                "is_animated": "0",
            },
        )
        _symbol_layer(symbol, geometry_type, CENTER_POINT_COLOR)
        return ET.tostring(root, encoding="unicode")

    renderer = ET.SubElement(
        root,
        "renderer-v2",
        {
            "type": "categorizedSymbol",
            "attr": "red_cov_category",
            "symbollevels": "0",
            "enableorderby": "0",
            "forceraster": "0",
        },
    )
    categories_element = ET.SubElement(renderer, "categories")
    symbols_element = ET.SubElement(renderer, "symbols")

    categories = (
        data[["red_cov_category", "style_color"]]
        .drop_duplicates()
        .reset_index(drop=True)
    )
    for index, row in categories.iterrows():
        raw_category = row["red_cov_category"]
        category = "" if pd.isna(raw_category) else str(raw_category)
        label = category or "Other"
        color = str(row["style_color"] or category_to_hex(raw_category))
        ET.SubElement(
            categories_element,
            "category",
            {
                "value": category,
                "label": label,
                "symbol": str(index),
                "render": "true",
            },
        )
        symbol = ET.SubElement(
            symbols_element,
            "symbol",
            {
                "name": str(index),
                "type": geometry_type,
                "alpha": "1",
                "clip_to_extent": "1",
                "force_rhr": "0",
                "is_animated": "0",
            },
        )
        _symbol_layer(symbol, geometry_type, color)

    source_symbol = ET.SubElement(renderer, "source-symbol")
    default_symbol = ET.SubElement(
        source_symbol,
        "symbol",
        {
            "name": "0",
            "type": geometry_type,
            "alpha": "1",
            "clip_to_extent": "1",
            "force_rhr": "0",
            "is_animated": "0",
        },
    )
    _symbol_layer(default_symbol, geometry_type, "#808080")
    return ET.tostring(root, encoding="unicode")


def _store_qgis_style(
    output_path: Path,
    layer_name: str,
    geometry_column: str,
    style_qml: str,
) -> None:
    with sqlite3.connect(output_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS layer_styles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                f_table_catalog TEXT,
                f_table_schema TEXT,
                f_table_name TEXT NOT NULL,
                f_geometry_column TEXT,
                styleName TEXT NOT NULL,
                styleQML TEXT NOT NULL,
                styleSLD TEXT,
                useAsDefault INTEGER,
                description TEXT,
                owner TEXT,
                ui TEXT,
                update_time DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            "DELETE FROM layer_styles WHERE f_table_name = ? AND styleName = ?",
            (layer_name, "default"),
        )
        connection.execute(
            """
            INSERT INTO layer_styles (
                f_table_catalog, f_table_schema, f_table_name, f_geometry_column,
                styleName, styleQML, styleSLD, useAsDefault, description, owner, ui
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "",
                "",
                layer_name,
                geometry_column,
                "default",
                style_qml,
                "",
                1,
                "Coverage category colors generated by CSV Coverage Grid Converter",
                "",
                "",
            ),
        )


def write_gpkg(geodataframe: gpd.GeoDataFrame, output_path: Path) -> None:
    polygons = geodataframe.to_crs("EPSG:4326")
    polygons.to_file(
        output_path,
        layer="coverage_grid",
        driver="GPKG",
        engine="pyogrio",
        index=False,
    )

    point_attributes = polygons.drop(columns="geometry").copy()
    source_points = gpd.GeoDataFrame(
        point_attributes,
        geometry=gpd.points_from_xy(
            point_attributes["longitude_geohash7"],
            point_attributes["latitude_geohash7"],
            crs="EPSG:4326",
        ),
        crs="EPSG:4326",
    )
    source_points.to_file(
        output_path,
        layer="coverage_points",
        driver="GPKG",
        engine="pyogrio",
        index=False,
        mode="a",
    )

    _store_qgis_style(
        output_path,
        "coverage_grid",
        "geom",
        _qgis_style(polygons, "fill"),
    )
    _store_qgis_style(
        output_path,
        "coverage_points",
        "geom",
        _qgis_style(source_points, "marker"),
    )
