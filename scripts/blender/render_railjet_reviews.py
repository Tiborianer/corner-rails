"""Render reproducible overview and recognition-critical Blender QA views.

Usage (after --python):
  -- classic
  -- nextgen
"""

from __future__ import annotations

import sys
from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
generation = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "classic"
if generation not in {"classic", "nextgen"}:
    raise ValueError("generation must be classic or nextgen")

scene = bpy.context.scene
scene.render.resolution_x = 1440
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 90
camera = scene.camera
if camera is None:
    raise RuntimeError("Prepared Railjet review camera is missing")
camera.parent = None
camera.matrix_parent_inverse.identity()
target = bpy.data.objects.get("review_camera_target")
if target is None:
    raise RuntimeError("Prepared Railjet camera target is missing")
constraint = next((item for item in camera.constraints if item.type == "TRACK_TO"), None)
if constraint is None:
    constraint = camera.constraints.new(type="TRACK_TO")
constraint.target = target
constraint.track_axis = "TRACK_NEGATIVE_Z"
constraint.up_axis = "UP_Y"

length = 205.375 if generation == "classic" else 258.0
lead_center = length / 2 - 19.28 / 2
lead_bogie_center = lead_center + 4.95
tail_center = -length / 2 + (26.5 if generation == "classic" else 26.4394) / 2
output = PROJECT_ROOT / "qa" / "railjet-lab"
output.mkdir(parents=True, exist_ok=True)

views = {
    "overview": {
        "camera": (length * 0.60, -length * 0.50, length * 0.27),
        "target": (0.0, 0.0, 1.7),
        "ortho": length * 0.67,
    },
    "taurus-detail": {
        "camera": (lead_center + 18.0, -28.0, 16.5),
        "target": (lead_center, 0.0, 2.15),
        "ortho": 27.0,
    },
    "driving-trailer-detail": {
        "camera": (tail_center - 19.0, -29.0, 16.5),
        "target": (tail_center, 0.0, 2.1),
        "ortho": 31.0,
    },
    "wheel-rail-detail": {
        "camera": (lead_bogie_center + 4.5, -7.0, 3.8),
        "target": (lead_bogie_center, 0.0, 0.48),
        "ortho": 7.8,
    },
}

for name, view in views.items():
    camera.location = view["camera"]
    camera.data.ortho_scale = view["ortho"]
    target.location = view["target"]
    scene.render.filepath = str(output / f"{generation}-blender-{name}.jpg")
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)
    print(f"CORNER_RAILS_RENDERED {generation} {name}")
