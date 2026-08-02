-- =========================================================
-- Seed de exemplo — filiais e técnicos (colaboradores)
--
-- Rode manualmente no SQL Editor do Supabase (ou `supabase db execute`),
-- DEPOIS de todas as migrations aplicadas. Ajuste os valores antes de
-- rodar em produção — isto é dado de exemplo para testar o sistema
-- ponta a ponta (tela pública, dashboards, mapa, relatórios).
-- =========================================================

insert into tlp_presenca.filiais (codigo, nome, cidade, uf) values
  ('1768', 'TLP Matriz', 'São Paulo', 'SP'),
  ('2210', 'TLP Campinas', 'Campinas', 'SP'),
  ('3005', 'TLP Rio', 'Rio de Janeiro', 'RJ')
on conflict (codigo) do nothing;

-- Técnicos de exemplo — troque a matrícula por dados reais antes de produção.
-- Identificação na tela pública usa código da filial + 4 últimos dígitos da
-- matrícula (não há mais CPF cadastrado, ver migration 0026).
insert into tlp_presenca.colaboradores (filial_id, matricula, nome, cargo, tipo_contrato, data_admissao, ativo)
select f.id, v.matricula, v.nome, v.cargo, v.tipo_contrato::tlp_presenca.tipo_contrato, v.data_admissao::date, true
from (values
  ('1768', '1001', 'João da Silva',      'Técnico de campo', 'clt',        '2023-01-10'),
  ('1768', '1002', 'Maria Oliveira',     'Técnica de campo', 'clt',        '2023-03-22'),
  ('2210', '2001', 'Carlos Souza',       'Técnico de campo', 'aprendiz',   '2024-02-01'),
  ('3005', '3001', 'Ana Pereira',        'Técnica de campo', 'temporario', '2025-05-15')
) as v(codigo_filial, matricula, nome, cargo, tipo_contrato, data_admissao)
join tlp_presenca.filiais f on f.codigo = v.codigo_filial
on conflict (filial_id, matricula) do nothing;

-- Escala padrão (seg-sex, 08:00-17:00, 10min de tolerância) para os técnicos de exemplo.
insert into tlp_presenca.escalas (colaborador_id, dia_semana, hora_entrada, hora_saida, tolerancia_min)
select c.id, dia, '08:00', '17:00', 10
from tlp_presenca.colaboradores c
cross join generate_series(1, 5) as dia -- 1=segunda ... 5=sexta
where c.matricula in ('1001', '1002', '2001', '3001')
on conflict (colaborador_id, dia_semana) do nothing;
