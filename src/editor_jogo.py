# Gera server/editor/jogo.js: as imagens e o catálogo de objetos do jogo, os mapas que já vêm no jogo e os mobs,
# para o editor novo (/painel/editor) desenhar o mapa igual ao jogo. Uso: python3 editor_jogo.py PASTA_DO_SERVIDOR
import json,glob,os,sys
out=os.path.join(sys.argv[1],'editor');os.makedirs(out,exist_ok=True)
L=open('assets_all.js').read().split('\n')
TS=json.loads(L[0][len('const TS='):].rstrip(';'));TSZ=json.loads(L[1][len('const TSZ='):].rstrip(';'))
cat=json.load(open('ed/catalog.json'))
base={}
for f in sorted(glob.glob('ed/db/maps/*.json')):
    d=json.load(open(f));d=d.get('data',d);m=json.loads(d['json'])
    slug=os.path.basename(f)[:-5];slug='konoha' if slug=='atual' else slug
    m['name']=slug;base[slug]=m
mobs=[]
for f in sorted(glob.glob('ed/db/mobs/*.json')):
    d=json.load(open(f));d=d.get('data',d);mobs.append({'id':d.get('id'),'nome':d.get('name') or d.get('id')})
CATS=[['arv','Árvores','folha'],['ped','Pedras','folha'],['pre','Prédios','folha'],['ite','Itens','folha'],['esp','Especiais','folha'],
  ['sab','Prédios areia','areia'],['sai','Itens areia','areia'],['sar','Rochas areia','areia'],['sap','Penhascos','areia'],['mar','Marcas','*']]
J={'TS':TS,'TSZ':TSZ,'CAT':cat,'CATS':CATS,'BASE':base,'MOBS':mobs}
s='/* gerado por src/editor_jogo.py: não edite à mão */\nwindow.JOGO='+json.dumps(J,separators=(',',':'),ensure_ascii=False)+';\n'
open(os.path.join(out,'jogo.js'),'w').write(s)
print('editor/jogo.js',len(s)//1024,'KB',list(base),len(TS),'imagens')
