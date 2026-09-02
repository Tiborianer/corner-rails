"""Generate an approval-gated DB ICE 3 Class 403 Blender review candidate.

The candidate represents the modernized eight-car BR 403 formation, including
the dedicated 403.3 Bordrestaurant car. User photographs are research-only and
are never copied, embedded, or shipped.

Physical contract before glTF export:
  * metres
  * X = train forward
  * Y = lateral
  * Z = height above the wheel/rail contact plane
  * standard gauge = 1.435 m
  * wheel bottoms = Z 0
  * raised pantograph contact = Z 5.5 m
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

# Reuse primitive meshes per material. This keeps the highly detailed window,
# door, running-gear, and roof rhythms compact after glTF Transform deduplication.
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

SOURCE_DIR = PROJECT_ROOT / "assets" / "blender" / "ice3-br403"
OUTPUT_DIR = PROJECT_ROOT / "public" / "models" / "train-lab" / "ice3-br403"
MASTER_PATH = SOURCE_DIR / "ice3-br403-master.blend"

END_CAR_LENGTH = 25.835
MIDDLE_CAR_LENGTH = 24.775
FORMATION_LENGTH = 2 * END_CAR_LENGTH + 6 * MIDDLE_CAR_LENGTH
VEHICLE_WIDTH = 2.95
VEHICLE_HEIGHT = 3.89
VISUAL_GAP = 0.18

STANDARD_GAUGE_METERS = 1.435
WHEEL_TREAD_CENTER_METERS = STANDARD_GAUGE_METERS / 2
RAIL_CONTACT_PLANE_Z = 0.0
PANTOGRAPH_CONTACT_HEIGHT_METERS = 5.5

OFFICIAL_SOURCES = (
    "https://www.deutschebahn.com/de/ICE-3-7033052",
    "https://www.deutschebahn.com/resource/blob/12723788/819f9bc39b4e262b31c18cfd132b4654/DB-403_04_2023-data.pdf",
    "https://www-abn.bahn.de/dam/jcr%3A80906029-89db-4a3d-bcf2-8360f07a1efa/215187-289013.pdf",
    "https://www.deutschebahn.com/de/presse/suche_Medienpakete/5-Schoener-speisen--6854504",
)

USER_REFERENCE_FILENAMES = (
    "ice_3_front_sideview.jpg.avif",
    "ice_3_front_forwardview.jpg.avif",
    "ice_car_sideview.jpg",
    "ICE_3_second_class_car_sideview.png.webp",
    "ice_3_front-side_view.jpeg",
)

CONSIST = (
    ("first_end_403_0", END_CAR_LENGTH),
    ("first_transformer_403_1", MIDDLE_CAR_LENGTH),
    ("second_converter_403_2", MIDDLE_CAR_LENGTH),
    ("bordrestaurant_403_3", MIDDLE_CAR_LENGTH),
    ("service_403_8", MIDDLE_CAR_LENGTH),
    ("second_converter_403_7", MIDDLE_CAR_LENGTH),
    ("second_transformer_403_6", MIDDLE_CAR_LENGTH),
    ("second_end_403_5", END_CAR_LENGTH),
)

BODY_PROFILE = (
    (-1.17, 0.68), (-1.39, 0.86), (-1.475, 1.18), (-1.475, 3.18),
    (-1.39, 3.48), (-1.14, 3.70), (-0.72, 3.84), (0.0, 3.89),
    (0.72, 3.84), (1.14, 3.70), (1.39, 3.48), (1.475, 3.18),
    (1.475, 1.18), (1.39, 0.86), (1.17, 0.68),
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
    scene.world = bpy.data.worlds.new("ICE3_BR403_Review_World")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.055, 0.075, 0.095, 1.0)
        background.inputs["Strength"].default_value = 0.72


def make_materials() -> dict[str, bpy.types.Material]:
    make = common.make_material
    return {
        "ice_white": make("ICE3_Pearl_White", (0.88, 0.89, 0.87, 1), metallic=0.08, roughness=0.30),
        "ice_red": make("ICE3_Traffic_Red", (0.82, 0.015, 0.025, 1), metallic=0.02, roughness=0.31),
        "glass": make("ICE3_Smoked_Glass", (0.012, 0.024, 0.032, 1), metallic=0.34, roughness=0.11),
        "warm_glass": make("ICE3_Warm_Interior", (0.34, 0.18, 0.055, 1), metallic=0.02, roughness=0.20),
        "restaurant_glass": make("ICE3_Restaurant_Warm_Glass", (0.16, 0.075, 0.018, 1), metallic=0.08, roughness=0.16),
        "roof": make("ICE3_Roof_Equipment", (0.49, 0.51, 0.50, 1), metallic=0.34, roughness=0.40),
        "underframe": make("ICE3_Underframe", (0.055, 0.062, 0.064, 1), metallic=0.60, roughness=0.43),
        "fairing": make("ICE3_Underbody_Fairing", (0.60, 0.61, 0.59, 1), metallic=0.24, roughness=0.39),
        "wheel": make("ICE3_Wheels", (0.045, 0.050, 0.052, 1), metallic=0.86, roughness=0.23),
        "steel": make("ICE3_Steel", (0.36, 0.39, 0.39, 1), metallic=0.88, roughness=0.22),
        "pantograph": make("ICE3_Pantograph_Red", (0.56, 0.025, 0.025, 1), metallic=0.62, roughness=0.29),
        "lamp": make("ICE3_Headlamp", (1.0, 0.81, 0.38, 1), metallic=0.02, roughness=0.12),
        "marker": make("ICE3_First_Class_Marker", (0.93, 0.76, 0.21, 1), metallic=0.08, roughness=0.28),
        "ballast": make("ICE3_Review_Ballast", (0.19, 0.21, 0.21, 1), roughness=0.96),
        "sleeper": make("ICE3_Review_Sleeper", (0.23, 0.14, 0.08, 1), roughness=0.92),
        "ground": make("ICE3_Review_Ground", (0.24, 0.37, 0.28, 1), roughness=0.98),
    }


def attach_metric_contract(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    *,
    anchor: bool = False,
) -> None:
    common.add_metric_contract(collection, root, add_anchor=anchor)
    root["pantograph_contact_height_m"] = PANTOGRAPH_CONTACT_HEIGHT_METERS


def body_sections(length: float, cab_sign: int) -> list[tuple[float, float, float, float]]:
    half = (length - VISUAL_GAP) / 2
    if cab_sign == 0:
        return [(-half, 0.96, 0.98, 0), (-half + 0.28, 1, 1, 0), (half - 0.28, 1, 1, 0), (half, 0.96, 0.98, 0)]
    ordinary = -cab_sign * half
    nose = cab_sign * half
    sections = [
        (ordinary, 0.96, 0.98, 0),
        (ordinary + cab_sign * (length - VISUAL_GAP - 8.0), 1, 1, 0),
        (nose - cab_sign * 6.0, 0.99, 0.995, 0),
        (nose - cab_sign * 4.5, 0.98, 0.99, -0.01),
        (nose - cab_sign * 3.10, 0.92, 0.94, -0.03),
        (nose - cab_sign * 1.72, 0.78, 0.82, -0.07),
        (nose - cab_sign * 0.62, 0.60, 0.62, -0.09),
        (nose, 0.48, 0.48, -0.10),
    ]
    return sorted(sections, key=lambda section: section[0])


def add_window(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    root: bpy.types.Object,
    name: str,
    x: float,
    *,
    width: float = 1.48,
    warm: bool = False,
) -> None:
    for side in (-1, 1):
        common.add_box(
            collection,
            cube,
            f"{name}_window_{side}",
            (width, 0.052, 0.67),
            (x, side * 1.48, 2.64),
            materials["restaurant_glass" if warm else "glass"],
            root,
        )


def add_door(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    root: bpy.types.Object,
    name: str,
    x: float,
) -> None:
    for side in (-1, 1):
        common.add_box(collection, cube, f"{name}_door_{side}", (1.05, 0.056, 1.86), (x, side * 1.485, 1.72), materials["ice_white"], root)
        common.add_box(collection, cube, f"{name}_door_window_{side}", (0.43, 0.063, 0.82), (x, side * 1.489, 2.12), materials["glass"], root)
        common.add_box(collection, cube, f"{name}_door_seam_{side}", (0.025, 0.066, 1.72), (x, side * 1.492, 1.67), materials["underframe"], root)


def add_bogie_pair(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    role: str,
    length: float,
) -> None:
    inset = 3.85 if length > 25 else 3.65
    for index, x in enumerate((-length / 2 + inset, length / 2 - inset)):
        common.add_bogie(
            collection,
            root,
            cube,
            cylinder,
            materials,
            name=f"{role}_bogie_{index}",
            x=x,
            axle_spacing=2.50,
            wheel_radius=0.46,
            bogie_width=2.02,
        )


def add_underframe(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    root: bpy.types.Object,
    role: str,
    length: float,
    powered: bool,
) -> None:
    common.add_box(collection, cube, f"{role}_underframe_spine", (length - 1.2, 1.92, 0.22), (0, 0, 0.80), materials["underframe"], root)
    panel_count = 8 if powered else 6
    usable = length - 9.0
    for index in range(panel_count):
        x = -usable / 2 + (index + 0.5) * usable / panel_count
        common.add_box(collection, cube, f"{role}_underbody_fairing_{index:02d}", (usable / panel_count - 0.09, 2.42, 0.55), (x, 0, 0.91), materials["fairing"], root)
    if powered:
        for x in (-2.8, 0, 2.8):
            common.add_box(collection, cube, f"{role}_traction_equipment_{x}", (2.0, 1.80, 0.42), (x, 0, 0.68), materials["underframe"], root)


def add_gangway(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    root: bpy.types.Object,
    role: str,
    length: float,
    cab_sign: int,
) -> None:
    ends = [side for side in (-1, 1) if side != cab_sign]
    for side in ends:
        x = side * (length - VISUAL_GAP) / 2
        common.add_box(collection, cube, f"{role}_gangway_{side}", (0.18, 1.34, 2.32), (x, 0, 2.02), materials["underframe"], root)
        common.add_box(collection, cube, f"{role}_coupler_{side}", (0.42, 0.22, 0.18), (x + side * 0.19, 0, 0.72), materials["underframe"], root)


def add_red_belt(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    root: bpy.types.Object,
    role: str,
    length: float,
    cab_sign: int,
) -> None:
    half = (length - VISUAL_GAP) / 2
    belt_end = half - (5.55 if cab_sign else 0.18)
    belt_center = -cab_sign * (5.55 / 2) if cab_sign else 0
    belt_length = length - VISUAL_GAP - (5.55 if cab_sign else 0.36)
    for side in (-1, 1):
        common.add_box(collection, cube, f"{role}_red_belt_{side}", (belt_length, 0.045, 0.105), (belt_center, side * 1.492, 2.17), materials["ice_red"], root)
        if cab_sign:
            nose = cab_sign * half
            body_x = cab_sign * belt_end
            path = [
                (body_x, side * 1.525, 2.16),
                (nose - cab_sign * 3.10, side * 1.39, 1.93),
                (nose - cab_sign * 1.72, side * 1.18, 1.65),
                (nose - cab_sign * 0.62, side * 0.94, 1.40),
                (nose - cab_sign * 0.18, side * 0.79, 1.49),
            ]
            path.sort(key=lambda item: item[0])
            vertices = [(x, y, z - 0.075) for x, y, z in path] + [(x, y, z + 0.075) for x, y, z in path]
            count = len(path)
            faces = [(index, index + 1, count + index + 1, count + index) for index in range(count - 1)]
            mesh = bpy.data.meshes.new(f"{role}_nose_red_sweep_mesh_{side}")
            mesh.from_pydata(vertices, [], faces)
            mesh.materials.append(materials["ice_red"])
            mesh.update()
            common.link_object(collection, f"{role}_nose_red_sweep_{side}", mesh, parent=root)


def add_cab_details(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    root: bpy.types.Object,
    role: str,
    length: float,
    cab_sign: int,
) -> None:
    half = (length - VISUAL_GAP) / 2
    # A thin faceted skin follows the cab surface. A separate solid visor would
    # sink into the white loft or read as a helmet at the game camera distance.
    visor_sections = [
        (cab_sign * (half - 4.42), [(-1.34, 2.62), (-1.27, 3.18), (-0.72, 3.72), (0, 3.895), (0.72, 3.72), (1.27, 3.18), (1.34, 2.62)]),
        (cab_sign * (half - 3.12), [(-1.25, 2.55), (-1.17, 3.06), (-0.66, 3.47), (0, 3.61), (0.66, 3.47), (1.17, 3.06), (1.25, 2.55)]),
        (cab_sign * (half - 2.02), [(-1.02, 2.38), (-0.94, 2.76), (-0.52, 3.05), (0, 3.14), (0.52, 3.05), (0.94, 2.76), (1.02, 2.38)]),
    ]
    visor_sections.sort(key=lambda item: item[0])
    visor_vertices = [(x + cab_sign * 0.10, y * 1.055, z + 0.075) for x, ring in visor_sections for y, z in ring]
    ring_size = len(visor_sections[0][1])
    visor_faces = []
    for section_index in range(len(visor_sections) - 1):
        start = section_index * ring_size
        nxt = (section_index + 1) * ring_size
        for point_index in range(ring_size - 1):
            visor_faces.append((start + point_index, start + point_index + 1, nxt + point_index + 1, nxt + point_index))
    visor_mesh = bpy.data.meshes.new(f"{role}_front_windscreen_mesh")
    visor_mesh.from_pydata(visor_vertices, [], visor_faces)
    visor_mesh.materials.append(materials["glass"])
    visor_mesh.update()
    for polygon in visor_mesh.polygons:
        polygon.use_smooth = True
    common.link_object(collection, f"{role}_front_windscreen_visor", visor_mesh, parent=root)

    for side in (-1, 1):
        y = side * 1.56
        x0 = cab_sign * (half - 4.65)
        x1 = cab_sign * (half - 2.38)
        mesh = common.polygon_mesh(
            f"{role}_side_cab_window_mesh_{side}",
            [(x0 + cab_sign * 0.09, y, 2.54), (x1 + cab_sign * 0.09, side * 1.25, 2.45), (cab_sign * (half - 1.88) + cab_sign * 0.09, side * 1.30, 3.31), (cab_sign * (half - 4.02) + cab_sign * 0.09, side * 1.60, 3.67)],
            materials["glass"],
        )
        common.link_object(collection, f"{role}_side_cab_window_{side}", mesh, parent=root)

    nose_x = cab_sign * (half + 0.025)
    for side in (-1, 1):
        common.add_cylinder(
            collection,
            cylinder,
            f"{role}_headlamp_{side}",
            0.105,
            0.055,
            (nose_x, side * 0.33, 1.42),
            materials["lamp"],
            root,
            rotation=(0, math.pi / 2, 0),
        )
    common.add_box(collection, cube, f"{role}_nose_coupler_hatch", (0.10, 0.54, 0.19), (cab_sign * (half + 0.018), 0, 0.96), materials["underframe"], root)
    common.add_box(collection, cube, f"{role}_nose_lower_apron", (0.12, 1.10, 0.22), (cab_sign * (half + 0.012), 0, 0.72), materials["ice_white"], root)


def add_pantograph(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    root: bpy.types.Object,
    role: str,
    *,
    raised: bool,
) -> None:
    base_x = 1.9
    for index, (x, y) in enumerate(((-0.65, -0.48), (-0.65, 0.48), (0.65, -0.48), (0.65, 0.48))):
        common.add_cylinder(collection, cylinder, f"{role}_pantograph_insulator_{index}", 0.085, 0.20, (base_x + x, y, 3.99), materials["roof"], root)
    common.add_box(collection, cube, f"{role}_pantograph_base", (1.75, 1.05, 0.10), (base_x, 0, 4.08), materials["underframe"], root)
    top_z = PANTOGRAPH_CONTACT_HEIGHT_METERS if raised else 4.34
    lower_z = 4.12
    knee_z = 4.80 if raised else 4.24
    common.add_beam_between(collection, cube, f"{role}_pantograph_arm_a", (base_x - 0.66, -0.34, lower_z), (base_x + 0.04, -0.18, knee_z), 0.055, materials["pantograph"], root)
    common.add_beam_between(collection, cube, f"{role}_pantograph_arm_b", (base_x + 0.04, -0.18, knee_z), (base_x + 0.68, 0, top_z - 0.04), 0.055, materials["pantograph"], root)
    common.add_beam_between(collection, cube, f"{role}_pantograph_arm_c", (base_x + 0.66, 0.34, lower_z), (base_x - 0.04, 0.18, knee_z), 0.055, materials["pantograph"], root)
    common.add_beam_between(collection, cube, f"{role}_pantograph_arm_d", (base_x - 0.04, 0.18, knee_z), (base_x - 0.68, 0, top_z - 0.04), 0.055, materials["pantograph"], root)
    common.add_box(collection, cube, f"{role}_pantograph_collector", (1.72, 0.07, 0.055), (base_x, 0, top_z), materials["steel"], root)


def window_positions(role: str, length: float, cab_sign: int) -> list[float]:
    if cab_sign:
        # Leave the characteristic broad door gap between the saloon and cab.
        positive_cab = [-10.0, -7.7, -5.4, -3.1, -0.8, 1.5, 6.4] if role.startswith("first") else [-10.0, -8.1, -6.2, -4.3, -2.4, -0.4, 1.5, 5.4, 7.2]
        return [cab_sign * x for x in positive_cab]
    if role == "bordrestaurant_403_3":
        return [-8.8, -7.05, -5.30, -3.55, -1.80, 3.75, 5.55, 7.35]
    if role == "service_403_8":
        return [-8.7, -6.85, -4.95, -2.90, -0.95, 1.15, 3.2, 5.25, 7.30]
    return [-8.75, -6.80, -4.85, -2.90, -0.95, 1.0, 2.95, 4.90, 6.85, 8.80]


def build_vehicle(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    role: str,
    length: float,
    cab_sign: int = 0,
    powered: bool = False,
    first_class: bool = False,
    pantograph: str | None = None,
) -> bpy.types.Object:
    root = common.add_empty(collection, f"ice3_{role}_root")
    root["vehicle_role"] = role
    root["length_m"] = length
    root["class_403"] = True
    shell = common.loft_mesh(f"ice3_{role}_shell_mesh", body_sections(length, cab_sign), BODY_PROFILE, materials["ice_white"])
    common.link_object(collection, f"ice3_{role}_lofted_shell", shell, parent=root)
    add_red_belt(collection, cube, materials, root, role, length, cab_sign)
    add_bogie_pair(collection, root, cube, cylinder, materials, role, length)
    add_underframe(collection, cube, materials, root, role, length, powered)
    add_gangway(collection, cube, materials, root, role, length, cab_sign)

    doors = [cab_sign * 3.65] if cab_sign else [-10.65, 10.65]
    for index, x in enumerate(doors):
        add_door(collection, cube, materials, root, f"{role}_{index}", x)

    restaurant = role == "bordrestaurant_403_3"
    for index, x in enumerate(window_positions(role, length, cab_sign)):
        width = 1.58 if restaurant and x < 0 else 1.48
        add_window(collection, cube, materials, root, f"{role}_{index:02d}", x, width=width, warm=restaurant)

    if first_class:
        for side in (-1, 1):
            common.add_box(collection, cube, f"{role}_first_class_marker_{side}", (0.18, 0.052, 0.42), (-8.95 if not cab_sign else -cab_sign * 8.7, side * 1.493, 3.29), materials["marker"], root)

    if restaurant:
        for side in (-1, 1):
            common.add_box(collection, cube, f"{role}_galley_blank_panel_{side}", (3.35, 0.052, 0.84), (1.35, side * 1.491, 2.60), materials["ice_white"], root)
            common.add_box(collection, cube, f"{role}_restaurant_identity_panel_{side}", (2.25, 0.058, 0.24), (-1.0, side * 1.495, 1.76), materials["restaurant_glass"], root)
        common.add_box(collection, cube, f"{role}_kitchen_roof_hvac", (5.2, 1.55, 0.18), (2.1, 0, 3.98), materials["roof"], root)

    if role == "service_403_8":
        for side in (-1, 1):
            common.add_box(collection, cube, f"{role}_accessible_service_panel_{side}", (1.10, 0.052, 0.60), (-0.15, side * 1.491, 1.58), materials["glass"], root)

    if cab_sign:
        add_cab_details(collection, cube, cylinder, materials, root, role, length, cab_sign)

    # Aerodynamic roof cabinets make each distributed-power role legible from
    # the locked top-corner game camera.
    if powered:
        for index, x in enumerate((-4.2, 0, 4.2)):
            common.add_box(collection, cube, f"{role}_roof_power_fairing_{index}", (2.8, 1.42, 0.16), (x, 0, 3.96), materials["roof"], root)
    if pantograph:
        common.add_box(collection, cube, f"{role}_transformer_roof_fairing", (8.2, 1.56, 0.16), (0, 0, 3.97), materials["roof"], root)
        add_pantograph(collection, cube, cylinder, materials, root, role, raised=pantograph == "raised")

    attach_metric_contract(collection, root)
    return root


def build_formation(
    prototypes: dict[str, bpy.types.Object],
    assets: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    collection = common.make_collection("ICE3_BR403_Formation", assets)
    root = common.add_empty(collection, "ice3_br403_blender_root")
    root["formation"] = "DB ICE 3 Class 403 eight-car redesign review candidate"
    root["vehicle_count"] = 8
    root["length_m"] = round(FORMATION_LENGTH, 3)
    root["approval_status"] = "private review only"
    root["bordrestaurant_vehicle"] = "vehicle_03_bordrestaurant_403_3"
    for index, source in enumerate(OFFICIAL_SOURCES, start=1):
        root[f"source_{index}"] = source
    attach_metric_contract(collection, root, anchor=True)

    cursor = FORMATION_LENGTH / 2
    for index, (role, length) in enumerate(CONSIST):
        center = cursor - length / 2
        instance = common.duplicate_hierarchy(prototypes[role], collection, root, f"vehicle_{index:02d}_{role}")
        instance.location.x = center
        instance["formation_index"] = index
        instance["role"] = role
        instance["length_m"] = length
        cursor -= length
        if index < len(CONSIST) - 1:
            common.add_box(collection, cube, f"intervehicle_coupler_{index:02d}", (0.54, 0.20, 0.16), (cursor, 0, 0.72), materials["underframe"], root)
    return root


def add_review_environment(
    assets: bpy.types.Collection,
    formation_root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    review = common.make_collection("Review_Environment", assets)
    root = common.add_empty(review, "review_environment_root")
    common.add_box(review, cube, "review_ground", (270, 64, 0.26), (0, 0, -0.64), materials["ground"], root)
    common.add_box(review, cube, "review_ballast", (252, 3.8, 0.30), (0, 0, -0.38), materials["ballast"], root)
    for y in (-WHEEL_TREAD_CENTER_METERS, WHEEL_TREAD_CENTER_METERS):
        common.add_box(review, cube, f"review_rail_{y}", (252, 0.075, 0.12), (0, y, -0.06), materials["steel"], root)
    for index in range(253):
        common.add_box(review, cube, f"review_sleeper_{index:03d}", (0.16, 2.58, 0.095), (-126 + index, 0, -0.168), materials["sleeper"], root)
    for x in range(-120, 121, 24):
        common.add_box(review, cube, f"review_catenary_post_{x}", (0.16, 0.16, 6.0), (x, 3.15, 2.82), materials["steel"], root)
        common.add_beam_between(review, cube, f"review_catenary_arm_{x}", (x, 3.15, 5.72), (x, 0, 5.50), 0.055, materials["steel"], root)
    common.add_box(review, cube, "review_contact_wire", (252, 0.035, 0.035), (0, 0, PANTOGRAPH_CONTACT_HEIGHT_METERS), materials["steel"], root)

    target = common.add_empty(review, "review_camera_target")
    target.location = (0, 0, 2.25)
    pivot = common.add_empty(review, "review_camera_orbit")
    camera_data = bpy.data.cameras.new("ICE3_BR403_Review_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 130
    camera = common.link_object(review, "ICE3_BR403_Review_Camera", camera_data, location=(112, -126, 70), parent=pivot)
    constraint = camera.constraints.new(type="TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    bpy.context.scene.camera = camera
    pivot.rotation_euler.z = math.radians(-6)
    pivot.keyframe_insert(data_path="rotation_euler", index=2, frame=1)
    pivot.rotation_euler.z = math.radians(354)
    pivot.keyframe_insert(data_path="rotation_euler", index=2, frame=481)

    sun_data = bpy.data.lights.new("ICE3_BR403_Review_Sun", type="SUN")
    sun_data.energy = 2.6
    sun_data.angle = math.radians(16)
    common.link_object(review, "ICE3_BR403_Review_Sun", sun_data, rotation=(math.radians(38), 0, math.radians(-35)))
    area_data = bpy.data.lights.new("ICE3_BR403_Review_Fill", type="AREA")
    area_data.energy = 3300
    area_data.shape = "RECTANGLE"
    area_data.size = 58
    common.link_object(review, "ICE3_BR403_Review_Fill", area_data, location=(8, -28, 38))
    formation_root["review_tip"] = "Press Spacebar to orbit the prepared camera. Review track and wire are never exported."


def main() -> None:
    ensure_directories()
    reset_scene()
    materials = make_materials()
    cube = common.unit_cube_mesh()
    cylinder = common.unit_cylinder_mesh(20)
    assets = common.make_collection("ICE3_BR403_Blender_Assets")
    prototypes_collection = common.make_collection("ICE3_BR403_Prototypes", assets)

    prototypes = {
        "first_end_403_0": build_vehicle(prototypes_collection, cube, cylinder, materials, role="first_end_403_0", length=END_CAR_LENGTH, cab_sign=1, powered=True, first_class=True),
        "first_transformer_403_1": build_vehicle(prototypes_collection, cube, cylinder, materials, role="first_transformer_403_1", length=MIDDLE_CAR_LENGTH, first_class=True, pantograph="raised"),
        "second_converter_403_2": build_vehicle(prototypes_collection, cube, cylinder, materials, role="second_converter_403_2", length=MIDDLE_CAR_LENGTH, powered=True),
        "bordrestaurant_403_3": build_vehicle(prototypes_collection, cube, cylinder, materials, role="bordrestaurant_403_3", length=MIDDLE_CAR_LENGTH),
        "service_403_8": build_vehicle(prototypes_collection, cube, cylinder, materials, role="service_403_8", length=MIDDLE_CAR_LENGTH),
        "second_converter_403_7": build_vehicle(prototypes_collection, cube, cylinder, materials, role="second_converter_403_7", length=MIDDLE_CAR_LENGTH, powered=True),
        "second_transformer_403_6": build_vehicle(prototypes_collection, cube, cylinder, materials, role="second_transformer_403_6", length=MIDDLE_CAR_LENGTH, pantograph="folded"),
        "second_end_403_5": build_vehicle(prototypes_collection, cube, cylinder, materials, role="second_end_403_5", length=END_CAR_LENGTH, cab_sign=-1, powered=True),
    }

    module_paths: dict[str, str] = {}
    for role, root in prototypes.items():
        path = OUTPUT_DIR / f"ice3-br403-{role.replace('_', '-')}.glb"
        common.export_glb(root, path)
        module_paths[role] = str(path.relative_to(PROJECT_ROOT))

    formation_root = build_formation(prototypes, assets, cube, materials)
    formation_path = OUTPUT_DIR / "ice3-br403-blender.glb"
    common.export_glb(formation_root, formation_path)
    add_review_environment(assets, formation_root, cube, materials)
    prototypes_collection.hide_viewport = True
    prototypes_collection.hide_render = True
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER_PATH), compress=True)

    manifest = {
        "schemaVersion": 1,
        "generator": "Blender 5.2 LTS Python API",
        "candidateId": "ice3-br403-redesign",
        "approvalStatus": "private-review",
        "formation": "DB ICE 3 Class 403 eight-car redesign",
        "lengthMeters": round(FORMATION_LENGTH, 3),
        "vehicleCount": 8,
        "consist": [role for role, _ in CONSIST],
        "bordrestaurant": {
            "vehicleIndex": 3,
            "class": "403.3",
            "role": "BRmz/WRmz Bordrestaurant",
            "redesignSeatCount": 20,
        },
        "vehicleDimensionsMeters": {
            "endCar": {"length": END_CAR_LENGTH, "width": VEHICLE_WIDTH, "height": VEHICLE_HEIGHT},
            "middleCar": {"length": MIDDLE_CAR_LENGTH, "width": VEHICLE_WIDTH, "height": VEHICLE_HEIGHT},
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
            "traction": "distributed-electric",
            "pantographContactHeightMeters": PANTOGRAPH_CONTACT_HEIGHT_METERS,
            "calibrationTrackExported": False,
        },
        "recognitionFeatures": [
            "long rounded BR403 cab nose and black panoramic windscreen visor",
            "red belt dipping down across both nose sides",
            "continuous smoked-window rhythm on pearl-white body",
            "distinct 403.3 Bordrestaurant dining and galley window arrangement",
            "distributed-power underframes plus transformer-car pantographs",
        ],
        "userReferenceFilenames": list(USER_REFERENCE_FILENAMES),
        "referencePolicy": "Research only. Local images are not copied, embedded, textured, or shipped.",
        "sources": list(OFFICIAL_SOURCES),
        "productionRegistryModified": False,
    }
    (SOURCE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("CORNER_RAILS_ICE3_BR403_GENERATED")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
