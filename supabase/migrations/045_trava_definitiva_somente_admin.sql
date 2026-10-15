-- supabase/migrations/045_trava_definitiva_somente_admin.sql
--
-- A pedido do Márcio (15/10): depois do "Prazo encerrado definitivamente"
-- (1 dia útil antes da sessão, 18h30), SOMENTE o Administrador pode mexer na
-- Proposta Comercial. Antes, a trava valia para todos, inclusive o Admin.
--
-- Funções alteradas (as duas únicas que gravam depois da trava):
--   1. atualizar_proposta_item_cliente — edição da proposta por item
--   2. registrar_decisao_cliente       — confirmar participação ("participar")
--      (recusar continua livre a qualquer momento, como já era)
--
-- Nada mais muda: Analista e Cliente continuam bloqueados depois da trava; o
-- prazo normal do Cliente (4 dias úteis) e a liberação manual não mudam; a
-- função liberar_prazo_proposta_cliente não muda (a liberação para o Cliente
-- continua não podendo passar da trava); o bloqueio ME/EPP não muda.
-- As definições abaixo partem das funções que estão hoje no banco.
--
-- Para desfazer: execute de novo as funções das migrações 024
-- (atualizar_proposta_item_cliente) e 025 (registrar_decisao_cliente).

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

CREATE OR REPLACE FUNCTION public.registrar_decisao_cliente(p_licitacao_id uuid, p_decisao text, p_usuario text, p_motivo_recusa text, p_cobrar_frete boolean, p_percentual_frete numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_descricao text;
  v_cliente_id uuid;
  v_porte_cliente text;
  v_data_sessao timestamptz;
  v_limite_absoluto timestamptz;
  v_limite_normal timestamptz;
  v_prazo_liberado boolean;
  v_prazo_liberado_ate timestamptz;
  v_eh_staff boolean;
begin
  if not exists (
    select 1 from licitacoes l
    where l.id = p_licitacao_id
    and (is_admin_ativo() or funcionario_acessa_licitacao(p_licitacao_id) or cliente_acessa(l.cliente_id))
  ) then
    raise exception 'Sem permissão para registrar decisão nesta licitação';
  end if;

  if p_decisao not in ('participar', 'recusar') then
    raise exception 'Decisão inválida: %', p_decisao;
  end if;

  select cliente_id, coalesce(data_efetiva_licitacao, data_licitacao),
         prazo_proposta_liberado, prazo_proposta_liberado_ate
    into v_cliente_id, v_data_sessao, v_prazo_liberado, v_prazo_liberado_ate
  from licitacoes
  where id = p_licitacao_id;

  v_eh_staff := is_admin_ativo() or funcionario_acessa_licitacao(p_licitacao_id);

  if p_decisao = 'participar' then
    -- 2. Bloqueio ME/EPP pela empresa inteira — vale pra qualquer um que
    -- esteja chamando (Cliente, Admin ou Analista).
    select porte into v_porte_cliente from clientes where id = v_cliente_id;

    if v_porte_cliente = 'me_epp' then
      raise exception 'Empresas classificadas como ME/EPP não podem confirmar participação pelo sistema';
    end if;

    -- 1. Mesma regra de prazo da Proposta Comercial (migração 024).
    v_limite_absoluto := date_trunc('day', subtrair_dias_uteis(v_data_sessao, 1)) + interval '18 hours 30 minutes';
    -- Depois da trava absoluta, SOMENTE o Administrador (migração 045).
    if now() > v_limite_absoluto and not is_admin_ativo() then
      raise exception 'Prazo encerrado definitivamente (1 dia útil antes da sessão, 18h30) — somente o Administrador pode confirmar participação';
    end if;

    if not v_eh_staff then
      v_limite_normal := date_trunc('day', subtrair_dias_uteis(v_data_sessao, 4)) + interval '18 hours 30 minutes';

      if not (
        now() <= v_limite_normal
        or (coalesce(v_prazo_liberado, false) and v_prazo_liberado_ate is not null and now() <= v_prazo_liberado_ate)
      ) then
        raise exception 'O prazo para confirmar participação já encerrou (4 dias úteis antes da sessão, 18h30) — peça à Salutti para liberar novamente';
      end if;
    end if;
  end if;

  update licitacoes
  set
    decisao_cliente = p_decisao,
    decisao_cliente_em = now(),
    motivo_recusa_cliente = case when p_decisao = 'recusar' then p_motivo_recusa else null end,
    cobrar_frete = p_cobrar_frete,
    percentual_frete = case when p_cobrar_frete then p_percentual_frete else null end
  where id = p_licitacao_id;

  v_descricao := case
    when p_decisao = 'participar' then 'Cliente confirmou participação nesta licitação'
    else 'Cliente recusou participar' || coalesce(' — motivo: ' || p_motivo_recusa, '')
  end;

  insert into historico_acoes (entidade_tipo, entidade_id, descricao, usuario)
  values ('licitacao', p_licitacao_id, v_descricao, p_usuario);
end;
$function$;

-- Conferência: deve listar as 2 funções com 'somente o Administrador'.
select p.proname as funcao,
       p.prosrc ilike '%somente o Administrador%' as somente_admin
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('atualizar_proposta_item_cliente', 'registrar_decisao_cliente');
