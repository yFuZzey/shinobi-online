# Recorta a folha dos Susanoo em quadros com fundo transparente.
# A folha tem fundo xadrez cinza borrado e uma sombra escura em volta de cada desenho:
# o que tem cor (roxo/vermelho/azul) e os miolos brancos encostados nele ficam; o resto vira transparente.
# Depois o brilho vira opacidade ("tela → alfa"): partes claras ficam sólidas, partes escuras ficam translúcidas.
from PIL import Image
import numpy as np, json, sys
from scipy import ndimage
SRC=np.asarray(Image.open(sys.argv[1] if len(sys.argv)>1 else 'sheet.png').convert('RGB')).astype(float)
CH=SRC.max(2)-SRC.min(2);V=SRC.max(2)
BANDS={1:(46,184),2:(214,340),3:(384,558),4:(584,704),5:(726,828)}
# [nome, faixa, [(x0,x1)...]]
SEQ=[
 ('s_aura',1,[(13,116),(134,235),(262,361),(381,491),(516,613),(640,737)]),
 ('s_orb',1,[(767,876),(891,1003),(1022,1132)]),
 ('s_orbx',1,[(1150,1252)]),
 ('s_on',2,[(27,89),(116,191),(206,301)]),
 ('s_form',2,[(316,432),(461,575),(600,714),(738,860)]),
 ('i_def',2,[(891,994),(1025,1124),(1158,1246)]),
 ('i_aura',3,[(23,131),(171,280),(321,432),(474,592)]),
 ('i_shield',3,[(618,760)]),
 ('i_orb',3,[(787,910),(939,1070)]),
 ('i_off',3,[(1100,1252)]),
 ('m_on',4,[(19,109),(136,224)]),
 ('m_aura',4,[(250,340),(361,452),(476,569)]),
 ('m_ring',4,[(642,727),(745,824)]),
 ('m_arm',4,[(843,928),(946,1032),(1047,1138)]),
 ('m_off',4,[(1146,1256)]),
 ('pt1',5,[(10,126),(130,246),(250,388)]),
 ('pt2',5,[(432,540),(544,640),(642,740),(742,852)]),
 ('x_exp',5,[(946,1029),(1051,1139),(1158,1243)]),
]
def frame(y0,y1,x0,x1,pad=7):
    X0,X1=max(0,x0-pad),min(SRC.shape[1]-1,x1+pad)
    rgb=SRC[y0:y1+1,X0:X1+1];ch=CH[y0:y1+1,X0:X1+1];v=V[y0:y1+1,X0:X1+1]
    fg=ch>24
    fg=ndimage.binary_opening(fg,iterations=1)|(ch>60)
    near=ndimage.binary_dilation(fg,iterations=5)
    core=(v>185)&near
    m=ndimage.binary_dilation(fg,iterations=2)|core
    # tira pedaços soltos pequenos (restos de quadro vizinho / letreiro)
    lb,n=ndimage.label(ndimage.binary_dilation(m,iterations=3))
    if n>1:
        sz=ndimage.sum(m,lb,range(1,n+1));keep=np.zeros(n+1,bool);keep[1:]=sz>=max(12,sz.max()*.004);m&=keep[lb]
    c=np.clip((rgb-16)/(255-16),0,1)*m[...,None]
    a=c.max(2)
    col=np.where(a[...,None]>0,c/np.maximum(a[...,None],1e-6),0)
    a=np.clip(a*1.2,0,1)
    a=np.where(a<.06,0,a)
    out=np.zeros(rgb.shape[:2]+(4,));out[...,:3]=col*255;out[...,3]=a*255
    return out
F={}
for nm,b,xs in SEQ:
    y0,y1=BANDS[b];F[nm]=[frame(y0,y1,x0,x1) for x0,x1 in xs]
np.save('frames.npy',F,allow_pickle=True)
def prev(path,bgc):
    rows=[F[k] for k,_,_ in SEQ]
    W=max(sum(f.shape[1]+4 for f in r) for r in rows);H=sum(max(f.shape[0] for f in r)+6 for r in rows)
    # 2 colunas para caber
    can=Image.new('RGBA',(W,H),bgc);y=0
    for r in rows:
        x=0
        for f in r:can.alpha_composite(Image.fromarray(f.astype(np.uint8),'RGBA'),(x,y));x+=f.shape[1]+4
        y+=max(f.shape[0] for f in r)+6
    can.save(path)
prev('prev_areia.png',(214,174,118,255));prev('prev_escuro.png',(30,40,30,255))
print({k:(len(v),v[0].shape[:2]) for k,v in F.items()})
