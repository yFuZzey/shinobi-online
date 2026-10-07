# Junta os quadros dos Susanoo num atlas WebP + dados para o jogo (sfx.json)
# Cada quadro: [x, y, largura, altura, pontoX, pontoY]. O ponto fica nos pés do ninja (auras)
# ou um pouco acima deles (esferas, anéis, explosões), já na escala de cada fase.
from PIL import Image
import numpy as np, json, io, base64
from scipy import ndimage
F=np.load('frames.npy',allow_pickle=True).item()
# fase: (tipo, escala no jogo, altura do centro acima dos pés, corpo escuro translúcido?)
PH={'s_aura':('g',.85,0,1),'s_form':('g',.8,0,1),'s_on':('g',.9,0,0),'s_orb':('c',1,26,0),'s_orbx':('c',1,30,0),
    'i_aura':('g',.72,0,1),'i_def':('g',.8,0,0),'i_shield':('c',.9,30,0),'i_orb':('c',.9,28,0),'i_off':('c',.8,34,0),
    'm_on':('g',1.05,0,0),'m_aura':('g',1.1,0,1),'m_arm':('g',1.0,0,1),'m_ring':('c',1,24,0),'m_off':('c',1,34,0),
    'pt1':('c',.75,32,0),'pt2':('c',.75,32,0),'x_exp':('c',1,26,0)}
def body(f):
    """traço claro sólido + corpo escuro translúcido (fica parecido com a folha, que foi feita sobre fundo escuro)"""
    a=f[...,3]/255.;c=f[...,:3]/255.
    sil=ndimage.binary_fill_holes(ndimage.binary_closing(a>.15,iterations=4));sil=ndimage.gaussian_filter(sil.astype(float),1.5)
    prem=c*a[...,None];a2=np.maximum(a,sil*.5)
    col=np.where(a2[...,None]>0,prem/np.maximum(a2[...,None],1e-6),0)
    o=np.zeros_like(f);o[...,:3]=np.clip(col,0,1)*255;o[...,3]=a2*255;return o
def glow(f):
    o=f.copy();o[...,3]=np.clip(f[...,3]*1.6,0,255);return o
DS=.75
items=[]
for ph,(kind,sc,lift,bd) in PH.items():
    for i,f in enumerate(F[ph]):
        g=body(f) if bd else glow(f)
        a=g[...,3];ys,xs=np.where(a>8)
        x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
        img=g[y0:y1,x0:x1]
        aa=img[...,3]/255.;solid=aa>.3
        if kind=='g':
            yy,xx=np.where(solid);w=aa[solid]
            gx=float((xx*w).sum()/w.sum());gy=float(yy.max())-3
        else:
            gx=(x1-x0)/2;gy=(y1-y0)/2+lift/sc
        # atlas em 75% (a folha é pixel art ampliada): menor para baixar; a escala no jogo compensa
        pim=Image.fromarray(np.clip(img,0,255).astype(np.uint8),'RGBA');nw,nh=max(1,round(pim.width*DS)),max(1,round(pim.height*DS))
        img=np.asarray(pim.resize((nw,nh),Image.LANCZOS)).astype(float)
        items.append(dict(k=ph,i=i,img=img,gx=gx*nw/pim.width,gy=gy*nh/pim.height))
# empacota em prateleiras (mais altos primeiro)
order=sorted(range(len(items)),key=lambda j:-items[j]['img'].shape[0])
W=1024;x=y=sh=0
for j in order:
    it=items[j];h,w=it['img'].shape[:2]
    if x+w>W:x=0;y+=sh+1;sh=0
    it['x'],it['y']=x,y;x+=w+1;sh=max(sh,h)
H=y+sh;atl=np.zeros((H,W,4),np.uint8)
for it in items:h,w=it['img'].shape[:2];atl[it['y']:it['y']+h,it['x']:it['x']+w]=np.clip(it['img'],0,255).astype(np.uint8)
im=Image.fromarray(atl,'RGBA');im.save('atlas_preview.png')
b=io.BytesIO();im.save(b,'WEBP',quality=84,method=6,alpha_quality=85);wb=b.getvalue()
print('atlas',W,H,'webp',len(wb))
meta={};sc={}
for it in sorted(items,key=lambda q:(q['k'],q['i'])):
    meta.setdefault(it['k'],[]).append([it['x'],it['y'],it['img'].shape[1],it['img'].shape[0],round(it['gx'],1),round(it['gy'],1)])
for ph,(kind,s,_,_) in PH.items():sc[ph]=round(s/DS,4)
# ícones (96x96) dos itens e da Mangekyō
def icon(f,size=96,pad=4):
    a=f[...,3]>8;ys,xs=np.where(a);c=np.clip(f[ys.min():ys.max()+1,xs.min():xs.max()+1],0,255).astype(np.uint8)
    img=Image.fromarray(c,'RGBA');s=(size-2*pad)/max(img.size);img=img.resize((max(1,round(img.width*s)),max(1,round(img.height*s))),Image.LANCZOS)
    can=Image.new('RGBA',(size,size));can.alpha_composite(img,((size-img.width)//2,(size-img.height)//2))
    bb=io.BytesIO();can.save(bb,'PNG',optimize=True);return 'data:image/png;base64,'+base64.b64encode(bb.getvalue()).decode()
IC={'sasuke':icon(body(F['s_aura'][0])),'itachi':icon(body(F['i_aura'][3])),'madara':icon(body(F['m_aura'][2])),'exp':icon(glow(F['x_exp'][1]))}
json.dump({'img':'data:image/webp;base64,'+base64.b64encode(wb).decode(),'f':meta,'s':sc},open('sfx.json','w'),separators=(',',':'))
json.dump(IC,open('icons.json','w'))
for k,v in IC.items():open('ic_'+k+'.png','wb').write(base64.b64decode(v.split(',')[1]))
print('ok',{k:len(v) for k,v in meta.items()})
