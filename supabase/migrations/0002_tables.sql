-- =========================================================
-- 0002 · Tabelas e relacionamentos
-- =========================================================

-- ---------------------------------------------------------
-- filiais: unidades operacionais da TLP
-- ---------------------------------------------------------
create table tlp_presenca.filiais (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,           -- ex.: "1768"
  nome         text not null,
  cidade       text,
  uf           char(2),
  endereco     text,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table tlp_presenca.filiais is 'Unidades/branches operacionais da TLP.';

-- ---------------------------------------------------------
-- perfis: espelha auth.users, define o papel de acesso (RBAC para a RLS)
-- ---------------------------------------------------------
create table tlp_presenca.perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null,
  email         text not null,
  perfil        tlp_presenca.perfil_acesso not null default 'colaborador',
  filial_id     uuid references tlp_presenca.filiais(id) on delete set null, -- filial "home" do gestor/colaborador
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table tlp_presenca.perfis is 'Perfil de acesso vinculado 1:1 a auth.users; base da RLS.';

-- ---------------------------------------------------------
-- gestor_filiais: relação N:N — um gestor pode responder por várias filiais
-- ---------------------------------------------------------
create table tlp_presenca.gestor_filiais (
  gestor_id   uuid not null references tlp_presenca.perfis(id) on delete cascade,
  filial_id   uuid not null references tlp_presenca.filiais(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (gestor_id, filial_id)
);

comment on table tlp_presenca.gestor_filiais is 'Mapeamento N:N de gestores para as filiais que podem visualizar/gerenciar.';

-- ---------------------------------------------------------
-- colaboradores: cadastro operacional (distinto de perfis — nem todo colaborador loga no sistema)
-- ---------------------------------------------------------
create table tlp_presenca.colaboradores (
  id             uuid primary key default gen_random_uuid(),
  perfil_id      uuid unique references tlp_presenca.perfis(id) on delete set null, -- null se colaborador não tem login próprio
  filial_id      uuid not null references tlp_presenca.filiais(id) on delete restrict,
  matricula      text not null,
  nome           text not null,
  cpf            text not null unique,
  cargo          text,
  tipo_contrato  tlp_presenca.tipo_contrato not null default 'clt',
  data_admissao  date,
  data_desligamento date,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint colaboradores_matricula_filial_unique unique (filial_id, matricula)
);

comment on table tlp_presenca.colaboradores is 'Cadastro operacional dos colaboradores, vinculados a uma filial.';

-- ---------------------------------------------------------
-- escalas: jornada prevista por colaborador (grade semanal)
-- ---------------------------------------------------------
create table tlp_presenca.escalas (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references tlp_presenca.colaboradores(id) on delete cascade,
  dia_semana      smallint not null check (dia_semana between 0 and 6), -- 0=domingo ... 6=sábado
  hora_entrada    time not null,
  hora_saida      time not null,
  tolerancia_min  smallint not null default 10, -- minutos de tolerância antes de "atrasado"
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),

  constraint escalas_colaborador_dia_unique unique (colaborador_id, dia_semana)
);

comment on table tlp_presenca.escalas is 'Grade semanal de horário previsto por colaborador, usada para calcular atraso.';

-- ---------------------------------------------------------
-- registros_presenca: cada marcação de ponto (entrada/intervalo/saída)
-- ---------------------------------------------------------
create table tlp_presenca.registros_presenca (
  id               uuid primary key default gen_random_uuid(),
  colaborador_id   uuid not null references tlp_presenca.colaboradores(id) on delete cascade,
  filial_id        uuid not null references tlp_presenca.filiais(id) on delete restrict,
  tipo             tlp_presenca.tipo_marcacao not null,
  status           tlp_presenca.status_presenca not null default 'presente',
  data_referencia  date not null default (now() at time zone 'America/Sao_Paulo')::date,
  horario_previsto time,
  horario_registrado timestamptz not null default now(),
  latitude         double precision,
  longitude        double precision,
  foto_path        text,              -- caminho no bucket 'tlp-fotos-presenca', ex: {filial_id}/{colaborador_id}/{uuid}.jpg
  foto_expira_em   timestamptz,       -- horario_registrado + 48h; usado pela Edge Function de limpeza
  observacao       text,
  registrado_por   uuid references tlp_presenca.perfis(id) on delete set null, -- quem operou o app (pode ser o próprio colaborador)
  created_at       timestamptz not null default now()
);

comment on table tlp_presenca.registros_presenca is 'Marcações individuais de ponto (entrada, intervalo, saída), com foto e geolocalização opcionais.';

-- ---------------------------------------------------------
-- justificativas: fluxo de aprovação para ausências/atrasos
-- ---------------------------------------------------------
create table tlp_presenca.justificativas (
  id               uuid primary key default gen_random_uuid(),
  registro_id      uuid references tlp_presenca.registros_presenca(id) on delete cascade,
  colaborador_id   uuid not null references tlp_presenca.colaboradores(id) on delete cascade,
  data_referencia  date not null,
  motivo           text not null,
  anexo_path       text,              -- caminho no bucket 'tlp-justificativas' (opcional, atestado etc.)
  status           tlp_presenca.status_justificativa not null default 'pendente',
  analisado_por    uuid references tlp_presenca.perfis(id) on delete set null,
  analisado_em     timestamptz,
  created_at       timestamptz not null default now()
);

comment on table tlp_presenca.justificativas is 'Justificativas de ausência/atraso enviadas para aprovação de um gestor.';

-- ---------------------------------------------------------
-- audit_log: trilha simples de auditoria para ações sensíveis
-- ---------------------------------------------------------
create table tlp_presenca.audit_log (
  id           bigint generated always as identity primary key,
  ator_id      uuid references tlp_presenca.perfis(id) on delete set null,
  acao         text not null,          -- ex.: 'foto_excluida_48h', 'justificativa_aprovada'
  entidade     text not null,          -- ex.: 'registros_presenca'
  entidade_id  uuid,
  detalhes     jsonb,
  created_at   timestamptz not null default now()
);

comment on table tlp_presenca.audit_log is 'Log de auditoria para ações automatizadas e decisões sensíveis (ex.: exclusão de fotos após 48h).';
