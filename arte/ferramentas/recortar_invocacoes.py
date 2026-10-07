# Recorta as folhas das invocações (Gamabunta, Katsuyu, Manda) e monta o atlas do jogo (src/inv/ifx.json + ícones).
# Uso (de dentro de arte/invocacoes): python3 ../ferramentas/recortar_invocacoes.py [pasta_de_saida_src_inv]
# As folhas têm fundo liso escuro (com degradê) e nomes de quadro em branco ("A1", "B2"…):
#  1) o fundo de cada ponto é estimado por uma mediana grande (acompanha o degradê);
#  2) o que se afasta do fundo vira desenho; os nomes dos quadros são apagados antes (retângulos em LAB);
#  3) cada quadro fica só com os pedaços que estão de verdade dentro da caixa dele (o vizinho que encosta não entra);
#  4) opacidade suave na borda e cor "descontaminada" do fundo; miolo do bicho fica sólido.
# Cada quadro no atlas: [x, y, largura, altura, pontoX, pontoY]; o ponto fica no chão (bichos) ou no centro (efeitos).
import sys, os, io, json, base64
import numpy as np
from PIL import Image
from scipy import ndimage

OUT = sys.argv[1] if len(sys.argv) > 1 else '../../src/inv'
DS = .62          # o atlas guarda os quadros a 62% da folha (a folha é pixel art ampliada); a escala no jogo compensa
PREV = os.environ.get('PREVIEW', '')

