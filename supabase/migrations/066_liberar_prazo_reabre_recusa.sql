-- supabase/migrations/066_liberar_prazo_reabre_recusa.sql
--
-- Cliente que RECUSOU a licitação e depois recebe uma nova data/hora liberada
-- pelo Administrador/Analista: a decisão é reaberta automaticamente. A licitação
-- volta para "Aguardando decisão" e o Cliente vê de novo o botão "Quero
-- Participar". O motivo da recusa anterior fica registrado no histórico.
--
-- Muda só `liberar_prazo_proposta_cliente` (versão da migração 057), acrescentando
-- a reabertura quando p_liberar = true e a decisão está como 'recusar'. Todo o
-- resto (permissões, trava absoluta, contador de liberações) é idêntico.
--
-- ORDEM: rode esta migração ANTES de publicar os arquivos novos do sistema.
--
-- Para desfazer: rode de novo o trecho "create or replace function
-- public.liberar_prazo_proposta_cliente" da migração 057.

create or replace function public.liberar_prazo_proposta_cliente(
  p_licitacao_id uuid,
  p_liberar boolean,
  p_usuario text,
  p_liberado_ate timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data_sessao timestamptz;
  v_limite_absoluto timestamptz;
  v_limite_normal timestamptz;
  v_apos_prazo_normal boolean := false;
  v_decisao text;
  v_motivos text;
  v_reabriu boolean := false;
begin
  if not (is_admin_ativo() or funcionario_acessa_licitacao(p_licitacao_id)) then
    raise exception 'Você não tem permissão para liberar ou travar o prazo do Cliente';
  end if;

  if p_liberar then
    if p_liberado_ate is null then
      raise exception 'Informe até que data/hora a liberação deve valer';
    end if;

    select coalesce(data_efetiva_licitacao, data_licitacao), decisao_cliente
      into v_data_sessao, v_decisao
    from licitacoes
    where id = p_licitacao_id;

    if v_data_sessao is null then
      raise exception 'Licitação não encontrada';
    end if;

    v_limite_absoluto := date_trunc('day', subtrair_dias_uteis(v_data_sessao, 1)) + interval '18 hours 30 minutes';

    if now() > v_limite_absoluto then
      raise exception 'Prazo encerrado definitivamente (1 dia útil antes da sessão, 18h30) — a Proposta Comercial só pode ser preenchida até lá';
    end if;

    if p_liberado_ate <= now() then
      raise exception 'A data/hora de liberação precisa ser no futuro';
    end if;

    if p_liberado_ate > v_limite_absoluto then
      raise exception 'A data/hora de liberação não pode passar de 1 dia útil antes da sessão, 18h30';
    end if;

    -- Contador de liberações (057): só conta quando o prazo normal do Cliente
    -- (4 dias úteis antes da sessão, 18h30) JÁ tinha encerrado.
    v_limite_normal := date_trunc('day', subtrair_dias_uteis(v_data_sessao, 4)) + interval '18 hours 30 minutes';
    v_apos_prazo_normal := now() > v_limite_normal;

    -- Reabertura (066): o Cliente tinha recusado -> volta a "Aguardando decisão".
    if v_decisao = 'recusar' then
      v_reabriu := true;
      select coalesce(
               (select string_agg(
                  case m
                    when 'preco_referencia_baixo' then 'Preço de referência baixo'
                    when 'margem_insuficiente' then 'Margem insuficiente'
                    when 'prazo_entrega' then 'Prazo de entrega'
                    when 'frete_distancia' then 'Frete ou distância'
                    when 'produto_nao_trabalha' then 'Produto não trabalhado'
                    when 'especificacao_nao_atende' then 'Especificação não atendida'
                    when 'fornecedor_nao_localizado' then 'Fornecedor não localizado'
                    when 'outro' then 'Outro'
                    else m
                  end, '; ')
                from unnest(coalesce(motivos_nao_participacao, array[motivo_nao_participacao])) as m
                where m is not null),
               'sem motivo informado')
        into v_motivos
      from licitacoes
      where id = p_licitacao_id;
    end if;
  end if;

  update licitacoes
  set
    prazo_proposta_liberado = p_liberar,
    prazo_proposta_liberado_ate = case when p_liberar then p_liberado_ate else null end,
    prazo_liberacoes_qtd = prazo_liberacoes_qtd + case when v_apos_prazo_normal then 1 else 0 end,
    decisao_cliente = case when v_reabriu then 'pendente' else decisao_cliente end,
    decisao_cliente_em = case when v_reabriu then null else decisao_cliente_em end,
    motivo_recusa_cliente = case when v_reabriu then null else motivo_recusa_cliente end,
    motivo_nao_participacao = case when v_reabriu then null else motivo_nao_participacao end
  where id = p_licitacao_id;

  insert into historico_acoes (entidade_tipo, entidade_id, descricao, usuario)
  values (
    'licitacao',
    p_licitacao_id,
    case
      when p_liberar then 'Liberou manualmente o prazo para o Cliente editar a proposta até ' || to_char(p_liberado_ate, 'DD/MM/YYYY HH24:MI')
        || case when v_reabriu then ' — o Cliente havia recusado (' || v_motivos || '); a decisão foi reaberta' else '' end
      else 'Travou novamente o prazo do Cliente'
    end,
    p_usuario
  );
end;
$$;
