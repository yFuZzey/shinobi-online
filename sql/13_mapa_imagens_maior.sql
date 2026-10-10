-- Shinobi Online · imagens do editor de mapas: aceita imagens maiores e WebP (para quem já rodou o SQL 12)
alter table public.mapa_imagens drop constraint if exists mapa_imagens_png_check;
alter table public.mapa_imagens drop constraint if exists mapa_imagens_w_check;
alter table public.mapa_imagens drop constraint if exists mapa_imagens_h_check;
alter table public.mapa_imagens add constraint mapa_imagens_png_check check (png ~ '^data:image/(png|webp);base64,' and char_length(png) <= 1500000);
alter table public.mapa_imagens add constraint mapa_imagens_w_check check (w between 1 and 1024);
alter table public.mapa_imagens add constraint mapa_imagens_h_check check (h between 1 and 1024);
notify pgrst, 'reload schema';
