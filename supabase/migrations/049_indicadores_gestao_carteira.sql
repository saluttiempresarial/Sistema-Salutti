-- supabase/migrations/049_indicadores_gestao_carteira.sql
--
-- Lote 1 de indicadores de GESTÃO DA CARTEIRA e da OPERAÇÃO (Especificação de
-- Relatórios e Dashboards, seções 3.1, 3.2, 3.3 e 3.6). Os cálculos já existem
-- no sistema; esta migração só cadastra a liberação de nível 1.
--
-- Novos indicadores (chaves):
--   aproveitamento          Analisadas x participadas              (A, N)  uso interno
--   tempo_resposta          Tempo de resposta do cliente           (A, N)  uso interno
--   clientes_sem_atividade  Clientes sem atividade                 (A)     uso interno
--   concentracao_carteira   Concentração por cliente e segmento    (A)     uso interno
--   valor_por_cliente       Valor em disputa e adjudicado/cliente  (A)     uso interno
--   desempenho_modalidade   Desempenho por modalidade              (A, N, R, O)
--
-- Padrões: os de uso interno nascem ABERTOS só para o Analista que a
-- especificação indica (aproveitamento e tempo de resposta) e FECHADOS para o
-- Cliente; os exclusivos do Administrador nascem fechados para os dois perfis;
-- desempenho por modalidade nasce aberto para Analista e Cliente. O
-- Administrador muda tudo em Configurações. Não sobrescreve o que ele já
-- alterou (on conflict do nothing). O padrão do Operador (migração 039) não
-- muda: indicador fora da lista dele começa fechado.
--
-- Nenhum dado existente é alterado e nenhuma função é substituída.
--
-- Para desfazer:
--   delete from public.relatorio_liberacao_perfil
--    where indicador in ('aproveitamento','tempo_resposta','clientes_sem_atividade',
--                        'concentracao_carteira','valor_por_cliente','desempenho_modalidade');
--   delete from public.relatorio_liberacao_operador
--    where indicador in ('aproveitamento','tempo_resposta','clientes_sem_atividade',
--                        'concentracao_carteira','valor_por_cliente','desempenho_modalidade');

insert into public.relatorio_liberacao_perfil (indicador, perfil, liberado)
values
  ('aproveitamento', 'analista', true),          ('aproveitamento', 'cliente', false),
  ('tempo_resposta', 'analista', true),          ('tempo_resposta', 'cliente', false),
  ('clientes_sem_atividade', 'analista', false), ('clientes_sem_atividade', 'cliente', false),
  ('concentracao_carteira', 'analista', false),  ('concentracao_carteira', 'cliente', false),
  ('valor_por_cliente', 'analista', false),      ('valor_por_cliente', 'cliente', false),
  ('desempenho_modalidade', 'analista', true),   ('desempenho_modalidade', 'cliente', true)
on conflict (indicador, perfil) do nothing;

-- Conferência: deve listar 12 linhas.
select indicador, perfil, liberado
  from public.relatorio_liberacao_perfil
 where indicador in ('aproveitamento','tempo_resposta','clientes_sem_atividade',
                     'concentracao_carteira','valor_por_cliente','desempenho_modalidade')
 order by indicador, perfil;
