"""Appendichiavi tondo Ø200 tutto nero con il logo "O' pane ro paese" + 3 pioli + asola a chiave.

Il disegno nero del logo resta in superficie, le parti chiare sono scavate (ENGRAVE mm).
Il logo è spostato in alto (senza il ricciolo col cuore) per lasciare spazio ai pioli in basso.
Stampa: retro sul piatto, un solo filamento (nero), senza supporti.
"""
import os
import numpy as np
from scipy import ndimage as ndi
import trimesh
from PIL import Image, ImageFilter
from skimage import measure
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "logo_opane_ro_paese.jpg")

R, T = 100.0, 10.0
RIM_W = 4.0
ENGRAVE = 1.0                 # profondità delle parti chiare (cambio colore a T-ENGRAVE = 9 mm)
THRESH = 80
MIN_AREA = 0.25
# logo: px 40 (cima titolo) .. px 990 (fondo del nastro) -> y da 76 a -66 mm
MM_PX = 0.15
CROP_BOTTOM_PX = 990
Y_AT_CROP = -66.0
# pioli
PEG_W, PEG_D, PEG_L = 12.0, 10.0, 30.0
CAP_W, CAP_D, CAP_T, CHAMFER = 18.0, 16.0, 5.0, 3.5
PEG_Y, PEG_X = -79.0, (-36.0, 0.0, 36.0)
# asola a chiave (vite Ø4, testa fino a Ø9)
KEY_Y = 40.0
HEAD_D, SHANK_W, SLOT_L, LIP, CH_D = 9.6, 4.6, 12.0, 3.0, 7.0

def extrude(gs, h, z0):
    out = []
    for g in getattr(gs, "geoms", [gs]) if not isinstance(gs, list) else gs:
        if g.is_empty or g.area < 1e-3:
            continue
        m = trimesh.creation.extrude_polygon(g, h)
        m.apply_translation([0, 0, z0])
        out.append(m)
    return out

U = lambda ms: trimesh.boolean.union(ms, engine="manifold")
D = lambda a, b: trimesh.boolean.difference([a, b], engine="manifold")

# ---------- logo -> zone nere ----------
im = Image.open(IMG).convert("L")
W, H = im.size
UP = 2
im = im.resize((W * UP, H * UP), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
a = np.asarray(im).astype(float)
mask = (a < THRESH).astype(float)
mask[CROP_BOTTOM_PX * UP:, :] = 0

# --- dettagli stampabili con ugello 0.4: allarga i bianchi troppo stretti (occhi, denti),
#     poi ingrossa le linee nere troppo sottili (priorità alle linee) ---
def _disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r
_d = mask > 0.5
_l = ~_d
_thin_l = _l & ~ndi.binary_opening(_l, structure=_disk(3))
_l = _l | (ndi.binary_dilation(_thin_l, structure=_disk(2)) & ~ndi.binary_erosion(_d, structure=_disk(2)))
_d = ~_l
_thin_d = _d & ~ndi.binary_opening(_d, structure=_disk(3))
_d = _d | ndi.binary_dilation(_thin_d, structure=_disk(2))
mask = _d.astype(float)
mask = np.pad(mask, 1)
s = MM_PX / UP
x0 = W * UP / 2 + 1

rings = []
for c in measure.find_contours(mask, 0.5):
    if len(c) < 4:
        continue
    xy = np.c_[(c[:, 1] - x0) * s, Y_AT_CROP + (CROP_BOTTOM_PX * UP + 1 - c[:, 0]) * s]
    p = Polygon(xy).buffer(0)
    if p.area > 0.02:
        rings.append(p.simplify(0.04))
rings.sort(key=lambda p: -p.area)
levels = {}
for i, p in enumerate(rings):
    pt = p.representative_point()
    depth = sum(1 for q in rings[:i] if q.area > p.area and q.contains(pt))
    levels.setdefault(depth, []).append(p)
dark = Polygon()
for d in sorted(levels):
    layer = unary_union(levels[d])
    dark = dark.union(layer) if d % 2 == 0 else dark.difference(layer)
dark = dark.buffer(0.15).buffer(-0.15)

inner = Point(0, 0).buffer(R - RIM_W, 256)
logo_zone = inner.intersection(box(-R, Y_AT_CROP, R, R))
light = logo_zone.difference(dark)
light = unary_union([g for g in getattr(light, "geoms", [light]) if g.area >= MIN_AREA])
light = light.buffer(-0.05).buffer(0.05)

# ---------- corpo ----------
disc = trimesh.creation.cylinder(radius=R, height=T, sections=256)
disc.apply_translation([0, 0, T / 2])

pegs = []
for x in PEG_X:
    post = trimesh.creation.box([PEG_W, PEG_D, PEG_L - CAP_T + 0.01])
    post.apply_translation([x, PEG_Y, T + (PEG_L - CAP_T) / 2])
    foot = np.array([[x + sx * (PEG_W / 2 + 3), PEG_Y + sy * (PEG_D / 2 + 3), T - 0.01]
                     for sx in (-1, 1) for sy in (-1, 1)])
    top = np.array([[x + sx * PEG_W / 2, PEG_Y + sy * PEG_D / 2, T + 3]
                    for sx in (-1, 1) for sy in (-1, 1)])
    flare = trimesh.convex.convex_hull(np.vstack([foot, top]))
    cap = trimesh.creation.box([CAP_W, CAP_D, CAP_T])
    cap.apply_translation([x, PEG_Y, T + PEG_L - CAP_T / 2])
    zb = T + PEG_L - CAP_T
    cham = trimesh.convex.convex_hull(np.vstack([
        [[x + sx * CAP_W / 2, PEG_Y + sy * CAP_D / 2, zb] for sx in (-1, 1) for sy in (-1, 1)],
        [[x + sx * PEG_W / 2, PEG_Y + sy * PEG_D / 2, zb - CHAMFER] for sx in (-1, 1) for sy in (-1, 1)]]))
    pegs += [post, flare, cap, cham]

entry = Point(0, KEY_Y).buffer(HEAD_D / 2, 64)
chamber = unary_union([entry, box(-HEAD_D / 2, KEY_Y, HEAD_D / 2, KEY_Y + SLOT_L),
                       Point(0, KEY_Y + SLOT_L).buffer(HEAD_D / 2, 64)])
slot = unary_union([box(-SHANK_W / 2, KEY_Y, SHANK_W / 2, KEY_Y + SLOT_L),
                    Point(0, KEY_Y + SLOT_L).buffer(SHANK_W / 2, 64)])
cuts = extrude([entry], CH_D + 1, -1) + extrude([chamber], CH_D - LIP, LIP) + extrude([slot], LIP + 1, -1)
cuts += extrude(light, ENGRAVE + 1, T - ENGRAVE)

body = D(U([disc] + pegs), U(cuts))
out = os.path.join(HERE, "appendichiavi_logo_nero_pioli.stl")
body.export(out)
print("watertight:", body.is_watertight, "volume cm3: %.1f" % (body.volume / 1000),
      "facce:", len(body.faces), "bounds:", np.round(body.bounds, 1).tolist())
