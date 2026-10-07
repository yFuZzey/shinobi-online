#!/usr/bin/env bash
# Testes do jogo (navegador de verdade, Playwright):
#   bash tests/rodar.sh            -> todos
#   bash tests/rodar.sh jogo       -> só os offline (golpes, aba Jutsus, mecânicas)
#   bash tests/rodar.sh online     -> só os online (banco simulado + servidor do jogo local)
#   bash tests/rodar.sh t27 jut    -> só os escolhidos (VERBOSO=1 mostra tudo que o teste imprime)
# Monta as páginas de teste a partir de src/ (tests/paginas/), sobe o banco simulado (tests/mock.js, porta 54333)
# e uma cópia do servidor do jogo (porta 8096) com os mapas/mobs/itens recém-montados.
cd "$(dirname "$0")"; T=$PWD; R=$(cd .. && pwd)
SEL=("$@"); [ ${#SEL[@]} -eq 0 ] && SEL=(tudo)
quer(){ local n=$1 g=$2; for s in "${SEL[@]}"; do [ "$s" = tudo ] || [ "$s" = "$g" ] || [ "$s" = "$n" ] && return 0; done; return 1; }
echo "== montando páginas de teste"; bash "$R/src/build.sh" --teste "$T/paginas" >"$T/paginas.log" 2>&1 || { tail -20 "$T/paginas.log"; exit 1; }
PIDS=(); parar(){ for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done; }; trap parar EXIT
ONL=0; for f in online/*.js; do quer "$(basename "$f" .js)" online && ONL=1; done
if [ $ONL = 1 ]; then
  cp "$R/server/server.js" "$R/server/balanceamento.json" "$T/paginas/server/"
  SQL04=1 node "$T/mock.js" 54333 >"$T/mock.log" 2>&1 & PIDS+=($!)
  (cd "$T/paginas/server" && PORT=8096 SUPABASE_URL=http://127.0.0.1:54333 SUPABASE_KEY=sb_publishable_testkey1234567890 SUPABASE_SERVICE_KEY=svc-test exec node server.js) >"$T/servidor.log" 2>&1 & PIDS+=($!)
  for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:8096/health && curl -s -o /dev/null http://127.0.0.1:54333/ && break; sleep .25; done
fi
OK=(); RUIM=()
for f in jogo/*.js online/*.js; do n=$(basename "$f" .js); g=$(dirname "$f"); quer "$n" "$g" || continue
  echo "== $n"; out=$(timeout 240 node "$f" 2>&1); if [ -n "${VERBOSO:-}" ]; then echo "$out"; else echo "$out" | grep -E "FALHA|ERRO|TUDO OK|FALHA\(S\)" | head -20; fi
  if echo "$out" | grep -q "TUDO OK"; then OK+=("$n"); else RUIM+=("$n"); echo "$out" | tail -5; fi
done
echo; echo "PASSARAM (${#OK[@]}): ${OK[*]}"; echo "FALHARAM (${#RUIM[@]}): ${RUIM[*]}"
[ ${#RUIM[@]} -eq 0 ]
