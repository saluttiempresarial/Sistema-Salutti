-- supabase/migrations/037_relatorio_liberacao_perfil.sql
--
-- Liberação de nível 1 dos Indicadores (Especificação de Relatórios e
-- Dashboards, seção 4): o Administrador liga ou desliga cada indicador para
-- cada perfil — Analista e Cliente —, igual para todos os clientes.
--
-- Uma linha por (indicador, perfil). O Administrador sempre vê tudo e por isso
-- não tem linha. Indicador sem linha para o perfil é tratado como FECHADO.
--
-- Chaves dos indicadores (primeira entrega): funil, taxa_vitoria,
-- volume_periodo, familias, ganho_sobre_minimo, perdas_evitaveis, orgaos,
-- concorrentes.
--
-- Padrão inicial: tudo liberado para os dois perfis, EXCETO perdas_evitaveis
-- para o Cliente (indicador de uso interno da Salutti — regra 5 da seção 4).
--
-- SEGURANÇA: qualquer usuário autenticado pode LER a tabela (os painéis
-- precisam saber o que está liberado); somente Administrador ativo
-- (is_admin_ativo()) pode inserir, alterar ou apagar.
--
-- Esta migração só guarda a configuração. A aplicação da regra nos painéis do
-- Analista e do Cliente vem em etapa posterior.
--
-- Para desfazer:
--   drop table if exists public.relatorio_liberacao_perfil;

create table if not exists public.relatorio_liberacao_perfil (
  indicador text not null,
  perfil text not null check (perfil in ('analista', 'cliente')),
  liberado boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  primary key (indicador, perfil)
);

alter table public.relatorio_liberacao_perfil enable row level security;

drop policy if exists "relatorio_liberacao_perfil_select" on public.relatorio_liberacao_perfil;
create policy "relatorio_liberacao_perfil_select"
on public.relatorio_liberacao_perfil
for select
to authenticated
using (true);

drop policy if exists "relatorio_liberacao_perfil_insert" on public.relatorio_liberacao_perfil;
create policy "relatorio_liberacao_perfil_insert"
on public.relatorio_liberacao_perfil
for insert
to authenticated
with check (is_admin_ativo());

drop policy if exists "relatorio_liberacao_perfil_update" on public.relatorio_liberacao_perfil;
create policy "relatorio_liberacao_perfil_update"
on public.relatorio_liberacao_perfil
for update
to authenticated
using (is_admin_ativo())
with check (is_admin_ativo());

drop policy if exists "relatorio_liberacao_perfil_delete" on public.relatorio_liberacao_perfil;
create policy "relatorio_liberacao_perfil_delete"
on public.relatorio_liberacao_perfil
for delete
to authenticated
using (is_admin_ativo());

grant select, insert, update, delete on public.relatorio_liberacao_perfil to authenticated;

-- Padrão inicial (não sobrescreve o que o Administrador já tiver alterado).
insert into public.relatorio_liberacao_perfil (indicador, perfil, liberado)
values
  ('funil', 'analista', true),             ('funil', 'cliente', true),
  ('taxa_vitoria', 'analista', true),      ('taxa_vitoria', 'cliente', true),
  ('volume_periodo', 'analista', true),    ('volume_periodo', 'cliente', true),
  ('familias', 'analista', true),          ('familias', 'cliente', true),
  ('ganho_sobre_minimo', 'analista', true),('ganho_sobre_minimo', 'cliente', true),
  ('perdas_evitaveis', 'analista', true),  ('perdas_evitaveis', 'cliente', false),
  ('orgaos', 'analista', true),            ('orgaos', 'cliente', true),
  ('concorrentes', 'analista', true),      ('concorrentes', 'cliente', true)
on conflict (indicador, perfil) do nothing;
