"""Appendichiavi tondo "O' pane ro paese" - genera gli STL.

Misure (mm): disco Ø200 x 10, cornice rialzata, scritta in rilievo (font Pacifico,
script simile al logo), due spighe di grano incrociate, tre pioli 12x10 lunghi 30
con blocco finale, asola a chiave (keyhole) sul retro per una vite.
Stampa: retro sul piatto, tutto il rilievo e i pioli verso l'alto, senza supporti.
"""
import math, os
import numpy as np
import trimesh
from shapely.geometry import Polygon, Point, LineString, MultiPolygon, box
from shapely.ops import unary_union
from shapely import affinity
from matplotlib.textpath import TextPath
from matplotlib.font_manager import FontProperties

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "Pacifico-Regular.ttf")

R = 100.0          # raggio disco (Ø200)
T = 10.0           # spessore disco
RIM_W, RIM_H = 5.0, 2.0
RELIEF_H = 2.5     # rilievo scritta / spighe
PEG_W, PEG_D, PEG_L = 12.0, 10.0, 30.0   # piolo: largo, alto (y), lungo (dal muro in fuori)
CAP_W, CAP_D, CAP_T = 20.0, 18.0, 5.0    # blocco finale
CHAMFER = 4.0      # smusso sotto il blocco (stampa senza supporti)
PEG_Y = -66.0
PEG_X = (-46.0, 0.0, 46.0)
KEY_Y = 45.0       # asola vite sul retro

def extrude(geom, h, z0=0.0):
    geoms = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    meshes = []
    for g in geoms:
        if g.area < 0.05:
            continue
        m = trimesh.creation.extrude_polygon(g.buffer(0), h)
        m.apply_translation([0, 0, z0])
        meshes.append(m)
    return meshes

def union(meshes):
    return trimesh.boolean.union(meshes, engine="manifold")

# ---------- testo ----------
def text_geom(s, size):
    tp = TextPath((0, 0), s, size=size, prop=FontProperties(fname=FONT))
    polys = []
    for ring in tp.to_polygons(closed_only=True):
        if len(ring) < 3:
            continue
        p = Polygon(ring)
        if not p.is_valid:
            p = p.buffer(0)
        polys.append((Polygon(ring).exterior.is_ccw if Polygon(ring).is_valid else True, p))
    # pari/dispari per glifo è rischioso nei font corsivi: usiamo contenimento
    polys.sort(key=lambda t: -t[1].area)
    shapes = []
    for _, p in polys:
        depth = sum(1 for q in shapes if q.contains(p.representative_point()))
        shapes.append(p)
    result = Polygon()
    for p in sorted(shapes, key=lambda q: -q.area):
        inside = [q for q in shapes if q is not p and q.area > p.area and q.contains(p.representative_point())]
        if len(inside) % 2 == 0:
            result = result.union(p)
        else:
            result = result.difference(p)
    return result.buffer(0)

def fit(geom, width, cx, cy):
    minx, miny, maxx, maxy = geom.bounds
    k = width / (maxx - minx)
    g = affinity.scale(geom, k, k, origin=(0, 0))
    minx, miny, maxx, maxy = g.bounds
    return affinity.translate(g, cx - (minx + maxx) / 2, cy - (miny + maxy) / 2)

line1 = fit(text_geom("O' pane", 100), 108, 0, 18)
line2 = fit(text_geom("ro paese", 100), 146, 0, -20)
text = unary_union([line1, line2])

# ---------- spiga di grano stilizzata ----------
def wheat_ear(length=62, n=6):
    parts = []
    stem = LineString([(0, 0), (0, length)]).buffer(1.4, cap_style=1)
    parts.append(stem)
    gy0, step = length * 0.38, 5.2
    for i in range(n):
        y = gy0 + i * step
        s = 1 - i / (n + 2) * 0.5
        for side in (-1, 1):
            g = affinity.scale(Point(0, 0).buffer(1, 48), 2.6 * s, 5.4 * s)
            g = affinity.rotate(g, -side * 32, origin=(0, 0))
            g = affinity.translate(g, side * 2.9 * s, y + 3.0)
            parts.append(g)
            # resta (barba) del chicco
            ax, ay = side * 2.9 * s, y + 3.0
            aw = LineString([(ax + side * 2.0, ay + 3.5), (ax + side * 6.5, ay + 11)]).buffer(0.85, cap_style=1)
            parts.append(aw)
    top = affinity.scale(Point(0, 0).buffer(1, 48), 2.4, 5.4)
    top = affinity.translate(top, 0, gy0 + n * step + 3.2)
    parts.append(top)
    parts.append(LineString([(0, gy0 + n * step + 8), (0, gy0 + n * step + 15)]).buffer(0.85, cap_style=1))
    # foglia sullo stelo
    leaf = affinity.scale(Point(0, 0).buffer(1, 48), 2.2, 9)
    leaf = affinity.rotate(leaf, -35, origin=(0, -9))
    leaf = affinity.translate(leaf, 4.5, 14)
    parts.append(leaf)
    return unary_union(parts)

