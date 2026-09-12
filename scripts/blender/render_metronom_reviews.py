"""Reproducible overview, exact sides and cab recognition views."""
from pathlib import Path
import bpy
import sys

ROOT = Path(__file__).resolve().parents[2]
candidate = sys.argv[sys.argv.index("--")+1] if "--" in sys.argv else "metronom-br146"
if candidate not in ("metronom-br146", "metronom-br146-flat", "db-regional-express-r3"):
    raise ValueError("Unsupported review candidate")
OUTPUT = ROOT / "qa/train-review" / candidate
OUTPUT.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.render.resolution_x = 1440
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 92
scene.eevee.taa_render_samples = 48
camera = scene.camera
camera.parent = None
camera.matrix_parent_inverse.identity()
target = bpy.data.objects["review_camera_target"]
views = {
    "overview": ((60,-76,44),(0,0,2.2),94),
    "locomotive-front-side": ((58,-23,11),(40.65,0,2.5),24),
    "locomotive-side": ((40.65,-40,2.6),(40.65,0,2.6),23),
    "cab-car-front-side": ((-58,-25,11),(-37.1,0,2.5),29),
    "cab-car-front": ((-70,0,2.7),(-49,0,2.7),7.3),
    "coach-side": ((17.5,-40,2.7),(17.5,0,2.7),30),
    "wheel-contact": ((49,-6,2.2),(45.8,0,.55),7.5),
}
for name,(position,aim,scale) in views.items():
    camera.location=position
    camera.data.ortho_scale=scale
    target.location=aim
    scene.render.filepath=str(OUTPUT/(name+".jpg"))
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)
    print("METRONOM_RENDERED",name)
