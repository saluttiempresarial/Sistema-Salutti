-- supabase/migrations/043_indicadores_pipeline_prazos.sql
--
-- Etapa 2 dos indicadores de PIPELINE e PRAZOS (Especificação de Relatórios e
-- Dashboards, seções 3.1 e 3.2). Os cálculos já existem no sistema (etapa 1);
-- esta migração prepara a liberação por perfil.
--
-- Novos indicadores (chaves), de uso INTERNO da Salutti:
--   pipeline           Licitações por fase               (A, N)
--   prazos_proximos    Prazos internos dos próximos 7 dias (A, N)
--
-- O que esta migração faz:
--   1. Cadastra os dois indicadores na liberação de nível 1
--      (relatorio_liberacao_perfil): ABERTOS para o Analista e FECHADOS para o
--      perfil Cliente, como pede a coluna de perfis da especificação. O
--      Administrador pode mudar isso em Configurações. Não sobrescreve nada que
--      ele já tenha alterado (on conflict do nothing).
--   2. Nada muda para o Operador: o padrão dele (migração 039) só abre funil,
--      taxa_vitoria, volume_periodo, familias e orgaos; chave fora dessa lista
--      começa fechada. Nenhuma função precisa mudar.
--
-- Nenhum dado existente é alterado e nenhuma função é substituída. Nenhuma tela
-- muda com esta migração: os indicadores só aparecem quando as telas forem
-- entregues (etapas 3 e 4).
--
-- Para desfazer:
--   delete from public.relatorio_liberacao_perfil
--    where indicador in ('pipeline', 'prazos_proximos');
--   delete from public.relatorio_liberacao_operador
--    where indicador in ('pipeline', 'prazos_proximos');

insert into public.relatorio_liberacao_perfil (indicador, perfil, liberado)
values
  ('pipeline', 'analista', true),        ('pipeline', 'cliente', false),
  ('prazos_proximos', 'analista', true), ('prazos_proximos', 'cliente', false)
on conflict (indicador, perfil) do nothing;

-- Conferência: deve listar 4 linhas (analista = true, cliente = false).
select indicador, perfil, liberado
  from public.relatorio_liberacao_perfil
 where indicador in ('pipeline', 'prazos_proximos')
 order by indicador, perfil;
