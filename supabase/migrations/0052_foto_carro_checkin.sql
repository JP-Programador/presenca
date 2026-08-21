-- =========================================================
-- 0052 · Foto do carro/placa no check-in
--
-- Colaboradores marcados como "usa carro" tiram uma segunda foto (do
-- carro/placa) no check-in de entrada, além da foto de rosto já
-- existente — só pra identificação visual manual, sem OCR. Reaproveita
-- o mesmo bucket/pasta de fotos (só muda o sufixo do arquivo) e a mesma
-- expiração de 24h da foto de rosto.
-- =========================================================

alter table tlp_presenca.colaboradores
  add column usa_carro boolean not null default false;

comment on column tlp_presenca.colaboradores.usa_carro is
  'true = esse colaborador precisa tirar foto do carro/placa no check-in de entrada, além da foto de rosto.';

alter table tlp_presenca.registros_presenca
  add column foto_carro_path text;

comment on column tlp_presenca.registros_presenca.foto_carro_path is
  'Caminho no bucket tlp-fotos-presenca da foto do carro/placa (só presente quando o colaborador tem usa_carro=true e o registro é de entrada). Mesma expiração de 24h da foto de rosto (foto_expira_em).';
