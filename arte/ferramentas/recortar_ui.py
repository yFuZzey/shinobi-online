# Recorta a arte da interface (pacotes 1 a 4) e grava src/ui/ui.json (PNG pequenos em base64, no tamanho do pixel real).
# Rodar da raiz do repositório: python3 arte/ferramentas/recortar_ui.py   (PREVIEW=1 grava arte/ui/preview.png)
import json, base64, io, os
import numpy as np
from PIL import Image
D = 'arte/ui'
def nativo(path, k):
    """volta a pixel art ao tamanho real: 1 bloco de k×k vira 1 pixel (pega o meio de cada bloco)"""
    a = np.array(Image.open(path).convert('RGBA'))
    h, w = a.shape[0] // k, a.shape[1] // k
    return a[k // 2::k, k // 2::k][:h, :w].copy()
def sem_magenta(a):
    m = (a[:, :, 0] > 230) & (a[:, :, 1] < 40) & (a[:, :, 2] > 230)
    a[m] = 0
    return a
# folhas: (arquivo, tamanho do bloco, {nome: (x, y, w, h) na imagem enviada})
FOLHAS = [
    ('folha_kit.png', 5, {
        'janela': (40, 40, 560, 480), 'painel': (680, 40, 320, 240),
        'aba_on': (680, 320, 280, 120), 'aba_off': (1000, 335, 280, 105),
        'btn': (40, 560, 320, 125), 'btn_press': (480, 565, 320, 120), 'btn_off': (920, 560, 320, 125),
        'campo': (40, 760, 400, 120), 'campo_foco': (480, 760, 400, 120), 'campo_erro': (920, 760, 400, 120),
        'x': (40, 920, 120, 125), 'x_press': (200, 925, 120, 120), 'x_off': (360, 920, 120, 125),
        'check_on': (680, 920, 120, 120), 'check_off': (840, 920, 120, 120)}),
    ('folha_hud.png', 5, {
        'retrato': (40, 40, 240, 240), 'placa': (360, 40, 480, 110),
        'barra_hp': (365, 190, 460, 90), 'barra_mp': (365, 320, 380, 80), 'barra_xp': (360, 440, 490, 55),
        'fill_hp': (45, 540, 410, 40), 'fill_mp': (45, 620, 330, 30), 'fill_xp': (40, 690, 450, 15)}),
]
INTEIRAS = [('fundo_login.png', 8, 'fundo_login'), ('logo.png', 6, 'logo'), ('icone_app.png', 16, 'icone')]
def png64(a):
    b = io.BytesIO(); Image.fromarray(a).save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
out, imgs = {}, {}
for f, k, pecas in FOLHAS:
    a = sem_magenta(nativo(os.path.join(D, f), k))
    for n, (x, y, w, h) in pecas.items():
        p = a[y // k:(y + h) // k, x // k:(x + w) // k]
        imgs[n] = p
# limpezas para as peças esticarem bem (9-slice)
PAPEL = (0xf0, 0xde, 0xaa, 255)
j = imgs['janela']  # tira as cantoneiras vermelhas de dentro do papel (sobrariam esticadas)
for y in range(21, j.shape[0] - 12):
    for x in range(13, j.shape[1] - 12):
        r, g, b, al = j[y, x]
        if al and r > 0x90 and g < 0x80 and b < 0x50: j[y, x] = PAPEL
c = imgs['campo_foco']  # tira o cursor desenhado (ficaria no meio esticado)
c[4:c.shape[0] - 4, 6:14] = c[4:c.shape[0] - 4, 15:16]
imgs['papel'] = j[40:56, 40:56].copy()  # textura de papel que repete no fundo das janelas
for f, k, n in INTEIRAS:
    imgs[n] = nativo(os.path.join(D, f), k)
for n, p in imgs.items():
    out[n] = {'w': int(p.shape[1]), 'h': int(p.shape[0]), 'src': png64(p)}
json.dump(out, open('src/ui/ui.json', 'w'), separators=(',', ':'))
# ícone do APK (Android): normal, redondo e a frente do ícone adaptativo (fundo marrom vem do ajustar-android.js)
ic = Image.open(os.path.join(D, 'icone_app.png')).convert('RGBA')
for dpi, sz in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    d = os.path.join(D, 'android', 'res', 'mipmap-' + dpi); os.makedirs(d, exist_ok=True)
    i = ic.resize((sz, sz), Image.LANCZOS)
    i.save(os.path.join(d, 'ic_launcher.png')); i.save(os.path.join(d, 'ic_launcher_round.png'))
    fg = sz * 108 // 48; inner = round(fg * 0.62)
    f = Image.new('RGBA', (fg, fg), (0, 0, 0, 0)); f.alpha_composite(ic.resize((inner, inner), Image.LANCZOS), ((fg - inner) // 2, (fg - inner) // 2))
    f.save(os.path.join(d, 'ic_launcher_foreground.png'))
print('ui.json', os.path.getsize('src/ui/ui.json'), 'bytes;', ', '.join(f'{n} {v["w"]}x{v["h"]}' for n, v in out.items()))
if os.environ.get('PREVIEW'):
    Z = 4; W = 1400; x = y = 10; lh = 0; cv = Image.new('RGBA', (W, 1600), (60, 160, 60, 255))
    for n, p in imgs.items():
        if n == 'fundo_login': continue
        im = Image.fromarray(p).resize((p.shape[1] * Z, p.shape[0] * Z), Image.NEAREST)
        if x + im.width > W: x = 10; y += lh + 10; lh = 0
        cv.alpha_composite(im, (x, y)); x += im.width + 10; lh = max(lh, im.height)
    cv.crop((0, 0, W, y + lh + 10)).save(os.path.join(D, 'preview.png'))
