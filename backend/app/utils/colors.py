import re

DEFAULT_COLOR = "#808080"
CENTER_POINT_COLOR = "#FF0000"
CATEGORY_COLORS = {
    "RED ENGINEERING": "#FF0000",
    "RED OPTIM": "#FFFF00",
    "BAD NON POTENTIAL": "#00B050",
    "NOT RED COV": "#0000FF",
}


def category_to_hex(category: object) -> str:
    normalized = str(category).strip().upper() if category is not None else ""
    return CATEGORY_COLORS.get(normalized, DEFAULT_COLOR)


def hex_to_kml_color(hex_color: str, opacity: float = 1.0) -> str:
    """Convert #RRGGBB and opacity to KML AABBGGRR format."""
    normalized = hex_color.strip().lstrip("#")
    if not re.fullmatch(r"[0-9a-fA-F]{6}", normalized):
        raise ValueError("Color must use the #RRGGBB format.")
    if not 0 <= opacity <= 1:
        raise ValueError("Opacity must be between 0 and 1.")

    red, green, blue = normalized[0:2], normalized[2:4], normalized[4:6]
    alpha = round(opacity * 255)
    return f"{alpha:02X}{blue}{green}{red}".upper()
