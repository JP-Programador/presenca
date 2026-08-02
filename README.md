# TLP · Presença Operacional

Estrutura base do projeto (React + Vite + TypeScript + Tailwind + Supabase).
**Nenhuma tela foi implementada ainda** — este pacote entrega apenas
fundação (config, tema, cliente Supabase) e o backend completo (SQL + Edge Function).

## Árvore de pastas

```
tlp-presenca/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── .env.example
├── .gitignore
├── public/
├── src/
│   ├── main.tsx              # bootstrap mínimo, sem telas
│   ├── index.css             # diretivas Tailwind
│   ├── theme/
│   │   └── theme.ts          # paleta TLP + tokens (cores, tipografia, radii, sombras)
│   ├── lib/
│   │   └── supabase.ts       # cliente Supabase (usa VITE_SUPABASE_URL / ANON_KEY)
│   ├── types/
│   │   └── database.types.ts # placeholder — gerar via `supabase gen types`
│   ├── components/
│   │   ├── layout/           # (vazio — próxima etapa)
│   │   ├── ui/                # (vazio — próxima etapa)
│   │   └── presenca/          # (vazio — próxima etapa)
│   ├── hooks/                 # (vazio — próxima etapa)
│   ├── pages/                 # (vazio — próxima etapa)
│   ├── routes/                # (vazio — próxima etapa)
│   ├── utils/                 # (vazio — próxima etapa)
│   └── assets/
└── supabase/
    ├── config.toml
    ├── migrations/
    │   ├── 0001_extensions_and_types.sql
    │   ├── 0002_tables.sql
    │   ├── 0003_indexes.sql
    │   ├── 0004_functions_triggers.sql
    │   ├── 0005_rls_policies.sql
    │   ├── 0006_storage.sql
    │   └── 0007_cron_delete_old_photos.sql
    └── functions/
        └── delete-old-photos/
            └── index.ts
```

## Paleta (`src/theme/theme.ts` + `tailwind.config.ts`)

| Token           | Hex       | Uso                                  |
|-----------------|-----------|---------------------------------------|
| `laranja`       | `#F26522` | Primária / marca TLP                  |
| `laranjaEscuro` | `#D9471A` | Hover/estado ativo da primária        |
| `amarelo`       | `#F5B000` | Avisos / pendências                   |
| `vermelho`      | `#C62828` | Erros / ausências / atrasos           |
| `grafite`       | `#333333` | Texto principal                       |
| `cinzaClaro`    | `#F5F5F5` | Fundo de página / superfícies neutras |

Use classes Tailwind (`bg-primary`, `text-danger`, `bg-surface`...) nos componentes,
e o objeto `theme` de `src/theme/theme.ts` em qualquer lógica JS/TS fora do JSX
(gráficos, libs externas, inline styles).

## Modelo de dados (resumo)

- **filiais** — unidades operacionais da TLP.
- **perfis** — 1:1 com `auth.users`; carrega o papel de acesso (`admin` / `gestor` / `colaborador`).
- **gestor_filiais** — N:N entre gestores e as filiais que gerenciam.
- **colaboradores** — cadastro operacional, vinculado a uma filial (e opcionalmente a um `perfil` de login).
- **escalas** — grade semanal de horário previsto por colaborador (usada para calcular atraso).
- **registros_presenca** — cada marcação (entrada/intervalo/saída), com foto, geolocalização e `foto_expira_em` (48h).
- **justificativas** — fluxo de aprovação de ausências/atrasos.
- **audit_log** — trilha de auditoria (ex.: exclusão automática de fotos).

## RLS — regras de acesso

- `admin`: acesso total a todas as tabelas e filiais.
- `gestor`: leitura/escrita restrita às filiais listadas em `gestor_filiais`.
- `colaborador`: só enxerga/edita seus próprios `registros_presenca` e `justificativas`.

Funções helper (`sou_admin()`, `gerencio_filial()`, `meu_colaborador_id()`) centralizam
essa lógica e são reaproveitadas tanto nas policies das tabelas quanto nas do Storage.

## Storage

- `tlp-fotos-presenca` (privado, 5MB, jpeg/png/webp) — path `{filial_id}/{colaborador_id}/{arquivo}`.
- `justificativas` (privado, 10MB, jpeg/png/pdf) — mesma convenção de path.

