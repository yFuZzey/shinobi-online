# Recorta as poses de golpe do Hyuga: tira o fundo azul (estimado em volta de cada pose), reduz para o tamanho do sprite do jogo
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage
SRC=np.asarray(Image.open('sheet.png').convert('RGB')).astype(float)
BOX=[(37,162,7,198),(520,660,7,198),(844,1024,11,198),(1217,1343,7,198),(29,166,201,390),(516,660,201,390),(857,988,209,390),(1233,1331,235,390),
     (38,162,398,582),(210,335,398,582),(694,843,398,582),(1056,1201,402,582),(1215,1350,409,582),
     (21,144,590,768),(197,319,590,768),(372,510,590,768),(541,680,590,768),(707,854,590,768),(871,1028,590,768),(1041,1199,590,768),(1217,1370,590,768)]
LO,HI=30.,85.
def crop(i):
    x0,x1,y0,y1=BOX[i];x0,y0=max(0,x0-3),max(0,y0-3);x1,y1=min(SRC.shape[1],x1+3),min(SRC.shape[0],y1+3)
    reg=SRC[y0:y1,x0:x1];bd=np.concatenate([reg[:2].reshape(-1,3),reg[-2:].reshape(-1,3),reg[:,:2].reshape(-1,3),reg[:,-2:].reshape(-1,3)])
    bg=np.median(bd,axis=0);d=np.sqrt(((reg-bg)**2).sum(axis=2));a=np.clip((d-LO)/(HI-LO),0,1)
    col=np.where(a[...,None]>0,(reg-(1-a[...,None])*bg)/np.maximum(a[...,None],1e-3),0)
    lb,n=ndimage.label(a>.5)
    if n>1:
        sz=ndimage.sum(a>.5,lb,range(1,n+1));keep=np.isin(lb,[j+1 for j,z in enumerate(sz) if z>=60])
        a=a*ndimage.binary_dilation(keep,iterations=10)
    return np.clip(col,0,255),a
if __name__=='__main__':
    H=[]
    for i in range(len(BOX)):
        col,a=crop(i);ys,xs=np.where(a>.5);H.append(ys.max()-ys.min()+1)
    print('alturas',H)

ROWH=[179]*4+[178]*4+[173]*5+[171]*8   # altura do personagem em pé em cada linha da folha
def frames():
    FR=[]
    for i in range(len(BOX)):
        col,a=crop(i);K=105/ROWH[i]
        pm=np.dstack([col*a[...,None],a*255]).astype(np.float32);h,w=a.shape;nw,nh=max(1,round(w*K)),max(1,round(h*K))
        ch=[np.asarray(Image.fromarray(pm[...,c]).resize((nw,nh),Image.LANCZOS)) for c in range(4)]
        A=np.clip(ch[3],0,255);rgb=np.dstack([np.clip(ch[c]/np.maximum(A/255,1e-3),0,255) for c in range(3)]);A=np.where(A<10,0,A)
        out=np.dstack([rgb,A]).astype(np.uint8);ys,xs=np.where(A>0);FR.append(out[ys.min():ys.max()+1,xs.min():xs.max()+1])
    return FR
if __name__=='__main__':
    FR=frames();np.save('frames.npy',np.array(FR,dtype=object),allow_pickle=True)
    W=sum(f.shape[1]*3+10 for f in FR[:11]);Hm=max(f.shape[0] for f in FR)*3+30
    can=Image.new('RGBA',(W,2*Hm),(90,140,90,255));x=y=0;dr=ImageDraw.Draw(can)
    for i,f in enumerate(FR):
        if i==11:x=0;y=Hm
        im=Image.fromarray(f,'RGBA');im=im.resize((im.width*3,im.height*3),Image.NEAREST);can.alpha_composite(im,(x,y+20+(Hm-30-im.height)));dr.text((x+4,y+2),str(i),fill=(255,255,0,255));x+=im.width+10
    can.save('frames_num.png');print([f.shape[:2] for f in FR])
