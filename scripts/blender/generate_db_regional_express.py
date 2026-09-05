"""Generate the first Blender review candidate for the DB Regional-Express set.

The user's references show a DB Class 245 diesel locomotive, conventional DB
double-deck regional coaches, and the matching sloped-cab double-deck driving
trailer.  This script builds an original four-vehicle push-pull interpretation:

    BR 245 + mixed-class Dosto + second-class Dosto + Dosto driving trailer

Reference photographs remain research-only.  No photograph, logo, wordmark or
third-party texture is embedded in the Blender source or exported GLBs.

Coordinate contract before glTF export:
  * metres
  * X = train forward / formation length
  * Y = lateral / vehicle width
  * Z = height above rail contact plane
  * wheel tread centres = +/- 0.7175 m
  * wheel bottoms = Z 0

The glTF exporter converts Blender Z-up to glTF Y-up for React Three Fiber.
"""

from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path
from typing import Sequence

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
COMMON_SCRIPT = Path(__file__).with_name("generate_railjet_classic.py")
SPEC = importlib.util.spec_from_file_location("corner_rails_blender_common", COMMON_SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Could not load shared Blender helpers: {COMMON_SCRIPT}")
common = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(common)

# The Railjet helper deliberately shares primitive mesh data very aggressively.
# For this candidate we need several livery colours on that repeated geometry.
# Cache one primitive mesh per material so objects keep the intended material
# without duplicating a new mesh for every window, door, light, or bogie part.
_ORIGINAL_LINK_OBJECT = common.link_object
_MATERIAL_MESH_CACHE: dict[tuple[str, str], bpy.types.Mesh] = {}


def material_safe_link_object(
    collection: bpy.types.Collection,
    name: str,
    data: bpy.types.ID | None,
    *,
    location: Sequence[float] = (0.0, 0.0, 0.0),
    scale: Sequence[float] = (1.0, 1.0, 1.0),
    rotation: Sequence[float] = (0.0, 0.0, 0.0),
    parent: bpy.types.Object | None = None,
    material: bpy.types.Material | None = None,
) -> bpy.types.Object:
    if material is not None and isinstance(data, bpy.types.Mesh):
        key = (data.name, material.name)
        material_mesh = _MATERIAL_MESH_CACHE.get(key)
        if material_mesh is None:
            material_mesh = data.copy()
            material_mesh.name = f"{data.name}__{material.name}"
            material_mesh.materials.clear()
            material_mesh.materials.append(material)
            _MATERIAL_MESH_CACHE[key] = material_mesh
        data = material_mesh
        material = None
    return _ORIGINAL_LINK_OBJECT(
        collection,
        name,
        data,
        location=location,
        scale=scale,
        rotation=rotation,
        parent=parent,
        material=material,
    )


common.link_object = material_safe_link_object

SOURCE_DIR = PROJECT_ROOT / "assets" / "blender" / "db-regional-express"
OUTPUT_DIR = PROJECT_ROOT / "public" / "models" / "train-lab" / "db-regional-express"
MASTER_PATH = SOURCE_DIR / "db-regional-express-master.blend"

LOCOMOTIVE_LENGTH = 18.90
LOCOMOTIVE_WIDTH = 2.978
LOCOMOTIVE_HEIGHT = 4.275
COACH_LENGTH = 26.80
COACH_WIDTH = 2.78
COACH_HEIGHT = 4.63
FORMATION_GAP = 0.18
FORMATION_LENGTH = LOCOMOTIVE_LENGTH + 3 * COACH_LENGTH + 3 * FORMATION_GAP

STANDARD_GAUGE_METERS = 1.435
WHEEL_TREAD_CENTER_METERS = STANDARD_GAUGE_METERS / 2
RAIL_CONTACT_PLANE_Z = 0.0

# Manufacturer/operator material is used to corroborate the vehicle families.
# The user's four local images remain the primary appearance references, but are
# intentionally represented by filename only and are not copied into the repo.
OFFICIAL_SOURCES = (
    "https://www.alstom.com/solutions/rolling-stock/traxx-locomotives-superior-performance-every-environment",
    "https://www.deutschebahn.com/resource/blob/12724132/94cb6e76adb9ff756caf9f2940d0bcba/DB-245_________12-2013-data.pdf",
    "https://mediathek.deutschebahn.com/marsDB/en/instance/picture/Regionalbahn-zwischen-Biessenhofen---Fuessen.xhtml?oid=4771052",
    "https://static.maerklin.de/damcontent/67/c1/67c14cd4c5695139104abb44a822f3e81714454196.pdf",
    "https://static.maerklin.de/damcontent/e8/c7/e8c7b162b92f2a98c76550a19ffc900c1654606154.pdf",
    "https://www.deutschebahn.com/resource/blob/12723972/27f230ccadd935116edcb92217fda017/DB-Wg-D_____11-2004_Doppelstock-data.pdf",
)

USER_REFERENCE_FILENAMES = (
    "Regio_Clean_side_view.jpg",
    "Regio_miniature_view.jpg",
    "Regio_real_photo_back view.jpg",
    "Regio_single_cabcar_side_view.jpg",
)


def ensure_directories() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.fps = 24
    scene.frame_start = 1
    scene.frame_end = 481
    scene.world = bpy.data.worlds.new("DB_RE_Review_World")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.10, 0.14, 0.16, 1.0)
        background.inputs["Strength"].default_value = 0.62


