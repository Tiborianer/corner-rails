"""Render reproducible recognition and rail-contact views from the Nightjet master."""

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
    raise RuntimeError("Prepared Nightjet review camera is missing")
camera.parent = None
camera.matrix_parent_inverse.identity()
target = bpy.data.objects.get("review_camera_target")
if target is None:
    raise RuntimeError("Prepared Nightjet camera target is missing")
constraint = next((item for item in camera.constraints if item.type == "TRACK_TO"), None)
if constraint is None:
    constraint = camera.constraints.new(type="TRACK_TO")
constraint.target = target
constraint.track_axis = "TRACK_NEGATIVE_Z"
constraint.up_axis = "UP_Y"

length = 204.675
taurus_center = length / 2 - 19.28 / 2
control_center = -length / 2 + 26.40 / 2
sleeping_center = taurus_center - 19.28 / 2 - 0.085 - 26.40 / 2
output = PROJECT_ROOT / "qa" / "train-review" / "nightjet-new-generation"
output.mkdir(parents=True, exist_ok=True)

views = {
    "overview": {"camera": (116, -126, 72), "target": (0, 0, 2.1), "ortho": 145},
    "taurus-1116-detail": {"camera": (taurus_center + 18, -27, 15), "target": (taurus_center, 0, 2.3), "ortho": 25},
    "control-car-detail": {"camera": (control_center - 21, -31, 17), "target": (control_center, 0, 2.35), "ortho": 31},
    "sleeping-couchette-side": {"camera": (sleeping_center - 30, -40, 12), "target": (sleeping_center - 18, 0, 2.3), "ortho": 49},
    "wheel-rail-detail": {"camera": (taurus_center + 8, -7, 3.6), "target": (taurus_center + 4.95, 0, 0.55), "ortho": 7.5},
}

for name, view in views.items():
    camera.location = view["camera"]
    camera.data.ortho_scale = view["ortho"]
    target.location = view["target"]
    scene.render.filepath = str(output / f"nightjet-new-generation-blender-{name}.jpg")
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)
    print(f"CORNER_RAILS_RENDERED nightjet-new-generation {name}")
