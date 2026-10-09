# Recorta a folha de efeitos de sombra do Nara (arte/nara_fx/folha1_sombra.png) e grava src/hyuga/fx_sombra.json:
#  cabeca = 4 quadros da ponta da sombra (apontando para a direita; ancora = ponta e centro),
#  faixa  = trecho repetível do rastro.  Tudo reduzido para o tamanho do jogo.
import io,json,base64
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
R='/home/claude/shinobi-online/'
ESC=0.25
a=np.array(Image.open(R+'arte/nara_fx/folha1_sombra.png').convert('RGB')).astype(float)
bg=np.median(a[:30,:].reshape(-1,3),axis=0)
d=np.abs(a-bg).sum(2);al=np.clip((d-35)/60,0,1)
col=np.where(al[...,None]>0.02,(a-bg*(1-al[...,None]))/np.maximum(al[...,None],0.02),a);col=np.clip(col,0,255)
rgba=np.dstack([col,al*255]).astype(np.uint8)
def png(im):
    b=io.BytesIO();im.save(b,'PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def corta(box):
    x0,y0,x1,y1=box;im=Image.fromarray(rgba[y0:y1,x0:x1],'RGBA')
    sm=im.resize((max(1,round(im.width*ESC)),max(1,round(im.height*ESC))),Image.BOX)
    arr=np.array(sm);arr[...,3]=np.where(arr[...,3]>40,np.minimum(255,arr[...,3]*1.4),0);return Image.fromarray(arr.astype(np.uint8),'RGBA')
m=al>0.3
# linha 1: 4 pontas
lab,n=ndi.label(ndi.binary_dilation(m[100:260],iterations=6))
heads=[]
for sl in sorted(ndi.find_objects(lab),key=lambda s:s[1].start):
    heads.append(corta((sl[1].start,100+sl[0].start,sl[1].stop,100+sl[0].stop)))
heads=heads[:4]
# linha 2: faixa inteira
ys=np.nonzero(m[440:590].any(1))[0]+440;strip=corta((0,ys.min(),1024,ys.max()+1))
out={'cabeca':[],'faixa':png(strip),'faixaH':strip.height}
for h in heads:
    arr=np.array(h)[...,3];ys,xs=np.nonzero(arr>40);out['cabeca'].append({'u':png(h),'w':h.width,'h':h.height,'ax':float(xs.max()),'ay':float((ys.min()+ys.max())/2)})
json.dump(out,open(R+'src/hyuga/fx_sombra.json','w'),separators=(',',':'))
print(len(heads),[ (h.width,h.height) for h in heads],strip.size)
W=Image.new('RGB',(400,160),(90,100,130))
x=4
for h in heads:W.paste(h,(x,4),h);x+=h.width+4
W.paste(strip,(4,60),strip);W.paste(strip,(4+strip.width,60),strip)
W.save('/tmp/claude-0/-home-claude-shinobi-online/a975ef8b-7019-5952-bbf4-fe431642d27d/scratchpad/fxs.png')
