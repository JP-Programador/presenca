# Checklist de produção — TLP Presença Operacional

Percorra esta lista antes de anunciar o sistema como "em produção" para as
equipes de campo. Itens marcados 🔴 são bloqueantes — sem eles, ou o sistema
não funciona, ou há risco real de segurança/dados.

## Backend (Supabase)

- [ ] 🔴 **Banco compartilhado com outros projetos**: todo o schema do TLP
      Presença vive isolado em `tlp_presenca` (não em `public`) — ver
      migration 0001. Em **Project Settings → API → Exposed schemas**,
      adicione `tlp_presenca` à lista (por padrão só `public` fica exposto;
      sem esse passo, o frontend recebe erro 404/406 em toda chamada)
- [ ] 🔴 Todas as 26 migrations aplicadas, em ordem, sem erro (`supabase db push`
      ou execução manual em sequência no SQL Editor) — a 0016 corrige uma
      falha de RLS em `perfis` (auto-reativação/auto-troca de filial); as
      0017-0024 implementam os Módulos 5-13 (calendário, status do dia,
      mapa/SLA operacional, auditoria avançada, relatórios, 4 marcações); a
      0025 corrige uma transição de status do dia que a UI oferecia mas o
      banco rejeitava (marcar "Presente" manualmente a partir de ATESTADO/OUTROS);
      a 0026 remove a coluna `cpf` (não é mais usada em lugar nenhum)
- [ ] 🔴 `pg_cron` tem os DOIS jobs agendados e ativos: `tlp-delete-old-photos-48h`
      (migration 0007) e `tlp-gerar-status-dia-diario` (migration 0018) — sem o
      segundo, o status do dia (FALTA/FOLGA) de novos colaboradores só é
      criado sob demanda (lazy), o que funciona mas atrasa a visão do
      dashboard antes do primeiro check-in do dia. Nomes prefixados com
      "tlp-" porque `cron.job` é uma tabela de instância, compartilhada com
      os outros projetos do mesmo banco
- [ ] Feriados nacionais em `tlp_presenca.calendario` (seed da migration 0017)
      conferidos para o ano corrente — as datas móveis (Carnaval, Sexta-feira
      Santa, Corpus Christi) foram calculadas manualmente e vale checar contra
      o calendário oficial; feriados estaduais/municipais precisam ser
      inseridos manualmente (`calendarioService.salvarExcecao` ou SQL direto)
- [ ] 🔴 RLS **habilitado** em todas as tabelas (as migrations já fazem isso —
      confirme em Database → Tables, filtrando pelo schema `tlp_presenca`, que
      nenhuma tabela está com o cadeado aberto)
- [ ] 🔴 As 4 Edge Functions publicadas e testadas manualmente uma vez cada:
      `delete-old-photos`, `checkin-publico`, `marcacao-publica`,
      `admin-criar-usuario`
- [ ] 🔴 `pg_cron` + `pg_net` habilitados no projeto (Database → Extensions) —
      sem isso a limpeza automática de fotos em 48h não roda
- [ ] Job `tlp-delete-old-photos-48h` aparece em `select * from cron.job;` e o
      `net.http_post` da migration 0007 tem a URL/`service_role` reais do
      projeto (não o placeholder `SEU_PROJETO`/`SERVICE_ROLE_KEY`)
- [ ] Buckets `tlp-fotos-presenca` e `tlp-justificativas` existem e estão **privados**
      (`public = false`), com os limites de tamanho/mime esperados
- [ ] SMTP configurado no Supabase Auth (necessário para `admin-criar-usuario`
      convidar novos usuários por e-mail)
- [ ] **Site URL** e **Redirect URLs** em Authentication → URL Configuration
      apontam para o domínio real de produção, não `localhost`
- [ ] Pelo menos um usuário com `perfil = 'admin'` existe em `tlp_presenca.perfis`
      — só ele consegue criar outros usuários (`coordenador` e `auditor` não
      têm mais essa permissão desde a migration 0015)
- [ ] Cadastro inicial de `filiais` carregado (o sistema não funciona sem
      pelo menos uma filial cadastrada)