def make_materials() -> dict[str, bpy.types.Material]:
    make = common.make_material
    materials = {
        "traffic_red": make("DBRE_Traffic_Red", (0.66, 0.012, 0.025, 1), metallic=0.05, roughness=0.38),
        "deep_red": make("DBRE_Deep_Red", (0.30, 0.008, 0.014, 1), metallic=0.08, roughness=0.42),
        "light_grey": make("DBRE_Light_Grey", (0.74, 0.75, 0.72, 1), metallic=0.14, roughness=0.39),
        "mid_grey": make("DBRE_Mid_Grey", (0.31, 0.34, 0.34, 1), metallic=0.24, roughness=0.46),
        "roof": make("DBRE_Roof_Grey", (0.18, 0.20, 0.20, 1), metallic=0.32, roughness=0.48),
        "anthracite": make("DBRE_Anthracite", (0.035, 0.043, 0.045, 1), metallic=0.20, roughness=0.32),
        "glass": make("DBRE_Smoked_Glass", (0.018, 0.052, 0.067, 1), metallic=0.30, roughness=0.16),
        "warm_glass": make("DBRE_Warm_Interior", (0.42, 0.23, 0.07, 1), metallic=0.02, roughness=0.24),
        "underframe": make("DBRE_Underframe", (0.025, 0.030, 0.032, 1), metallic=0.58, roughness=0.48),
        "wheel": make("DBRE_Wheel", (0.045, 0.050, 0.052, 1), metallic=0.85, roughness=0.25),
        "steel": make("DBRE_Steel", (0.34, 0.37, 0.37, 1), metallic=0.88, roughness=0.24),
        "lamp": make("DBRE_Lamp", (1.0, 0.76, 0.28, 1), metallic=0.02, roughness=0.16),
        "display": make("DBRE_Destination_Display", (0.20, 0.28, 0.04, 1), metallic=0.04, roughness=0.24),
        "first_marker": make("DBRE_First_Class_Marker", (0.92, 0.73, 0.20, 1), metallic=0.10, roughness=0.30),
        "ballast": make("DBRE_Review_Ballast", (0.20, 0.22, 0.21, 1), roughness=0.96),
        "sleeper": make("DBRE_Review_Sleeper", (0.23, 0.14, 0.08, 1), roughness=0.92),
        "ground": make("DBRE_Review_Ground", (0.25, 0.37, 0.27, 1), roughness=0.98),
    }
    lamp_bsdf = materials["lamp"].node_tree.nodes.get("Principled BSDF")
    if lamp_bsdf:
        emission_input = lamp_bsdf.inputs.get("Emission Color") or lamp_bsdf.inputs.get("Emission")
        if emission_input:
            emission_input.default_value = (1.0, 0.70, 0.22, 1.0)
        emission_strength = lamp_bsdf.inputs.get("Emission Strength")
        if emission_strength:
            emission_strength.default_value = 2.4
    display_bsdf = materials["display"].node_tree.nodes.get("Principled BSDF")
    if display_bsdf:
        emission_input = display_bsdf.inputs.get("Emission Color") or display_bsdf.inputs.get("Emission")
        if emission_input:
            emission_input.default_value = (0.34, 0.58, 0.04, 1.0)
        emission_strength = display_bsdf.inputs.get("Emission Strength")
        if emission_strength:
            emission_strength.default_value = 1.1
    return materials


LOCO_PROFILE = (
    (-1.18, 0.70), (-1.45, 0.93), (-1.489, 1.23), (-1.489, 3.25),
    (-1.38, 3.63), (-1.02, 3.98), (-0.54, 4.20), (0.0, 4.275),
    (0.54, 4.20), (1.02, 3.98), (1.38, 3.63), (1.489, 3.25),
    (1.489, 1.23), (1.45, 0.93), (1.18, 0.70),
)

DOSTO_PROFILE = (
    (-1.10, 0.78), (-1.34, 0.96), (-1.39, 1.20), (-1.39, 3.76),
    (-1.31, 4.08), (-1.04, 4.37), (-0.62, 4.55), (0.0, 4.63),
    (0.62, 4.55), (1.04, 4.37), (1.31, 4.08), (1.39, 3.76),
    (1.39, 1.20), (1.34, 0.96), (1.10, 0.78),
)


def attach_metric_contract(collection: bpy.types.Collection, root: bpy.types.Object, *, anchor: bool = False) -> None:
    if anchor:
        contact = common.add_empty(collection, "rail_contact_origin", root)
        contact.location = (0, 0, 0)
        contact.empty_display_size = 0.28
    root["units"] = "meters"
    root["forward_axis"] = "+X"
    root["lateral_axis"] = "+Y"
    root["up_axis"] = "+Z"
    root["standard_gauge_m"] = STANDARD_GAUGE_METERS
    root["wheel_tread_center_m"] = WHEEL_TREAD_CENTER_METERS
    root["rail_contact_plane_z"] = RAIL_CONTACT_PLANE_Z
    root["traction"] = "diesel locomotive; no pantograph"


def add_wheelset_bogie(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    name: str,
    x: float,
    axle_spacing: float,
    wheel_radius: float,
    sideframe_half_width: float,
) -> None:
    bogie = common.add_empty(collection, name, root)
    bogie.location.x = x
    common.add_box(collection, cube, f"{name}_bolster", (axle_spacing + 1.25, 1.82, 0.24), (0, 0, 0.71), materials["underframe"], bogie)
    common.add_box(collection, cube, f"{name}_crossbeam", (0.44, 2.08, 0.20), (0, 0, 0.84), materials["underframe"], bogie)
    for side in (-1, 1):
        common.add_box(collection, cube, f"{name}_sideframe_{side}", (axle_spacing + 0.92, 0.18, 0.46), (0, side * sideframe_half_width, 0.64), materials["underframe"], bogie)
        for axle_index, axle_x in enumerate((-axle_spacing / 2, axle_spacing / 2)):
            common.add_cylinder(
                collection, cylinder, f"{name}_wheel_{side}_{axle_index}", wheel_radius, 0.22,
                (axle_x, side * WHEEL_TREAD_CENTER_METERS, wheel_radius), materials["wheel"], bogie,
                rotation=(math.pi / 2, 0, 0),
            )
            common.add_cylinder(
                collection, cylinder, f"{name}_flange_{side}_{axle_index}", wheel_radius * 1.07, 0.035,
                (axle_x, side * (WHEEL_TREAD_CENTER_METERS - 0.105), wheel_radius), materials["wheel"], bogie,
                rotation=(math.pi / 2, 0, 0),
            )
            common.add_cylinder(
                collection, cylinder, f"{name}_brake_disc_{side}_{axle_index}", wheel_radius * 0.56, 0.035,
                (axle_x, side * (WHEEL_TREAD_CENTER_METERS + 0.15), wheel_radius), materials["steel"], bogie,
                rotation=(math.pi / 2, 0, 0),
            )
            common.add_box(collection, cube, f"{name}_spring_{side}_{axle_index}", (0.36, 0.16, 0.30), (axle_x, side * sideframe_half_width, 0.94), materials["steel"], bogie)


