"""Render reproducible recognition and rail-contact views from the DB RE master."""

from __future__ import annotations

from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
scene = bpy.context.scene
scene.render.resolution_x = 1440
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 92
camera = scene.camera
if camera is None:
    raise RuntimeError("Prepared DB Regional-Express review camera is missing")
camera.parent = None
camera.matrix_parent_inverse.identity()
target = bpy.data.objects.get("review_camera_target")
if target is None:
    raise RuntimeError("Prepared DB Regional-Express camera target is missing")
constraint = next((item for item in camera.constraints if item.type == "TRACK_TO"), None)
if constraint is None:
    constraint = camera.constraints.new(type="TRACK_TO")
constraint.target = target
constraint.track_axis = "TRACK_NEGATIVE_Z"
constraint.up_axis = "UP_Y"

length = 99.84
loco_center = length / 2 - 18.90 / 2
tail_center = -length / 2 + 26.80 / 2
output = PROJECT_ROOT / "qa" / "train-review" / "db-regional-express"
output.mkdir(parents=True, exist_ok=True)

views = {
    "overview": {"camera": (57, -64, 36), "target": (0, 0, 2.05), "ortho": 69},
    "br245-detail": {"camera": (loco_center + 16, -25, 14), "target": (loco_center, 0, 2.2), "ortho": 24},
    "driving-trailer-detail": {"camera": (tail_center - 18, -28, 16), "target": (tail_center, 0, 2.3), "ortho": 28},
    "double-deck-side": {"camera": (-2, -34, 10), "target": (-2, 0, 2.3), "ortho": 35},
    "wheel-rail-detail": {"camera": (loco_center + 8, -7, 3.6), "target": (loco_center + 5.45, 0, 0.55), "ortho": 7.5},
}

for name, view in views.items():
    camera.location = view["camera"]
    camera.data.ortho_scale = view["ortho"]
    target.location = view["target"]
    scene.render.filepath = str(output / f"db-regional-express-blender-{name}.jpg")
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)
    print(f"CORNER_RAILS_RENDERED db-regional-express {name}")
