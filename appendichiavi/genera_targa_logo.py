"""Targa tonda Ø200 con il logo "O' pane ro paese" in rilievo + asola a chiave sul retro.

Le parti scure del logo (linee, giacche, scritte) diventano rilievo di 1.6 mm sul disco.
Stampa: retro sul piatto; cambio colore a z = 10 mm per avere il disegno di un altro colore.
"""
import os
import numpy as np
import trimesh
from PIL import Image, ImageFilter
from skimage import measure
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union
from shapely import affinity

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "logo_opane_ro_paese.jpg")

R, T = 100.0, 10.0
RIM_W, RIM_H = 4.0, 1.6
RELIEF_H = 1.6
ART_R = R - RIM_W - 0.6          # raggio utile per il disegno
IMG_RADIUS_PX = 600               # quanto del logo (dal centro, in px) entra nel cerchio
THRESH = 80                       # sotto questa luminosità = "nero" -> rilievo
MIN_AREA = 0.25                   # mm², elimina briciole non stampabili
KEY_Y = 45.0

# ---------- logo -> poligoni ----------
im = Image.open(IMG).convert("L")
W, H = im.size
UP = 2
im = im.resize((W * UP, H * UP), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
a = np.asarray(im).astype(float)
mask = (a < THRESH).astype(float)
mask = np.pad(mask, 1)
scale = ART_R / (IMG_RADIUS_PX * UP)     # mm per pixel
cx, cy = W * UP / 2 + 1, H * UP / 2 + 1

rings = []
for c in measure.find_contours(mask, 0.5):
    if len(c) < 4:
        continue
    xy = np.c_[(c[:, 1] - cx) * scale, -(c[:, 0] - cy) * scale]
    p = Polygon(xy).buffer(0)
    if p.area > 0.02:
        rings.append(p.simplify(0.05))
rings.sort(key=lambda p: -p.area)
levels = {}
for i, p in enumerate(rings):
    pt = p.representative_point()
    depth = sum(1 for q in rings[:i] if q.area > p.area and q.contains(pt))
    levels.setdefault(depth, []).append(p)
art = Polygon()
for d in sorted(levels):            # dal più esterno al più interno: pari = nero, dispari = buco
    layer = unary_union(levels[d])
    art = art.union(layer) if d % 2 == 0 else art.difference(layer)
art = art.buffer(0.15).buffer(-0.15)            # chiude micro-fessure
art = art.intersection(Point(0, 0).buffer(ART_R, 256))
geoms = [g for g in getattr(art, "geoms", [art]) if g.area >= MIN_AREA]
print("isole di rilievo:", len(geoms))

def extrude(gs, h, z0):
    out = []
    for g in gs:
        m = trimesh.creation.extrude_polygon(g, h)
        m.apply_translation([0, 0, z0])
        out.append(m)
    return out

# ---------- disco, cornice, asola ----------
disc = trimesh.creation.cylinder(radius=R, height=T, sections=256)
disc.apply_translation([0, 0, T / 2])
rim_shape = Point(0, 0).buffer(R - 0.6, 256).difference(Point(0, 0).buffer(R - RIM_W, 256))

HEAD_D, SHANK_W, SLOT_L, LIP, CH_D = 9.6, 4.6, 12.0, 3.0, 7.0
entry = Point(0, KEY_Y).buffer(HEAD_D / 2, 64)
chamber = unary_union([entry, box(-HEAD_D / 2, KEY_Y, HEAD_D / 2, KEY_Y + SLOT_L),
                       Point(0, KEY_Y + SLOT_L).buffer(HEAD_D / 2, 64)])
slot = unary_union([box(-SHANK_W / 2, KEY_Y, SHANK_W / 2, KEY_Y + SLOT_L),
                    Point(0, KEY_Y + SLOT_L).buffer(SHANK_W / 2, 64)])
cut = extrude([entry], CH_D + 1, -1) + extrude([chamber], CH_D - LIP, LIP) + extrude([slot], LIP + 1, -1)
base = trimesh.boolean.difference([disc, trimesh.boolean.union(cut, engine="manifold")], engine="manifold")

relief = trimesh.boolean.union(extrude(geoms, RELIEF_H, T - 0.01) + extrude([rim_shape], RIM_H, T - 0.01),
                               engine="manifold")
full = trimesh.boolean.union([base, relief], engine="manifold")

full.export(os.path.join(HERE, "targa_logo_completa.stl"))
base.export(os.path.join(HERE, "targa_logo_bicolore_1_base.stl"))
relief.export(os.path.join(HERE, "targa_logo_bicolore_2_disegno.stl"))
for n, m in [("completa", full), ("base", base), ("disegno", relief)]:
    print(n, "watertight:", m.is_watertight, "volume cm3: %.1f" % (m.volume / 1000), "facce:", len(m.faces))
