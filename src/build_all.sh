set -e
D=gerado/base.html
mkdir -p gerado; cp index_before_manto.html $D
python3 build_game.py
python3 build_manto.py
python3 build_land.py
python3 - <<'P'
import re
s=open('gerado/base.html').read()
open('gerado/chk_base.js','w').write('\n'.join(re.findall(r'<script>(.*?)</script>',s,re.S)))
P
node --check gerado/chk_base.js && echo SYNTAX_OK
