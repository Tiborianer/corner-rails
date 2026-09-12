"""Original metronom TRAXX 2 / curved-livery four-vehicle review set.

Reference images remain outside the repository. Coordinates are metres, X along
the train, Y across, Z up; tread bottoms sit on the rail-contact plane Z=0.
Only reusable bogie/export utilities are borrowed from the Regional-Express.
The electric locomotive and rounded control-car face are purpose-built here.
"""
from __future__ import annotations

import importlib.util
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("metronom_helpers", Path(__file__).with_name("generate_db_regional_express.py"))
re = importlib.util.module_from_spec(spec)
spec.loader.exec_module(re)
c = re.common
FLAT_LIVERY = "--flat" in sys.argv
CANDIDATE = "metronom-br146-flat" if FLAT_LIVERY else "metronom-br146"
SOURCE = ROOT / "assets/blender" / CANDIDATE
OUTPUT = ROOT / "public/models/train-lab" / CANDIDATE
LENGTHS = {"br146": 18.90, "second_class": 26.80, "bicycle": 26.80, "cab_car": 26.80}
GAP = 0.30
LENGTH = sum(LENGTHS.values()) + 3 * GAP
SOURCES = [
    "https://www.der-metronom.de/unternehmen/ueber-uns/",
    "https://www.der-metronom.com/fahrplan/wagenreihung/",
    "https://www.marklin.com/products/details/article/26611",
    "https://static.maerklin.de/damcontent/40/b0/40b0a1fe9e87c66b9f0497bf4ba8254b1434542051.pdf",
    "https://www.deutschebahn.com/resource/blob/12723972/27f230ccadd935116edcb92217fda017/DB-Wg-D_____11-2004_Doppelstock-data.pdf",
]
REFERENCES = ["metronom_locomotive_side.jpg", "metronom_full_locomotive_front_side.jpeg",
              "metronom_cab_car_front_side.jpeg", "metronom_cab_car_front.jpg",
              "metronom_full_consist_front.jpg", "metronom_locomotive_front_side.jpeg", "metronom_full_consist.jpg"]


def materials():
    m = re.make_materials()
    def make(key, color, metallic=.12, roughness=.36):
        m[key] = c.make_material("ME_" + key, (*color, 1), metallic=metallic, roughness=roughness)
    make("yellow", (.95, .70, .006), .05)
    make("blue", (.012, .038, .22), .12)
    make("white", (.82, .85, .86), .12)
    make("roof", (.23, .26, .29), .28, .48)
    make("glass", (.025, .055, .073), .26, .19)
    make("glass_reflection", (.12, .19, .23), .25, .21)
    make("seal", (.012, .016, .021), .0, .58)
    make("insulator", (.24, .052, .023), .12)
    make("door_seam", (.010, .023, .07), .12)
    return m


def mesh_object(col, root, name, vertices, faces, material, smooth=True):
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = c.link_object(col, name, mesh, parent=root)
    # Recalculate all face normals, including generated front/side patches.
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = smooth
    return obj


def rounded_outline(x, z, w, h, radius=.08, steps=5):
    r = min(radius, w / 2, h / 2)
    points = []
    for cx, cz, angle in [(x+w/2-r,z+h/2-r,0), (x-w/2+r,z+h/2-r,90),
                          (x-w/2+r,z-h/2+r,180), (x+w/2-r,z-h/2+r,270)]:
        for i in range(steps+1):
            a = math.radians(angle+i*90/steps)
            points.append((cx + r*math.cos(a), cz + r*math.sin(a)))
    return points


