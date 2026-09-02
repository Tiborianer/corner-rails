"""Generate the complete approval-gated DB ICE 3 Class 403 V2 formation.

The approved checkpoint-7 cab is reused without changing its recognition
geometry. Seven matching vehicles are added around the same physical and
material contract, then exported as modular GLBs and one eight-car formation.

Physical contract before glTF export:
  * metres
  * X = train forward
  * Y = lateral
  * Z = height above wheel/rail contact
  * standard gauge = 1.435 m
  * wheel bottoms = Z 0
"""

from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path
from typing import Sequence

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CAB_SCRIPT = Path(__file__).with_name("generate_ice3_br403_v2.py")
SPEC = importlib.util.spec_from_file_location("corner_rails_ice3_v2_cab", CAB_SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Could not load approved ICE 3 V2 cab generator: {CAB_SCRIPT}")
cab = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cab)
common = cab.common

SOURCE_DIR = PROJECT_ROOT / "assets" / "blender" / "ice3-br403-v2"
OUTPUT_DIR = PROJECT_ROOT / "public" / "models" / "train-lab" / "ice3-br403-v2"
MASTER_PATH = SOURCE_DIR / "ice3-br403-v2-master.blend"
FORMATION_PATH = OUTPUT_DIR / "ice3-br403-v2-blender.glb"

END_CAR_LENGTH = cab.END_CAR_LENGTH
MIDDLE_CAR_LENGTH = 24.775
FORMATION_LENGTH = 2 * END_CAR_LENGTH + 6 * MIDDLE_CAR_LENGTH
STANDARD_GAUGE_METERS = cab.STANDARD_GAUGE_METERS
WHEEL_TREAD_CENTER_METERS = cab.WHEEL_TREAD_CENTER_METERS
PANTOGRAPH_CONTACT_HEIGHT_METERS = cab.PANTOGRAPH_CONTACT_HEIGHT_METERS

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

# This is the full-width equivalent of the approved cab's straight rear body
# section. It preserves the same floor, shoulder and roof crown dimensions.
COACH_PROFILE = (
    (-1.17, 0.68), (-1.40, 0.80), (-1.465, 1.02), (-1.475, 1.20),
    (-1.475, 3.18), (-1.425, 3.40), (-1.285, 3.61), (-1.03, 3.76),
    (-0.65, 3.86), (0.0, 3.89),
    (0.65, 3.86), (1.03, 3.76), (1.285, 3.61), (1.425, 3.40),
    (1.475, 3.18), (1.475, 1.20), (1.465, 1.02), (1.40, 0.80), (1.17, 0.68),
)

STANDARD_WINDOWS = (
    -8.75, -7.05, -5.35, -3.65, -1.95, -0.25,
    1.45, 3.15, 4.85, 6.55, 8.25,
)
CONVERTER_WINDOWS = (
    -8.80, -7.20, -5.60, -4.00, -2.40, -0.80,
    0.80, 2.40, 4.00, 5.60, 7.20, 8.80,
)
SERVICE_WINDOWS = (-8.75, -7.05, -5.35, -3.65, -1.85, 1.60, 3.35, 5.10, 6.85, 8.60)
RESTAURANT_DINING_WINDOWS = (-8.70, -6.82, -4.94, -3.06, -1.18)
RESTAURANT_SERVICE_WINDOWS = (4.05, 5.78, 7.51, 9.00)