## Exclusão automática de fotos após 48h

1. Ao inserir/atualizar `foto_path` em `registros_presenca`, um trigger calcula
   `foto_expira_em = horario_registrado + 48h` (migration 0004).
2. `pg_cron` roda a cada 30 min (migration 0007) chamando a Edge Function
   `delete-old-photos` via `pg_net`.
3. A função (`supabase/functions/delete-old-photos/index.ts`), com `service_role`,
   busca registros vencidos, apaga o arquivo do bucket, zera `foto_path`/`foto_expira_em`
   e grava uma linha em `audit_log`.

⚠️ Antes de aplicar a migration 0007 em produção, substitua `SEU_PROJETO` e
`SERVICE_ROLE_KEY` pelos valores reais (idealmente lidos de um secret/Vault,
não hardcoded na migration).

## Etapa 2 — Telas do técnico e do líder

```
src/
├── components/
│   ├── ui/            # Button, Card, Input, Alert, StatusBadge, StatusChip
│   ├── layout/         # BrandHeader (faixa de identidade TLP)
│   └── presenca/        # PendenteCard (linha de aprovação/rejeição)
├── hooks/
│   ├── useCamera.ts    # câmera obrigatória (getUserMedia + captura em canvas)
│   ├── useGeolocation.ts # GPS obrigatório (navigator.geolocation)
│   └── useAuth.ts      # sessão do painel administrativo
├── lib/
│   ├── checkin.ts      # chama a Edge Function checkin-publico
│   └── presenca.ts     # listagens e aprovação/rejeição para o líder
├── pages/
│   ├── TecnicoCheckin.tsx  # tela pública ( / e /ponto )
│   ├── AdminLogin.tsx      # login ( /admin )
│   └── LiderDashboard.tsx  # dashboard do líder ( /lider )
└── routes/AppRoutes.tsx
```

### Tela do técnico (`/` ou `/ponto`) — pública, sem login

1. Identificação leve: código da filial + 4 últimos dígitos da matrícula (sem CPF).
2. Escolha do tipo de marcação (entrada / início intervalo / fim intervalo / saída).
3. Captura **obrigatória** de foto (câmera frontal) e de **GPS** — o botão "Enviar
   presença" só libera quando os dois chips (`StatusChip`) ficam verdes.
4. Envio para a Edge Function `checkin-publico` (nova, ver abaixo), que valida o
   colaborador, sobe a foto e grava o registro. Mostra o status calculado
   (presente/atrasado) ao final.

**Por que uma Edge Function e não INSERT direto do app**: a tela é pública e não
usa login de usuário, então não existe `auth.uid()` para casar com as policies de
RLS das migrations 0005/0006 (que assumem colaborador autenticado). Em vez de
afrouxar o RLS para o papel anônimo — o que abriria a tabela/bucket a qualquer
cliente — a validação de filial/matrícula, o upload da foto e o insert do registro
acontecem todos dentro da função, com a `service_role` key. Isso foi adicionado
como `supabase/functions/checkin-publico/index.ts` (registrar com
`supabase functions deploy checkin-publico`).

### Login administrativo (`/admin`) e dashboard do líder (`/lider`)

- `/admin`: login por e-mail/senha (Supabase Auth). Redireciona para `/lider` se
  já houver sessão válida.
