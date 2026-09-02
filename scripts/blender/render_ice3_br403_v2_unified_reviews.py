"""Render reproducible ICE 3 Class 403 unified-formation review views."""

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
    raise RuntimeError("Prepared ICE 3 unified review camera is missing")
camera.parent = None
camera.matrix_parent_inverse.identity()
target = bpy.data.objects.get("review_camera_target")
if target is None:
    raise RuntimeError("Prepared ICE 3 unified camera target is missing")
constraint = next((item for item in camera.constraints if item.type == "TRACK_TO"), None)
if constraint is None:
    constraint = camera.constraints.new(type="TRACK_TO")
constraint.target = target
constraint.track_axis = "TRACK_NEGATIVE_Z"
constraint.up_axis = "UP_Y"

output = PROJECT_ROOT / "qa" / "train-review" / "ice3-br403-v2-unified"
output.mkdir(parents=True, exist_ok=True)

vehicle_roots = [obj for obj in bpy.data.objects if obj.get("formation_index") is not None]
if len(vehicle_roots) != 8:
    raise RuntimeError(f"Expected 8 unified formation vehicles, found {len(vehicle_roots)}")
print("CORNER_RAILS_ICE3_UNIFIED_EIGHT_CARS_OK")

views = {
    "normal-isometric": {"camera": (112, -126, 70), "target": (0, 0, 2.25), "ortho": 132},
    "exact-side": {"camera": (0, -185, 5.3), "target": (0, 0, 2.12), "ortho": 212},
    "nose-three-quarter": {"camera": (113, -22, 12.0), "target": (98.0, 0, 2.1), "ortho": 18.0},
    "first-junction-close": {"camera": (75.1, -28, 5.0), "target": (75.1, 0, 2.12), "ortho": 16.0},
    "bordrestaurant-side": {"camera": (13.1, -37, 5.0), "target": (13.1, 0, 2.20), "ortho": 29.0},
    "service-car-side": {"camera": (-11.7, -37, 5.0), "target": (-11.7, 0, 2.20), "ortho": 29.0},
    "transformer-roof": {"camera": (74, -29, 17), "target": (75.0, 0, 3.5), "ortho": 32.0},
}

for name, view in views.items():
    camera.location = view["camera"]
    camera.data.ortho_scale = view["ortho"]
    target.location = view["target"]
    scene.render.filepath = str(output / f"ice3-br403-v2-unified-{name}.jpg")
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)
    print(f"CORNER_RAILS_RENDERED ice3-br403-v2-unified {name}")

# A darker deterministic frame makes the emissive lenses and the two real
# review beams visible on the rail bed. Restore is unnecessary in background QA.
world = scene.world
if world and world.use_nodes:
    background = next((node for node in world.node_tree.nodes if node.type == "BACKGROUND"), None)
    if background:
        background.inputs["Color"].default_value = (0.008, 0.015, 0.035, 1)
        background.inputs["Strength"].default_value = 0.08
sun = bpy.data.lights.get("ICE3_BR403_V2_Unified_Review_Sun")
fill = bpy.data.lights.get("ICE3_BR403_V2_Unified_Review_Fill")
if sun:
    sun.energy = 0.10
if fill:
    fill.energy = 120
camera.location = (113, -22, 9.2)
camera.data.ortho_scale = 20.0
target.location = (101.0, 0, 1.65)
scene.render.filepath = str(output / "ice3-br403-v2-unified-night-headlights.jpg")
bpy.context.view_layer.update()
bpy.ops.render.render(write_still=True)
print("CORNER_RAILS_RENDERED ice3-br403-v2-unified night-headlights")
