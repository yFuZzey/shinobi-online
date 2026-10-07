# posição da mão da frente em cada quadro do Hyuga (para o Chidori ficar na mão)
import json,base64,io,numpy as np
from PIL import Image
from scipy import ndimage
d=json.load(open('spr_hyuga.json'))
def img(u):return np.asarray(Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGBA')).astype(float)
def hand(f,cut):
    r,g,b,a=[f[...,c] for c in range(4)];H,W=f.shape[:2];mx=np.maximum(np.maximum(r,g),b);mn=np.minimum(np.minimum(r,g),b);s=np.where(mx>0,(mx-mn)/np.maximum(mx,1),0);rr=np.maximum(r,1)
    skin=(r>85)&(g/rr>.45)&(g/rr<.9)&(b/rr>.28)&(b/rr<.8)&(s>.25)&(r-b>28)&(a>60)
    lb,n=ndimage.label(skin,structure=np.ones((3,3)))
    # rosto = mancha de pele que começa logo abaixo da faixa da testa (linha do cabelo - ~9)
    dark=(mx<95)&(s<.4)&(a>100);hy,hx=np.where(dark[:max(4,int(cut-10))]);hx0,hx1=hx.min(),hx.max()   # largura da cabeça (cabelo)
    face=set()
    for i in range(1,n+1):
        ys,xs=np.where(lb==i)
        if len(ys) and ys.min()<=cut+2 and ys.min()>=cut-14 and len(ys)>=15 and hx0-2<=xs.mean()<=hx1+2:face.add(i)
    best=None
    for i in range(1,n+1):
        if i in face:continue
        ys,xs=np.where(lb==i)
        if len(xs)<4:continue
        if ys.mean()<cut-6 or ys.mean()>H*.85:continue
        if best is None or xs.max()>best[0]:best=(xs.max(),ys,xs)
    if best is None:return None
    xm,ys,xs=best;sel=xs>=xm-5;return (xs[sel].mean(),ys[sel].mean())
out={};vis=[]
for k in ['hya','hyw','hyr']:
    out[k]=[]
    for i,u in enumerate(d['f'][k]):
        f=img(u);h=hand(f,d['hyc'][k][i]);ax,ay=d['hyx'][k][i]
        if h is None:out[k].append(None);continue
        out[k].append([round(h[0]-ax,1),round(h[1]-ay,1)])
        if (k=='hya' and i in (0,1,2,5,6,7,18,20)) or (k!='hya' and i in (0,2,4,6)):
            g=f.copy();x,y=int(h[0]),int(h[1]);g[max(0,y-2):y+3,max(0,x-2):x+3]=[0,255,255,255];vis.append(Image.fromarray(g.astype(np.uint8),'RGBA').resize((g.shape[1]*3,g.shape[0]*3),Image.NEAREST))
print(json.dumps(out))
json.dump(out,open('maos.json','w'))
W=sum(v.width+8 for v in vis);Hh=max(v.height for v in vis);can=Image.new('RGBA',(W,Hh),(90,140,90,255));x=0
for v in vis:can.alpha_composite(v,(x,Hh-v.height));x+=v.width+8
can.save('maos.png')
