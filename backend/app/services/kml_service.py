import hashlib
import html
import math
import xml.etree.ElementTree as ET
from pathlib import Path

import geopandas as gpd
import pandas as pd

from app.utils.colors import CENTER_POINT_COLOR, category_to_hex, hex_to_kml_color

KML_NAMESPACE = "http://www.opengis.net/kml/2.2"
ET.register_namespace("", KML_NAMESPACE)


def _tag(name: str) -> str:
    return f"{{{KML_NAMESPACE}}}{name}"


def _display(value: object, suffix: str = "") -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)) or pd.isna(value):
        return "—"
    return f"{value}{suffix}"


def _description(row: pd.Series) -> str:
    fields = (
        ("Geohash", _display(row.get("geohash7"))),
        ("Average RSRP", _display(row.get("avg_rsrp"), " dBm")),
        ("Total Subscriber Count", _display(row.get("total_subscriber_count"))),
        ("Category", _display(row.get("red_cov_category"))),
        ("Source Latitude", _display(row.get("latitude_geohash7"))),
        ("Source Longitude", _display(row.get("longitude_geohash7"))),
    )
    rows = "".join(
        f"<tr><th style='text-align:left;padding:4px 12px 4px 0'>{html.escape(label)}</th>"
        f"<td>{html.escape(value)}</td></tr>"
        for label, value in fields
    )
    return f"<table>{rows}</table>"


def _category_key(category: object) -> str:
    if category is None or pd.isna(category):
        return "OTHER"
    return str(category).strip().upper() or "OTHER"


def _style_id(category: object) -> str:
    digest = hashlib.sha1(
        _category_key(category).encode("utf-8"), usedforsecurity=False
    ).hexdigest()[:10]
    return f"category-{digest}"


def write_kml(geodataframe: gpd.GeoDataFrame, output_path: Path, fill_opacity: float) -> None:
    if geodataframe.crs is None or geodataframe.crs.to_epsg() != 4326:
        geodataframe = geodataframe.to_crs("EPSG:4326")

    root = ET.Element(_tag("kml"))
    document = ET.SubElement(root, _tag("Document"))
    ET.SubElement(document, _tag("name")).text = output_path.stem

    categories = {
        _category_key(value): (value, category_to_hex(value))
        for value in geodataframe["red_cov_category"]
    }
    for category_key in sorted(categories):
        category, hex_color = categories[category_key]
        style = ET.SubElement(document, _tag("Style"), {"id": _style_id(category)})
        icon_style = ET.SubElement(style, _tag("IconStyle"))
        ET.SubElement(icon_style, _tag("color")).text = hex_to_kml_color(
            CENTER_POINT_COLOR, 1.0
        )
        ET.SubElement(icon_style, _tag("scale")).text = "0.8"
        icon = ET.SubElement(icon_style, _tag("Icon"))
        ET.SubElement(icon, _tag("href")).text = (
            "http://maps.google.com/mapfiles/kml/shapes/shaded_dot.png"
        )
        line_style = ET.SubElement(style, _tag("LineStyle"))
        ET.SubElement(line_style, _tag("color")).text = hex_to_kml_color(hex_color, 1.0)
        ET.SubElement(line_style, _tag("width")).text = "1.5"
        polygon_style = ET.SubElement(style, _tag("PolyStyle"))
        ET.SubElement(polygon_style, _tag("color")).text = hex_to_kml_color(
            hex_color, fill_opacity
        )
        ET.SubElement(polygon_style, _tag("fill")).text = "1"
        ET.SubElement(polygon_style, _tag("outline")).text = "1"

    for index, row in geodataframe.iterrows():
        placemark = ET.SubElement(document, _tag("Placemark"))
        raw_name = row.get("geohash7")
        name = str(raw_name).strip() if raw_name is not None and not pd.isna(raw_name) else ""
        ET.SubElement(placemark, _tag("name")).text = name or f"Grid {index + 1}"
        ET.SubElement(placemark, _tag("styleUrl")).text = (
            f"#{_style_id(row.get('red_cov_category'))}"
        )
        ET.SubElement(placemark, _tag("description")).text = _description(row)

        extended_data = ET.SubElement(placemark, _tag("ExtendedData"))
        for field in (
            "geohash7",
            "avg_rsrp",
            "total_subscriber_count",
            "red_cov_category",
            "latitude_geohash7",
            "longitude_geohash7",
            "style_color",
        ):
            data = ET.SubElement(extended_data, _tag("Data"), {"name": field})
            ET.SubElement(data, _tag("value")).text = _display(row.get(field))

        multi_geometry = ET.SubElement(placemark, _tag("MultiGeometry"))
        polygon_element = ET.SubElement(multi_geometry, _tag("Polygon"))
        ET.SubElement(polygon_element, _tag("tessellate")).text = "1"
        outer_boundary = ET.SubElement(polygon_element, _tag("outerBoundaryIs"))
        linear_ring = ET.SubElement(outer_boundary, _tag("LinearRing"))
        coordinates = " ".join(
            f"{longitude:.10f},{latitude:.10f},0"
            for longitude, latitude in row.geometry.exterior.coords
        )
        ET.SubElement(linear_ring, _tag("coordinates")).text = coordinates

        point = ET.SubElement(multi_geometry, _tag("Point"))
        source_longitude = float(row["longitude_geohash7"])
        source_latitude = float(row["latitude_geohash7"])
        ET.SubElement(point, _tag("coordinates")).text = (
            f"{source_longitude:.10f},{source_latitude:.10f},0"
        )

    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    tree.write(output_path, encoding="utf-8", xml_declaration=True)
