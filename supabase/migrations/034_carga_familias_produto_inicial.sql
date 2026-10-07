-- supabase/034_carga_familias_produto_inicial.sql
--
-- Etapa 1 do módulo de Relatórios e Dashboards (07/10): carga inicial das
-- famílias de produtos, enviadas pelo dono, para os 5 clientes que já têm
-- lista. Depende da migração 033 (tabela familias_produto).
--
-- Como funciona:
--   - Cada cliente é localizado pelo CNPJ (só dígitos), nunca pelo nome:
--     o nome fantasia pode se repetir ou mudar.
--   - Se algum dos 5 CNPJs não for encontrado, a carga é CANCELADA por
--     inteiro (nada é gravado) e o erro diz quantos foram encontrados.
--   - Pode rodar mais de uma vez sem duplicar: família que já existe para o
--     cliente (mesmo nome, sem diferenciar maiúsculas) é ignorada.
--   - Não altera nem apaga nada que já exista.
--
-- Resultado esperado (primeira execução): 36 famílias inseridas.
--   LABOR 9 + WVA 9 + FERMAQUINAS 8 + 7Y 5 + GY 5.
--
-- A RMS (42.670.979/0001-55) ainda não tem lista enviada e fica de fora.
--
-- Grafia padronizada (maiúsculas/minúsculas e acentos) em relação à tabela
-- original: "HIDRAULICA" -> Hidráulica; "CAIXA D´ÁGUA" -> Caixa d'água;
-- "FERRAMENTAS AUTOMOTIVOS" -> Ferramentas automotivas; "ACESSORIOS" ->
-- Acessórios; "LENÇO UMID." -> Lenço umedecido; as famílias "DIV." viraram
-- "Diversos — <segmento>".
--
-- Para desfazer esta carga (somente se nenhum item já estiver ligado a
-- essas famílias):
--   delete from public.familias_produto;

do $$
declare
  v_encontrados integer;
  v_inseridas integer;
begin
  create temporary table tmp_familias_carga (cnpj text, nome text) on commit drop;

  insert into tmp_familias_carga (cnpj, nome) values
    -- LABOR ATACADISTA LTDA -------------------------------------------------
    ('59069371000172', 'Elétrica'),
    ('59069371000172', 'Hidráulica'),
    ('59069371000172', 'Louças sanitárias'),
    ('59069371000172', 'Caixa d''água'),
    ('59069371000172', 'Metais sanitários'),
    ('59069371000172', 'Acessórios sanitários'),
    ('59069371000172', 'Tintas e complementos'),
    ('59069371000172', 'Ferramentas de pintura'),
    ('59069371000172', 'Diversos — Matcon'),
    -- WVA COM DE MIUDEZAS E ACESSORIOS LTDA -----------------------------------
    ('37107089000108', 'Elétrica'),
    ('37107089000108', 'Hidráulica'),
    ('37107089000108', 'Louças sanitárias'),
    ('37107089000108', 'Caixa d''água'),
    ('37107089000108', 'Metais sanitários'),
    ('37107089000108', 'Acessórios sanitários'),
    ('37107089000108', 'Tintas e complementos'),
    ('37107089000108', 'Ferramentas de pintura'),
    ('37107089000108', 'Diversos — Matcon'),
    -- FERMAQUINAS COM DE FER E MAQ LTDA ---------------------------------------
    ('68452762000324', 'Ferramentas manuais'),
    ('68452762000324', 'Ferramentas elétricas'),
    ('68452762000324', 'Ferramentas pneumáticas'),
    ('68452762000324', 'Ferramentas automotivas'),
    ('68452762000324', 'Acessórios'),
    ('68452762000324', 'Abrasivos'),
    ('68452762000324', 'Máquinas diversas'),
    ('68452762000324', 'Diversos — Máquinas e ferramentas'),
    -- 7Y DISTRIBUIDORA DE FRALDAS LTDA ----------------------------------------
    ('07018219000167', 'Absorvente'),
    ('07018219000167', 'Fralda'),
    ('07018219000167', 'Lenço umedecido'),
    ('07018219000167', 'Luva'),
    ('07018219000167', 'Diversos — Higiene'),
    -- GY DISTR E TRANSP DE HIG LTDA -------------------------------------------
    ('23112563000177', 'Absorvente'),
    ('23112563000177', 'Fralda'),
    ('23112563000177', 'Lenço umedecido'),
    ('23112563000177', 'Luva'),
    ('23112563000177', 'Diversos — Higiene');

  -- Confere que os 5 clientes existem antes de gravar qualquer coisa.
  select count(distinct t.cnpj)
    into v_encontrados
  from tmp_familias_carga t
  join public.clientes c
    on regexp_replace(c.cnpj, '\D', '', 'g') = t.cnpj;

  if v_encontrados <> 5 then
    raise exception 'Carga cancelada: foram encontrados % de 5 clientes pelo CNPJ. Nada foi gravado.', v_encontrados;
  end if;

  insert into public.familias_produto (cliente_id, nome)
  select c.id, t.nome
  from tmp_familias_carga t
  join public.clientes c
    on regexp_replace(c.cnpj, '\D', '', 'g') = t.cnpj
  where not exists (
    select 1
    from public.familias_produto f
    where f.cliente_id = c.id
      and lower(btrim(f.nome)) = lower(btrim(t.nome))
  );

  get diagnostics v_inseridas = row_count;
  raise notice 'Famílias inseridas: % (esperado na primeira execução: 36).', v_inseridas;
end;
$$;

-- Conferência (rode depois, separadamente): total de famílias por cliente.
-- Esperado: LABOR 9, WVA 9, FERMAQUINAS 8, 7Y 5, GY DISTR 5.
--
-- select c.nome_fantasia, count(*) as familias
-- from public.familias_produto f
-- join public.clientes c on c.id = f.cliente_id
-- group by c.nome_fantasia
-- order by c.nome_fantasia;
