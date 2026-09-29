-- supabase/023_liberar_prazo_proposta_cliente.sql
--
-- A pedido do Márcio (29/09): depois que o prazo automático do Cliente (4
-- dias úteis antes da sessão, 18h30 — ver DIAS_UTEIS_LIMITE_EDICAO_PROPOSTA_CLIENTE
-- em src/utils/licitacaoCalculos.ts) vence, só o Admin pode liberar a
-- licitação de novo para o Cliente editar a Proposta Comercial. Liberação
-- manual, sem novo prazo fixo — fica liberado até o Admin travar de novo.
--
-- Atualização (29/09, mesmo dia): a liberação manual tem um teto — até no
-- máximo 2 dias úteis antes da sessão, 18h30 (DIAS_UTEIS_LIMITE_MAXIMO_LIBERACAO
-- em licitacaoCalculos.ts). Depois desse ponto nem o Admin consegue mais
-- liberar pro Cliente, só preencher a proposta ele mesmo — por isso a
-- função também valida esse limite no banco (não só na tela), pra ninguém
-- conseguir liberar depois do prazo chamando a API direto.
--
-- Função restrita a is_admin_ativo() apenas (nunca funcionario_acessa_licitacao)
-- — Funcionário não pode liberar/travar, só visualizar, conforme pedido.

alter table public.licitacoes
  add column if not exists prazo_proposta_liberado boolean not null default false;

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
  p_usuario text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data_sessao timestamptz;
  v_limite_maximo timestamptz;
begin
  if not is_admin_ativo() then
    raise exception 'Somente o Administrador pode liberar ou travar o prazo do Cliente';
  end if;

  if p_liberar then
    select coalesce(data_efetiva_licitacao, data_licitacao) into v_data_sessao
    from licitacoes
    where id = p_licitacao_id;

    if v_data_sessao is null then
      raise exception 'Licitação não encontrada';
    end if;

    v_limite_maximo := date_trunc('day', subtrair_dias_uteis(v_data_sessao, 2)) + interval '18 hours 30 minutes';

    if now() > v_limite_maximo then
      raise exception 'Prazo máximo para liberar (2 dias úteis antes da sessão) já passou — só é possível preencher a proposta diretamente';
    end if;
  end if;

  update licitacoes
  set prazo_proposta_liberado = p_liberar
  where id = p_licitacao_id;

  insert into historico_acoes (entidade_tipo, entidade_id, descricao, usuario)
  values (
    'licitacao',
    p_licitacao_id,
    case
      when p_liberar then 'Liberou manualmente o prazo para o Cliente editar a proposta'
      else 'Travou novamente o prazo do Cliente'
    end,
    p_usuario
  );
end;
$$;
