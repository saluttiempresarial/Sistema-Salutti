-- supabase/migrations/051_esfera_licitacao_mercado_uf_esfera.sql
--
-- Indicador "Mercado por UF e por esfera" (Especificação de Relatórios e
-- Dashboards, seção 3.6) e filtros UF e Esfera.
--
-- 1) Coluna opcional `esfera` na licitação: municipal, estadual, federal ou
--    distrital. Fica vazia (null) até o Analista escolher no cadastro; as
--    licitações já cadastradas não são alteradas. A UF já existe (coluna
--    `estado`). Quando a leitura do edital por IA passar a devolver a esfera,
--    ela pré-preenche o campo.
-- 2) Liberação de nível 1 do novo indicador (chave mercado_uf_esfera): aberto
--    para Analista e Cliente, como a especificação indica (A, N, R, O). Não
--    sobrescreve o que o Administrador já tiver alterado (on conflict do
--    nothing). O padrão do Operador (migração 039) não muda: indicador fora da
--    lista dele começa fechado, e o Responsável decide se o libera.
--
-- ORDEM: rode esta migração ANTES de publicar os arquivos novos do sistema; sem
-- a coluna, salvar uma licitação falha.
--
-- Para desfazer:
--   delete from public.relatorio_liberacao_perfil where indicador = 'mercado_uf_esfera';
--   delete from public.relatorio_liberacao_operador where indicador = 'mercado_uf_esfera';
--   alter table public.licitacoes drop constraint if exists licitacoes_esfera_check;
--   alter table public.licitacoes drop column if exists esfera;

alter table public.licitacoes add column if not exists esfera text;

alter table public.licitacoes drop constraint if exists licitacoes_esfera_check;
alter table public.licitacoes
  add constraint licitacoes_esfera_check
  check (esfera is null or esfera in ('municipal', 'estadual', 'federal', 'distrital'));

insert into public.relatorio_liberacao_perfil (indicador, perfil, liberado)
values
  ('mercado_uf_esfera', 'analista', true),
  ('mercado_uf_esfera', 'cliente', true)
on conflict (indicador, perfil) do nothing;

-- Conferência 1: a coluna existe (deve listar 1 linha).
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'licitacoes' and column_name = 'esfera';

-- Conferência 2: deve listar 2 linhas (analista e cliente, ambos true).
select indicador, perfil, liberado
  from public.relatorio_liberacao_perfil
 where indicador = 'mercado_uf_esfera'
 order by perfil;
