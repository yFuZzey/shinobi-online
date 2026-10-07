# Recorta a folha do Kaiten em quadros com fundo transparente (cor → alfa, como o "Color to Alpha" do GIMP)
from PIL import Image
import numpy as np, json
from scipy import ndimage
SRC=np.asarray(Image.open('sheet.png').convert('RGB')).astype(float)
MX=SRC.max(axis=2);FG=(MX-np.median(MX))>22
B=json.load(open('boxes.json'))
def c2a(rgb,bg):
    a=np.zeros(rgb.shape[:2])
    for c in range(3):
        b=bg[c];x=rgb[...,c]
        ac=np.where(x>b,(x-b)/(255-b),np.where(x<b,(b-x)/max(b,1),0))
        a=np.maximum(a,ac)
    a=np.clip((a-.05)/.95,0,1)
    col=np.where(a[...,None]>0,(rgb-bg)/np.maximum(a[...,None],1e-6)+bg,0)
    return np.clip(col,0,255),a
def cell(x0,x1,y0,y1,cx,cw,keep=None):
    """recorta [x0..x1]x[y0..y1] num quadro de largura cw centrado em cx"""
    reg=SRC[y0:y1+1,x0:x1+1];m=FG[y0:y1+1,x0:x1+1]
    m=ndimage.binary_dilation(m,iterations=3)
    if keep is not None:m&=keep[y0:y1+1,x0:x1+1]
    ring=np.concatenate([SRC[y0-3:y0,x0:x1+1].reshape(-1,3),SRC[y1+1:y1+4,x0:x1+1].reshape(-1,3)])
    bg=np.median(ring,axis=0)
    col,a=c2a(reg,bg);a=a*m
    out=np.zeros((y1-y0+1,cw,4))
    off=int(round(cw/2-(cx-x0)))
    xa,xb=max(0,off),min(cw,off+x1-x0+1)
    out[:,xa:xb,:3]=col[:,xa-off:xb-off];out[:,xa:xb,3]=a[:,xa-off:xb-off]*255
    return out
lab=np.ones_like(FG);lab[490:521,:400]=False;lab[490:519,:630]=False  # linha do título da fase 4
GRID=[71,196,321,447,573,698,824,950]
PH={}
def row(name,y0,y1,boxes,centers,cw):
    fr=[]
    for (a,b,_,__),cx in zip(boxes,centers):fr.append(cell(a,b,y0,y1,cx,cw,lab))
    PH[name]=fr
row('p1',84,170,B['p1'],GRID[1:],128)
row('p2',200,325,B['p2'],[(a+b)/2 for a,b,_,__ in B['p2']],150)
row('p3',356,490,B['p3'],GRID,128)
row('p4',499,652,B['p4'],GRID,150)
row('p5',682,797,B['p5'],GRID[:7],150)
# extras
EX={}
EX['rastro']=[cell(248,335,903,996,291.5,96),cell(362,448,903,996,405,96)]
EX['frag']=[cell(466,566,900,994,516,110),cell(578,712,900,994,645,140)]
IC=[]
for y0,y1 in [(895,957),(959,1019)]:
    for cx in [742,820,897,972]:
        IC.append(cell(int(cx-36),int(cx+36),y0,y1,cx,72))
EX['icon']=IC
# limpa pedacinhos soltos (de quadros vizinhos) e espelha os anéis cortados da fase 5
def clean(f,minpx=24):
    a=f[...,3]>60;lb,n=ndimage.label(a)
    if n<=1:return f
    sz=ndimage.sum(a,lb,range(1,n+1));big=sz.max()
    for i,z in enumerate(sz):
        if z<minpx and z<big:f[lb==i+1]=0
    return f
for k in PH:PH[k]=[clean(f) for f in PH[k]]
def mirror(f):
    g=f[:,::-1];return np.where((g[...,3]>f[...,3])[...,None],g,f)
PH['p5']=PH['p5'][:3]+[mirror(f) for f in PH['p5'][3:]]
np.save('frames.npy',{'PH':PH,'EX':EX},allow_pickle=True)
# prévia sobre areia e sobre fundo escuro
def prev(frames_rows,path,bgc):
    W=max(sum(f.shape[1]+6 for f in r) for r in frames_rows);H=sum(max(f.shape[0] for f in r)+8 for r in frames_rows)
    can=Image.new('RGBA',(W,H),bgc);y=0
    for r in frames_rows:
        x=0
        for f in r:
            can.alpha_composite(Image.fromarray(f.astype(np.uint8),'RGBA'),(x,y));x+=f.shape[1]+6
        y+=max(f.shape[0] for f in r)+8
    can.save(path)
rows=[PH[k] for k in ['p1','p2','p3','p4','p5']]+[EX['rastro']+EX['frag'],EX['icon']]
prev(rows,'prev_areia.png',(214,174,118,255));prev(rows,'prev_escuro.png',(40,60,40,255))
print({k:(len(v),v[0].shape) for k,v in PH.items()})
