"""Generate the complete unified ICE 3 Class 403 approval candidate.

This is the post-continuity build. It keeps the approved 403.0/403.1 body,
cab glazing and stripe datums, then produces the remaining six vehicles from
the same cross-section and materials. The earlier V2 formation, the two-car
continuity checkpoint and the production ICE 3 are never overwritten.

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
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONTINUITY_SCRIPT = Path(__file__).with_name("generate_ice3_br403_v2_continuity.py")
SPEC = importlib.util.spec_from_file_location("corner_rails_ice3_v2_continuity", CONTINUITY_SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Could not load ICE 3 continuity generator: {CONTINUITY_SCRIPT}")
continuity = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(continuity)
base = continuity.base
cab = continuity.cab
common = continuity.common

SOURCE_DIR = PROJECT_ROOT / "assets" / "blender" / "ice3-br403-v2-unified"
OUTPUT_DIR = PROJECT_ROOT / "public" / "models" / "train-lab" / "ice3-br403-v2-unified"
PRODUCTION_DIR = PROJECT_ROOT / "public" / "models" / "trains" / "blender" / "ice3"
MASTER_PATH = SOURCE_DIR / "ice3-br403-v2-unified-master.blend"
REVIEW_FORMATION_PATH = OUTPUT_DIR / "ice3-br403-v2-unified-blender.glb"
FORMATION_PATH = PRODUCTION_DIR / "ice3-br403-unified-blender.glb"

END_CAR_LENGTH = continuity.END_CAR_LENGTH
MIDDLE_CAR_LENGTH = continuity.MIDDLE_CAR_LENGTH
FORMATION_LENGTH = 2 * END_CAR_LENGTH + 6 * MIDDLE_CAR_LENGTH
STANDARD_GAUGE_METERS = continuity.STANDARD_GAUGE_METERS
WHEEL_TREAD_CENTER_METERS = continuity.WHEEL_TREAD_CENTER_METERS
PANTOGRAPH_CONTACT_HEIGHT_METERS = continuity.PANTOGRAPH_CONTACT_HEIGHT_METERS

CONSIST = base.CONSIST
ROLE_LABELS = {
    "first_end_403_0": "403.0 first-class end car",
    "first_transformer_403_1": "403.1 first-class transformer car",
    "second_converter_403_2": "403.2 second-class converter car",
    "bordrestaurant_403_3": "403.3 Bordrestaurant car",
    "service_403_8": "403.8 service car",
    "second_converter_403_7": "403.7 second-class converter car",
    "second_transformer_403_6": "403.6 second-class transformer car",
    "second_end_403_5": "403.5 second-class end car",
}

STANDARD_SPECS = tuple((x, 1.18, 0.54) for x in base.STANDARD_WINDOWS)
CONVERTER_SPECS = tuple((x, 1.14, 0.54) for x in base.CONVERTER_WINDOWS)
SERVICE_SPECS = tuple((x, 1.18, 0.54) for x in base.SERVICE_WINDOWS)
RESTAURANT_DINING_SPECS = tuple((x, 1.52, 0.58) for x in base.RESTAURANT_DINING_WINDOWS)
RESTAURANT_SERVICE_SPECS = tuple((x, 1.18, 0.50) for x in base.RESTAURANT_SERVICE_WINDOWS)
RESTAURANT_GALLEY_SPECS = tuple((x, 1.22, 0.50) for x in (-8.75, -6.90, -5.05, -3.20, 4.20, 6.15, 8.10))


def ensure_directories() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PRODUCTION_DIR.mkdir(parents=True, exist_ok=True)


def make_emissive_headlamp_material(materials: dict[str, bpy.types.Material]) -> None:
    """Turn the approved lamp lens into a genuine emissive surface.

    React Three Fiber supplies the tightly budgeted combined moving spot light, while
    the GLB itself retains a bright lens under every environment.
    """
    lamp = materials["lamp"]
    lamp.diffuse_color = (1.0, 0.88, 0.61, 1.0)
    lamp.use_nodes = True
    principled = next((node for node in lamp.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if principled is None:
        return
    if "Base Color" in principled.inputs:
        principled.inputs["Base Color"].default_value = (1.0, 0.88, 0.61, 1.0)
    emission_input = principled.inputs.get("Emission Color") or principled.inputs.get("Emission")
    strength_input = principled.inputs.get("Emission Strength")
    if emission_input is not None:
        emission_input.default_value = (1.0, 0.72, 0.32, 1.0)
    if strength_input is not None:
        strength_input.default_value = 8.0
    lamp["runtime_spotlights"] = "React Three Fiber combined moving headlight beam"
    lamp["emissive_lens"] = True


def add_role_windows_for_side(
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
        points = cab.rounded_rectangle_points(
            center_x,
            continuity.GLAZING_BAND_CENTER_Z,
            width,
            height,
            0.09,
            7,
        )
        mesh = cab.side_polygon_mesh(
            f"ice3_unified_{role}_window_mesh_{side}_{index:02d}",
            points,
            side,
            continuity.WINDOW_GLASS_Y,
            materials["restaurant_glass"] if warm else materials["glass_inner"],
        )
        common.link_object(
            collection,
            f"ice3_unified_{role}_window_{side}_{index:02d}",
            mesh,
            parent=root,
        )


def add_role_glazing(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    role: str,
    materials: dict[str, bpy.types.Material],
) -> None:
    continuity.add_continuous_glazing_band(
        collection,
        root,
        f"ice3_unified_{role}",
        -9.92,
        9.92,
        materials,
    )
    if role == "bordrestaurant_403_3":
        add_role_windows_for_side(
            collection,
            root,
            role,
            1,
            RESTAURANT_DINING_SPECS + RESTAURANT_SERVICE_SPECS,
            materials,
            warm=True,
        )
        add_role_windows_for_side(
            collection,
            root,
            role,
            -1,
            RESTAURANT_GALLEY_SPECS,
            materials,
            warm=True,
        )
        # The galley has a long blank equipment section, visible on both sides
        # without breaking the shared black-band datum.
        for side in (-1, 1):
            blank = cab.rounded_rectangle_points(1.15, continuity.GLAZING_BAND_CENTER_Z, 3.10, 0.52, 0.07, 5)
            mesh = cab.side_polygon_mesh(
                f"ice3_unified_{role}_galley_blank_mesh_{side}",
                blank,
                side,
                continuity.WINDOW_GLASS_Y,
                materials["ice_white"],
            )
            common.link_object(collection, f"ice3_unified_{role}_galley_blank_{side}", mesh, parent=root)
        return
    specs = SERVICE_SPECS if role == "service_403_8" else CONVERTER_SPECS if "converter" in role else STANDARD_SPECS
    add_role_windows_for_side(collection, root, role, 1, specs, materials)
    add_role_windows_for_side(collection, root, role, -1, specs, materials)


def build_unified_middle_vehicle(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
    *,
    role: str,
    powered: bool = False,
    transformer: bool = False,
    pantograph_raised: bool = False,
    batteries: bool = False,
) -> bpy.types.Object:
    root = common.add_empty(collection, f"ice3_unified_{role}_root")
    root["vehicle_role"] = ROLE_LABELS[role]
    root["review_stage"] = "unified-formation"
    root["shared_profile_id"] = "class403-continuity-v1"
    root["length_m"] = MIDDLE_CAR_LENGTH
    root["production_registry_modified"] = True
    common.add_metric_contract(collection, root, add_anchor=True)

    continuity.add_shared_middle_shell(collection, root, materials["ice_white"])
    add_role_glazing(collection, root, role, materials)
    continuity.add_pressure_tight_door(collection, root, f"ice3_unified_{role}_front", 10.62, materials)
    continuity.add_pressure_tight_door(collection, root, f"ice3_unified_{role}_rear", -10.62, materials)
    continuity.add_body_stripe(
        collection,
        root,
        f"ice3_unified_{role}",
        -continuity.HALF_MIDDLE + 0.03,
        continuity.HALF_MIDDLE - 0.03,
        materials,
    )
    base.add_middle_running_gear(
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
    base.add_gangways(collection, root, role, cube, materials)
    base.add_middle_roof(
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
    if role == "service_403_8":
        for side in (-1, 1):
            panel = cab.rounded_rectangle_points(-0.10, 1.54, 1.15, 0.44, 0.08, 5)
            mesh = cab.side_polygon_mesh(
                f"ice3_unified_{role}_accessible_panel_mesh_{side}",
                panel,
                side,
                1.508,
                materials["service_blue"],
            )
            common.link_object(collection, f"ice3_unified_{role}_accessible_panel_{side}", mesh, parent=root)
    return root


def remove_first_class_markers(root: bpy.types.Object) -> None:
    for obj in list(cab.descendants(root)):
        if "first_class_marker" in obj.name:
            bpy.data.objects.remove(obj, do_unlink=True)


def configure_end_car(root: bpy.types.Object, *, role: str, second_end: bool) -> None:
    root.name = f"ice3_unified_{role}_root"
    root["candidate"] = "DB ICE 3 Class 403 unified formation"
    root["vehicle_role"] = ROLE_LABELS[role]
    root["review_stage"] = "unified-formation"
    root["approved_continuity_revision"] = 4
    root["production_registry_modified"] = True
    if second_end:
        remove_first_class_markers(root)
        root.rotation_euler.z = math.pi


def build_formation(
    prototypes: dict[str, bpy.types.Object],
    assets: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    collection = common.make_collection("ICE3_BR403_V2_Unified_Formation", assets)
    root = common.add_empty(collection, "ice3_br403_v2_unified_root")
    root["formation"] = "DB ICE 3 Class 403 unified eight-car production formation"
    root["vehicle_count"] = 8
    root["length_m"] = round(FORMATION_LENGTH, 3)
    root["approval_status"] = "approved production"
    root["review_stage"] = "unified-formation"
    root["shared_profile_id"] = "class403-continuity-v1"
    root["headlight_lenses_emissive"] = True
    root["runtime_headlights"] = "one combined moving React Three Fiber spot light at leading cab"
    root["production_registry_modified"] = True
    for index, source in enumerate(cab.OFFICIAL_SOURCES, start=1):
        root[f"source_{index}"] = source
    existing_anchor = bpy.data.objects.get("rail_contact_origin")
    if existing_anchor is not None:
        existing_anchor.name = "unified_prototype_rail_contact_origin"
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
                f"ice3_unified_intervehicle_coupler_{index:02d}",
                (0.52, 0.20, 0.16),
                (cursor, 0, 0.72),
                materials["underframe"],
                root,
            )
    return root


def add_review_environment(
    assets: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    review = common.make_collection("ICE3_BR403_V2_Unified_Review_NOT_EXPORTED", assets)
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
    camera_data = bpy.data.cameras.new("ICE3_BR403_V2_Unified_Review_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 132
    camera = common.link_object(review, "ICE3_BR403_V2_Unified_Review_Camera", camera_data, location=(112, -126, 70))
    constraint = camera.constraints.new(type="TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    bpy.context.scene.camera = camera

    sun_data = bpy.data.lights.new("ICE3_BR403_V2_Unified_Review_Sun", type="SUN")
    sun_data.energy = 2.7
    sun_data.angle = math.radians(14)
    common.link_object(review, "ICE3_BR403_V2_Unified_Review_Sun", sun_data, rotation=(math.radians(38), 0, math.radians(-35)))
    area_data = bpy.data.lights.new("ICE3_BR403_V2_Unified_Review_Fill", type="AREA")
    area_data.energy = 3300
    area_data.shape = "RECTANGLE"
    area_data.size = 58
    common.link_object(review, "ICE3_BR403_V2_Unified_Review_Fill", area_data, location=(8, -28, 38))

    # Static review-only copies of the runtime headlight beams. The GLB keeps
    # emissive lenses; the browser owns the combined moving spot light.
    front_x = FORMATION_LENGTH / 2 - 0.28
    for side in (-1, 1):
        lamp_data = bpy.data.lights.new(f"ICE3_BR403_V2_Unified_Review_Headlight_{side}", type="SPOT")
        lamp_data.energy = 1450
        lamp_data.color = (1.0, 0.74, 0.38)
        lamp_data.spot_size = math.radians(19)
        lamp_data.spot_blend = 0.72
        lamp_data.shadow_soft_size = 0.11
        lamp = common.link_object(
            review,
            f"ICE3_BR403_V2_Unified_Review_Headlight_{side}",
            lamp_data,
            location=(front_x, side * 0.27, 1.675),
        )
        direction = Vector((front_x + 32, side * 0.27, 0.28)) - lamp.location
        lamp.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def write_manifest(module_paths: dict[str, str]) -> None:
    manifest = {
        "schemaVersion": 5,
        "generator": "Blender 5.2 LTS Python API",
        "candidateId": "ice3-br403-v2-unified",
        "approvalStatus": "approved-production",
        "reviewStage": "unified-formation",
        "productionRegistryModified": True,
        "comparisonBaseline": str(continuity.CHECKPOINT_PATH.relative_to(PROJECT_ROOT)),
        "targetFormation": "modernized DB ICE 3 Class 403 eight-car set",
        "vehicleCount": 8,
        "lengthMeters": round(FORMATION_LENGTH, 3),
        "consist": [role for role, _length in CONSIST],
        "roleDetails": ROLE_LABELS,
        "continuityContract": {
            "approvedCheckpointRevision": 4,
            "sharedProfileId": "class403-continuity-v1",
            "profileVertexCount": continuity.PROFILE_VERTEX_COUNT,
            "bodyStripeCenterZMeters": continuity.BODY_STRIPE_CENTER_Z,
            "bodyStripeHeightMeters": continuity.BODY_STRIPE_HEIGHT,
            "glazingBandCenterZMeters": continuity.GLAZING_BAND_CENTER_Z,
            "glazingBandHeightMeters": continuity.GLAZING_BAND_HEIGHT,
            "glassSurfaceYMeters": continuity.WINDOW_GLASS_Y,
            "junctionToleranceMeters": continuity.JUNCTION_PROFILE_TOLERANCE_METERS,
            "liveryToleranceMeters": continuity.LIVERY_JUNCTION_TOLERANCE_METERS,
        },
        "lighting": {
            "lensMaterial": "ICE3_V2_Headlamp",
            "lensEmissive": True,
            "emissionStrength": 8.0,
            "runtimeOwner": "React Three Fiber",
            "leadingCabSpotLightCount": 1,
            "spotLightColor": "#ffe3a3",
            "spotLightPositionsMeters": [
                [FORMATION_LENGTH / 2 - 0.28, 1.675, -0.27],
                [FORMATION_LENGTH / 2 - 0.28, 1.675, 0.27],
            ],
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
        "formationGlb": str(FORMATION_PATH.relative_to(PROJECT_ROOT)),
        "reviewFormationGlb": str(REVIEW_FORMATION_PATH.relative_to(PROJECT_ROOT)),
        "moduleGlbs": module_paths,
        "bordrestaurant": {
            "vehicleIndex": 3,
            "class": "403.3",
            "redesignSeatCount": 20,
            "asymmetricDiningAndGalleySides": True,
        },
        "userReferenceFilenames": list(cab.USER_REFERENCES),
        "referencePolicy": "Research only. Local images are referenced by filename, not copied, packed, textured, embedded, or shipped.",
        "sources": list(cab.OFFICIAL_SOURCES),
        "nextApprovalGate": "Approved and promoted to the production ICE 3 registry on 2026-09-02.",
    }
    (SOURCE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ensure_directories()
    cab.reset_scene()
    materials = cab.make_materials()
    make_emissive_headlamp_material(materials)
    materials["restaurant_glass"] = common.make_material(
        "ICE3_Unified_Restaurant_Warm_Glass", (0.115, 0.052, 0.018, 1), metallic=0.08, roughness=0.18
    )
    materials["pantograph"] = common.make_material(
        "ICE3_Unified_Pantograph_Red", (0.56, 0.025, 0.025, 1), metallic=0.62, roughness=0.29
    )
    materials["service_blue"] = common.make_material(
        "ICE3_Unified_Service_Blue", (0.035, 0.18, 0.26, 1), metallic=0.08, roughness=0.30
    )
    cube = common.unit_cube_mesh()
    cylinder = common.unit_cylinder_mesh(24)
    assets = common.make_collection("ICE3_BR403_V2_Unified_Assets")
    prototype_collection = common.make_collection("ICE3_BR403_V2_Unified_Prototypes", assets)

    first_end = continuity.build_end_car(prototype_collection, cube, cylinder, materials)
    configure_end_car(first_end, role="first_end_403_0", second_end=False)
    first_transformer = continuity.build_transformer_car(prototype_collection, cube, cylinder, materials)
    first_transformer.name = "ice3_unified_first_transformer_403_1_root"
    first_transformer["review_stage"] = "unified-formation"
    first_transformer["approved_continuity_revision"] = 4

    prototypes = {
        "first_end_403_0": first_end,
        "first_transformer_403_1": first_transformer,
        "second_converter_403_2": build_unified_middle_vehicle(
            prototype_collection, cube, cylinder, materials, role="second_converter_403_2", powered=True
        ),
        "bordrestaurant_403_3": build_unified_middle_vehicle(
            prototype_collection, cube, cylinder, materials, role="bordrestaurant_403_3", batteries=True
        ),
        "service_403_8": build_unified_middle_vehicle(
            prototype_collection, cube, cylinder, materials, role="service_403_8", batteries=True
        ),
        "second_converter_403_7": build_unified_middle_vehicle(
            prototype_collection, cube, cylinder, materials, role="second_converter_403_7", powered=True
        ),
        "second_transformer_403_6": build_unified_middle_vehicle(
            prototype_collection,
            cube,
            cylinder,
            materials,
            role="second_transformer_403_6",
            transformer=True,
            pantograph_raised=False,
        ),
    }
    second_end = continuity.build_end_car(prototype_collection, cube, cylinder, materials)
    configure_end_car(second_end, role="second_end_403_5", second_end=True)
    prototypes["second_end_403_5"] = second_end

    module_paths: dict[str, str] = {}
    for role, root in prototypes.items():
        module_path = OUTPUT_DIR / f"ice3-br403-v2-unified-{role.replace('_', '-')}.glb"
        cab.export_glb(root, module_path)
        module_paths[role] = str(module_path.relative_to(PROJECT_ROOT))

    formation_root = build_formation(prototypes, assets, cube, materials)
    cab.export_glb(formation_root, REVIEW_FORMATION_PATH)
    cab.export_glb(formation_root, FORMATION_PATH)
    add_review_environment(assets, cube, materials)
    cab.add_reference_guides()
    prototype_collection.hide_viewport = True
    prototype_collection.hide_render = True
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER_PATH), compress=True)
    write_manifest(module_paths)
    print("CORNER_RAILS_ICE3_BR403_V2_UNIFIED_GENERATED")


if __name__ == "__main__":
    main()
