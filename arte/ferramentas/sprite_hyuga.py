# Junta os quadros do Hyuga (golpes, andar, correr) no formato do sprite do jogo:
# f = imagens; hyc = linha do cabelo por quadro (para pintar a cor escolhida); hyx = ponto dos pés por quadro
import numpy as np, json, io, base64
from PIL import Image
GOL=np.load('frames.npy',allow_pickle=True);AND=np.load('frames_andar.npy',allow_pickle=True)
OFF=None  # calibrado abaixo pelo personagem atual
def masks(f):
    f=f.astype(float);r,g,b,a=[f[...,c] for c in range(4)];mx=np.maximum(np.maximum(r,g),b);mn=np.minimum(np.minimum(r,g),b);s=np.where(mx>0,(mx-mn)/np.maximum(mx,1),0)
    rr=np.maximum(r,1);skin=(r>85)&(g/rr>.45)&(g/rr<.9)&(b/rr>.28)&(b/rr<.8)&(s>.25)&(r-b>28)&(a>100)
    dark=(mx<95)&(s<.4)&(a>100);return skin,dark
def face_top(f):
    """primeira linha de pele do rosto (logo abaixo da faixa), procurando só na largura da cabeça"""
    skin,dark=masks(f);ys,xs=np.where(dark[:12]);x0,x1=xs.min()-4,xs.max()+4
    cnt=skin[:,max(0,x0):x1+1].sum(1)
    for y in range(len(cnt)):
        if cnt[y]>=3:return y
    return 20
def band_bottom(f):return face_top(f)
def feet(f):
    a=f[...,3]>100;h=a.shape[0];ys,xs=np.where(a[int(h*.62):int(h*.97)]);return [round(float(xs.mean()),1),h-1]
def uri(f):
    im=Image.fromarray(f.astype(np.uint8),'RGBA').quantize(colors=255,method=Image.FASTOCTREE,dither=Image.NONE)
    b=io.BytesIO();im.save(b,'PNG',optimize=True);return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
from PIL import Image as _I
OFF=34.2-face_top(np.asarray(_I.open('../golpes/old_idle0.png').convert('RGBA')))
print('OFF',OFF)
SETS={'hya':list(GOL),'hyw':list(AND[0:8]),'hyr':list(AND[9:18])}
out={'f':{},'hyc':{},'hyx':{}}
for k,L in SETS.items():
    out['f'][k]=[uri(f) for f in L];out['hyc'][k]=[round(float(band_bottom(f)+OFF),1) for f in L];out['hyx'][k]=[feet(f) for f in L]
json.dump(out,open('spr_hyuga.json','w'),separators=(',',':'))
print({k:len(v) for k,v in out['f'].items()},'tamanho',len(json.dumps(out)))
print('cabelo andar',out['hyc']['hyw'],'correr',out['hyc']['hyr'])