- [ ] Backups automáticos do banco habilitados (Database → Backups) — o plano
      Free do Supabase não tem backup diário; considere upgrade antes do go-live
- [ ] Rate limiting / abuso: `checkin-publico` e `marcacao-publica`
      identificam o colaborador por **código da filial + 4 últimos dígitos
      da matrícula** (sem CPF — removido do cadastro na migration 0026).
      Decisão consciente: com até ~200 colaboradores, o volume pequeno e a
      operação controlada tornam esse risco aceitável sem rate-limit
      dedicado. Se o quadro crescer bastante ou o link for divulgado fora do
      ambiente de trabalho, reavalie a necessidade de um WAF/rate-limit na
      frente desses dois endpoints

## Frontend (Netlify)

- [ ] 🔴 `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas nas
      variáveis de ambiente do Netlify (nunca a `service_role`)
- [ ] 🔴 Build de produção roda sem erro (`npm run build`) — validado neste
      pacote antes da entrega
- [ ] HTTPS ativo (automático no Netlify) — câmera e GPS não funcionam em
      contexto inseguro (`http://`)
- [ ] Domínio customizado configurado e certificado emitido, se aplicável
- [ ] `netlify.toml` com o redirect SPA (`/* → /index.html`) confirmado —
      sem isso, recarregar `/lider` ou `/coordenador` direto no navegador dá 404
- [ ] Testado em pelo menos um celular Android e um iPhone reais (não só
      emulador) o fluxo completo da tela pública: permissão de câmera,
      permissão de GPS, captura, envio
- [ ] Testado com conexão de rede ruim/instável (3G simulado) — o fluxo do
      técnico é usado em campo, muitas vezes fora de Wi-Fi

## Segurança e acesso

- [ ] 🔴 Nenhuma chave `service_role` aparece em código do frontend ou em
      variáveis `VITE_*` (essas variáveis vão para o bundle público)
- [ ] Papéis de acesso revisados: confirme quem é `admin`, `auditor`,
      `coordenador`, `gestor` de cada filial — a tabela `gestor_filiais`
      reflete a realidade operacional atual. Lembre-se: só `admin` gerencia
      usuários; `auditor` não aprova nada; `coordenador` aprova mas não
      gerencia gente
- [ ] Usuários de teste/desenvolvimento removidos ou desativados
      (`perfis.ativo = false`) antes do go-live
- [ ] Senhas temporárias de qualquer usuário criado manualmente foram trocadas

## Dados e LGPD

- [ ] Colaboradores cientes de que a presença é registrada com foto e
      geolocalização (aviso/termo assinado ou comunicado formal)
- [ ] Política de retenção de fotos (48h, automática) validada com jurídico/RH
      como suficiente — ajustar `interval '48 hours'` nas migrations 0002/0004
      se o prazo precisar mudar
- [ ] Fluxo de exclusão de dados de um colaborador desligado definido (hoje
      `colaboradores.ativo = false` preserva o histórico; confirmar se isso
      atende a eventual pedido de exclusão sob a LGPD)

## Operação e monitoramento

- [ ] Alguém responsável por acompanhar `/auditoria` periodicamente
- [ ] Alguém responsável por acompanhar o ranking de SLA em `/coordenador`
      e cobrar líderes com % baixo
- [ ] Canal de suporte definido para técnicos que tiverem problema com
      câmera/GPS em campo (ex.: WhatsApp do RH, ramal)
- [ ] Teste de carga básico se o número de técnicos simultâneos for grande
      (o `checkin-publico` sobe uma imagem por chamada — considerar o volume
      esperado no horário de pico de entrada)

## Pós-lançamento (primeira semana)

- [ ] Conferir se o job de exclusão de fotos (48h) realmente está apagando —
      consultar `audit_log where acao = 'foto_excluida_48h'`
- [ ] Conferir se o e-mail de convite de novos usuários está chegando (não
      caindo em spam)
- [ ] Revisar os primeiros registros `pendente_aprovacao` acumulados e o
      tempo de resposta real dos líderes (ranking de SLA em `/coordenador`)
- [ ] Coletar feedback dos técnicos sobre o fluxo de câmera/GPS (permissões
      negadas, lentidão, etc.) e ajustar textos/UX se necessário
