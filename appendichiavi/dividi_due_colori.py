"""Divide appendichiavi_logo_nero_pioli.stl in due parti per stampa bicolore (AMS / multi-materiale):
sotto z=8 (colore chiaro: è il fondo delle parti scavate) e sopra z=8 (nero)."""
import os, trimesh
HERE = os.path.dirname(os.path.abspath(__file__))
m = trimesh.load(os.path.join(HERE, "appendichiavi_logo_nero_pioli.stl"))
Z = 8.0
lo = trimesh.creation.box([300, 300, Z]); lo.apply_translation([0, 0, Z / 2])
hi = trimesh.creation.box([300, 300, 100]); hi.apply_translation([0, 0, Z + 50])
a = trimesh.boolean.intersection([m, lo], engine="manifold")
b = trimesh.boolean.intersection([m, hi], engine="manifold")
a.export(os.path.join(HERE, "logo_nero_bicolore_1_fondo_chiaro.stl"))
b.export(os.path.join(HERE, "logo_nero_bicolore_2_sopra_nero.stl"))
print(a.is_watertight, b.is_watertight, a.bounds.tolist(), b.bounds.tolist())
