-- supabase/migrations/046_relatorio_liberacao_analista.sql
--
-- Liberação de indicadores POR ANALISTA (pedido do Márcio, 15/10): hoje a
-- coluna "Analista" de Configurações vale para todos os analistas ao mesmo
-- tempo. Esta migração permite que o Administrador defina exceções para um
-- analista específico (ex.: o Thales vê um conjunto e a Michelle outro).
--
-- Regra (por analista e indicador):
--     se existe linha em relatorio_liberacao_analista -> vale a linha
--     senão                                           -> vale o padrão da
--         coluna "Analista" (relatorio_liberacao_perfil, migração 037)
-- Ou seja, a tabela guarda só as EXCEÇÕES. Analista novo entra com o padrão,
-- sem nenhuma configuração. "Voltar ao padrão" = apagar as linhas dele.
-- A exceção vale nos dois sentidos: pode abrir um indicador que o padrão
-- fecha, ou fechar um que o padrão abre. Quem configura é só o Administrador.
--
-- O Administrador continua vendo todos os indicadores, sem depender disto.
--
-- O que esta migração faz:
--   1. Cria a tabela relatorio_liberacao_analista com RLS: o Administrador
--      ativo lê e grava; o próprio analista só lê as suas linhas.
--   2. Cria relatorio_indicadores_analista(): devolve a lista de chaves
--      efetivamente liberadas ao analista logado (JSON null = não é
--      analista ativo; '[]' = nada liberado). A tela de Indicadores do
--      analista passa a usar esta função (próxima etapa).
--
-- Nenhum dado existente é alterado. Sem linhas na tabela, todos os analistas
-- continuam vendo exatamente o que veem hoje.
--
-- Atenção: isto controla o que o analista vê na tela de Indicadores. Não é
-- uma barreira de dados: o analista continua acessando as licitações e
-- disputas da carteira dele pelas demais telas, como já era.
--
-- Para desfazer:
--   drop function if exists public.relatorio_indicadores_analista();
--   drop table if exists public.relatorio_liberacao_analista;

create table if not exists public.relatorio_liberacao_analista (
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  indicador text not null,
  liberado boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  primary key (funcionario_id, indicador)
);

alter table public.relatorio_liberacao_analista enable row level security;

drop policy if exists "relatorio_liberacao_analista_select" on public.relatorio_liberacao_analista;
create policy "relatorio_liberacao_analista_select"
on public.relatorio_liberacao_analista
for select
to authenticated
using (
  is_admin_ativo()
  or funcionario_id in (select f.id from public.funcionarios f where f.auth_user_id = auth.uid())
);

drop policy if exists "relatorio_liberacao_analista_insert" on public.relatorio_liberacao_analista;
create policy "relatorio_liberacao_analista_insert"
on public.relatorio_liberacao_analista
for insert
to authenticated
with check (is_admin_ativo());

drop policy if exists "relatorio_liberacao_analista_update" on public.relatorio_liberacao_analista;
create policy "relatorio_liberacao_analista_update"
on public.relatorio_liberacao_analista
for update
to authenticated
using (is_admin_ativo())
with check (is_admin_ativo());

drop policy if exists "relatorio_liberacao_analista_delete" on public.relatorio_liberacao_analista;
create policy "relatorio_liberacao_analista_delete"
on public.relatorio_liberacao_analista
for delete
to authenticated
using (is_admin_ativo());

grant select, insert, update, delete on public.relatorio_liberacao_analista to authenticated;

-- Indicadores efetivamente liberados ao analista logado.
create or replace function public.relatorio_indicadores_analista()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select f.id
    into v_id
  from funcionarios f
  where f.auth_user_id = auth.uid()
    and f.perfil = 'funcionario'
    and f.status = 'ativo'
  limit 1;

  -- Não é analista ativo.
  if v_id is null then
    return null;
  end if;

  return coalesce((
    select jsonb_agg(s.chave order by s.chave)
    from (
      -- Padrão da coluna "Analista", menos o que foi fechado para ele.
      select p.indicador as chave
        from relatorio_liberacao_perfil p
       where p.perfil = 'analista'
         and p.liberado
         and not exists (
           select 1 from relatorio_liberacao_analista a
            where a.funcionario_id = v_id
              and a.indicador = p.indicador
              and not a.liberado
         )
      union
      -- Mais o que foi aberto só para ele.
      select a.indicador
        from relatorio_liberacao_analista a
       where a.funcionario_id = v_id
         and a.liberado
    ) s
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.relatorio_indicadores_analista() from public, anon;
grant execute on function public.relatorio_indicadores_analista() to authenticated;

-- Conferência: a tabela existe, vazia, e a função foi criada.
select
  (select count(*) from public.relatorio_liberacao_analista) as excecoes_gravadas,
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'relatorio_indicadores_analista'
  ) as funcao_criada;
