# Entrega — Módulos 5 a 15 (TLP Presença Operacional)

Este documento resume o que foi entregue nos módulos 5-15, construídos em
cima da base já existente (Etapas 1-3: auth, tela pública, dashboards,
RLS, exclusão de fotos em 48h). Nenhuma arquitetura principal foi
reescrita — tudo aqui é adição.

## O que foi implementado, por módulo

| Módulo | Entrega | Principais arquivos |
|---|---|---|
| 5 — Calendário | Tabela `calendario` (só exceções/feriados), classificação UTIL/SÁBADO/DOMINGO/FERIADO | `0017_calendario.sql`, `lib/calendario.ts`, `services/calendarioService.ts` |
| 6 — Status do dia | Máquina de estado FALTA/FOLGA→PENDENTE→PRESENTE/ATESTADO/OUTROS, validada no servidor | `0018_status_dia.sql`, `types/status.ts`, `lib/statusMachine.ts`, `hooks/useStatusDia.ts` |
| 7 — Gestão manual | Ações rápidas do líder + modal obrigatório de "Outros" | `StatusActionMenu.tsx`, `OutrosStatusModal.tsx` |
| 8 — Pendências e cobrança | Painel com 7 filtros, contador, busca, destaque de falta após 09h | `PendenciasPainel.tsx` |
| 9 — Mapa operacional | Mapa com 5 cores, precisão de GPS, filtro por filial/líder | `0020_mapa_operacional.sql`, `PresenceMap.tsx`, `MiniMapCard.tsx` |
| 10 — SLA de aprovação | Tempo PENDENTE→decisão, faixas verde/amarelo/vermelho, ranking, médias | `0021_sla_status_dia.sql`, `slaService.ts`, `RankingSlaStatusDia.tsx` |
| 11 — Auditoria avançada | Cobertura de status_dia, edição de usuário, login/logout, reset de senha; timeline + filtros + modal | `0022_auditoria_avancada.sql`, `AuditTimeline.tsx`, `AuditFilters.tsx`, `AuditDetailsModal.tsx` |
| 12 — Exportações | 8 relatórios (CSV/Excel) com as colunas pedidas | `0023_relatorios.sql`, `relatoriosService.ts`, `RelatoriosExport.tsx` |
| 13 — 4 marcações | Banco + tela pública `/ponto4` (opcional, paralela a `/` e `/ponto`) | `0024_preparacao_4_marcacoes.sql`, `functions/marcacao-publica`, `TecnicoMarcacoes.tsx` |
| 14 — Polimento | Dark mode opcional, toasts, skeletons, empty states, foco visível | `ThemeProvider.tsx`, `ToastProvider.tsx`, `Skeleton.tsx`, `EmptyState.tsx` |
| 15 — Entrega final | Este documento + seeds + checklist atualizado | `supabase/seed/`, `CHECKLIST_PRODUCAO.md` |

## Mudanças pós-entrega: identificação na tela pública e remoção do CPF

A pedido, a identificação do técnico em `/`, `/ponto` e `/ponto4` deixou de
ser **matrícula completa + 4 dígitos do CPF** e passou a ser **código da
filial + 4 últimos dígitos da matrícula** (mais fácil de digitar em campo).
Alterado nas Edge Functions (`checkin-publico`, `marcacao-publica`) e no
frontend (`checkinService.ts`, `marcacoesService.ts`, `TecnicoCheckin.tsx`,
`TecnicoMarcacoes.tsx`).

Em seguida, o **CPF foi removido por completo** do cadastro de
colaboradores (migration `0026_remover_cpf.sql`, `alter table ... drop
column cpf`) — decisão consciente, dado o volume pequeno de colaboradores
(até ~200) e operação controlada, que torna o risco de identificação mais
fraca aceitável sem rate-limit dedicado (documentado em
`CHECKLIST_PRODUCAO.md`). Se o quadro crescer bastante ou a tela pública for
exposta fora do ambiente de trabalho, vale reavaliar.

## Migrations novas (0017 a 0026)

A 0025 foi adicionada numa revisão pós-entrega: corrige uma transição que a
UI oferecia (botão "Presente" do líder a partir de qualquer status) mas que
`transicionar_status_dia` rejeitava quando o status atual era `ATESTADO`/
`OUTROS`. A 0026 remove a coluna `cpf` de `colaboradores` (deixou de ser
usada em qualquer fluxo). Aplique em ordem, depois das 0001-0016 já
existentes:

```bash
supabase db push
```

ou execute cada arquivo em sequência no SQL Editor do painel do Supabase.

⚠️ **Banco compartilhado com outros projetos**: a partir da 0001, todo o
schema do TLP Presença vive isolado em `tlp_presenca` (não em `public`).
Depois de aplicar as migrations, vá em **Project Settings → API → Exposed
schemas** e adicione `tlp_presenca` à lista — por padrão só `public` fica
exposto pelo PostgREST, e sem esse passo o frontend recebe erro em toda
chamada. Isso também exige `db: { schema: "tlp_presenca" }` no client
Supabase do frontend e nas 4 Edge Functions (já feito no código).

