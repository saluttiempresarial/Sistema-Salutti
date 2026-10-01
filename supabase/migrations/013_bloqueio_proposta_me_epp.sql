-- 013_bloqueio_proposta_me_epp.sql
--
-- Regra de negócio: um item marcado como exclusivo ME/EPP
-- (itens_licitacao.exclusivo_me_epp = true) só pode receber proposta de
-- um cliente cujo porte também seja ME/EPP. Uma empresa "Demais" enviando
-- proposta num item exclusivo é uma participação irregular (o cliente
-- trouxe um caso real disso acontecendo por engano numa licitação).
--
-- A validação entra na função que já existe (atualizar_proposta_item_cliente,
-- criada em 009_rpc_cliente_escrita_restrita.sql) — ela já é o único
-- caminho de escrita da Proposta Comercial pelo Cliente, então o bloqueio
-- vale de verdade (não é só uma trava na tela).

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
begin
  select licitacao_id, exclusivo_me_epp into v_licitacao_id, v_exclusivo_me_epp
  from itens_licitacao
  where id = p_item_id;

  if v_licitacao_id is null then
    raise exception 'Item não encontrado';
  end if;

  if not exists (
    select 1 from licitacoes l
    where l.id = v_licitacao_id
    and (is_admin_ativo() or cliente_acessa(l.cliente_id))
  ) then
    raise exception 'Sem permissão para editar a proposta deste item';
  end if;

  -- Bloqueio ME/EPP: só se aplica quando quem está chamando é o próprio
  -- Cliente (não bloqueia o Admin editando em nome de ninguém).
  if not is_admin_ativo() and v_exclusivo_me_epp then
    select l.cliente_id into v_cliente_id from licitacoes l where l.id = v_licitacao_id;
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
