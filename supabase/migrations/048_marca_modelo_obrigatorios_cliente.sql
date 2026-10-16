-- supabase/migrations/048_marca_modelo_obrigatorios_cliente.sql
--
-- A pedido do Márcio (15/10 e 16/10): uma licitação nunca pode ser concorrida
-- sem marca/fabricante e modelo/versão do produto. Quem preenche é o Cliente
-- (a equipe só mexe nisso, raramente, quando o cliente decide participar de um
-- item depois). A tela já exige os dois campos ao salvar a proposta; esta
-- migração faz o BANCO exigir também, para que nenhuma tela, versão antiga do
-- sistema ou chamada direta consiga gravar um item com valor e sem marca ou
-- sem modelo — por QUALQUER perfil (Cliente, Analista ou Administrador).
--
-- Função alterada: atualizar_proposta_item_cliente (a única que grava os
-- campos proposta_* dos itens). A definição parte da versão da migração 045
-- (trava definitiva só para o Administrador) e acrescenta somente a checagem
-- abaixo, depois do bloqueio ME/EPP e antes do UPDATE:
--
--   - Item COM valor e sem marca ou sem modelo (vazio ou só espaços), por
--     qualquer perfil: erro "Informe a marca/fabricante e o modelo/versão de
--     todos os itens com valor preenchido".
--   - Item SEM valor: nada é exigido (o cliente pode não cotar o item).
--
-- Atenção: a tela envia todos os itens da licitação de uma vez. Se existir um
-- item antigo com valor e sem marca/modelo, o salvamento da proposta (por
-- qualquer perfil) é recusado até que ele seja completado ou tenha o valor
-- apagado. Hoje isso só afeta dados de teste; o alerta "Falta marca/modelo"
-- continua útil para localizar esses casos.
--
-- Não altera dados já gravados, prazos, trava definitiva, ME/EPP nem RLS.
--
-- Para desfazer: execute de novo a função da migração 045
-- (atualizar_proposta_item_cliente).

CREATE OR REPLACE FUNCTION public.atualizar_proposta_item_cliente(p_item_id uuid, p_codigo_interno text, p_descricao_produto text, p_marca text, p_modelo text, p_preco_minimo numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- 1. Trava absoluta — depois dela, SOMENTE o Administrador grava
  -- (migração 045). Analista e Cliente continuam bloqueados.
  v_limite_absoluto := date_trunc('day', subtrair_dias_uteis(v_data_sessao, 1)) + interval '18 hours 30 minutes';
  if now() > v_limite_absoluto and not is_admin_ativo() then
    raise exception 'Prazo encerrado definitivamente (1 dia útil antes da sessão, 18h30) — somente o Administrador pode editar esta proposta';
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

  -- Marca/fabricante e modelo/versão são obrigatórios em todo item com valor
  -- (migração 048). Vale para todos os perfis. Item sem valor (que o cliente
  -- decidiu não cotar) não exige nada.
  if p_preco_minimo is not null
     and (nullif(btrim(coalesce(p_marca, '')), '') is null
          or nullif(btrim(coalesce(p_modelo, '')), '') is null) then
    raise exception 'Informe a marca/fabricante e o modelo/versão de todos os itens com valor preenchido';
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
$function$;


-- Conferência (deve devolver true):
select p.prosrc ilike '%marca/fabricante e o modelo/versão%' as exige_marca_modelo
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'atualizar_proposta_item_cliente';
