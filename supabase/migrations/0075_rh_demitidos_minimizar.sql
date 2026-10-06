-- 0075 · rh_demitidos: guarda só o necessário pro cruzamento (matrícula + primeiro nome + data).
-- Remove nome completo e filial do RH (dados pessoais sem uso no app).

delete from tlp_presenca.rh_demitidos;

alter table tlp_presenca.rh_demitidos
  drop column nome,
  drop column filial_rh,
  add column primeiro_nome text not null;