def patch(col, root, name, outline, surface, material):
    """Slice at every body-profile corner before projecting onto the shell.

    A single triangulated polygon bridges curved roof sections and disappears
    inside the shell. These strips conform to the exact same piecewise profile.
    Front patches also subdivide laterally across their crowned face.
    """
    from mathutils.geometry import tessellate_polygon
    def clip(poly, axis, bound, greater):
        output=[]
        for a,b in zip(poly,poly[1:]+poly[:1]):
            ina=(a[axis]>=bound-1e-8) if greater else (a[axis]<=bound+1e-8)
            inb=(b[axis]>=bound-1e-8) if greater else (b[axis]<=bound+1e-8)
            if ina: output.append(a)
            if ina != inb:
                t=(bound-a[axis])/(b[axis]-a[axis])
                output.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
        return output
    umin,umax=min(p[0] for p in outline),max(p[0] for p in outline)
    zmin,zmax=min(p[1] for p in outline),max(p[1] for p in outline)
    cuts=sorted(set([zmin,zmax]+[z for coach in (False,True) for _,z in profile(coach) if zmin<z<zmax]))
    q0,q1=surface(umin,zmin),surface(umin+.01,zmin)
    front=abs(q1[1]-q0[1])>.005
    ucuts=[umin,umax] if not front else [umin+(umax-umin)*i/16 for i in range(17)]
    vertices=[]
    faces=[]
    for za,zb in zip(cuts,cuts[1:]):
        strip=clip(clip(outline,1,za,True),1,zb,False)
        for ua,ub in zip(ucuts,ucuts[1:]):
            poly=clip(clip(strip,0,ua,True),0,ub,False) if front else strip
            if len(poly)<3: continue
            points=[Vector((u,v,0)) for u,v in poly]
            tris=tessellate_polygon([points])
            lookup={(round(p.x,6),round(p.y,6)):i for i,p in enumerate(points)}
            offset=len(vertices)
            vertices.extend(surface(u,v) for u,v in poly)
            for tri in tris:
                faces.append(tuple(offset+(p if isinstance(p,int) else lookup[(round(p.x,6),round(p.y,6))]) for p in tri))
    return mesh_object(col, root, name, vertices, faces, material, True)


def loco_front(y, z, sign=1, offset=0):
    # TRAXX 2: broad, flat central face with a rake above the waist and
    # progressively chamfered corners. No generic all-axis nose shrink.
    rake = max(0, z-1.62) * .225
    corner = .16 * (abs(y)/1.49)**4
    return (sign*(9.05-rake-corner+offset), y, z)


def cab_front(y, z, offset=0):
    # Tall Dosto control cab. The windscreen is recessed into this same face.
    rake = max(0, z-1.15)*.33
    crown = .20*(abs(y)/1.39)**4
    return (-13.02+rake+crown-offset, y, z)


def profile(coach):
    # Dense rounded roof, with a vertical lower side and sloping upper deck.
    if coach:
        lower = [(1.10,.76),(1.32,.94),(1.39,1.13),(1.39,3.13)]
        roof = [(1.39*math.cos(a),3.13+1.50*math.sin(a)) for a in [i*math.pi/2/16 for i in range(1,17)]]
    else:
        lower = [(1.17,.86),(1.44,1.05),(1.489,1.30),(1.489,3.63)]
        roof = [(1.489*math.cos(a),3.63+.65*math.sin(a)) for a in [i*math.pi/2/12 for i in range(1,13)]]
    half = lower + roof
    return half + [(-y,z) for y,z in reversed(half[:-1])]


def side_y(z, coach):
    p = profile(coach)
    positive = [(y,h) for y,h in p if y >= -1e-6]
    for (y0,z0),(y1,z1) in zip(positive,positive[1:]):
        if z0 <= z <= z1:
            return y0+(y1-y0)*(z-z0)/max(.0001,z1-z0)
    return positive[0][0] if z < positive[0][1] else 0


def side_surface(side, coach, offset=.012):
    return lambda x,z: (x, side*(side_y(z,coach)+offset), z)


def shell(col, root, name, coach, cab=False):
    p = profile(coach)
    half = 13.4 if coach else 9.45
    if coach:
        rings = [(-half+.20,0),(-half+2.60,1),(half-.28,1),(half-.20,0)]
    else:
        rings = [(-8.9,0),(-7.65,1),(7.65,1),(8.9,0)]
    verts=[]
    for index,(x,_) in enumerate(rings):
        for y,z in p:
            if not coach and index in (0,3):
                verts.append(loco_front(y,z,-1 if index == 0 else 1))
            elif coach and cab and index == 0:
                verts.append(cab_front(y,z))
            else:
                verts.append((x,y,z))
    n=len(p)
    faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(3) for i in range(n)]
    faces += [tuple(reversed(range(n))),tuple(3*n+i for i in range(n))]
    ob=mesh_object(col,root,name,verts,faces,M["white"])
    ob.data.materials.append(M["roof"])
    ob.data.materials.append(M["blue"])
    for poly in ob.data.polygons:
        zs=[ob.data.vertices[i].co.z for i in poly.vertices]
        if min(zs)> (4.06 if coach else 3.72): poly.material_index=1 if coach else 2
        if max(zs)<1.14: poly.material_index=2
    return ob


