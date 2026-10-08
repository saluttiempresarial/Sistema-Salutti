// src/utils/indicadoresCalculos.ts
//
// Cálculo dos 8 indicadores do painel do Administrador (Especificação de
// 07/10/2026, seções 5 e 8). Funções puras: recebem os dados já carregados
// (ver relatorioIndicadoresService.ts) e os filtros, e devolvem os números.
//
// REGRAS ADOTADAS (aprovadas pelo Márcio em 08/10):
//   - Preço mínimo = mínimo C/ FRETE, igual ao da tela de Disputa
//     (calcularAnaliseItem com o percentual de frete da licitação).
//   - Vitória/derrota só contam itens e grupos com resultado "ganho" ou
//     "perdido". Fracassado, deserto e cancelado não dependem da condução da
//     disputa e ficam fora das taxas.
//   - O resultado do GRUPO é do lote inteiro e não tem família: nos
//     indicadores por família os grupos aparecem numa barra própria
//     ("Grupos"). Itens de um grupo que já tem resultado de grupo não são
//     contados de novo (evita contar em dobro no modo "Grupo e item").
//   - Nomes de órgão e de concorrente são agrupados ignorando maiúsculas,
//     minúsculas, acentos e espaços repetidos.
//   - "Participou" no funil = o cliente confirmou participação
//     (decisaoCliente = 'participar'). "Ganhou" = ao menos um item/grupo
//     ganho.

import type { Licitacao, ItemLicitacao } from '../types/licitacao';
import type { Disputa } from '../types/disputa';
import {
  CHAVE_GRUPOS,
  CHAVE_SEM_FAMILIA,
  FILTRO_SEM_FAMILIA,
  type BarraFamilia,
  type BarraOrgao,
  type Concorrente,
  type DadosBaseIndicadores,
  type EtapaFunil,
  type FiltrosIndicadores,
  type GanhoSobreMinimo,
  type IndicadoresAdmin,
  type PerdaEvitavel,
  type PerdasEvitaveis,
  type TaxaVitoria,
  type UnidadeResultado,
  type VolumeMes,
} from '../types/indicadores';
import { calcularAnaliseItem, totalReferenciaOportunidade } from './licitacaoCalculos';

