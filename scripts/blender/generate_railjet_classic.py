"""Generate the Blender-authored classic ÖBB Railjet laboratory candidate.

This script is intentionally deterministic and uses only Blender's bundled
Python API. It creates an editable review .blend, modular vehicle GLBs, and a
complete eight-vehicle Railjet formation without downloading third-party
models, textures, logos, or typefaces.

Coordinate contract before export:
  * metres
  * X = train forward/length
  * Y = vehicle width
  * Z = height above top of rail

The glTF exporter converts Blender Z-up to glTF Y-up for React Three Fiber.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable, Sequence

import bpy
from mathutils import Matrix, Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = PROJECT_ROOT / "assets" / "blender" / "railjet-classic"
OUTPUT_DIR = PROJECT_ROOT / "public" / "models" / "railjet-lab" / "blender"
MASTER_PATH = SOURCE_DIR / "railjet-classic-master.blend"

TAURUS_LENGTH = 19.28
COACH_LENGTH = 26.50
COACH_WIDTH = 2.825
COACH_HEIGHT = 4.05
FORMATION_GAP = 0.085
FORMATION_LENGTH = TAURUS_LENGTH + 7 * COACH_LENGTH + 7 * FORMATION_GAP
STANDARD_GAUGE_METERS = 1.435
WHEEL_TREAD_CENTER_METERS = STANDARD_GAUGE_METERS / 2
RAIL_CONTACT_PLANE_Z = 0.0
PANTOGRAPH_CONTACT_HEIGHT_METERS = 5.5

OFFICIAL_SOURCES = (
    "https://static.web.oebb.at/konzern/oebb-flotte-2025/4/",
    "https://data.oebb.at/dam/jcr%3A1e0c5a41-5293-439a-bed9-4f160d8aa1da/tfz1116.pdf",
    "https://static.dc.siemens.com/mobility/webfeature/green-mobility/files/brochure/viaggio-comfort-en.pdf",
)


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
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Railjet_Review_World")
    scene.world.color = (0.055, 0.075, 0.085)
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.12, 0.17, 0.19, 1.0)
        background.inputs["Strength"].default_value = 0.55


def ensure_directories() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def make_collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    (parent.children if parent else bpy.context.scene.collection.children).link(collection)
    return collection


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.58,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    material.use_backface_culling = False
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
    return material


def build_materials() -> dict[str, bpy.types.Material]:
    return {
        "railjet_red": make_material("RJ_Red", (0.46, 0.018, 0.038, 1.0), metallic=0.04, roughness=0.43),
        "signal_red": make_material("RJ_Door_Red", (0.72, 0.025, 0.042, 1.0), metallic=0.02, roughness=0.4),
        "deep_red": make_material("RJ_Deep_Red", (0.25, 0.012, 0.024, 1.0), metallic=0.08, roughness=0.38),
        "light_body": make_material("RJ_Pearl_Light", (0.74, 0.75, 0.72, 1.0), metallic=0.12, roughness=0.36),
        "anthracite": make_material("RJ_Anthracite", (0.055, 0.062, 0.064, 1.0), metallic=0.14, roughness=0.32),
        "glass": make_material("RJ_Smoked_Glass", (0.018, 0.055, 0.068, 1.0), metallic=0.22, roughness=0.16),
        "roof": make_material("RJ_Roof", (0.12, 0.125, 0.12, 1.0), metallic=0.42, roughness=0.42),
        "underframe": make_material("RJ_Underframe", (0.035, 0.04, 0.042, 1.0), metallic=0.55, roughness=0.48),
        "wheel": make_material("RJ_Wheel", (0.055, 0.06, 0.062, 1.0), metallic=0.82, roughness=0.27),
        "steel": make_material("RJ_Steel", (0.36, 0.39, 0.39, 1.0), metallic=0.86, roughness=0.24),
        "lamp": make_material("RJ_Lamp", (1.0, 0.78, 0.33, 1.0), metallic=0.03, roughness=0.18),
        "warm_glass": make_material("RJ_Warm_Cabin", (0.38, 0.22, 0.08, 1.0), metallic=0.05, roughness=0.24),
        "ballast": make_material("Review_Ballast", (0.19, 0.22, 0.21, 1.0), roughness=0.95),
        "sleeper": make_material("Review_Sleeper", (0.20, 0.12, 0.075, 1.0), roughness=0.9),
        "ground": make_material("Review_Ground", (0.23, 0.35, 0.25, 1.0), roughness=0.97),
    }


def unit_cube_mesh() -> bpy.types.Mesh:
    vertices = [
        (-0.5, -0.5, -0.5), (0.5, -0.5, -0.5), (0.5, 0.5, -0.5), (-0.5, 0.5, -0.5),
        (-0.5, -0.5, 0.5), (0.5, -0.5, 0.5), (0.5, 0.5, 0.5), (-0.5, 0.5, 0.5),
    ]
    faces = [
        (0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
        (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7),
    ]
    mesh = bpy.data.meshes.new("RJ_UnitCube")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def unit_cylinder_mesh(segments: int = 16) -> bpy.types.Mesh:
    vertices: list[tuple[float, float, float]] = []
    for z in (-0.5, 0.5):
        for index in range(segments):
            angle = math.tau * index / segments
            vertices.append((0.5 * math.cos(angle), 0.5 * math.sin(angle), z))
    faces: list[tuple[int, ...]] = []
    for index in range(segments):
        nxt = (index + 1) % segments
        faces.append((index, nxt, segments + nxt, segments + index))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple(range(segments, segments * 2)))
    mesh = bpy.data.meshes.new(f"RJ_UnitCylinder_{segments}")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return mesh


def link_object(
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
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.location = location
    obj.scale = scale
    obj.rotation_euler = rotation
    obj.parent = parent
    if material is not None and hasattr(data, "materials"):
        data.materials.append(material)
    return obj


def add_empty(collection: bpy.types.Collection, name: str, parent: bpy.types.Object | None = None) -> bpy.types.Object:
    obj = link_object(collection, name, None, parent=parent)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.55
    return obj


def add_metric_contract(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    *,
    add_anchor: bool = False,
) -> bpy.types.Object | None:
    """Attach the shared rail-contact contract to a shipping root."""
    anchor = None
    if add_anchor:
        anchor = add_empty(collection, "rail_contact_origin", root)
        anchor.location = (0.0, 0.0, RAIL_CONTACT_PLANE_Z)
        anchor.empty_display_size = 0.28
    root["units"] = "meters"
    root["forward_axis"] = "+X"
    root["lateral_axis"] = "+Y"
    root["up_axis"] = "+Z"
    root["standard_gauge_m"] = STANDARD_GAUGE_METERS
    root["wheel_tread_center_m"] = WHEEL_TREAD_CENTER_METERS
    root["rail_contact_plane_z"] = RAIL_CONTACT_PLANE_Z
    root["pantograph_contact_height_m"] = PANTOGRAPH_CONTACT_HEIGHT_METERS
    return anchor


def add_box(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    name: str,
    dimensions: Sequence[float],
    location: Sequence[float],
    material: bpy.types.Material,
    parent: bpy.types.Object,
    *,
    rotation: Sequence[float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    return link_object(
        collection,
        name,
        cube,
        location=location,
        scale=dimensions,
        rotation=rotation,
        parent=parent,
        material=material,
    )


def add_cylinder(
    collection: bpy.types.Collection,
    cylinder: bpy.types.Mesh,
    name: str,
    radius: float,
    depth: float,
    location: Sequence[float],
    material: bpy.types.Material,
    parent: bpy.types.Object,
    *,
    rotation: Sequence[float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    return link_object(
        collection,
        name,
        cylinder,
        location=location,
        scale=(radius * 2.0, radius * 2.0, depth),
        rotation=rotation,
        parent=parent,
        material=material,
    )


COACH_PROFILE = (
    (-1.15, 0.96), (-1.36, 1.12), (-1.4125, 1.42), (-1.4125, 3.34),
    (-1.32, 3.62), (-1.04, 3.86), (-0.58, 4.01), (0.0, 4.06),
    (0.58, 4.01), (1.04, 3.86), (1.32, 3.62), (1.4125, 3.34),
    (1.4125, 1.42), (1.36, 1.12), (1.15, 0.96),
)

TAURUS_PROFILE = (
    (-1.20, 0.92), (-1.48, 1.14), (-1.50, 3.34), (-1.36, 3.72),
    (-0.94, 4.12), (-0.42, 4.28), (0.0, 4.31), (0.42, 4.28),
    (0.94, 4.12), (1.36, 3.72), (1.50, 3.34), (1.50, 1.14),
)


def loft_mesh(
    name: str,
    sections: Sequence[tuple[float, float, float, float]],
    profile: Sequence[tuple[float, float]],
    material: bpy.types.Material,
) -> bpy.types.Mesh:
    """Create a closed body from (x, width_scale, height_scale, z_shift)."""
    bottom = min(z for _, z in profile)
    vertices: list[tuple[float, float, float]] = []
    for x, width_scale, height_scale, z_shift in sections:
        for y, z in profile:
            vertices.append((x, y * width_scale, bottom + (z - bottom) * height_scale + z_shift))
    ring = len(profile)
    faces: list[tuple[int, ...]] = []
    for section_index in range(len(sections) - 1):
        start = section_index * ring
        nxt = (section_index + 1) * ring
        for profile_index in range(ring):
            following = (profile_index + 1) % ring
            faces.append((start + profile_index, start + following, nxt + following, nxt + profile_index))
    faces.append(tuple(reversed(range(ring))))
    last = (len(sections) - 1) * ring
    faces.append(tuple(last + index for index in range(ring)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return mesh


def roof_strip_mesh(name: str, length: float, nose_negative: bool = False) -> bpy.types.Mesh:
    x0 = -length / 2 + (1.6 if nose_negative else 0.28)
    x1 = length / 2 - 0.28
    arc = [(-1.29, 3.64), (-0.96, 3.90), (-0.50, 4.04), (0.0, 4.09), (0.50, 4.04), (0.96, 3.90), (1.29, 3.64)]
    vertices = [(x, y, z) for x in (x0, x1) for y, z in arc]
    ring = len(arc)
    faces = [(index, index + 1, ring + index + 1, ring + index) for index in range(ring - 1)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return mesh


def polygon_mesh(name: str, vertices: Sequence[Sequence[float]], material: bpy.types.Material) -> bpy.types.Mesh:
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [tuple(range(len(vertices)))])
    mesh.materials.append(material)
    mesh.update()
    return mesh


def add_beam_between(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    name: str,
    start: Sequence[float],
    end: Sequence[float],
    thickness: float,
    material: bpy.types.Material,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    direction = end_v - start_v
    obj = add_box(collection, cube, name, (direction.length, thickness, thickness), (start_v + end_v) / 2, material, parent)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("X", "Z")
    return obj


def add_bogie(
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
    bogie_width: float,
) -> None:
    bogie = add_empty(collection, name, root)
    bogie.location.x = x
    add_box(collection, cube, f"{name}_bolster", (axle_spacing + 1.15, 1.84, 0.26), (0, 0, 0.72), materials["underframe"], bogie)
    for side in (-1, 1):
        add_box(collection, cube, f"{name}_sideframe_{side}", (axle_spacing + 0.86, 0.18, 0.42), (0, side * bogie_width / 2, 0.63), materials["underframe"], bogie)
        for axle_index, axle_x in enumerate((-axle_spacing / 2, axle_spacing / 2)):
            add_cylinder(
                collection,
                cylinder,
                f"{name}_wheel_{side}_{axle_index}",
                wheel_radius,
                0.22,
                (axle_x, side * WHEEL_TREAD_CENTER_METERS, wheel_radius),
                materials["wheel"],
                bogie,
                rotation=(math.pi / 2, 0, 0),
            )
            add_cylinder(
                collection,
                cylinder,
                f"{name}_flange_{side}_{axle_index}",
                wheel_radius * 1.07,
                0.035,
                (axle_x, side * (WHEEL_TREAD_CENTER_METERS - 0.105), wheel_radius),
                materials["wheel"],
                bogie,
                rotation=(math.pi / 2, 0, 0),
            )
            add_cylinder(
                collection,
                cylinder,
                f"{name}_brake_disc_{side}_{axle_index}",
                wheel_radius * 0.55,
                0.035,
                (axle_x, side * (WHEEL_TREAD_CENTER_METERS + 0.145), wheel_radius),
                materials["steel"],
                bogie,
                rotation=(math.pi / 2, 0, 0),
            )
            add_box(collection, cube, f"{name}_spring_{side}_{axle_index}", (0.35, 0.16, 0.28), (axle_x, side * (bogie_width / 2 - 0.02), 0.92), materials["steel"], bogie)


def add_coach_livery(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    role: str,
    length: float,
    window_count: int,
    nose_negative: bool = False,
) -> None:
    body_start = -length / 2 + (2.25 if nose_negative else 0.58)
    body_end = length / 2 - 0.58
    band_center = (body_start + body_end) / 2
    band_length = body_end - body_start
    for side in (-1, 1):
        y = side * (COACH_WIDTH / 2 + 0.012)
        add_box(collection, cube, f"{role}_window_band_{side}", (band_length, 0.036, 1.15), (band_center, y, 2.83), materials["anthracite"], root)
        add_box(collection, cube, f"{role}_lower_skirt_{side}", (band_length + 0.22, 0.04, 0.48), (band_center, y + side * 0.004, 1.21), materials["anthracite"], root)
        add_box(collection, cube, f"{role}_red_belt_{side}", (band_length + 0.08, 0.047, 0.20), (band_center, y + side * 0.01, 2.06), materials["railjet_red"], root)

        door_positions = [-10.7, 10.7]
        if nose_negative:
            door_positions = [-8.8, 10.7]
        for door_index, x in enumerate(door_positions):
            add_box(collection, cube, f"{role}_door_{side}_{door_index}", (1.12, 0.06, 2.15), (x, y + side * 0.018, 2.08), materials["signal_red"], root)
            add_box(collection, cube, f"{role}_door_window_{side}_{door_index}", (0.72, 0.07, 0.72), (x, y + side * 0.055, 2.73), materials["glass"], root)
            add_box(collection, cube, f"{role}_door_step_{side}_{door_index}", (1.05, 0.18, 0.11), (x, y + side * 0.16, 1.03), materials["steel"], root)

        usable_start = -8.85 if not nose_negative else -6.95
        usable_end = 8.85
        spacing = (usable_end - usable_start) / window_count
        window_width = min(1.48 if role == "economy" else 1.72, spacing * 0.74)
        for window_index in range(window_count):
            x = usable_start + spacing * (window_index + 0.5)
            add_box(collection, cube, f"{role}_window_{side}_{window_index}", (window_width, 0.062, 0.82), (x, y + side * 0.05, 2.87), materials["glass"], root)
            add_box(collection, cube, f"{role}_window_warm_{side}_{window_index}", (window_width * 0.86, 0.025, 0.60), (x, y - side * 0.01, 2.84), materials["warm_glass"], root)
        for divider_index in range(1, window_count):
            x = usable_start + spacing * divider_index
            add_box(collection, cube, f"{role}_window_divider_{side}_{divider_index}", (0.085, 0.075, 0.94), (x, y + side * 0.064, 2.87), materials["light_body"], root)

    roof_mesh = roof_strip_mesh(f"{role}_roof_strip_mesh", length, nose_negative)
    link_object(collection, f"{role}_red_roof", roof_mesh, parent=root, material=materials["railjet_red"])
    add_box(collection, cube, f"{role}_underframe_spine", (length - 5.0, 1.72, 0.38), (0.35 if nose_negative else 0, 0, 0.68), materials["underframe"], root)
    for equipment_index, (x, width) in enumerate(((-5.2, 3.0), (-1.0, 2.0), (3.4, 2.8), (7.0, 1.65))):
        if nose_negative and x < -5.8:
            continue
        add_box(collection, cube, f"{role}_underfloor_box_{equipment_index}", (width, 1.48, 0.42), (x, 0, 0.70), materials["roof"], root)


def add_coach_roof_equipment(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    role: str,
) -> None:
    for index, x in enumerate((-8.2, 7.9)):
        add_box(collection, cube, f"{role}_hvac_{index}", (2.75, 1.58, 0.22), (x, 0, 4.13), materials["roof"], root)
        for rib in range(4):
            add_box(collection, cube, f"{role}_hvac_{index}_rib_{rib}", (0.08, 1.44, 0.05), (x - 0.72 + rib * 0.48, 0, 4.26), materials["steel"], root)


def add_gangways(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    length: float,
    *,
    nose_negative: bool = False,
) -> None:
    ends = [length / 2]
    if not nose_negative:
        ends.append(-length / 2)
    for end_index, x in enumerate(ends):
        add_box(collection, cube, f"gangway_{end_index}", (0.16, 1.18, 2.38), (x, 0, 2.13), materials["anthracite"], root)
        add_box(collection, cube, f"gangway_door_{end_index}", (0.18, 0.72, 1.84), (x + (-0.03 if x > 0 else 0.03), 0, 2.15), materials["deep_red"], root)


def build_coach(
    prototypes: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    role: str,
    window_count: int,
) -> bpy.types.Object:
    collection = make_collection(f"Prototype_{role}", prototypes)
    root = add_empty(collection, f"railjet_classic_{role}_root")
    root["vehicle_role"] = role
    root["length_m"] = COACH_LENGTH
    sections = [(-13.25, 0.94, 0.98, 0), (-12.90, 1.0, 1.0, 0), (12.90, 1.0, 1.0, 0), (13.25, 0.94, 0.98, 0)]
    shell = loft_mesh(f"railjet_{role}_body_mesh", sections, COACH_PROFILE, materials["light_body"])
    link_object(collection, f"railjet_{role}_lofted_body", shell, parent=root)
    add_coach_livery(collection, root, cube, materials, role=role, length=COACH_LENGTH, window_count=window_count)
    add_coach_roof_equipment(collection, root, cube, materials, role)
    add_gangways(collection, root, cube, materials, COACH_LENGTH)
    add_bogie(collection, root, cube, cylinder, materials, name=f"{role}_bogie_a", x=-9.5, axle_spacing=2.5, wheel_radius=0.46, bogie_width=1.92)
    add_bogie(collection, root, cube, cylinder, materials, name=f"{role}_bogie_b", x=9.5, axle_spacing=2.5, wheel_radius=0.46, bogie_width=1.92)
    if role == "restaurant":
        for side in (-1, 1):
            add_box(collection, cube, f"restaurant_service_panel_{side}", (3.2, 0.07, 0.58), (-1.0, side * 1.47, 2.76), materials["deep_red"], root)
    if role == "first":
        for side in (-1, 1):
            add_box(collection, cube, f"first_class_marker_{side}", (4.8, 0.055, 0.06), (2.4, side * 1.48, 3.48), materials["lamp"], root)
    add_metric_contract(collection, root)
    return root


def add_cab_glazing(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
    *,
    front_sign: int,
    half_length: float,
    prefix: str,
    wide: bool,
) -> None:
    sign = float(front_sign)
    # Follow the sloped cab surface: the lower edge sits near the nose tip and
    # the upper edge steps back toward the full-width body. This avoids both an
    # occluded windshield and the visibly floating flat card failure mode.
    face_x = sign * (half_length - 0.08)
    top_x = sign * (half_length - (0.48 if wide else 0.64))
    panel_face_x = face_x + sign * 0.04
    panel_top_x = top_x + sign * 0.04
    mask_vertices = [
        (panel_face_x, -0.70, 2.43), (panel_face_x, 0.70, 2.43),
        (panel_top_x, 0.94, 3.52), (panel_top_x, -0.94, 3.52),
    ]
    mask = polygon_mesh(f"{prefix}_windshield_mask_mesh", mask_vertices, materials["anthracite"])
    link_object(collection, f"{prefix}_windshield_mask", mask, parent=root)
    for side in (-1, 1):
        y0 = 0.10 * side
        y1 = 1.00 * side
        if side < 0:
            y0, y1 = y1, y0
        glass_vertices = [
            (panel_face_x + sign * 0.012, y0 * 0.68, 2.57),
            (panel_face_x + sign * 0.012, y1 * 0.68, 2.58),
            (panel_top_x + sign * 0.012, y1 * 0.90, 3.41),
            (panel_top_x + sign * 0.012, y0 * 0.88, 3.42),
        ]
        glass = polygon_mesh(f"{prefix}_windshield_{side}_mesh", glass_vertices, materials["glass"])
        link_object(collection, f"{prefix}_windshield_{side}", glass, parent=root)


def add_headlights(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    front_sign: int,
    half_length: float,
    prefix: str,
) -> None:
    x = front_sign * (half_length + 0.03)
    for side in (-1, 1):
        add_box(collection, cube, f"{prefix}_headlight_{side}", (0.09, 0.34, 0.22), (x, side * 0.70, 1.52), materials["lamp"], root)
        add_box(collection, cube, f"{prefix}_marker_{side}", (0.075, 0.16, 0.13), (x - front_sign * 0.13, side * 0.91, 2.15), materials["light_body"], root)


def add_pantograph(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    x: float,
    raised: bool,
    prefix: str,
) -> None:
    add_box(collection, cube, f"{prefix}_base", (2.35, 1.22, 0.16), (x, 0, 4.44), materials["roof"], root)
    for side in (-1, 1):
        add_cylinder(collection, cylinder, f"{prefix}_insulator_{side}", 0.10, 0.34, (x - 0.55, side * 0.38, 4.67), materials["deep_red"], root)
    if raised:
        points = [
            ((x - 0.88, -0.42, 4.75), (x + 0.22, 0.0, 5.18)),
            ((x + 0.88, 0.42, 4.75), (x - 0.22, 0.0, 5.18)),
            ((x + 0.22, 0.0, 5.18), (x - 0.70, -0.12, 5.46)),
            ((x - 0.22, 0.0, 5.18), (x + 0.70, 0.12, 5.46)),
        ]
        for index, (start, end) in enumerate(points):
            add_beam_between(collection, cube, f"{prefix}_arm_{index}", start, end, 0.075, materials["steel"], root)
        add_box(collection, cube, f"{prefix}_collector", (2.45, 0.12, 0.08), (x, 0, PANTOGRAPH_CONTACT_HEIGHT_METERS - 0.04), materials["anthracite"], root)
    else:
        add_beam_between(collection, cube, f"{prefix}_folded_arm_a", (x - 0.9, -0.35, 4.72), (x + 0.75, 0.28, 4.88), 0.07, materials["steel"], root)
        add_beam_between(collection, cube, f"{prefix}_folded_arm_b", (x + 0.9, 0.35, 4.72), (x - 0.75, -0.28, 4.88), 0.07, materials["steel"], root)


def build_taurus(
    prototypes: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    collection = make_collection("Prototype_taurus", prototypes)
    root = add_empty(collection, "railjet_classic_taurus_root")
    root["vehicle_role"] = "locomotive"
    root["class"] = "ÖBB Class 1116 Taurus"
    root["length_m"] = TAURUS_LENGTH
    sections = [
        (-9.64, 0.47, 0.62, -0.08), (-9.18, 0.72, 0.80, -0.02), (-8.20, 0.98, 0.97, 0),
        (-7.15, 1.0, 1.0, 0), (7.15, 1.0, 1.0, 0), (8.20, 0.98, 0.97, 0),
        (9.18, 0.72, 0.80, -0.02), (9.64, 0.47, 0.62, -0.08),
    ]
    shell = loft_mesh("taurus_lofted_body_mesh", sections, TAURUS_PROFILE, materials["railjet_red"])
    link_object(collection, "taurus_lofted_body", shell, parent=root)
    add_box(collection, cube, "taurus_underframe", (13.6, 2.18, 0.45), (0, 0, 0.79), materials["underframe"], root)
    add_box(collection, cube, "taurus_roof_spine", (10.8, 2.22, 0.20), (0, 0, 4.34), materials["roof"], root)

    for side in (-1, 1):
        y = side * 1.515
        add_box(collection, cube, f"taurus_side_dark_band_{side}", (13.25, 0.05, 1.12), (0, y, 2.82), materials["anthracite"], root)
        add_box(collection, cube, f"taurus_side_lower_panel_{side}", (14.8, 0.055, 0.55), (0, y + side * 0.01, 1.25), materials["deep_red"], root)
        for cab_sign in (-1, 1):
            add_box(collection, cube, f"taurus_side_window_{side}_{cab_sign}", (1.35, 0.064, 0.82), (cab_sign * 7.25, y + side * 0.035, 3.08), materials["glass"], root)
            add_box(collection, cube, f"taurus_cab_door_{side}_{cab_sign}", (0.78, 0.06, 1.95), (cab_sign * 6.20, y + side * 0.02, 2.12), materials["railjet_red"], root)
            add_box(collection, cube, f"taurus_cab_door_window_{side}_{cab_sign}", (0.55, 0.068, 0.62), (cab_sign * 6.20, y + side * 0.055, 2.75), materials["glass"], root)
        for vent_index in range(6):
            x = -3.6 + vent_index * 1.42
            add_box(collection, cube, f"taurus_vent_{side}_{vent_index}", (0.92, 0.065, 0.67), (x, y + side * 0.04, 2.76), materials["roof"], root)
        sweep_vertices = [
            (-7.0, y + side * 0.07, 1.55),
            (7.1, y + side * 0.07, 1.20),
            (7.1, y + side * 0.07, 1.48),
            (-7.0, y + side * 0.07, 1.92),
        ]
        sweep = polygon_mesh(f"taurus_sweep_{side}_mesh", sweep_vertices, materials["light_body"])
        link_object(collection, f"taurus_light_sweep_{side}", sweep, parent=root)

    for front_sign in (-1, 1):
        prefix = f"taurus_cab_{front_sign}"
        add_cab_glazing(collection, root, materials, front_sign=front_sign, half_length=TAURUS_LENGTH / 2, prefix=prefix, wide=True)
        add_headlights(collection, root, cube, materials, front_sign=front_sign, half_length=TAURUS_LENGTH / 2, prefix=prefix)
        add_box(collection, cube, f"{prefix}_plough", (0.42, 2.0, 0.34), (front_sign * 9.42, 0, 0.54), materials["anthracite"], root, rotation=(0, front_sign * -0.10, 0))

    add_bogie(collection, root, cube, cylinder, materials, name="taurus_bogie_a", x=-4.95, axle_spacing=3.0, wheel_radius=0.575, bogie_width=2.04)
    add_bogie(collection, root, cube, cylinder, materials, name="taurus_bogie_b", x=4.95, axle_spacing=3.0, wheel_radius=0.575, bogie_width=2.04)
    add_pantograph(collection, root, cube, cylinder, materials, x=-2.25, raised=True, prefix="taurus_panto_raised")
    add_pantograph(collection, root, cube, cylinder, materials, x=2.55, raised=False, prefix="taurus_panto_folded")
    for index, x in enumerate((-5.0, 0.0, 5.0)):
        add_box(collection, cube, f"taurus_roof_cabinet_{index}", (2.15, 1.42, 0.30), (x, 0, 4.52), materials["steel"], root)
    add_beam_between(collection, cube, "taurus_roof_bus", (-5.6, 0.0, 4.82), (5.7, 0.0, 4.82), 0.055, materials["steel"], root)
    add_metric_contract(collection, root)
    return root


def build_driving_trailer(
    prototypes: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    role = "driving_trailer"
    collection = make_collection("Prototype_driving_trailer", prototypes)
    root = add_empty(collection, "railjet_classic_driving_trailer_root")
    root["vehicle_role"] = role
    root["length_m"] = COACH_LENGTH
    sections = [
        (-13.25, 0.42, 0.64, -0.05), (-12.72, 0.67, 0.82, -0.02), (-11.70, 0.95, 0.97, 0),
        (-10.65, 1.0, 1.0, 0), (12.90, 1.0, 1.0, 0), (13.25, 0.94, 0.98, 0),
    ]
    shell = loft_mesh("driving_trailer_lofted_body_mesh", sections, COACH_PROFILE, materials["light_body"])
    link_object(collection, "driving_trailer_lofted_body", shell, parent=root)
    add_coach_livery(collection, root, cube, materials, role=role, length=COACH_LENGTH, window_count=8, nose_negative=True)
    add_coach_roof_equipment(collection, root, cube, materials, role)
    add_gangways(collection, root, cube, materials, COACH_LENGTH, nose_negative=True)
    add_bogie(collection, root, cube, cylinder, materials, name="driving_trailer_bogie_a", x=-9.25, axle_spacing=2.5, wheel_radius=0.46, bogie_width=1.92)
    add_bogie(collection, root, cube, cylinder, materials, name="driving_trailer_bogie_b", x=9.5, axle_spacing=2.5, wheel_radius=0.46, bogie_width=1.92)
    add_cab_glazing(collection, root, materials, front_sign=-1, half_length=COACH_LENGTH / 2, prefix="driving_trailer_cab", wide=False)
    add_headlights(collection, root, cube, materials, front_sign=-1, half_length=COACH_LENGTH / 2, prefix="driving_trailer_cab")
    add_box(collection, cube, "driving_trailer_nose_apron", (0.52, 1.95, 0.42), (-13.02, 0, 0.63), materials["railjet_red"], root, rotation=(0, 0.11, 0))
    for side in (-1, 1):
        add_box(collection, cube, f"driving_trailer_side_cab_window_{side}", (1.65, 0.064, 0.78), (-10.85, side * 1.44, 3.06), materials["glass"], root)
        add_box(collection, cube, f"driving_trailer_cab_red_mask_{side}", (3.0, 0.052, 0.28), (-11.42, side * 1.43, 3.77), materials["railjet_red"], root)
    add_metric_contract(collection, root)
    return root


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result = [root]
    for child in root.children:
        result.extend(descendants(child))
    return result


def duplicate_hierarchy(
    source: bpy.types.Object,
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    name: str,
) -> bpy.types.Object:
    mapping: dict[bpy.types.Object, bpy.types.Object] = {}

    def duplicate(current: bpy.types.Object, new_parent: bpy.types.Object | None) -> bpy.types.Object:
        copy = current.copy()
        copy.data = current.data
        copy.animation_data_clear()
        collection.objects.link(copy)
        copy.parent = new_parent
        copy.matrix_parent_inverse = Matrix.Identity(4)
        mapping[current] = copy
        for child in current.children:
            duplicate(child, copy)
        return copy

    root_copy = duplicate(source, parent)
    root_copy.name = name
    return root_copy


def select_hierarchy(root: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in descendants(root):
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root


def export_glb(root: bpy.types.Object, path: Path, *, meshopt: bool = False) -> None:
    select_hierarchy(root)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=False,
        export_tangents=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_materials="EXPORT",
        export_meshopt_compression_enable=meshopt,
        check_existing=False,
    )


def build_formation(
    prototypes: dict[str, bpy.types.Object],
    root_collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    formation_collection = make_collection("Railjet_Classic_Formation", root_collection)
    formation_root = add_empty(formation_collection, "railjet_classic_blender_root")
    formation_root["formation"] = "ÖBB Railjet classic"
    formation_root["vehicle_count"] = 8
    formation_root["length_m"] = round(FORMATION_LENGTH, 3)
    formation_root["source_1"] = OFFICIAL_SOURCES[0]
    formation_root["source_2"] = OFFICIAL_SOURCES[1]
    formation_root["source_3"] = OFFICIAL_SOURCES[2]
    add_metric_contract(formation_collection, formation_root, add_anchor=True)

    consist = [
        ("taurus", TAURUS_LENGTH),
        ("economy", COACH_LENGTH),
        ("economy", COACH_LENGTH),
        ("economy", COACH_LENGTH),
        ("economy", COACH_LENGTH),
        ("restaurant", COACH_LENGTH),
        ("first", COACH_LENGTH),
        ("driving_trailer", COACH_LENGTH),
    ]
    cursor = FORMATION_LENGTH / 2
    for index, (role, length) in enumerate(consist):
        center = cursor - length / 2
        instance = duplicate_hierarchy(prototypes[role], formation_collection, formation_root, f"vehicle_{index:02d}_{role}")
        instance.location.x = center
        instance["formation_index"] = index
        instance["role"] = role
        instance["length_m"] = length
        cursor -= length
        if index < len(consist) - 1:
            gap_center = cursor - FORMATION_GAP / 2
            add_box(formation_collection, cube, f"intervehicle_coupler_{index:02d}", (0.54, 0.22, 0.18), (gap_center, 0, 0.89), materials["underframe"], formation_root)
            cursor -= FORMATION_GAP
    return formation_root


def add_review_environment(
    root_collection: bpy.types.Collection,
    formation_root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    review = make_collection("Review_Environment", root_collection)
    environment_root = add_empty(review, "review_environment_root")
    add_box(review, cube, "review_ground", (280, 80, 0.24), (0, 0, -0.59), materials["ground"], environment_root)
    add_box(review, cube, "review_ballast", (224, 3.8, 0.28), (0, 0, -0.36), materials["ballast"], environment_root)
    for y in (-WHEEL_TREAD_CENTER_METERS, WHEEL_TREAD_CENTER_METERS):
        add_box(review, cube, f"review_rail_{y}", (224, 0.075, 0.12), (0, y, -0.06), materials["steel"], environment_root)
    for index in range(225):
        add_box(review, cube, f"review_sleeper_{index:03d}", (0.16, 2.58, 0.095), (-112 + index, 0, -0.1675), materials["sleeper"], environment_root)
    add_box(review, cube, "review_catenary_contact_wire", (224, 0.028, 0.028), (0, 0, PANTOGRAPH_CONTACT_HEIGHT_METERS), materials["steel"], environment_root)

    target = add_empty(review, "review_camera_target")
    target.location.z = 1.7
    pivot = add_empty(review, "review_camera_orbit")
    camera_data = bpy.data.cameras.new("Railjet_Review_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 145
    camera = link_object(review, "Railjet_Review_Camera", camera_data, location=(108, -116, 68), parent=pivot)
    constraint = camera.constraints.new(type="TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    bpy.context.scene.camera = camera
    pivot.rotation_euler.z = math.radians(-10)
    pivot.keyframe_insert(data_path="rotation_euler", index=2, frame=1)
    pivot.rotation_euler.z = math.radians(350)
    pivot.keyframe_insert(data_path="rotation_euler", index=2, frame=481)
    sun_data = bpy.data.lights.new("Review_Sun", type="SUN")
    sun_data.energy = 2.2
    sun_data.angle = math.radians(20)
    link_object(review, "Review_Sun", sun_data, rotation=(math.radians(38), 0, math.radians(-35)))
    area_data = bpy.data.lights.new("Review_Fill", type="AREA")
    area_data.energy = 2800
    area_data.shape = "RECTANGLE"
    area_data.size = 55
    link_object(review, "Review_Fill", area_data, location=(5, -20, 38))
    formation_root["review_tip"] = "Press Spacebar to orbit the prepared camera around the formation."


def main() -> None:
    ensure_directories()
    reset_scene()
    materials = build_materials()
    cube = unit_cube_mesh()
    cylinder = unit_cylinder_mesh(16)
    assets = make_collection("Railjet_Blender_Assets")
    prototypes_collection = make_collection("Railjet_Prototypes", assets)

    prototypes: dict[str, bpy.types.Object] = {
        "taurus": build_taurus(prototypes_collection, cube, cylinder, materials),
        "economy": build_coach(prototypes_collection, cube, cylinder, materials, "economy", 10),
        "restaurant": build_coach(prototypes_collection, cube, cylinder, materials, "restaurant", 7),
        "first": build_coach(prototypes_collection, cube, cylinder, materials, "first", 8),
        "driving_trailer": build_driving_trailer(prototypes_collection, cube, cylinder, materials),
    }

    module_paths: dict[str, str] = {}
    for role, root in prototypes.items():
        path = OUTPUT_DIR / f"railjet-classic-{role.replace('_', '-')}.glb"
        export_glb(root, path)
        module_paths[role] = str(path.relative_to(PROJECT_ROOT))

    formation_root = build_formation(prototypes, assets, cube, materials)
    formation_path = OUTPUT_DIR / "railjet-classic-blender.glb"
    export_glb(formation_root, formation_path)
    add_review_environment(assets, formation_root, cube, materials)

    prototypes_collection.hide_viewport = True
    prototypes_collection.hide_render = True
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER_PATH), compress=True)

    manifest = {
        "schemaVersion": 2,
        "generator": "Blender 5.2 LTS Python API",
        "formation": "Classic ÖBB Railjet",
        "lengthMeters": round(FORMATION_LENGTH, 3),
        "vehicleCount": 8,
        "consist": ["taurus", "economy", "economy", "economy", "economy", "restaurant", "first", "driving-trailer"],
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
            "pantographContactHeightMeters": PANTOGRAPH_CONTACT_HEIGHT_METERS,
            "calibrationTrackExported": False,
        },
        "sources": list(OFFICIAL_SOURCES),
        "productionRailjetModified": False,
    }
    (SOURCE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("CORNER_RAILS_RAILJET_CLASSIC_GENERATED")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