def band(col, root, name, side, coach, x0,x1, lower, upper, material):
    xs=[x0+(x1-x0)*i/96 for i in range(97)]
    surf=side_surface(side,coach,.016)
    outline=[(x,lower(x)) for x in xs]+[(x,upper(x)) for x in reversed(xs)]
    patch(col,root,name,outline,surf,material)


def box(col,root,name,dims,loc,key,rot=(0,0,0)):
    return c.add_box(col,CUBE,name,dims,loc,M[key],root,rotation=rot)


def beam(col,root,name,a,b,thick=.025,key="steel"):
    return c.add_beam_between(col,CUBE,name,a,b,thick,M[key],root)


def side_window(col,root,name,x,z,w,h,side,coach,rounded=.075):
    surf=side_surface(side,coach,.032)
    patch(col,root,name+"_seal",rounded_outline(x,z,w+.095,h+.085,rounded+.025),surf,M["seal"])
    patch(col,root,name+"_pane",rounded_outline(x,z,w,h,rounded),side_surface(side,coach,.042),M["glass"])
    # Thin reflection follows the real glazing surface, no detached boxes.
    patch(col,root,name+"_highlight",rounded_outline(x-w*.34,z,w*.04,h*.82,.014),side_surface(side,coach,.043),M["glass_reflection"])


def undercarriage(col,root,prefix,coach):
    box(col,root,prefix+"_frame",(22 if coach else 15.2,1.8,.25),(0,0,.74),"underframe")
    for i,x in enumerate((-9.4,9.4) if coach else (-5.2,5.2)):
        re.add_wheelset_bogie(col,root,CUBE,CYL,M,name=prefix+f"_bogie_{i}",x=x,axle_spacing=2.5 if coach else 2.6,wheel_radius=.46 if coach else .625,sideframe_half_width=1.02)
    for i,x in enumerate((-5.3,-1.8,2.0,5.4)):
        box(col,root,prefix+f"_equipment_{i}",(2.3,1.5,.39),(x,0,.55),"underframe")
        box(col,root,prefix+f"_equipment_panel_{i}",(1.95,1.53,.20),(x,0,.56),"mid_grey")
    length=26.8 if coach else 18.9
    for sign in (-1,1):
        # Buffer faces remain inside the declared vehicle envelope.
        re.add_buffers_and_coupler(col,root,CUBE,CYL,M,x=sign*(length/2-.36),outward_sign=sign,prefix=prefix+f"_end_{sign}")
        for side in (-1,1):
            box(col,root,prefix+f"_buffer_face_{sign}_{side}",(.10,.56,.34),(sign*(length/2-.19),side*.88,1.00),"underframe")


def pantograph(col,root,x,raised):
    prefix="br146_pantograph_"+("raised" if raised else "folded")
    box(col,root,prefix+"_base",(2.0,1.30,.12),(x,0,4.25),"roof")
    for side in (-1,1):
        c.add_cylinder(col,CYL,prefix+f"_insulator_{side}",.085,.23,(x,side*.43,4.42),M["insulator"],root)
    zmid,ztop=(5.0,5.46) if raised else (4.54,4.64)
    for side in (-1,1):
        beam(col,root,prefix+f"_lower_{side}",(x-.75,side*.43,4.48),(x+.65,side*.32,zmid),.055)
        beam(col,root,prefix+f"_upper_{side}",(x+.65,side*.32,zmid),(x-.35,side*.38,ztop),.042)
    box(col,root,prefix+"_collector",(.13,1.68,.08),(x-.35,0,ztop),"anthracite")
    if raised: root["pantograph_contact_height_m"]=5.5


