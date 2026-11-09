-- supabase/migrations/064_motivos_multiplos_nao_participacao.sql
--
-- Permite ao Cliente marcar MAIS DE UM motivo ao clicar em "Não vou participar".
--
-- Como funciona:
--   * A coluna antiga `motivo_nao_participacao` continua guardando o motivo
--     PRINCIPAL (o primeiro da lista marcada). Os indicadores continuam
--     contando uma licitação por motivo principal, sem mudar nenhum número.
--   * A nova coluna `motivos_nao_participacao` (lista) guarda TODOS os motivos.
--   * registrar_decisao_cliente NÃO muda. Depois dela, o sistema chama a nova
--     função registrar_motivos_nao_participacao quando há mais de um motivo.
--   * Gatilho: se o motivo principal for apagado (cliente desistiu, decisão
--     reaberta etc.), a lista é apagada junto.
--
-- ORDEM: rode esta migração ANTES de publicar os arquivos novos do sistema.
--
-- Para desfazer:
--   drop trigger if exists trg_limpar_motivos_nao_participacao on public.licitacoes;
--   drop function if exists public.limpar_motivos_nao_participacao();
--   drop function if exists public.registrar_motivos_nao_participacao(uuid, text[], text);
--   alter table public.licitacoes drop column if exists motivos_nao_participacao;

alter table public.licitacoes add column if not exists motivos_nao_participacao text[];

create or replace function public.limpar_motivos_nao_participacao()
returns trigger
language plpgsql
as $$
begin
  if new.motivo_nao_participacao is null then
    new.motivos_nao_participacao := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limpar_motivos_nao_participacao on public.licitacoes;
create trigger trg_limpar_motivos_nao_participacao
  before insert or update on public.licitacoes
  for each row execute function public.limpar_motivos_nao_participacao();

create or replace function public.registrar_motivos_nao_participacao(
  p_licitacao_id uuid,
  p_motivos text[],
  p_usuario text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_validos constant text[] := array[
    'preco_referencia_baixo', 'margem_insuficiente', 'prazo_entrega', 'frete_distancia',
    'produto_nao_trabalha', 'especificacao_nao_atende', 'fornecedor_nao_localizado', 'outro'
  ];
  v_motivo text;
  v_rotulos text[] := '{}';
  v_decisao text;
  v_explicacao text;
begin
  if not exists (
    select 1 from licitacoes l
    where l.id = p_licitacao_id
    and (is_admin_ativo() or funcionario_acessa_licitacao(p_licitacao_id) or cliente_acessa(l.cliente_id))
  ) then
    raise exception 'Sem permissão para registrar motivos nesta licitação';
  end if;

  select decisao_cliente, motivo_recusa_cliente
    into v_decisao, v_explicacao
  from licitacoes where id = p_licitacao_id;

  if v_decisao is distinct from 'recusar' then
    raise exception 'A licitação não está com decisão de não participar';
  end if;

  if p_motivos is null or array_length(p_motivos, 1) is null then
    raise exception 'Informe ao menos um motivo';
  end if;

  foreach v_motivo in array p_motivos loop
    if not (v_motivo = any (v_validos)) then
      raise exception 'Motivo inválido: %', v_motivo;
    end if;
    v_rotulos := v_rotulos || case v_motivo
      when 'preco_referencia_baixo' then 'Preço de referência baixo'
      when 'margem_insuficiente' then 'Margem insuficiente'
      when 'prazo_entrega' then 'Prazo de entrega'
      when 'frete_distancia' then 'Frete ou distância'
      when 'produto_nao_trabalha' then 'Produto não trabalhado'
      when 'especificacao_nao_atende' then 'Especificação não atendida'
      when 'fornecedor_nao_localizado' then 'Fornecedor não localizado'
      else 'Outro'
    end;
  end loop;

  if 'outro' = any (p_motivos) and btrim(coalesce(v_explicacao, '')) = '' then
    raise exception 'Explique o motivo escolhido como "Outro"';
  end if;

  update licitacoes
     set motivos_nao_participacao = (select array_agg(distinct m) from unnest(p_motivos) m)
   where id = p_licitacao_id;

  insert into historico_acoes (entidade_tipo, entidade_id, descricao, usuario)
  values ('licitacao', p_licitacao_id,
          'Motivos informados para não participar: ' || array_to_string(v_rotulos, '; '),
          p_usuario);
end;
$function$;

grant execute on function public.registrar_motivos_nao_participacao(uuid, text[], text) to authenticated;
