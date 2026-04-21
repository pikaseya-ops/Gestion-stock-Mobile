"""Génère icon.png (1024x1024) et icon@256.png pour Electron.

On dessine directement avec Pillow au lieu de convertir le SVG, ce qui garantit
un rendu net sur toutes les plateformes et évite la dépendance à rsvg-convert.
"""
from PIL import Image, ImageDraw, ImageFilter
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

def draw_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = size / 512  # facteur d'échelle vs le design original (512x512)

    # Fond arrondi vert dégradé
    # (Pillow ne fait pas de dégradé natif ; on simule avec 2 teintes superposées)
    radius = int(96 * s)
    # On utilise une astuce : rectangle plein puis masque pour coins arrondis
    # Couleur : dégradé approché avec 2 rectangles
    bg_color = (16, 185, 129)       # emerald-500
    bg_color_dark = (5, 150, 105)   # emerald-600

    # Dessine un rectangle arrondi
    draw.rounded_rectangle(
        [0, 0, size, size],
        radius=radius,
        fill=bg_color_dark
    )

    # Superpose un "highlight" plus clair en haut
    highlight = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(highlight)
    hdraw.rounded_rectangle(
        [0, 0, size, int(size * 0.55)],
        radius=radius,
        fill=(*bg_color, 160)
    )
    img.paste(highlight, (0, 0), highlight)

    # Croix pharmacie blanche (2 rectangles)
    white = (255, 255, 255, 255)
    # Barre verticale
    draw.rounded_rectangle(
        [208 * s, 112 * s, 304 * s, 400 * s],
        radius=int(24 * s),
        fill=white
    )
    # Barre horizontale
    draw.rounded_rectangle(
        [112 * s, 208 * s, 400 * s, 304 * s],
        radius=int(24 * s),
        fill=white
    )

    # Petit disque blanc avec un check vert en bas à droite
    cx, cy = int(398 * s), int(398 * s)
    r = int(54 * s)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=white)
    # Check mark (polyline)
    check_color = bg_color_dark
    line_w = max(3, int(14 * s))
    points = [
        (cx - 22 * s, cy + 2 * s),
        (cx - 6  * s, cy + 18 * s),
        (cx + 24 * s, cy - 14 * s)
    ]
    draw.line(points, fill=check_color, width=line_w, joint='curve')

    return img

# Génération en plusieurs tailles
sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
images = {}
for s in sizes:
    im = draw_icon(s)
    images[s] = im
    path = os.path.join(OUT_DIR, f'icon-{s}.png')
    im.save(path, optimize=True)

# Icône principale (utilisée par électron-builder)
images[1024].save(os.path.join(OUT_DIR, 'icon.png'), optimize=True)
images[256].save(os.path.join(OUT_DIR, 'icon@256.png'), optimize=True)

# ICO (Windows) : Pillow gère directement
images[256].save(
    os.path.join(OUT_DIR, 'icon.ico'),
    format='ICO',
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
)

# Icon macOS (.icns) : Pillow peut le créer aussi
try:
    images[1024].save(
        os.path.join(OUT_DIR, 'icon.icns'),
        format='ICNS'
    )
    print('icon.icns généré')
except Exception as e:
    print(f'ICNS non généré (normal si Pillow ancien) : {e}')
    # electron-builder peut générer l'.icns à partir du .png sur macOS runners

# Favicon pour la page web
images[32].save(os.path.join(OUT_DIR, 'favicon.ico'), format='ICO', sizes=[(16, 16), (32, 32)])

print('Icônes générées :')
for f in sorted(os.listdir(OUT_DIR)):
    full = os.path.join(OUT_DIR, f)
    if os.path.isfile(full):
        print(f"  {f}  ({os.path.getsize(full):,} octets)")