def build_loco(parent):
    col=c.make_collection("Metronom_BR146_Prototype",parent)
    root=c.add_empty(col,"metronom_br146_root")
    root["vehicle_role"]="electric locomotive"
    root["class"]="TRAXX P160 AC2 / Class 146.2 family; reference ME 146-12"
    root["length_m"]=18.9
    shell(col,root,"br146_continuous_shell",False)
    for side in (-1,1):
        # White scoop is defined by its smoothly sampled lower boundary.
        band(col,root,f"br146_yellow_sweep_{side}",side,False,-7.63,7.63,lambda x:1.13,
             lambda x:2.95 if FLAT_LIVERY else 2.35+1.28*min(1,(abs(x)/5.40)**2),M["yellow"])
        band(col,root,f"br146_blue_sill_{side}",side,False,-7.65,7.65,lambda x:.98,lambda x:1.25,M["blue"])
        for sign in (-1,1):
            # Sloped pale nose cheek; compact near-corner cab side window.
            x=sign*7.11
            patch(col,root,f"br146_door_seal_{side}_{sign}",rounded_outline(x,2.43,.94,2.26,.09),side_surface(side,False,.025),M["door_seam"])
            patch(col,root,f"br146_door_leaf_{side}_{sign}",rounded_outline(x,2.43,.86,2.18,.07),side_surface(side,False,.030),M["yellow"])
            beam(col,root,f"br146_door_handle_{side}_{sign}",(x+.23,side*1.55,2.20),(x+.23,side*1.55,2.49),.035)
            # Side glazing fits the cab transition, not a protruding rectangle.
            outline=[(sign*7.69,2.95),(sign*8.25,2.97),(sign*8.15,3.48),(sign*7.69,3.56)]
            patch(col,root,f"br146_side_cab_seal_{side}_{sign}",outline,side_surface(side,False,.020),M["seal"])
            inset=[(sign*7.74,3.00),(sign*8.19,3.02),(sign*8.10,3.44),(sign*7.74,3.50)]
            patch(col,root,f"br146_side_cab_glass_{side}_{sign}",inset,side_surface(side,False,.028),M["glass"])
            for i in range(3): box(col,root,f"br146_step_{side}_{sign}_{i}",(.52,.16,.07),(x,side*1.48,.86+i*.16),"steel")
        for j,x in enumerate((-5.0,-2.3,2.3,5.0)):
            box(col,root,f"br146_shoulder_grille_{side}_{j}",(2.30,.045,.28),(x,side*1.425,3.90),"seal")
            for k in range(13): box(col,root,f"br146_grille_rib_{side}_{j}_{k}",(.025,.05,.23),(x-1.02+k*.17,side*1.453,3.90),"blue")
    for sign in (-1,1):
        surf=lambda y,z,o=.020: loco_front(y,z,sign,o)
        patch(col,root,f"br146_front_blue_visor_{sign}",[(-1.29,2.55),(1.29,2.55),(1.22,3.85),(-1.22,3.85)],surf,M["blue"])
        for side in (-1,1):
            y=side*.56
            patch(col,root,f"br146_windscreen_seal_{sign}_{side}",rounded_outline(y,3.20,1.03,.91,.07),lambda y,z:surf(y,z,.035),M["seal"])
            patch(col,root,f"br146_windscreen_glass_{sign}_{side}",rounded_outline(y,3.20,.91,.79,.04),lambda y,z:surf(y,z,.042),M["glass"])
            beam(col,root,f"br146_wiper_{sign}_{side}",surf(side*.30,2.76,.055),surf(side*.67,3.40,.055),.03,"seal")
            patch(col,root,f"br146_light_housing_{sign}_{side}",rounded_outline(side*.99,1.55,.53,.33,.04),lambda y,z:surf(y,z,.03),M["roof"])
            for j in (-1,1):
                patch(col,root,f"br146_light_{sign}_{side}_{j}",rounded_outline(side*.99+j*.115,1.55,.16,.18,.078),lambda y,z:surf(y,z,.044),M["lamp"])
        patch(col,root,f"br146_upper_lamp_{sign}",rounded_outline(0,2.48,.25,.19,.06),lambda y,z:surf(y,z,.032),M["lamp"])
        patch(col,root,f"br146_destination_{sign}",rounded_outline(0,3.78,1.54,.19,.025),lambda y,z:surf(y,z,.04),M["seal"])
    undercarriage(col,root,"br146",False)
    pantograph(col,root,-5.4,False)
    pantograph(col,root,5.4,True)
    for i,x in enumerate((-3.8,-2,0,2,3.8)):
        c.add_cylinder(col,CYL,f"br146_bus_insulator_{i}",.09,.22,(x,0,4.39),M["insulator"],root)
    beam(col,root,"br146_high_voltage_bus",(-5.4,0,4.52),(5.4,0,4.52),.048,"insulator")
    box(col,root,"br146_roof_transformer",(2.3,1.42,.15),(0,0,4.32),"roof")
    return root


