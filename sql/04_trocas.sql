-- =====================================================================
-- Shinobi Online · inventário protegido + trocas entre jogadores
-- Rode UMA vez no SQL Editor do Supabase (pode rodar de novo sem estragar).
-- ANTES: coloque a chave secreta no Render (SUPABASE_SERVICE_KEY).
-- =====================================================================

-- 1) limpa itens repetidos (mesmo item 2x no mesmo personagem) antes da regra nova
delete from public.inventario a using public.inventario b
 where a.personagem_id = b.personagem_id and a.item = b.item and a.id > b.id;

-- 2) cada personagem só pode ter cada item uma vez (o banco garante; não tem como duplicar)
create unique index if not exists inventario_um_por_item on public.inventario (personagem_id, item);

-- 3) o app NÃO cria, apaga nem renomeia itens: só lê e marca equipado/desequipado
revoke insert, update, delete on public.inventario from anon, authenticated;
grant select on public.inventario to authenticated;
grant update (equipado) on public.inventario to authenticated;

-- 4) salvar_inventario agora só atualiza o que está equipado (não cria item nenhum)
create or replace function public.salvar_inventario(itens jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  update public.inventario i
     set equipado = exists (select 1 from jsonb_array_elements(coalesce(itens, '[]'::jsonb)) x
                            where x->>'item' = i.item and coalesce((x->>'equipado')::boolean, false))
   where i.personagem_id = auth.uid();
end $$;
revoke all on function public.salvar_inventario(jsonb) from public, anon;
grant execute on function public.salvar_inventario(jsonb) to authenticated;

-- 5) histórico de trocas (só o painel e o servidor veem)
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

-- 6) só o servidor do jogo (chave secreta): dar itens (drops e admin)
create or replace function public.dar_itens(p_personagem uuid, p_itens text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare r text[];
begin
  with ins as (
    insert into public.inventario (personagem_id, item, equipado)
    select p_personagem, x, false from unnest(coalesce(p_itens, '{}')) x
    on conflict (personagem_id, item) do nothing
    returning item)
  select coalesce(array_agg(item), '{}') into r from ins;
  return r;
end $$;
revoke all on function public.dar_itens(uuid, text[]) from public, anon, authenticated;
grant execute on function public.dar_itens(uuid, text[]) to service_role;

-- 7) só o servidor do jogo: troca atômica (tudo ou nada)
create or replace function public.trocar_itens(p_a uuid, p_b uuid, p_ia text[], p_ib text[])
returns void language plpgsql security definer set search_path = public as $$
declare na int; nb int;
begin
  p_ia := coalesce(p_ia, '{}'); p_ib := coalesce(p_ib, '{}');
  if p_a = p_b then raise exception 'troca consigo mesmo'; end if;
  if cardinality(p_ia) + cardinality(p_ib) = 0 then raise exception 'troca vazia'; end if;
  -- trava a mochila dos dois enquanto troca
  perform 1 from public.inventario where personagem_id in (p_a, p_b) for update;
  select count(*) into na from public.inventario where personagem_id = p_a and item = any(p_ia) and not equipado;
  select count(*) into nb from public.inventario where personagem_id = p_b and item = any(p_ib) and not equipado;
  if na <> cardinality(p_ia) or nb <> cardinality(p_ib) then raise exception 'item não está mais na mochila'; end if;
  if exists (select 1 from public.inventario where personagem_id = p_b and item = any(p_ia))
     or exists (select 1 from public.inventario where personagem_id = p_a and item = any(p_ib)) then
    raise exception 'já tem esse item';
  end if;
  update public.inventario
     set personagem_id = case when personagem_id = p_a then p_b else p_a end, equipado = false
   where (personagem_id = p_a and item = any(p_ia)) or (personagem_id = p_b and item = any(p_ib));
  insert into public.trocas (a, b, itens_a, itens_b) values (p_a, p_b, p_ia, p_ib);
end $$;
revoke all on function public.trocar_itens(uuid, uuid, text[], text[]) from public, anon, authenticated;
grant execute on function public.trocar_itens(uuid, uuid, text[], text[]) to service_role;

-- 8) avisa a API do Supabase das mudanças
notify pgrst, 'reload schema';