- `/lider`: duas abas — **Presença** (registros com `status = pendente_aprovacao`)
  e **Justificativas** (`status = pendente`). Cada item mostra colaborador,
  filial, horário e a foto do registro (via signed URL, bucket privado), com
  botões **Aprovar**/**Rejeitar**. As listagens já vêm filtradas pela filial do
  gestor automaticamente, pois usam o client autenticado e reaproveitam o RLS
  das migrations 0005 — nenhuma query filtra manualmente por filial no frontend.

## Etapa 3 — Coordenação e auditoria

```
supabase/migrations/
├── 0008_coordenador_role.sql     # novo valor 'coordenador' no enum perfil_acesso
├── 0009_sla_columns.sql          # analisado_por/analisado_em em registros_presenca
├── 0010_coordenador_helpers.sql  # sou_coordenador(), visao_global(), pode_gerenciar_usuarios()
├── 0011_rls_coordenador.sql      # policies adicionais (leitura global + gestão de usuários)
├── 0012_view_sla_lideres.sql     # vw_sla_lideres — ranking por tempo médio e % dentro do SLA
└── 0013_audit_triggers.sql       # grava audit_log automaticamente em toda decisão/mudança de papel

supabase/functions/
└── admin-criar-usuario/          # cria auth.users + perfis (só admin/coordenador podem chamar)

src/
├── lib/coordenacao.ts   # mapa, ranking, auditoria, usuários/hierarquia
├── lib/export.ts        # exportarCSV / exportarExcel (SheetJS)
├── components/
│   ├── ui/MetricCard.tsx
│   ├── ui/ExportButtons.tsx
│   └── presenca/
│       ├── PresencaMap.tsx       # Leaflet + OpenStreetMap, marcador colorido por status
│       ├── RankingLideres.tsx
│       ├── NovoUsuarioForm.tsx
│       └── UsuarioRow.tsx        # edição de papel/filial + filiais gerenciadas
└── pages/
    ├── CoordenadorDashboard.tsx  # /coordenador — métricas, mapa, ranking
    ├── AuditoriaDashboard.tsx    # /auditoria — log filtrável + export
    └── UsuariosGestao.tsx        # /usuarios — hierarquia + convite de usuário
```

### Hierarquia de papéis

`admin` > `coordenador` > `gestor` (por filial, via `gestor_filiais`) > `colaborador`.
Admin e coordenador têm leitura global (todas as filiais) e podem aprovar/rejeitar
qualquer registro; a diferença prática é que só `admin` tem acesso irrestrito a
qualquer política futura que venha a ser criada especificamente para esse papel —
hoje as permissões de admin e coordenador são as mesmas nas migrations 0011.

### SLA de aprovação

`registros_presenca` e `justificativas` ganharam `analisado_por`/`analisado_em`
(a segunda já existia). `src/lib/presenca.ts` (Etapa 2) foi atualizado para
gravar os dois campos a cada aprovação/rejeição. A view `vw_sla_lideres`
(migration 0012) agrega isso por gestor: total de decisões, tempo médio de
resposta e % de decisões dentro da meta de 2h — é o que alimenta o ranking em
`/coordenador`.

### Mapa de presenças

`PresencaMap` usa **Leaflet + tiles do OpenStreetMap** (sem chave de API),
plotando cada registro com `latitude`/`longitude`, colorido pelo `status`
(mesma paleta semântica do restante do sistema). O dashboard permite alternar
a janela de tempo (24h / 3 dias / 7 dias).

### Auditoria

A migration 0013 cria triggers que gravam automaticamente em `audit_log`
sempre que: o status de um registro de presença ou justificativa muda, o papel
ou a filial de um usuário é alterado, ou um gestor é atribuído/removido de uma
filial. `/auditoria` lista esse log com filtro por entidade e exportação.

### Gestão de usuários e hierarquia

`/usuarios` lista todos os usuários agrupados por papel, permite trocar
papel/filial, ativar/desativar, e — para gestores — atribuir quais filiais
cada um gerencia (a mesma tabela `gestor_filiais` que já orienta todo o RLS
desde a Etapa 1). Criar um usuário novo (login) exige a Admin API do Supabase,
por isso passa pela Edge Function `admin-criar-usuario`: ela confere que quem
está chamando é `admin`/`coordenador`, envia o convite por e-mail e grava o
papel/filial/hierarquia definidos no formulário.

### Exportação CSV/Excel

`src/lib/export.ts` oferece `exportarCSV` (nativo, com BOM UTF-8 e separador
`;` para abrir corretamente no Excel pt-BR) e `exportarExcel` (via **SheetJS**,
gera `.xlsx` de verdade). O componente `ExportButtons` é reutilizado em
Coordenação, Auditoria e Usuários — basta passar os dados e as colunas.

⚠️ Nota de tamanho de bundle: o build final acusa um aviso de chunk >500KB
(Leaflet + SheetJS). Funciona normalmente, mas se quiser otimizar depois, dá
pra fazer `import()` dinâmico do mapa e do SheetJS só quando essas telas
forem abertas.

## Etapa 4 — Integração final (providers, guards, deploy)

```
src/
├── providers/
│   └── AuthProvider.tsx     # sessão única compartilhada (Context API)
├── routes/
│   ├── AppRoutes.tsx        # rotas + lazy-loading das telas administrativas
│   └── guards/
│       ├── RequireAuth.tsx  # exige login (qualquer papel)
│       └── RequireRole.tsx  # exige login + papel específico
└── services/                # antigo src/lib — renomeado para deixar
    ├── index.ts              # explícito que é a camada de acesso a dados
    ├── supabaseClient.ts     # (era src/lib/supabase.ts)
    ├── authService.ts        # funções puras de auth (usadas pelo AuthProvider)
    ├── checkinService.ts     # (era src/lib/checkin.ts)
    ├── presencaService.ts    # (era src/lib/presenca.ts)
    ├── coordenacaoService.ts # (era src/lib/coordenacao.ts)
    └── exportService.ts      # (era src/lib/export.ts)

netlify.toml            # build, redirect SPA, headers de segurança
.nvmrc                  # fixa Node 20 (Netlify + local)
DEPLOY_NETLIFY.md        # passo a passo de implantação
CHECKLIST_PRODUCAO.md    # checklist antes/depois do go-live
```

### Providers e guards de acesso

Antes da Etapa 4, cada página (`LiderDashboard`, `CoordenadorDashboard`,
`AuditoriaDashboard`, `UsuariosGestao`) chamava `useAuth()` de forma
independente e repetia a mesma lógica de "se não tem sessão, redireciona; se
não tem o papel certo, redireciona". Isso significava: (1) uma consulta a
`perfis` por página visitada, e (2) checagem de acesso duplicada em quatro
lugares diferentes — fácil de esquecer de atualizar em um deles.

Agora:

- **`AuthProvider`** (em `src/providers/AuthProvider.tsx`) busca a sessão uma
  única vez, na raiz da aplicação (`main.tsx`), e distribui via Context. Toda
  página continua chamando `useAuth()` — só que agora é o mesmo hook, a mesma
  fonte, sem refetch a cada navegação.
- **`RequireAuth`** protege `/lider`: qualquer usuário logado entra.
- **`RequireRole`** protege `/coordenador`, `/auditoria` e `/usuarios`: só
  `admin`/`coordenador`. Um usuário logado mas sem o papel certo é mandado
  para `/lider` (não vê tela em branco, nem mensagem de erro expondo que a
  rota existe).
- As páginas em si ficaram mais simples: sem `Navigate`, sem tela de loading
  duplicada — só o `if (!usuario) return null;` residual, que existe apenas
  para o TypeScript entender que `usuario` não é nulo dali pra baixo (na
  prática, o guard já garante isso antes de renderizar a página).

### Reorganização lib/ → services/

Os arquivos que conversam com o Supabase (antes em `src/lib/`) foram
renomeados para `src/services/` com nomes que descrevem o domínio
(`presencaService`, `coordenacaoService` etc.) em vez do nome genérico da
etapa em que foram criados. Todos os imports no projeto foram atualizados —
não é preciso trocar nada manualmente.

### Lazy-loading das telas de coordenação

`CoordenadorDashboard` (Leaflet), `AuditoriaDashboard` e `UsuariosGestao`
(SheetJS) agora são carregadas sob demanda via `React.lazy` + `Suspense` nas
rotas. Isso resolveu o aviso de bundle >500KB da Etapa 3: a tela pública do
técnico (a mais usada, em celulares muitas vezes com rede ruim) caiu para
~117KB gzip; o restante só é baixado por quem realmente acessa `/coordenador`,
`/auditoria` ou `/usuarios`.

### Deploy no Netlify

Ver **`DEPLOY_NETLIFY.md`** para o passo a passo completo (variáveis de
ambiente, redirect SPA, configuração do Supabase Auth para o domínio de
produção, criação do primeiro usuário admin). O `netlify.toml` já traz:

- `command = "npm run build"`, `publish = "dist"`
- Redirect `/* → /index.html` (necessário para o React Router funcionar em
  rotas profundas como `/coordenador` ao recarregar a página)
- Headers de segurança básicos, incluindo `Permissions-Policy` liberando
  câmera/geolocalização para o próprio domínio (`self`) — sem isso, a tela
  do técnico não consegue pedir permissão de câmera/GPS em alguns navegadores

### Checklist de produção

Ver **`CHECKLIST_PRODUCAO.md`** — cobre backend, frontend, segurança, LGPD e
operação pós-lançamento, com itens 🔴 marcados como bloqueantes.

## Etapa 5 — Ajuste de hierarquia (admin = auditor em leitura, coordenador abaixo)

```
supabase/migrations/
├── 0014_auditor_role.sql          # novo valor 'auditor' no enum perfil_acesso
└── 0015_rbac_hierarquia_final.sql # redefine visao_global(), pode_gerenciar_usuarios(),
                                    # cria pode_decidir_presenca(); recria as 2 policies
                                    # de aprovação que precisavam da regra mais estrita

src/components/layout/
└── NavPaineis.tsx   # navegação cruzada entre painéis, condicionada ao papel
```

### Hierarquia final

```
admin          ─┬─ leitura global (todas as filiais, audit_log, usuários)
                 ├─ aprova/rejeita presença em qualquer filial
                 └─ único que gerencia usuários e hierarquia (gestor × filial)

auditor        ─── mesma leitura global do admin — MAS sem nenhuma escrita:
                    não aprova, não rejeita, não gerencia usuários

coordenador    ─┬─ leitura global (igual admin/auditor)
  (abaixo do    ├─ aprova/rejeita presença em qualquer filial (igual admin)
   admin)        └─ NÃO gerencia usuários/hierarquia (exclusivo do admin agora)

gestor         ─── restrito às filiais em gestor_filiais (sem alteração)
colaborador    ─── restrito aos próprios registros (sem alteração)
```

Em termos de SQL, a diferença entre os três papéis "de cima" se resume a duas
funções helper:

- `visao_global()` → `true` para admin, auditor **e** coordenador (controla
  todo `select` amplo: mapa, ranking, log de auditoria, lista de usuários)
- `pode_decidir_presenca()` → `true` só para admin e coordenador (controla o
  `update` de status em `registros_presenca`/`justificativas` — é essa
  diferença que impede o auditor de aprovar algo mesmo enxergando tudo)
- `pode_gerenciar_usuarios()` → `true` só para admin (controla `perfis` e
  `gestor_filiais` — coordenador deixou de poder criar usuários ou reatribuir
  gestores a filiais nesta etapa)

### Reflexo no frontend

- **Rotas**: `/coordenador` e `/auditoria` abertas a admin/auditor/coordenador;
  `/usuarios` restrita a admin (guard `RequireRole` em `AppRoutes.tsx`)
- **`/lider`**: continua acessível a qualquer papel logado (`RequireAuth`), mas
  o `PendenteCard` recebe `somenteLeitura` quando `usuario.perfil === "auditor"`
  — os botões de aprovar/rejeitar somem e viram um aviso "acesso de auditor"
- **`NavPaineis`**: um único componente decide quais links de navegação
  (Coordenação / Auditoria / Usuários) aparecem no cabeçalho de cada painel,
  a partir do papel do usuário — evita que a regra de acesso fique espalhada
  e divergente em quatro arquivos diferentes
- **Criação de usuários**: a Edge Function `admin-criar-usuario` agora rejeita
  chamadas de quem não é `admin` (antes aceitava também `coordenador`)

⚠️ Se você já tinha usuários com `perfil = 'coordenador'` criados nas Etapas
3/4 e eles precisavam continuar gerenciando outros usuários, será necessário
promovê-los manualmente para `admin` depois de aplicar esta migration:

```sql
update tlp_presenca.perfis set perfil = 'admin' where email = 'pessoa@tlp.com.br';
```

## Como aplicar

```bash
npm install
cp .env.example .env   # preencha com as credenciais do seu projeto Supabase

# aplicar todas as migrations, na ordem
supabase db push

# deploy das Edge Functions
supabase functions deploy delete-old-photos
supabase functions deploy checkin-publico
supabase functions deploy admin-criar-usuario

# gerar os tipos TypeScript reais do banco
supabase gen types typescript --project-id <PROJECT_ID> --schema public > src/types/database.types.ts

npm run dev
```