def build_coach(parent,role):
    cab=role=="cab_car"
    col=c.make_collection("Metronom_"+role+"_Prototype",parent)
    root=c.add_empty(col,"metronom_"+role+"_root")
    root["vehicle_role"]={"cab_car":"double-deck driving trailer","bicycle":"double-deck bicycle coach","second_class":"double-deck second-class coach"}[role]
    root["length_m"]=26.8
    shell(col,root,role+"_continuous_shell",True,cab)
    start=-10.55 if cab else -13.16
    for side in (-1,1):
        band(col,root,f"{role}_yellow_curve_{side}",side,True,start,13.16,lambda x:1.12,
             lambda x:2.95 if FLAT_LIVERY else 2.62+1.40*min(1,(abs(x-.1)/10.1)**2),M["yellow"])
        band(col,root,f"{role}_blue_sill_{side}",side,True,start,13.16,lambda x:.96,lambda x:1.15,M["blue"])
        band(col,root,f"{role}_blue_roof_edge_{side}",side,True,start,13.16,lambda x:4.42,lambda x:4.56,M["blue"])
        doors=(-8.05,10.28) if cab else (-10.35,10.35)
        upper_x=[-7.5+i*1.68 for i in range(10)] if not cab else [-6.65+i*1.88 for i in range(9)]
        lower_x=[-7.9+i*1.97 for i in range(9)] if not cab else [-5.9+i*2.18 for i in range(7)]
        for i,x in enumerate(upper_x): side_window(col,root,f"{role}_upper_{side}_{i}",x,3.66,1.29,.83,side,True,.075)
        for i,x in enumerate(lower_x): side_window(col,root,f"{role}_lower_{side}_{i}",x,1.72,1.39,.70,side,True,.07)
        for i,x in enumerate(doors):
            patch(col,root,f"{role}_door_recess_{side}_{i}",rounded_outline(x,2.12,1.68,2.22,.055),side_surface(side,True,.022),M["seal"])
            patch(col,root,f"{role}_door_blue_{side}_{i}",rounded_outline(x,2.12,1.52,2.10,.035),side_surface(side,True,.029),M["blue"])
            for leaf in (-1,1):
                side_window(col,root,f"{role}_door_window_{side}_{i}_{leaf}",x+leaf*.36,2.62,.36,.90,side,True,.11)
                beam(col,root,f"{role}_door_handle_{side}_{i}_{leaf}",(x+leaf*.18,side*1.455,1.94),(x+leaf*.18,side*1.455,2.23),.022)
            box(col,root,f"{role}_door_seam_{side}_{i}",(.025,.018,2.03),(x,side*1.443,2.12),"seal")
            box(col,root,f"{role}_step_{side}_{i}",(1.55,.20,.09),(x,side*1.44,.95),"steel")
            c.add_text_label(col,f"{role}_class_{side}_{i}","2",(x+.98,side*1.45,2.73),M["blue"],root,side=side,size=.30)
        if role=="bicycle":
            # Original simple bicycle pictogram, modelled with curve tubes.
            for wheel_x in (-.58,.58):
                pts=[(.0+wheel_x+.30*math.cos(t*math.tau/24),side*1.446,2.54+.30*math.sin(t*math.tau/24)) for t in range(25)]
                for j in range(24): beam(col,root,f"bike_{side}_{wheel_x}_{j}",pts[j],pts[j+1],.024,"blue")
            for j,(a,b) in enumerate([((-.58,2.54),(-.22,2.98)),((-.22,2.98),(.30,2.98)),((.30,2.98),(.58,2.54)),((-.58,2.54),(.12,2.54)),((.12,2.54),(-.22,2.98)),((.12,2.54),(.30,2.98))]):
                beam(col,root,f"bike_frame_{side}_{j}",(a[0],side*1.45,a[1]),(b[0],side*1.45,b[1]),.035,"blue")
        if cab:
            # Yellow cab-side cheek rises into the curved white front surround.
            outline=[(-12.38,1.25),(-10.55,1.13),(-10.55,3.34),(-11.48,3.25),(-12.18,2.66)]
            patch(col,root,f"cab_car_yellow_cheek_{side}",outline,side_surface(side,True,.02),M["yellow"])
            side_window(col,root,f"cab_car_side_window_{side}",-11.00,2.96,.97,.90,side,True,.045)
            for j in range(6): box(col,root,f"cab_car_side_vent_{side}_{j}",(.20,.024,.025),(-10.37,side*1.415,3.07+j*.045),"seal")
    if cab:
        # Rounded dark forehead and one uninterrupted windscreen, as in the real photograph.
        patch(col,root,"cab_car_front_yellow_surround",rounded_outline(0,2.88,2.35,2.91,.42),lambda y,z:cab_front(y,z,.013),M["yellow"])
        patch(col,root,"cab_car_front_charcoal_mask",rounded_outline(0,3.11,2.05,2.83,.30),lambda y,z:cab_front(y,z,.023),M["roof"])
        patch(col,root,"cab_car_windscreen_seal",rounded_outline(0,2.96,1.85,1.36,.055),lambda y,z:cab_front(y,z,.033),M["seal"])
        patch(col,root,"cab_car_panoramic_windscreen",rounded_outline(0,2.96,1.69,1.21,.038),lambda y,z:cab_front(y,z,.042),M["glass"])
        patch(col,root,"cab_car_destination_box",rounded_outline(0,3.85,1.76,.43,.035),lambda y,z:cab_front(y,z,.04),M["seal"])
        for i in range(9):
            patch(col,root,f"cab_car_destination_glyph_{i}",rounded_outline(-.55+i*.13,3.85,.06,.16,.01),lambda y,z:cab_front(y,z,.045),M["display"])
        for side in (-1,1):
            patch(col,root,f"cab_car_lamp_panel_{side}",rounded_outline(side*.64,2.04,.49,.31,.025),lambda y,z:cab_front(y,z,.036),M["seal"])
            patch(col,root,f"cab_car_headlamp_{side}",rounded_outline(side*.64,2.04,.20,.20,.10),lambda y,z:cab_front(y,z,.045),M["lamp"])
        patch(col,root,"cab_car_upper_lamp",rounded_outline(0,4.27,.19,.20,.07),lambda y,z:cab_front(y,z,.038),M["lamp"])
        beam(col,root,"cab_car_wiper_arm",cab_front(-.14,2.27,.066),cab_front(.59,3.31,.066),.027,"seal")
        beam(col,root,"cab_car_wiper_blade",cab_front(.44,3.13,.072),cab_front(.67,3.55,.072),.035,"seal")
    undercarriage(col,root,role,True)
    for sign in ((1,) if cab else (-1,1)):
        box(col,root,role+f"_gangway_{sign}",(.30,1.17,2.50),(sign*13.35,0,2.24),"seal")
        for j in range(4): box(col,root,role+f"_bellows_{sign}_{j}",(.045,1.27,2.59),(sign*(13.22+j*.075),0,2.24),"underframe")
    for i,x in enumerate((6.6,) if cab else (-6.6,6.6)):
        box(col,root,role+f"_hvac_{i}",(2.70,1.48,.14),(x,0,4.65),"roof")
        for j in range(12): box(col,root,role+f"_hvac_vent_{i}_{j}",(.035,1.20,.024),(x-1.08+j*.195,0,4.735),"seal")
    return root


