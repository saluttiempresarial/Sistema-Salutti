-- supabase/migrations/050_regra_prazo_leitura_todos.sql
--
-- Corrige o erro 406 que aparecia no console do navegador no login do Cliente
-- ("Failed to load resource ... configuracoes ... 406").
--
-- Causa: o sistema lê a regra do prazo interno (dias úteis antes e horário
-- limite) na tabela `configuracoes`, mas o Cliente não tem permissão de leitura
-- nessa tabela — que também guarda os dados cadastrais da Salutti (razão
-- social, CNPJ, endereço, telefone, e-mail). Sem a leitura, o sistema usava a
-- regra padrão do código (4 dias úteis, 18h30), e a "Data de retorno" do
-- Cliente não acompanharia uma mudança feita pelo Administrador em Configurações.
--
-- Solução: uma função que devolve SOMENTE a regra do prazo (nada dos dados
-- cadastrais), liberada para qualquer usuário logado. A tabela `configuracoes`
-- continua fechada para o Cliente. Não altera nenhuma permissão existente.
-- Seguro para rodar mais de uma vez.

create or replace function public.obter_regra_prazo_interno()
returns table (dias_uteis_antes integer, horario_limite time)
language sql
stable
security definer
set search_path = public
as $$
  select c.dias_uteis_antes::integer, c.horario_limite::time
  from public.configuracoes c
  where c.id = true;
$$;

revoke all on function public.obter_regra_prazo_interno() from public;
revoke all on function public.obter_regra_prazo_interno() from anon;
grant execute on function public.obter_regra_prazo_interno() to authenticated;

-- Conferência (deve devolver uma linha: 4 | 18:30:00, ou o que estiver em Configurações):
--   select * from public.obter_regra_prazo_interno();
