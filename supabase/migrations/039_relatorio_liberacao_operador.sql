-- supabase/migrations/039_relatorio_liberacao_operador.sql
--
-- Liberação de NÍVEL 2 dos Indicadores (Especificação de Relatórios e
-- Dashboards, seção 4): o Responsável (perfil 'gestor') da empresa decide
-- quais indicadores cada Operador da própria empresa pode ver.
--
-- Regra de acesso de um Operador a um indicador:
--     liberado pelo Administrador ao perfil Cliente (nível 1, migração 037)
--     E liberado pelo Responsável àquele Operador (esta migração).
-- O Responsável vê tudo o que o Administrador liberou ao perfil Cliente.
--
-- Padrão quando o Responsável ainda não decidiu (não há linha): abertos para o
-- Operador — funil, taxa_vitoria, volume_periodo, familias, orgaos; fechados —
-- ganho_sobre_minimo, concorrentes, perdas_evitaveis. O padrão fica na função
-- relatorio_indicadores_cliente(), de modo que Operadores criados depois
-- também o recebem, sem precisar de linhas pré-gravadas.
--
-- O que esta migração faz:
--   1. Cria a tabela relatorio_liberacao_operador (uma linha por Operador e
--      indicador), com RLS: o Administrador ativo e o Responsável da MESMA
--      empresa leem e gravam; o próprio Operador só lê as suas linhas.
--   2. Cria relatorio_indicadores_cliente(): devolve a lista de chaves de
--      indicadores efetivamente liberadas ao usuário de cliente logado
--      (JSON null = sem acesso; '[]' = nada liberado).
--   3. Substitui relatorio_disputas_cliente() (migração 038): agora também
--      atende o Operador, usando a lista efetiva acima. Os campos do vencedor
--      só saem se 'concorrentes' ou 'perdas_evitaveis' estiverem liberados
--      para quem consulta.
--
-- Para desfazer:
--   drop function if exists public.relatorio_indicadores_cliente();
--   drop function if exists public.relatorio_responsavel_do_usuario(uuid);
--   drop table if exists public.relatorio_liberacao_operador;
--   (e executar novamente a migração 038 para restaurar a função anterior)

-- ---------------------------------------------------------------------------
-- 1. Tabela e regras de acesso
-- ---------------------------------------------------------------------------
create table if not exists public.relatorio_liberacao_operador (
  usuario_id uuid not null references public.usuarios_cliente(id) on delete cascade,
  indicador text not null,
  liberado boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  primary key (usuario_id, indicador)
);

-- Auxiliar: o usuário logado é Responsável ativo da empresa do usuário
-- informado, e esse usuário é um Operador? SECURITY DEFINER para não depender
-- das regras de leitura de usuarios_cliente (evita recursão nas policies).
create or replace function public.relatorio_responsavel_do_usuario(p_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from usuarios_cliente alvo
    join usuarios_cliente resp on resp.cliente_id = alvo.cliente_id
    where alvo.id = p_usuario_id
      and alvo.perfil = 'operador'
      and resp.auth_user_id = auth.uid()
      and resp.perfil = 'gestor'
      and resp.status = 'ativo'
  );
$$;

revoke all on function public.relatorio_responsavel_do_usuario(uuid) from public, anon;
grant execute on function public.relatorio_responsavel_do_usuario(uuid) to authenticated;

alter table public.relatorio_liberacao_operador enable row level security;

drop policy if exists "relatorio_liberacao_operador_select" on public.relatorio_liberacao_operador;
create policy "relatorio_liberacao_operador_select"
on public.relatorio_liberacao_operador
for select
to authenticated
using (
  is_admin_ativo()
  or relatorio_responsavel_do_usuario(usuario_id)
  or usuario_id in (select u.id from usuarios_cliente u where u.auth_user_id = auth.uid())
);