def roof_surface_mesh(name: str, length: float, *, cab_cut: float = 0.35) -> bpy.types.Mesh:
    x0 = -length / 2 + cab_cut
    x1 = length / 2 - 0.32
    arc = [(-1.31, 4.05), (-1.02, 4.35), (-0.58, 4.54), (0, 4.62), (0.58, 4.54), (1.02, 4.35), (1.31, 4.05)]
    vertices = [(x, y, z) for x in (x0, x1) for y, z in arc]
    ring = len(arc)
    faces = [(index, index + 1, ring + index + 1, ring + index) for index in range(ring - 1)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return mesh


def add_buffers_and_coupler(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    x: float,
    outward_sign: int,
    prefix: str,
) -> None:
    for side in (-1, 1):
        common.add_cylinder(
            collection, cylinder, f"{prefix}_buffer_{side}", 0.18, 0.22,
            (x, side * 0.88, 0.83), materials["underframe"], root,
            rotation=(0, math.pi / 2, 0),
        )
    common.add_box(collection, cube, f"{prefix}_coupler", (0.46, 0.22, 0.18), (x + outward_sign * 0.18, 0, 0.67), materials["underframe"], root)
    common.add_box(collection, cube, f"{prefix}_hose", (0.30, 0.08, 0.08), (x + outward_sign * 0.13, -0.33, 0.53), materials["anthracite"], root, rotation=(0, 0.35 * outward_sign, 0))


def add_front_face(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    sign: int,
    half_length: float,
    prefix: str,
    trailer: bool = False,
) -> None:
    s = float(sign)
    face_x = s * (half_length + 0.025)
    lower_z = 2.22 if trailer else 2.48
    upper_z = 3.74 if trailer else 3.64
    if not trailer:
        add_br245_front_details(collection, root, cube, materials, sign=sign, half_length=half_length, prefix=prefix)
        return
    top_x = face_x - s * 0.12
    mask_vertices = [
        (face_x, -1.02, lower_z), (face_x, 1.02, lower_z),
        (top_x, 1.15, upper_z), (top_x, -1.15, upper_z),
    ]
    mask_material = materials["mid_grey"] if trailer else materials["traffic_red"]
    mask = common.polygon_mesh(f"{prefix}_cab_mask_mesh", mask_vertices, mask_material)
    common.link_object(collection, f"{prefix}_cab_mask", mask, parent=root)
    for side in (-1, 1):
        y0, y1 = (0.08 * side, 0.92 * side)
        if side < 0:
            y0, y1 = y1, y0
        glass_vertices = [
            (face_x + s * 0.018, y0 * 0.74, lower_z + 0.34),
            (face_x + s * 0.018, y1 * 0.78, lower_z + 0.34),
            (top_x + s * 0.018, y1, upper_z - 0.18),
            (top_x + s * 0.018, y0, upper_z - 0.18),
        ]
        glass = common.polygon_mesh(f"{prefix}_windscreen_{side}_mesh", glass_vertices, materials["glass"])
        common.link_object(collection, f"{prefix}_windscreen_{side}", glass, parent=root)

    display_center_x = face_x + s * 0.035
    common.add_box(collection, cube, f"{prefix}_destination_display", (0.10, 1.20, 0.25), (display_center_x, 0, upper_z + 0.12), materials["display"], root)
    if trailer:
        common.add_box(collection, cube, f"{prefix}_headlight_panel", (0.10, 1.92, 0.46), (face_x + s * 0.018, 0, 1.55), materials["anthracite"], root)
    for side in (-1, 1):
        common.add_box(collection, cube, f"{prefix}_lower_headlight_{side}", (0.10, 0.30, 0.22), (face_x + s * 0.025, side * 0.69, 1.42), materials["lamp"], root)
        common.add_box(collection, cube, f"{prefix}_marker_light_{side}", (0.09, 0.20, 0.15), (face_x + s * 0.02, side * 0.78, 2.03), materials["lamp"], root)
    common.add_box(collection, cube, f"{prefix}_centre_lamp", (0.09, 0.24, 0.18), (top_x + s * 0.04, 0, upper_z + 0.43), materials["lamp"], root)


def br245_front_surface_x(sign: int, y: float, z: float, half_length: float, offset: float = 0.0) -> float:
    """Sample the gently raked, slightly crowned TRAXX DE cab face."""
    height = max(0.0, min(1.0, (z - 1.20) / 2.55))
    crown = 0.012 * (abs(y) / 1.18) ** 1.6
    # The shared loft closes at the nominal end plane. Keep every recognition
    # patch just outside that cap, while a subtle height slope still makes the
    # visor and fascia read as one raked surface at isometric scale.
    return sign * (half_length + 0.052 - 0.018 * height - crown + offset)


def add_br245_front_patch(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
    *,
    name: str,
    sign: int,
    half_length: float,
    yz_outline: list[tuple[float, float]],
    material_key: str,
    offset: float,
) -> bpy.types.Object:
    points = yz_outline if sign > 0 else list(reversed(yz_outline))
    vertices = [(br245_front_surface_x(sign, y, z, half_length, offset), y, z) for y, z in points]
    mesh = common.polygon_mesh(f"{name}_mesh", vertices, materials[material_key])
    return common.link_object(collection, name, mesh, parent=root)


def add_br245_front_details(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    sign: int,
    half_length: float,
    prefix: str,
) -> None:
    # White/grey lower fascia and dark visor reproduce the strongest BR 245
    # recognition cues without shipping a protected DB logo texture.
    add_br245_front_patch(
        collection, root, materials, name=f"{prefix}_light_fascia", sign=sign,
        half_length=half_length,
        yz_outline=[(-0.91, 1.16), (-1.04, 2.34), (1.04, 2.34), (0.91, 1.16)],
        material_key="light_grey", offset=0.022,
    )
    add_br245_front_patch(
        collection, root, materials, name=f"{prefix}_windscreen_mask", sign=sign,
        half_length=half_length,
        yz_outline=[(-1.08, 2.58), (-1.10, 3.45), (-0.91, 3.69), (0.91, 3.69), (1.10, 3.45), (1.08, 2.58)],
        material_key="anthracite", offset=0.030,
    )
    for pane_side in (-1, 1):
        outline = [
            (pane_side * 0.08, 2.70), (pane_side * 0.92, 2.70),
            (pane_side * 0.96, 3.37), (pane_side * 0.79, 3.56),
            (pane_side * 0.10, 3.56),
        ]
        if pane_side > 0:
            outline.reverse()
        add_br245_front_patch(
            collection, root, materials, name=f"{prefix}_windscreen_{pane_side}", sign=sign,
            half_length=half_length, yz_outline=outline, material_key="glass", offset=0.045,
        )
        # Twin rectangular lamp stacks sit in the pale front fascia.
        lamp_y = pane_side * 0.72
        for lamp_index, lamp_z in enumerate((1.55, 1.86)):
            lamp_x = br245_front_surface_x(sign, lamp_y, lamp_z, half_length, 0.052)
            common.add_box(
                collection, cube, f"{prefix}_lamp_{pane_side}_{lamp_index}",
                (0.055, 0.30, 0.18), (lamp_x, lamp_y, lamp_z), materials["lamp"], root,
            )
    display_x = br245_front_surface_x(sign, 0.0, 3.84, half_length, 0.045)
    common.add_box(collection, cube, f"{prefix}_destination_display", (0.055, 1.10, 0.21), (display_x, 0, 3.84), materials["display"], root)
    # A narrow centre seam, wipers and grab rails keep the cab readable close up.
    common.add_box(collection, cube, f"{prefix}_windscreen_divider", (0.052, 0.055, 0.83), (br245_front_surface_x(sign, 0, 3.12, half_length, 0.054), 0, 3.12), materials["anthracite"], root)
    for wiper_side in (-1, 1):
        common.add_beam_between(
            collection, cube, f"{prefix}_wiper_{wiper_side}",
            (br245_front_surface_x(sign, wiper_side * 0.50, 2.72, half_length, 0.060), wiper_side * 0.50, 2.72),
            (br245_front_surface_x(sign, wiper_side * 0.20, 3.42, half_length, 0.060), wiper_side * 0.20, 3.42),
            0.028, materials["underframe"], root,
        )


def br245_side_surface_y(side: int, x: float, offset: float = 0.0) -> float:
    x_abs = abs(x)
    if x_abs <= 7.70:
        half_width = LOCOMOTIVE_WIDTH / 2
    elif x_abs <= 8.30:
        half_width = LOCOMOTIVE_WIDTH / 2 - 0.03 * ((x_abs - 7.70) / 0.60)
    else:
        half_width = LOCOMOTIVE_WIDTH / 2 - 0.31 * min(1.0, (x_abs - 8.30) / 1.15)
    return side * (half_width + offset)


def add_br245_side_patch(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
    *,
    name: str,
    side: int,
    xz_outline: list[tuple[float, float]],
    material_key: str,
    offset: float,
) -> bpy.types.Object:
    points = xz_outline if side > 0 else list(reversed(xz_outline))
    vertices = [(x, br245_side_surface_y(side, x, offset), z) for x, z in points]
    mesh = common.polygon_mesh(f"{name}_mesh", vertices, materials[material_key])
    return common.link_object(collection, name, mesh, parent=root)


def build_br245(
    prototypes: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    collection = common.make_collection("Prototype_br245", prototypes)
    root = common.add_empty(collection, "db_re_br245_root")
    root["vehicle_role"] = "locomotive"
    root["class"] = "DB Class 245 / TRAXX DE Multi-Engine"
    root["length_m"] = LOCOMOTIVE_LENGTH
    sections = [
        (-9.45, 0.68, 0.84, -0.08), (-9.12, 0.84, 0.92, -0.04), (-8.62, 0.95, 0.98, -0.01), (-8.25, 0.99, 0.99, 0),
        (-7.72, 1.0, 1.0, 0), (7.72, 1.0, 1.0, 0), (8.25, 0.99, 0.99, 0),
        (8.62, 0.95, 0.98, -0.01), (9.12, 0.84, 0.92, -0.04), (9.45, 0.68, 0.84, -0.08),
    ]
    shell = common.loft_mesh("br245_lofted_body_mesh", sections, LOCO_PROFILE, materials["traffic_red"])
    common.link_object(collection, "br245_lofted_body", shell, parent=root)
    common.add_box(collection, cube, "br245_underframe", (15.2, 2.22, 0.48), (0, 0, 0.75), materials["underframe"], root)
    common.add_box(collection, cube, "br245_roof_spine", (11.8, 2.27, 0.18), (0, 0, 4.28), materials["roof"], root)

    for side in (-1, 1):
        y = side * (LOCOMOTIVE_WIDTH / 2 + 0.014)
        common.add_box(collection, cube, f"br245_lower_grey_band_{side}", (15.8, 0.05, 0.50), (0, y, 1.14), materials["mid_grey"], root)
        for cab_sign in (-1, 1):
            sign = float(cab_sign)
            cab_mask = [
                (sign * 6.88, 2.73), (sign * 8.62, 2.79),
                (sign * 8.38, 3.57), (sign * 6.95, 3.59),
            ]
            cab_glass = [
                (sign * 7.02, 2.82), (sign * 8.42, 2.87),
                (sign * 8.24, 3.45), (sign * 7.08, 3.48),
            ]
            if cab_sign < 0:
                cab_mask.reverse()
                cab_glass.reverse()
            add_br245_side_patch(collection, root, materials, name=f"br245_side_window_mask_{side}_{cab_sign}", side=side, xz_outline=cab_mask, material_key="anthracite", offset=0.018)
            add_br245_side_patch(collection, root, materials, name=f"br245_side_window_glass_{side}_{cab_sign}", side=side, xz_outline=cab_glass, material_key="glass", offset=0.026)
            common.add_box(collection, cube, f"br245_cab_door_{side}_{cab_sign}", (0.78, 0.062, 1.82), (cab_sign * 6.42, y + side * 0.025, 2.14), materials["traffic_red"], root)
            common.add_box(collection, cube, f"br245_cab_door_window_mask_{side}_{cab_sign}", (0.60, 0.070, 0.64), (cab_sign * 6.42, y + side * 0.054, 2.78), materials["anthracite"], root)
            common.add_box(collection, cube, f"br245_cab_door_window_{side}_{cab_sign}", (0.48, 0.076, 0.52), (cab_sign * 6.42, y + side * 0.072, 2.78), materials["glass"], root)
            common.add_box(collection, cube, f"br245_cab_door_handle_{side}_{cab_sign}", (0.055, 0.084, 0.30), (cab_sign * 6.13, y + side * 0.076, 2.03), materials["light_grey"], root)
            for step_index in range(3):
                common.add_box(collection, cube, f"br245_cab_step_{side}_{cab_sign}_{step_index}", (0.34, 0.14, 0.08), (cab_sign * (6.12 + step_index * 0.11), y + side * 0.13, 1.23 - step_index * 0.17), materials["steel"], root)

        # One large central intake plus asymmetric auxiliary grilles matches
        # the TRAXX DE Multi-Engine silhouette better than repeated windows.
        grille_specs = [(-4.00, 1.62, 0.82), (-2.55, 0.76, 0.72), (2.10, 0.76, 0.72), (3.55, 1.62, 0.82)]
        for vent_index, (x, width, height) in enumerate(grille_specs):
            common.add_box(collection, cube, f"br245_engine_grille_{side}_{vent_index}", (width, 0.075, height), (x, y + side * 0.050, 2.82), materials["deep_red"], root)
            for rib in range(7):
                rib_z = 2.82 - height * 0.36 + rib * height * 0.12
                common.add_box(collection, cube, f"br245_engine_grille_{side}_{vent_index}_rib_{rib}", (width * 0.87, 0.082, 0.025), (x, y + side * 0.070, rib_z), materials["anthracite"], root)
        common.add_box(collection, cube, f"br245_centre_access_panel_{side}", (2.45, 0.064, 1.32), (-0.18, y + side * 0.036, 2.43), materials["traffic_red"], root)
        common.add_box(collection, cube, f"br245_centre_panel_seam_{side}", (0.035, 0.080, 1.18), (-0.18, y + side * 0.074, 2.43), materials["deep_red"], root)
        for fastener_x in (-1.18, 0.82):
            common.add_box(collection, cube, f"br245_access_handle_{side}_{fastener_x}", (0.04, 0.084, 0.26), (fastener_x, y + side * 0.078, 2.30), materials["light_grey"], root)

    for sign in (-1, 1):
        add_front_face(collection, root, cube, materials, sign=sign, half_length=LOCOMOTIVE_LENGTH / 2, prefix=f"br245_cab_{sign}")
        add_buffers_and_coupler(collection, root, cube, cylinder, materials, x=sign * (LOCOMOTIVE_LENGTH / 2 + 0.08), outward_sign=sign, prefix=f"br245_end_{sign}")

    # The multi-engine roof is broad, segmented and visibly unlike an electric locomotive.
    for index, (x, length, height) in enumerate(((-4.3, 2.5, 0.22), (-1.35, 2.3, 0.27), (1.45, 2.3, 0.27), (4.25, 2.25, 0.20))):
        common.add_box(collection, cube, f"br245_roof_module_{index}", (length, 1.92, height), (x, 0, 4.37 + height / 2), materials["mid_grey"], root)
        for rib in range(4):
            common.add_box(collection, cube, f"br245_roof_module_{index}_rib_{rib}", (0.055, 1.80, 0.04), (x - length * 0.32 + rib * length * 0.21, 0, 4.49 + height / 2), materials["steel"], root)
    common.add_box(collection, cube, "br245_exhaust_stack", (0.52, 0.48, 0.25), (0.0, 0, 4.58), materials["anthracite"], root)
    for horn_side in (-1, 1):
        common.add_cylinder(collection, cylinder, f"br245_horn_{horn_side}", 0.08, 0.46, (6.75, horn_side * 0.22, 4.44), materials["steel"], root, rotation=(0, math.pi / 2, 0))

    add_wheelset_bogie(collection, root, cube, cylinder, materials, name="br245_bogie_a", x=-5.45, axle_spacing=2.65, wheel_radius=0.625, sideframe_half_width=1.02)
    add_wheelset_bogie(collection, root, cube, cylinder, materials, name="br245_bogie_b", x=5.45, axle_spacing=2.65, wheel_radius=0.625, sideframe_half_width=1.02)
    attach_metric_contract(collection, root)
    return root


def add_dosto_side_details(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    role: str,
    cab_at_negative: bool,
    mixed_class: bool,
) -> None:
    nose_allowance = 3.35 if cab_at_negative else 0.62
    body_start = -COACH_LENGTH / 2 + nose_allowance
    body_end = COACH_LENGTH / 2 - 0.62
    body_center = (body_start + body_end) / 2
    body_length = body_end - body_start
    door_positions = [-8.15 if cab_at_negative else -10.45, 10.35]
    window_start = -6.65 if cab_at_negative else -8.70
    window_end = 8.45

    for side in (-1, 1):
        y = side * (COACH_WIDTH / 2 + 0.014)
        common.add_box(collection, cube, f"{role}_white_belt_{side}", (body_length, 0.055, 0.22), (body_center, y + side * 0.018, 2.46), materials["light_grey"], root)
        common.add_box(collection, cube, f"{role}_lower_skirt_{side}", (body_length + 0.12, 0.06, 0.46), (body_center, y + side * 0.024, 0.98), materials["mid_grey"], root)

        for door_index, x in enumerate(door_positions):
            common.add_box(collection, cube, f"{role}_door_recess_{side}_{door_index}", (1.54, 0.070, 2.44), (x, y + side * 0.030, 2.05), materials["mid_grey"], root)
            common.add_box(collection, cube, f"{role}_door_{side}_{door_index}", (1.42, 0.072, 2.34), (x, y + side * 0.038, 2.05), materials["light_grey"], root)
            common.add_box(collection, cube, f"{role}_door_centre_seam_{side}_{door_index}", (0.035, 0.086, 2.18), (x, y + side * 0.084, 2.05), materials["mid_grey"], root)
            for leaf in (-1, 1):
                common.add_box(collection, cube, f"{role}_door_glass_seal_{side}_{door_index}_{leaf}", (0.40, 0.086, 0.82), (x + leaf * 0.29, y + side * 0.078, 2.58), materials["anthracite"], root)
                common.add_box(collection, cube, f"{role}_door_glass_{side}_{door_index}_{leaf}", (0.34, 0.082, 0.74), (x + leaf * 0.29, y + side * 0.082, 2.58), materials["glass"], root)
                common.add_box(collection, cube, f"{role}_door_handle_{side}_{door_index}_{leaf}", (0.035, 0.094, 0.28), (x + leaf * 0.12, y + side * 0.090, 2.02), materials["anthracite"], root)
            common.add_box(collection, cube, f"{role}_door_step_{side}_{door_index}", (1.34, 0.20, 0.12), (x, y + side * 0.17, 0.86), materials["steel"], root)

        upper_count = 10 if not cab_at_negative else 8
        lower_count = 8 if mixed_class else 9
        if cab_at_negative:
            lower_count = 6
        upper_spacing = (window_end - window_start) / upper_count
        lower_spacing = (window_end - window_start) / lower_count
        for index in range(upper_count):
            x = window_start + upper_spacing * (index + 0.5)
            width = upper_spacing * 0.70
            common.add_box(collection, cube, f"{role}_upper_window_seal_{side}_{index}", (width + 0.10, 0.078, 0.72), (x, y + side * 0.057, 3.62), materials["anthracite"], root)
            common.add_box(collection, cube, f"{role}_upper_window_{side}_{index}", (width, 0.075, 0.62), (x, y + side * 0.064, 3.62), materials["glass"], root)
            common.add_box(collection, cube, f"{role}_upper_window_warm_{side}_{index}", (width * 0.82, 0.025, 0.44), (x, y - side * 0.01, 3.59), materials["warm_glass"], root)
        for index in range(lower_count):
            x = window_start + lower_spacing * (index + 0.5)
            width = lower_spacing * 0.66
            common.add_box(collection, cube, f"{role}_lower_window_seal_{side}_{index}", (width + 0.10, 0.078, 0.77), (x, y + side * 0.058, 1.72), materials["anthracite"], root)
            common.add_box(collection, cube, f"{role}_lower_window_{side}_{index}", (width, 0.075, 0.67), (x, y + side * 0.065, 1.72), materials["glass"], root)
            common.add_box(collection, cube, f"{role}_lower_window_warm_{side}_{index}", (width * 0.82, 0.025, 0.48), (x, y - side * 0.01, 1.70), materials["warm_glass"], root)

        if mixed_class:
            common.add_box(collection, cube, f"{role}_first_class_marker_{side}", (4.35, 0.065, 0.075), (4.65, y + side * 0.07, 4.05), materials["first_marker"], root)
        common.add_text_label(collection, f"{role}_regio_label_{side}", "REGIO", (0.2, y + side * 0.095, 2.68), materials["light_grey"], root, side=side, size=0.34, scale_x=0.84)
        for door_index, x in enumerate(door_positions):
            common.add_text_label(collection, f"{role}_class_2_{side}_{door_index}", "2", (x + 0.92, y + side * 0.096, 2.64), materials["light_grey"], root, side=side, size=0.28)

    roof_mesh = roof_surface_mesh(f"{role}_roof_mesh", COACH_LENGTH, cab_cut=3.18 if cab_at_negative else 0.34)
    common.link_object(collection, f"{role}_curved_roof", roof_mesh, parent=root, material=materials["roof"])
    common.add_box(collection, cube, f"{role}_underframe_spine", (COACH_LENGTH - 4.2, 1.68, 0.34), (0.25 if cab_at_negative else 0, 0, 0.58), materials["underframe"], root)
    for index, (x, width) in enumerate(((-6.8, 2.9), (-2.4, 2.5), (2.0, 2.1), (6.4, 2.8))):
        if cab_at_negative and x < -5.2:
            continue
        common.add_box(collection, cube, f"{role}_underfloor_box_{index}", (width, 1.40, 0.36), (x, 0, 0.57), materials["underframe"], root)
    for index, x in enumerate((-7.2, 6.9)):
        if cab_at_negative and index == 0:
            continue
        common.add_box(collection, cube, f"{role}_roof_hvac_{index}", (2.8, 1.56, 0.20), (x, 0, 4.69), materials["mid_grey"], root)
        for rib in range(5):
            common.add_box(collection, cube, f"{role}_roof_hvac_{index}_rib_{rib}", (0.055, 1.44, 0.045), (x - 0.90 + rib * 0.45, 0, 4.81), materials["steel"], root)


def build_dosto_coach(
    prototypes: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    role: str,
    mixed_class: bool,
) -> bpy.types.Object:
    collection = common.make_collection(f"Prototype_{role}", prototypes)
    root = common.add_empty(collection, f"db_re_{role}_root")
    root["vehicle_role"] = "double-deck intermediate coach"
    root["variant"] = "mixed first/second" if mixed_class else "second class"
    root["length_m"] = COACH_LENGTH
    sections = [(-13.40, 0.94, 0.98, 0), (-13.02, 1.0, 1.0, 0), (13.02, 1.0, 1.0, 0), (13.40, 0.94, 0.98, 0)]
    shell = common.loft_mesh(f"{role}_double_deck_body_mesh", sections, DOSTO_PROFILE, materials["traffic_red"])
    common.link_object(collection, f"{role}_double_deck_body", shell, parent=root)
    add_dosto_side_details(collection, root, cube, materials, role=role, cab_at_negative=False, mixed_class=mixed_class)
    for end_sign in (-1, 1):
        common.add_box(collection, cube, f"{role}_gangway_{end_sign}", (0.18, 1.20, 2.62), (end_sign * (COACH_LENGTH / 2), 0, 2.28), materials["anthracite"], root)
        add_buffers_and_coupler(collection, root, cube, cylinder, materials, x=end_sign * (COACH_LENGTH / 2 + 0.06), outward_sign=end_sign, prefix=f"{role}_end_{end_sign}")
    add_wheelset_bogie(collection, root, cube, cylinder, materials, name=f"{role}_bogie_a", x=-9.65, axle_spacing=2.50, wheel_radius=0.46, sideframe_half_width=0.98)
    add_wheelset_bogie(collection, root, cube, cylinder, materials, name=f"{role}_bogie_b", x=9.65, axle_spacing=2.50, wheel_radius=0.46, sideframe_half_width=0.98)
    attach_metric_contract(collection, root)
    return root


def build_driving_trailer(
    prototypes: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    collection = common.make_collection("Prototype_driving_trailer", prototypes)
    root = common.add_empty(collection, "db_re_driving_trailer_root")
    root["vehicle_role"] = "double-deck driving trailer"
    root["cab_direction"] = "-X"
    root["length_m"] = COACH_LENGTH
    sections = [
        (-13.40, 0.82, 0.90, -0.025), (-12.92, 0.91, 0.95, -0.01), (-11.80, 0.98, 0.99, 0),
        (-11.15, 1.0, 1.0, 0), (13.02, 1.0, 1.0, 0), (13.40, 0.94, 0.98, 0),
    ]
    shell = common.loft_mesh("driving_trailer_double_deck_body_mesh", sections, DOSTO_PROFILE, materials["traffic_red"])
    common.link_object(collection, "driving_trailer_double_deck_body", shell, parent=root)
    add_dosto_side_details(collection, root, cube, materials, role="driving_trailer", cab_at_negative=True, mixed_class=False)
    add_front_face(collection, root, cube, materials, sign=-1, half_length=COACH_LENGTH / 2, prefix="driving_trailer_front", trailer=True)
    for side in (-1, 1):
        y = side * (COACH_WIDTH / 2 + 0.028)
        common.add_box(collection, cube, f"driving_trailer_side_cab_window_{side}", (1.35, 0.072, 0.74), (-11.25, y, 3.25), materials["glass"], root, rotation=(0, -0.18, 0))
        common.add_box(collection, cube, f"driving_trailer_side_red_cheek_{side}", (2.6, 0.06, 0.30), (-11.95, y + side * 0.015, 4.05), materials["traffic_red"], root, rotation=(0, -0.16, 0))
    common.add_box(collection, cube, "driving_trailer_front_apron", (0.48, 2.12, 0.48), (-13.24, 0, 0.64), materials["underframe"], root, rotation=(0, 0.10, 0))
    add_buffers_and_coupler(collection, root, cube, cylinder, materials, x=-13.48, outward_sign=-1, prefix="driving_trailer_cab_end")
    common.add_box(collection, cube, "driving_trailer_gangway", (0.18, 1.20, 2.62), (13.40, 0, 2.28), materials["anthracite"], root)
    add_buffers_and_coupler(collection, root, cube, cylinder, materials, x=13.46, outward_sign=1, prefix="driving_trailer_coach_end")
    add_wheelset_bogie(collection, root, cube, cylinder, materials, name="driving_trailer_bogie_a", x=-9.55, axle_spacing=2.50, wheel_radius=0.46, sideframe_half_width=0.98)
    add_wheelset_bogie(collection, root, cube, cylinder, materials, name="driving_trailer_bogie_b", x=9.65, axle_spacing=2.50, wheel_radius=0.46, sideframe_half_width=0.98)
    attach_metric_contract(collection, root)
    return root


def build_formation(
    prototypes: dict[str, bpy.types.Object],
    assets: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    collection = common.make_collection("DB_Regional_Express_Formation", assets)
    root = common.add_empty(collection, "db_regional_express_blender_root")
    root["formation"] = "DB Regional-Express BR 245 double-deck push-pull review candidate"
    root["vehicle_count"] = 4
    root["length_m"] = round(FORMATION_LENGTH, 3)
    root["approval_status"] = "private review only"
    for index, source in enumerate(OFFICIAL_SOURCES, start=1):
        root[f"source_{index}"] = source
    attach_metric_contract(collection, root, anchor=True)

    consist = [
        ("br245", LOCOMOTIVE_LENGTH),
        ("mixed_class", COACH_LENGTH),
        ("second_class", COACH_LENGTH),
        ("driving_trailer", COACH_LENGTH),
    ]
    cursor = FORMATION_LENGTH / 2
    for index, (role, length) in enumerate(consist):
        center = cursor - length / 2
        instance = common.duplicate_hierarchy(prototypes[role], collection, root, f"vehicle_{index:02d}_{role}")
        instance.location.x = center
        instance["formation_index"] = index
        instance["role"] = role
        instance["length_m"] = length
        cursor -= length
        if index < len(consist) - 1:
            gap_center = cursor - FORMATION_GAP / 2
            common.add_box(collection, cube, f"intervehicle_coupler_{index:02d}", (0.60, 0.22, 0.18), (gap_center, 0, 0.72), materials["underframe"], root)
            cursor -= FORMATION_GAP
    return root


def add_review_environment(
    assets: bpy.types.Collection,
    formation_root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    review = common.make_collection("Review_Environment", assets)
    root = common.add_empty(review, "review_environment_root")
    common.add_box(review, cube, "review_ground", (150, 56, 0.26), (0, 0, -0.64), materials["ground"], root)
    common.add_box(review, cube, "review_ballast", (132, 3.8, 0.30), (0, 0, -0.38), materials["ballast"], root)
    for y in (-WHEEL_TREAD_CENTER_METERS, WHEEL_TREAD_CENTER_METERS):
        common.add_box(review, cube, f"review_rail_{y}", (132, 0.075, 0.12), (0, y, -0.06), materials["steel"], root)
    for index in range(133):
        common.add_box(review, cube, f"review_sleeper_{index:03d}", (0.16, 2.58, 0.095), (-66 + index, 0, -0.168), materials["sleeper"], root)

    target = common.add_empty(review, "review_camera_target")
    target.location = (0, 0, 2.05)
    pivot = common.add_empty(review, "review_camera_orbit")
    camera_data = bpy.data.cameras.new("DB_RE_Review_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 69
    camera = common.link_object(review, "DB_RE_Review_Camera", camera_data, location=(57, -64, 36), parent=pivot)
    constraint = camera.constraints.new(type="TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    bpy.context.scene.camera = camera
    pivot.rotation_euler.z = math.radians(-8)
    pivot.keyframe_insert(data_path="rotation_euler", index=2, frame=1)
    pivot.rotation_euler.z = math.radians(352)
    pivot.keyframe_insert(data_path="rotation_euler", index=2, frame=481)

    sun_data = bpy.data.lights.new("DB_RE_Review_Sun", type="SUN")
    sun_data.energy = 2.4
    sun_data.angle = math.radians(18)
    common.link_object(review, "DB_RE_Review_Sun", sun_data, rotation=(math.radians(38), 0, math.radians(-35)))
    area_data = bpy.data.lights.new("DB_RE_Review_Fill", type="AREA")
    area_data.energy = 2300
    area_data.shape = "RECTANGLE"
    area_data.size = 40
    common.link_object(review, "DB_RE_Review_Fill", area_data, location=(4, -18, 29))
    formation_root["review_tip"] = "Press Spacebar to orbit the prepared camera. Review-only track is not exported."


def main() -> None:
    ensure_directories()
    reset_scene()
    materials = make_materials()
    cube = common.unit_cube_mesh()
    cylinder = common.unit_cylinder_mesh(16)
    assets = common.make_collection("DB_Regional_Express_Blender_Assets")
    prototypes_collection = common.make_collection("DB_Regional_Express_Prototypes", assets)

    prototypes = {
        "br245": build_br245(prototypes_collection, cube, cylinder, materials),
        "mixed_class": build_dosto_coach(prototypes_collection, cube, cylinder, materials, role="mixed_class", mixed_class=True),
        "second_class": build_dosto_coach(prototypes_collection, cube, cylinder, materials, role="second_class", mixed_class=False),
        "driving_trailer": build_driving_trailer(prototypes_collection, cube, cylinder, materials),
    }

    module_paths: dict[str, str] = {}
    for role, root in prototypes.items():
        path = OUTPUT_DIR / f"db-regional-express-{role.replace('_', '-')}.glb"
        common.export_glb(root, path)
        module_paths[role] = str(path.relative_to(PROJECT_ROOT))

    formation_root = build_formation(prototypes, assets, cube, materials)
    formation_path = OUTPUT_DIR / "db-regional-express-blender.glb"
    common.export_glb(formation_root, formation_path)
    add_review_environment(assets, formation_root, cube, materials)
    prototypes_collection.hide_viewport = True
    prototypes_collection.hide_render = True
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER_PATH), compress=True)

    manifest = {
        "schemaVersion": 2,
        "generator": "Blender 5.2 LTS Python API",
        "candidateId": "db-regional-express-dosto-br245",
        "approvalStatus": "private-review",
        "formation": "DB Regional-Express BR 245 double-deck push-pull",
        "lengthMeters": round(FORMATION_LENGTH, 3),
        "vehicleCount": 4,
        "consist": ["br245", "mixed-class", "second-class", "driving-trailer"],
        "vehicleDimensionsMeters": {
            "br245": {"length": LOCOMOTIVE_LENGTH, "width": LOCOMOTIVE_WIDTH, "height": LOCOMOTIVE_HEIGHT},
            "doubleDeckCoach": {"length": COACH_LENGTH, "width": COACH_WIDTH, "height": COACH_HEIGHT},
        },
        "masterBlend": str(MASTER_PATH.relative_to(PROJECT_ROOT)),
        "formationGlb": str(formation_path.relative_to(PROJECT_ROOT)),
        "moduleGlbs": module_paths,
        "assetContract": {
            "units": "meters",
            "forwardAxis": "+X",
            "lateralAxis": "+Y",
            "upAxis": "+Z",
            "standardGaugeMeters": STANDARD_GAUGE_METERS,
            "railContactPlaneZ": RAIL_CONTACT_PLANE_Z,
            "railContactAnchor": "rail_contact_origin",
            "wheelTreadCentersMeters": [-WHEEL_TREAD_CENTER_METERS, WHEEL_TREAD_CENTER_METERS],
            "traction": "diesel",
            "pantographContactHeightMeters": None,
            "calibrationTrackExported": False,
        },
        "userReferenceFilenames": list(USER_REFERENCE_FILENAMES),
        "referencePolicy": "Research only. Local images are not copied, embedded, textured, or shipped.",
        "sources": list(OFFICIAL_SOURCES),
        "assetRevision": "reference-detail-r2",
        "revisionNotes": {
            "br245Cab": "surface-fitted dark visor, split windscreens, destination display, fascia lamp stacks, wipers and swept side glazing",
            "br245Body": "asymmetric diesel intake grilles, access panels, cab steps and segmented multi-engine roof equipment",
            "doubleDeckCars": "inset window seals, detailed twin-leaf doors, handles, class markers, REGIO lettering and ribbed HVAC housings",
        },
        "productionRegistryModified": False,
    }
    (SOURCE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("CORNER_RAILS_DB_REGIONAL_EXPRESS_GENERATED")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
