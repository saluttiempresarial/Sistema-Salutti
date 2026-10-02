-- 030_rpc_substituir_grupos_itens_licitacao.sql
--
-- Torna atômica a troca de grupos/itens de uma licitação (usada em
-- licitacaoService.ts, nas funções criar() e atualizar()).
--
-- PROBLEMA QUE ISSO RESOLVE: hoje (ver substituirGruposEItens() em
-- licitacaoService.ts) a troca é feita em 4 chamadas separadas ao
-- Supabase, nesta ordem: apaga itens -> apaga grupos -> insere grupos
-- novos -> insere itens novos. Se a aplicação perder a conexão, o
-- navegador fechar, ou qualquer uma dessas chamadas falhar no meio do
-- caminho, a licitação pode ficar com os itens/grupos ANTIGOS já
-- apagados e os NOVOS não inseridos — perda de dados real.
--
-- Esta função faz as 4 operações dentro de uma única transação de banco:
-- se qualquer parte falhar, o Postgres desfaz tudo automaticamente (nada
-- fica "pela metade"). O service em TypeScript vai chamar só esta
-- função via supabase.rpc(), no lugar das 4 chamadas atuais.
--
-- Mantida como SECURITY INVOKER (não SECURITY DEFINER) de propósito: ela
-- roda com as mesmas permissões de RLS que o usuário logado já tem hoje
-- nas tabelas itens_licitacao/grupos_itens_licitacao — ou seja, não abre
-- nenhum privilégio novo, só agrupa o que já era permitido numa
-- transação só.
--
-- Contrato dos parâmetros (JSON), para casar com o TypeScript:
--   p_grupos: [{ "id": "<id do form, pode ser temporário>", "numero": "1", "nome": "Grupo 1" }, ...]
--   p_itens:  [{
--                "id": "<id do form, ignorado aqui>",
--                "grupoId": "<precisa bater com algum id de p_grupos, ou null>",
--                "numero": "...", "descricao": "...", "unidadeMedida": "...",
--                "quantidade": 10, "precoReferencia": 99.9, "exclusivoMeEpp": false,
--                "propostaCliente": { "codigoInterno": "...", ... } ou null
--              }, ...]
--
-- O "id" de cada grupo em p_grupos é só uma referência local (o mesmo id
-- que o front-end já usa para montar o formulário) — serve para a função
-- conseguir ligar cada item ao grupo novo certo, já que o grupo ganha um
-- id novo de verdade (uuid) ao ser inserido.

create or replace function public.substituir_grupos_itens_licitacao(
  p_licitacao_id uuid,
  p_grupos jsonb,
  p_itens jsonb
) returns void
language plpgsql
security invoker
as $$
declare
  v_grupo jsonb;
  v_item jsonb;
  v_novo_grupo_id uuid;
  v_mapa_grupos jsonb := '{}'::jsonb;
  v_grupo_id_temp text;
  v_grupo_id_real uuid;
begin
  -- Apaga itens e grupos antigos desta licitação (mesma ordem de hoje:
  -- itens primeiro, por causa da referência grupo_id).
  delete from itens_licitacao where licitacao_id = p_licitacao_id;
  delete from grupos_itens_licitacao where licitacao_id = p_licitacao_id;

  -- Insere os grupos novos, guardando o mapeamento
  -- "id do form (temporário)" -> "id novo gerado pelo banco".
  for v_grupo in select * from jsonb_array_elements(coalesce(p_grupos, '[]'::jsonb))
  loop
    insert into grupos_itens_licitacao (licitacao_id, numero, nome)
    values (p_licitacao_id, v_grupo ->> 'numero', v_grupo ->> 'nome')
    returning id into v_novo_grupo_id;

    v_mapa_grupos := v_mapa_grupos || jsonb_build_object(v_grupo ->> 'id', v_novo_grupo_id::text);
  end loop;

  -- Insere os itens novos, traduzindo o grupoId do form para o id novo
  -- do grupo correspondente (quando o item pertence a um grupo).
  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    v_grupo_id_temp := v_item ->> 'grupoId';
    v_grupo_id_real := null;
    if v_grupo_id_temp is not null then
      v_grupo_id_real := (v_mapa_grupos ->> v_grupo_id_temp)::uuid;
    end if;

    insert into itens_licitacao (
      licitacao_id, grupo_id, numero, descricao, unidade_medida, quantidade,
      preco_referencia, exclusivo_me_epp,
      proposta_codigo_interno, proposta_descricao, proposta_marca, proposta_modelo, proposta_preco_minimo
    ) values (
      p_licitacao_id,
      v_grupo_id_real,
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
      (v_item -> 'propostaCliente' ->> 'precoMinimo')::numeric
    );
  end loop;
end;
$$;

grant execute on function public.substituir_grupos_itens_licitacao(uuid, jsonb, jsonb) to authenticated;
