# Junta os quadros num atlas WebP + dados (onde está cada quadro e o ponto do chão) para o jogo
from PIL import Image
import numpy as np, json, io, base64
D=np.load('frames.npy',allow_pickle=True).item();PH,EX=D['PH'],D['EX']
# ponto do chão (pés do personagem) em cada quadro, medido na grade
G={'p1':(64,52),'p2':(75,103),'p3':(64,110),'p4':(75,134)}
seqs={k:PH[k] for k in ['p1','p2','p3','p4','p5']}
seqs['rastro']=EX['rastro'];seqs['frag']=EX['frag'];seqs['icon']=EX['icon']
# alinha cada esfera (fases 3, 4 e começo da 5) com a esfera de referência (fase 3, quadro 4) pela forma
from scipy.signal import correlate
REF=PH['p3'][3][...,3]/255.;RG=G['p3']
def shift(f):
    a=f[...,3]/255.;H=max(a.shape[0],REF.shape[0])+80;W=max(a.shape[1],REF.shape[1])+80
    A=np.zeros((H,W));B=np.zeros((H,W));A[40:40+a.shape[0],40:40+a.shape[1]]=a;B[40:40+REF.shape[0],40:40+REF.shape[1]]=REF
    c=correlate(A,B,mode='same',method='fft');y,x=np.unravel_index(np.argmax(c),c.shape);return x-W//2,y-H//2
OVR={}
for k,rng in (('p3',range(8)),('p4',range(8)),('p5',range(3))):
    for i in rng:
        dx,dy=shift(PH[k][i]);OVR[(k,i)]=(RG[0]+dx,RG[1]+dy)
print('âncoras alinhadas',{f'{k}{i}':v for (k,i),v in OVR.items()})
def anchor(k,i,f):
    if (k,i) in OVR:return OVR[(k,i)]
    h,w=f.shape[:2]
    if k in G:return G[k]
    if k=='p5':return (75,104) if i<3 else (75,57)
    return (w/2,h/2)
# corta a borda vazia de cada quadro para o atlas ficar menor
items=[]
for k,fr in seqs.items():
    for i,f in enumerate(fr):
        a=f[...,3]>4;ys,xs=np.where(a)
        if not len(xs):ys,xs=np.array([0]),np.array([0])
        x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
        gx,gy=anchor(k,i,f)
        items.append(dict(k=k,i=i,img=f[y0:y1,x0:x1],gx=gx-x0,gy=gy-y0))
# empacota em prateleiras
W=1024;x=y=sh=0
for it in items:
    h,w=it['img'].shape[:2]
    if x+w>W:x=0;y+=sh+1;sh=0
    it['x'],it['y']=x,y;x+=w+1;sh=max(sh,h)
H=y+sh
atl=np.zeros((H,W,4),np.uint8)
for it in items:h,w=it['img'].shape[:2];atl[it['y']:it['y']+h,it['x']:it['x']+w]=it['img'].astype(np.uint8)
im=Image.fromarray(atl,'RGBA')
buf=io.BytesIO();im.quantize(colors=256,method=Image.FASTOCTREE,dither=Image.NONE).save(buf,'PNG',optimize=True);wb=buf.getvalue()
buf2=io.BytesIO();im.save(buf2,'PNG',optimize=True);pn=buf2.getvalue()
print('atlas',W,H,'png8',len(wb),'png',len(pn))
meta={}
for it in items:meta.setdefault(it['k'],[]).append([it['x'],it['y'],it['img'].shape[1],it['img'].shape[0],round(float(it['gx']),1),round(float(it['gy']),1)])
# ícones dos botões (64x64)
def icon(f,size=64):
    a=f[...,3]>4;ys,xs=np.where(a);c=f[ys.min():ys.max()+1,xs.min():xs.max()+1].astype(np.uint8)
    img=Image.fromarray(c,'RGBA');s=size/max(img.size);img=img.resize((max(1,round(img.width*s)),max(1,round(img.height*s))),Image.LANCZOS)
    can=Image.new('RGBA',(size,size));can.alpha_composite(img,((size-img.width)//2,(size-img.height)//2))
    b=io.BytesIO();can.save(b,'PNG',optimize=True);return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
ICONS={'palma':icon(EX['rastro'][0]),'kaiten':icon(PH['p3'][3]),'hakke':icon(EX['icon'][0])}
out={'img':'data:image/png;base64,'+base64.b64encode(wb).decode(),'f':meta,'ic':ICONS}
json.dump(out,open('kfx.json','w'),separators=(',',':'))
im.save('atlas_preview.png')
print('kfx.json',len(json.dumps(out)),'bytes',{k:len(v) for k,v in meta.items()})
