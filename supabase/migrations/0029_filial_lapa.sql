-- =========================================================
-- 0029 · Filial real: Lapa (código 24)
-- =========================================================

insert into tlp_presenca.filiais (codigo, nome, cidade, uf) values
  ('24', 'Lapa', 'São Paulo', 'SP')
on conflict (codigo) do nothing;
