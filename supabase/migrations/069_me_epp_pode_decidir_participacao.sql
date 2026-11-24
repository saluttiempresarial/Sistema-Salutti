-- supabase/migrations/069_me_epp_pode_decidir_participacao.sql
--
-- A empresa ME/EPP (Microempresa/Empresa de Pequeno Porte) passa a escolher se
-- participa ou não de uma licitação, como qualquer outro cliente (24/11/2026).
-- Remove da função registrar_decisao_cliente o bloqueio pela empresa inteira
-- ("Empresas classificadas como ME/EPP não podem confirmar participação pelo
-- sistema"), criado na migração 025.
--
-- O que NÃO muda: o bloqueio por item "Exclusivo ME/EPP" (empresa "Demais" não
-- participa de licitação ou item exclusivo para ME/EPP) e todas as regras de
-- prazo e de permissão da função.
--
-- Como funciona: em vez de reescrever a função inteira (e correr o risco de
-- apagar alterações feitas depois da migração 052), o script lê a definição
-- ATUAL da função no banco, retira só o trecho do bloqueio e recria a função.
-- Se o trecho não for encontrado, o script para com um aviso e não altera nada.
-- Pode ser executado mais de uma vez com segurança.

do $$
declare
  v_def_antiga text;
  v_def_nova   text;
begin
  select pg_get_functiondef(p.oid)
    into v_def_antiga
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'registrar_decisao_cliente';

  if v_def_antiga is null then
    raise exception 'Função registrar_decisao_cliente não encontrada.';
  end if;

  v_def_nova := regexp_replace(
    v_def_antiga,
    'if\s+v_porte_cliente\s*=\s*''me_epp''\s+then\s+raise\s+exception\s+''Empresas classificadas como ME/EPP[^'']*'';\s+end\s+if;',
    '',
    'g'
  );

  if v_def_nova = v_def_antiga then
    -- Já sem o bloqueio (script executado antes) ou o texto da função é diferente do esperado.
    if v_def_antiga like '%Empresas classificadas como ME/EPP%' then
      raise exception 'Trecho do bloqueio ME/EPP não foi reconhecido. Nada foi alterado; envie a definição da função para ajuste manual.';
    end if;
    raise notice 'A função já está sem o bloqueio ME/EPP. Nada a fazer.';
    return;
  end if;

  execute v_def_nova;
  raise notice 'Bloqueio ME/EPP removido de registrar_decisao_cliente.';
end
$$;

-- Conferência: deve retornar "false" (a função não menciona mais o bloqueio).
select pg_get_functiondef(p.oid) like '%Empresas classificadas como ME/EPP%' as ainda_tem_bloqueio
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'registrar_decisao_cliente';
