-- =========================================================
-- 0050 · CEP residencial do colaborador (base pro alerta de
-- check-in próximo de casa)
--
-- Geocodificação (CEP -> lat/long) acontece no frontend, uma única vez
-- quando o CEP é cadastrado/editado (ViaCEP + Nominatim, sem chave de
-- API) — aqui só guarda o resultado. O check-in público compara a
-- coordenada do momento contra latitude/longitude aqui salvos.
--
-- Sem mudança de RLS: as policies de update em colaboradores já não
-- restringem por coluna, então líder/coordenador/admin/gerente já
-- conseguem gravar essas 3 colunas pelos caminhos de hoje.
-- =========================================================

alter table tlp_presenca.colaboradores
  add column cep text,
  add column latitude double precision,
  add column longitude double precision;

comment on column tlp_presenca.colaboradores.cep is 'CEP residencial (opcional) — base do alerta de check-in próximo de casa.';
comment on column tlp_presenca.colaboradores.latitude is 'Latitude geocodificada a partir do CEP residencial (null se nunca geocodificado ou CEP não cadastrado).';
comment on column tlp_presenca.colaboradores.longitude is 'Longitude geocodificada a partir do CEP residencial (null se nunca geocodificado ou CEP não cadastrado).';
