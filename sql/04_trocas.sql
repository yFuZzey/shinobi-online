-- =====================================================================
-- Shinobi Online · inventário protegido + trocas entre jogadores
-- Rode no SQL Editor do Supabase (pode rodar de novo sem estragar,
-- inclusive se você já rodou a versão anterior deste arquivo).
-- ANTES: coloque a chave secreta no Render (SUPABASE_SERVICE_KEY).
-- =====================================================================

-- 1) cada linha da mochila é UMA unidade: dá para ter vários do mesmo item
--    (tira a regra "1 de cada item" da versão anterior, se ela existir)
drop index if exists public.inventario_um_por_item;
create index if not exists inventario_dono_item on public.inventario (personagem_id, item);

-- 2) o app NÃO cria, apaga nem renomeia itens: só lê e marca equipado/desequipado
revoke insert, update, delete on public.inventario from anon, authenticated;
grant select on public.inventario to authenticated;
grant update (equipado) on public.inventario to authenticated;

-- 3) salvar_inventario agora só marca o que está equipado (1 unidade de cada item equipado)
create or replace function public.salvar_inventario(itens jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  update public.inventario i
     set equipado = i.id in (
       select distinct on (v.item) v.id from public.inventario v
        where v.personagem_id = auth.uid()
          and v.item in (select x->>'item' from jsonb_array_elements(coalesce(itens, '[]'::jsonb)) x
                          where coalesce((x->>'equipado')::boolean, false))
        order by v.item, v.equipado desc, v.id)
   where i.personagem_id = auth.uid();
end $$;
revoke all on function public.salvar_inventario(jsonb) from public, anon;
grant execute on function public.salvar_inventario(jsonb) to authenticated;

-- 4) histórico de trocas (só o painel e o servidor veem)
create table if not exists public.trocas (
  id      bigint generated always as identity primary key,
  quando  timestamptz not null default now(),
  a       uuid not null,
  b       uuid not null,
  itens_a text[] not null,
  itens_b text[] not null
);
alter table public.trocas enable row level security;
revoke all on public.trocas from anon, authenticated;

-- 5) só o servidor do jogo (chave secreta): dar itens (drops e admin). Cada nome na lista = 1 unidade.
create or replace function public.dar_itens(p_personagem uuid, p_itens text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare r text[];
begin
  with ins as (
    insert into public.inventario (personagem_id, item, equipado)
    select p_personagem, left(x, 40), false from unnest(coalesce(p_itens, '{}')) x where coalesce(x, '') <> ''
    returning item)
  select coalesce(array_agg(item), '{}') into r from ins;
  return r;
end $$;
revoke all on function public.dar_itens(uuid, text[]) from public, anon, authenticated;
grant execute on function public.dar_itens(uuid, text[]) to service_role;

-- 6) só o servidor do jogo: troca. Cada nome na lista = 1 unidade
--    (ex.: {kunai,kunai,manto} = 2 kunais e 1 manto). Um lado pode ficar vazio (presente).
--    Ou as unidades escolhidas mudam de dono todas juntas, ou nada muda (nunca metade).
create or replace function public.trocar_itens(p_a uuid, p_b uuid, p_ia text[], p_ib text[])
returns void language plpgsql security definer set search_path = public as $$
declare ids bigint[] := '{}'; got bigint[]; r record;
begin
  p_ia := coalesce(p_ia, '{}'); p_ib := coalesce(p_ib, '{}');
  if p_a = p_b then raise exception 'troca consigo mesmo'; end if;
  if cardinality(p_ia) + cardinality(p_ib) = 0 then raise exception 'troca vazia'; end if;
  -- trava a mochila dos dois enquanto troca
  perform 1 from public.inventario where personagem_id in (p_a, p_b) for update;
  for r in select p_a as dono, x as item, count(*)::int as n from unnest(p_ia) x group by x
           union all
           select p_b, x, count(*)::int from unnest(p_ib) x group by x loop
    select array_agg(s.id) into got from (
      select id from public.inventario
       where personagem_id = r.dono and item = r.item and not equipado
       order by id limit r.n) s;
    if coalesce(cardinality(got), 0) < r.n then raise exception 'item não está mais na mochila'; end if;
    ids := ids || got;
  end loop;
  update public.inventario
     set personagem_id = case when personagem_id = p_a then p_b else p_a end, equipado = false
   where id = any(ids);
  insert into public.trocas (a, b, itens_a, itens_b) values (p_a, p_b, p_ia, p_ib);
end $$;
revoke all on function public.trocar_itens(uuid, uuid, text[], text[]) from public, anon, authenticated;
grant execute on function public.trocar_itens(uuid, uuid, text[], text[]) to service_role;

-- 7) avisa a API do Supabase das mudanças
notify pgrst, 'reload schema';
