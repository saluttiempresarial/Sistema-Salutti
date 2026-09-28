-- 019_desistir_licitacao_cliente.sql
--
-- Botão "Desistir da licitação" na tela de Proposta Comercial do Cliente
-- (PropostaComercialPage — Portal do Cliente): com confirmação ("Tem
-- certeza?"), apaga toda a proposta comercial já preenchida pelo Cliente
-- para essa licitação e volta a decisão do cliente para "pendente" — como
-- se ele nunca tivesse clicado em "Quero Participar". NÃO apaga a
-- licitação em si nem os itens de referência cadastrados pelo Analista
-- (Informações Gerais, Habilitação, Declarações, Cond. Comerciais, Outras
-- Exigências, Itens de referência) — só os dados que o próprio Cliente
-- preencheu. Ação irreversível (a tela avisa isso antes de confirmar).
--
-- Passa por uma função no banco (como registrar_decisao_cliente e
-- atualizar_proposta_item_cliente, em vez de UPDATE direto) para o Cliente
-- não precisar de permissão de escrita direta nas colunas de referência
-- nem em historico_acoes.

create or replace function public.desistir_licitacao_cliente(
  p_licitacao_id uuid,
  p_usuario text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from licitacoes l
    where l.id = p_licitacao_id
    and (is_admin_ativo() or cliente_acessa(l.cliente_id))
  ) then
    raise exception 'Sem permissão para desistir desta licitação';
  end if;

  -- Apaga a proposta comercial preenchida pelo Cliente em cada item —
  -- mantém intactos os campos de referência (descricao, preco_referencia
  -- etc.), que são do Analista, não do Cliente.
  update itens_licitacao
  set
    proposta_codigo_interno = null,
    proposta_descricao = null,
    proposta_marca = null,
    proposta_modelo = null,
    proposta_preco_minimo = null
  where licitacao_id = p_licitacao_id;

  update licitacoes
  set
    decisao_cliente = 'pendente',
    decisao_cliente_em = null,
    motivo_recusa_cliente = null,
    cobrar_frete = false,
    percentual_frete = null,
    status_proposta = 'rascunho'
  where id = p_licitacao_id;

  insert into historico_acoes (entidade_tipo, entidade_id, descricao, usuario)
  values ('licitacao', p_licitacao_id, 'Cliente desistiu da licitação — proposta comercial apagada', p_usuario);
end;
$$;
