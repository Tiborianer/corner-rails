"""R3 rounded Dosto review. Preserve the approved BR245, rebuild three coaches.
Original surface geometry; supplied and researched photographs are not textures.
"""
import importlib.util
import json
import math
from pathlib import Path
import bpy

spec=importlib.util.spec_from_file_location("round_dosto",Path(__file__).with_name("generate_metronom.py"))
me=importlib.util.module_from_spec(spec)
spec.loader.exec_module(me)
c,re=me.c,me.re
ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/"public/models/train-lab/db-regional-express-r3"
SOURCE=ROOT/"assets/blender/db-regional-express-r3"


def front(y,z,offset=0):
    # A raked, crowned face, with curved lateral cheek transitions.
    return (-13.03+max(0,z-1.1)*.34+.28*(abs(y)/1.39)**4-offset,y,z)


def fitted_front(y,z,offset=0):
    limit=max(0,me.side_y(z,True)-.025)
    return front(max(-limit,min(limit,y)),z,offset)


def body(col,root,cab):
    profile=me.profile(True)
    vertices=[]
    # Multiple closely spaced sections form the rounded cab/body transition.
    stations=[0,.10,.25,.50,.75,1] if cab else [0,1]
    for t in stations:
        for y,z in profile:
            x=front(y,z)[0]*(1-t)+(-10.2)*t if cab else -13.2+26.4*t
            vertices.append((x,y,z))
    if cab: vertices.extend((13.2,y,z) for y,z in profile)
    n=len(profile);rings=len(vertices)//n
    faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(rings-1) for i in range(n)]
    if not cab:faces.append(tuple(reversed(range(n))))
    faces.append(tuple((rings-1)*n+i for i in range(n)))
    ob=me.mesh_object(col,root,"r3_continuous_rounded_shell",vertices,faces,M["traffic_red"])
    if cab:me.patch(col,root,"r3_crowned_front_surface",profile,lambda y,z:front(y,z),M["traffic_red"])
    ob.data.materials.append(M["roof"])
    ob.data.materials.append(M["mid_grey"])
    for p in ob.data.polygons:
        zs=[ob.data.vertices[i].co.z for i in p.vertices]
        if min(zs)>4.10:p.material_index=1
        elif max(zs)<1.14:p.material_index=2
    return ob


def coach(parent,role):
    cab=role=="driving_trailer"
    col=c.make_collection("R3_"+role,parent)
    root=c.add_empty(col,"r3_"+role+"_root")
    root["vehicle_role"]=role
    root["length_m"]=26.8
    body(col,root,cab)
    for side in (-1,1):
        start=-10.25 if cab else -13.18
        me.band(col,root,f"r3_white_belt_{role}_{side}",side,True,start,13.18,lambda x:2.89,lambda x:3.03,M["light_grey"])
        me.band(col,root,f"r3_skirt_{role}_{side}",side,True,start,13.18,lambda x:.94,lambda x:1.12,M["mid_grey"])
        doors=(-8.25,10.25) if cab else (-10.25,10.25)
        upper=[-7.60+i*1.68 for i in range(10)] if not cab else [-6.45+i*1.88 for i in range(8)]
        lower=[-7.55+i*1.88 for i in range(9)] if not cab else [-5.7+i*2.05 for i in range(7)]
        for level,z,h,xs in [("upper",3.61,.72,upper),("lower",1.68,.66,lower)]:
            for i,x in enumerate(xs):
                me.side_window(col,root,f"r3_{role}_{level}_{side}_{i}",x,z,1.20,h,side,True,.07)
        for i,x in enumerate(doors):
            surf=me.side_surface(side,True,.025)
            me.patch(col,root,f"r3_door_seal_{role}_{side}_{i}",me.rounded_outline(x,2.00,1.57,2.14,.07),surf,M["seal"])
            me.patch(col,root,f"r3_door_leaf_{role}_{side}_{i}",me.rounded_outline(x,2.00,1.43,2.03,.055),me.side_surface(side,True,.033),M["light_grey"])
            for leaf in (-1,1):
                me.side_window(col,root,f"r3_door_glass_{role}_{side}_{i}_{leaf}",x+leaf*.32,2.47,.25,.96,side,True,.12)
            me.box(col,root,f"r3_door_seam_{role}_{side}_{i}",(.018,.018,1.95),(x,side*1.442,2.0),"seal")
            me.box(col,root,f"r3_door_step_{role}_{side}_{i}",(1.46,.20,.08),(x,side*1.42,.90),"steel")
            c.add_text_label(col,f"r3_class_{role}_{side}_{i}","2",(x+.96,side*1.45,2.55),M["light_grey"],root,side=side,size=.28)
        if role=="mixed_class":
            me.band(col,root,f"r3_first_class_{side}",side,True,1.8,8.5,lambda x:4.05,lambda x:4.12,M["first_marker"])
        # Vestibule windows beyond the outer doors, present on the references.
        if not cab: me.side_window(col,root,f"r3_vestibule_{side}",-12.15,2.63,.80,.52,side,True,.07)
        if cab:
            outline=[(-12.13,2.59),(-10.5,2.75),(-10.5,3.34),(-11.58,3.30)]
            me.patch(col,root,f"r3_swept_side_cab_{side}",outline,me.side_surface(side,True,.028),M["seal"])
            inset=[(-12.01,2.66),(-10.58,2.81),(-10.58,3.27),(-11.54,3.23)]
            me.patch(col,root,f"r3_swept_side_cab_glass_{side}",inset,me.side_surface(side,True,.036),M["glass"])
            me.side_window(col,root,f"r3_cab_vestibule_{side}",-9.58,2.70,.46,.66,side,True,.04)
    if cab:
        for name,shape,mat,offset in [
            ("grey_surround",me.rounded_outline(0,3.05,2.34,2.94,.34),"roof",.025),
            ("screen_seal",me.rounded_outline(0,2.91,1.88,1.34,.07),"seal",.045),
            ("panoramic_glass",me.rounded_outline(0,2.91,1.73,1.19,.05),"glass",.052),
            ("destination_seal",me.rounded_outline(0,3.79,1.84,.40,.04),"seal",.044),
            ("upper_lamp",me.rounded_outline(0,4.30,.20,.22,.10),"lamp",.05),
        ]:me.patch(col,root,"r3_cab_"+name,shape,lambda y,z,o=offset:fitted_front(y,z,o),M[mat])
        for i in range(10):me.patch(col,root,f"r3_destination_{i}",me.rounded_outline(-.64+i*.14,3.80,.06,.16,.012),lambda y,z:front(y,z,.052),M["display"])
        for side in (-1,1):
            me.patch(col,root,f"r3_headlamp_recess_{side}",me.rounded_outline(side*.64,2.03,.50,.32,.04),lambda y,z:front(y,z,.046),M["seal"])
            for j in (-1,1):me.patch(col,root,f"r3_headlamp_{side}_{j}",me.rounded_outline(side*.64+j*.11,2.03,.15,.17,.075),lambda y,z:front(y,z,.055),M["lamp"] if j==side else M["glass"])
        me.beam(col,root,"r3_wiper",front(-.20,2.25,.08),front(.60,3.31,.08),.035,"seal")
    me.undercarriage(col,root,"r3_"+role,True)
    for sign in ((1,) if cab else (-1,1)):
        me.box(col,root,f"r3_gangway_{role}_{sign}",(.32,1.16,2.48),(sign*13.32,0,2.2),"seal")
        for i in range(5):me.box(col,root,f"r3_bellows_{role}_{sign}_{i}",(.025,1.24,2.54),(sign*(13.18+i*.06),0,2.2),"underframe")
    me.box(col,root,"r3_low_profile_hvac",(2.8,1.45,.14),(6.6,0,4.63),"roof")
    for i in range(12):me.box(col,root,f"r3_hvac_grille_{i}",(.035,1.15,.025),(5.5+i*.2,0,4.714),"seal")
    return root


