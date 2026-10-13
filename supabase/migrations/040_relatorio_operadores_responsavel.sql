-- supabase/migrations/040_relatorio_operadores_responsavel.sql
--
-- Tela de liberação do RESPONSÁVEL (nível 2 dos Indicadores). Para montar a
-- tabela "Operador x indicador", o Responsável (usuário ativo de cliente com
-- perfil 'gestor') precisa conhecer os Operadores da própria empresa e o que
-- cada um vê hoje. Em vez de depender das regras de leitura de
-- usuarios_cliente, esta função entrega só o necessário e só da empresa do
-- Responsável logado.
--
-- Devolve um JSON:
--   {
--     "indicadores": ["funil", "orgaos", ...],      -- liberados pelo Admin ao
--                                                      perfil Cliente (nível 1);
--                                                      só estes podem ser
--                                                      repassados a Operadores
--     "operadores": [
--       {
--         "usuario_id": "...", "nome": "...", "email": "...",
--         "liberacoes": { "funil": true, "orgaos": false, ... }
--       }
--     ]
--   }
-- Cada "liberacoes" traz o valor EFETIVO por indicador: a decisão gravada pelo
-- Responsável ou, se ainda não houver, o padrão (abertos: funil, taxa_vitoria,
-- volume_periodo, familias, orgaos; fechados: ganho_sobre_minimo, concorrentes,
-- perdas_evitaveis) — o mesmo padrão da relatorio_indicadores_cliente().
--
-- Devolve JSON null para quem não é Responsável ativo de cliente.
-- Só entram Operadores ATIVOS da mesma empresa do Responsável.
--
-- Para desfazer:
--   drop function if exists public.relatorio_operadores_responsavel();

create or replace function public.relatorio_operadores_responsavel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_indicadores jsonb;
begin
  select u.cliente_id
    into v_cliente_id
  from usuarios_cliente u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
    and u.perfil = 'gestor'
  limit 1;

  if v_cliente_id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(c.indicador order by c.indicador), '[]'::jsonb)
    into v_indicadores
  from relatorio_liberacao_perfil c
  where c.perfil = 'cliente'
    and c.liberado;

  return jsonb_build_object(
    'indicadores', v_indicadores,
    'operadores', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'usuario_id', op.id,
          'nome', op.nome,
          'email', op.email,
          'liberacoes', coalesce((
            select jsonb_object_agg(
              c.indicador,
              coalesce(
                (select o.liberado
                   from relatorio_liberacao_operador o
                  where o.usuario_id = op.id
                    and o.indicador = c.indicador),
                c.indicador in ('funil', 'taxa_vitoria', 'volume_periodo', 'familias', 'orgaos')
              )
            )
            from relatorio_liberacao_perfil c
            where c.perfil = 'cliente'
              and c.liberado
          ), '{}'::jsonb)
        )
        order by op.nome
      )
      from usuarios_cliente op
      where op.cliente_id = v_cliente_id
        and op.perfil = 'operador'
        and op.status = 'ativo'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.relatorio_operadores_responsavel() from public, anon;
grant execute on function public.relatorio_operadores_responsavel() to authenticated;
 