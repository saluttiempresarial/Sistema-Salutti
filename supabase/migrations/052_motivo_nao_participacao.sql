-- supabase/migrations/052_motivo_nao_participacao.sql
--
-- Indicador "Motivos de não participação" (Especificação de Relatórios e
-- Dashboards, seção 3.6). Lista padronizada definida pelo Márcio em 19/10 (8 motivos):
-- ao clicar em "Não vou participar", o cliente passa a ESCOLHER um motivo
-- (obrigatório); o texto livre continua existindo só como explicação
-- complementar (campo motivo_recusa_cliente, que não muda).
--
-- O que esta migração faz:
--   1. Coluna `motivo_nao_participacao` na licitação, com restrição às chaves
--      da lista. Recusas antigas ficam com a coluna vazia (null) e aparecem
--      no indicador como "Não classificado".
--   2. registrar_decisao_cliente: ganha o parâmetro p_motivo_nao_participacao
--      e, ao recusar, EXIGE o motivo. Todo o resto da função é igual ao da
--      migração 045 (prazos, trava definitiva só do Administrador, bloqueio
--      ME/EPP). A função antiga (6 parâmetros) é removida para não sobrar
--      uma versão sem a exigência.
--   3. desistir_licitacao_cliente: ao voltar a decisão para "pendente", limpa
--      também o motivo. Resto igual ao da migração 019.
--   4. Liberação de nível 1 do indicador (chave motivos_nao_participacao):
--      aberto para Analista e Cliente. Não sobrescreve o que o Administrador
--      já tiver alterado (on conflict do nothing). O padrão do Operador
--      (migração 039) não muda: indicador fora da lista dele começa fechado.
--
-- Chaves aceitas: preco_referencia_baixo, margem_insuficiente, prazo_entrega,
-- frete_distancia, produto_nao_trabalha, especificacao_nao_atende,
-- fornecedor_nao_localizado, outro (escolhidas pelo cliente) e bloqueio_porte, exclusiva_me_epp (gravadas pelo sistema quando a
-- recusa acontece por bloqueio). "Sem resposta" e "não classificado" não ficam
-- gravados: o indicador calcula.
--
-- Se você já rodou uma versão anterior desta migração (lista de 11 motivos),
-- pode rodar esta de novo: ela é repetível. Motivos gravados com chaves da
-- lista antiga são convertidos ou limpos no passo 1.
--
-- ORDEM: rode esta migração ANTES de publicar os arquivos novos do sistema.
-- Sem a coluna, salvar uma licitação falha; sem a função nova, recusar falha.
--
-- Para desfazer: execute de novo a função registrar_decisao_cliente da
-- migração 045 (depois de apagar a nova), a desistir_licitacao_cliente da 019, e
--   drop function if exists public.registrar_decisao_cliente(uuid, text, text, text, text, boolean, numeric);
--   delete from public.relatorio_liberacao_perfil where indicador = 'motivos_nao_participacao';
--   delete from public.relatorio_liberacao_operador where indicador = 'motivos_nao_participacao';
--   alter table public.licitacoes drop constraint if exists licitacoes_motivo_nao_participacao_check;
--   alter table public.licitacoes drop column if exists motivo_nao_participacao;

-- 1. Coluna e restrição
alter table public.licitacoes add column if not exists motivo_nao_participacao text;

alter table public.licitacoes drop constraint if exists licitacoes_motivo_nao_participacao_check;

-- Só afeta quem rodou a versão anterior: converte a chave que mudou de nome e
-- limpa as que saíram da lista (vão aparecer como "Não classificado").
update public.licitacoes set motivo_nao_participacao = 'frete_distancia' where motivo_nao_participacao = 'local_frete';
update public.licitacoes
   set motivo_nao_participacao = null
 where motivo_nao_participacao is not null
   and motivo_nao_participacao not in (
     'preco_referencia_baixo', 'margem_insuficiente', 'prazo_entrega', 'frete_distancia',
     'produto_nao_trabalha', 'especificacao_nao_atende', 'fornecedor_nao_localizado', 'outro',
     'bloqueio_porte', 'exclusiva_me_epp'
   );

alter table public.licitacoes
  add constraint licitacoes_motivo_nao_participacao_check
  check (
    motivo_nao_participacao is null
    or motivo_nao_participacao in (
      'preco_referencia_baixo', 'margem_insuficiente', 'prazo_entrega', 'frete_distancia',
      'produto_nao_trabalha', 'especificacao_nao_atende', 'fornecedor_nao_localizado', 'outro',
      'bloqueio_porte', 'exclusiva_me_epp'
    )
  );

-- 2. registrar_decisao_cliente com o motivo obrigatório na recusa
drop function if exists public.registrar_decisao_cliente(uuid, text, text, text, boolean, numeric);

