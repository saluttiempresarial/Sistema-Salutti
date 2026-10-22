-- supabase/migrations/055_liberar_licitacao_ao_cliente.sql
--
-- Etapa 2 do plano dos Relatórios de gestão (22/10/2026), a pedido do Márcio:
-- botão "Liberar para o cliente". Daqui em diante, uma licitação só aparece
-- no Portal do Cliente depois que o Administrador ou o Analista a libera.
--
-- Depende da migração 054 (coluna licitacoes.liberada_ao_cliente_em).
--
-- O QUE ESTA MIGRAÇÃO FAZ
--
-- 1. Função liberar_licitacao_ao_cliente(p_licitacao_id, p_usuario):
--    grava a data e hora (do servidor, não do navegador) e o nome de quem
--    liberou, e registra no histórico da licitação. Só o Administrador ou o
--    funcionário com acesso à licitação (Analista da carteira) podem usá-la;
--    liberar de novo uma licitação já liberada é recusado.
--
-- 2. Regra de acesso (RLS — Row Level Security): o cliente só enxerga a
--    licitação, os itens e os grupos quando liberada_ao_cliente_em estiver
--    preenchida. Administrador e funcionários continuam vendo tudo. Como
--    o calendário, o sino, os indicadores e a lista do cliente leem essas
--    mesmas tabelas, todos passam a respeitar a liberação automaticamente.
--
-- O QUE NÃO MUDA
--   - As licitações já cadastradas continuam visíveis (a 054 preencheu a
--     data de liberação delas com a data de cadastro).
--   - As funções de decisão do cliente (participar/recusar/desistir) não
--     foram alteradas: o cliente não consegue chegar a uma licitação que
--     não enxerga.
--
-- ANTES DE RODAR: faça backup ou exporte os dados (o Supabase é de produção).
--
-- ROLLBACK (se precisar desfazer):
--   drop function if exists public.liberar_licitacao_ao_cliente(uuid, text);
--   drop policy if exists "licitacoes_select" on public.licitacoes;
--   create policy "licitacoes_select" on public.licitacoes for select to authenticated
--     using (is_admin_ativo() or funcionario_acessa_licitacao(id)
--            or funcionario_acessa_cliente(cliente_id) or cliente_acessa(cliente_id));
--   drop policy if exists itens_licitacao_select on public.itens_licitacao;
--   create policy itens_licitacao_select on public.itens_licitacao for select to authenticated
--     using (exists (select 1 from public.licitacoes l
--                     where l.id = itens_licitacao.licitacao_id
--                       and (public.is_admin_ativo() or public.funcionario_acessa_licitacao(l.id)
--                            or public.cliente_acessa(l.cliente_id))));
--   drop policy if exists grupos_itens_licitacao_select on public.grupos_itens_licitacao;
--   create policy grupos_itens_licitacao_select on public.grupos_itens_licitacao for select to authenticated
--     using (exists (select 1 from public.licitacoes l
--                     where l.id = grupos_itens_licitacao.licitacao_id
--                       and (public.is_admin_ativo() or public.funcionario_acessa_licitacao(l.id)
--                            or public.cliente_acessa(l.cliente_id))));

-- ---------------------------------------------------------------------------
-- 1. Função de liberação
-- ---------------------------------------------------------------------------
create or replace function public.liberar_licitacao_ao_cliente(
  p_licitacao_id uuid,
  p_usuario text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_liberada_em timestamptz;
begin
  if not (is_admin_ativo() or funcionario_acessa_licitacao(p_licitacao_id)) then
    raise exception 'Sem permissão para liberar esta licitação ao cliente';
  end if;

  select liberada_ao_cliente_em
    into v_liberada_em
  from licitacoes
  where id = p_licitacao_id;

  if not found then
    raise exception 'Licitação não encontrada';
  end if;

  if v_liberada_em is not null then
    raise exception 'Esta licitação já foi liberada ao cliente';
  end if;

  update licitacoes
  set liberada_ao_cliente_em = now(),
      liberada_ao_cliente_por = p_usuario
  where id = p_licitacao_id;

  insert into historico_acoes (entidade_tipo, entidade_id, descricao, usuario)
  values ('licitacao', p_licitacao_id, 'Licitação liberada ao cliente', p_usuario);
end;
$function$;

revoke all on function public.liberar_licitacao_ao_cliente(uuid, text) from public, anon;
grant execute on function public.liberar_licitacao_ao_cliente(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Regra de acesso: o cliente só vê o que foi liberado
-- ---------------------------------------------------------------------------
drop policy if exists "licitacoes_select" on public.licitacoes;
create policy "licitacoes_select"
on public.licitacoes
for select
to authenticated
using (
  is_admin_ativo()
  or funcionario_acessa_licitacao(id)
  or funcionario_acessa_cliente(cliente_id)
  or (cliente_acessa(cliente_id) and liberada_ao_cliente_em is not null)
);

drop policy if exists itens_licitacao_select on public.itens_licitacao;
create policy itens_licitacao_select
on public.itens_licitacao
for select
to authenticated
using (
  exists (
    select 1
    from public.licitacoes l
    where l.id = itens_licitacao.licitacao_id
      and (
        public.is_admin_ativo()
        or public.funcionario_acessa_licitacao(l.id)
        or (public.cliente_acessa(l.cliente_id) and l.liberada_ao_cliente_em is not null)
      )
  )
);

drop policy if exists grupos_itens_licitacao_select on public.grupos_itens_licitacao;
create policy grupos_itens_licitacao_select
on public.grupos_itens_licitacao
for select
to authenticated
using (
  exists (
    select 1
    from public.licitacoes l
    where l.id = grupos_itens_licitacao.licitacao_id
      and (
        public.is_admin_ativo()
        or public.funcionario_acessa_licitacao(l.id)
        or (public.cliente_acessa(l.cliente_id) and l.liberada_ao_cliente_em is not null)
      )
  )
);

-- ---------------------------------------------------------------------------
-- 3. Conferência — deve listar 4 linhas, todas com ok = true.
-- ---------------------------------------------------------------------------
select 'função liberar_licitacao_ao_cliente' as item,
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'liberar_licitacao_ao_cliente') as ok
union all
select 'política licitacoes_select exige liberação',
       exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'licitacoes'
                  and policyname = 'licitacoes_select'
                  and qual like '%liberada_ao_cliente_em%')
union all
select 'política itens_licitacao_select exige liberação',
       exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'itens_licitacao'
                  and policyname = 'itens_licitacao_select'
                  and qual like '%liberada_ao_cliente_em%')
union all
select 'política grupos_itens_licitacao_select exige liberação',
       exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'grupos_itens_licitacao'
                  and policyname = 'grupos_itens_licitacao_select'
                  and qual like '%liberada_ao_cliente_em%');
