# Estimativa de burst em 2 s e TTK 1x1 no PvP, Nv 60, com as fórmulas do jogo.
# Uso: python3 tests/ferramentas/simular.py medida.json saida.json [teto_de_esquiva]
# medida.json vem de tests/ferramentas/medir.js (dano bruto de cada golpe já com o poder do status).
# Regras atuais copiadas do código: PvP = 60% (CFG.pvpMul), redução do alvo (D().red), esquiva 5+Esq-Prec (0..60%),
# crítico ×1,3 no PvP (chance D().crit). Sem itens, sem especialidade.
import json, sys
d = json.load(open(sys.argv[1]))
L = {c: d[c]['lv60'] for c in d}
sk = {c: {s['n']: s for s in L[c]['sk']} for c in d}
PVP = .6
CRITPVP = 1.3  # planilha 12: crítico ×1,3 no PvP (×1,5 em monstro)
def hit(raw, dfn): return raw * PVP * (1 - L[dfn]['D']['red'] / 100)
CAP = float(sys.argv[3]) if len(sys.argv) > 3 else 60
def dodge(att, dfn): return min(CAP, max(0, 5 + L[dfn]['D']['esq'] - L[att]['D']['prec'])) / 100
# golpes em 2 s (sem crítico, todos acertam) — sequência mais forte encontrada para cada clã
U = sk['uchiha']; H = sk['hyuga']; N = sk['nara']
EY = d['uchiha']['EYES']['sasuke']; mgk = 1 + d['uchiha']['TOM'][4]['cdmg'] / 100; sasb = 1 + EY['dmgb'] / 100
pc_u = L['uchiha']['D']['pc']
def n2(sk):  # quantas vezes o golpe acerta numa janela de 2 s (recarga real, com a Destreza)
  import math
  return 1 + math.floor(2 / max(.2, sk['cd']) + 1e-9)
burst_raw = {
  'uchiha (Mangekyō Sasuke + Susanoo + Bolas de Fogo)': ('uchiha', n2(U['Bola de Fogo']) * U['Bola de Fogo']['raw'] * mgk * sasb + EY['hits'] * (EY['dmg'] + pc_u) * mgk * sasb),
  'uchiha (sem olho: só Bolas de Fogo)': ('uchiha', n2(U['Bola de Fogo']) * U['Bola de Fogo']['raw']),
  'hyuga (só Palmas)': ('hyuga', n2(H['Palma']) * H['Palma']['raw']),
  'hyuga (Kaiten + 64 Palmas)': ('hyuga', H['Kaiten']['raw'] + H['64 Palmas']['raw'] * 1.4),
  'nara (Possessão + Sombra + Shuriken)': ('nara', N['Possessão']['raw'] + N['Sombra']['raw'] + n2(N['Shuriken']) * N['Shuriken']['raw']),
}
out = {'burst': [], 'ttk': []}
for k, (att, raw) in burst_raw.items():
  for dfn in d:
    if dfn == att: continue
    dmg = hit(raw, dfn); pc = dmg / L[dfn]['hp'] * 100
    out['burst'].append((k, dfn, round(dmg), L[dfn]['hp'], round(pc)))
# DPS sustentado: golpe inicial no limite da recarga + os outros quando voltam
dps_raw = {
  'uchiha': U['Bola de Fogo']['raw'] / U['Bola de Fogo']['cd'],
  'uchiha+mgk': U['Bola de Fogo']['raw'] * mgk / U['Bola de Fogo']['cd'] + EY['hits'] * (EY['dmg'] + pc_u) * mgk * sasb / U['Susanoo']['cd'],
  'hyuga': H['Palma']['raw'] / H['Palma']['cd'],
  'nara': N['Shuriken']['raw'] / N['Shuriken']['cd'] + N['Sombra']['raw'] / N['Sombra']['cd'] + N['Possessão']['raw'] / N['Possessão']['cd'],
}
# Nara com os jutsus da Entrega 7b (catálogo inteiro, cada um no limite da recarga)
if 'cat' in L['nara']:
  dps_raw['nara+7b'] = sum((c['raw'] + c['dot']) / max(.2, c['cd']) for c in L['nara']['cat'])
  burst_raw['nara 7b (Domínio + Kage Nui + Kubishibari + Shuriken)'] = ('nara', sum(c['raw'] + c['dot'] * .5 for c in L['nara']['cat'] if c['id'] in ('dominio', 'nui', 'kubi')) + n2(N['Shuriken']) * N['Shuriken']['raw'])
  for k, (att, raw) in list(burst_raw.items())[-1:]:
    for dfn in d:
      if dfn == att: continue
      dmg = hit(raw, dfn); out['burst'].append((k, dfn, round(dmg), L[dfn]['hp'], round(dmg / L[dfn]['hp'] * 100)))
for a, raw in dps_raw.items():
  att = a.split('+')[0]
  for dfn in d:
    if dfn == att: continue
    eff = hit(raw, dfn) * (1 - dodge(att, dfn)) * (1 + L[att]['D']['crit'] / 100 * (CRITPVP - 1))
    out['ttk'].append((a, dfn, round(eff, 1), round(L[dfn]['hp'] / eff, 1)))
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
for r in out['burst']: print('BURST', r)
for r in out['ttk']: print('TTK', r)
