-- supabase/024_reforcar_prazo_proposta_no_banco.sql
--
-- A pedido do Márcio (30/09): a função que realmente grava os campos da
-- Proposta Comercial (atualizar_proposta_item_cliente, criada na migração
-- 017) ainda usava uma regra de prazo antiga e incompleta:
--   - 3 dias CORRIDOS fixos (não os 4 dias ÚTEIS + liberação manual que
--     o resto do sistema já usa desde 28-29/09);
--   - deixava o Admin gravar sem checar prazo nenhum (nem a trava
--     absoluta de 1 dia útil antes da sessão, 18h30, criada em 29/09);
--   - não reconhecia o Analista (funcionario_acessa_licitacao) — só
--     Admin ou o próprio Cliente passavam na checagem de permissão.
--
-- Esta migração reescreve essa função pra ficar 100% alinhada com
-- podeEditarPropostaCliente() / podeAdminPreencherPropostaDiretamente()
-- em src/utils/licitacaoCalculos.ts — a trava deixa de ser só de
-- aparência (a tela escondia os campos, mas uma chamada direta à API
-- ainda conseguia gravar).
--
-- Regras aplicadas AQUI, na mesma ordem da lógica do front-end:
--   1. Trava ABSOLUTA (1 dia útil antes da sessão, 18h30): a partir daí,
--      NINGUÉM grava mais — nem Admin, nem Analista, nem Cliente. Sem
--      exceção, mesmo com liberação manual ativa.
--   2. Antes da trava absoluta, o Admin e o Analista (com carteira sobre
--      a licitação) sempre podem gravar.
--   3. O Cliente só grava dentro do prazo normal (4 dias úteis antes da
--      sessão, 18h30) OU dentro de uma liberação manual ativa
--      (prazo_proposta_liberado = true e now() <= prazo_proposta_liberado_ate).
--
-- Depende de subtrair_dias_uteis(), criada na migração 023 — rode a 023
-- antes desta.

create or replace function public.atualizar_proposta_item_cliente(
  p_item_id uuid,
  p_codigo_interno text,
  p_descricao_produto text,
  p_marca text,
  p_modelo text,
  p_preco_minimo numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_licitacao_id uuid;
  v_exclusivo_me_epp boolean;
  v_cliente_id uuid;
  v_porte_cliente text;
  v_data_sessao timestamptz;
  v_limite_absoluto timestamptz;
  v_limite_normal timestamptz;
  v_prazo_liberado boolean;
  v_prazo_liberado_ate timestamptz;
  v_eh_staff boolean;
begin
  select licitacao_id, exclusivo_me_epp into v_licitacao_id, v_exclusivo_me_epp
  from itens_licitacao
  where id = p_item_id;

  if v_licitacao_id is null then
    raise exception 'Item não encontrado';
  end if;

  select cliente_id, coalesce(data_efetiva_licitacao, data_licitacao),
         prazo_proposta_liberado, prazo_proposta_liberado_ate
    into v_cliente_id, v_data_sessao, v_prazo_liberado, v_prazo_liberado_ate
  from licitacoes
  where id = v_licitacao_id;

  v_eh_staff := is_admin_ativo() or funcionario_acessa_licitacao(v_licitacao_id);

  if not (v_eh_staff or cliente_acessa(v_cliente_id)) then
    raise exception 'Sem permissão para editar a proposta deste item';
  end if;

  -- 1. Trava absoluta — vale pra todo mundo, sem exceção.
  v_limite_absoluto := date_trunc('day', subtrair_dias_uteis(v_data_sessao, 1)) + interval '18 hours 30 minutes';
  if now() > v_limite_absoluto then
    raise exception 'Prazo encerrado definitivamente (1 dia útil antes da sessão, 18h30) — ninguém pode mais editar esta proposta';
  end if;

  -- 2. Antes da trava absoluta, Admin/Analista sempre podem gravar. Só o
  -- Cliente tem uma checagem adicional (prazo normal ou liberação manual).
  if not v_eh_staff then
    v_limite_normal := date_trunc('day', subtrair_dias_uteis(v_data_sessao, 4)) + interval '18 hours 30 minutes';

    if not (
      now() <= v_limite_normal
      or (coalesce(v_prazo_liberado, false) and v_prazo_liberado_ate is not null and now() <= v_prazo_liberado_ate)
    ) then
      raise exception 'O prazo para editar a proposta já encerrou (4 dias úteis antes da sessão, 18h30) — peça à Salutti para liberar novamente';
    end if;
  end if;

  -- Bloqueio ME/EPP: só se aplica quando quem está chamando é o próprio
  -- Cliente (não bloqueia Admin/Analista editando em nome de ninguém).
  if not v_eh_staff and v_exclusivo_me_epp then
    select porte into v_porte_cliente from clientes where id = v_cliente_id;

    if v_porte_cliente is distinct from 'me_epp' then
      raise exception 'Este item é exclusivo para participação de empresas ME/EPP';
    end if;
  end if;

  update itens_licitacao
  set
    proposta_codigo_interno = p_codigo_interno,
    proposta_descricao = p_descricao_produto,
    proposta_marca = p_marca,
    proposta_modelo = p_modelo,
    proposta_preco_minimo = p_preco_minimo
  where id = p_item_id;
end;
$$;