def main():
    global M
    SOURCE.mkdir(parents=True,exist_ok=True);DEST.mkdir(parents=True,exist_ok=True)
    re.reset_scene();M=me.materials();me.M=M;me.CUBE=c.unit_cube_mesh();me.CYL=c.unit_cylinder_mesh(24)
    assets=c.make_collection("DBRE_R3");prototypes=c.make_collection("R3_Prototypes",assets)
    modules={"br245":re.build_br245(prototypes,me.CUBE,me.CYL,M)}
    for role in ("mixed_class","second_class","driving_trailer"):modules[role]=coach(prototypes,role)
    for role,root in modules.items():
        anchor=c.add_metric_contract(root.users_collection[0],root,add_anchor=True)
        c.export_glb(root,DEST/(role+".glb"));anchor.name=role+"_rail_contact_origin"
    formation=re.build_formation(modules,assets,me.CUBE,M)
    formation.name="db_regional_express_r3_root"
    c.export_glb(formation,DEST/"db-regional-express-r3.glb")
    re.add_review_environment(assets,formation,me.CUBE,M)
    prototypes.hide_render=True;prototypes.hide_viewport=True
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"db-regional-express-r3-master.blend"),compress=True)
    manifest={"candidateId":"db-regional-express-r3","approvalStatus":"private-review","vehicleCount":4,"lengthMeters":re.FORMATION_LENGTH,
        "productionRegistryModified":False,"locomotive":"Approved BR245 generator preserved; new rounded coaches and driving trailer",
        "profile":{"width":2.78,"height":4.63,"upperDeckShoulderBase":3.13,"gauge":1.435,"wheelContact":0},
        "references":["Regio_Clean_side_view.jpg","Regio_miniature_view.jpg","Regio_real_photo_back view.jpg","Regio_single_cabcar_side_view.jpg"],
        "sources":["https://www.rmv.de/c/de/fahrplan/linien-netze/fahrzeugtypen/regionalzuege/doppelstockwagen-lokbespannt/doppelstockwagen","https://www.tillig.com/Produkte/Doppelstockwagen.html","https://www.bahnbilder.de/bild/deutschland~strecken~kbs-590-halle-kasseler-bahn/1233205/blick-auf-einen-doppelstock-steuerwagen-der-2.html"],
        "notes":"Reference-guided original geometry, no photographs or logos embedded. Specific carriage subtype is not claimed."}
    (SOURCE/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")

if __name__=="__main__":main()
