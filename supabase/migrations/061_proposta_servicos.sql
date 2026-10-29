-- supabase/migrations/061_proposta_servicos.sql
--
-- Serviços — Etapa 2 (29/10/2026): proposta do cliente para licitações cujo
-- objeto é "Serviços". Item de serviço não tem marca nem modelo; no lugar, a
-- CATEGORIA DO SERVIÇO passa a ser obrigatória (lista da planilha ASTRON).
--
-- O QUE ESTA MIGRAÇÃO FAZ
--
-- 1. Cria as colunas itens_licitacao.proposta_categoria_servico (text) e
--    itens_licitacao.proposta_observacoes (text). Cód. Serviço e Descrição do
--    Serviço reaproveitam proposta_codigo_interno e proposta_descricao.
--
-- 2. atualizar_proposta_item_cliente (versão da 056): ganha os parâmetros
--    opcionais p_categoria_servico e p_observacoes (9 no total). A função de
--    7 parâmetros é APAGADA para não existirem duas versões. Regra nova:
--      - licitação com objeto "Serviços": item com valor exige categoria;
--      - qualquer outro objeto: igual à 048 (marca e modelo obrigatórios).
--    Prazos, trava definitiva e ME/EPP: idênticos à 056.
--
-- 3. substituir_grupos_itens_licitacao (versão da 056): grava categoria e
--    observações quando a tela as envia e PRESERVA as já gravadas quando o
--    campo não vem.
--
-- 4. desistir_licitacao_cliente (versão da 056): a desistência apaga também
--    categoria e observações.
--
-- ATENÇÃO: publique o código novo logo depois de rodar este script. Com o
-- código antigo no ar nada quebra para produtos; mas salvar a proposta de uma
-- licitação de serviços só funciona com o código novo.
--
-- ANTES DE RODAR: faça backup ou exporte os dados (o Supabase é de produção).
--
-- ROLLBACK: apagar a função de 9 parâmetros e reexecutar as versões da 056
-- (atualizar_proposta_item_cliente de 7 parâmetros, substituir_grupos_itens_
-- licitacao e desistir_licitacao_cliente). As colunas e os dados permanecem.

-- ---------------------------------------------------------------------------
-- 1. Colunas novas
-- ---------------------------------------------------------------------------
alter table public.itens_licitacao add column if not exists proposta_categoria_servico text;
alter table public.itens_licitacao add column if not exists proposta_observacoes text;

-- ---------------------------------------------------------------------------
-- 2. atualizar_proposta_item_cliente (9 parâmetros)
-- ---------------------------------------------------------------------------
drop function if exists public.atualizar_proposta_item_cliente(uuid, text, text, text, text, numeric, text[]);

CREATE OR REPLACE FUNCTION public.atualizar_proposta_item_cliente(p_item_id uuid, p_codigo_interno text, p_descricao_produto text, p_marca text, p_modelo text, p_preco_minimo numeric, p_marcas_composicao text[] DEFAULT NULL, p_categoria_servico text DEFAULT NULL, p_observacoes text DEFAULT NULL)
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
  v_objeto text;
  v_eh_servico boolean;
begin
  select licitacao_id, exclusivo_me_epp into v_licitacao_id, v_exclusivo_me_epp
  from itens_licitacao
  where id = p_item_id;

  if v_licitacao_id is null then
    raise exception 'Item não encontrado';
  end if;

  select cliente_id, coalesce(data_efetiva_licitacao, data_licitacao),
         prazo_proposta_liberado, prazo_proposta_liberado_ate, objeto
    into v_cliente_id, v_data_sessao, v_prazo_liberado, v_prazo_liberado_ate, v_objeto
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

  -- Licitação de serviços (061): item de serviço não tem marca nem modelo;
  -- no lugar, a categoria do serviço é obrigatória em todo item com valor.
  -- Produto (e qualquer outro objeto) mantém a regra da 048: marca/fabricante
  -- e modelo/versão obrigatórios. Item sem valor não exige nada.
  v_eh_servico := translate(lower(btrim(coalesce(v_objeto, ''))), 'çõãáâéêíóôú', 'coaaaeeioou') = 'servicos';

  if p_preco_minimo is not null then
    if v_eh_servico then
      if nullif(btrim(coalesce(p_categoria_servico, '')), '') is null then
        raise exception 'Informe a categoria do serviço de todos os itens com valor preenchido';
      end if;
    elsif nullif(btrim(coalesce(p_marca, '')), '') is null
          or nullif(btrim(coalesce(p_modelo, '')), '') is null then
      raise exception 'Informe a marca/fabricante e o modelo/versão de todos os itens com valor preenchido';
    end if;
  end if;

  if length(coalesce(p_categoria_servico, '')) > 120 then
    raise exception 'A categoria do serviço pode ter no máximo 120 caracteres';
  end if;
  if length(coalesce(p_observacoes, '')) > 1000 then
    raise exception 'As observações do serviço podem ter no máximo 1000 caracteres';
  end if;

  update itens_licitacao
  set
    proposta_codigo_interno = p_codigo_interno,
    proposta_descricao = p_descricao_produto,
    proposta_marca = p_marca,
    proposta_modelo = p_modelo,
    proposta_preco_minimo = p_preco_minimo,
    proposta_marcas_composicao = normalizar_marcas_composicao(p_marcas_composicao),
    proposta_categoria_servico = nullif(btrim(p_categoria_servico), ''),
    proposta_observacoes = nullif(btrim(p_observacoes), '')
  where id = p_item_id;
