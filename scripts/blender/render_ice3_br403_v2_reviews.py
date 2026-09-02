"""Render reproducible Class 403 V2 full-formation approval views."""

from __future__ import annotations

from pathlib import Path

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
    raise RuntimeError("Prepared ICE 3 V2 review camera is missing")
camera.parent = None
camera.matrix_parent_inverse.identity()
target = bpy.data.objects.get("review_camera_target")
if target is None:
    raise RuntimeError("Prepared ICE 3 V2 camera target is missing")
constraint = next((item for item in camera.constraints if item.type == "TRACK_TO"), None)
if constraint is None:
    constraint = camera.constraints.new(type="TRACK_TO")
constraint.target = target
constraint.track_axis = "TRACK_NEGATIVE_Z"
constraint.up_axis = "UP_Y"

output = PROJECT_ROOT / "qa" / "train-review" / "ice3-br403-v2"
output.mkdir(parents=True, exist_ok=True)

views = {
    "normal-isometric": {"camera": (145, -150, 82), "target": (0, 0, 2.05), "ortho": 148},
    "exact-side": {"camera": (0, -230, 5.3), "target": (0, 0, 2.05), "ortho": 205},
    "front": {"camera": (122, 0, 3.0), "target": (99.45, 0, 1.85), "ortho": 5.3},
    "nose-three-quarter": {"camera": (112, -25, 12.0), "target": (96.1, 0, 2.05), "ortho": 16.5},
    "windscreen-close": {"camera": (108, -14, 8.0), "target": (96.1, 0, 2.7), "ortho": 8.3},
    "door-window-close": {"camera": (72.5, -22, 4.7), "target": (72.5, 0, 2.2), "ortho": 10.0},
    "wheel-rail-close": {"camera": (94.0, -8, 3.2), "target": (94.0, 0, 0.52), "ortho": 6.2},
    "bordrestaurant-side": {"camera": (12.3875, -42, 5.0), "target": (12.3875, 0, 2.20), "ortho": 28.5},
    "transformer-roof": {"camera": (70, -34, 18), "target": (61.9375, 0, 3.65), "ortho": 33},
    "service-car-side": {"camera": (-12.3875, -42, 5.0), "target": (-12.3875, 0, 2.20), "ortho": 28.5},
    "rear-end-three-quarter": {"camera": (-112, 25, 12.0), "target": (-96.1, 0, 2.05), "ortho": 16.5},
}

for name, view in views.items():
    camera.location = view["camera"]
    camera.data.ortho_scale = view["ortho"]
    target.location = view["target"]
    scene.render.filepath = str(output / f"ice3-br403-v2-{name}.jpg")
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)
    print(f"CORNER_RAILS_RENDERED ice3-br403-v2 {name}")
