"""Generate the private Blender review candidate for the new-generation Nightjet.

The user's references and official Siemens/ÖBB material define this consist:

    ÖBB 1116 Taurus + 2 sleeping cars + 3 couchette cars
    + multifunction car + control/seat car

The seven Viaggio Next Level cars form a fixed push-pull set.  The locomotive
is deliberately included as the Nightjet-liveried Taurus 1116 selected by the
user.  Reference photographs remain research-only: no photograph, logo,
wordmark, or third-party texture is embedded in the Blender source or GLBs.

Coordinate contract before glTF export:
  * metres
  * X = train forward / formation length
  * Y = lateral / vehicle width
  * Z = height above the rail-contact plane
  * wheel-tread centres = +/- 0.7175 m
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
SPEC = importlib.util.spec_from_file_location("corner_rails_nightjet_common", COMMON_SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Could not load shared Blender helpers: {COMMON_SCRIPT}")
common = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(common)

# The common Railjet generator shares primitive meshes aggressively.  Use one
# primitive copy per material so the Nightjet's many small colour-blocking
# surfaces keep their intended materials while still deduplicating geometry.
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

SOURCE_DIR = PROJECT_ROOT / "assets" / "blender" / "nightjet-new-generation"
OUTPUT_DIR = PROJECT_ROOT / "public" / "models" / "train-lab" / "nightjet-new-generation"
MASTER_PATH = SOURCE_DIR / "nightjet-new-generation-master.blend"

TAURUS_LENGTH = 19.28
TAURUS_WIDTH = 3.00
TAURUS_HEIGHT = 4.32
COACH_LENGTH = 26.40
COACH_WIDTH = 2.825
COACH_HEIGHT = 4.18
FORMATION_GAP = 0.085
FORMATION_LENGTH = TAURUS_LENGTH + 7 * COACH_LENGTH + 7 * FORMATION_GAP

STANDARD_GAUGE_METERS = 1.435
WHEEL_TREAD_CENTER_METERS = STANDARD_GAUGE_METERS / 2
RAIL_CONTACT_PLANE_Z = 0.0
PANTOGRAPH_CONTACT_HEIGHT_METERS = 5.5

OFFICIAL_SOURCES = (
    "https://press.siemens.com/global/en/pressrelease/obb-and-siemens-mobility-present-interior-design-next-generation-nightjet",
    "https://press.siemens.com/global/en/pressrelease/obb-and-siemens-mobility-sign-framework-agreement-passenger-coaches-austria",
    "https://produktion.oebb.at/dam/jcr%3A47dbe927-74ea-47fd-abc2-253c45498ac1/1116.pdf",
    "https://www.nightjet.com/de/komfortkategorien/nightjet-neue-generation",
)

USER_REFERENCE_FILENAMES = (
    "nightjet_cabcar_front-side.jpg",
    "nightjet_cabcar_front-side-view 2.jpg",
    "nightjet_full formation_without_locomotive.jpg",
    "nightjet_car_1.jpg",
    "nightjet_car_2.jpg",
    "nightjet_cabcar_side_view.jpg",
    "nightjet_taurus_1116_corner_view.png",
    "nightjet_taurus_1116_sideview.jpg",
    "nightjet_taurus_1116_front-side_view.jpg",
)

# Rounded Viaggio Next Level cross-section. The broad upper shoulders and dark
# roof cap are recognition-critical in the fixed top-corner camera.
COACH_PROFILE = (
    (-1.16, 0.76), (-1.35, 0.94), (-1.4125, 1.22), (-1.4125, 3.42),
    (-1.34, 3.72), (-1.08, 3.98), (-0.62, 4.13), (0.0, 4.18),
    (0.62, 4.13), (1.08, 3.98), (1.34, 3.72), (1.4125, 3.42),
    (1.4125, 1.22), (1.35, 0.94), (1.16, 0.76),
)


def make_emissive_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    strength: float,
) -> bpy.types.Material:
    material = common.make_material(name, color, metallic=0.02, roughness=0.22)
    bsdf = material.node_tree.nodes.get("Principled BSDF") if material.node_tree else None
    if bsdf:
        emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        emission_strength = bsdf.inputs.get("Emission Strength")
        if emission:
            emission.default_value = color
        if emission_strength:
            emission_strength.default_value = strength
    return material


def make_materials() -> dict[str, bpy.types.Material]:
    night_blue = common.make_material("NJ_Midnight_Blue", (0.018, 0.035, 0.16, 1.0), metallic=0.18, roughness=0.34)
    dark_blue = common.make_material("NJ_Deep_Blue", (0.009, 0.018, 0.075, 1.0), metallic=0.20, roughness=0.30)
    return {
        "night_blue": night_blue,
        "dark_blue": dark_blue,
        "railjet_red": night_blue,
        "signal_red": common.make_material("NJ_Signal_Red", (0.82, 0.025, 0.035, 1.0), metallic=0.04, roughness=0.38),
        "deep_red": common.make_material("NJ_Dark_Red", (0.34, 0.008, 0.018, 1.0), metallic=0.08, roughness=0.38),
        "light_body": common.make_material("NJ_Silver_Skirt", (0.68, 0.70, 0.70, 1.0), metallic=0.35, roughness=0.34),
        "white": common.make_material("NJ_Door_Frame", (0.86, 0.88, 0.86, 1.0), metallic=0.12, roughness=0.30),
        "anthracite": common.make_material("NJ_Anthracite", (0.018, 0.023, 0.03, 1.0), metallic=0.30, roughness=0.29),
        "glass": common.make_material("NJ_Smoked_Glass", (0.008, 0.028, 0.055, 1.0), metallic=0.26, roughness=0.13),
        "warm_glass": make_emissive_material("NJ_Warm_Window", (0.46, 0.21, 0.055, 1.0), strength=1.0),
        "roof": common.make_material("NJ_Roof", (0.035, 0.040, 0.048, 1.0), metallic=0.48, roughness=0.40),
        "underframe": common.make_material("NJ_Underframe", (0.018, 0.021, 0.025, 1.0), metallic=0.58, roughness=0.46),
        "wheel": common.make_material("NJ_Wheel", (0.038, 0.043, 0.048, 1.0), metallic=0.84, roughness=0.26),
        "steel": common.make_material("NJ_Steel", (0.33, 0.36, 0.38, 1.0), metallic=0.86, roughness=0.23),
        "lamp": make_emissive_material("NJ_Lamp", (1.0, 0.78, 0.34, 1.0), strength=1.0),
        "star": make_emissive_material("NJ_Star", (0.42, 0.68, 0.98, 1.0), strength=1.0),
        "ballast": common.make_material("NJ_Review_Ballast", (0.19, 0.22, 0.21, 1.0), roughness=0.95),
        "sleeper": common.make_material("NJ_Review_Sleeper", (0.20, 0.12, 0.075, 1.0), roughness=0.90),
        "ground": common.make_material("NJ_Review_Ground", (0.23, 0.35, 0.25, 1.0), roughness=0.97),
    }


def coach_roof_mesh(name: str, *, control: bool = False) -> bpy.types.Mesh:
    x0 = -COACH_LENGTH / 2 + (3.10 if control else 0.28)
    x1 = COACH_LENGTH / 2 - 0.28
    arc = [(-1.30, 3.76), (-1.0, 4.0), (-0.55, 4.15), (0, 4.21), (0.55, 4.15), (1.0, 4.0), (1.30, 3.76)]
    vertices = [(x, y, z) for x in (x0, x1) for y, z in arc]
    ring = len(arc)
    faces = [(index, index + 1, ring + index + 1, ring + index) for index in range(ring - 1)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return mesh


def add_nightjet_door(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    prefix: str,
    side: int,
    x: float,
    low_floor: bool,
) -> None:
    y = side * (COACH_WIDTH / 2 + 0.035)
    bottom = 0.77 if low_floor else 0.98
    height = 2.55 if low_floor else 2.34
    common.add_box(collection, cube, f"{prefix}_door_frame_{side}", (1.34, 0.075, height), (x, y, bottom + height / 2), materials["white"], root)
    common.add_box(collection, cube, f"{prefix}_door_leaf_{side}", (1.03, 0.083, height - 0.20), (x, y + side * 0.025, bottom + height / 2), materials["night_blue"], root)
    common.add_box(collection, cube, f"{prefix}_door_window_{side}", (0.63, 0.09, 0.83), (x, y + side * 0.068, 2.67), materials["glass"], root)
    common.add_box(collection, cube, f"{prefix}_door_step_{side}", (1.20, 0.22, 0.10), (x, y + side * 0.17, bottom - 0.02), materials["steel"], root)


def add_window(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    prefix: str,
    side: int,
    index: int,
    x: float,
    width: float,
    warm: bool,
) -> None:
    y = side * (COACH_WIDTH / 2 + 0.070)
    common.add_box(collection, cube, f"{prefix}_window_{side}_{index}", (width, 0.065, 0.88), (x, y, 2.83), materials["glass"], root)
    if warm:
        common.add_box(collection, cube, f"{prefix}_window_glow_{side}_{index}", (width * 0.82, 0.026, 0.62), (x, y - side * 0.055, 2.80), materials["warm_glass"], root)


def add_coach_roof_equipment(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    prefix: str,
    dense: bool,
) -> None:
    positions = (-8.4, 7.8) if not dense else (-8.5, -2.8, 3.0, 8.3)
    for index, x in enumerate(positions):
        width = 2.7 if len(positions) == 2 else 2.0
        common.add_box(collection, cube, f"{prefix}_roof_hvac_{index}", (width, 1.54, 0.22), (x, 0, 4.17), materials["roof"], root)
        for rib in range(4):
            common.add_box(collection, cube, f"{prefix}_roof_hvac_{index}_rib_{rib}", (0.08, 1.38, 0.05), (x - 0.65 + rib * 0.42, 0, 4.30), materials["steel"], root)


def add_nightjet_side_livery(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    role: str,
    windows: tuple[float, ...],
    door_x: float | None,
    low_floor: bool,
    control: bool = False,
    dense_roof: bool = False,
) -> None:
    half = COACH_LENGTH / 2
    start = -half + (3.2 if control else 0.48)
    end = half - 0.48
    center = (start + end) / 2
    length = end - start
    for side in (-1, 1):
        y = side * (COACH_WIDTH / 2 + 0.014)
        common.add_box(collection, cube, f"{role}_silver_skirt_{side}", (length, 0.055, 0.56), (center, y, 1.06), materials["light_body"], root)
        common.add_box(collection, cube, f"{role}_red_belt_{side}", (length, 0.060, 0.16), (center, y + side * 0.012, 2.17), materials["signal_red"], root)
        common.add_box(collection, cube, f"{role}_window_backdrop_{side}", (length - 0.12, 0.045, 1.16), (center, y + side * 0.004, 2.82), materials["dark_blue"], root)
        common.add_box(collection, cube, f"{role}_dark_sill_{side}", (length + 0.08, 0.060, 0.23), (center, y + side * 0.018, 1.50), materials["dark_blue"], root)
        for index, x in enumerate(windows):
            width = 1.48
            if role == "multifunction" and index in (0, len(windows) - 1):
                width = 0.72
            add_window(collection, root, cube, materials, prefix=role, side=side, index=index, x=x, width=width, warm=(index + side) % 3 != 0)
        if door_x is not None:
            add_nightjet_door(collection, root, cube, materials, prefix=role, side=side, x=door_x, low_floor=low_floor)

        # Original geometric identity marks: a long silver motion line and
        # small blue-white stars. These are not copied logos or wordmarks.
        common.add_box(collection, cube, f"{role}_motion_line_{side}", (7.4, 0.055, 0.055), (2.8, y + side * 0.027, 1.82), materials["light_body"], root, rotation=(0, -0.025, 0))
        for star_index, (x, z) in enumerate(((-7.2, 3.54), (-4.8, 1.76), (-1.2, 3.62), (4.6, 3.48), (7.7, 1.72))):
            if control and x < -6.8:
                continue
            common.add_box(collection, cube, f"{role}_star_{side}_{star_index}", (0.10, 0.066, 0.10), (x, y + side * 0.038, z), materials["star"], root, rotation=(0, 0.0, math.radians(45)))

    roof = coach_roof_mesh(f"{role}_roof_cap_mesh", control=control)
    common.link_object(collection, f"{role}_roof_cap", roof, parent=root, material=materials["roof"])
    common.add_box(collection, cube, f"{role}_underframe_spine", (COACH_LENGTH - 4.5, 1.72, 0.34), (0.28 if control else 0, 0, 0.57), materials["underframe"], root)
    for index, (x, width) in enumerate(((-6.5, 2.4), (-2.4, 2.7), (2.0, 2.3), (6.5, 2.8))):
        if control and x < -5.7:
            continue
        common.add_box(collection, cube, f"{role}_underfloor_equipment_{index}", (width, 1.46, 0.36), (x, 0, 0.55), materials["roof"], root)
    add_coach_roof_equipment(collection, root, cube, materials, prefix=role, dense=dense_roof)


def build_taurus(
    prototypes: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    collection = common.make_collection("Prototype_taurus_1116", prototypes)
    root = common.add_empty(collection, "nightjet_taurus_1116_root")
    root["vehicle_role"] = "locomotive"
    root["class"] = "ÖBB Class 1116 / ES64U2 Taurus 2"
    root["length_m"] = TAURUS_LENGTH
    sections = [
        (-9.64, 0.47, 0.62, -0.08), (-9.18, 0.72, 0.80, -0.02), (-8.20, 0.98, 0.97, 0),
        (-7.15, 1.0, 1.0, 0), (7.15, 1.0, 1.0, 0), (8.20, 0.98, 0.97, 0),
        (9.18, 0.72, 0.80, -0.02), (9.64, 0.47, 0.62, -0.08),
    ]
    shell = common.loft_mesh("nightjet_taurus_body_mesh", sections, common.TAURUS_PROFILE, materials["night_blue"])
    common.link_object(collection, "nightjet_taurus_lofted_body", shell, parent=root)
    common.add_box(collection, cube, "nightjet_taurus_underframe", (13.6, 2.18, 0.45), (0, 0, 0.79), materials["underframe"], root)
    common.add_box(collection, cube, "nightjet_taurus_roof_spine", (10.8, 2.22, 0.20), (0, 0, 4.34), materials["roof"], root)

    for side in (-1, 1):
        y = side * 1.515
        for cab_sign in (-1, 1):
            common.add_box(collection, cube, f"nightjet_taurus_side_window_{side}_{cab_sign}", (1.38, 0.064, 0.83), (cab_sign * 7.25, y + side * 0.035, 3.08), materials["glass"], root)
            common.add_box(collection, cube, f"nightjet_taurus_cab_door_{side}_{cab_sign}", (0.78, 0.06, 1.95), (cab_sign * 6.20, y + side * 0.02, 2.12), materials["night_blue"], root)
            common.add_box(collection, cube, f"nightjet_taurus_cab_door_window_{side}_{cab_sign}", (0.55, 0.068, 0.62), (cab_sign * 6.20, y + side * 0.055, 2.75), materials["glass"], root)
        for vent_index in range(6):
            x = -3.6 + vent_index * 1.42
            common.add_box(collection, cube, f"nightjet_taurus_vent_{side}_{vent_index}", (0.92, 0.065, 0.62), (x, y + side * 0.04, 2.88), materials["dark_blue"], root)
        common.add_box(collection, cube, f"nightjet_taurus_red_stripe_{side}", (14.4, 0.06, 0.17), (0, y + side * 0.07, 2.02), materials["signal_red"], root)
        grey_swoosh = common.polygon_mesh(
            f"nightjet_taurus_grey_swoosh_{side}_mesh",
            [(-7.1, y + side * 0.077, 1.58), (7.15, y + side * 0.077, 1.18), (7.15, y + side * 0.077, 1.48), (-7.1, y + side * 0.077, 1.93)],
            materials["light_body"],
        )
        common.link_object(collection, f"nightjet_taurus_grey_swoosh_{side}", grey_swoosh, parent=root)
        red_swoosh = common.polygon_mesh(
            f"nightjet_taurus_red_swoosh_{side}_mesh",
            [(-7.1, y + side * 0.082, 1.93), (6.8, y + side * 0.082, 1.48), (7.15, y + side * 0.082, 1.67), (-7.1, y + side * 0.082, 2.14)],
            materials["signal_red"],
        )
        common.link_object(collection, f"nightjet_taurus_red_swoosh_{side}", red_swoosh, parent=root)
        for star_index, (x, z) in enumerate(((-5.2, 3.52), (-3.4, 1.62), (-0.8, 3.64), (2.4, 1.52), (4.9, 3.47))):
            common.add_box(collection, cube, f"nightjet_taurus_star_{side}_{star_index}", (0.11, 0.07, 0.11), (x, y + side * 0.09, z), materials["star"], root, rotation=(0, 0, math.radians(45)))

    for front_sign in (-1, 1):
        prefix = f"nightjet_taurus_cab_{front_sign}"
        common.add_cab_glazing(collection, root, materials, front_sign=front_sign, half_length=TAURUS_LENGTH / 2, prefix=prefix, wide=True)
        common.add_headlights(collection, root, cube, materials, front_sign=front_sign, half_length=TAURUS_LENGTH / 2, prefix=prefix)
        common.add_box(collection, cube, f"{prefix}_plough", (0.42, 2.0, 0.34), (front_sign * 9.42, 0, 0.54), materials["anthracite"], root, rotation=(0, front_sign * -0.10, 0))

    common.add_bogie(collection, root, cube, cylinder, materials, name="nightjet_taurus_bogie_a", x=-4.95, axle_spacing=3.0, wheel_radius=0.575, bogie_width=2.04)
    common.add_bogie(collection, root, cube, cylinder, materials, name="nightjet_taurus_bogie_b", x=4.95, axle_spacing=3.0, wheel_radius=0.575, bogie_width=2.04)
    common.add_pantograph(collection, root, cube, cylinder, materials, x=-2.25, raised=True, prefix="nightjet_taurus_panto_raised")
    common.add_pantograph(collection, root, cube, cylinder, materials, x=2.55, raised=False, prefix="nightjet_taurus_panto_folded")
    for index, x in enumerate((-5.0, 0.0, 5.0)):
        common.add_box(collection, cube, f"nightjet_taurus_roof_cabinet_{index}", (2.15, 1.42, 0.30), (x, 0, 4.52), materials["steel"], root)
    common.add_beam_between(collection, cube, "nightjet_taurus_roof_bus", (-5.6, 0.0, 4.82), (5.7, 0.0, 4.82), 0.055, materials["steel"], root)
    common.add_metric_contract(collection, root)
    return root


def build_coach(
    prototypes: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    role: str,
    windows: tuple[float, ...],
    door_x: float | None,
    low_floor: bool,
    dense_roof: bool = False,
) -> bpy.types.Object:
    collection = common.make_collection(f"Prototype_{role}", prototypes)
    root = common.add_empty(collection, f"nightjet_{role}_root")
    root["vehicle_role"] = role
    root["length_m"] = COACH_LENGTH
    sections = [
        (-COACH_LENGTH / 2, 0.94, 0.98, 0), (-COACH_LENGTH / 2 + 0.35, 1.0, 1.0, 0),
        (COACH_LENGTH / 2 - 0.35, 1.0, 1.0, 0), (COACH_LENGTH / 2, 0.94, 0.98, 0),
    ]
    shell = common.loft_mesh(f"nightjet_{role}_body_mesh", sections, COACH_PROFILE, materials["night_blue"])
    common.link_object(collection, f"nightjet_{role}_lofted_body", shell, parent=root)
    add_nightjet_side_livery(collection, root, cube, materials, role=role, windows=windows, door_x=door_x, low_floor=low_floor, dense_roof=dense_roof)
    common.add_gangways(collection, root, cube, materials, COACH_LENGTH)
    common.add_bogie(collection, root, cube, cylinder, materials, name=f"{role}_bogie_a", x=-9.45, axle_spacing=2.5, wheel_radius=0.46, bogie_width=1.92)
    common.add_bogie(collection, root, cube, cylinder, materials, name=f"{role}_bogie_b", x=9.45, axle_spacing=2.5, wheel_radius=0.46, bogie_width=1.92)
    common.add_metric_contract(collection, root)
    return root


def build_control_car(
    prototypes: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    role = "control_seat_car"
    collection = common.make_collection("Prototype_control_seat_car", prototypes)
    root = common.add_empty(collection, "nightjet_control_seat_car_root")
    root["vehicle_role"] = role
    root["length_m"] = COACH_LENGTH
    half = COACH_LENGTH / 2
    sections = [
        (-half, 0.42, 0.58, -0.05), (-half + 0.40, 0.62, 0.76, -0.02),
        (-half + 1.10, 0.82, 0.90, 0), (-half + 2.10, 0.96, 0.98, 0),
        (-half + 3.15, 1.0, 1.0, 0), (half - 0.35, 1.0, 1.0, 0), (half, 0.94, 0.98, 0),
    ]
    shell = common.loft_mesh("nightjet_control_body_mesh", sections, COACH_PROFILE, materials["night_blue"])
    common.link_object(collection, "nightjet_control_lofted_body", shell, parent=root)
    add_nightjet_side_livery(
        collection, root, cube, materials,
        role=role,
        windows=(-7.0, -5.2, -3.3, -1.4, 0.5, 2.4, 4.3, 6.2, 8.1, 9.8),
        door_x=-8.65,
        low_floor=True,
        control=True,
        dense_roof=False,
    )
    common.add_gangways(collection, root, cube, materials, COACH_LENGTH, nose_negative=True)
    common.add_bogie(collection, root, cube, cylinder, materials, name="control_car_bogie_a", x=-9.15, axle_spacing=2.5, wheel_radius=0.46, bogie_width=1.92)
    common.add_bogie(collection, root, cube, cylinder, materials, name="control_car_bogie_b", x=9.45, axle_spacing=2.5, wheel_radius=0.46, bogie_width=1.92)
    common.add_cab_glazing(collection, root, materials, front_sign=-1, half_length=half, prefix="nightjet_control_cab", wide=True)
    common.add_headlights(collection, root, cube, materials, front_sign=-1, half_length=half, prefix="nightjet_control_cab")
    for side in (-1, 1):
        y = side * 1.44
        common.add_box(collection, cube, f"nightjet_control_side_cab_window_{side}", (1.52, 0.072, 0.83), (-10.55, y, 3.10), materials["glass"], root)
        swoosh = common.polygon_mesh(
            f"nightjet_control_red_swoosh_{side}_mesh",
            [(-12.8, y + side * 0.03, 1.16), (-8.7, y + side * 0.03, 1.55), (-4.6, y + side * 0.03, 2.18), (-8.8, y + side * 0.03, 2.18)],
            materials["signal_red"],
        )
        common.link_object(collection, f"nightjet_control_red_swoosh_{side}", swoosh, parent=root)
    # Vectron-inspired cab details visible in the supplied model references.
    for grille_index in range(3):
        common.add_box(collection, cube, f"nightjet_control_front_grille_{grille_index}", (0.10, 1.55, 0.10), (-half - 0.025, 0, 1.82 + grille_index * 0.18), materials["anthracite"], root)
    common.add_box(collection, cube, "nightjet_control_front_apron", (0.50, 2.10, 0.45), (-half + 0.12, 0, 0.60), materials["anthracite"], root, rotation=(0, 0.09, 0))
    common.add_metric_contract(collection, root)
    return root


def build_formation(
    prototypes: dict[str, bpy.types.Object],
    assets: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    collection = common.make_collection("Nightjet_New_Generation_Formation", assets)
    root = common.add_empty(collection, "nightjet_new_generation_blender_root")
    root["formation"] = "ÖBB Nightjet new generation with Taurus 1116"
    root["vehicle_count"] = 8
    root["length_m"] = round(FORMATION_LENGTH, 3)
    root["coach_set"] = "2 seating + 3 couchette + 2 sleeping"
    root["approval_status"] = "private review only"
    root["production_train_id"] = "nightjet"
    for index, source in enumerate(OFFICIAL_SOURCES):
        root[f"source_{index + 1}"] = source
    common.add_metric_contract(collection, root, add_anchor=True)

    consist = [
        "taurus_1116",
        "sleeping_a",
        "sleeping_b",
        "couchette",
        "couchette",
        "couchette",
        "multifunction",
        "control_seat_car",
    ]
    cursor = FORMATION_LENGTH / 2
    for index, role in enumerate(consist):
        length = TAURUS_LENGTH if role == "taurus_1116" else COACH_LENGTH
        center = cursor - length / 2
        instance = common.duplicate_hierarchy(prototypes[role], collection, root, f"vehicle_{index:02d}_{role}")
        instance.location.x = center
        instance["formation_index"] = index
        instance["role"] = role
        instance["length_m"] = length
        cursor -= length
        if index < len(consist) - 1:
            gap_center = cursor - FORMATION_GAP / 2
            common.add_box(collection, cube, f"intervehicle_coupler_{index:02d}", (0.54, 0.22, 0.18), (gap_center, 0, 0.84), materials["underframe"], root)
            cursor -= FORMATION_GAP
    return root


def main() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    common.reset_scene()
    materials = make_materials()
    cube = common.unit_cube_mesh()
    cylinder = common.unit_cylinder_mesh(16)
    assets = common.make_collection("Nightjet_New_Generation_Blender_Assets")
    prototypes_collection = common.make_collection("Nightjet_New_Generation_Prototypes", assets)

    prototypes: dict[str, bpy.types.Object] = {
        "taurus_1116": build_taurus(prototypes_collection, cube, cylinder, materials),
        "sleeping_a": build_coach(
            prototypes_collection, cube, cylinder, materials,
            role="sleeping_a", windows=(-9.0, -7.2, -5.4, -3.6, -1.8, 0.0, 1.8, 3.6, 5.4, 7.2, 9.0),
            door_x=10.65, low_floor=False,
        ),
        "sleeping_b": build_coach(
            prototypes_collection, cube, cylinder, materials,
            role="sleeping_b", windows=(-9.1, -7.1, -5.1, -3.1, -1.1, 0.9, 2.9, 4.9, 6.9, 8.9),
            door_x=-10.65, low_floor=False,
        ),
        "couchette": build_coach(
            prototypes_collection, cube, cylinder, materials,
            role="couchette", windows=(-9.0, -7.2, -5.4, -3.6, -1.8, 0.0, 1.8, 3.6, 5.4, 7.2, 9.0),
            door_x=10.65, low_floor=False,
        ),
        "multifunction": build_coach(
            prototypes_collection, cube, cylinder, materials,
            role="multifunction", windows=(-9.2, -7.8, -5.7, -2.8, 0.2, 3.4, 6.2, 8.5),
            door_x=-9.6, low_floor=True, dense_roof=True,
        ),
        "control_seat_car": build_control_car(prototypes_collection, cube, cylinder, materials),
    }

    module_paths: dict[str, str] = {}
    for role, vehicle_root in prototypes.items():
        path = OUTPUT_DIR / f"nightjet-new-generation-{role.replace('_', '-')}.glb"
        common.export_glb(vehicle_root, path)
        module_paths[role] = str(path.relative_to(PROJECT_ROOT))

    formation_root = build_formation(prototypes, assets, cube, materials)
    formation_path = OUTPUT_DIR / "nightjet-new-generation-blender.glb"
    common.export_glb(formation_root, formation_path)
    common.add_review_environment(assets, formation_root, cube, materials)
    prototypes_collection.hide_viewport = True
    prototypes_collection.hide_render = True
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER_PATH), compress=True)

    manifest = {
        "schemaVersion": 1,
        "generator": "Blender 5.2 LTS Python API",
        "candidateId": "nightjet-new-generation-taurus-1116",
        "approvalStatus": "private-review",
        "formation": "ÖBB Nightjet new generation with Taurus 1116",
        "lengthMeters": round(FORMATION_LENGTH, 3),
        "vehicleCount": 8,
        "consist": ["taurus-1116", "sleeping-a", "sleeping-b", "couchette", "couchette", "couchette", "multifunction", "control-seat-car"],
        "sevenCarCoachSet": ["control-seat-car", "multifunction", "couchette", "couchette", "couchette", "sleeping-a", "sleeping-b"],
        "vehicleDimensionsMeters": {
            "taurus1116": {"length": TAURUS_LENGTH, "width": TAURUS_WIDTH, "height": TAURUS_HEIGHT},
            "viaggioNextLevelCoach": {"length": COACH_LENGTH, "width": COACH_WIDTH, "height": COACH_HEIGHT},
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
            "traction": "electric",
            "pantographContactHeightMeters": PANTOGRAPH_CONTACT_HEIGHT_METERS,
            "calibrationTrackExported": False,
        },
        "userReferenceFilenames": list(USER_REFERENCE_FILENAMES),
        "referencePolicy": "Research only. Local images are not copied, embedded, textured, or shipped.",
        "sources": list(OFFICIAL_SOURCES),
        "productionRegistryModified": False,
    }
    (SOURCE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("CORNER_RAILS_NIGHTJET_NEW_GENERATION_GENERATED")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