ear = wheat_ear()
ear_l = affinity.rotate(ear, 24, origin=(0, 0))
ear_r = affinity.scale(ear_l, -1, 1, origin=(0, 0))
wheat = unary_union([ear_l, ear_r])
# fiocco/legatura al centro dell'incrocio
tie = affinity.scale(Point(0, 0).buffer(1, 48), 5.5, 2.6)
wheat = unary_union([wheat, affinity.translate(tie, 0, 9)])
wheat = affinity.scale(wheat, 0.72, 0.72, origin=(0, 0))
wheat = affinity.translate(wheat, 0, 90 - wheat.bounds[3])

# piccoli chicchi decorativi ai lati della seconda riga
deco = []
for sx in (-1, 1):
    g = affinity.scale(Point(0, 0).buffer(1, 48), 2.2, 4.2)
    g = affinity.rotate(g, sx * -40, origin=(0, 0))
    deco.append(affinity.translate(g, sx * 84, -18))
deco = unary_union(deco)

# ---------- assemblaggio ----------
inner = Point(0, 0).buffer(R - RIM_W - 0.8, 256)
art = unary_union([text, wheat]).intersection(inner)

disc = trimesh.creation.cylinder(radius=R, height=T, sections=256)
disc.apply_translation([0, 0, T / 2])
rim_shape = Point(0, 0).buffer(R - 0.6, 256).difference(Point(0, 0).buffer(R - RIM_W, 256))
rim = extrude(rim_shape, RIM_H, T)

pegs = []
for x in PEG_X:
    post = trimesh.creation.box([PEG_W, PEG_D, PEG_L - CAP_T + 0.01])
    post.apply_translation([x, PEG_Y, T + (PEG_L - CAP_T) / 2])
    # raccordo alla base (rinforzo)
    base = trimesh.creation.extrude_polygon(box(x - PEG_W / 2 - 3, PEG_Y - PEG_D / 2 - 3,
                                               x + PEG_W / 2 + 3, PEG_Y + PEG_D / 2 + 3), 0.01)
    flare = trimesh.convex.convex_hull(np.vstack([
        base.vertices + [0, 0, T - 0.01],
        post.vertices[post.vertices[:, 2] < T + 1] * [1, 1, 0] + [0, 0, T + 3]]))
    # blocco finale con smusso a 45° sotto
    cap_top = trimesh.creation.box([CAP_W, CAP_D, CAP_T])
    cap_top.apply_translation([x, PEG_Y, T + PEG_L - CAP_T / 2])
    z_bot = T + PEG_L - CAP_T
    cham = trimesh.convex.convex_hull(np.vstack([
        cap_top.vertices[cap_top.vertices[:, 2] < z_bot + 0.1],
        [[x - PEG_W / 2, PEG_Y - PEG_D / 2, z_bot - CHAMFER], [x + PEG_W / 2, PEG_Y - PEG_D / 2, z_bot - CHAMFER],
         [x - PEG_W / 2, PEG_Y + PEG_D / 2, z_bot - CHAMFER], [x + PEG_W / 2, PEG_Y + PEG_D / 2, z_bot - CHAMFER]]]))
    pegs += [post, flare, cap_top, cham]

art_meshes = extrude(art, RELIEF_H, T - 0.01)
body = union([disc] + pegs)

# asola a chiave sul retro (vite Ø4, testa fino a Ø9)
HEAD_D, SHANK_W, SLOT_L, LIP, CH_D = 9.6, 4.6, 12.0, 3.0, 7.0
entry = Point(0, KEY_Y).buffer(HEAD_D / 2, 64)
chamber = unary_union([entry, box(-HEAD_D / 2, KEY_Y, HEAD_D / 2, KEY_Y + SLOT_L),
                       Point(0, KEY_Y + SLOT_L).buffer(HEAD_D / 2, 64)])
slot = unary_union([box(-SHANK_W / 2, KEY_Y, SHANK_W / 2, KEY_Y + SLOT_L),
                    Point(0, KEY_Y + SLOT_L).buffer(SHANK_W / 2, 64)])
cut = extrude(entry, CH_D + 1, -1) + extrude(chamber, CH_D - LIP, LIP) + extrude(slot, LIP + 1, -1)
body = trimesh.boolean.difference([body, union(cut)], engine="manifold")

full = union([body] + rim + art_meshes)
art_only = union(art_meshes + [m for m in rim])  # per stampa bicolore

out = HERE
full.export(os.path.join(out, "appendichiavi_opane_ro_paese.stl"))
body.export(os.path.join(out, "bicolore_1_base_pioli.stl"))
art_only.export(os.path.join(out, "bicolore_2_scritta_grano_cornice.stl"))
for n, m in [("completo", full), ("base", body), ("rilievo", art_only)]:
    print(n, "watertight:", m.is_watertight, "volume cm3: %.1f" % (m.volume / 1000), "bounds:", np.round(m.bounds, 1).tolist())