def add_beveled_box(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    name: str,
    dimensions: Sequence[float],
    location: Sequence[float],
    material: bpy.types.Material,
    root: bpy.types.Object,
    *,
    bevel: float = 0.07,
) -> bpy.types.Object:
    obj = common.add_box(collection, cube, name, dimensions, location, material, root)
    modifier = obj.modifiers.new(f"{name}_soft_edges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 2
    return obj


def add_side_polygon(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    name: str,
    points: Sequence[tuple[float, float]],
    material: bpy.types.Material,
    *,
    y: float,
) -> None:
    cab.add_side_panel(collection, root, name, points, y, material)


def add_middle_shell(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    role: str,
    materials: dict[str, bpy.types.Material],
) -> None:
    half = MIDDLE_CAR_LENGTH / 2 - 0.05
    mesh = common.loft_mesh(
        f"ice3_v2_{role}_matching_shell_mesh",
        ((-half, 1.0, 1.0, 0.0), (0.0, 1.0, 1.0, 0.0), (half, 1.0, 1.0, 0.0)),
        COACH_PROFILE,
        materials["ice_white"],
    )
    # The cross-section already contains enough points for the approved soft
    # roof and shoulder. Subdivision would pull the closed gangway ends toward
    # the centre and make every middle car look pointed, so keep the metric
    # end faces flat while retaining smooth shading along the body.
    common.link_object(collection, f"ice3_v2_{role}_matching_shell", mesh, parent=root)


def add_middle_doors(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    role: str,
    materials: dict[str, bpy.types.Material],
) -> None:
    for door_index, center_x in enumerate((-10.62, 10.62)):
        center_z = 2.03
        seal = cab.rounded_rectangle_points(center_x, center_z, 1.13, 2.34, 0.11, 4)
        leaf = cab.rounded_rectangle_points(center_x, center_z, 1.02, 2.24, 0.085, 4)
        window = cab.rounded_rectangle_points(center_x, 2.53, 0.40, 0.91, 0.12, 5)
        handle_x = center_x + (-0.34 if center_x > 0 else 0.34)
        handle = cab.rounded_rectangle_points(handle_x, 1.64, 0.055, 0.28, 0.022, 3)
        add_side_polygon(collection, root, f"ice3_v2_{role}_door_seal_{door_index}", seal, materials["seal"], y=1.487)
        add_side_polygon(collection, root, f"ice3_v2_{role}_door_leaf_{door_index}", leaf, materials["ice_white"], y=1.492)
        add_side_polygon(collection, root, f"ice3_v2_{role}_door_window_{door_index}", window, materials["glass"], y=1.497)
        add_side_polygon(collection, root, f"ice3_v2_{role}_door_handle_{door_index}", handle, materials["seal"], y=1.501)


def window_spec(center: float, width: float = 1.18, height: float = 0.52) -> tuple[float, float, float]:
    return (center, width, height)


def add_windows_for_side(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    role: str,
    side: int,
    specs: Sequence[tuple[float, float, float]],
    materials: dict[str, bpy.types.Material],
    *,
    warm: bool = False,
) -> None:
    for index, (center_x, width, height) in enumerate(specs):
        seal_points = cab.rounded_rectangle_points(center_x, 2.48, width + 0.11, height + 0.10, 0.12, 5)
        glass_points = cab.rounded_rectangle_points(center_x, 2.48, width, height, 0.10, 6)
        seal_mesh = cab.side_polygon_mesh(
            f"ice3_v2_{role}_window_seal_mesh_{side}_{index:02d}", seal_points, side, 1.487, materials["seal"]
        )
        glass_mesh = cab.side_polygon_mesh(
            f"ice3_v2_{role}_window_glass_mesh_{side}_{index:02d}",
            glass_points,
            side,
            1.493,
            materials["restaurant_glass"] if warm else materials["glass_inner"],
        )
        common.link_object(collection, f"ice3_v2_{role}_window_seal_{side}_{index:02d}", seal_mesh, parent=root)
        common.link_object(collection, f"ice3_v2_{role}_window_glass_{side}_{index:02d}", glass_mesh, parent=root)


def add_middle_glazing(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    role: str,
    materials: dict[str, bpy.types.Material],
) -> None:
    if role == "bordrestaurant_403_3":
        dining = tuple(window_spec(x, 1.52, 0.58) for x in RESTAURANT_DINING_WINDOWS)
        service = tuple(window_spec(x, 1.18, 0.50) for x in RESTAURANT_SERVICE_WINDOWS)
        add_windows_for_side(collection, root, role, 1, dining + service, materials, warm=True)
        # The galley side has fewer openings and a visibly different rhythm.
        galley = tuple(window_spec(x, 1.22, 0.50) for x in (-8.75, -6.90, -5.05, -3.20, 4.20, 6.15, 8.10))
        add_windows_for_side(collection, root, role, -1, galley, materials, warm=True)
        for side in (-1, 1):
            add_beveled_box(
                collection,
                common.unit_cube_mesh(),
                f"ice3_v2_{role}_galley_service_panel_{side}",
                (3.10, 0.045, 0.50),
                (1.15, side * 1.493, 2.48),
                materials["ice_white"],
                root,
                bevel=0.05,
            )
        return

    if role == "service_403_8":
        positions = SERVICE_WINDOWS
    elif "converter" in role:
        positions = CONVERTER_WINDOWS
    else:
        positions = STANDARD_WINDOWS
    specs = tuple(window_spec(x) for x in positions)
    add_windows_for_side(collection, root, role, 1, specs, materials)
    add_windows_for_side(collection, root, role, -1, specs, materials)


def add_middle_stripe(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    role: str,
    materials: dict[str, bpy.types.Material],
) -> None:
    points = cab.rounded_rectangle_points(0.0, 1.94, MIDDLE_CAR_LENGTH - 0.20, 0.13, 0.035, 4)
    add_side_polygon(collection, root, f"ice3_v2_{role}_continuous_red_stripe", points, materials["ice_red"], y=1.505)


def add_middle_running_gear(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    role: str,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    powered: bool,
    transformer: bool,
    batteries: bool,
) -> None:
    for index, x in enumerate((-8.66, 8.66)):
        common.add_bogie(
            collection,
            root,
            cube,
            cylinder,
            materials,
            name=f"ice3_v2_{role}_bogie_{index}",
            x=x,
            axle_spacing=2.50,
            wheel_radius=0.46,
            bogie_width=2.02,
        )
    common.add_box(collection, cube, f"ice3_v2_{role}_underframe_spine", (22.9, 1.92, 0.20), (0, 0, 0.80), materials["underframe"], root)
    for index, x in enumerate((-8.0, -5.35, -2.70, 0.0, 2.70, 5.35, 8.0)):
        add_beveled_box(
            collection,
            cube,
            f"ice3_v2_{role}_underbody_fairing_{index}",
            (2.35, 2.42, 0.50),
            (x, 0, 0.94),
            materials["fairing"],
            root,
            bevel=0.09,
        )
    if powered:
        for index, x in enumerate((-5.1, -1.7, 1.7, 5.1)):
            common.add_box(
                collection,
                cube,
                f"ice3_v2_{role}_traction_converter_{index}",
                (2.30, 1.78, 0.38),
                (x, 0, 0.69),
                materials["underframe"],
                root,
            )
    if transformer:
        common.add_box(collection, cube, f"ice3_v2_{role}_transformer_tank", (5.10, 1.82, 0.42), (0.2, 0, 0.68), materials["underframe"], root)
    if batteries:
        for side in (-1, 1):
            common.add_box(collection, cube, f"ice3_v2_{role}_battery_box_{side}", (3.20, 0.64, 0.38), (0, side * 0.58, 0.69), materials["underframe"], root)


def add_gangways(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    role: str,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    half = MIDDLE_CAR_LENGTH / 2
    for side in (-1, 1):
        x = side * (half - 0.02)
        add_beveled_box(
            collection,
            cube,
            f"ice3_v2_{role}_double_bellows_{side}",
            (0.18, 1.34, 2.34),
            (x, 0, 2.02),
            materials["underframe"],
            root,
            bevel=0.07,
        )
        common.add_box(
            collection,
            cube,
            f"ice3_v2_{role}_coupler_{side}",
            (0.42, 0.22, 0.18),
            (x + side * 0.17, 0, 0.72),
            materials["underframe"],
            root,
        )


def add_pantograph(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    role: str,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    raised: bool,
) -> None:
    base_x = 1.90
    for index, (x, y) in enumerate(((-0.66, -0.48), (-0.66, 0.48), (0.66, -0.48), (0.66, 0.48))):
        common.add_cylinder(
            collection,
            cylinder,
            f"ice3_v2_{role}_pantograph_insulator_{index}",
            0.085,
            0.20,
            (base_x + x, y, 4.00),
            materials["roof"],
            root,
        )
    add_beveled_box(
        collection,
        cube,
        f"ice3_v2_{role}_pantograph_base",
        (1.78, 1.08, 0.10),
        (base_x, 0, 4.08),
        materials["underframe"],
        root,
        bevel=0.05,
    )
    top_z = PANTOGRAPH_CONTACT_HEIGHT_METERS if raised else 4.38
    lower_z = 4.13
    knee_z = 4.82 if raised else 4.27
    for suffix, start, end in (
        ("arm_a", (base_x - 0.67, -0.34, lower_z), (base_x + 0.03, -0.18, knee_z)),
        ("arm_b", (base_x + 0.03, -0.18, knee_z), (base_x + 0.70, 0, top_z - 0.04)),
        ("arm_c", (base_x + 0.67, 0.34, lower_z), (base_x - 0.03, 0.18, knee_z)),
        ("arm_d", (base_x - 0.03, 0.18, knee_z), (base_x - 0.70, 0, top_z - 0.04)),
    ):
        common.add_beam_between(collection, cube, f"ice3_v2_{role}_{suffix}", start, end, 0.055, materials["pantograph"], root)
    common.add_box(
        collection,
        cube,
        f"ice3_v2_{role}_pantograph_collector",
        (1.76, 0.07, 0.055),
        (base_x, 0, top_z),
        materials["steel"],
        root,
    )


def add_middle_roof(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    role: str,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    powered: bool,
    transformer: bool,
    pantograph_raised: bool,
) -> None:
    for index, (x, length) in enumerate(((-8.0, 2.4), (-4.9, 2.6), (-1.7, 2.4), (5.2, 2.6), (8.2, 2.2))):
        add_beveled_box(
            collection,
            cube,
            f"ice3_v2_{role}_roof_fairing_{index}",
            (length, 1.28, 0.105),
            (x, 0, 3.955),
            materials["roof"],
            root,
            bevel=0.06,
        )
    if powered:
        for index, x in enumerate((-3.4, 0.0, 3.4)):
            add_beveled_box(
                collection,
                cube,
                f"ice3_v2_{role}_roof_power_cabinet_{index}",
                (2.35, 1.40, 0.14),
                (x, 0, 3.985),
                materials["roof"],
                root,
                bevel=0.07,
            )
    if role == "bordrestaurant_403_3":
        add_beveled_box(
            collection,
            cube,
            f"ice3_v2_{role}_kitchen_hvac",
            (5.30, 1.56, 0.18),
            (2.1, 0, 4.00),
            materials["roof"],
            root,
            bevel=0.08,
        )
    if transformer:
        add_beveled_box(
            collection,
            cube,
            f"ice3_v2_{role}_transformer_roof_cabinet",
            (7.60, 1.56, 0.16),
            (-1.4, 0, 3.99),
            materials["roof"],
            root,
            bevel=0.07,
        )
        add_pantograph(collection, root, role, cube, cylinder, materials, raised=pantograph_raised)


def build_middle_vehicle(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    role: str,
    powered: bool = False,
    transformer: bool = False,
    pantograph_raised: bool = False,
    first_class: bool = False,
    batteries: bool = False,
) -> bpy.types.Object:
    root = common.add_empty(collection, f"ice3_v2_{role}_root")
    root["vehicle_role"] = role
    root["vehicle_class"] = role.rsplit("_", 2)[-2] + "." + role.rsplit("_", 1)[-1]
    root["length_m"] = MIDDLE_CAR_LENGTH
    root["class_403"] = True
    root["matches_approved_cab_checkpoint"] = 7
    root["production_registry_modified"] = False
    common.add_metric_contract(collection, root, add_anchor=True)

    add_middle_shell(collection, root, role, materials)
    add_middle_doors(collection, root, role, materials)
    add_middle_glazing(collection, root, role, materials)
    add_middle_stripe(collection, root, role, materials)
    add_middle_running_gear(
        collection,
        root,
        role,
        cube,
        cylinder,
        materials,
        powered=powered,
        transformer=transformer,
        batteries=batteries,
    )
    add_gangways(collection, root, role, cube, materials)
    add_middle_roof(
        collection,
        root,
        role,
        cube,
        cylinder,
        materials,
        powered=powered,
        transformer=transformer,
        pantograph_raised=pantograph_raised,
    )
    if first_class:
        for side in (-1, 1):
            common.add_box(
                collection,
                cube,
                f"ice3_v2_{role}_first_class_marker_{side}",
                (0.15, 0.04, 0.36),
                (-9.55, side * 1.503, 2.92),
                materials["marker"],
                root,
            )
    if role == "service_403_8":
        for side in (-1, 1):
            panel = cab.rounded_rectangle_points(-0.10, 1.56, 1.15, 0.48, 0.09, 5)
            mesh = cab.side_polygon_mesh(
                f"ice3_v2_{role}_accessible_service_panel_mesh_{side}", panel, side, 1.502, materials["service_blue"]
            )
            common.link_object(collection, f"ice3_v2_{role}_accessible_service_panel_{side}", mesh, parent=root)
    return root


def remove_first_class_markers(root: bpy.types.Object) -> None:
    for obj in list(cab.descendants(root)):
        if "first_class_marker" in obj.name:
            bpy.data.objects.remove(obj, do_unlink=True)


def configure_end_car(root: bpy.types.Object, *, role: str, second_end: bool) -> None:
    root.name = f"ice3_v2_{role}_root"
    root["candidate"] = "DB ICE 3 Class 403 V2 full formation"
    root["vehicle_role"] = role
    root["review_stage"] = "formation"
    root["cab_checkpoint_approved"] = 7
    root["production_registry_modified"] = False
    if second_end:
        remove_first_class_markers(root)
        root.rotation_euler.z = math.pi


def build_formation(
    prototypes: dict[str, bpy.types.Object],
    assets: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    collection = common.make_collection("ICE3_BR403_V2_Formation", assets)
    root = common.add_empty(collection, "ice3_br403_v2_blender_root")
    root["formation"] = "DB ICE 3 Class 403 V2 eight-car review candidate"
    root["vehicle_count"] = 8
    root["length_m"] = round(FORMATION_LENGTH, 3)
    root["approval_status"] = "private review only"
    root["review_stage"] = "formation"
    root["approved_cab_checkpoint"] = 7
    root["production_registry_modified"] = False
    root["bordrestaurant_vehicle"] = "vehicle_03_bordrestaurant_403_3"
    for index, source in enumerate(cab.OFFICIAL_SOURCES, start=1):
        root[f"source_{index}"] = source
    # The eight module prototypes already own their own contact anchors. Free the
    # canonical name before creating the formation-level contract so runtime
    # loaders can always resolve this exact, stable anchor without a Blender
    # numeric suffix.
    existing_contact_anchor = bpy.data.objects.get("rail_contact_origin")
    if existing_contact_anchor is not None:
        existing_contact_anchor.name = "prototype_rail_contact_origin"
    common.add_metric_contract(collection, root, add_anchor=True)

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
            common.add_box(
                collection,
                cube,
                f"ice3_v2_intervehicle_coupler_{index:02d}",
                (0.52, 0.20, 0.16),
                (cursor, 0, 0.72),
                materials["underframe"],
                root,
            )
    return root


def add_review_environment(
    assets: bpy.types.Collection,
    formation_root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    review = common.make_collection("ICE3_BR403_V2_Review_Environment_NOT_EXPORTED", assets)
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
    camera_data = bpy.data.cameras.new("ICE3_BR403_V2_Review_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 132
    camera = common.link_object(review, "ICE3_BR403_V2_Review_Camera", camera_data, location=(112, -126, 70))
    constraint = camera.constraints.new(type="TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    bpy.context.scene.camera = camera

    sun_data = bpy.data.lights.new("ICE3_BR403_V2_Review_Sun", type="SUN")
    sun_data.energy = 2.7
    sun_data.angle = math.radians(14)
    common.link_object(review, "ICE3_BR403_V2_Review_Sun", sun_data, rotation=(math.radians(38), 0, math.radians(-35)))
    area_data = bpy.data.lights.new("ICE3_BR403_V2_Review_Fill", type="AREA")
    area_data.energy = 3300
    area_data.shape = "RECTANGLE"
    area_data.size = 58
    common.link_object(review, "ICE3_BR403_V2_Review_Fill", area_data, location=(8, -28, 38))
    formation_root["review_tip"] = "Full V2 formation; production remains unchanged pending approval."


def write_manifest(module_paths: dict[str, str]) -> None:
    manifest = {
        "schemaVersion": 3,
        "generator": "Blender 5.2 LTS Python API",
        "candidateId": "ice3-br403-v2-formation",
        "approvalStatus": "private-review",
        "reviewStage": "formation",
        "productionRegistryModified": False,
        "targetFormation": "modernized DB ICE 3 Class 403 eight-car set",
        "cabApproval": {
            "checkpoint": 7,
            "status": "approved-for-formation-build",
            "approvedDate": "2026-08-23",
            "cabGeometryChangedByFormationBuild": False,
        },
        "vehicleCount": 8,
        "lengthMeters": round(FORMATION_LENGTH, 3),
        "consist": [role for role, _length in CONSIST],
        "vehicleDimensionsMeters": {
            "endCar": {"length": END_CAR_LENGTH, "width": cab.VEHICLE_WIDTH, "height": cab.VEHICLE_HEIGHT},
            "middleCar": {"length": MIDDLE_CAR_LENGTH, "width": cab.VEHICLE_WIDTH, "height": cab.VEHICLE_HEIGHT},
        },
        "roleDetails": {
            "403.0": "first-class powered end car with approved checkpoint-7 cab",
            "403.1": "first-class transformer car with raised 15 kV pantograph",
            "403.2": "powered converter car",
            "403.3": "Bordrestaurant middle car with dining and galley window rhythms",
            "403.8": "service middle car with accessible-service area",
            "403.7": "powered converter car",
            "403.6": "second-class transformer car with folded pantograph",
            "403.5": "second-class powered end car using the approved cab geometry in reverse orientation",
        },
        "bordrestaurant": {
            "vehicleIndex": 3,
            "class": "403.3",
            "redesignSeatCount": 20,
        },
        "masterBlend": str(MASTER_PATH.relative_to(PROJECT_ROOT)),
        "cabCheckpointGlb": str(cab.OUTPUT_PATH.relative_to(PROJECT_ROOT)),
        "formationGlb": str(FORMATION_PATH.relative_to(PROJECT_ROOT)),
        "moduleGlbs": module_paths,
        "calibration": {
            "knownDimensionsMeters": {
                "endCarLength": END_CAR_LENGTH,
                "middleCarLength": MIDDLE_CAR_LENGTH,
                "vehicleWidth": cab.VEHICLE_WIDTH,
                "vehicleHeight": cab.VEHICLE_HEIGHT,
            },
            "featureGuidesMeters": cab.CALIBRATION_GUIDES,
            "silhouetteTolerancePercent": 2.0,
            "method": "approved checkpoint-7 cab plus matching full-width middle-car section",
        },
        "hybridDetail": {
            "atlas": str(cab.ATLAS_PATH.relative_to(PROJECT_ROOT)),
            "dimensionsPixels": [2048, 512],
            "authorship": "original code-authored decal atlas",
            "containsPhotography": False,
            "containsProtectedLogos": False,
        },
        "assetContract": {
            "units": "meters",
            "forwardAxis": "+X",
            "lateralAxis": "+Y",
            "upAxis": "+Z",
            "standardGaugeMeters": STANDARD_GAUGE_METERS,
            "railContactPlaneZ": 0,
            "railContactAnchor": "rail_contact_origin",
            "wheelTreadCentersMeters": [-WHEEL_TREAD_CENTER_METERS, WHEEL_TREAD_CENTER_METERS],
            "traction": "distributed-electric",
            "pantographContactHeightMeters": PANTOGRAPH_CONTACT_HEIGHT_METERS,
            "calibrationTrackExported": False,
        },
        "recognitionFeatures": [
            "approved checkpoint-7 Class 403 cab geometry at both formation ends",
            "matching pearl-white body, rounded lower glazing, tall pressure-tight doors and low red stripe across all cars",
            "role-specific transformer, converter, battery and roof equipment",
            "distinct asymmetric 403.3 Bordrestaurant dining and galley window rhythm",
            "raised and folded transformer-car pantographs with 5.5 m raised contact height",
        ],
        "userReferenceFilenames": list(cab.USER_REFERENCES),
        "referencePolicy": "Research only. Local images are referenced by filename, not copied, packed, textured, embedded, or shipped.",
        "sources": list(cab.OFFICIAL_SOURCES),
        "nextApprovalGate": "Approve the complete eight-car V2 formation before changing the production ICE 3 registry.",
    }
    (SOURCE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    cab.ensure_directories()
    cab.reset_scene()
    materials = cab.make_materials()
    materials["restaurant_glass"] = common.make_material(
        "ICE3_V2_Restaurant_Warm_Glass", (0.115, 0.052, 0.018, 1), metallic=0.08, roughness=0.18
    )
    materials["pantograph"] = common.make_material(
        "ICE3_V2_Pantograph_Red", (0.56, 0.025, 0.025, 1), metallic=0.62, roughness=0.29
    )
    materials["service_blue"] = common.make_material(
        "ICE3_V2_Service_Blue", (0.035, 0.18, 0.26, 1), metallic=0.08, roughness=0.30
    )
    cube = common.unit_cube_mesh()
    cylinder = common.unit_cylinder_mesh(24)
    assets = common.make_collection("ICE3_BR403_V2_Blender_Assets")
    prototypes_collection = common.make_collection("ICE3_BR403_V2_Prototypes", assets)

    first_end = cab.build_cab_checkpoint(prototypes_collection, cube, cylinder, materials)
    configure_end_car(first_end, role="first_end_403_0", second_end=False)
    prototypes = {
        "first_end_403_0": first_end,
        "first_transformer_403_1": build_middle_vehicle(
            prototypes_collection,
            cube,
            cylinder,
            materials,
            role="first_transformer_403_1",
            transformer=True,
            pantograph_raised=True,
            first_class=True,
        ),
        "second_converter_403_2": build_middle_vehicle(
            prototypes_collection, cube, cylinder, materials, role="second_converter_403_2", powered=True
        ),
        "bordrestaurant_403_3": build_middle_vehicle(
            prototypes_collection, cube, cylinder, materials, role="bordrestaurant_403_3", batteries=True
        ),
        "service_403_8": build_middle_vehicle(
            prototypes_collection, cube, cylinder, materials, role="service_403_8", batteries=True
        ),
        "second_converter_403_7": build_middle_vehicle(
            prototypes_collection, cube, cylinder, materials, role="second_converter_403_7", powered=True
        ),
        "second_transformer_403_6": build_middle_vehicle(
            prototypes_collection,
            cube,
            cylinder,
            materials,
            role="second_transformer_403_6",
            transformer=True,
            pantograph_raised=False,
        ),
    }
    second_end = cab.build_cab_checkpoint(prototypes_collection, cube, cylinder, materials)
    configure_end_car(second_end, role="second_end_403_5", second_end=True)
    prototypes["second_end_403_5"] = second_end

    module_paths: dict[str, str] = {}
    for role, root in prototypes.items():
        module_path = OUTPUT_DIR / f"ice3-br403-v2-{role.replace('_', '-')}.glb"
        cab.export_glb(root, module_path)
        module_paths[role] = str(module_path.relative_to(PROJECT_ROOT))

    formation_root = build_formation(prototypes, assets, cube, materials)
    cab.export_glb(formation_root, FORMATION_PATH)
    add_review_environment(assets, formation_root, cube, materials)
    cab.add_reference_guides()
    prototypes_collection.hide_viewport = True
    prototypes_collection.hide_render = True
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER_PATH), compress=True)
    write_manifest(module_paths)
    print("CORNER_RAILS_ICE3_BR403_V2_FORMATION_GENERATED")


if __name__ == "__main__":
    main()