end;
$function$;

grant execute on function public.atualizar_proposta_item_cliente(uuid, text, text, text, text, numeric, text[], text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. substituir_grupos_itens_licitacao
-- ---------------------------------------------------------------------------
create or replace function public.substituir_grupos_itens_licitacao(
  p_licitacao_id uuid,
  p_grupos jsonb,
  p_itens jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_grupo jsonb;
  v_item jsonb;
  v_id_form text;
  v_grupo_id_real uuid;
  v_item_id_real uuid;
  v_grupo_id_temp text;
  v_grupo_id_item uuid;
  v_mapa_grupos jsonb := '{}'::jsonb;
  v_grupos_mantidos uuid[] := '{}';
  v_itens_mantidos uuid[] := '{}';
begin
  if not (is_admin_ativo() or funcionario_acessa_licitacao(p_licitacao_id)) then
    raise exception 'Somente o Administrador ou o Analista da licitação pode alterar os itens';
  end if;

  -- 1) Grupos: atualiza o que já existe, insere o que é novo.
  for v_grupo in select * from jsonb_array_elements(coalesce(p_grupos, '[]'::jsonb))
  loop
    v_id_form := v_grupo ->> 'id';
    v_grupo_id_real := null;

    if v_id_form ~* c_uuid then
      select g.id into v_grupo_id_real
      from grupos_itens_licitacao g
      where g.id = v_id_form::uuid and g.licitacao_id = p_licitacao_id;
    end if;

    if v_grupo_id_real is not null then
      update grupos_itens_licitacao
      set numero = v_grupo ->> 'numero',
          nome = v_grupo ->> 'nome'
      where id = v_grupo_id_real;
    else
      insert into grupos_itens_licitacao (licitacao_id, numero, nome)
      values (p_licitacao_id, v_grupo ->> 'numero', v_grupo ->> 'nome')
      returning id into v_grupo_id_real;
    end if;

    v_mapa_grupos := v_mapa_grupos || jsonb_build_object(v_id_form, v_grupo_id_real::text);
    v_grupos_mantidos := v_grupos_mantidos || v_grupo_id_real;
  end loop;

  -- 2) Itens: atualiza o que já existe, insere o que é novo.
  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    v_grupo_id_temp := v_item ->> 'grupoId';
    v_grupo_id_item := null;
    if v_grupo_id_temp is not null then
      v_grupo_id_item := (v_mapa_grupos ->> v_grupo_id_temp)::uuid;
    end if;

    v_id_form := v_item ->> 'id';
    v_item_id_real := null;

    if v_id_form ~* c_uuid then
      select i.id into v_item_id_real
      from itens_licitacao i
      where i.id = v_id_form::uuid and i.licitacao_id = p_licitacao_id;
    end if;

    if v_item_id_real is not null then
      update itens_licitacao
      set grupo_id = v_grupo_id_item,
          numero = v_item ->> 'numero',
          descricao = v_item ->> 'descricao',
          unidade_medida = v_item ->> 'unidadeMedida',
          quantidade = (v_item ->> 'quantidade')::numeric,
          preco_referencia = (v_item ->> 'precoReferencia')::numeric,
          exclusivo_me_epp = coalesce((v_item ->> 'exclusivoMeEpp')::boolean, false),
          proposta_codigo_interno = v_item -> 'propostaCliente' ->> 'codigoInterno',
          proposta_descricao = v_item -> 'propostaCliente' ->> 'descricaoProduto',
          proposta_marca = v_item -> 'propostaCliente' ->> 'marca',
          proposta_modelo = v_item -> 'propostaCliente' ->> 'modelo',
          proposta_preco_minimo = (v_item -> 'propostaCliente' ->> 'precoMinimo')::numeric,
          -- Marcas da composição (056): só mexe se a tela mandar o campo; tela
          -- antiga (sem o campo) preserva o que já está gravado.
          proposta_marcas_composicao = case
            when (v_item -> 'propostaCliente') ? 'marcasComposicao' then
              normalizar_marcas_composicao(array(
                select jsonb_array_elements_text(
                  case when jsonb_typeof(v_item -> 'propostaCliente' -> 'marcasComposicao') = 'array'
                       then v_item -> 'propostaCliente' -> 'marcasComposicao' else '[]'::jsonb end)))
            else proposta_marcas_composicao
          end,
          -- Serviços (061): mesma regra das marcas — só mexe se a tela mandar.
          proposta_categoria_servico = case
            when (v_item -> 'propostaCliente') ? 'categoriaServico'
              then nullif(btrim(v_item -> 'propostaCliente' ->> 'categoriaServico'), '')
            else proposta_categoria_servico
          end,
          proposta_observacoes = case
            when (v_item -> 'propostaCliente') ? 'observacoes'
              then nullif(btrim(v_item -> 'propostaCliente' ->> 'observacoes'), '')
            else proposta_observacoes
          end,
          familia_id = case
            when v_item ? 'familiaId' then nullif(v_item ->> 'familiaId', '')::uuid
            else familia_id
          end
      where id = v_item_id_real;
    else
      insert into itens_licitacao (
        licitacao_id, grupo_id, numero, descricao, unidade_medida, quantidade,
        preco_referencia, exclusivo_me_epp,
        proposta_codigo_interno, proposta_descricao, proposta_marca, proposta_modelo, proposta_preco_minimo,
        proposta_marcas_composicao, proposta_categoria_servico, proposta_observacoes, familia_id
      ) values (
        p_licitacao_id,
        v_grupo_id_item,
        v_item ->> 'numero',
        v_item ->> 'descricao',
        v_item ->> 'unidadeMedida',
        (v_item ->> 'quantidade')::numeric,
        (v_item ->> 'precoReferencia')::numeric,
        coalesce((v_item ->> 'exclusivoMeEpp')::boolean, false),
        v_item -> 'propostaCliente' ->> 'codigoInterno',
        v_item -> 'propostaCliente' ->> 'descricaoProduto',
        v_item -> 'propostaCliente' ->> 'marca',
        v_item -> 'propostaCliente' ->> 'modelo',
        (v_item -> 'propostaCliente' ->> 'precoMinimo')::numeric,
        normalizar_marcas_composicao(array(
          select jsonb_array_elements_text(
            case when jsonb_typeof(v_item -> 'propostaCliente' -> 'marcasComposicao') = 'array'
                 then v_item -> 'propostaCliente' -> 'marcasComposicao' else '[]'::jsonb end))),
        nullif(btrim(v_item -> 'propostaCliente' ->> 'categoriaServico'), ''),
        nullif(btrim(v_item -> 'propostaCliente' ->> 'observacoes'), ''),
        nullif(v_item ->> 'familiaId', '')::uuid
      )
      returning id into v_item_id_real;
    end if;

    v_itens_mantidos := v_itens_mantidos || v_item_id_real;
  end loop;

  -- 3) Remove o que saiu do formulário (itens primeiro, por causa de grupo_id).
  delete from itens_licitacao
  where licitacao_id = p_licitacao_id
    and not (id = any(v_itens_mantidos));

  delete from grupos_itens_licitacao
  where licitacao_id = p_licitacao_id
    and not (id = any(v_grupos_mantidos));
