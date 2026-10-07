# Recorta as poses de golpe: tira o fundo azul, reduz para o tamanho do sprite do jogo (personagem ~105 px de altura)
from PIL import Image, ImageDraw
import numpy as np, json
from scipy import ndimage
SRC=np.asarray(Image.open('sheet.png').convert('RGB')).astype(float)
BG=np.array([46.,100.,190.])
BOX=[(50,211,14,262),(296,478,14,262),(531,759,19,262),(818,979,14,262),(40,216,270,518),(290,478,270,518),(546,713,280,518),(838,964,316,518),
     (50,211,531,774),(414,606,531,774),(618,805,536,774),(818,990,546,774),(24,181,787,1024),(219,396,787,1024),(418,606,787,1024),(609,805,787,1024),(818,1015,787,1024)]
LO,HI=28.,80.
def matte(rgb):
    d=np.sqrt(((rgb-BG)**2).sum(axis=2));a=np.clip((d-LO)/(HI-LO),0,1)
    col=np.where(a[...,None]>0,(rgb-(1-a[...,None])*BG)/np.maximum(a[...,None],1e-3),0)
    return np.clip(col,0,255),a
K=105/236.  # escala: altura do personagem na folha (~236) → altura no jogo (105, igual ao parado)
FR=[]
for i,(x0,x1,y0,y1) in enumerate(BOX):
    x0,y0=max(0,x0-2),max(0,y0-2);x1,y1=min(1024,x1+2),min(1024,y1+2)
    col,a=matte(SRC[y0:y1,x0:x1])
    # tira pedacinhos soltos (de quadros vizinhos)
    lb,n=ndimage.label(a>.5)
    if n>1:
        sz=ndimage.sum(a>.5,lb,range(1,n+1));keep=np.isin(lb,[j+1 for j,z in enumerate(sz) if z>=60])
        near=ndimage.binary_dilation(keep,iterations=10);a=a*near
    # reduz com alfa pré-multiplicado
    pm=np.dstack([col*a[...,None],a*255]).astype(np.float32)
    h,w=a.shape;nw,nh=max(1,round(w*K)),max(1,round(h*K))
    ch=[np.asarray(Image.fromarray(pm[...,c]).resize((nw,nh),Image.LANCZOS)) for c in range(4)]
    A=np.clip(ch[3],0,255);rgb=np.dstack([np.clip(ch[c]/np.maximum(A/255,1e-3),0,255) for c in range(3)])
    A=np.where(A<10,0,A)
    out=np.dstack([rgb,A]).astype(np.uint8)
    ys,xs=np.where(A>0);out=out[ys.min():ys.max()+1,xs.min():xs.max()+1]
    FR.append(out)
np.save('frames.npy',np.array(FR,dtype=object),allow_pickle=True)
# folha numerada para conferir
W=sum(f.shape[1]*3+10 for f in FR[:9]);can=Image.new('RGBA',(W,2*(max(f.shape[0] for f in FR)*3+30)),(90,140,90,255));x=y=0;dr=ImageDraw.Draw(can)
for i,f in enumerate(FR):
    if i==9:x=0;y=max(ff.shape[0] for ff in FR)*3+30
    im=Image.fromarray(f,'RGBA');im=im.resize((im.width*3,im.height*3),Image.NEAREST);can.alpha_composite(im,(x,y+20));dr.text((x+4,y+2),str(i),fill=(255,255,0,255));x+=im.width+10
can.save('frames_num.png');print([f.shape[:2] for f in FR])
