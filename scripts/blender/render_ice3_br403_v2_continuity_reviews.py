"""Render reproducible ICE 3 Class 403 two-car continuity review views."""

from __future__ import annotations

from pathlib import Path

import bmesh
import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
scene = bpy.context.scene
scene.render.resolution_x = 1440
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 94
camera = scene.camera
if camera is None:
    raise RuntimeError("Prepared ICE 3 continuity review camera is missing")
camera.parent = None
camera.matrix_parent_inverse.identity()
target = bpy.data.objects.get("review_camera_target")
if target is None:
    raise RuntimeError("Prepared ICE 3 continuity camera target is missing")
constraint = next((item for item in camera.constraints if item.type == "TRACK_TO"), None)
if constraint is None:
    constraint = camera.constraints.new(type="TRACK_TO")
constraint.target = target
constraint.track_axis = "TRACK_NEGATIVE_Z"
constraint.up_axis = "UP_Y"

output = PROJECT_ROOT / "qa" / "train-review" / "ice3-br403-v2-continuity"
output.mkdir(parents=True, exist_ok=True)


def assert_closed_manifold(object_name: str) -> None:
    candidate = bpy.data.objects.get(object_name)
    if candidate is None or candidate.type != "MESH":
        raise RuntimeError(f"Required continuity shell is missing: {object_name}")
    mesh = bmesh.new()
    mesh.from_mesh(candidate.data)
    non_manifold = [edge.index for edge in mesh.edges if not edge.is_manifold]
    mesh.free()
    if non_manifold:
        raise RuntimeError(f"{object_name} has {len(non_manifold)} non-manifold edges")


assert_closed_manifold("ice3_v2_reference_calibrated_cab_shell")
assert_closed_manifold("ice3_continuity_shared_transformer_shell")
print("CORNER_RAILS_ICE3_CONTINUITY_MANIFOLD_OK")

views = {
    "normal-isometric": {"camera": (45, -52, 28), "target": (1.0, 0, 2.05), "ortho": 41},
    "exact-side": {"camera": (0, -70, 4.8), "target": (0, 0, 2.05), "ortho": 54},
    "nose-three-quarter": {"camera": (37, -21, 11.0), "target": (23.3, 0, 2.05), "ortho": 15.5},
    "nose-body-close": {"camera": (34, -19, 8.0), "target": (18.2, 0, 2.28), "ortho": 12.0},
    "carriage-junction-close": {"camera": (-0.53, -24, 5.0), "target": (-0.53, 0, 2.12), "ortho": 13.0},
    "window-band-close": {"camera": (-10, -26, 4.8), "target": (-10, 0, 2.40), "ortho": 16.0},
    "stripe-continuity-close": {"camera": (-0.53, -18, 3.8), "target": (-0.53, 0, 1.92), "ortho": 9.0},
    "transformer-roof": {"camera": (-13, -24, 16), "target": (-13, 0, 3.55), "ortho": 28},
}

for name, view in views.items():
    camera.location = view["camera"]
    camera.data.ortho_scale = view["ortho"]
    target.location = view["target"]
    scene.render.filepath = str(output / f"ice3-br403-v2-continuity-{name}.jpg")
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)
    print(f"CORNER_RAILS_RENDERED ice3-br403-v2-continuity {name}")