def main():
    global M,CUBE,CYL
    SOURCE.mkdir(parents=True,exist_ok=True)
    OUTPUT.mkdir(parents=True,exist_ok=True)
    re.reset_scene()
    M=materials()
    CUBE=c.unit_cube_mesh()
    CYL=c.unit_cylinder_mesh(24)
    assets=c.make_collection("Metronom_Blender_Assets")
    prototypes=c.make_collection("Metronom_Prototypes",assets)
    modules={"br146":build_loco(prototypes)}
    for role in ("second_class","bicycle","cab_car"): modules[role]=build_coach(prototypes,role)
    exports={}
    for role,obj in modules.items():
        anchor=c.add_metric_contract(obj.users_collection[0],obj,add_anchor=True)
        file=OUTPUT/f"metronom-{role.replace('_','-')}.glb"
        c.export_glb(obj,file)
        anchor.name=role+"_rail_contact_origin"
        exports[role]=str(file.relative_to(ROOT))
    formation_col=c.make_collection("Metronom_Formation",assets)
    formation=c.add_empty(formation_col,"metronom_br146_blender_root")
    c.add_metric_contract(formation_col,formation,add_anchor=True)
    formation["vehicle_count"]=4
    formation["length_m"]=LENGTH
    formation["approval_status"]="private-review"
    cursor=LENGTH/2
    centers={}
    for i,(role,length) in enumerate(LENGTHS.items()):
        copy=c.duplicate_hierarchy(modules[role],formation_col,formation,f"vehicle_{i+1:02d}_{role}")
        copy.location.x=cursor-length/2
        centers[role]=copy.location.x
        cursor-=length+GAP
    file=OUTPUT/"metronom-br146-blender.glb"
    c.export_glb(formation,file)
    re.add_review_environment(assets,formation,CUBE,M)
    prototypes.hide_render=True
    prototypes.hide_viewport=True
    bpy.context.scene.frame_set(1)
    bpy.context.scene.view_settings.view_transform="AgX"
    master=SOURCE/"metronom-br146-master.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(master),compress=True)
    manifest={"schemaVersion":1,"candidateId":CANDIDATE,"assetRevision":"flat-livery-m2" if FLAT_LIVERY else "curved-livery-m1",
        "approvalStatus":"private-review","productionRegistryModified":False,
        "formation":"TRAXX P160 AC2 / metronom ME 146-12 reference + two double-deck coaches + driving trailer",
        "vehicleCount":4,"lengthMeters":round(LENGTH,3),"consist":list(LENGTHS),"vehicleCentersMeters":centers,
        "dimensionsMeters":{"locomotive":{"length":18.9,"width":2.978,"height":4.28},"coach":{"length":26.8,"width":2.78,"height":4.63}},
        "formationChoice":"User-requested four vehicles including locomotive; shortened review formation, not a claim about a fixed full-size service consist.",
        "identityEvidence":"User locomotive image shows ME 146-12 / 146 512-9; operator lists 146.1/146.2/147.5, manufacturer metronom set identifies 146.2.",
        "masterBlend":str(master.relative_to(ROOT)),"formationGlb":str(file.relative_to(ROOT)),"moduleGlbs":exports,
        "sources":SOURCES,"userReferenceFilenames":REFERENCES,
        "referencePolicy":"Filename-only provenance; no photographs or operator logos are embedded or shipped.",
        "assetContract":{"units":"meters","forwardAxis":"+X","lateralAxis":"+Y","upAxis":"+Z","standardGaugeMeters":1.435,"wheelTreadCentersMeters":[-.7175,.7175],"railContactPlaneZ":0,"railContactAnchor":"rail_contact_origin","pantographContactHeightMeters":5.5,"calibrationTrackExported":False},
        "visualGuides":{"locomotive":"TRAXX 2 broad raked face, split windscreen, white cheeks, two pantographs, curved white scoop over yellow sides",
          "cabCar":"one tall panoramic screen, rounded charcoal/yellow/white surround, blue apron, swept white roof shoulders",
          "coaches":"yellow lower side under a curved white scoop, roof-following upper glass, blue double doors and sill"}}
    (SOURCE/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print("METRONOM_REVIEW_GENERATED",round(LENGTH,3),"m")


if __name__=="__main__": main()