VMAX = {'folha_sapo.png': 105, 'folha_lesma.png': 85, 'folha_cobra.png': 100}  # o fundo de cada folha nunca é mais claro que isso
def carrega(nome, cel=16):
    """fundo de cada ponto: a cor mais comum de cada pedaço de 32×32 (o fundo é liso); pedaço tomado pelo desenho
    (fumaça grande, bicho) pega a cor dos vizinhos"""
    a = np.asarray(Image.open(nome).convert('RGB')).astype(float)
    H, W = a.shape[:2]; gh, gw = (H + cel - 1) // cel, (W + cel - 1) // cel
    G = np.zeros((gh, gw, 3)); ok = np.zeros((gh, gw), bool)
    q = (a // 6).astype(int); key = q[..., 0] * 10000 + q[..., 1] * 100 + q[..., 2]
    for j in range(gh):
        for i in range(gw):
            blk = key[j * cel:(j + 1) * cel, i * cel:(i + 1) * cel].ravel(); px = a[j * cel:(j + 1) * cel, i * cel:(i + 1) * cel].reshape(-1, 3)
            v, c = np.unique(blk, return_counts=True); k = v[np.argmax(c)]; sel = blk == k
            col = px[sel].mean(0); G[j, i] = col
            ok[j, i] = c.max() >= blk.size * .2 and col.max() < VMAX[nome] and (col.max() - col.min()) < 90
    # pedaço sem fundo confiável: cor do vizinho válido mais perto, depois suaviza
    if not ok.all():
        _, (iy, ix) = ndimage.distance_transform_edt(~ok, return_indices=True); G = G[iy, ix]
    G = ndimage.uniform_filter(G, size=(3, 3, 1), mode='nearest')
    bg = np.asarray(Image.fromarray(np.clip(G, 0, 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)).astype(float)
    return a, bg

# ---------------------------------------------------------------- quadros de cada folha
# fase: (folha, tipo, [(x0, x1, y0, y1), …], escala no jogo, sólido?)   tipo 'g' = pés no chão · 'c' = centro
LESMA_LAB = []
def lesma_linha(y, xs, fim, prox=None):
    """quadros de uma linha da folha da Katsuyu: começa no nome do quadro (x) e vai até o próximo"""
    L = []
    for i, x in enumerate(xs):
        x1 = (xs[i + 1] - 3) if i + 1 < len(xs) else (prox or 1372)
        L.append((x, x1, y, fim)); LESMA_LAB.append((x - 2, y - 2, x + 25, y + 16))
    return L
C8 = [14, 179, 348, 519, 691, 863, 1034, 1203]
F = {
 # Gamabunta (sapo): corrida, golpe do sabre (vira "defesa" quando o escudo segura um golpe), fumaça, revelação e poeira
 'sp_run':  ('folha_sapo.png', 'g', [(12,162,73,188),(162,300,73,188),(300,452,73,188),(452,615,73,188),(615,795,73,188),(795,948,73,188),(948,1105,73,188),(1105,1258,73,188)], .74, 1),
 'sp_atk':  ('folha_sapo.png', 'g', [(10,150,220,348),(155,300,220,348),(300,450,220,348),(450,615,220,348),(615,792,220,348),(792,1003,220,348),(1003,1258,220,348)], .74, 1),
 'sp_fum':  ('folha_sapo.png', 'g', [(30,155,505,703),(158,315,505,703),(315,476,505,703),(476,666,505,703),(666,928,505,703)], .74, 0),
 'sp_rev':  ('folha_sapo.png', 'g', [(935,1258,495,706)], .74, 0),
 'sp_po':   ('folha_sapo.png', 'g', [(172,248,385,475),(258,360,385,475)], .6, 0),
 # Katsuyu (lesma): andar, cura (ativa), aura de cura, campo no chão, fumaça/materialização, chegada e saída
 'ls_mov':  ('folha_lesma.png', 'g', lesma_linha(59, C8, 120), .52, 1),
 'ls_cur':  ('folha_lesma.png', 'g', lesma_linha(146, C8, 222), .52, 0),
 'ls_aur':  ('folha_lesma.png', 'g', lesma_linha(245, C8, 324), .52, 0),
 'ls_cmp':  ('folha_lesma.png', 'c', lesma_linha(459, [15, 179, 348, 519], 542, 690), .42, 0),
 'ls_fum':  ('folha_lesma.png', 'g', lesma_linha(568, [15, 147, 279, 412, 544], 665, 690), .52, 0),
 'ls_che':  ('folha_lesma.png', 'g', lesma_linha(568, [703, 829, 962, 1096, 1230], 665), .52, 0),
 'ls_sai':  ('folha_lesma.png', 'g', lesma_linha(680, [15, 147, 282, 418, 553, 689, 825, 961, 1097, 1230], 768), .52, 0),
 # Manda (cobra): bote, mordida, fumaça de chakra, selo de invocação e pulso de chakra (veneno)
 'cb_atk':  ('folha_cobra.png', 'g', [(10,140,288,414),(145,277,288,414),(280,412,288,414),(415,586,288,414),(588,742,288,414),(742,877,288,414),(880,1012,288,414)], .55, 1),
 'cb_mor':  ('folha_cobra.png', 'c', [(0,106,476,572),(106,206,476,572),(208,322,476,572)], .5, 0),
 'cb_fum':  ('folha_cobra.png', 'g', [(10,176,634,742),(180,336,634,742),(340,492,634,742),(10,142,742,858),(145,276,742,858),(280,406,742,858),(406,508,742,858)], .55, 0),
 'cb_selo': ('folha_cobra.png', 'g', [(545,714,736,862),(716,896,736,862),(898,1012,736,862)], .55, 0),
 'cb_pul':  ('folha_cobra.png', 'g', [(8,116,922,1014),(118,226,922,1014),(228,338,922,1014)], .55, 0),
}
APAGA = {'folha_sapo.png': [(6, 508, 36, 548), (938, 508, 972, 548), (62, 0, 640, 75), (0, 0, 40, 75)], 'folha_lesma.png': LESMA_LAB, 'folha_cobra.png': []}

FOLHAS = {}
def folha(nome):
    if nome in FOLHAS: return FOLHAS[nome]
    a, bg = carrega(nome)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    for (x0, y0, x1, y1) in APAGA[nome]: d[y0:y1, x0:x1] = 0
    m = ndimage.binary_opening(d > 30, iterations=1) | (d > 70)
    lb, n = ndimage.label(ndimage.binary_dilation(m, iterations=1), structure=np.ones((3, 3)))
    tot = ndimage.sum(np.ones_like(lb), lb, range(n + 1))
    FOLHAS[nome] = (a, bg, d, m, lb, tot)
    return FOLHAS[nome]

def quadro(nome, box, solido):
    a, bg, d, m, lb, tot = folha(nome)
    x0, x1, y0, y1 = box
    # pedaços dentro da caixa: o maior (o bicho) fica sempre; os outros saem se encostam na borda (é o quadro vizinho entrando)
    mm = m[y0:y1, x0:x1]
    sub, n = ndimage.label(ndimage.binary_dilation(mm, iterations=1), structure=np.ones((3, 3)))
    sz = ndimage.sum(np.ones_like(sub), sub, range(n + 1)); big = int(np.argmax(sz[1:]) + 1) if n else 0
    keep = []
    for i in range(1, n + 1):
        ys, xs = np.where(sub == i)
        borda = xs.min() == 0 or xs.max() == sub.shape[1] - 1 or ys.min() == 0 or ys.max() == sub.shape[0] - 1
        if i == big or (not borda and sz[i] >= 4): keep.append(i)
    km = np.isin(sub, keep) & mm
    dd = d[y0:y1, x0:x1]; rgb = a[y0:y1, x0:x1]; b = bg[y0:y1, x0:x1]
    al = np.clip((dd - 16) / (60 - 16), 0, 1) * ndimage.binary_dilation(km, iterations=2)
    if solido:
        sol = ndimage.binary_fill_holes(ndimage.binary_closing(km, iterations=2))
        al = np.maximum(al, ndimage.binary_erosion(sol, iterations=1) * 1.0)
    al = np.where(al < .05, 0, al)
    c = np.where(al[..., None] > 0, (rgb - (1 - al[..., None]) * b) / np.maximum(al[..., None], 1e-3), 0)
    o = np.zeros(rgb.shape[:2] + (4,)); o[..., :3] = np.clip(c, 0, 255); o[..., 3] = al * 255
    ys, xs = np.where(al > .05)
    o = o[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return o

def ponto(img, tipo):
    al = img[..., 3] / 255.
    if tipo == 'c': return img.shape[1] / 2, img.shape[0] / 2
    s = al > .6; ys, xs = np.where(s)
    gy = float(np.percentile(ys, 99.5))
    low = s & (np.arange(img.shape[0])[:, None] > gy - img.shape[0] * .3)
    yy, xx = np.where(low)
    return float(xx.mean()), gy

items = []
for fase, (nome, tipo, boxes, esc, sol) in F.items():
    for i, box in enumerate(boxes):
        img = quadro(nome, box, sol)
        gx, gy = ponto(img, tipo)
        pim = Image.fromarray(img.astype(np.uint8), 'RGBA')
        nw, nh = max(1, round(pim.width * DS)), max(1, round(pim.height * DS))
        sm = np.asarray(pim.resize((nw, nh), Image.LANCZOS)).astype(float)
        items.append(dict(k=fase, i=i, img=sm, gx=gx * nw / pim.width, gy=gy * nh / pim.height))

# empacota em prateleiras (mais altos primeiro)
order = sorted(range(len(items)), key=lambda j: -items[j]['img'].shape[0])
W = 1024; x = y = sh = 0
for j in order:
    it = items[j]; h, w = it['img'].shape[:2]
    if x + w > W: x = 0; y += sh + 1; sh = 0
    it['x'], it['y'] = x, y; x += w + 1; sh = max(sh, h)
H = y + sh; atl = np.zeros((H, W, 4), np.uint8)
for it in items:
    h, w = it['img'].shape[:2]; atl[it['y']:it['y'] + h, it['x']:it['x'] + w] = np.clip(it['img'], 0, 255).astype(np.uint8)
im = Image.fromarray(atl, 'RGBA'); im.save('atlas.png')
b = io.BytesIO(); im.save(b, 'WEBP', quality=82, method=6, alpha_quality=80); wb = b.getvalue()
meta = {}
for it in sorted(items, key=lambda q: (q['k'], q['i'])):
    meta.setdefault(it['k'], []).append([it['x'], it['y'], it['img'].shape[1], it['img'].shape[0], round(it['gx'], 1), round(it['gy'], 1)])
sc = {f: round(F[f][3] / DS, 4) for f in F}

def icone(fase, i, size=96, pad=4):
    it = next(q for q in items if q['k'] == fase and q['i'] == i)
    f = it['img']; a = f[..., 3] > 8; ys, xs = np.where(a); c = np.clip(f[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 0, 255).astype(np.uint8)
    img = Image.fromarray(c, 'RGBA'); s = (size - 2 * pad) / max(img.size); img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    can = Image.new('RGBA', (size, size)); can.alpha_composite(img, ((size - img.width) // 2, (size - img.height) // 2))
    bb = io.BytesIO(); can.save(bb, 'WEBP', quality=88, method=6); can.save('icone_' + {'sp': 'sapo', 'ls': 'lesma', 'cb': 'cobra'}[fase[:2]] + '.png')
    return 'data:image/webp;base64,' + base64.b64encode(bb.getvalue()).decode()
IC = {'sapo': icone('sp_atk', 1), 'lesma': icone('ls_mov', 0), 'cobra': icone('cb_atk', 2)}
os.makedirs(OUT, exist_ok=True)
json.dump({'img': 'data:image/webp;base64,' + base64.b64encode(wb).decode(), 'f': meta, 's': sc}, open(os.path.join(OUT, 'ifx.json'), 'w'), separators=(',', ':'))
json.dump(IC, open(os.path.join(OUT, 'icons.json'), 'w'), separators=(',', ':'))
print('atlas', W, H, 'webp', len(wb), {k: len(v) for k, v in meta.items()})

if PREV:  # prévia: cada fase numa linha, sobre a areia, com o ponto do chão marcado
    rows = [[q for q in items if q['k'] == f] for f in F]
    WW = max(sum(q['img'].shape[1] + 6 for q in r) for r in rows) + 10; HH = sum(max(q['img'].shape[0] for q in r) + 10 for r in rows)
    can = Image.new('RGBA', (WW, HH), (214, 174, 118, 255)); yy = 0
    from PIL import ImageDraw
    dr = ImageDraw.Draw(can)
    for r in rows:
        xx = 5; hh = max(q['img'].shape[0] for q in r)
        for q in r:
            can.alpha_composite(Image.fromarray(np.clip(q['img'], 0, 255).astype(np.uint8), 'RGBA'), (xx, yy))
            px, py = xx + q['gx'], yy + q['gy']; dr.line([(px - 4, py), (px + 4, py)], fill=(255, 0, 0, 255)); dr.line([(px, py - 4), (px, py + 4)], fill=(255, 0, 0, 255))
            xx += q['img'].shape[1] + 6
        yy += hh + 10
    can.save(PREV)
