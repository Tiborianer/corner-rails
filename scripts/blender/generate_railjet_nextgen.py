"""Generate the Blender-authored ÖBB Railjet new-generation candidate.

The model is an original, deterministic low-poly interpretation of the
Viaggio Next Level push-pull set.  It reuses the classic generator's measured
rail coordinate contract and wheel/roof primitives, but the cars, low-floor
doors, livery surfaces, and driving cab are purpose-built for this generation.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CLASSIC_SCRIPT = Path(__file__).with_name("generate_railjet_classic.py")
SPEC = importlib.util.spec_from_file_location("corner_rails_railjet_blender_common", CLASSIC_SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Could not load shared Blender generator: {CLASSIC_SCRIPT}")
common = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(common)

LIVERY_V2_REVIEW = common.LIVERY_V2_REVIEW
SOURCE_DIR = PROJECT_ROOT / "assets" / "blender" / ("railjet-nextgen-livery-v2" if LIVERY_V2_REVIEW else "railjet-nextgen")
OUTPUT_DIR = PROJECT_ROOT / "public" / "models" / ("train-lab/railjet-nextgen-livery-v2" if LIVERY_V2_REVIEW else "trains/blender/railjet")
MASTER_PATH = SOURCE_DIR / ("railjet-nextgen-livery-v2-master.blend" if LIVERY_V2_REVIEW else "railjet-nextgen-master.blend")

LOCOMOTIVE_LENGTH = 19.28
FORMATION_GAP = 0.085
FORMATION_LENGTH = 258.0
COACH_LENGTH = (FORMATION_LENGTH - LOCOMOTIVE_LENGTH - 9 * FORMATION_GAP) / 9
COACH_WIDTH = 2.825

OFFICIAL_SOURCES = (
    "https://static.web.oebb.at/konzern/oebb-flotte-2025/4/",
    "https://www.oebb.at/de/reiseplanung-services/im-zug/unsere-zuege/railjet",
    "https://press.siemens.com/global/en/pressrelease/obb-puts-first-new-generation-railjet-siemens-mobility-service-and-orders-19-more",
    "https://www.mobility.siemens.com/global/en/portfolio/references/railjet.html",
    "https://konzern.oebb.at/de/dam/jcr%3A9a8a8bc6-35bd-4dc5-9cc0-fc4470742bcf/OEBB-Umsetzungsplan%202025-2030.pdf",
)

NEXTGEN_PROFILE = (
    (-1.16, 0.76), (-1.36, 0.93), (-1.4125, 1.22), (-1.4125, 3.42),
    (-1.34, 3.72), (-1.08, 3.98), (-0.62, 4.13), (0.0, 4.18),
    (0.62, 4.13), (1.08, 3.98), (1.34, 3.72), (1.4125, 3.42),
    (1.4125, 1.22), (1.36, 0.93), (1.16, 0.76),
)


def nextgen_roof_strip_mesh(name: str, *, driving: bool = False) -> bpy.types.Mesh:
    """Red cap fitted to the taller Next Level roof profile."""
    x0 = -COACH_LENGTH / 2 + (2.75 if driving else 0.30)
    x1 = COACH_LENGTH / 2 - 0.30
    arc = [(-1.30, 3.76), (-1.00, 4.00), (-0.55, 4.15), (0.0, 4.21), (0.55, 4.15), (1.00, 4.00), (1.30, 3.76)]
    vertices = [(x, y, z) for x in (x0, x1) for y, z in arc]
    ring = len(arc)
    faces = [(index, index + 1, ring + index + 1, ring + index) for index in range(ring - 1)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return mesh


def add_nextgen_livery(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    role: str,
    window_count: int,
    low_floor: bool,
    driving: bool = False,
) -> None:
    nose_allowance = 2.85 if driving else 0.62
    body_start = -COACH_LENGTH / 2 + nose_allowance
    body_end = COACH_LENGTH / 2 - 0.62
    center = (body_start + body_end) / 2
    band_length = body_end - body_start
    door_positions = [-9.7 if driving else -10.7, 10.7]
    usable_start = -7.8 if driving else -8.8
    usable_end = 8.75
    spacing = (usable_end - usable_start) / window_count
    window_width = min(1.58 if role == "economy" else 1.78, spacing * 0.76)

    for side in (-1, 1):
        y = side * (COACH_WIDTH / 2 + 0.014)
        # Current Viaggio Next Level photography shows individual dark panes
        # in the wine-red upper body, not a coach-length black window ribbon.
        common.add_box(collection, cube, f"{role}_graphite_flank_{side}", (band_length + 0.18, 0.052, 1.30), (center, y + side * 0.006, 1.70), materials["anthracite"], root)
        common.add_box(collection, cube, f"{role}_silver_skirt_{side}", (band_length + 0.24, 0.056, 0.56), (center, y + side * 0.012, 0.95), materials["light_body"], root)
        common.add_box(collection, cube, f"{role}_red_belt_{side}", (band_length + 0.12, 0.062, 0.19), (center, y + side * 0.018, 2.36), materials["signal_red"], root)

        for door_index, x in enumerate(door_positions):
            door_bottom = 0.83 if low_floor else 1.08
            door_height = 2.48 if low_floor else 2.18
            door_top = door_bottom + door_height
            skirt_top = 1.22
            belt_bottom = 2.265
            belt_top = 2.455
            common.add_box(collection, cube, f"{role}_door_surround_{side}_{door_index}", (1.52, 0.068, door_height + 0.14), (x, y + side * 0.026, door_bottom + door_height / 2), materials["light_body"], root)
            # The real VNL door is not a solid black slab. Its leaf continues
            # the wine-red upper body, red waist belt, graphite lower flank and
            # aluminium skirt. Keeping those four horizontal datums continuous
            # removes the conspicuous black rectangles at every coach end.
            upper_height = max(0.08, door_top - belt_top)
            lower_height = max(0.08, belt_bottom - max(skirt_top, door_bottom))
            skirt_height = max(0.08, min(skirt_top, door_top) - door_bottom)
            common.add_box(collection, cube, f"{role}_door_upper_leaf_{side}_{door_index}", (1.27, 0.078, upper_height), (x, y + side * 0.042, belt_top + upper_height / 2), materials["railjet_red"], root)
            common.add_box(collection, cube, f"{role}_door_lower_leaf_{side}_{door_index}", (1.27, 0.078, lower_height), (x, y + side * 0.042, max(skirt_top, door_bottom) + lower_height / 2), materials["anthracite"], root)
            common.add_box(collection, cube, f"{role}_door_skirt_leaf_{side}_{door_index}", (1.27, 0.078, skirt_height), (x, y + side * 0.042, door_bottom + skirt_height / 2), materials["light_body"], root)
            common.add_box(collection, cube, f"{role}_door_red_belt_{side}_{door_index}", (1.27, 0.086, belt_top - belt_bottom), (x, y + side * 0.051, (belt_bottom + belt_top) / 2), materials["signal_red"], root)
            common.add_box(collection, cube, f"{role}_door_glass_{side}_{door_index}", (0.42, 0.090, 0.82), (x, y + side * 0.078, 2.82), materials["glass"], root)
            common.add_box(collection, cube, f"{role}_door_handle_{side}_{door_index}", (0.055, 0.096, 0.34), (x + 0.39, y + side * 0.082, 2.18), materials["steel"], root)
            common.add_box(collection, cube, f"{role}_door_step_{side}_{door_index}", (1.22, 0.21, 0.10), (x, y + side * 0.18, door_bottom - 0.02), materials["steel"], root)

        for index in range(window_count):
            x = usable_start + spacing * (index + 0.5)
            common.add_box(collection, cube, f"{role}_window_{side}_{index}", (window_width, 0.073, 0.84), (x, y + side * 0.056, 2.94), materials["glass"], root)
            common.add_box(collection, cube, f"{role}_window_warm_{side}_{index}", (window_width * 0.84, 0.026, 0.59), (x, y - side * 0.012, 2.90), materials["warm_glass"], root)
        for divider_index in range(1, window_count):
            x = usable_start + spacing * divider_index
            common.add_box(collection, cube, f"{role}_window_divider_{side}_{divider_index}", (0.082, 0.082, 0.96), (x, y + side * 0.071, 2.94), materials["anthracite"], root)

        common.add_text_label(collection, f"{role}_railjet_wordmark_{side}", "railjet", (1.45, y + side * 0.092, 1.78), materials["light_body"], root, side=side, size=0.83, scale_x=1.12)
        class_text = "1" if role == "first" else "2"
        for label_index, x in enumerate(door_positions):
            common.add_text_label(collection, f"{role}_class_{side}_{label_index}", class_text, (x, y + side * 0.096, 2.72), materials["light_body"], root, side=side, size=0.36)

    roof_mesh = nextgen_roof_strip_mesh(f"{role}_nextgen_roof_mesh", driving=driving)
    common.link_object(collection, f"{role}_dark_roof", roof_mesh, parent=root, material=materials["roof"])
    common.add_box(collection, cube, f"{role}_underframe_spine", (COACH_LENGTH - 4.8, 1.72, 0.34), (0.3 if driving else 0, 0, 0.58), materials["underframe"], root)
    for index, (x, width) in enumerate(((-6.2, 2.4), (-2.2, 2.5), (2.1, 2.2), (6.2, 2.7))):
        if driving and x < -5.5:
            continue
        common.add_box(collection, cube, f"{role}_underfloor_equipment_{index}", (width, 1.44, 0.36), (x, 0, 0.56), materials["roof"], root)


def build_nextgen_coach(
    prototypes: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    role: str,
    variant: str,
    window_count: int,
    low_floor: bool,
) -> bpy.types.Object:
    collection = common.make_collection(f"Prototype_{variant}", prototypes)
    root = common.add_empty(collection, f"railjet_nextgen_{variant}_root")
    root["vehicle_role"] = role
    root["variant"] = variant
    root["length_m"] = round(COACH_LENGTH, 4)
    sections = [
        (-COACH_LENGTH / 2, 0.94, 0.98, 0),
        (-COACH_LENGTH / 2 + 0.35, 1.0, 1.0, 0),
        (COACH_LENGTH / 2 - 0.35, 1.0, 1.0, 0),
        (COACH_LENGTH / 2, 0.94, 0.98, 0),
    ]
    shell = common.loft_mesh(f"{variant}_nextgen_body_mesh", sections, NEXTGEN_PROFILE, materials["railjet_red"])
    common.link_object(collection, f"{variant}_lofted_body", shell, parent=root)
    add_nextgen_livery(collection, root, cube, materials, role=variant, window_count=window_count, low_floor=low_floor)
    common.add_coach_roof_equipment(collection, root, cube, materials, variant)
    common.add_gangways(collection, root, cube, materials, COACH_LENGTH)
    common.add_bogie(collection, root, cube, cylinder, materials, name=f"{variant}_bogie_a", x=-9.45, axle_spacing=2.5, wheel_radius=0.46, bogie_width=1.92)
    common.add_bogie(collection, root, cube, cylinder, materials, name=f"{variant}_bogie_b", x=9.45, axle_spacing=2.5, wheel_radius=0.46, bogie_width=1.92)

    if role == "restaurant":
        for side in (-1, 1):
            common.add_box(collection, cube, f"{variant}_restaurant_panel_{side}", (3.9, 0.08, 0.63), (-1.3, side * 1.47, 2.76), materials["deep_red"], root)
    if role == "first":
        for side in (-1, 1):
            common.add_box(collection, cube, f"{variant}_first_gold_pin_{side}", (4.6, 0.065, 0.07), (2.3, side * 1.48, 3.55), materials["lamp"], root)
    if role == "multifunction":
        for side in (-1, 1):
            common.add_box(collection, cube, f"{variant}_accessible_door_marker_{side}", (1.58, 0.075, 0.20), (-9.7, side * 1.49, 1.00), materials["lamp"], root)
    common.add_metric_contract(collection, root)
    return root


def build_nextgen_driving_trailer(
    prototypes: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    role = "driving_trailer"
    collection = common.make_collection("Prototype_driving_trailer", prototypes)
    root = common.add_empty(collection, "railjet_nextgen_driving_trailer_root")
    root["vehicle_role"] = role
    root["length_m"] = round(COACH_LENGTH, 4)
    half = COACH_LENGTH / 2
    sections = [
        (-half, 0.38, 0.58, -0.04), (-half + 0.44, 0.61, 0.76, -0.02),
        (-half + 1.30, 0.84, 0.91, 0), (-half + 2.45, 0.98, 0.99, 0),
        (-half + 3.30, 1.0, 1.0, 0), (half - 0.35, 1.0, 1.0, 0),
        (half, 0.94, 0.98, 0),
    ]
    shell = common.loft_mesh("nextgen_driving_trailer_body_mesh", sections, NEXTGEN_PROFILE, materials["railjet_red"])
    common.link_object(collection, "nextgen_driving_trailer_lofted_body", shell, parent=root)
    add_nextgen_livery(collection, root, cube, materials, role=role, window_count=8, low_floor=True, driving=True)
    common.add_coach_roof_equipment(collection, root, cube, materials, role)
    common.add_gangways(collection, root, cube, materials, COACH_LENGTH, nose_negative=True)
    common.add_bogie(collection, root, cube, cylinder, materials, name="nextgen_driving_bogie_a", x=-9.15, axle_spacing=2.5, wheel_radius=0.46, bogie_width=1.92)
    common.add_bogie(collection, root, cube, cylinder, materials, name="nextgen_driving_bogie_b", x=9.45, axle_spacing=2.5, wheel_radius=0.46, bogie_width=1.92)

    common.add_cab_glazing(collection, root, materials, front_sign=-1, half_length=half, prefix="nextgen_driving_cab", wide=True)
    common.add_headlights(collection, root, cube, materials, front_sign=-1, half_length=half, prefix="nextgen_driving_cab")
    common.add_box(collection, cube, "nextgen_driving_graphite_apron", (0.52, 2.12, 0.45), (-half + 0.18, 0, 0.60), materials["anthracite"], root, rotation=(0, 0.10, 0))
    for side in (-1, 1):
        common.add_box(collection, cube, f"nextgen_driving_side_window_{side}", (1.75, 0.07, 0.82), (-half + 2.62, side * 1.43, 3.12), materials["glass"], root)
        cab_panel = [
            (-half + 0.18, side * 1.445, 0.92),
            (-half + 2.60, side * 1.457, 1.12),
            (-half + 4.10, side * 1.457, 1.88),
            (-half + 4.10, side * 1.457, 2.28),
            (-half + 2.68, side * 1.457, 1.68),
            (-half + 0.18, side * 1.445, 1.32),
        ]
        panel = common.polygon_mesh(f"nextgen_driving_graphite_cab_{side}_mesh", cab_panel, materials["anthracite"])
        common.link_object(collection, f"nextgen_driving_graphite_cab_{side}", panel, parent=root)
        cab_sweep = [
            (-half + 0.28, side * 1.468, 1.34),
            (-half + 2.72, side * 1.468, 1.70),
            (-half + 4.35, side * 1.468, 2.31),
            (-half + 4.35, side * 1.468, 2.54),
            (-half + 2.65, side * 1.468, 1.93),
            (-half + 0.28, side * 1.468, 1.58),
        ]
        sweep = common.polygon_mesh(f"nextgen_driving_red_sweep_{side}_mesh", cab_sweep, materials["signal_red"])
        common.link_object(collection, f"nextgen_driving_bright_red_sweep_{side}", sweep, parent=root)
    common.add_metric_contract(collection, root)
    return root


def build_formation(
    prototypes: dict[str, bpy.types.Object],
    assets: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    formation_collection = common.make_collection("Railjet_Nextgen_Formation", assets)
    root = common.add_empty(formation_collection, "railjet_nextgen_blender_root")
    root["formation"] = "ÖBB Railjet new generation"
    root["vehicle_count"] = 10
    root["length_m"] = FORMATION_LENGTH
    for index, source in enumerate(OFFICIAL_SOURCES):
        root[f"source_{index + 1}"] = source
    common.add_metric_contract(formation_collection, root, add_anchor=True)

    consist = [
        "taurus", "first_a", "first_b", "restaurant", "economy_a",
        "economy_b", "economy_c", "economy_d", "multifunction", "driving_trailer",
    ]
    cursor = FORMATION_LENGTH / 2
    for index, variant in enumerate(consist):
        length = LOCOMOTIVE_LENGTH if variant == "taurus" else COACH_LENGTH
        center = cursor - length / 2
        instance = common.duplicate_hierarchy(prototypes[variant], formation_collection, root, f"vehicle_{index:02d}_{variant}")
        instance.location.x = center
        instance["formation_index"] = index
        instance["role"] = variant
        instance["length_m"] = round(length, 4)
        cursor -= length
        if index < len(consist) - 1:
            gap_center = cursor - FORMATION_GAP / 2
            common.add_box(formation_collection, cube, f"intervehicle_coupler_{index:02d}", (0.54, 0.22, 0.18), (gap_center, 0, 0.85), materials["underframe"], root)
            cursor -= FORMATION_GAP
    return root


def main() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    common.reset_scene()
    materials = common.build_materials()
    cube = common.unit_cube_mesh()
    cylinder = common.unit_cylinder_mesh(16)
    assets = common.make_collection("Railjet_Blender_Assets")
    prototypes_collection = common.make_collection("Railjet_Prototypes", assets)

    taurus = common.build_taurus(prototypes_collection, cube, cylinder, materials)
    taurus.name = "railjet_nextgen_taurus_root"
    prototypes: dict[str, bpy.types.Object] = {
        "taurus": taurus,
        "first_a": build_nextgen_coach(prototypes_collection, cube, cylinder, materials, role="first", variant="first_a", window_count=8, low_floor=False),
        "first_b": build_nextgen_coach(prototypes_collection, cube, cylinder, materials, role="first", variant="first_b", window_count=8, low_floor=True),
        "restaurant": build_nextgen_coach(prototypes_collection, cube, cylinder, materials, role="restaurant", variant="restaurant", window_count=7, low_floor=True),
        "economy_a": build_nextgen_coach(prototypes_collection, cube, cylinder, materials, role="economy", variant="economy_a", window_count=10, low_floor=True),
        "economy_b": build_nextgen_coach(prototypes_collection, cube, cylinder, materials, role="economy", variant="economy_b", window_count=10, low_floor=True),
        "economy_c": build_nextgen_coach(prototypes_collection, cube, cylinder, materials, role="economy", variant="economy_c", window_count=10, low_floor=True),
        "economy_d": build_nextgen_coach(prototypes_collection, cube, cylinder, materials, role="economy", variant="economy_d", window_count=10, low_floor=False),
        "multifunction": build_nextgen_coach(prototypes_collection, cube, cylinder, materials, role="multifunction", variant="multifunction", window_count=7, low_floor=True),
        "driving_trailer": build_nextgen_driving_trailer(prototypes_collection, cube, cylinder, materials),
    }

    module_paths: dict[str, str] = {}
    for variant, root in prototypes.items():
        path = OUTPUT_DIR / f"railjet-nextgen-{variant.replace('_', '-')}.glb"
        common.export_glb(root, path)
        module_paths[variant] = str(path.relative_to(PROJECT_ROOT))

    formation_root = build_formation(prototypes, assets, cube, materials)
    formation_path = OUTPUT_DIR / ("railjet-nextgen-livery-v2.glb" if LIVERY_V2_REVIEW else "railjet-nextgen-blender.glb")
    common.export_glb(formation_root, formation_path)
    common.add_review_environment(assets, formation_root, cube, materials)
    prototypes_collection.hide_viewport = True
    prototypes_collection.hide_render = True
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER_PATH), compress=True)

    manifest = {
        "schemaVersion": 3 if LIVERY_V2_REVIEW else 2,
        "generator": "Blender 5.2 LTS Python API",
        "formation": "ÖBB Railjet new generation",
        "lengthMeters": FORMATION_LENGTH,
        "coachLengthMeters": round(COACH_LENGTH, 4),
        "vehicleCount": 10,
        "consist": ["taurus", "first-a", "first-b", "restaurant", "economy-a", "economy-b", "economy-c", "economy-d", "multifunction", "driving-trailer"],
        "masterBlend": str(MASTER_PATH.relative_to(PROJECT_ROOT)),
        "formationGlb": str(formation_path.relative_to(PROJECT_ROOT)),
        "moduleGlbs": module_paths,
        "assetContract": {
            "units": "meters",
            "forwardAxis": "+X",
            "lateralAxis": "+Y",
            "upAxis": "+Z",
            "standardGaugeMeters": common.STANDARD_GAUGE_METERS,
            "railContactPlaneZ": common.RAIL_CONTACT_PLANE_Z,
            "railContactAnchor": "rail_contact_origin",
            "wheelTreadCentersMeters": [-common.WHEEL_TREAD_CENTER_METERS, common.WHEEL_TREAD_CENTER_METERS],
            "pantographContactHeightMeters": common.PANTOGRAPH_CONTACT_HEIGHT_METERS,
            "calibrationTrackExported": False,
        },
        "sources": list(OFFICIAL_SOURCES),
        "liveryRevision": "reference-calibrated-v2.1" if LIVERY_V2_REVIEW else "production-v1",
        "liveryReferenceNotes": {
            "upperBody": "OEBB wine red",
            "accent": "bright red belt and driving-cab sweep",
            "lowerBody": "graphite",
            "skirt": "cool aluminium",
            "roof": "dark graphite",
            "doorSurround": "cool aluminium",
            "doorLeaf": "continuous wine-red, bright-red, graphite and aluminium body datums with a narrow vertical window",
            "lettering": "original Blender-font approximation; no copied logo artwork",
        },
        "productionRailjetModified": not LIVERY_V2_REVIEW,
    }
    (SOURCE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("CORNER_RAILS_RAILJET_NEXTGEN_GENERATED")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
