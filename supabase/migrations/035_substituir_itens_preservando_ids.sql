-- supabase/035_substituir_itens_preservando_ids.sql
--
-- Reescreve a função substituir_grupos_itens_licitacao (criada na migração
-- 030) para ATUALIZAR os itens e grupos existentes em vez de apagar tudo e
-- recriar.
--
-- PROBLEMA DA VERSÃO ANTERIOR: a cada salvamento do formulário de licitação,
-- ela apagava todos os itens e grupos da licitação e inseria de novo, com
-- ids NOVOS. Consequências:
--   - os resultados de disputa por item (disputa_itens, que apaga em
--     cascata quando o item é apagado) eram perdidos ao editar a licitação;
--   - a decisão "liberar / não participar" de item acima da referência
--     (migração 032) era perdida;
--   - a nova família do item (migração 033) também seria perdida.
--
-- COMO FICA: itens e grupos que já existem (id real, da própria licitação)
-- são atualizados no mesmo lugar, mantendo id, decisão de item acima da
-- referência e resultados de disputa. Itens e grupos novos são inseridos.
-- Os que saíram do formulário são apagados (e só esses perdem resultados).
--
-- COMPATIBILIDADE: o formato dos parâmetros não muda. A família do item é
-- lida do campo opcional "familiaId" de cada item; se o campo não vier (tela
-- antiga), a família atual do item é mantida.
--
-- SEGURANÇA: passa a ser SECURITY DEFINER, com verificação explícita de
-- quem pode alterar a licitação (Admin ativo ou Analista da carteira), a
-- mesma regra já usada em decidir_participacao_acima_referencia (032). Isso
-- evita depender de uma policy de UPDATE em itens_licitacao e grupos.
--
-- Continua sendo uma única transação: se algo falhar, nada é gravado.
--
-- Para voltar à versão anterior: executar de novo o conteúdo da migração 030.

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
        familia_id
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
