-- =========================================================
-- 0001 · Extensões e tipos (enums) do sistema de Presença Operacional TLP
--
-- Este banco é COMPARTILHADO com outros projetos — por isso todo o schema
-- do TLP Presença vive isolado em "tlp_presenca" (nunca em "public"), para
-- não colidir com tabelas/tipos/funções de nomes genéricos (ex.: "perfis",
-- "filiais") que outro projeto no mesmo banco possa ter. Extensões
-- (pgcrypto/pg_cron/pg_net) são de instância — "if not exists" já é
-- suficiente para conviver com outros projetos que também as usem.
-- =========================================================

create schema if not exists tlp_presenca;

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_cron";    -- agendamento da limpeza de fotos (48h)
create extension if not exists "pg_net";     -- permite pg_cron chamar a Edge Function via HTTP

-- ---------------------------------------------------------
-- Enums
-- ---------------------------------------------------------

-- Papel de acesso do usuário autenticado (controla o que a RLS libera)
create type tlp_presenca.perfil_acesso as enum (
  'admin',       -- acesso total, todas as filiais
  'gestor',      -- gestor de RH/operação, restrito à(s) sua(s) filial(is)
  'colaborador'  -- operacional, restrito ao próprio registro
);

-- Tipo de contrato do colaborador
create type tlp_presenca.tipo_contrato as enum (
  'clt',
  'aprendiz',
  'estagiario',
  'temporario',
  'pj'
);

-- Tipo de marcação dentro de uma jornada
create type tlp_presenca.tipo_marcacao as enum (
  'entrada',
  'inicio_intervalo',
  'fim_intervalo',
  'saida'
);

-- Status calculado/atribuído a uma marcação de presença
create type tlp_presenca.status_presenca as enum (
  'presente',
  'atrasado',
  'ausente',
  'justificado',
  'pendente_aprovacao'
);

-- Status do fluxo de justificativa de ausência/atraso
create type tlp_presenca.status_justificativa as enum (
  'pendente',
  'aprovada',
  'rejeitada'
);
