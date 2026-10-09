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
# pacotes 5 a 8 (grade de 5 px)
G5 = lambda x, y, w, h: (x, y, w, h)
FOLHAS += [
    ('p5_botoes.png', 5, {f'hb_{n}{e}': (60 + i * 200, y, 160, 165 if r != 1 else 160)
                          for i, n in enumerate(['mapa', 'mochila', 'status', 'chat', 'grupo'])
                          for r, (e, y) in enumerate([('', 60), ('_press', 275), ('_off', 480)])}),
    ('p6_controles.png', 5, {
        'jk_base': (45, 45, 310, 310), 'jk_manche': (445, 125, 130, 145), 'sk_item': (665, 105, 190, 190),
        'sk': (65, 465, 190, 190), 'sk_on': (330, 455, 215, 215), 'sk_off': (625, 465, 190, 190),
        'skg': (65, 785, 270, 270), 'skg_on': (450, 775, 295, 295), 'skg_off': (865, 785, 270, 270)}),
    ('p7_janela.png', 5, {
        'ab_mochila': (50, 45, 70, 85), 'ab_personagem': (245, 45, 80, 80), 'ab_status': (445, 45, 80, 80), 'ab_jutsus': (645, 60, 80, 60),
        'slot': (40, 200, 160, 160), 'slot_sel': (240, 200, 160, 160),
        **{'eq_' + n: (40 + i * 200, 440, 160, 160) for i, n in enumerate(['cabeca', 'capa', 'arma', 'mao', 'acessorio'])},
        **{'rar_' + n: (40 + i * 200, 680, 160, 160) for i, n in enumerate(['comum', 'raro', 'epico', 'lendario'])}}),
    ('p8_atributos.png', 5, {'at_' + n: (40 + (i % 6) * 180, 40 + (i // 6) * 180, 140, 140) for i, n in enumerate(
        ['str', 'agi', 'vit', 'int', 'dex', 'luk', 'hp', 'mp', 'pf', 'pc', 'crit', 'esq', 'prec', 'red', 'spd', 'cdr', 'mpr'])}),
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
# pacotes 9 a 11: imagens sem grade de pixel, fundo rosa. Tira o fundo, recorta e reduz; vão para src/ui/icones.json (o jogo usa no JS)
def soltas(f, pecas, alvo):
    a = np.array(Image.open(os.path.join(D, f)).convert('RGB')).astype(int)
    bg = np.median(a[:6].reshape(-1, 3), 0)
    d = np.abs(a - bg).sum(2)
    rosa = (a[:, :, 0] > 170) & (a[:, :, 2] > 120) & (a[:, :, 1] < 90) & (np.abs(a[:, :, 0] - a[:, :, 2]) < 110)
    al = np.where((d < 90) | rosa, 0, 255).astype(np.uint8)
    rgba = np.dstack([a.astype(np.uint8), al])
    res = {}
    for n, (x, y, w, h) in pecas.items():
        im = Image.fromarray(rgba[y:y + h, x:x + w])
        bb = im.getbbox(); im = im.crop(bb)
        W, H = alvo if isinstance(alvo, tuple) else (alvo, round(alvo * im.height / im.width)) if im.width >= im.height else (round(alvo * im.width / im.height), alvo)
        im = im.resize((W, H), Image.LANCZOS)
        q = np.array(im); q[:, :, 3] = np.where(q[:, :, 3] >= 110, 255, 0); res[n] = q
    return res
ICO = {}
U = ['katon', 'goka', 'hosenka', 'goryuka', 'genj', 'amat', 'tsuku', 'sus', 'olho1', 'olho2', 'olho3', 'mgk_itachi', 'mgk_sasuke', 'mgk_madara']
B10 = [(40, 62, 269, 270), (335, 62, 270, 270), (632, 62, 272, 270), (932, 62, 272, 270), (1230, 62, 268, 270), (41, 374, 266, 271), (335, 374, 268, 271),
       (632, 374, 271, 272), (932, 374, 269, 272), (1231, 374, 267, 272), (179, 688, 267, 266), (485, 688, 265, 266), (787, 688, 265, 266), (1090, 688, 266, 266)]
ICO.update(soltas('p10_uchiha.png', dict(zip(U, B10)), 80))
H = ['palma', 'kaiten', 'hakke', 'byak', 'kusho', 'h128', 'sojishi', 'kperf']
B11 = [(37, 122, 342, 340), (411, 122, 344, 340), (785, 122, 344, 341), (1157, 122, 346, 342), (38, 514, 341, 336), (412, 514, 345, 336), (787, 514, 343, 336), (1159, 514, 345, 336)]
ICO.update(soltas('p11_hyuga.png', dict(zip(H, B11)), 80))
ICO.update(soltas('p9_clas.png', {'emb_uchiha': (119, 61, 343, 343), 'emb_hyuga': (595, 61, 347, 345), 'emb_nara': (1070, 60, 343, 346)}, 96))
ICO.update(soltas('p9_clas.png', {'rolo_uchiha': (34, 444, 208, 525), 'rolo_uchiha_on': (261, 407, 243, 572), 'rolo_hyuga': (542, 444, 201, 525),
                                  'rolo_hyuga_on': (772, 407, 240, 573), 'rolo_nara': (1050, 444, 206, 526), 'rolo_nara_on': (1270, 408, 244, 576)}, 200))
# pacote 12: jutsus do Nara (15 desenhos; os que não estão na lista são variações guardadas na folha)
B12 = [(7, 4, 261, 250), (283, 5, 260, 249), (558, 4, 261, 250), (833, 4, 261, 250), (1108, 4, 261, 250),
       (8, 264, 259, 245), (284, 264, 258, 245), (558, 264, 259, 245), (834, 264, 259, 245), (1109, 264, 259, 245),
       (9, 520, 257, 247), (284, 520, 258, 247), (559, 520, 258, 247), (834, 520, 258, 247), (1110, 520, 258, 247)]
N12 = {'shuri': 0, 'poss': 1, 'nui': 3, 'kubi': 4, 'yose': 5, 'sombra': 9, 'campo': 11, 'intelecto': 12, 'dominio': 13}
ICO.update(soltas('p12_nara.png', {n: B12[i] for n, i in N12.items()}, 80))
# pacote 13: ícones de estado, números de dano (5 cores), faixa e círculos de aviso
ST = ['st_fogo', 'st_veneno', 'st_escudo', 'st_confuso', 'st_selo', 'st_lento', 'st_forca', 'st_veloc', 'st_regen', 'st_preso']
B13 = [(27, 24, 115, 117), (149, 25, 115, 116), (271, 25, 115, 116), (392, 25, 115, 116), (514, 25, 115, 116),
       (637, 25, 115, 116), (758, 25, 115, 116), (880, 24, 115, 117), (1003, 25, 114, 116), (1126, 25, 114, 116)]
ICO.update(soltas('p13_efeitos.png', dict(zip(ST, B13)), 40))
ICO.update(soltas('p13_efeitos.png', {'faixa': (30, 478, 1206, 96)}, 480))
ICO.update(soltas('p13_efeitos.png', {'runa_vermelha': (36, 569, 276, 256), 'runa_azul': (344, 572, 272, 254), 'runa_mista': (646, 571, 278, 256), 'runa_some': (955, 572, 265, 255)}, 128))
def digitos(f, faixas, alto):
    """cada cor vira uma tira 0-9 com células da mesma largura (o jogo pega o dígito pela posição)"""
    a = np.array(Image.open(os.path.join(D, f)).convert('RGB')).astype(int)
    rosa = (a[:, :, 0] > 170) & (a[:, :, 2] > 120) & (a[:, :, 1] < 90) & (np.abs(a[:, :, 0] - a[:, :, 2]) < 110)
    rgba = np.dstack([a.astype(np.uint8), np.where(rosa, 0, 255).astype(np.uint8)])
    res = {}
    for nome, (y0, y1) in faixas.items():
        cols = (~rosa[y0:y1]).sum(0); runs = []; ini = None
        for x, v in enumerate(cols):
            if v and ini is None: ini = x
            if not v and ini is not None:
                if x - ini > 10: runs.append((ini, x))
                ini = None
        ds = []
        for x0, x1 in runs[:10]:
            im = Image.fromarray(rgba[y0:y1, x0:x1]); im = im.crop(im.getbbox())
            im = im.resize((max(1, round(im.width * alto / im.height)), alto), Image.LANCZOS)
            q = np.array(im); q[:, :, 3] = np.where(q[:, :, 3] >= 110, 255, 0); ds.append(q)
        cw = max(d.shape[1] for d in ds); tira = np.zeros((alto, cw * 10, 4), np.uint8)
        for i, d in enumerate(ds): o = i * cw + (cw - d.shape[1]) // 2; tira[:, o:o + d.shape[1]] = d
        res[nome] = tira
    return res
ICO.update(digitos('p13_efeitos.png', {'dg_branco': (169, 226), 'dg_amarelo': (232, 289), 'dg_verde': (296, 352), 'dg_cinza': (360, 416), 'dg_vermelho': (423, 476)}, 22))
def webp64(a):
    b = io.BytesIO(); Image.fromarray(a).save(b, 'WEBP', quality=90, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
json.dump({n: webp64(p) for n, p in ICO.items()}, open('src/ui/icones.json', 'w'), separators=(',', ':'))
print('icones.json', os.path.getsize('src/ui/icones.json'), 'bytes;', ', '.join(f'{n} {p.shape[1]}x{p.shape[0]}' for n, p in ICO.items()))
if os.environ.get('PREVIEW'):
    Z = 2; x = y = 10; lh = 0; cv = Image.new('RGBA', (1400, 3000), (60, 160, 60, 255))
    for n, p in ICO.items():
        im = Image.fromarray(p).resize((p.shape[1] * Z, p.shape[0] * Z), Image.NEAREST)
        if x + im.width > 1400: x = 10; y += lh + 10; lh = 0
        cv.alpha_composite(im, (x, y)); x += im.width + 10; lh = max(lh, im.height)
    cv.crop((0, 0, 1400, y + lh + 10)).save(os.path.join(D, 'preview_icones.png'))
# ícone do APK (Android): normal, redondo e a frente do ícone adaptativo (fundo marrom vem do ajustar-android.js)
ic = Image.open(os.path.join(D, 'icone_app.png')).convert('RGBA')
for dpi, sz in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    d = os.path.join(D, 'icone_app_res', 'res', 'mipmap-' + dpi); os.makedirs(d, exist_ok=True)
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
