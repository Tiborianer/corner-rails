"""Generate the reference-calibrated ICE 3 BR403 V2 cab checkpoint.

This approval-gated candidate intentionally exports one complete 403.0 end car.
The remaining seven vehicles are not generated until the cab, side glazing,
door, and stripe have been approved in the private review laboratory.

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
from mathutils import Matrix, Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
COMMON_SCRIPT = Path(__file__).with_name("generate_railjet_classic.py")
SPEC = importlib.util.spec_from_file_location("corner_rails_blender_common", COMMON_SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Could not load Blender helpers: {COMMON_SCRIPT}")
common = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(common)

SOURCE_DIR = PROJECT_ROOT / "assets" / "blender" / "ice3-br403-v2"
OUTPUT_DIR = PROJECT_ROOT / "public" / "models" / "train-lab" / "ice3-br403-v2"
MASTER_PATH = SOURCE_DIR / "ice3-br403-v2-cab-checkpoint.blend"
ATLAS_PATH = SOURCE_DIR / "ice3-br403-v2-decals.png"
OUTPUT_PATH = OUTPUT_DIR / "ice3-br403-v2-cab-checkpoint.glb"

END_CAR_LENGTH = 25.835
HALF_LENGTH = END_CAR_LENGTH / 2
# Reserve the final 0.55 m for a progressively contracting convex cap. The V1
# shell ended on one large planar face, which made the nose look sawn off.
SHELL_HALF_LENGTH = HALF_LENGTH - 0.55
REAR_SHELL_X = -(HALF_LENGTH - 0.09)
VEHICLE_WIDTH = 2.95
VEHICLE_HEIGHT = 3.89
STANDARD_GAUGE_METERS = 1.435
WHEEL_TREAD_CENTER_METERS = STANDARD_GAUGE_METERS / 2
PANTOGRAPH_CONTACT_HEIGHT_METERS = 5.5

OFFICIAL_SOURCES = (
    "https://www.deutschebahn.com/de/ICE-3-7033052",
    "https://www.deutschebahn.com/resource/blob/12723788/819f9bc39b4e262b31c18cfd132b4654/DB-403_04_2023-data.pdf",
    "https://www.deutschebahn.com/de/presse/suche_Medienpakete/5-Schoener-speisen--6854504",
)

USER_REFERENCES = (
    "ice_3_front_sideview.jpg.avif",
    "ice_3_front_forwardview.jpg.avif",
    "ice_car_sideview.jpg",
    "ICE_3_second_class_car_sideview.png.webp",
    "ice_3_front-side_view.jpeg",
)

# Independent reference-calibrated stations. Roof height, half width, lower
# silhouette and upper side shoulder are controlled separately, avoiding the
# V1 failure where a complete coach cross-section was simply shrunk to a point.
# x, half width, bottom, roof crown, upper-side shoulder
CAB_CONTROL_STATIONS = (
    (REAR_SHELL_X, 1.475, 0.68, 3.89, 3.18),
    (5.20, 1.475, 0.68, 3.89, 3.18),
    (5.80, 1.473, 0.68, 3.88, 3.17),
    (6.45, 1.468, 0.68, 3.84, 3.14),
    (7.10, 1.450, 0.685, 3.76, 3.08),
    (7.75, 1.410, 0.69, 3.64, 2.99),
    (8.40, 1.345, 0.70, 3.49, 2.88),
    (9.05, 1.260, 0.71, 3.31, 2.74),
    (9.70, 1.150, 0.72, 3.10, 2.57),
    (10.35, 1.025, 0.73, 2.86, 2.37),
    (10.95, 0.900, 0.74, 2.63, 2.18),
    (11.50, 0.790, 0.75, 2.43, 2.03),
    (11.98, 0.720, 0.765, 2.27, 1.91),
    (12.18, 0.665, 0.78, 2.17, 1.79),
    (SHELL_HALF_LENGTH, 0.610, 0.80, 2.08, 1.69),
)

# The final cap continues the long, low Class 403 silhouette instead of ending
# in the broad upright face used by the earlier checkpoint. Lateral width,
# vertical height and centre height contract independently toward a small low
# nose tip, following the supplied side profile.
NOSE_CAP_RINGS = (
    (SHELL_HALF_LENGTH, 1.00, 1.00, 1.44),
    (SHELL_HALF_LENGTH + 0.14, 0.92, 0.83, 1.40),
    (SHELL_HALF_LENGTH + 0.28, 0.80, 0.64, 1.35),
    (SHELL_HALF_LENGTH + 0.42, 0.64, 0.44, 1.29),
    (HALF_LENGTH, 0.40, 0.24, 1.23),
)

CALIBRATION_GUIDES = {
    "noseTransitionXMeters": 5.20,
    "noseShellEndXMeters": round(SHELL_HALF_LENGTH, 4),
    "noseTipXMeters": round(HALF_LENGTH, 4),
    "panoramicWindscreenXRangeMeters": [9.55, 11.55],
    "sideCabWindowXRangeMeters": [6.58, 8.42],
    "passengerWindowCenterZMeters": 2.48,
    "passengerWindowHeightMeters": 0.52,
    "passengerDoorCenterXMeters": 4.18,
    "passengerDoorBottomZMeters": 0.90,
    "passengerDoorTopZMeters": 3.16,
    "sideStripeCenterZMeters": 1.94,
    "frontHeadlampCenterZMeters": 1.73,
    "frontBogieCenterXMeters": 6.75,
    "rearBogieCenterXMeters": -8.55,
}

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


def ensure_directories() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if not ATLAS_PATH.exists():
        raise RuntimeError(f"Missing original decal atlas: {ATLAS_PATH}")


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
    scene.world = bpy.data.worlds.new("ICE3_BR403_V2_Review_World")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.06, 0.085, 0.105, 1.0)
        background.inputs["Strength"].default_value = 0.75


def make_decal_material() -> bpy.types.Material:
    image = bpy.data.images.load(str(ATLAS_PATH), check_existing=True)
    image.name = "ICE3_BR403_V2_Original_Decal_Atlas"
    image.colorspace_settings.name = "sRGB"
    image.pack()
    material = bpy.data.materials.new("ICE3_V2_Original_Decal_Atlas_Material")
    material.use_nodes = True
    material.use_backface_culling = False
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = "ICE3_V2_Decal_Atlas"
    texture.image = image
    texture.interpolation = "Linear"
    if bsdf:
        links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
        links.new(texture.outputs["Alpha"], bsdf.inputs["Alpha"])
        bsdf.inputs["Roughness"].default_value = 0.32
    if hasattr(material, "surface_render_method"):
        material.surface_render_method = "DITHERED"
    elif hasattr(material, "blend_method"):
        material.blend_method = "BLEND"
    return material


def make_materials() -> dict[str, bpy.types.Material]:
    make = common.make_material
    return {
        "ice_white": make("ICE3_V2_Pearl_White", (0.91, 0.915, 0.90, 1), metallic=0.06, roughness=0.27),
        "ice_red": make("ICE3_V2_Traffic_Red", (0.82, 0.012, 0.024, 1), metallic=0.02, roughness=0.30),
        "glass": make("ICE3_V2_Smoked_Glass", (0.008, 0.020, 0.029, 1), metallic=0.35, roughness=0.10),
        "windscreen_glass": make("ICE3_V2_Cab_Windscreen_Glass", (0.045, 0.105, 0.135, 1), metallic=0.28, roughness=0.13),
        "glass_inner": make("ICE3_V2_Glass_Interior", (0.055, 0.070, 0.075, 1), metallic=0.14, roughness=0.18),
        "seal": make("ICE3_V2_Window_Seals", (0.025, 0.030, 0.032, 1), metallic=0.20, roughness=0.30),
        "windscreen_mask": make("ICE3_V2_Windscreen_Mask", (0.018, 0.024, 0.027, 1), metallic=0.04, roughness=0.44),
        "divider": make("ICE3_V2_Windscreen_Divider", (0.055, 0.060, 0.062, 1), metallic=0.30, roughness=0.25),
        "roof": make("ICE3_V2_Roof_Equipment", (0.56, 0.575, 0.57, 1), metallic=0.32, roughness=0.38),
        "underframe": make("ICE3_V2_Underframe", (0.042, 0.048, 0.050, 1), metallic=0.58, roughness=0.42),
        "fairing": make("ICE3_V2_Underbody_Fairing", (0.60, 0.615, 0.61, 1), metallic=0.22, roughness=0.38),
        "wheel": make("ICE3_V2_Wheels", (0.040, 0.045, 0.047, 1), metallic=0.86, roughness=0.22),
        "steel": make("ICE3_V2_Steel", (0.34, 0.37, 0.38, 1), metallic=0.88, roughness=0.22),
        "lamp": make("ICE3_V2_Headlamp", (1.0, 0.84, 0.49, 1), metallic=0.02, roughness=0.10),
        "marker": make("ICE3_V2_First_Class_Marker", (0.92, 0.74, 0.18, 1), metallic=0.05, roughness=0.24),
        "decal": make_decal_material(),
        "ballast": make("ICE3_V2_Review_Ballast", (0.19, 0.21, 0.21, 1), roughness=0.96),
        "sleeper": make("ICE3_V2_Review_Sleeper", (0.23, 0.14, 0.08, 1), roughness=0.92),
        "ground": make("ICE3_V2_Review_Ground", (0.24, 0.37, 0.28, 1), roughness=0.98),
    }


def station_parameters(x: float) -> tuple[float, float, float, float]:
    if x <= CAB_CONTROL_STATIONS[0][0]:
        return CAB_CONTROL_STATIONS[0][1:]
    if x >= CAB_CONTROL_STATIONS[-1][0]:
        return CAB_CONTROL_STATIONS[-1][1:]
    for index in range(len(CAB_CONTROL_STATIONS) - 1):
        left = CAB_CONTROL_STATIONS[index]
        right = CAB_CONTROL_STATIONS[index + 1]
        if left[0] <= x <= right[0]:
            t = (x - left[0]) / (right[0] - left[0])
            # The dense stations already describe the reference curve. Linear
            # interpolation plus the exported subdivision surface keeps the
            # derivative continuous without the repeated plateaus/ripples that
            # smoothstep introduced at every station in the first V2 draft.
            eased = t
            return tuple(left[item] + (right[item] - left[item]) * eased for item in range(1, 5))
    raise RuntimeError(f"Could not interpolate body station at {x}")


def upper_surface_point(x: float, lateral_normalized: float, offset: float = 0.0) -> tuple[float, float, float]:
    half_width, _bottom, roof, shoulder = station_parameters(x)
    p = max(-1.0, min(1.0, lateral_normalized))
    arch = max(0.0, 1.0 - abs(p) ** 1.72) ** 0.62
    y = p * half_width
    z = shoulder + (roof - shoulder) * arch
    normal_scale = 1.0 + offset / max(half_width, 0.5)
    return (x, y * normal_scale, z + offset * (0.35 + 0.65 * arch))


def half_profile(half_width: float, bottom: float, roof: float, shoulder: float) -> list[tuple[float, float]]:
    return [
        (0.0, bottom),
        (half_width * 0.78, bottom),
        (half_width * 0.91, bottom + 0.12),
        (half_width * 0.985, bottom + 0.34),
        (half_width, min(shoulder, bottom + (roof - bottom) * 0.73)),
        (half_width * 0.965, shoulder + (roof - shoulder) * 0.31),
        (half_width * 0.82, shoulder + (roof - shoulder) * 0.62),
        (half_width * 0.58, shoulder + (roof - shoulder) * 0.85),
        (half_width * 0.30, shoulder + (roof - shoulder) * 0.97),
        (0.0, roof),
    ]


def build_body_shell(material: bpy.types.Material) -> bpy.types.Mesh:
    sampled_x: list[float] = []
    for index, station in enumerate(CAB_CONTROL_STATIONS[:-1]):
        next_station = CAB_CONTROL_STATIONS[index + 1]
        subdivisions = 2 if station[0] < 5.2 else 4
        for step in range(subdivisions):
            sampled_x.append(station[0] + (next_station[0] - station[0]) * step / subdivisions)
    sampled_x.append(CAB_CONTROL_STATIONS[-1][0])

    vertices: list[tuple[float, float, float]] = []
    profiles: list[list[tuple[float, float]]] = []
    for x in sampled_x:
        profile = half_profile(*station_parameters(x))
        profiles.append(profile)
        vertices.extend((x, y, z) for y, z in profile)

    ring = len(profiles[0])
    faces: list[tuple[int, ...]] = []
    for x_index in range(len(sampled_x) - 1):
        start = x_index * ring
        nxt = (x_index + 1) * ring
        for profile_index in range(ring - 1):
            faces.append((start + profile_index, nxt + profile_index, nxt + profile_index + 1, start + profile_index + 1))
    faces.append(tuple(reversed(range(ring))))
    # Leave the front open. A separate multi-ring convex cap closes it without
    # reintroducing the large flat end face that motivated this revision.

    mesh = bpy.data.meshes.new("ice3_v2_reference_calibrated_half_shell_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return mesh


def add_mirrored_shell(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    material: bpy.types.Material,
) -> bpy.types.Object:
    shell = common.link_object(collection, "ice3_v2_reference_calibrated_cab_shell", build_body_shell(material), parent=root)
    mirror = shell.modifiers.new("ICE3_V2_Lateral_Mirror", "MIRROR")
    mirror.use_axis[0] = False
    mirror.use_axis[1] = True
    mirror.use_clip = True
    subdivision = shell.modifiers.new("ICE3_V2_Subdivision_Surface", "SUBSURF")
    subdivision.subdivision_type = "CATMULL_CLARK"
    subdivision.levels = 1
    subdivision.render_levels = 1
    return shell


def build_convex_nose_cap(material: bpy.types.Material) -> bpy.types.Mesh:
    base_profile = half_profile(*station_parameters(SHELL_HALF_LENGTH))
    full_profile = base_profile + [(-y, z) for y, z in reversed(base_profile[1:-1])]
    base_center_z = (CAB_CONTROL_STATIONS[-1][2] + CAB_CONTROL_STATIONS[-1][3]) / 2
    # Lateral and vertical contraction are deliberately separate. The BR403
    # tip is rounded and blunt in front view; it is not a sharp rotational cone.
    rings = NOSE_CAP_RINGS
    vertices: list[tuple[float, float, float]] = []
    for x, lateral_factor, vertical_factor, center_z in rings:
        for y, z in full_profile:
            vertices.append((x, y * lateral_factor, center_z + (z - base_center_z) * vertical_factor))
    ring_size = len(full_profile)
    faces: list[tuple[int, ...]] = []
    for ring_index in range(len(rings) - 1):
        start = ring_index * ring_size
        nxt = (ring_index + 1) * ring_size
        for profile_index in range(ring_size):
            following = (profile_index + 1) % ring_size
            faces.append((start + profile_index, start + following, nxt + following, nxt + profile_index))
    last = (len(rings) - 1) * ring_size
    faces.append(tuple(last + index for index in range(ring_size)))
    mesh = bpy.data.meshes.new("ice3_v2_convex_nose_cap_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return mesh


def add_convex_nose_cap(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    material: bpy.types.Material,
) -> None:
    cap = common.link_object(collection, "ice3_v2_convex_nose_cap", build_convex_nose_cap(material), parent=root)
    subdivision = cap.modifiers.new("ICE3_V2_Convex_Cap_Subdivision", "SUBSURF")
    subdivision.subdivision_type = "CATMULL_CLARK"
    subdivision.levels = 1
    subdivision.render_levels = 1


def patch_mesh(
    name: str,
    rows: Sequence[tuple[float, float]],
    material: bpy.types.Material,
    *,
    lateral_steps: int = 14,
    offset: float = 0.025,
) -> bpy.types.Mesh:
    vertices: list[tuple[float, float, float]] = []
    for x, half_lateral in rows:
        for index in range(lateral_steps):
            p = -half_lateral + 2 * half_lateral * index / (lateral_steps - 1)
            vertices.append(upper_surface_point(x, p, offset))
    faces: list[tuple[int, ...]] = []
    for row in range(len(rows) - 1):
        start = row * lateral_steps
        nxt = (row + 1) * lateral_steps
        for index in range(lateral_steps - 1):
            faces.append((start + index, start + index + 1, nxt + index + 1, nxt + index))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return mesh


def add_panoramic_windscreen(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    # The real Class 403 assembly is not one dark oval. The supplied head-on
    # photograph shows a broad black aerodynamic surround with a lower,
    # blue-grey glazed area and a substantial visor band above it. Model those
    # as separate seated surfaces so it reads as a windscreen rather than a
    # featureless blob.
    def cab_surface_point(y: float, z: float, offset: float) -> tuple[float, float, float]:
        depsgraph = bpy.context.evaluated_depsgraph_get()
        world_origin = Vector((20.0, y, z))
        world_direction = Vector((-1.0, 0.0, 0.0))
        candidates: list[tuple[float, Vector, Vector]] = []
        for target_name in ("ice3_v2_reference_calibrated_cab_shell", "ice3_v2_convex_nose_cap"):
            source_object = bpy.data.objects.get(target_name)
            if source_object is None:
                continue
            evaluated = source_object.evaluated_get(depsgraph)
            inverse = evaluated.matrix_world.inverted()
            local_origin = inverse @ world_origin
            local_direction = (inverse.to_3x3() @ world_direction).normalized()
            hit, local_location, local_normal, _face_index = evaluated.ray_cast(local_origin, local_direction, distance=20.0)
            if not hit:
                continue
            world_location = evaluated.matrix_world @ local_location
            world_normal = (evaluated.matrix_world.to_3x3() @ local_normal).normalized()
            candidates.append((world_location.x, world_location, world_normal))
        if not candidates:
            raise RuntimeError(f"Could not seat ICE 3 windscreen on cab at y={y:.3f}, z={z:.3f}")
        _front_x, location, normal = max(candidates, key=lambda candidate: candidate[0])
        if normal.dot(Vector((1.0, 0.0, 0.0))) < 0:
            normal.negate()
        seated = location + normal * offset
        return (seated.x, seated.y, seated.z)

    def projected_superellipse_mesh(
        name: str,
        lateral_radius: float,
        vertical_radius: float,
        center_z: float,
        exponent: float,
        offset: float,
        material: bpy.types.Material,
        *,
        rings: int = 10,
        segments: int = 64,
    ) -> bpy.types.Mesh:
        def point(radial: float, angle: float) -> tuple[float, float, float]:
            cosine = math.cos(angle)
            sine = math.sin(angle)
            y_shape = math.copysign(abs(cosine) ** (2.0 / exponent), cosine)
            z_shape = math.copysign(abs(sine) ** (2.0 / exponent), sine)
            y = lateral_radius * radial * y_shape
            z = center_z + vertical_radius * radial * z_shape
            lower_fraction = max(0.0, (center_z - z) / vertical_radius)
            y *= 1.0 - 0.06 * lower_fraction
            return cab_surface_point(y, z, offset)

        vertices = [point(0.0, 0.0)]
        for ring in range(1, rings + 1):
            radial = ring / rings
            for segment in range(segments):
                vertices.append(point(radial, 2 * math.pi * segment / segments))

        faces: list[tuple[int, ...]] = []
        for segment in range(segments):
            faces.append((0, 1 + segment, 1 + (segment + 1) % segments))
        for ring in range(1, rings):
            inner_start = 1 + (ring - 1) * segments
            outer_start = 1 + ring * segments
            for segment in range(segments):
                following = (segment + 1) % segments
                faces.append((inner_start + segment, outer_start + segment, outer_start + following, inner_start + following))

        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(material)
        mesh.update()
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        return mesh

    seal_mesh = projected_superellipse_mesh(
        "ice3_v2_panorama_windscreen_seal_mesh", 1.12, 0.44, 2.76, 2.75, 0.008, materials["windscreen_mask"]
    )
    common.link_object(collection, "ice3_v2_panorama_windscreen_seal", seal_mesh, parent=root)
    # The supplied head-on photograph shows one continuous glazed windscreen
    # below the dark upper visor. Build it as a dense curved surface rather than
    # two flat polygon panes or a concentric oval insert.
    windscreen_root = common.add_empty(collection, "ice3_v2_panorama_windscreen", root)

    def windscreen_z_bounds(y: float) -> tuple[float, float]:
        lateral = min(1.0, abs(y) / 0.93)
        lower = 2.455 + 0.075 * lateral ** 2.4
        upper = 2.845 - 0.065 * lateral ** 1.8
        return lower, upper

    def windscreen_surface_point(y: float, z: float, offset: float = 0.012) -> tuple[float, float, float]:
        return cab_surface_point(y, z, offset)

    lateral_steps = 49
    vertical_steps = 17
    vertices: list[tuple[float, float, float]] = []
    for lateral_index in range(lateral_steps):
        y = -0.93 + 1.86 * lateral_index / (lateral_steps - 1)
        lower, upper = windscreen_z_bounds(y)
        for vertical_index in range(vertical_steps):
            z = lower + (upper - lower) * vertical_index / (vertical_steps - 1)
            vertices.append(windscreen_surface_point(y, z))
    faces: list[tuple[int, ...]] = []
    for lateral_index in range(lateral_steps - 1):
        start = lateral_index * vertical_steps
        following = (lateral_index + 1) * vertical_steps
        for vertical_index in range(vertical_steps - 1):
            faces.append((start + vertical_index, following + vertical_index, following + vertical_index + 1, start + vertical_index + 1))
    glass_mesh = bpy.data.meshes.new("ice3_v2_panorama_windscreen_glass_mesh")
    glass_mesh.from_pydata(vertices, [], faces)
    glass_mesh.materials.append(materials["windscreen_glass"])
    glass_mesh.update()
    for polygon in glass_mesh.polygons:
        polygon.use_smooth = True
    common.link_object(collection, "ice3_v2_panorama_windscreen_glass", glass_mesh, parent=windscreen_root)

    # A shallow curved shadow at the base suggests the dashboard and recessed
    # lower gasket visible in the supplied forward photograph.
    detail_vertices: list[tuple[float, float, float]] = []
    detail_steps = 33
    for lateral_index in range(detail_steps):
        y = -0.78 + 1.56 * lateral_index / (detail_steps - 1)
        lower, upper = windscreen_z_bounds(y)
        for fraction in (0.055, 0.145):
            z = lower + (upper - lower) * fraction
            detail_vertices.append(windscreen_surface_point(y, z, 0.015))
    detail_faces = []
    for lateral_index in range(detail_steps - 1):
        start = lateral_index * 2
        detail_faces.append((start, start + 2, start + 3, start + 1))
    detail_mesh = bpy.data.meshes.new("ice3_v2_windscreen_lower_detail_mesh")
    detail_mesh.from_pydata(detail_vertices, [], detail_faces)
    detail_mesh.materials.append(materials["glass_inner"])
    detail_mesh.update()
    common.link_object(collection, "ice3_v2_windscreen_lower_detail", detail_mesh, parent=windscreen_root)

    # Two thin wipers and their pivots sit on the single continuous glass.
    for side in (-1, 1):
        start = windscreen_surface_point(side * 0.11, 2.50, 0.019)
        end = windscreen_surface_point(side * 0.50, 2.78, 0.019)
        common.add_beam_between(collection, cube, f"ice3_v2_wiper_{side}", start, end, 0.020, materials["divider"], root)
        common.add_box(collection, cube, f"ice3_v2_wiper_pivot_{side}", (0.035, 0.070, 0.070), start, materials["divider"], root)


def side_polygon_mesh(
    name: str,
    xz_points: Sequence[tuple[float, float]],
    side: int,
    y: float,
    material: bpy.types.Material,
) -> bpy.types.Mesh:
    vertices = [(x, side * y, z) for x, z in xz_points]
    face = tuple(range(len(vertices))) if side > 0 else tuple(reversed(range(len(vertices))))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [face])
    mesh.materials.append(material)
    mesh.update()
    return mesh


def rounded_rectangle_points(cx: float, cz: float, width: float, height: float, radius: float, segments: int = 3) -> list[tuple[float, float]]:
    result: list[tuple[float, float]] = []
    for corner_x, corner_z, start_angle in (
        (cx + width / 2 - radius, cz + height / 2 - radius, 0),
        (cx - width / 2 + radius, cz + height / 2 - radius, 90),
        (cx - width / 2 + radius, cz - height / 2 + radius, 180),
        (cx + width / 2 - radius, cz - height / 2 + radius, 270),
    ):
        for step in range(segments + 1):
            angle = math.radians(start_angle + step * 90 / segments)
            result.append((corner_x + radius * math.cos(angle), corner_z + radius * math.sin(angle)))
    return result


def add_side_panel(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    name: str,
    points: Sequence[tuple[float, float]],
    y: float,
    material: bpy.types.Material,
) -> None:
    for side in (-1, 1):
        mesh = side_polygon_mesh(f"{name}_mesh_{side}", points, side, y, material)
        common.link_object(collection, f"{name}_{side}", mesh, parent=root)


def add_side_cab_windows(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> None:
    # Official and supplied side photographs show a long swept four-pane cab
    # band. The front-facing windscreen is rounded; this side glazing is not an
    # oval. Each vertex follows the narrowing body instead of floating at one Y.
    outer = (
        (5.30, 2.52), (5.30, 3.15), (6.25, 3.15), (7.15, 3.10),
        (8.02, 3.01), (8.70, 2.83), (9.06, 2.58), (8.78, 2.28),
        (7.94, 2.40), (7.08, 2.50), (6.20, 2.56),
    )
    panes = (
        ((5.43, 2.61), (5.43, 3.06), (6.15, 3.06), (6.15, 2.59)),
        ((6.27, 2.59), (6.27, 3.06), (7.02, 3.01), (7.02, 2.53)),
        ((7.14, 2.52), (7.14, 3.00), (7.83, 2.92), (7.83, 2.43)),
        ((7.95, 2.42), (7.95, 2.91), (8.59, 2.75), (8.88, 2.57), (8.67, 2.35)),
    )

    def curved_mesh(name: str, points: Sequence[tuple[float, float]], side: int, material: bpy.types.Material, offset: float) -> bpy.types.Mesh:
        vertices = []
        for x, z in points:
            half_width, _bottom, _roof, _shoulder = station_parameters(x)
            vertices.append((x, side * (half_width + offset), z))
        face = tuple(range(len(vertices))) if side > 0 else tuple(reversed(range(len(vertices))))
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], [face])
        mesh.materials.append(material)
        mesh.update()
        return mesh

    for side in (-1, 1):
        seal_mesh = curved_mesh(f"ice3_v2_side_cab_window_band_mesh_{side}", outer, side, materials["seal"], 0.018)
        common.link_object(collection, f"ice3_v2_side_cab_window_band_{side}", seal_mesh, parent=root)
        for index, pane in enumerate(panes):
            glass_mesh = curved_mesh(f"ice3_v2_side_cab_window_glass_mesh_{side}_{index}", pane, side, materials["glass"], 0.026)
            common.link_object(collection, f"ice3_v2_side_cab_window_glass_{side}_{index}", glass_mesh, parent=root)


def add_passenger_glazing(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    window_centers = (-10.40, -8.91, -7.42, -5.93, -4.44, -2.95, -1.46, 0.03, 1.52, 2.78)
    band_center = (window_centers[0] + window_centers[-1]) / 2
    band_length = window_centers[-1] - window_centers[0] + 1.30
    band = rounded_rectangle_points(band_center, 2.48, band_length, 0.62, 0.14, 6)
    add_side_panel(collection, root, "ice3_v2_continuous_window_recess", band, 1.486, materials["seal"])
    for index, x in enumerate(window_centers):
        # ICE 3 apertures have visibly softened corners. They are separate
        # recessed panes inside a continuous smoked band, never square boxes.
        window = rounded_rectangle_points(x, 2.48, 1.16, 0.52, 0.105, 6)
        add_side_panel(collection, root, f"ice3_v2_passenger_window_{index:02d}", window, 1.491, materials["glass_inner"])
    for side in (-1, 1):
        for index in range(len(window_centers) - 1):
            x = (window_centers[index] + window_centers[index + 1]) / 2
            common.add_box(collection, cube, f"ice3_v2_window_mullion_{side}_{index:02d}", (0.08, 0.038, 0.58), (x, side * 1.494, 2.48), materials["ice_white"], root)
        common.add_box(collection, cube, f"ice3_v2_first_class_marker_{side}", (0.15, 0.040, 0.36), (-10.95, side * 1.496, 2.92), materials["marker"], root)


def add_passenger_door(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> None:
    center_x = CALIBRATION_GUIDES["passengerDoorCenterXMeters"]
    center_z = (CALIBRATION_GUIDES["passengerDoorBottomZMeters"] + CALIBRATION_GUIDES["passengerDoorTopZMeters"]) / 2
    seal = rounded_rectangle_points(center_x, center_z, 1.13, 2.34, 0.11, 4)
    door = rounded_rectangle_points(center_x, center_z, 1.02, 2.24, 0.085, 4)
    window = rounded_rectangle_points(center_x, 2.53, 0.40, 0.91, 0.12, 5)
    add_side_panel(collection, root, "ice3_v2_passenger_door_seal", seal, 1.487, materials["seal"])
    add_side_panel(collection, root, "ice3_v2_passenger_door_leaf", door, 1.492, materials["ice_white"])
    add_side_panel(collection, root, "ice3_v2_passenger_door_window", window, 1.497, materials["glass"])
    handle = rounded_rectangle_points(center_x + 0.34, 1.64, 0.055, 0.28, 0.022, 3)
    add_side_panel(collection, root, "ice3_v2_passenger_door_handle", handle, 1.501, materials["seal"])


def add_textured_quad(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    side: int,
    material: bpy.types.Material,
) -> None:
    x0, x1 = -12.0, 5.65
    z0, z1 = 0.72, 3.45
    y = side * 1.503
    vertices = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
    face = (0, 1, 2, 3) if side > 0 else (3, 2, 1, 0)
    mesh = bpy.data.meshes.new(f"ice3_v2_original_decal_quad_mesh_{side}")
    mesh.from_pydata(vertices, [], [face])
    mesh.materials.append(material)
    uv = mesh.uv_layers.new(name="ICE3_V2_Decal_UV")
    coordinates = ((0, 0), (1, 0), (1, 1), (0, 1))
    for loop, coordinate in zip(mesh.polygons[0].loop_indices, coordinates, strict=True):
        uv.data[loop].uv = coordinate
    mesh.update()
    common.link_object(collection, f"ice3_v2_original_decal_atlas_{side}", mesh, parent=root)


def add_nose_stripe(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> None:
    # x, actual stripe centre height, half thickness. The belt stays low at the
    # tip and grows progressively thicker toward the full-width body, matching
    # the supplied side photograph instead of curling upward at the front.
    centerline = (
        (5.45, 1.94, 0.100), (6.20, 1.935, 0.098), (7.00, 1.90, 0.094), (7.80, 1.82, 0.088),
        (8.60, 1.69, 0.080), (9.40, 1.53, 0.071), (10.20, 1.36, 0.063), (11.00, 1.21, 0.055),
        (11.75, 1.16, 0.050), (12.20, 1.15, 0.045), (12.48, 1.145, 0.040), (12.70, 1.14, 0.036),
        (HALF_LENGTH, 1.135, 0.034),
    )
    cap_rings = NOSE_CAP_RINGS

    def cap_factors(x: float) -> tuple[float, float, float]:
        if x <= SHELL_HALF_LENGTH:
            return (1.0, 1.0, 1.44)
        for index in range(len(cap_rings) - 1):
            left_x, left_lateral, left_vertical, left_center = cap_rings[index]
            right_x, right_lateral, right_vertical, right_center = cap_rings[index + 1]
            if left_x <= x <= right_x:
                t = (x - left_x) / (right_x - left_x)
                return (
                    left_lateral + (right_lateral - left_lateral) * t,
                    left_vertical + (right_vertical - left_vertical) * t,
                    left_center + (right_center - left_center) * t,
                )
        return (cap_rings[-1][1], cap_rings[-1][2], cap_rings[-1][3])

    for side in (-1, 1):
        vertices: list[tuple[float, float, float]] = []
        for x, z, half_thickness in centerline:
            half_width, _bottom, _roof, _shoulder = station_parameters(x)
            lateral_factor, vertical_factor, _center_z = cap_factors(x)
            y = side * half_width * lateral_factor * 1.018
            stripe_half = half_thickness * (0.70 + 0.30 * vertical_factor)
            vertices.append((x, y, z - stripe_half))
        for x, z, half_thickness in centerline:
            half_width, _bottom, _roof, _shoulder = station_parameters(x)
            lateral_factor, vertical_factor, _center_z = cap_factors(x)
            y = side * half_width * lateral_factor * 1.018
            stripe_half = half_thickness * (0.70 + 0.30 * vertical_factor)
            vertices.append((x, y, z + stripe_half))
        count = len(centerline)
        faces = [(index, index + 1, count + index + 1, count + index) for index in range(count - 1)]
        mesh = bpy.data.meshes.new(f"ice3_v2_smooth_nose_stripe_mesh_{side}")
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(materials["ice_red"])
        mesh.update()
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        common.link_object(collection, f"ice3_v2_smooth_nose_stripe_{side}", mesh, parent=root)

    tip_lateral, tip_vertical, _tip_center = cap_factors(HALF_LENGTH)
    tip_half_width = station_parameters(HALF_LENGTH)[0] * tip_lateral * 1.018
    tip_z = centerline[-1][1]
    tip_half_thickness = centerline[-1][2] * (0.70 + 0.30 * tip_vertical)
    bridge_vertices = (
        (HALF_LENGTH + 0.006, -tip_half_width, tip_z - tip_half_thickness),
        (HALF_LENGTH + 0.006, tip_half_width, tip_z - tip_half_thickness),
        (HALF_LENGTH + 0.006, tip_half_width, tip_z + tip_half_thickness),
        (HALF_LENGTH + 0.006, -tip_half_width, tip_z + tip_half_thickness),
    )
    bridge_mesh = bpy.data.meshes.new("ice3_v2_front_stripe_bridge_mesh")
    bridge_mesh.from_pydata(bridge_vertices, [], [(0, 1, 2, 3)])
    bridge_mesh.materials.append(materials["ice_red"])
    bridge_mesh.update()
    common.link_object(collection, "ice3_v2_front_stripe_bridge", bridge_mesh, parent=root)


def add_running_gear(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    for index, x in enumerate((CALIBRATION_GUIDES["rearBogieCenterXMeters"], CALIBRATION_GUIDES["frontBogieCenterXMeters"])):
        common.add_bogie(
            collection,
            root,
            cube,
            cylinder,
            materials,
            name=f"ice3_v2_end_car_bogie_{index}",
            x=x,
            axle_spacing=2.50,
            wheel_radius=0.46,
            bogie_width=2.02,
        )
    common.add_box(collection, cube, "ice3_v2_underframe_spine", (21.2, 1.92, 0.20), (-1.1, 0, 0.80), materials["underframe"], root)
    for index, (x, length) in enumerate(((-6.1, 3.0), (-2.8, 3.3), (0.65, 3.15), (4.1, 2.9))):
        common.add_box(collection, cube, f"ice3_v2_underbody_fairing_{index}", (length, 2.42, 0.52), (x, 0, 0.92), materials["fairing"], root)
    for x in (-4.8, -1.5, 1.6):
        common.add_box(collection, cube, f"ice3_v2_traction_equipment_{x}", (2.25, 1.80, 0.38), (x, 0, 0.68), materials["underframe"], root)


def add_front_details(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    # Every lamp component is a surface patch ray-cast onto the actual exported
    # nose shell. This avoids the old analytic plane drifting in front of, or
    # cutting through, the curved Blender geometry.
    def nose_surface_hit(y: float, z: float) -> tuple[Vector, Vector]:
        depsgraph = bpy.context.evaluated_depsgraph_get()
        target_names = {"ice3_v2_reference_calibrated_cab_shell", "ice3_v2_convex_nose_cap"}
        world_origin = Vector((20.0, y, z))
        world_direction = Vector((-1.0, 0.0, 0.0))
        candidates: list[tuple[float, Vector, Vector]] = []
        for target_name in target_names:
            source_object = bpy.data.objects.get(target_name)
            if source_object is None:
                continue
            evaluated = source_object.evaluated_get(depsgraph)
            inverse = evaluated.matrix_world.inverted()
            local_origin = inverse @ world_origin
            local_direction = (inverse.to_3x3() @ world_direction).normalized()
            hit, local_location, local_normal, _face_index = evaluated.ray_cast(
                local_origin, local_direction, distance=20.0
            )
            if not hit:
                continue
            world_location = evaluated.matrix_world @ local_location
            world_normal = (evaluated.matrix_world.to_3x3() @ local_normal).normalized()
            candidates.append((world_location.x, world_location, world_normal))
        if candidates:
            _front_x, location, normal = max(candidates, key=lambda candidate: candidate[0])
            outward = normal
            if outward.dot(Vector((1.0, 0.0, 0.0))) < 0:
                outward.negate()
            return location, outward
        raise RuntimeError(f"Could not seat ICE 3 headlight patch on nose at y={y:.3f}, z={z:.3f}")

    def nose_tangent_plane(side: int) -> tuple[Vector, Vector, Vector, Vector, float, float]:
        center_y = side * 0.27
        center_z = 1.78
        center, normal = nose_surface_hit(center_y, center_z)
        y_sample, _ = nose_surface_hit(center_y + side * 0.025, center_z)
        z_sample, _ = nose_surface_hit(center_y, center_z + 0.025)
        lateral = (y_sample - center).normalized()
        vertical = z_sample - center
        vertical -= lateral * vertical.dot(lateral)
        vertical.normalize()
        if vertical.z < 0:
            vertical.negate()
        return center + normal * 0.014, lateral, vertical, normal, abs(center_y), center_z

    def surface_patch(
        name: str,
        yz_points: Sequence[tuple[float, float]],
        material: bpy.types.Material,
        *,
        plane: tuple[Vector, Vector, Vector, Vector, float, float],
        layer_offset: float,
    ) -> None:
        plane_origin, lateral, vertical, normal, center_abs_y, center_z = plane

        def plane_point(y: float, z: float) -> tuple[float, float, float]:
            point = plane_origin.copy()
            point += lateral * (abs(y) - center_abs_y)
            point += vertical * (z - center_z)
            point += normal * layer_offset
            return (point.x, point.y, point.z)

        center_y = sum(y for y, _z in yz_points) / len(yz_points)
        polygon_center_z = sum(z for _y, z in yz_points) / len(yz_points)
        vertices = [plane_point(center_y, polygon_center_z)]
        vertices.extend(plane_point(y, z) for y, z in yz_points)
        faces = [
            (0, 1 + index, 1 + (index + 1) % len(yz_points))
            for index in range(len(yz_points))
        ]
        mesh = bpy.data.meshes.new(f"{name}_mesh")
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(material)
        mesh.update()
        common.link_object(collection, name, mesh, parent=root)

    for side in (-1, 1):
        plane = nose_tangent_plane(side)
        housing_points = (
            (side * 0.155, 1.58),
            (side * 0.205, 1.96),
            (side * 0.385, 2.00),
            (side * 0.355, 1.58),
        )
        if side < 0:
            housing_points = tuple(reversed(housing_points))
        surface_patch(
            f"ice3_v2_headlight_housing_{side}",
            housing_points,
            materials["seal"],
            plane=plane,
            layer_offset=0.000,
        )

        def lamp_points(center_y: float, center_z: float, radius_y: float, radius_z: float) -> tuple[tuple[float, float], ...]:
            points = tuple(
                (center_y + radius_y * math.cos(2 * math.pi * index / 24), center_z + radius_z * math.sin(2 * math.pi * index / 24))
                for index in range(24)
            )
            return points if side > 0 else tuple(reversed(points))

        surface_patch(
            f"ice3_v2_main_headlamp_{side}",
            lamp_points(side * 0.270, 1.675, 0.070, 0.062),
            materials["lamp"],
            plane=plane,
            layer_offset=0.007,
        )
        for slat_index, center_z in enumerate((1.805, 1.865, 1.925)):
            slat_half_y = 0.067
            slat_half_z = 0.012
            slat_center_y = side * 0.290
            slat_points = (
                (slat_center_y - slat_half_y, center_z - slat_half_z),
                (slat_center_y - slat_half_y, center_z + slat_half_z),
                (slat_center_y + slat_half_y, center_z + slat_half_z),
                (slat_center_y + slat_half_y, center_z - slat_half_z),
            )
            if side < 0:
                slat_points = tuple(reversed(slat_points))
            surface_patch(
                f"ice3_v2_headlight_grille_slat_{side}_{slat_index}",
                slat_points,
                materials["fairing"],
                plane=plane,
                layer_offset=0.006,
            )
    common.add_box(collection, cube, "ice3_v2_coupler_hatch", (0.045, 0.24, 0.10), (HALF_LENGTH + 0.045, 0, 1.16), materials["underframe"], root)


def add_roof_and_rear_details(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    for index, (x, length) in enumerate(((-7.4, 2.1), (-4.2, 2.4), (-1.0, 2.2), (2.0, 1.8))):
        common.add_box(collection, cube, f"ice3_v2_roof_fairing_{index}", (length, 1.28, 0.10), (x, 0, 3.955), materials["roof"], root)
    rear_x = REAR_SHELL_X
    common.add_box(collection, cube, "ice3_v2_rear_gangway", (0.16, 1.35, 2.30), (rear_x, 0, 2.02), materials["underframe"], root)
    common.add_box(collection, cube, "ice3_v2_rear_coupler", (0.44, 0.22, 0.17), (rear_x - 0.18, 0, 0.72), materials["underframe"], root)


def add_reference_guides() -> None:
    guide_collection = common.make_collection("Reference_Guides_NOT_EXPORTED")
    download_dir = Path.home() / "Downloads"
    guide_specs = (
        ("ice3_v2_side_reference_guide", download_dir / "ice_car_sideview.jpg", (0, -4.5, 2.2), 18.0),
        ("ice3_v2_front_reference_guide", download_dir / "ice_3_front_forwardview.jpg.avif", (16.0, 0, 2.2), 5.2),
        ("ice3_v2_three_quarter_reference_guide", download_dir / "ice_3_front-side_view.jpeg", (8.0, 4.5, 2.2), 8.0),
    )
    for name, path, location, display_size in guide_specs:
        empty = common.add_empty(guide_collection, name)
        empty.location = location
        empty.empty_display_size = display_size
        empty["research_only"] = True
        empty["reference_filename"] = path.name
        empty["packed_or_exported"] = False
        if not path.exists():
            continue
        try:
            image = bpy.data.images.load(str(path), check_existing=True)
            empty.empty_display_type = "IMAGE"
            empty.data = image
            empty.empty_image_depth = "BACK"
            empty.color[3] = 0.32
        except RuntimeError:
            # AVIF support differs by Blender build. The calibration numbers
            # remain recorded even when a local reference cannot be displayed.
            empty["image_load_status"] = "unsupported-local-format"


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result = [root]
    for child in root.children:
        result.extend(descendants(child))
    return result


def export_glb(root: bpy.types.Object, path: Path) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in descendants(root):
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=True,
        export_tangents=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_materials="EXPORT",
        check_existing=False,
    )


def build_cab_checkpoint(
    collection: bpy.types.Collection,
    cube: bpy.types.Mesh,
    cylinder: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    root = common.add_empty(collection, "ice3_br403_v2_cab_checkpoint_root")
    root["candidate"] = "DB ICE 3 Class 403 V2 cab checkpoint"
    root["vehicle_role"] = "403.0 first-class end car"
    root["review_stage"] = "cab"
    root["approval_status"] = "private review only"
    root["production_registry_modified"] = False
    root["length_m"] = END_CAR_LENGTH
    root["future_formation_vehicle_count"] = 8
    root["reference_tolerance_percent"] = 2.0
    for index, source in enumerate(OFFICIAL_SOURCES, start=1):
        root[f"source_{index}"] = source
    common.add_metric_contract(collection, root, add_anchor=True)

    add_mirrored_shell(collection, root, materials["ice_white"])
    add_convex_nose_cap(collection, root, materials["ice_white"])
    add_panoramic_windscreen(collection, root, cube, materials)
    add_side_cab_windows(collection, root, materials)
    add_passenger_glazing(collection, root, cube, materials)
    add_passenger_door(collection, root, materials)
    add_textured_quad(collection, root, -1, materials["decal"])
    add_textured_quad(collection, root, 1, materials["decal"])
    add_nose_stripe(collection, root, materials)
    add_running_gear(collection, root, cube, cylinder, materials)
    add_front_details(collection, root, cube, cylinder, materials)
    add_roof_and_rear_details(collection, root, cube, materials)
    return root


def add_review_environment(
    assets: bpy.types.Collection,
    cube: bpy.types.Mesh,
    materials: dict[str, bpy.types.Material],
) -> None:
    review = common.make_collection("ICE3_BR403_V2_Review_Environment_NOT_EXPORTED", assets)
    root = common.add_empty(review, "review_environment_root")
    common.add_box(review, cube, "review_ground", (54, 26, 0.26), (0, 0, -0.64), materials["ground"], root)
    common.add_box(review, cube, "review_ballast", (44, 3.8, 0.30), (0, 0, -0.38), materials["ballast"], root)
    for y in (-WHEEL_TREAD_CENTER_METERS, WHEEL_TREAD_CENTER_METERS):
        common.add_box(review, cube, f"review_rail_{y}", (44, 0.075, 0.12), (0, y, -0.06), materials["steel"], root)
    for index in range(45):
        common.add_box(review, cube, f"review_sleeper_{index:03d}", (0.16, 2.58, 0.095), (-22 + index, 0, -0.168), materials["sleeper"], root)
    for x in (-18, -6, 6, 18):
        common.add_box(review, cube, f"review_catenary_post_{x}", (0.16, 0.16, 6.0), (x, 3.15, 2.82), materials["steel"], root)
        common.add_beam_between(review, cube, f"review_catenary_arm_{x}", (x, 3.15, 5.72), (x, 0, 5.50), 0.055, materials["steel"], root)
    common.add_box(review, cube, "review_contact_wire", (44, 0.035, 0.035), (0, 0, PANTOGRAPH_CONTACT_HEIGHT_METERS), materials["steel"], root)

    target = common.add_empty(review, "review_camera_target")
    target.location = (4.0, 0, 2.12)
    camera_data = bpy.data.cameras.new("ICE3_BR403_V2_Review_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 31
    camera = common.link_object(review, "ICE3_BR403_V2_Review_Camera", camera_data, location=(27, -32, 17))
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
    area_data.energy = 2400
    area_data.shape = "RECTANGLE"
    area_data.size = 28
    common.link_object(review, "ICE3_BR403_V2_Review_Fill", area_data, location=(4, -18, 22))


def write_manifest() -> None:
    manifest = {
        "schemaVersion": 2,
        "generator": "Blender 5.2 LTS Python API",
        "candidateId": "ice3-br403-v2-cab-checkpoint",
        "approvalStatus": "private-review",
        "reviewStage": "cab",
        "productionRegistryModified": False,
        "targetFormation": "modernized DB ICE 3 Class 403 eight-car set",
        "currentVehicle": "403.0 first-class end car",
        "currentVehicleCount": 1,
        "futureFormationVehicleCount": 8,
        "lengthMeters": END_CAR_LENGTH,
        "vehicleDimensionsMeters": {
            "length": END_CAR_LENGTH,
            "width": VEHICLE_WIDTH,
            "height": VEHICLE_HEIGHT,
        },
        "calibration": {
            "knownDimensionsMeters": {
                "endCarLength": END_CAR_LENGTH,
                "vehicleWidth": VEHICLE_WIDTH,
                "vehicleHeight": VEHICLE_HEIGHT,
            },
            "featureGuidesMeters": CALIBRATION_GUIDES,
            "silhouetteTolerancePercent": 2.0,
            "method": "mirrored subdivision shell from independent roof, width, lower-silhouette and shoulder stations",
        },
        "hybridDetail": {
            "atlas": str(ATLAS_PATH.relative_to(PROJECT_ROOT)),
            "dimensionsPixels": [2048, 512],
            "authorship": "original code-authored decal atlas",
            "containsPhotography": False,
            "containsProtectedLogos": False,
        },
        "masterBlend": str(MASTER_PATH.relative_to(PROJECT_ROOT)),
        "cabCheckpointGlb": str(OUTPUT_PATH.relative_to(PROJECT_ROOT)),
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
            "long low Class 403 nose tapering to a small lowered rounded tip without a planar front termination",
            "single continuous surface-conformed Class 403 windscreen with millimetre-scale seated layers and no centre divider",
            "swept four-pane cockpit-side glazing that follows the cab shoulder",
            "paired compact front-centre headlight housings with one main lamp and three grille slats per side",
            "lower continuous passenger-glass band with individually rounded apertures",
            "tall pressure-tight single-leaf passenger door",
            "low red stripe that widens toward the passenger body and wraps across the compact nose tip",
        ],
        "userReferenceFilenames": list(USER_REFERENCES),
        "referencePolicy": "Research only. Local images are referenced by filename, not copied, packed, textured, embedded, or shipped.",
        "sources": list(OFFICIAL_SOURCES),
        "nextApprovalGate": "Approve cab silhouette, windscreen, side glazing, door and stripe before generating the remaining seven vehicles.",
    }
    (SOURCE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ensure_directories()
    reset_scene()
    materials = make_materials()
    cube = common.unit_cube_mesh()
    cylinder = common.unit_cylinder_mesh(24)
    assets = common.make_collection("ICE3_BR403_V2_Blender_Assets")
    candidate_collection = common.make_collection("ICE3_BR403_V2_Cab_Checkpoint", assets)
    root = build_cab_checkpoint(candidate_collection, cube, cylinder, materials)
    export_glb(root, OUTPUT_PATH)
    add_reference_guides()
    add_review_environment(assets, cube, materials)
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER_PATH), compress=True)
    write_manifest()
    print("CORNER_RAILS_ICE3_BR403_V2_CAB_CHECKPOINT_GENERATED")


if __name__ == "__main__":
    main()
