import numpy as np, runpy
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
g = runpy.run_path('genera_targa_logo_pioli.py')
PX = 0.075  # mm per pixel della maschera (MM_PX/UP)
m = g['mask'][1:-1,1:-1] > 0.5
H, W = m.shape
# zona del logo: cerchio interno e sopra il taglio
yy, xx = np.mgrid[0:H, 0:W]
X = (xx - W/2) * PX
Y = g['Y_AT_CROP'] + (g['CROP_BOTTOM_PX']*2 - yy) * PX
inside = (X**2 + Y**2 < (g['R']-g['RIM_W'])**2) & (Y >= g['Y_AT_CROP'])
dark = m & inside
light = ~m & inside

def disk(r_mm):
    r = int(round(r_mm/PX)); y,x = np.mgrid[-r:r+1,-r:r+1]; return x*x+y*y <= r*r

NOZ = 0.42
# 1) spessori: linee nere (pareti) e solchi bianchi
for name, reg in [('linee nere (in rilievo)', dark), ('solchi bianchi (scavati)', light)]:
    dt = ndi.distance_transform_edt(reg) * PX * 2       # larghezza locale ~ 2*distanza dal bordo
    sk = reg & (ndi.maximum_filter(dt, 3) == dt)       # cresta = spessore locale
    w = dt[sk]
    print(f"{name}: sotto 0.4 mm {np.mean(w<0.4)*100:.0f}%  | 0.4-0.6 mm {np.mean((w>=0.4)&(w<0.6))*100:.0f}% | oltre 0.6 mm {np.mean(w>=0.6)*100:.0f}%")

# 2) cosa esce davvero: le parti nere più sottili dell'ugello spariscono,
#    i solchi bianchi più stretti dell'ugello si chiudono (diventano neri)
se = disk(NOZ/2)
dark_p = ndi.binary_opening(dark, structure=se)
light_closed = light & ~ndi.binary_opening(light, structure=se)
dark_p = (dark_p | light_closed) & inside
lost_dark = dark & ~dark_p
print(f"dettagli neri persi: {lost_dark.sum()/dark.sum()*100:.1f}%   solchi bianchi che si chiudono: {light_closed.sum()/light.sum()*100:.1f}%")

def render(dk, ins):
    # luce dall'alto a sinistra 45°, ombra lunga = profondità 2 mm
    rgb = np.zeros((H, W, 3))
    white = np.array([0.93, 0.92, 0.88]); black = np.array([0.07, 0.07, 0.08])
    floor = ins & ~dk
    sh = int(round(g['ENGRAVE']/PX*0.6))
    wall = np.zeros_like(dk)
    for k in range(1, sh+1):
        wall |= np.roll(np.roll(dk, k, 0), k, 1)
    shade = np.where(floor & wall, 0.55, 1.0)
    # occlusione nei solchi stretti
    occ = np.clip(ndi.distance_transform_edt(floor)*PX/0.8, 0.45, 1)
    rgb[floor] = (white * (shade*occ)[..., None])[floor]
    rgb[dk] = black
    # bordo lucido del nero
    edge = dk & ~ndi.binary_erosion(dk, iterations=1)
    rgb[edge] = [0.25, 0.25, 0.27]
    rgb[~ins] = black
    return (rgb*255).astype(np.uint8)

orig = np.where(inside[...,None], np.where(dark[...,None], [20,20,22], [237,234,224]), [20,20,22]).astype(np.uint8)
sim = render(dark_p, inside)
Image.fromarray(sim).resize((W//3, H//3), Image.LANCZOS).save('simulazione_stampa_intera.png')
# zoom sui volti (affiancati: disegno ideale | stampa simulata)
crops = {'volti': (int(W*0.17), int(H*0.20), int(W*0.83), int(H*0.48))}
for k,(x0,y0,x1,y1) in crops.items():
    a = Image.fromarray(orig[y0:y1, x0:x1]); b = Image.fromarray(sim[y0:y1, x0:x1])
    w, h = a.size; out = Image.new('RGB', (w, h*2+20), (255,255,255))
    out.paste(a, (0,0)); out.paste(b, (0,h+20))
    out.resize((w*2//3, (h*2+20)*2//3), Image.LANCZOS).save(f'simulazione_zoom_{k}.png')
print('px', W, H)
