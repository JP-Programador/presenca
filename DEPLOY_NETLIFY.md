# Implantação no Netlify — TLP Presença Operacional

Este guia parte do princípio de que o backend (Supabase) já está criado e as
migrations aplicadas (ver `README.md` principal, seções das Etapas 1–3).
Aqui o foco é só colocar o frontend no ar.

## 1. Pré-requisitos

- Projeto Supabase criado, com as 26 migrations aplicadas (`supabase db push`) e os seeds em `supabase/seed/` (opcional, para ambiente de teste)
- ⚠️ Banco compartilhado com outros projetos: o schema `tlp_presenca` precisa
  estar em **Project Settings → API → Exposed schemas** (não fica exposto
  por padrão — só `public`). Sem isso o frontend recebe erro em toda chamada.
- As 4 Edge Functions publicadas: `delete-old-photos`, `checkin-publico`, `marcacao-publica`, `admin-criar-usuario`
- Pelo menos um usuário `admin` existente em `tlp_presenca.perfis` (ver seção 5)
- Conta no [Netlify](https://app.netlify.com) com acesso ao repositório Git do projeto

## 2. Subir o código para um repositório Git

O Netlify faz deploy contínuo a partir de um repositório (GitHub, GitLab ou
Bitbucket). Se o projeto ainda está só neste zip local:

```bash
cd tlp-presenca
git init
git add .
git commit -m "TLP Presença Operacional — versão inicial"
git branch -M main
git remote add origin <url-do-seu-repositorio>
git push -u origin main
```

## 3. Criar o site no Netlify

1. **Add new site → Import an existing project**
2. Escolha o provedor Git e o repositório `tlp-presenca`
3. O Netlify deve detectar automaticamente as configurações do `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Node version**: 20 (via `NODE_VERSION` no `netlify.toml` e `.nvmrc`)
4. Não clique em "Deploy" ainda — primeiro configure as variáveis de ambiente (próximo passo).

## 4. Variáveis de ambiente

Em **Site configuration → Environment variables**, adicione:

| Variável | Onde encontrar |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key |

⚠️ Use a chave **anon**, nunca a `service_role` — a `service_role` só existe
nas Edge Functions (configurada automaticamente pelo próprio Supabase, não
pelo Netlify) e nunca deve chegar ao código do frontend.

Depois de salvar as variáveis, clique em **Deploy site**.

## 5. Configurar o Supabase para aceitar o domínio do Netlify

No painel do Supabase:

1. **Authentication → URL Configuration**
   - **Site URL**: `https://SEU-SITE.netlify.app` (ou o domínio customizado, se já tiver)
   - **Redirect URLs**: adicione o mesmo domínio (necessário para o link de
     convite enviado por `admin-criar-usuario` funcionar)
2. **Authentication → Providers → Email**: confirme que "Enable email provider"
   está ativo (é o método usado pelo login administrativo)
3. Certifique-se de que o projeto tem **SMTP configurado** (Authentication →
   Email Templates / SMTP Settings) — sem isso, o convite de novos usuários
   (`admin-criar-usuario`) não entrega e-mail nenhum.

### Criando o primeiro usuário admin

Como o sistema exige um `admin` já existente para convidar outros usuários
(desde a Etapa 5, essa permissão é exclusiva do `admin` — nem `coordenador`
nem `auditor` conseguem criar usuários), o primeiro precisa ser criado
manualmente:

```sql
-- 1. Crie o usuário pela aba Authentication → Users → Add user no painel do Supabase
--    (defina um e-mail e uma senha temporária).
-- 2. Depois, rode isto no SQL Editor para promovê-lo a admin
--    (o trigger handle_new_user já criou a linha em perfis com perfil='colaborador'):
update tlp_presenca.perfis
set perfil = 'admin'
where email = 'seu-email@tlp.com.br';
```

## 6. Domínio customizado (opcional)

Em **Domain settings → Add a domain**, aponte seu domínio (ex.:
`presenca.tlp.com.br`) para o Netlify via CNAME, e depois repita o passo 5
(atualizar Site URL/Redirect URLs no Supabase para o domínio final) — o
Netlify emite o certificado HTTPS automaticamente via Let's Encrypt.

## 7. Testando o deploy

Depois do primeiro build:

1. Abra `https://SEU-SITE.netlify.app/` — deve carregar a tela pública do
   técnico. Teste em um celular real (câmera e GPS exigem HTTPS, que o
   Netlify já fornece por padrão, e também exigem contexto seguro — não
   funcionam em `http://`, só em `https://` ou `localhost`).
2. Abra `/admin` e entre com o usuário admin criado no passo 5.
3. Confirme que `/coordenador`, `/auditoria` e `/usuarios` carregam.
4. Peça pra alguém da operação fazer um check-in de teste na tela pública e
   confirme que o registro aparece em `/lider` (ou `/coordenador`) para
   aprovação, com a foto visível.

## 8. Deploys seguintes

Qualquer `git push` na branch configurada (normalmente `main`) dispara um novo
build automaticamente. Para testar mudanças antes de ir pra produção, use
**Deploy previews** (ativado por padrão em Pull Requests) ou `netlify deploy`
(sem `--prod`) via CLI a partir de uma branch separada.