const LIMITE_TOP = 10;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Minúsculas, sem acento e sem espaços repetidos — para agrupar nomes. */
export function normalizarNome(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function dataDaLicitacao(l: Licitacao): string {
  return l.dataEfetivaLicitacao || l.dataLicitacao;
}

/** YYYY-MM-DD no fuso local da data ISO informada. */
function diaLocal(iso: string): string {
  const d = new Date(iso);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function dentroDoPeriodo(iso: string | undefined, de?: string, ate?: string): boolean {
  if (!de && !ate) return true;
  if (!iso) return false;
  const dia = diaLocal(iso);
  if (de && dia < de) return false;
  if (ate && dia > ate) return false;
  return true;
}

function somarDias(dia: string, dias: number): string {
  const [ano, mes, d] = dia.split('-').map(Number);
  const data = new Date(ano, mes - 1, d + dias);
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const dd = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${m}-${dd}`;
}

function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  const ms = new Date(a2, m2 - 1, d2).getTime() - new Date(a1, m1 - 1, d1).getTime();
  return Math.round(ms / 86_400_000);
}

/** Período anterior de mesma duração; null se De e Até não estiverem ambos preenchidos. */
export function periodoAnterior(filtros: FiltrosIndicadores): { dataDe: string; dataAte: string } | null {
  if (!filtros.dataDe || !filtros.dataAte || filtros.dataAte < filtros.dataDe) return null;
  const duracao = diasEntre(filtros.dataDe, filtros.dataAte) + 1;
  return { dataDe: somarDias(filtros.dataDe, -duracao), dataAte: somarDias(filtros.dataDe, -1) };
}

function valorReferenciaLicitacao(l: Licitacao): number {
  return l.valorTotalLicitacao ?? totalReferenciaOportunidade(l.itens);
}

function taxaFreteDaLicitacao(l: Licitacao): number {
  return l.percentualFrete ?? 0;
}

function itemTemProposta(item: ItemLicitacao): boolean {
  return item.propostaCliente?.precoMinimo != null;
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

/** Licitações que passam nos filtros de período, cliente, modalidade e família.
 *  Com filtro de família, só entram licitações que têm ao menos um item da
 *  família (ou, para "sem família", ao menos um item sem família). */
export function filtrarLicitacoes(licitacoes: Licitacao[], filtros: FiltrosIndicadores): Licitacao[] {
  return licitacoes.filter((l) => {
    if (!dentroDoPeriodo(dataDaLicitacao(l), filtros.dataDe, filtros.dataAte)) return false;
    if (filtros.clienteId && l.clienteId !== filtros.clienteId) return false;
    if (filtros.modalidade && l.modalidade !== filtros.modalidade) return false;
    if (filtros.familiaId) {
      const alvo = filtros.familiaId;
      const temItem = l.itens.some((i) => (alvo === FILTRO_SEM_FAMILIA ? !i.familiaId : i.familiaId === alvo));
      if (!temItem) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Resultados por item/grupo, já resolvidos
// ---------------------------------------------------------------------------

function rotuloDoGrupo(l: Licitacao, grupoId: string): string {
  const grupo = l.grupos.find((g) => g.id === grupoId);
  if (!grupo) return 'Grupo';
  return grupo.nome?.trim() ? grupo.nome : `Grupo ${grupo.numero}`;
}

/** Achata as linhas de disputa das licitações informadas em unidades
 *  (item ou grupo) com os valores em total. */
export function montarUnidades(
  licitacoes: Licitacao[],
  disputas: Disputa[],
  filtroFamilia?: string
): UnidadeResultado[] {
  const licitacaoPorId = new Map(licitacoes.map((l) => [l.id, l]));
  const unidades: UnidadeResultado[] = [];

  disputas.forEach((disputa) => {
    const licitacao = licitacaoPorId.get(disputa.licitacaoId);
    if (!licitacao) return;
    const taxaFrete = taxaFreteDaLicitacao(licitacao);

    // Grupos que têm resultado próprio: os itens deles não contam de novo.
    const gruposComResultado = new Set(
      disputa.itens.filter((linha) => linha.grupoId && linha.resultadoItem).map((linha) => linha.grupoId as string)
    );

    disputa.itens.forEach((linha) => {
      if (linha.itemId) {
        const item = licitacao.itens.find((i) => i.id === linha.itemId);
        if (!item) return;
        if (item.grupoId && gruposComResultado.has(item.grupoId)) return;
        if (filtroFamilia) {
          const combina = filtroFamilia === FILTRO_SEM_FAMILIA ? !item.familiaId : item.familiaId === filtroFamilia;
          if (!combina) return;
        }
        const minimoUnitario = calcularAnaliseItem(item, taxaFrete, true).precoComFrete;
        unidades.push({
          licitacaoId: licitacao.id,
          clienteId: licitacao.clienteId,
          tipo: 'item',
          rotulo: `${item.numero} — ${item.descricao}`,
          familiaId: item.familiaId,
          resultado: linha.resultadoItem,
          valorOfertado: linha.valorFechado != null ? linha.valorFechado * item.quantidade : null,
          valorMinimoComFrete: minimoUnitario != null ? minimoUnitario * item.quantidade : null,
          valorVencedor: linha.valorVencedor != null ? linha.valorVencedor * item.quantidade : null,
          nomeVencedor: linha.nomeVencedor,
        });
        return;
      }

      if (linha.grupoId) {
        // Grupo não tem família: com filtro de família ativo, fica de fora.
        if (filtroFamilia) return;
        const itensDoGrupo = licitacao.itens.filter((i) => i.grupoId === linha.grupoId);
        const minimos = itensDoGrupo.map((i) => {
          const unit = calcularAnaliseItem(i, taxaFrete, true).precoComFrete;
          return unit != null ? unit * i.quantidade : null;
        });
        // Só há mínimo do grupo quando todos os itens têm preço informado.
        const minimoGrupo =
          itensDoGrupo.length > 0 && minimos.every((m) => m != null)
            ? (minimos as number[]).reduce((soma, m) => soma + m, 0)
            : null;
        unidades.push({
          licitacaoId: licitacao.id,
          clienteId: licitacao.clienteId,
          tipo: 'grupo',
          rotulo: rotuloDoGrupo(licitacao, linha.grupoId),
          resultado: linha.resultadoItem,
          valorOfertado: linha.valorFechado ?? null,
          valorMinimoComFrete: minimoGrupo,
          valorVencedor: linha.valorVencedor ?? null,
          nomeVencedor: linha.nomeVencedor,
        });
      }
    });
  });

  return unidades;
}

// ---------------------------------------------------------------------------
// 1 — Funil
// ---------------------------------------------------------------------------
export function calcularFunil(licitacoes: Licitacao[], unidades: UnidadeResultado[]): EtapaFunil[] {
  const comGanho = new Set(unidades.filter((u) => u.resultado === 'ganho').map((u) => u.licitacaoId));
  return [
    { chave: 'analisadas', rotulo: 'Analisadas', quantidade: licitacoes.length },
    {
      chave: 'participou',
      rotulo: 'Participou',
      quantidade: licitacoes.filter((l) => l.decisaoCliente === 'participar').length,
    },
    {
      chave: 'ganhou',
      rotulo: 'Ganhou',
      quantidade: licitacoes.filter((l) => comGanho.has(l.id)).length,
    },
  ];
}

// ---------------------------------------------------------------------------
// 2 — Taxa de vitória
// ---------------------------------------------------------------------------
export function calcularTaxaVitoria(unidades: UnidadeResultado[]): TaxaVitoria {
  const ganhas = unidades.filter((u) => u.resultado === 'ganho');
  const perdidas = unidades.filter((u) => u.resultado === 'perdido');
  const soma = (lista: UnidadeResultado[]) => lista.reduce((s, u) => s + (u.valorOfertado ?? 0), 0);
  const valorAdjudicado = soma(ganhas);
  const valorDisputado = valorAdjudicado + soma(perdidas);
  const disputados = ganhas.length + perdidas.length;
  return {
    ganhos: ganhas.length,
    perdidos: perdidas.length,
    valorAdjudicado,
    valorDisputado,
    percentualQuantidade: disputados > 0 ? (ganhas.length / disputados) * 100 : null,
    percentualValor: valorDisputado > 0 ? (valorAdjudicado / valorDisputado) * 100 : null,
  };
}

// ---------------------------------------------------------------------------
// 3 — Volume por período (mês)
// ---------------------------------------------------------------------------
const MESES_ABREVIADOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function calcularVolumePorMes(licitacoes: Licitacao[]): VolumeMes[] {
  const mapa = new Map<string, VolumeMes>();
  licitacoes.forEach((l) => {
    const dia = diaLocal(dataDaLicitacao(l));
    const mes = dia.slice(0, 7);
    const numeroMes = Number(mes.slice(5, 7));
    const atual = mapa.get(mes) ?? {
      mes,
      rotulo: `${MESES_ABREVIADOS[numeroMes - 1]}/${mes.slice(0, 4)}`,
      licitacoes: 0,
      valor: 0,
    };
    atual.licitacoes += 1;
    atual.valor += valorReferenciaLicitacao(l);
    mapa.set(mes, atual);
  });
  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

// ---------------------------------------------------------------------------
// 4 — Famílias mais cotadas e mais ganhas (top 10)
// ---------------------------------------------------------------------------
export function calcularFamilias(
  licitacoes: Licitacao[],
  unidades: UnidadeResultado[],
  nomeDaFamilia: (id: string) => string
): BarraFamilia[] {
  const mapa = new Map<string, BarraFamilia>();
  function barra(chave: string, nome: string): BarraFamilia {
    const existente = mapa.get(chave);
    if (existente) return existente;
    const nova = { chave, nome, cotadas: 0, ganhas: 0 };
    mapa.set(chave, nova);
    return nova;
  }
  function chaveDoItem(item: ItemLicitacao): { chave: string; nome: string } {
    return item.familiaId
      ? { chave: item.familiaId, nome: nomeDaFamilia(item.familiaId) }
      : { chave: CHAVE_SEM_FAMILIA, nome: 'Sem família' };
  }

  // Cotadas: itens soltos com preço do cliente, por família; grupos com ao
  // menos um item cotado entram na barra "Grupos" (1 por grupo).
  licitacoes.forEach((l) => {
    l.itens
      .filter((i) => !i.grupoId && itemTemProposta(i))
      .forEach((i) => {
        const { chave, nome } = chaveDoItem(i);
        barra(chave, nome).cotadas += 1;
      });
    l.grupos.forEach((g) => {
      if (l.itens.some((i) => i.grupoId === g.id && itemTemProposta(i))) {
        barra(CHAVE_GRUPOS, 'Grupos').cotadas += 1;
      }
    });
  });

  // Ganhas: itens por família; grupos na barra "Grupos".
  const itemPorId = new Map<string, ItemLicitacao>();
  licitacoes.forEach((l) => l.itens.forEach((i) => itemPorId.set(i.id, i)));
  unidades
    .filter((u) => u.resultado === 'ganho')
    .forEach((u) => {
      if (u.tipo === 'grupo') {
        barra(CHAVE_GRUPOS, 'Grupos').ganhas += 1;
      } else {
        const chave = u.familiaId ?? CHAVE_SEM_FAMILIA;
        const nome = u.familiaId ? nomeDaFamilia(u.familiaId) : 'Sem família';
        barra(chave, nome).ganhas += 1;
      }
    });

  return [...mapa.values()]
    .filter((b) => b.cotadas > 0 || b.ganhas > 0)
    .sort((a, b) => b.cotadas - a.cotadas || b.ganhas - a.ganhas || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, LIMITE_TOP);
}

// ---------------------------------------------------------------------------
// 5 — Ganho sobre o preço mínimo (só itens/grupos ganhos)
// ---------------------------------------------------------------------------
export function calcularGanhoSobreMinimo(
  unidades: UnidadeResultado[],
  nomeDaFamilia: (id: string) => string
): GanhoSobreMinimo {
  const base = unidades.filter(
    (u) =>
      u.resultado === 'ganho' &&
      u.valorOfertado != null &&
      u.valorOfertado > 0 &&
      u.valorMinimoComFrete != null &&
      u.valorMinimoComFrete > 0
  );

  function percentual(lista: UnidadeResultado[]): number | null {
    const ofertado = lista.reduce((s, u) => s + (u.valorOfertado ?? 0), 0);
    const minimo = lista.reduce((s, u) => s + (u.valorMinimoComFrete ?? 0), 0);
    return minimo > 0 ? ((ofertado - minimo) / minimo) * 100 : null;
  }

  const grupos = new Map<string, { nome: string; lista: UnidadeResultado[] }>();
  base.forEach((u) => {
    const chave = u.tipo === 'grupo' ? CHAVE_GRUPOS : (u.familiaId ?? CHAVE_SEM_FAMILIA);
    const nome = u.tipo === 'grupo' ? 'Grupos' : u.familiaId ? nomeDaFamilia(u.familiaId) : 'Sem família';
    const atual = grupos.get(chave) ?? { nome, lista: [] };
    atual.lista.push(u);
    grupos.set(chave, atual);
  });

  return {
    geral: percentual(base),
    porFamilia: [...grupos.entries()]
      .map(([chave, { nome, lista }]) => ({ chave, nome, percentual: percentual(lista), quantidade: lista.length }))
      .sort((a, b) => (b.percentual ?? -Infinity) - (a.percentual ?? -Infinity))
      .slice(0, LIMITE_TOP),
  };
}

// ---------------------------------------------------------------------------
// 6 — Perdas evitáveis: perdemos, e o vencedor ficou igual ou acima do nosso
//     preço mínimo (c/ frete): havia espaço para lance e ele não foi usado.
// ---------------------------------------------------------------------------
export function calcularPerdasEvitaveis(
  licitacoes: Licitacao[],
  unidades: UnidadeResultado[],
  nomeDoCliente: (id: string) => string
): PerdasEvitaveis {
  const licitacaoPorId = new Map(licitacoes.map((l) => [l.id, l]));
  const linhas: PerdaEvitavel[] = unidades
    .filter(
      (u) =>
        u.resultado === 'perdido' &&
        u.valorVencedor != null &&
        u.valorMinimoComFrete != null &&
        u.valorMinimoComFrete > 0 &&
        u.valorVencedor >= u.valorMinimoComFrete
    )
    .map((u) => ({
      licitacaoId: u.licitacaoId,
      numeroPregao: licitacaoPorId.get(u.licitacaoId)?.numeroPregao ?? '—',
      cliente: nomeDoCliente(u.clienteId),
      rotulo: u.rotulo,
      ehGrupo: u.tipo === 'grupo',
      valorNosso: u.valorOfertado,
      valorVencedor: u.valorVencedor as number,
      valorMinimo: u.valorMinimoComFrete as number,
      nomeVencedor: u.nomeVencedor?.trim() || 'não informado',
    }))
    .sort((a, b) => b.valorVencedor - a.valorVencedor);

  return { linhas, totalVencedor: linhas.reduce((s, l) => s + l.valorVencedor, 0) };
}

// ---------------------------------------------------------------------------
// 7 — Órgãos (top 10 por participação e vitórias)
// ---------------------------------------------------------------------------
export function calcularOrgaos(licitacoes: Licitacao[], unidades: UnidadeResultado[]): BarraOrgao[] {
  const comGanho = new Set(unidades.filter((u) => u.resultado === 'ganho').map((u) => u.licitacaoId));
  const mapa = new Map<string, BarraOrgao>();
  licitacoes.forEach((l) => {
    const nome = l.orgao.trim() || '—';
    const chave = normalizarNome(nome);
    const atual = mapa.get(chave) ?? { orgao: nome, participacoes: 0, vitorias: 0 };
    if (l.decisaoCliente === 'participar') atual.participacoes += 1;
    if (comGanho.has(l.id)) atual.vitorias += 1;
    mapa.set(chave, atual);
  });
  return [...mapa.values()]
    .filter((o) => o.participacoes > 0 || o.vitorias > 0)
    .sort((a, b) => b.participacoes - a.participacoes || b.vitorias - a.vitorias || a.orgao.localeCompare(b.orgao, 'pt-BR'))
    .slice(0, LIMITE_TOP);
}

// ---------------------------------------------------------------------------
// 8 — Concorrentes que mais vencem o cliente (top 10)
// ---------------------------------------------------------------------------
export function calcularConcorrentes(unidades: UnidadeResultado[]): Concorrente[] {
  const mapa = new Map<string, Concorrente>();
  unidades
    .filter((u) => u.resultado === 'perdido' && u.nomeVencedor?.trim())
    .forEach((u) => {
      const nome = (u.nomeVencedor as string).trim();
      const chave = normalizarNome(nome);
      const atual = mapa.get(chave) ?? { nome, vitorias: 0, valorTotal: 0 };
      atual.vitorias += 1;
      atual.valorTotal += u.valorVencedor ?? 0;
      mapa.set(chave, atual);
    });
  return [...mapa.values()]
    .sort((a, b) => b.vitorias - a.vitorias || b.valorTotal - a.valorTotal || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, LIMITE_TOP);
}

// ---------------------------------------------------------------------------
// Conjunto completo (painel do Administrador)
// ---------------------------------------------------------------------------
export function calcularIndicadoresAdmin(dados: DadosBaseIndicadores, filtros: FiltrosIndicadores): IndicadoresAdmin {
  const nomeDaFamilia = (id: string) => dados.familias.find((f) => f.id === id)?.nome ?? 'Família removida';
  const nomeDoCliente = (id: string) => dados.clientes.find((c) => c.id === id)?.nome ?? '—';

  const licitacoes = filtrarLicitacoes(dados.licitacoes, filtros);
  const unidades = montarUnidades(licitacoes, dados.disputas, filtros.familiaId);

  // Período anterior (mesmos demais filtros) para a variação da taxa de vitória.
  const anterior = periodoAnterior(filtros);
  let taxaAnterior: TaxaVitoria | null = null;
  if (anterior) {
    const licitacoesAnteriores = filtrarLicitacoes(dados.licitacoes, { ...filtros, ...anterior });
    taxaAnterior = calcularTaxaVitoria(montarUnidades(licitacoesAnteriores, dados.disputas, filtros.familiaId));
  }

  return {
    funil: calcularFunil(licitacoes, unidades),
    taxaVitoria: { atual: calcularTaxaVitoria(unidades), anterior: taxaAnterior },
    volumePorMes: calcularVolumePorMes(licitacoes),
    // Com filtro de família, o gráfico mostra só a família escolhida.
    familias: calcularFamilias(licitacoes, unidades, nomeDaFamilia).filter(
      (barra) => !filtros.familiaId || barra.chave === filtros.familiaId
    ),
    ganhoSobreMinimo: calcularGanhoSobreMinimo(unidades, nomeDaFamilia),
    perdasEvitaveis: calcularPerdasEvitaveis(licitacoes, unidades, nomeDoCliente),
    orgaos: calcularOrgaos(licitacoes, unidades),
    concorrentes: calcularConcorrentes(unidades),
    totalLicitacoes: licitacoes.length,
  };
}
