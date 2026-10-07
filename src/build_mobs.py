# Mobs do editor -> jogo (aparência) e servidor (atributos). Uso: python3 build_mobs.py
import json,glob,os
# mobs fixos (têm animação pronta); do banco do editor vêm só atributos e drops
base=json.load(open('mobs/mobs_default.json'))
db={}
for f in sorted(glob.glob('ed/db/mobs/*.json')):
    d=json.load(open(f));d=d.get('data',d)
    if d.get('id'):db[d['id']]=d
mobs=[]
for b in base:
    m=dict(b);m.update({k:v for k,v in db.get(b['id'],{}).items() if k not in ('id','name','ap','escala','chefe')});mobs.append(m)
num=lambda v,d,lo,hi:max(lo,min(hi,float(v) if isinstance(v,(int,float)) else d))
cli,srv={},{}
for m in mobs:
    i=m['id'];ap=m.get('ap') or {'tipo':'ninja'}
    cli[i]={'name':m.get('name',i),'ap':ap,'escala':num(m.get('escala'),100,30,400),'nivel':int(num(m.get('nivel'),1,1,999)),'chefe':1 if m.get('chefe') else 0}
    srv[i]={'id':i,'name':m.get('name',i),'escala':num(m.get('escala'),100,30,400),'vida':int(num(m.get('vida'),60,1,9999999)),'dano':num(m.get('dano'),6,0,99999),
      'vel':num(m.get('vel'),70,10,300),'atkInt':num(m.get('atkInt'),1.2,.3,10),'alcance':num(m.get('alcance'),1,.5,8),'visao':num(m.get('visao'),6,0,20),
      'persegue':num(m.get('persegue'),8,1,40),'xp':int(num(m.get('xp'),10,0,1e7)),'renasce':num(m.get('renasce'),15,2,3600),
      'nivel':int(num(m.get('nivel'),1,1,999)),'esquiva':num(m.get('esquiva'),0,0,9999),'precisao':num(m.get('precisao'),0,0,9999),'chefe':1 if m.get('chefe') else 0,
      'pulo':num(m.get('pulo'),0,0,999999),'esfera':num(m.get('esfera'),0,0,999999),
      'drops':[{'item':x.get('item'),'chance':num(x.get('chance'),0,0,100)} for x in (m.get('drops') or []) if x.get('item')]}
json.dump(cli,open('mobs/mobs_client.json','w'),ensure_ascii=False,separators=(',',':'))
SP=json.load(open('spr/sprites.json'));used={k:SP[k] for k in sorted({c['ap'].get('sprite') for c in cli.values() if c['ap'].get('tipo')=='sprite'}) if k in SP} # ordem fixa: a montagem sai sempre igual
json.dump(used,open('mobs/sprites_used.json','w'),separators=(',',':'))
json.dump(srv,open(os.environ.get('SAIDA_SERVER','../server')+'/mobs.json','w'),ensure_ascii=False,indent=1)
print('mobs:',list(srv))
