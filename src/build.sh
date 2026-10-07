#!/usr/bin/env bash
# Monta o jogo a partir de src/ (rode de qualquer pasta).
#   bash src/build.sh                -> www/game.html, www/index.html, www/version.json e server/{maps,mobs,items}.json
#   bash src/build.sh --teste PASTA  -> só as páginas de teste: PASTA/off.html (sem online) e PASTA/online.html (servidor local)
# Etapas: 1) jogo base (mapas, itens, manto) em src/gerado/base.html  2) mobs  3) mapas do servidor  4) itens do servidor
#         5) modo online (online/online2.js + build_online2.py)  6) carregador e versão (atualização automática)
set -e
cd "$(dirname "$0")"
S=$PWD; R=$(cd .. && pwd)
TESTE=""; [ "$1" = "--teste" ] && TESTE=$(mkdir -p "$2" && cd "$2" && pwd)
OUTS=${TESTE:-$R}/server; [ -n "$TESTE" ] && mkdir -p "$OUTS"
bash build_all.sh
SAIDA_SERVER=$OUTS python3 build_mobs.py
node online/exportmaps.js "$OUTS/maps.json"
python3 - "$OUTS" <<'P'
import json,glob,sys
items={}
for f in sorted(glob.glob('ed/db/items/*.json')):
    j=json.load(open(f));j=j.get('data',j);items[j['id']]={'id':j['id'],'name':j['name'],'drop':j.get('drop')}
json.dump(items,open(sys.argv[1]+'/items.json','w'),ensure_ascii=False,indent=1)
P
if [ -n "$TESTE" ]; then
  python3 build_online2.py gerado/base.html "$TESTE/off.html"
  python3 build_online2.py gerado/base.html "$TESTE/online.html" http://127.0.0.1:54333 sb_publishable_testkey1234567890 http://127.0.0.1:8096
  echo "PÁGINAS DE TESTE EM $TESTE"; exit 0
fi
# versão desta montagem (data e hora UTC, sempre crescente): o jogo instalado compara e se atualiza sozinho
export GAME_VER=${GAME_VER:-$(date -u +%Y%m%d%H%M)}
J="$R/online.json"
python3 build_online2.py gerado/base.html "$R/www/game.html" "$(node -p "require('$J').url")" "$(node -p "require('$J').key")" "$(node -p "require('$J').gs")"
# o APK abre o carregador (index.html), que roda a versão mais nova baixada ou a game.html que veio junto
sed "s/__EMB_V__/$GAME_VER/" online/loader.html > "$R/www/index.html"
python3 - "$R/www" <<'V'
import hashlib,json,os,sys
d=sys.argv[1];b=open(d+'/game.html','rb').read()
json.dump({'v':int(os.environ['GAME_VER']),'sha256':hashlib.sha256(b).hexdigest(),'size':len(b),'loader':1},open(d+'/version.json','w'))
print('versão',os.environ['GAME_VER'],len(b),'bytes')
V
python3 -c "
import re,sys;s=open(sys.argv[1]).read();open('gerado/chk_game.js','w').write('\n'.join(re.findall(r'<script>(.*?)</script>',s,re.S)))" "$R/www/game.html"
node --check gerado/chk_game.js && node --check "$R/server/server.js" && echo PRONTO
