-- supabase/migrations/057_contador_liberacoes_prazo.sql
--
-- Etapa 2 do plano dos Relatórios de gestão (23/10/2026): contador de
-- liberações de prazo (item 8 do documento). A coluna
-- licitacoes.prazo_liberacoes_qtd existe desde a migração 054 (padrão 0).
--
-- O QUE MUDA
--   A função liberar_prazo_proposta_cliente (versão da migração 023, que a 045
--   confirmou sem alterações) passa a somar 1 em prazo_liberacoes_qtd cada vez
--   que alguém LIBERA o prazo do Cliente DEPOIS de o prazo normal ter
--   encerrado (4 dias úteis antes da sessão, 18h30). Isso mede quantas vezes
--   o cliente precisou de uma extensão.
--     - Liberar antes de o prazo normal acabar NÃO conta.
--     - Travar de novo (p_liberar = false) NÃO conta e não zera o contador.
--     - Prorrogar uma liberação já ativa depois do prazo normal conta de novo
--       (é mais uma liberação feita).
--   Todo o resto da função é idêntico à 023: permissões (Administrador ou
--   Analista da carteira), trava absoluta de 1 dia útil, histórico.
--
-- LICITAÇÕES JÁ EXISTENTES: ficam com contador 0 (não há como reconstruir o
-- passado). Como os dados atuais são de teste, não há impacto.
--
-- ANTES DE RODAR: faça backup ou exporte os dados (o Supabase é de produção).
--
-- ROLLBACK: reexecutar a função da migração 023 (liberar_prazo_proposta_cliente).

create or replace function public.liberar_prazo_proposta_cliente(
  p_licitacao_id uuid,
  p_liberar boolean,
  p_usuario text,
  p_liberado_ate timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data_sessao timestamptz;
  v_limite_absoluto timestamptz;
  v_limite_normal timestamptz;
  v_apos_prazo_normal boolean := false;
begin
  if not (is_admin_ativo() or funcionario_acessa_licitacao(p_licitacao_id)) then
    raise exception 'Você não tem permissão para liberar ou travar o prazo do Cliente';
  end if;

  if p_liberar then
    if p_liberado_ate is null then
      raise exception 'Informe até que data/hora a liberação deve valer';
    end if;

    select coalesce(data_efetiva_licitacao, data_licitacao) into v_data_sessao
    from licitacoes
    where id = p_licitacao_id;

    if v_data_sessao is null then
      raise exception 'Licitação não encontrada';
    end if;

    v_limite_absoluto := date_trunc('day', subtrair_dias_uteis(v_data_sessao, 1)) + interval '18 hours 30 minutes';

    if now() > v_limite_absoluto then
      raise exception 'Prazo encerrado definitivamente (1 dia útil antes da sessão, 18h30) — a Proposta Comercial só pode ser preenchida até lá';
    end if;

    if p_liberado_ate <= now() then
      raise exception 'A data/hora de liberação precisa ser no futuro';
    end if;

    if p_liberado_ate > v_limite_absoluto then
      raise exception 'A data/hora de liberação não pode passar de 1 dia útil antes da sessão, 18h30';
    end if;

    -- Contador de liberações (057): só conta quando o prazo normal do Cliente
    -- (4 dias úteis antes da sessão, 18h30) JÁ tinha encerrado.
    v_limite_normal := date_trunc('day', subtrair_dias_uteis(v_data_sessao, 4)) + interval '18 hours 30 minutes';
    v_apos_prazo_normal := now() > v_limite_normal;
  end if;

  update licitacoes
  set
    prazo_proposta_liberado = p_liberar,
    prazo_proposta_liberado_ate = case when p_liberar then p_liberado_ate else null end,
    prazo_liberacoes_qtd = prazo_liberacoes_qtd + case when v_apos_prazo_normal then 1 else 0 end
  where id = p_licitacao_id;

  insert into historico_acoes (entidade_tipo, entidade_id, descricao, usuario)
  values (
    'licitacao',
    p_licitacao_id,
    case
      when p_liberar then 'Liberou manualmente o prazo para o Cliente editar a proposta até ' || to_char(p_liberado_ate, 'DD/MM/YYYY HH24:MI')
      else 'Travou novamente o prazo do Cliente'
    end,
    p_usuario
  );
end;
$$;


-- Conferência — deve devolver uma linha com ok = true.
select 'liberar_prazo_proposta_cliente soma o contador' as item,
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'liberar_prazo_proposta_cliente'
                  and p.prosrc ilike '%prazo_liberacoes_qtd%') as ok;
