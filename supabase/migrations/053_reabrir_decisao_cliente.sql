-- supabase/migrations/053_reabrir_decisao_cliente.sql
--
-- "Reabrir decisão" (pedido do Márcio em 20/10): quando o cliente clica em
-- "Não vou participar" por engano, ele não consegue desfazer sozinho. Esta
-- função permite que SOMENTE o Administrador anule a recusa: a licitação volta
-- para "Aguardando decisão" (pendente) e o cliente pode escolher de novo.
--
-- O que ela faz:
--   - só funciona se a decisão atual for "recusar" (para anular uma
--     participação já confirmada continua valendo "Desistir", do cliente);
--   - limpa a data da decisão, o motivo padronizado e a explicação em texto;
--   - não mexe em itens, proposta, prazo nem no status da licitação;
--   - grava no histórico quem reabriu e qual era o motivo anterior.
-- Se o prazo do cliente já tiver encerrado, depois de reabrir o Administrador
-- ainda pode liberar o prazo na tela da Proposta Comercial.
--
-- Para desfazer:
--   drop function if exists public.reabrir_decisao_cliente(uuid, text);

create or replace function public.reabrir_decisao_cliente(
  p_licitacao_id uuid,
  p_usuario text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_decisao text;
  v_motivo text;
begin
  if not is_admin_ativo() then
    raise exception 'Somente o Administrador pode reabrir a decisão do cliente';
  end if;

  select decisao_cliente, motivo_nao_participacao
    into v_decisao, v_motivo
  from licitacoes
  where id = p_licitacao_id;

  if not found then
    raise exception 'Licitação não encontrada';
  end if;

  if v_decisao is distinct from 'recusar' then
    raise exception 'A decisão do cliente nesta licitação não é uma recusa';
  end if;

  update licitacoes
  set
    decisao_cliente = 'pendente',
    decisao_cliente_em = null,
    motivo_recusa_cliente = null,
    motivo_nao_participacao = null
  where id = p_licitacao_id;

  insert into historico_acoes (entidade_tipo, entidade_id, descricao, usuario)
  values (
    'licitacao',
    p_licitacao_id,
    'Administrador reabriu a decisão do cliente (a recusa anterior foi anulada)'
      || coalesce(' — motivo anterior: ' || v_motivo, ''),
    p_usuario
  );
end;
$function$;

revoke all on function public.reabrir_decisao_cliente(uuid, text) from public, anon;
grant execute on function public.reabrir_decisao_cliente(uuid, text) to authenticated;

-- Conferência: deve listar 1 linha (a função, com 2 parâmetros).
select p.proname as funcao, p.pronargs as parametros
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'reabrir_decisao_cliente';