drop policy if exists "relatorio_liberacao_operador_insert" on public.relatorio_liberacao_operador;
create policy "relatorio_liberacao_operador_insert"
on public.relatorio_liberacao_operador
for insert
to authenticated
with check (is_admin_ativo() or relatorio_responsavel_do_usuario(usuario_id));

drop policy if exists "relatorio_liberacao_operador_update" on public.relatorio_liberacao_operador;
create policy "relatorio_liberacao_operador_update"
on public.relatorio_liberacao_operador
for update
to authenticated
using (is_admin_ativo() or relatorio_responsavel_do_usuario(usuario_id))
with check (is_admin_ativo() or relatorio_responsavel_do_usuario(usuario_id));

drop policy if exists "relatorio_liberacao_operador_delete" on public.relatorio_liberacao_operador;
create policy "relatorio_liberacao_operador_delete"
on public.relatorio_liberacao_operador
for delete
to authenticated
using (is_admin_ativo() or relatorio_responsavel_do_usuario(usuario_id));

grant select, insert, update, delete on public.relatorio_liberacao_operador to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Indicadores efetivamente liberados ao usuário de cliente logado
-- ---------------------------------------------------------------------------
create or replace function public.relatorio_indicadores_cliente()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_perfil text;
begin
  select u.id, u.perfil
    into v_usuario_id, v_perfil
  from usuarios_cliente u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
  limit 1;

  -- Não é usuário ativo de cliente.
  if v_usuario_id is null then
    return null;
  end if;

  return coalesce((
    select jsonb_agg(c.indicador order by c.indicador)
    from relatorio_liberacao_perfil c
    where c.perfil = 'cliente'
      and c.liberado
      and (
        v_perfil = 'gestor'
        or coalesce(
             (select o.liberado
                from relatorio_liberacao_operador o
               where o.usuario_id = v_usuario_id
                 and o.indicador = c.indicador),
             c.indicador in ('funil', 'taxa_vitoria', 'volume_periodo', 'familias', 'orgaos')
           )
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.relatorio_indicadores_cliente() from public, anon;
grant execute on function public.relatorio_indicadores_cliente() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Disputas do cliente (substitui a função da migração 038)
-- ---------------------------------------------------------------------------
create or replace function public.relatorio_disputas_cliente()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_chaves jsonb;
  v_mostrar_vencedor boolean;
begin
  select u.cliente_id
    into v_cliente_id
  from usuarios_cliente u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
  limit 1;

  -- Não é usuário ativo de cliente.
  if v_cliente_id is null then
    return null;
  end if;

  v_chaves := relatorio_indicadores_cliente();

  -- Nada liberado a este usuário.
  if v_chaves is null or jsonb_array_length(v_chaves) = 0 then
    return '[]'::jsonb;
  end if;

  v_mostrar_vencedor := v_chaves ?| array['concorrentes', 'perdas_evitaveis'];

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'licitacao_id', d.licitacao_id,
        'data_sessao_realizada', d.data_sessao_realizada,
        'resultado', d.resultado,
        'criado_em', d.criado_em,
        'atualizado_em', d.atualizado_em,
        'itens', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', di.id,
              'disputa_id', di.disputa_id,
              'item_id', di.item_id,
              'grupo_id', di.grupo_id,
              'posicao', di.posicao,
              'valor_fechado', di.valor_fechado,
              'total_fechado', di.total_fechado,
              'resultado_item', di.resultado_item,
              'valor_vencedor', case when v_mostrar_vencedor then di.valor_vencedor end,
              'nome_vencedor', case when v_mostrar_vencedor then di.nome_vencedor end,
              'criado_em', di.criado_em,
              'atualizado_em', di.atualizado_em
            )
          )
          from disputa_itens di
          where di.disputa_id = d.id
        ), '[]'::jsonb)
      )
    )
    from disputas d
    join licitacoes l on l.id = d.licitacao_id
    where l.cliente_id = v_cliente_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.relatorio_disputas_cliente() from public, anon;
grant execute on function public.relatorio_disputas_cliente() to authenticated;
