# Recorta a folha do Nara (arte/nara_sprite/folha_nara.png): tira o fundo azul, separa as poses (ordem de leitura),
# reduz para o tamanho do jogo e grava src/hyuga/spr_nara.json (quadros em PNG base64, âncora do pé e corte do cabelo).
import io,json,base64,sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
R='/home/claude/shinobi-online/'
im=Image.open(R+'arte/nara_sprite/folha_nara.png').convert('RGB');a=np.array(im).astype(int)
bg=np.median(a[:40,:40].reshape(-1,3),axis=0);d=np.abs(a-bg).sum(2)
m=d>42
m=ndi.binary_opening(m,iterations=1)
lab,n=ndi.label(ndi.binary_dilation(m,iterations=3))
objs=[]
for i,sl in enumerate(ndi.find_objects(lab),1):
    mm=(lab[sl]==i)&m[sl]
    if mm.sum()<1500:continue
    objs.append((sl,mm))
# ordem de leitura: agrupa por linha
cy=[(s[0].start+s[0].stop)/2 for s,_ in objs]
order=sorted(range(len(objs)),key=lambda k:cy[k]);rows=[];cur=[order[0]]
for k in order[1:]:
    if cy[k]-cy[cur[-1]]>110:rows.append(cur);cur=[k]
    else:cur.append(k)
rows.append(cur)
seq=[k for r in rows for k in sorted(r,key=lambda k:objs[k][0][1].start)]
print('poses',len(seq),[len(r) for r in rows])
ALTO=104.0   # altura do boneco parado no jogo (a do Hyuga é ~108)
f=[];anc=[];cut=[];pl=[]
hs=[objs[k][0][0].stop-objs[k][0][0].start for k in seq]
esc=ALTO/np.median(hs)
for n,k in enumerate(seq):
    sl,mm=objs[k];y0,y1,x0,x1=sl[0].start,sl[0].stop,sl[1].start,sl[1].stop
    rgba=np.zeros((y1-y0,x1-x0,4),np.uint8);rgba[...,:3]=a[sl].astype(np.uint8);rgba[...,3]=np.where(mm,255,0)
    pad=2;img=Image.fromarray(rgba,'RGBA');
    w,h=img.size;nw,nh=max(1,round(w*esc)),max(1,round(h*esc))
    sm=img.resize((nw,nh),Image.BOX)
    arr=np.array(sm);arr[...,3]=np.where(arr[...,3]>110,255,0);sm=Image.fromarray(arr,'RGBA')
    # pé: centro dos pixels do terço de baixo
    ys,xs=np.nonzero(arr[...,3]);low=ys>ys.max()-max(4,int(nh*.12));ax=float(xs[low].mean());ay=float(nh-1)
    f.append('data:image/png;base64,'+base64.b64encode((lambda b:(sm.save(b,'PNG'),b.getvalue())[1])(io.BytesIO())).decode())
    anc.append([round(ax,1),round(ay,1)]);cut.append(round(nh*(.36 if n==7 else .25),1))
    print(n,(w,h),sm.size)
json.dump({'f':{'nra':f},'nrx':{'nra':anc},'nrc':{'nra':cut}},open(R+'src/hyuga/spr_nara.json','w'),separators=(',',':'))
# conferência
W=Image.new('RGB',(len(f)*110,130),(90,100,130))
for i,u in enumerate(f):
    t=Image.open(io.BytesIO(base64.b64decode(u.split(',')[1])));W.paste(t,(i*110,2),t)
W.save('/tmp/claude-0/-home-claude-shinobi-online/a975ef8b-7019-5952-bbf4-fe431642d27d/scratchpad/nara_mont.png')
