import xml.etree.ElementTree as ET
from pathlib import Path


GOOGLE_SATELLITE_URL = "https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"


def _vector_layer(layer_id: str, layer_name: str, gpkg_name: str, source_layer: str) -> ET.Element:
    layer = ET.Element("maplayer", {"type": "vector", "geometry": "Unknown geometry"})
    ET.SubElement(layer, "id").text = layer_id
    ET.SubElement(layer, "datasource").text = f"./{gpkg_name}|layername={source_layer}"
    ET.SubElement(layer, "layername").text = layer_name
    ET.SubElement(layer, "provider", {"encoding": ""}).text = "ogr"
    ET.SubElement(layer, "vectorjoins")
    ET.SubElement(layer, "layerDependencies")
    ET.SubElement(layer, "dataDependencies")
    return layer


def _satellite_layer() -> ET.Element:
    layer = ET.Element("maplayer", {"type": "raster"})
    ET.SubElement(layer, "id").text = "google_satellite"
    ET.SubElement(layer, "datasource").text = f"type=xyz&url={GOOGLE_SATELLITE_URL}&zmin=0&zmax=22"
    ET.SubElement(layer, "layername").text = "Google Satellite"
    ET.SubElement(layer, "provider").text = "wms"
    return layer


def write_qgis_project(output_path: Path, gpkg_name: str) -> None:
    """Write a portable QGIS project that opens the output over Google Satellite."""
    root = ET.Element("qgis", {"version": "3.34.0", "projectname": "Coverage map"})
    ET.SubElement(root, "homePath", {"path": ""})
    ET.SubElement(root, "title").text = "Coverage map"

    tree = ET.SubElement(root, "layer-tree-group", {"name": ""})
    layer_specs = (
        ("coverage_grid", "Coverage grid", "coverage_grid", "ogr"),
        ("coverage_centers", "Coverage centers", "coverage_centers", "ogr"),
        ("google_satellite", "Google Satellite", GOOGLE_SATELLITE_URL, "wms"),
    )
    for layer_id, layer_name, source, provider in layer_specs:
        source_value = (
            f"./{gpkg_name}|layername={source}" if provider == "ogr" else f"type=xyz&url={source}&zmin=0&zmax=22"
        )
        ET.SubElement(
            tree,
            "layer-tree-layer",
            {
                "id": layer_id,
                "name": layer_name,
                "source": source_value,
                "providerKey": provider,
                "checked": "Qt::Checked",
                "expanded": "1",
            },
        )

    project_layers = ET.SubElement(root, "projectlayers")
    project_layers.append(_vector_layer("coverage_grid", "Coverage grid", gpkg_name, "coverage_grid"))
    project_layers.append(_vector_layer("coverage_centers", "Coverage centers", gpkg_name, "coverage_centers"))
    project_layers.append(_satellite_layer())

    ET.indent(root, space="  ")
    ET.ElementTree(root).write(output_path, encoding="utf-8", xml_declaration=True)
