-- supabase/023_liberar_prazo_proposta_cliente.sql
--
-- A pedido do Márcio (29/09): depois que o prazo automático do Cliente (4
-- dias úteis antes da sessão, 18h30 — ver DIAS_UTEIS_LIMITE_EDICAO_PROPOSTA_CLIENTE
-- em src/utils/licitacaoCalculos.ts) vence, só o Admin pode liberar a
-- licitação de novo para o Cliente editar a Proposta Comercial.
--
-- Atualização (29/09, mesmo dia): em vez de um limite fixo de dias, quem
-- libera escolhe, na hora, até que data/hora a liberação vale
-- (`p_liberado_ate`). Passado esse instante, o Cliente volta a ficar
-- bloqueado automaticamente (ver podeEditarPropostaCliente em
-- licitacaoCalculos.ts) — sem precisar travar manualmente, embora isso
-- também seja possível.
--
-- Atualização (29/09, mesmo dia, novo pedido): o Analista (Funcionário)
-- também pode liberar/travar essa data agora — não é mais exclusivo do
-- Admin. Usa o mesmo padrão de permissão já aplicado em outras tabelas
-- ligadas à licitação (is_admin_ativo() OR funcionario_acessa_licitacao(),
-- que já embute a checagem de carteira do Analista).
--
-- Atualização (29/09, mesmo dia, novo pedido): trava ABSOLUTA — a partir
-- de 1 dia ÚTIL antes da sessão, às 18h30, NINGUÉM mais preenche a
-- Proposta Comercial, nem Admin nem Analista preenchendo direto, nem uma
-- liberação manual (mesma constante DIAS_UTEIS_LIMITE_ABSOLUTO_PROPOSTA do
-- front-end). A liberação, portanto, nunca pode valer além desse ponto —
-- validado aqui no banco também, não só na tela.

alter table public.licitacoes
  add column if not exists prazo_proposta_liberado boolean not null default false;

alter table public.licitacoes
  add column if not exists prazo_proposta_liberado_ate timestamptz;

-- Subtrai `p_dias` dias ÚTEIS de `p_data` (pula sábado e domingo — mesma
-- regra do lado do front-end em licitacaoCalculos.ts; feriados não entram).
create or replace function public.subtrair_dias_uteis(p_data timestamptz, p_dias int)
returns timestamptz
language plpgsql
immutable
as $$
declare
  resultado timestamptz := p_data;
  restantes int := p_dias;
begin
  while restantes > 0 loop
    resultado := resultado - interval '1 day';
    if extract(dow from resultado) not in (0, 6) then
      restantes := restantes - 1;
    end if;
  end loop;
  return resultado;
end;
$$;

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
begin
  if not (is_admin_ativo() or funcionario_acessa_licitacao(p_licitacao_id)) then
    raise exception 'Você não tem permissão para liberar ou travar o prazo do Cliente';
  end if;

  if p_liberar then
    if p_liberado_ate is null then
      raise exception 'Informe até que data/hora a liberação deve valer';
    end if;

    select coalesce(data_efetiva_licitacao, data_licitacao) into v_data_sessao
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
  end if;

  update licitacoes
  set
    prazo_proposta_liberado = p_liberar,
    prazo_proposta_liberado_ate = case when p_liberar then p_liberado_ate else null end
  where id = p_licitacao_id;

  insert into historico_acoes (entidade_tipo, entidade_id, descricao, usuario)
  values (
    'licitacao',
    p_licitacao_id,
    case
      when p_liberar then 'Liberou manualmente o prazo para o Cliente editar a proposta até ' || to_char(p_liberado_ate, 'DD/MM/YYYY HH24:MI')
      else 'Travou novamente o prazo do Cliente'
    end,
    p_usuario
  );
end;
$$;
