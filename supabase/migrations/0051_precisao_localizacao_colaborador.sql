-- =========================================================
-- 0051 · Precisão da geocodificação da residência do colaborador
--
-- A cascata de geocodificação (ViaCEP + Nominatim/Photon) agora sempre
-- tenta salvar alguma coordenada, mesmo quando só consegue por aproximação
-- (bairro ou cidade) — nunca mais falha o cadastro por falta de indexação
-- do endereço exato. Precisa registrar QUAL foi o nível alcançado:
--
--   'exata'  — rua+bairro (ou rua) resolvidos.
--   'bairro' — só o bairro foi localizado.
--   'cidade' — só o centro da cidade (grosseiro demais pro alerta de
--              proximidade de 2km — checkin-publico ignora esse nível).
--   'manual' — usuário ajustou o pino manualmente no mapa.
-- =========================================================

alter table tlp_presenca.colaboradores
  add column localizacao_precisao text
    check (localizacao_precisao in ('exata', 'bairro', 'cidade', 'manual'));

comment on column tlp_presenca.colaboradores.localizacao_precisao is
  'Nível de confiança da geocodificação do CEP residencial. "cidade" é grosseiro demais e é ignorado pelo alerta de check-in perto de casa (checkin-publico).';
