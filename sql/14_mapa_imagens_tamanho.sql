-- Shinobi Online · imagens do editor de mapas: guarda a imagem inteira (alta qualidade) e o tamanho em que aparece no mapa
alter table public.mapa_imagens add column if not exists dw int check (dw between 1 and 1024);
alter table public.mapa_imagens add column if not exists dh int check (dh between 1 and 1024);
alter table public.mapa_imagens add column if not exists px boolean not null default false;
notify pgrst, 'reload schema';