create or replace function public.registrar_decisao_cliente(
  p_licitacao_id uuid,
  p_decisao text,
  p_usuario text,
  p_motivo_recusa text,
  p_motivo_nao_participacao text,
  p_cobrar_frete boolean,
  p_percentual_frete numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_descricao text;
  v_rotulo_motivo text;
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

  -- Motivo padronizado obrigatório ao recusar (migração 052). "outro" exige
  -- a explicação em texto.
  if p_decisao = 'recusar' then
    if p_motivo_nao_participacao is null or btrim(p_motivo_nao_participacao) = '' then
      raise exception 'Informe o motivo para não participar desta licitação';
    end if;
    if p_motivo_nao_participacao = 'outro' and btrim(coalesce(p_motivo_recusa, '')) = '' then
      raise exception 'Explique o motivo escolhido como "Outro"';
    end if;
  end if;

  select cliente_id, coalesce(data_efetiva_licitacao, data_licitacao),
         prazo_proposta_liberado, prazo_proposta_liberado_ate
    into v_cliente_id, v_data_sessao, v_prazo_liberado, v_prazo_liberado_ate
  from licitacoes
  where id = p_licitacao_id;

  v_eh_staff := is_admin_ativo() or funcionario_acessa_licitacao(p_licitacao_id);

  if p_decisao = 'participar' then
    -- Bloqueio ME/EPP pela empresa inteira — vale pra qualquer um que
    -- esteja chamando (Cliente, Admin ou Analista).
    select porte into v_porte_cliente from clientes where id = v_cliente_id;

    if v_porte_cliente = 'me_epp' then
      raise exception 'Empresas classificadas como ME/EPP não podem confirmar participação pelo sistema';
    end if;

    -- Mesma regra de prazo da Proposta Comercial (migração 024).
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
    motivo_recusa_cliente = case when p_decisao = 'recusar' then nullif(btrim(p_motivo_recusa), '') else null end,
    motivo_nao_participacao = case when p_decisao = 'recusar' then p_motivo_nao_participacao else null end,
    cobrar_frete = p_cobrar_frete,
    percentual_frete = case when p_cobrar_frete then p_percentual_frete else null end
  where id = p_licitacao_id;

  v_rotulo_motivo := case p_motivo_nao_participacao
    when 'preco_referencia_baixo' then 'Preço de referência baixo'
    when 'margem_insuficiente' then 'Margem insuficiente'
    when 'prazo_entrega' then 'Prazo de entrega'
    when 'frete_distancia' then 'Frete ou distância'
    when 'produto_nao_trabalha' then 'Produto não trabalhado'
    when 'especificacao_nao_atende' then 'Especificação não atendida'
    when 'fornecedor_nao_localizado' then 'Fornecedor não localizado'
    when 'outro' then 'Outro'
    when 'bloqueio_porte' then 'Empresa ME/EPP (bloqueio do sistema)'
    when 'exclusiva_me_epp' then 'Licitação exclusiva ME/EPP (bloqueio do sistema)'
    else null
  end;

  v_descricao := case
    when p_decisao = 'participar' then 'Cliente confirmou participação nesta licitação'
    else 'Cliente recusou participar'
      || coalesce(' — motivo: ' || v_rotulo_motivo, '')
      || coalesce(' — ' || nullif(btrim(p_motivo_recusa), ''), '')
  end;

  insert into historico_acoes (entidade_tipo, entidade_id, descricao, usuario)
  values ('licitacao', p_licitacao_id, v_descricao, p_usuario);
end;
$function$;

-- 3. desistir_licitacao_cliente: limpa também o motivo
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
    proposta_preco_minimo = null
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

-- 4. Liberação do indicador (nível 1)
insert into public.relatorio_liberacao_perfil (indicador, perfil, liberado)
values
  ('motivos_nao_participacao', 'analista', true),
  ('motivos_nao_participacao', 'cliente', true)
on conflict (indicador, perfil) do nothing;

-- Conferência (deve listar 4 linhas: a coluna, a função nova com 7 parâmetros
-- e as 2 liberações). Atenção: o editor mostra só o resultado da última
-- consulta, por isso tudo vai numa só.
select 'coluna' as item, column_name::text as detalhe
  from information_schema.columns
 where table_schema = 'public' and table_name = 'licitacoes' and column_name = 'motivo_nao_participacao'
union all
select 'funcao', p.proname || ' (' || p.pronargs || ' parâmetros)'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'registrar_decisao_cliente'
union all
select 'liberacao', perfil || ' = ' || liberado::text
  from public.relatorio_liberacao_perfil
 where indicador = 'motivos_nao_participacao';