⚠️ A migration 0018 agenda um novo job `pg_cron` (`tlp-gerar-status-dia-diario`)
— confirme que `pg_cron`/`pg_net` estão habilitados (Database → Extensions),
igual já era necessário para a limpeza de fotos. Os nomes dos jobs (e dos
buckets de Storage) são prefixados com `tlp-` pelo mesmo motivo do schema:
`cron.job` e `storage.buckets` são compartilhados entre todos os projetos do
banco, não são isolados por schema.

## Edge Functions

`supabase/functions/checkin-publico/index.ts` foi alterada (não recriada):
agora grava `precisao_metros` como coluna própria (antes ia dentro do texto
de `observacao`) e chama `marcar_status_dia_pendente` para mover o status do
dia do colaborador para `PENDENTE`.

`supabase/functions/marcacao-publica/index.ts` é **nova** — serve a tela
`/ponto4` (fluxo de 4 marcações do Módulo 13). O técnico não escolhe o tipo:
o servidor calcula a próxima marcação esperada do dia. Só a primeira
marcação (ENTRADA) atualiza o `status_dia`; as 3 seguintes ficam registradas
em `marcacoes_dia` sem afetar o fluxo de aprovação FALTA→PENDENTE→PRESENTE.

**Republique as duas functions** após o deploy das migrations:

```bash
supabase functions deploy checkin-publico
supabase functions deploy marcacao-publica
```

## Variáveis de ambiente

Nenhuma variável nova. Continuam sendo só:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

(ver `.env.example` e `DEPLOY_NETLIFY.md`, que já cobriam isso)

## Seeds (`supabase/seed/`)

- `seed_filiais_tecnicos.sql` — 3 filiais + 4 colaboradores de exemplo com
  escala padrão, para testar o sistema ponta a ponta.
- `seed_usuarios.md` — passo a passo para criar o primeiro admin e demais
  papéis (não é possível popular `auth.users` via SQL puro).
- Feriados nacionais **já vêm seedados** na própria migration `0017` (2025 e
  2026) — não precisa de arquivo separado.

## Passos Netlify / Supabase

Sem mudanças estruturais em relação ao `DEPLOY_NETLIFY.md` já existente,
exceto:
- contagem de migrations (13 → 26, já atualizada no documento);
- **novo passo obrigatório**: expor o schema `tlp_presenca` em Project
  Settings → API → Exposed schemas (ver aviso acima);
- lembrar de reimplantar a Edge Function `checkin-publico` alterada, e de
  publicar a `marcacao-publica`, que é nova;
- conferir os dois cron jobs prefixados: `tlp-gerar-status-dia-diario` e
  `tlp-delete-old-photos-48h`;
- conferir os buckets prefixados: `tlp-fotos-presenca` e `tlp-justificativas`.

## Testes manuais recomendados

**Módulo 5/6 — calendário e status do dia**
- [ ] Rodar `select tlp_presenca.gerar_status_dia(current_date);` manualmente e
      conferir que todo colaborador ativo ganhou uma linha em `status_dia`
      com status `FALTA` (dia útil) ou `FOLGA` (fim de semana/feriado)
- [ ] Cadastrar um feriado futuro em `calendario` e conferir que
      `tipo_dia_calendario()` passa a retornar `FERIADO` para essa data

**Módulo 7 — gestão manual**
- [ ] No dashboard do líder, aba "Status do dia": aprovar um `PENDENTE`,
      rejeitar outro, marcar um colaborador como `ATESTADO`, e marcar outro
      como `OUTROS` (confirmar que o modal exige motivo)
- [ ] Confirmar que um auditor logado nessa mesma tela **não** vê os botões
      de ação (somente leitura)

**Módulo 8 — pendências**
- [ ] Testar os 7 filtros rápidos e a busca por matrícula/nome
- [ ] Depois das 09:00 num dia útil, confirmar que colaboradores em `FALTA`
      aparecem destacados em vermelho

**Módulo 9 — mapa**
- [ ] Fazer um check-in de teste na tela pública com GPS ativo e confirmar
      que o ponto aparece no mapa do coordenador, na cor certa (amarelo,
      já que entra como `PENDENTE`), com o círculo de precisão do GPS
- [ ] Testar o filtro por filial e por líder

**Módulo 10 — SLA**
- [ ] Aprovar uma presença em menos de 15min e conferir badge verde;
      aprovar outra depois de 30min (ou simular via UPDATE direto de
      `entrou_pendente_em`) e conferir badge vermelho

**Módulo 11 — auditoria**
- [ ] Fazer login/logout e confirmar que aparecem na timeline de auditoria
- [ ] Redefinir a senha de um usuário em `/usuarios` e confirmar o evento
      `senha_redefinida_solicitada` no log

**Módulo 12 — exportações**
- [ ] Gerar cada um dos 8 relatórios em CSV e Excel e abrir no Excel/Sheets
      para confirmar acentuação (BOM UTF-8) e colunas corretas

**Módulo 14 — polimento**
- [ ] Alternar o tema claro/escuro e navegar por 2-3 telas confirmando que
      nada fica ilegível (ver limitação documentada sobre contraste de texto
      secundário em modo escuro)