end;
$$;

grant execute on function public.substituir_grupos_itens_licitacao(uuid, jsonb, jsonb) to authenticated;

grant execute on function public.substituir_grupos_itens_licitacao(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. desistir_licitacao_cliente
-- ---------------------------------------------------------------------------
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

  update itens_licitacao
  set
    proposta_codigo_interno = null,
    proposta_descricao = null,
    proposta_marca = null,
    proposta_modelo = null,
    proposta_preco_minimo = null,
    proposta_marcas_composicao = null,
    proposta_categoria_servico = null,
    proposta_observacoes = null
  where licitacao_id = p_licitacao_id;

  update licitacoes
  set
    decisao_cliente = 'pendente',
    decisao_cliente_em = null,
    motivo_recusa_cliente = null,
    motivo_nao_participacao = null,
    cobrar_frete = false,
    percentual_frete = null,
    status_proposta = 'rascunho'
  where id = p_licitacao_id;

  insert into historico_acoes (entidade_tipo, entidade_id, descricao, usuario)
  values ('licitacao', p_licitacao_id, 'Cliente desistiu da licitação — proposta comercial apagada', p_usuario);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Conferência — deve listar 5 linhas, todas com ok = true.
-- ---------------------------------------------------------------------------
select 'coluna proposta_categoria_servico' as item,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'itens_licitacao'
                  and column_name = 'proposta_categoria_servico') as ok
union all
select 'coluna proposta_observacoes',
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'itens_licitacao'
                  and column_name = 'proposta_observacoes')
union all
select 'atualizar_proposta_item_cliente: só a versão de 9 parâmetros',
       (select count(*) = 1 and bool_and(p.pronargs = 9)
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'atualizar_proposta_item_cliente')
union all
select 'substituir_grupos_itens_licitacao grava a categoria',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'substituir_grupos_itens_licitacao'
                  and p.prosrc ilike '%proposta_categoria_servico%')
union all
select 'desistir_licitacao_cliente limpa a categoria',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'desistir_licitacao_cliente'
                  and p.prosrc ilike '%proposta_categoria_servico%');
