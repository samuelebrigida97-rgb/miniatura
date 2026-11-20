"""Crea un unico 3MF (Bambu Studio / OrcaSlicer) con un oggetto in due parti:
parte 1 = fondo chiaro (filamento 1, bianco), parte 2 = nero (filamento 2)."""
import os, zipfile, io
import numpy as np, trimesh
HERE = os.path.dirname(os.path.abspath(__file__))
parts = [("fondo bianco", "logo_nero_bicolore_1_fondo_chiaro.stl", 1),
         ("sopra nero", "logo_nero_bicolore_2_sopra_nero.stl", 2)]
OUT = os.path.join(HERE, "appendichiavi_logo_AMS_bianco_nero.3mf")

def mesh_xml(m):
    v = "\n".join(f'<vertex x="{x:.4f}" y="{y:.4f}" z="{z:.4f}"/>' for x, y, z in m.vertices)
    t = "\n".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in m.faces)
    return f"<mesh><vertices>\n{v}\n</vertices><triangles>\n{t}\n</triangles></mesh>"

model = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
         '<metadata name="Application">BambuStudio-01.09.00.00</metadata>', '<resources>']
for i, (name, f, _) in enumerate(parts, start=1):
    m = trimesh.load(os.path.join(HERE, f))
    model.append(f'<object id="{i}" name="{name}" type="model">{mesh_xml(m)}</object>')
comp = "".join(f'<component objectid="{i}"/>' for i in range(1, len(parts) + 1))
model += [f'<object id="{len(parts)+1}" name="Appendichiavi O pane ro paese" type="model"><components>{comp}</components></object>',
          '</resources>', f'<build><item objectid="{len(parts)+1}" transform="1 0 0 0 1 0 0 0 1 100 100 0" printable="1"/></build>', '</model>']

cfg = ['<?xml version="1.0" encoding="UTF-8"?>', '<config>',
       f'  <object id="{len(parts)+1}">', '    <metadata key="name" value="Appendichiavi O pane ro paese"/>',
       '    <metadata key="extruder" value="1"/>']
for i, (name, _, ext) in enumerate(parts, start=1):
    cfg += [f'    <part id="{i}" subtype="normal_part">', f'      <metadata key="name" value="{name}"/>',
            f'      <metadata key="extruder" value="{ext}"/>', '    </part>']
cfg += ['  </object>', '</config>']

ct = ('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
      '<Default Extension="config" ContentType="text/xml"/></Types>')
rels = ('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    z.writestr("[Content_Types].xml", ct)
    z.writestr("_rels/.rels", rels)
    z.writestr("3D/3dmodel.model", "\n".join(model))
    z.writestr("Metadata/model_settings.config", "\n".join(cfg))
print(OUT, os.path.getsize(OUT) // 1e6, "MB")
