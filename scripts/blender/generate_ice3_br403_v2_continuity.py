"""Generate the two-car ICE 3 Class 403 V2 continuity approval checkpoint.

This candidate deliberately leaves the existing V2 full formation untouched.
It rebuilds a 403.0 end car and its adjacent 403.1 transformer car from one
shared cross-section and one livery datum so the cab, body, glazing band and
red stripe read as a single train.

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
BASE_SCRIPT = Path(__file__).with_name("generate_ice3_br403_v2_formation.py")
SPEC = importlib.util.spec_from_file_location("corner_rails_ice3_v2_formation_base", BASE_SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Could not load ICE 3 V2 formation generator: {BASE_SCRIPT}")
base = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(base)
cab = base.cab
common = base.common

SOURCE_DIR = PROJECT_ROOT / "assets" / "blender" / "ice3-br403-v2-continuity"
OUTPUT_DIR = PROJECT_ROOT / "public" / "models" / "train-lab" / "ice3-br403-v2-continuity"
MASTER_PATH = SOURCE_DIR / "ice3-br403-v2-continuity-master.blend"
CHECKPOINT_PATH = OUTPUT_DIR / "ice3-br403-v2-continuity-checkpoint.glb"
END_MODULE_PATH = OUTPUT_DIR / "ice3-br403-v2-continuity-403-0.glb"
TRANSFORMER_MODULE_PATH = OUTPUT_DIR / "ice3-br403-v2-continuity-403-1.glb"

END_CAR_LENGTH = base.END_CAR_LENGTH
MIDDLE_CAR_LENGTH = base.MIDDLE_CAR_LENGTH
CHECKPOINT_LENGTH = END_CAR_LENGTH + MIDDLE_CAR_LENGTH
HALF_END = END_CAR_LENGTH / 2
HALF_MIDDLE = MIDDLE_CAR_LENGTH / 2
STANDARD_GAUGE_METERS = base.STANDARD_GAUGE_METERS
WHEEL_TREAD_CENTER_METERS = base.WHEEL_TREAD_CENTER_METERS
PANTOGRAPH_CONTACT_HEIGHT_METERS = base.PANTOGRAPH_CONTACT_HEIGHT_METERS

# One contract shared by the straight passenger body of both vehicles.
SHARED_BODY_PROFILE = tuple(base.COACH_PROFILE)
PROFILE_VERTEX_COUNT = len(SHARED_BODY_PROFILE)
BODY_HALF_WIDTH = 1.475
BODY_BOTTOM_Z = 0.68
BODY_SHOULDER_Z = 3.18
BODY_ROOF_Z = 3.89
BODY_STRIPE_CENTER_Z = 1.84
BODY_STRIPE_HEIGHT = 0.18
GLAZING_BAND_CENTER_Z = 2.48
GLAZING_BAND_HEIGHT = 0.74
GLAZING_BAND_RECESS_Y = 1.486
WINDOW_GLASS_Y = 1.493
BODY_SURFACE_Y = 1.475
JUNCTION_PROFILE_TOLERANCE_METERS = 0.001
LIVERY_JUNCTION_TOLERANCE_METERS = 0.002

END_WINDOW_SPECS = (
    (-10.40, 1.16), (-8.91, 1.16), (-7.42, 1.16), (-5.93, 1.16),
    (-4.44, 1.16), (-2.95, 1.16), (-1.46, 1.16), (0.03, 1.16),
    (1.52, 1.16), (2.78, 1.02),
)
TRANSFORMER_WINDOW_SPECS = tuple((x, 1.18) for x in base.STANDARD_WINDOWS)


def ensure_directories() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def transformed_profile(
    half_width: float,
    bottom: float,
    roof: float,
    shoulder: float,
) -> tuple[tuple[float, float], ...]:
    """Deform the shared profile while preserving vertex order and topology."""
    result: list[tuple[float, float]] = []
    for y, z in SHARED_BODY_PROFILE:
        mapped_y = y * half_width / BODY_HALF_WIDTH
        if z <= BODY_SHOULDER_Z:
            fraction = (z - BODY_BOTTOM_Z) / (BODY_SHOULDER_Z - BODY_BOTTOM_Z)
            mapped_z = bottom + fraction * (shoulder - bottom)
        else:
            fraction = (z - BODY_SHOULDER_Z) / (BODY_ROOF_Z - BODY_SHOULDER_Z)
            mapped_z = shoulder + fraction * (roof - shoulder)
        result.append((mapped_y, mapped_z))
    return tuple(result)


def unified_end_car_rings() -> tuple[tuple[float, tuple[tuple[float, float], ...]], ...]:
    rings: list[tuple[float, tuple[tuple[float, float], ...]]] = [
        (cab.REAR_SHELL_X, SHARED_BODY_PROFILE),
        (-8.0, SHARED_BODY_PROFILE),
        (-2.0, SHARED_BODY_PROFILE),
        (3.0, SHARED_BODY_PROFILE),
        (5.20, SHARED_BODY_PROFILE),
    ]
    controls = [station for station in cab.CAB_CONTROL_STATIONS if station[0] >= 5.20]
    for index in range(len(controls) - 1):
        left = controls[index]
        right = controls[index + 1]
        for step in range(1, 4):
            t = step / 3
            x = left[0] + (right[0] - left[0]) * t
            params = tuple(left[item] + (right[item] - left[item]) * t for item in range(1, 5))
            rings.append((x, transformed_profile(*params)))

    shell_profile = transformed_profile(*cab.station_parameters(cab.SHELL_HALF_LENGTH))
    shell_center = cab.NOSE_CAP_RINGS[0][3]
    for x, lateral_factor, vertical_factor, center_z in cab.NOSE_CAP_RINGS[1:]:
        profile = tuple(
            (y * lateral_factor, center_z + (z - shell_center) * vertical_factor)
            for y, z in shell_profile
        )
        rings.append((x, profile))
    return tuple(rings)


def loft_from_rings(
    name: str,
    rings: Sequence[tuple[float, Sequence[tuple[float, float]]]],
    material: bpy.types.Material,
) -> bpy.types.Mesh:
    if not rings or any(len(profile) != PROFILE_VERTEX_COUNT for _x, profile in rings):
        raise RuntimeError("ICE 3 continuity loft received an invalid shared profile")
    vertices = [(x, y, z) for x, profile in rings for y, z in profile]
    faces: list[tuple[int, ...]] = []
    for ring_index in range(len(rings) - 1):
        start = ring_index * PROFILE_VERTEX_COUNT
        following = (ring_index + 1) * PROFILE_VERTEX_COUNT
        for profile_index in range(PROFILE_VERTEX_COUNT):
            next_profile = (profile_index + 1) % PROFILE_VERTEX_COUNT
            faces.append((start + profile_index, following + profile_index, following + next_profile, start + next_profile))
    faces.append(tuple(reversed(range(PROFILE_VERTEX_COUNT))))
    final_start = (len(rings) - 1) * PROFILE_VERTEX_COUNT
    faces.append(tuple(final_start + index for index in range(PROFILE_VERTEX_COUNT)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return mesh


def add_shared_end_shell(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    material: bpy.types.Material,
) -> bpy.types.Object:
    mesh = loft_from_rings("ice3_continuity_unified_end_shell_mesh", unified_end_car_rings(), material)
    return common.link_object(collection, "ice3_v2_reference_calibrated_cab_shell", mesh, parent=root)


def add_shared_middle_shell(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    material: bpy.types.Material,
) -> bpy.types.Object:
    half = HALF_MIDDLE - 0.05
    mesh = loft_from_rings(
        "ice3_continuity_shared_transformer_shell_mesh",
        ((-half, SHARED_BODY_PROFILE), (0.0, SHARED_BODY_PROFILE), (half, SHARED_BODY_PROFILE)),
        material,
    )
    return common.link_object(collection, "ice3_continuity_shared_transformer_shell", mesh, parent=root)


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


def add_continuous_glazing_band(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    prefix: str,
    x_min: float,
    x_max: float,
    materials: dict[str, bpy.types.Material],
) -> None:
    points = cab.rounded_rectangle_points(
        (x_min + x_max) / 2,
        GLAZING_BAND_CENTER_Z,
        x_max - x_min,
        GLAZING_BAND_HEIGHT,
        0.15,
        7,
    )
    add_side_polygon(
        collection,
        root,
        f"{prefix}_continuous_black_glazing_band",
        points,
        materials["seal"],
        y=GLAZING_BAND_RECESS_Y,
    )


def add_inset_windows(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    prefix: str,
    specs: Sequence[tuple[float, float]],
    materials: dict[str, bpy.types.Material],
) -> None:
    for index, (center_x, width) in enumerate(specs):
        points = cab.rounded_rectangle_points(center_x, GLAZING_BAND_CENTER_Z, width, 0.54, 0.09, 7)
        add_side_polygon(
            collection,
            root,
            f"{prefix}_inset_window_{index:02d}",
            points,
            materials["glass_inner"],
            y=WINDOW_GLASS_Y,
        )


def add_pressure_tight_door(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    prefix: str,
    center_x: float,
    materials: dict[str, bpy.types.Material],
) -> None:
    center_z = 2.03
    seal = cab.rounded_rectangle_points(center_x, center_z, 1.13, 2.34, 0.11, 5)
    leaf = cab.rounded_rectangle_points(center_x, center_z, 1.02, 2.24, 0.085, 5)
    window = cab.rounded_rectangle_points(center_x, 2.53, 0.40, 0.91, 0.12, 7)
    handle_x = center_x + (0.34 if center_x < 0 else -0.34)
    handle = cab.rounded_rectangle_points(handle_x, 1.64, 0.055, 0.28, 0.022, 4)
    add_side_polygon(collection, root, f"{prefix}_door_seal", seal, materials["seal"], y=1.487)
    add_side_polygon(collection, root, f"{prefix}_door_leaf", leaf, materials["ice_white"], y=1.492)
    add_side_polygon(collection, root, f"{prefix}_door_window", window, materials["glass"], y=1.497)
    add_side_polygon(collection, root, f"{prefix}_door_handle", handle, materials["seal"], y=1.501)


def add_body_stripe(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    prefix: str,
    x_min: float,
    x_max: float,
    materials: dict[str, bpy.types.Material],
) -> None:
    points = cab.rounded_rectangle_points(
        (x_min + x_max) / 2,
        BODY_STRIPE_CENTER_Z,
        x_max - x_min,
        BODY_STRIPE_HEIGHT,
        0.04,
        5,
    )
    add_side_polygon(collection, root, f"{prefix}_shared_red_body_stripe", points, materials["ice_red"], y=1.505)


def add_integrated_nose_stripe(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> None:
    centerline = (
        (5.20, BODY_STRIPE_CENTER_Z, BODY_STRIPE_HEIGHT / 2),
        (5.80, 1.84, 0.090), (6.50, 1.82, 0.088), (7.20, 1.76, 0.085),
        (8.00, 1.67, 0.080), (8.80, 1.54, 0.074), (9.60, 1.39, 0.067),
        (10.40, 1.24, 0.060), (11.20, 1.12, 0.052), (11.90, 1.07, 0.046),
        (12.35, 1.055, 0.040), (cab.HALF_LENGTH, 1.05, 0.034),
    )

    def cap_factors(x: float) -> tuple[float, float]:
        if x <= cab.SHELL_HALF_LENGTH:
            return (1.0, 1.0)
        rings = cab.NOSE_CAP_RINGS
        for index in range(len(rings) - 1):
            left = rings[index]
            right = rings[index + 1]
            if left[0] <= x <= right[0]:
                t = (x - left[0]) / (right[0] - left[0])
                return (
                    left[1] + (right[1] - left[1]) * t,
                    left[2] + (right[2] - left[2]) * t,
                )
        return (rings[-1][1], rings[-1][2])

    for side in (-1, 1):
        lower: list[tuple[float, float, float]] = []
        upper: list[tuple[float, float, float]] = []
        for x, center_z, half_height in centerline:
            half_width = cab.station_parameters(x)[0]
            lateral_factor, vertical_factor = cap_factors(x)
            y = side * half_width * lateral_factor * 1.018
            height = half_height * (0.70 + 0.30 * vertical_factor)
            lower.append((x, y, center_z - height))
            upper.append((x, y, center_z + height))
        vertices = lower + upper
        count = len(centerline)
        faces = [(index, index + 1, count + index + 1, count + index) for index in range(count - 1)]
        mesh = bpy.data.meshes.new(f"ice3_continuity_integrated_nose_stripe_mesh_{side}")
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(materials["ice_red"])
        mesh.update()
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        common.link_object(collection, f"ice3_continuity_integrated_nose_stripe_{side}", mesh, parent=root)

    tip_lateral, tip_vertical = cap_factors(cab.HALF_LENGTH)
    tip_half_width = cab.station_parameters(cab.HALF_LENGTH)[0] * tip_lateral * 1.018
    tip_half_height = centerline[-1][2] * (0.70 + 0.30 * tip_vertical)
    tip_z = centerline[-1][1]
    vertices = (
        (cab.HALF_LENGTH + 0.006, -tip_half_width, tip_z - tip_half_height),
        (cab.HALF_LENGTH + 0.006, tip_half_width, tip_z - tip_half_height),
        (cab.HALF_LENGTH + 0.006, tip_half_width, tip_z + tip_half_height),
        (cab.HALF_LENGTH + 0.006, -tip_half_width, tip_z + tip_half_height),
    )
    mesh = bpy.data.meshes.new("ice3_continuity_front_stripe_bridge_mesh")
    mesh.from_pydata(vertices, [], [(0, 1, 2, 3)])
    mesh.materials.append(materials["ice_red"])
    mesh.update()
    common.link_object(collection, "ice3_continuity_front_stripe_bridge", mesh, parent=root)


def add_first_class_markers(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    prefix: str,
    x: float,
    materials: dict[str, bpy.types.Material],
) -> None:
    for side in (-1, 1):
        common.add_box(
            collection,
            cube,
            f"{prefix}_first_class_marker_{side}",
            (0.15, 0.04, 0.36),
            (x, side * 1.503, 2.92),
            materials["marker"],
            root,
        )


def add_reference_matched_side_cab_glazing(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> None:
    """Build the five-pane Class 403 cab-side ribbon from the side reference.

    The earlier four-pane V2 element used one large polygon and oversized gaps.
    This version uses a triangulation-safe curved strip behind five inset panes,
    keeping the mullions dark and making the ribbon taper gently into the front
    windscreen exactly as the supplied side elevation shows.
    """
    # At the door end the cab panes share the passenger band's upper/lower
    # datums. The rearmost pane is widened toward the 1.16 m passenger-window
    # module, while the remaining panes descend and narrow toward the
    # windscreen. This avoids a visibly undersized first cab pane.
    top_guide = (
        (4.70, 2.80), (5.86, 2.80), (6.72, 2.79), (7.54, 2.75),
        (8.28, 2.67), (8.91, 2.54), (9.12, 2.43),
    )
    bottom_guide = (
        (4.70, 2.17), (5.86, 2.17), (6.72, 2.17), (7.54, 2.16),
        (8.28, 2.15), (8.91, 2.13), (9.12, 2.32),
    )
    panes = (
        ((4.78, 2.23), (4.78, 2.74), (5.86, 2.74), (5.86, 2.23)),
        ((5.94, 2.23), (5.94, 2.74), (6.70, 2.73), (6.70, 2.23)),
        ((6.80, 2.23), (6.80, 2.72), (7.52, 2.68), (7.52, 2.22)),
        ((7.62, 2.22), (7.62, 2.66), (8.27, 2.58), (8.27, 2.20)),
        ((8.37, 2.20), (8.37, 2.56), (8.90, 2.45), (8.90, 2.18)),
    )

    def surface_vertex(x: float, z: float, side: int, offset: float) -> tuple[float, float, float]:
        half_width, _bottom, _roof, _shoulder = cab.station_parameters(x)
        return (x, side * (half_width + offset), z)

    for side in (-1, 1):
        band_vertices: list[tuple[float, float, float]] = []
        for index in range(len(top_guide)):
            band_vertices.append(surface_vertex(*bottom_guide[index], side, 0.018))
            band_vertices.append(surface_vertex(*top_guide[index], side, 0.018))
        band_faces = []
        for index in range(len(top_guide) - 1):
            first = index * 2
            face = (first, first + 2, first + 3, first + 1)
            band_faces.append(face if side > 0 else tuple(reversed(face)))
        band_mesh = bpy.data.meshes.new(f"ice3_continuity_reference_side_cab_band_mesh_{side}")
        band_mesh.from_pydata(band_vertices, [], band_faces)
        band_mesh.materials.append(materials["seal"])
        band_mesh.update()
        common.link_object(
            collection,
            f"ice3_continuity_reference_side_cab_band_{side}",
            band_mesh,
            parent=root,
        )

        for index, pane in enumerate(panes):
            vertices = [surface_vertex(x, z, side, 0.026) for x, z in pane]
            face = (0, 1, 2, 3) if side > 0 else (3, 2, 1, 0)
            glass_mesh = bpy.data.meshes.new(
                f"ice3_continuity_reference_side_cab_pane_mesh_{side}_{index}"
            )
            glass_mesh.from_pydata(vertices, [], [face])
            glass_mesh.materials.append(materials["glass_inner"])
            glass_mesh.update()
            common.link_object(
                collection,
                f"ice3_continuity_reference_side_cab_pane_{side}_{index}",
                glass_mesh,
                parent=root,
            )


def build_end_car(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    root = common.add_empty(collection, "ice3_continuity_403_0_root")
    root["vehicle_role"] = "403.0 first-class end car"
    root["review_stage"] = "continuity"
    root["approved_cab_features"] = "checkpoint-7 windscreen, lamps and nose proportions"
    root["unified_shell"] = True
    root["shared_profile_id"] = "class403-continuity-v1"
    root["length_m"] = END_CAR_LENGTH
    root["production_registry_modified"] = False
    common.add_metric_contract(collection, root, add_anchor=True)

    add_shared_end_shell(collection, root, materials["ice_white"])
    cab.add_panoramic_windscreen(collection, root, cube, materials)
    add_reference_matched_side_cab_glazing(collection, root, materials)
    add_continuous_glazing_band(collection, root, "ice3_continuity_403_0", -11.55, 3.48, materials)
    add_inset_windows(collection, root, "ice3_continuity_403_0", END_WINDOW_SPECS, materials)
    add_pressure_tight_door(collection, root, "ice3_continuity_403_0", 4.18, materials)
    add_body_stripe(collection, root, "ice3_continuity_403_0", cab.REAR_SHELL_X, 5.205, materials)
    add_integrated_nose_stripe(collection, root, materials)
    add_first_class_markers(collection, root, cube, "ice3_continuity_403_0", -10.95, materials)
    cab.add_running_gear(collection, root, cube, cylinder, materials)
    cab.add_front_details(collection, root, cube, cylinder, materials)
    cab.add_roof_and_rear_details(collection, root, cube, materials)
    return root


def build_transformer_car(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    role = "first_transformer_403_1"
    root = common.add_empty(collection, "ice3_continuity_403_1_root")
    root["vehicle_role"] = "403.1 first-class transformer car"
    root["review_stage"] = "continuity"
    root["shared_profile_id"] = "class403-continuity-v1"
    root["length_m"] = MIDDLE_CAR_LENGTH
    root["production_registry_modified"] = False
    common.add_metric_contract(collection, root, add_anchor=True)

    add_shared_middle_shell(collection, root, materials["ice_white"])
    add_continuous_glazing_band(collection, root, "ice3_continuity_403_1", -9.92, 9.92, materials)
    add_inset_windows(collection, root, "ice3_continuity_403_1", TRANSFORMER_WINDOW_SPECS, materials)
    add_pressure_tight_door(collection, root, "ice3_continuity_403_1_front", 10.62, materials)
    add_pressure_tight_door(collection, root, "ice3_continuity_403_1_rear", -10.62, materials)
    add_body_stripe(collection, root, "ice3_continuity_403_1", -HALF_MIDDLE + 0.03, HALF_MIDDLE - 0.03, materials)
    add_first_class_markers(collection, root, cube, "ice3_continuity_403_1", -9.55, materials)
    base.add_middle_running_gear(
        collection,
        root,
        role,
        cube,
        cylinder,
        materials,
        powered=False,
        transformer=True,
        batteries=False,
    )
    base.add_gangways(collection, root, role, cube, materials)
    base.add_middle_roof(
        collection,
        root,
        role,
        cube,
        cylinder,
        materials,
        powered=False,
        transformer=True,
        pantograph_raised=True,
    )
    return root


def build_checkpoint(
    end_car: bpy.types.Object,
    transformer: bpy.types.Object,
    assets: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    collection = common.make_collection("ICE3_BR403_V2_Continuity_Checkpoint", assets)
    root = common.add_empty(collection, "ice3_br403_v2_continuity_root")
    root["candidate"] = "DB ICE 3 Class 403 V2 two-car continuity checkpoint"
    root["vehicle_count"] = 2
    root["length_m"] = round(CHECKPOINT_LENGTH, 3)
    root["review_stage"] = "continuity"
    root["approval_status"] = "private review only"
    root["shared_profile_id"] = "class403-continuity-v1"
    root["body_profile_tolerance_m"] = JUNCTION_PROFILE_TOLERANCE_METERS
    root["livery_tolerance_m"] = LIVERY_JUNCTION_TOLERANCE_METERS
    root["production_registry_modified"] = False
    for index, source in enumerate(cab.OFFICIAL_SOURCES, start=1):
        root[f"source_{index}"] = source
    existing_anchor = bpy.data.objects.get("rail_contact_origin")
    if existing_anchor is not None:
        existing_anchor.name = "continuity_prototype_rail_contact_origin"
    common.add_metric_contract(collection, root, add_anchor=True)

    end_center = CHECKPOINT_LENGTH / 2 - END_CAR_LENGTH / 2
    transformer_center = -CHECKPOINT_LENGTH / 2 + MIDDLE_CAR_LENGTH / 2
    end_instance = common.duplicate_hierarchy(end_car, collection, root, "vehicle_00_first_end_403_0")
    end_instance.location.x = end_center
    end_instance["formation_index"] = 0
    transformer_instance = common.duplicate_hierarchy(
        transformer, collection, root, "vehicle_01_first_transformer_403_1"
    )
    transformer_instance.location.x = transformer_center
    transformer_instance["formation_index"] = 1
    boundary_x = end_center - END_CAR_LENGTH / 2
    common.add_box(
        collection,
        cube,
        "ice3_continuity_intervehicle_coupler",
        (0.48, 0.20, 0.16),
        (boundary_x, 0, 0.72),
        materials["underframe"],
        root,
    )
    return root


def add_review_environment(
    assets: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    review = common.make_collection("ICE3_BR403_V2_Continuity_Review_NOT_EXPORTED", assets)
    root = common.add_empty(review, "review_environment_root")
    common.add_box(review, cube, "review_ground", (78, 34, 0.26), (0, 0, -0.64), materials["ground"], root)
    common.add_box(review, cube, "review_ballast", (68, 3.8, 0.30), (0, 0, -0.38), materials["ballast"], root)
    for y in (-WHEEL_TREAD_CENTER_METERS, WHEEL_TREAD_CENTER_METERS):
        common.add_box(review, cube, f"review_rail_{y}", (68, 0.075, 0.12), (0, y, -0.06), materials["steel"], root)
    for index in range(69):
        common.add_box(review, cube, f"review_sleeper_{index:03d}", (0.16, 2.58, 0.095), (-34 + index, 0, -0.168), materials["sleeper"], root)
    for x in (-30, -18, -6, 6, 18, 30):
        common.add_box(review, cube, f"review_catenary_post_{x}", (0.16, 0.16, 6.0), (x, 3.15, 2.82), materials["steel"], root)
        common.add_beam_between(review, cube, f"review_catenary_arm_{x}", (x, 3.15, 5.72), (x, 0, 5.50), 0.055, materials["steel"], root)
    common.add_box(review, cube, "review_contact_wire", (68, 0.035, 0.035), (0, 0, 5.50), materials["steel"], root)

    target = common.add_empty(review, "review_camera_target")
    target.location = (2.0, 0, 2.10)
    camera_data = bpy.data.cameras.new("ICE3_BR403_V2_Continuity_Review_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 41
    camera = common.link_object(review, "ICE3_BR403_V2_Continuity_Review_Camera", camera_data, location=(45, -52, 28))
    constraint = camera.constraints.new(type="TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    bpy.context.scene.camera = camera

    sun_data = bpy.data.lights.new("ICE3_BR403_V2_Continuity_Review_Sun", type="SUN")
    sun_data.energy = 2.7
    sun_data.angle = math.radians(14)
    common.link_object(review, "ICE3_BR403_V2_Continuity_Review_Sun", sun_data, rotation=(math.radians(38), 0, math.radians(-35)))
    area_data = bpy.data.lights.new("ICE3_BR403_V2_Continuity_Review_Fill", type="AREA")
    area_data.energy = 2100
    area_data.shape = "RECTANGLE"
    area_data.size = 18
    common.link_object(review, "ICE3_BR403_V2_Continuity_Review_Fill", area_data, location=(6, -15, 18))


def write_manifest() -> None:
    manifest = {
        "schemaVersion": 4,
        "generator": "Blender 5.2 LTS Python API",
        "candidateId": "ice3-br403-v2-continuity",
        "approvalStatus": "private-review",
        "reviewStage": "continuity",
        "productionRegistryModified": False,
        "comparisonBaseline": "public/models/train-lab/ice3-br403-v2/ice3-br403-v2-blender.glb",
        "targetFormation": "modernized DB ICE 3 Class 403 eight-car set",
        "currentCheckpoint": {
            "vehicleCount": 2,
            "lengthMeters": round(CHECKPOINT_LENGTH, 3),
            "vehicles": ["403.0 first-class end car", "403.1 first-class transformer car"],
            "remainingFormationVehiclesDeferred": 6,
        },
        "approvedCabFeatures": {
            "sourceCheckpoint": 7,
            "preserved": ["panoramic windscreen", "wipers", "headlight arrangement", "nose proportions"],
            "supportingShellRebuilt": True,
            "separateNoseCapExported": False,
            "sideCabGlazingRevision": "five-pane passenger-band-aligned ribbon with a 1.08 m rearmost pane and passenger-glass material, tapering into the windscreen",
            "rearmostCabPaneWidthMeters": 1.08,
            "sideCabGlassMaterial": "ICE3_V2_Glass_Interior",
        },
        "sharedBodyProfile": {
            "id": "class403-continuity-v1",
            "vertexCount": PROFILE_VERTEX_COUNT,
            "widthMeters": cab.VEHICLE_WIDTH,
            "bottomZMeters": BODY_BOTTOM_Z,
            "shoulderZMeters": BODY_SHOULDER_Z,
            "roofZMeters": BODY_ROOF_Z,
            "junctionToleranceMeters": JUNCTION_PROFILE_TOLERANCE_METERS,
        },
        "glazingBand": {
            "centerZMeters": GLAZING_BAND_CENTER_Z,
            "heightMeters": GLAZING_BAND_HEIGHT,
            "recessSurfaceYMeters": GLAZING_BAND_RECESS_Y,
            "glassSurfaceYMeters": WINDOW_GLASS_Y,
            "style": "continuous matte-black recess with inset smoked panes and dark mullions",
        },
        "bodyStripe": {
            "centerZMeters": BODY_STRIPE_CENTER_Z,
            "heightMeters": BODY_STRIPE_HEIGHT,
            "junctionToleranceMeters": LIVERY_JUNCTION_TOLERANCE_METERS,
            "noseBehavior": "smooth downward sweep beginning from the lowered passenger-body datum",
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
            "pantographContactHeightMeters": PANTOGRAPH_CONTACT_HEIGHT_METERS,
            "calibrationTrackExported": False,
        },
        "masterBlend": str(MASTER_PATH.relative_to(PROJECT_ROOT)),
        "checkpointGlb": str(CHECKPOINT_PATH.relative_to(PROJECT_ROOT)),
        "moduleGlbs": {
            "403.0": str(END_MODULE_PATH.relative_to(PROJECT_ROOT)),
            "403.1": str(TRANSFORMER_MODULE_PATH.relative_to(PROJECT_ROOT)),
        },
        "userReferenceFilenames": list(cab.USER_REFERENCES),
        "referencePolicy": "Research only. Local images are referenced by filename, not copied, packed, textured, embedded, or shipped.",
        "sources": list(cab.OFFICIAL_SOURCES),
        "nextApprovalGate": "Approve the two-car body, glazing-band and stripe continuity before generating the remaining six vehicles.",
    }
    (SOURCE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ensure_directories()
    cab.reset_scene()
    materials = cab.make_materials()
    materials["pantograph"] = common.make_material(
        "ICE3_V2_Continuity_Pantograph_Red",
        (0.56, 0.025, 0.025, 1),
        metallic=0.62,
        roughness=0.29,
    )
    cube = common.unit_cube_mesh()
    cylinder = common.unit_cylinder_mesh(24)
    assets = common.make_collection("ICE3_BR403_V2_Continuity_Assets")
    prototypes = common.make_collection("ICE3_BR403_V2_Continuity_Prototypes", assets)

    end_car = build_end_car(prototypes, cube, cylinder, materials)
    transformer = build_transformer_car(prototypes, cube, cylinder, materials)
    cab.export_glb(end_car, END_MODULE_PATH)
    cab.export_glb(transformer, TRANSFORMER_MODULE_PATH)

    checkpoint = build_checkpoint(end_car, transformer, assets, cube, materials)
    cab.export_glb(checkpoint, CHECKPOINT_PATH)
    add_review_environment(assets, cube, materials)
    cab.add_reference_guides()
    prototypes.hide_viewport = True
    prototypes.hide_render = True
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER_PATH), compress=True)
    write_manifest()
    print("CORNER_RAILS_ICE3_BR403_V2_CONTINUITY_GENERATED")


if __name__ == "__main__":
    main()
