from pyproj import CRS


def utm_epsg_for_coordinate(longitude: float, latitude: float) -> int:
    if not -180 <= longitude <= 180:
        raise ValueError("Longitude must be between -180 and 180.")
    if not -90 <= latitude <= 90:
        raise ValueError("Latitude must be between -90 and 90.")

    # Longitude 180 belongs to zone 60 rather than the mathematical zone 61.
    zone = min(60, max(1, int((longitude + 180) // 6) + 1))
    return (32600 if latitude >= 0 else 32700) + zone


def utm_crs_for_coordinate(longitude: float, latitude: float) -> CRS:
    return CRS.from_epsg(utm_epsg_for_coordinate(longitude, latitude))
