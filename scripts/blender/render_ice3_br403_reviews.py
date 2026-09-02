"""Render reproducible ICE 3 BR403 recognition and calibration views."""

from __future__ import annotations

from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
scene = bpy.context.scene
scene.render.resolution_x = 1440
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 93
camera = scene.camera
if camera is None:
    raise RuntimeError("Prepared ICE 3 review camera is missing")
camera.parent = None
camera.matrix_parent_inverse.identity()
target = bpy.data.objects.get("review_camera_target")
if target is None:
    raise RuntimeError("Prepared ICE 3 camera target is missing")
constraint = next((item for item in camera.constraints if item.type == "TRACK_TO"), None)
if constraint is None:
    constraint = camera.constraints.new(type="TRACK_TO")
constraint.target = target
constraint.track_axis = "TRACK_NEGATIVE_Z"
constraint.up_axis = "UP_Y"

length = 200.32
end_length = 25.835
middle_length = 24.775
nose_center = length / 2 - end_length / 2
restaurant_center = length / 2 - end_length - 2 * middle_length - middle_length / 2
transformer_center = length / 2 - end_length - middle_length / 2
output = PROJECT_ROOT / "qa" / "train-review" / "ice3-br403"
output.mkdir(parents=True, exist_ok=True)

views = {
    "overview": {"camera": (112, -126, 70), "target": (0, 0, 2.25), "ortho": 130},
    "nose-detail": {"camera": (nose_center + 24, -34, 17), "target": (nose_center + 2, 0, 2.15), "ortho": 31},
    "bordrestaurant-side": {"camera": (restaurant_center, -34, 8.5), "target": (restaurant_center, 0, 2.10), "ortho": 31},
    "pantograph-detail": {"camera": (transformer_center + 7, -20, 13), "target": (transformer_center + 1.9, 0, 4.35), "ortho": 20},
    "wheel-rail-detail": {"camera": (nose_center - 4.0, -7, 3.4), "target": (nose_center - 5.2, 0, 0.55), "ortho": 7.5},
}

for name, view in views.items():
    camera.location = view["camera"]
    camera.data.ortho_scale = view["ortho"]
    target.location = view["target"]
    scene.render.filepath = str(output / f"ice3-br403-blender-{name}.jpg")
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)
    print(f"CORNER_RAILS_RENDERED ice3-br403 {name}")
