# Seed de usuários (admin / coordenador / auditor / gestor)

Usuários vivem em `auth.users`, que não pode ser populado por INSERT direto
via SQL (senhas são geridas pelo Supabase Auth). O fluxo é:

## 1. Primeiro admin (manual, uma vez)

1. Painel do Supabase → **Authentication → Users → Add user** — defina
   e-mail e senha temporária, marque "Auto confirm user".
2. O trigger `handle_new_user` (migration 0004) já cria a linha em
   `tlp_presenca.perfis` com `perfil = 'colaborador'`. Promova a admin:

```sql
update tlp_presenca.perfis set perfil = 'admin' where email = 'admin@tlp.com.br';
```

## 2. Demais usuários (coordenador, auditor, gestor)

Depois que existe um admin, use a tela **`/usuarios`** (Módulo — gestão de
usuários) → **Convidar usuário**, que chama a Edge Function
`admin-criar-usuario` e envia um e-mail de convite (precisa de SMTP
configurado no Supabase — ver `DEPLOY_NETLIFY.md`).

Alternativa via SQL (só para ambiente de teste, sem e-mail de convite — crie
o usuário pelo painel como no passo 1 e depois):

```sql
-- Coordenador (visão global, aprova presença, não gerencia usuários)
update tlp_presenca.perfis set perfil = 'coordenador' where email = 'coordenador@tlp.com.br';

-- Auditor (visão global, somente leitura)
update tlp_presenca.perfis set perfil = 'auditor' where email = 'auditor@tlp.com.br';

-- Gestor (líder de filial) — troque o e-mail e o código da filial
update tlp_presenca.perfis
set perfil = 'gestor', filial_id = (select id from tlp_presenca.filiais where codigo = '1768')
where email = 'lider.matriz@tlp.com.br';

insert into tlp_presenca.gestor_filiais (gestor_id, filial_id)
select p.id, f.id
from tlp_presenca.perfis p, tlp_presenca.filiais f
where p.email = 'lider.matriz@tlp.com.br' and f.codigo = '1768'
on conflict do nothing;
```

## 3. Vincular um gestor a um colaborador (login próprio)

Se o gestor também bate ponto como colaborador (raro, mas possível):

```sql
update tlp_presenca.colaboradores
set perfil_id = (select id from tlp_presenca.perfis where email = 'lider.matriz@tlp.com.br')
where matricula = '1001' and filial_id = (select id from tlp_presenca.filiais where codigo = '1768');
```
