// src/utils/indicadoresCalculos.ts
//
// Cálculo dos indicadores do painel (Especificação de 07/10/2026, seções 3, 5
// e 8): os 8 da primeira entrega e os de preço e competitividade (valor
// adjudicado, ticket médio, fora de mercado, distância da derrota e desconto
// médio). Funções puras: recebem os dados já carregados
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
//   - Produtos e marcas: marca e produto vêm da proposta do cliente por item.
//     Marcas: cotadas e ganhas contam só itens soltos (itens de grupo têm
//     resultado de grupo). Produto = código interno, ou marca e modelo, ou a
//     descrição do produto. "Nunca ganhos" = produtos já disputados (ganho ou
//     perdido) com nenhuma vitória. Concorrentes por família: só perdas com o
//     nome do vencedor informado.
//   - Pipeline: a fase sai da decisão do cliente, da proposta e do resultado
//     da disputa (sem campo novo no banco). "Em análise" da Salutti ainda não
//     é distinguível de "aguardando cliente": falta a data de envio da análise.
//   - Prazos: licitação em aberto (não finalizada nem recusada) com sessão
//     futura cujo prazo interno (regra de Configurações) já passou ou vence
//     nos próximos 7 dias.
//   - Filtros: órgão e marca comparam o nome normalizado (como no
//     agrupamento). Marca é de item: a licitação entra se tiver ao menos um
//     item da marca e os resultados passam a considerar só esses itens (grupos
//     ficam de fora, como no filtro de família). Resultado = ganho, perdido,
//     em andamento ou não participou (recusa, ou sessão passada sem decisão).
//     Status = fase do pipeline.
//   - "Participou" no funil = o cliente confirmou participação
//     (decisaoCliente = 'participar'). "Ganhou" = ao menos um item/grupo
//     ganho.

import type { Licitacao, ItemLicitacao } from '../types/licitacao';
import type { Disputa } from '../types/disputa';
import {
  CHAVE_GRUPOS,
  CHAVE_SEM_FAMILIA,
  CHAVE_SEM_MARCA,
  FILTRO_SEM_FAMILIA,
  type BarraFamilia,
  type BarraMarca,
  type BarraOrgao,
  type Concorrente,
  type ConcorrentesFamilia,
  type DadosBaseIndicadores,
  type EtapaFunil,
  type EtapaPipeline,
  type FasePipeline,
  type FiltrosIndicadores,
  type ForaDeMercado,
  type GanhoSobreMinimo,
  type IndicadoresAdmin,
  type IndicadorPercentual,
  type ItemForaDeMercado,
  type OpcaoFiltro,
  type ResultadoLicitacaoFiltro,
  type PerdaEvitavel,
  type PerdasEvitaveis,
  type ProdutoNuncaGanho,
  type ProdutosNuncaGanhos,
  type Pipeline,
  type PrazoProximo,
  type PrazosProximos,
  type TaxaFamilia,
  type TaxaVitoria,
  type TaxaVitoriaFamilia,
  type UnidadeResultado,
  type ValorAdjudicado,
  type ValorAdjudicadoMes,
  type VolumeMes,
} from '../types/indicadores';
import { calcularAnaliseItem, totalReferenciaItem, totalReferenciaOportunidade } from './licitacaoCalculos';
import { calcularPrazoInterno, classificarUrgenciaPrazo } from './prazoUtils';

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

function marcaDoItem(item: ItemLicitacao): string {
  return normalizarNome(item.propostaCliente?.marca ?? '');
}

/** Produto ofertado pelo cliente: código interno, marca e modelo, ou a
 *  descrição do produto, nessa ordem de preferência. null = nada informado. */
function produtoDoItem(item: ItemLicitacao): { chave: string; nome: string } | null {
  const p = item.propostaCliente;
  if (!p) return null;
  const codigo = (p.codigoInterno ?? '').trim();
  const marcaModelo = [p.marca, p.modelo]
    .map((t) => (t ?? '').trim())
    .filter(Boolean)
    .join(' ');
  const descricao = (p.descricaoProduto ?? '').trim();
  if (codigo) return { chave: normalizarNome(codigo), nome: `${codigo} — ${descricao || marcaModelo || 'sem descrição'}` };
  if (marcaModelo) return { chave: normalizarNome(marcaModelo), nome: marcaModelo };
  if (descricao) return { chave: normalizarNome(descricao), nome: descricao };
  return null;
}

/** Resultado da licitação para o filtro "Resultado": o desfecho da disputa
 *  manda; sem desfecho, recusa ou sessão passada sem decisão = não
 *  participou; o resto está em andamento. */
export function resultadoDaLicitacao(
  l: Licitacao,
  disputa: Disputa | undefined,
  agora: Date = new Date()
): ResultadoLicitacaoFiltro {
  const desfecho = desfechoFinal(l, disputa);
  if (desfecho === 'ganha') return 'ganho';
  if (desfecho === 'perdida') return 'perdido';
  if (l.decisaoCliente === 'recusar') return 'nao_participou';
  if (l.decisaoCliente === 'pendente' && new Date(dataDaLicitacao(l)) < agora) return 'nao_participou';
  return 'em_andamento';
}

/** Licitações que passam nos filtros de período, cliente, modalidade, família,
 *  órgão, marca, resultado e fase (status). Com filtro de família, só entram
 *  licitações que têm ao menos um item da família (ou, para "sem família", ao
 *  menos um item sem família); o filtro de marca funciona igual. As disputas
 *  só são necessárias para os filtros de resultado e de fase. */
export function filtrarLicitacoes(
  licitacoes: Licitacao[],
  filtros: FiltrosIndicadores,
  disputas: Disputa[] = [],
  agora: Date = new Date()
): Licitacao[] {
  const disputaPorLicitacao =
    filtros.resultado || filtros.fase ? new Map(disputas.map((d) => [d.licitacaoId, d])) : null;
  return licitacoes.filter((l) => {
    if (!dentroDoPeriodo(dataDaLicitacao(l), filtros.dataDe, filtros.dataAte)) return false;
    if (filtros.clienteId && l.clienteId !== filtros.clienteId) return false;
    if (filtros.modalidade && l.modalidade !== filtros.modalidade) return false;
    if (filtros.familiaId) {
      const alvo = filtros.familiaId;
      const temItem = l.itens.some((i) => (alvo === FILTRO_SEM_FAMILIA ? !i.familiaId : i.familiaId === alvo));
      if (!temItem) return false;
    }
    if (filtros.orgao && normalizarNome(l.orgao) !== filtros.orgao) return false;
    if (filtros.marca && !l.itens.some((i) => marcaDoItem(i) === filtros.marca)) return false;
    if (disputaPorLicitacao) {
      const disputa = disputaPorLicitacao.get(l.id);
      if (filtros.resultado && resultadoDaLicitacao(l, disputa, agora) !== filtros.resultado) return false;
      if (filtros.fase && faseDaLicitacao(l, disputa, agora) !== filtros.fase) return false;
    }
    return true;
  });
}

function opcoesDistintas(textos: string[]): OpcaoFiltro[] {
  const mapa = new Map<string, string>();
  textos.forEach((texto) => {
    const rotulo = texto.trim().replace(/\s+/g, ' ');
    const chave = normalizarNome(rotulo);
    if (chave && !mapa.has(chave)) mapa.set(chave, rotulo);
  });
  return [...mapa.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/** Órgãos distintos (agrupados ignorando maiúsculas, acentos e espaços). */
export function listarOpcoesOrgaos(licitacoes: Licitacao[]): OpcaoFiltro[] {
  return opcoesDistintas(licitacoes.map((l) => l.orgao ?? ''));
}

/** Marcas distintas informadas nas propostas dos clientes. */
export function listarOpcoesMarcas(licitacoes: Licitacao[]): OpcaoFiltro[] {
  return opcoesDistintas(licitacoes.flatMap((l) => l.itens.map((i) => i.propostaCliente?.marca ?? '')));
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
  filtroFamilia?: string,
  filtroMarca?: string
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
        if (filtroMarca && marcaDoItem(item) !== filtroMarca) return;
        const minimoUnitario = calcularAnaliseItem(item, taxaFrete, true).precoComFrete;
        unidades.push({
          licitacaoId: licitacao.id,
          clienteId: licitacao.clienteId,
          tipo: 'item',
          rotulo: `${item.numero} — ${item.descricao}`,
          familiaId: item.familiaId,
          marca: item.propostaCliente?.marca?.trim() || undefined,
          produtoChave: produtoDoItem(item)?.chave,
          produtoNome: produtoDoItem(item)?.nome,
          resultado: linha.resultadoItem,
          valorOfertado: linha.valorFechado != null ? linha.valorFechado * item.quantidade : null,
          valorMinimoComFrete: minimoUnitario != null ? minimoUnitario * item.quantidade : null,
          valorReferencia: totalReferenciaItem(item) > 0 ? totalReferenciaItem(item) : null,
          valorVencedor: linha.valorVencedor != null ? linha.valorVencedor * item.quantidade : null,
          nomeVencedor: linha.nomeVencedor,
        });
        return;
      }

      if (linha.grupoId) {
        // Grupo não tem família nem marca: com filtro de família ou de marca
        // ativo, fica de fora.
        if (filtroFamilia || filtroMarca) return;
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
        const referenciaGrupo = itensDoGrupo.reduce((soma, i) => soma + totalReferenciaItem(i), 0);
        unidades.push({
          licitacaoId: licitacao.id,
          clienteId: licitacao.clienteId,
          tipo: 'grupo',
          rotulo: rotuloDoGrupo(licitacao, linha.grupoId),
          resultado: linha.resultadoItem,
          valorOfertado: linha.valorFechado ?? null,
          valorMinimoComFrete: minimoGrupo,
          valorReferencia: referenciaGrupo > 0 ? referenciaGrupo : null,
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
  nomeDaFamilia: (id: string) => string,
  filtroMarca?: string
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
      .filter((i) => !i.grupoId && itemTemProposta(i) && (!filtroMarca || marcaDoItem(i) === filtroMarca))
      .forEach((i) => {
        const { chave, nome } = chaveDoItem(i);
        barra(chave, nome).cotadas += 1;
      });
    if (filtroMarca) return; // grupo não tem marca
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
// Preço e competitividade (Especificação, seções 3.3 e 3.5)
// ---------------------------------------------------------------------------

/** Agrupa unidades por família (grupos numa barra própria) e calcula um
 *  percentual para o conjunto todo e para cada família. */
function percentualPorFamilia(
  base: UnidadeResultado[],
  nomeDaFamilia: (id: string) => string,
  percentual: (lista: UnidadeResultado[]) => number | null
): IndicadorPercentual {
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
    quantidade: base.length,
    porFamilia: [...grupos.entries()]
      .map(([chave, { nome, lista }]) => ({ chave, nome, percentual: percentual(lista), quantidade: lista.length }))
      .sort((a, b) => (b.percentual ?? -Infinity) - (a.percentual ?? -Infinity))
      .slice(0, LIMITE_TOP),
  };
}

// Valor adjudicado por mês (mês da licitação) e ticket médio por licitação
// ganha. "Ganha" = ao menos um item/grupo ganho, igual ao funil. O valor é o
// valor OFERTADO dos itens/grupos ganhos, o mesmo da taxa de vitória.
export function calcularValorAdjudicado(licitacoes: Licitacao[], unidades: UnidadeResultado[]): ValorAdjudicado {
  const licitacaoPorId = new Map(licitacoes.map((l) => [l.id, l]));
  const ganhos = unidades.filter((u) => u.resultado === 'ganho');
  const comGanho = new Set(ganhos.map((u) => u.licitacaoId));

  const meses = new Map<string, ValorAdjudicadoMes>();
  function mesDe(licitacaoId: string): ValorAdjudicadoMes | null {
    const l = licitacaoPorId.get(licitacaoId);
    if (!l) return null;
    const mes = diaLocal(dataDaLicitacao(l)).slice(0, 7);
    const existente = meses.get(mes);
    if (existente) return existente;
    const nova: ValorAdjudicadoMes = {
      mes,
      rotulo: `${MESES_ABREVIADOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`,
      valor: 0,
      licitacoesGanhas: 0,
    };
    meses.set(mes, nova);
    return nova;
  }

  comGanho.forEach((id) => {
    const m = mesDe(id);
    if (m) m.licitacoesGanhas += 1;
  });
  let total = 0;
  ganhos.forEach((u) => {
    const valor = u.valorOfertado ?? 0;
    total += valor;
    const m = mesDe(u.licitacaoId);
    if (m) m.valor += valor;
  });

  return {
    total,
    licitacoesGanhas: comGanho.size,
    ticketMedio: comGanho.size > 0 ? total / comGanho.size : null,
    porMes: [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
  };
}

// Fora de mercado: perdemos e o vencedor ficou ABAIXO do nosso mínimo c/ frete
// (estritamente menor). É o complemento das perdas evitáveis, que usam vencedor
// maior ou igual ao mínimo, então um item nunca aparece nos dois.
export function calcularForaDeMercado(
  licitacoes: Licitacao[],
  unidades: UnidadeResultado[],
  nomeDoCliente: (id: string) => string
): ForaDeMercado {
  const licitacaoPorId = new Map(licitacoes.map((l) => [l.id, l]));
  const perdidosComBase = unidades.filter(
    (u) =>
      u.resultado === 'perdido' &&
      u.valorVencedor != null &&
      u.valorVencedor > 0 &&
      u.valorMinimoComFrete != null &&
      u.valorMinimoComFrete > 0
  );
  const fora = perdidosComBase.filter((u) => (u.valorVencedor as number) < (u.valorMinimoComFrete as number));

  const linhas: ItemForaDeMercado[] = fora
    .map((u) => {
      const minimo = u.valorMinimoComFrete as number;
      const vencedor = u.valorVencedor as number;
      return {
        licitacaoId: u.licitacaoId,
        numeroPregao: licitacaoPorId.get(u.licitacaoId)?.numeroPregao ?? '—',
        cliente: nomeDoCliente(u.clienteId),
        rotulo: u.rotulo,
        ehGrupo: u.tipo === 'grupo',
        valorNosso: u.valorOfertado,
        valorVencedor: vencedor,
        valorMinimo: minimo,
        percentualAbaixo: ((minimo - vencedor) / minimo) * 100,
      };
    })
    .sort((a, b) => b.percentualAbaixo - a.percentualAbaixo);

  const somaMinimo = linhas.reduce((s, l) => s + l.valorMinimo, 0);
  const somaVencedor = linhas.reduce((s, l) => s + l.valorVencedor, 0);
  return {
    quantidade: linhas.length,
    baseComVencedor: perdidosComBase.length,
    percentual: perdidosComBase.length > 0 ? (linhas.length / perdidosComBase.length) * 100 : null,
    distanciaMedia: somaMinimo > 0 ? ((somaMinimo - somaVencedor) / somaMinimo) * 100 : null,
    linhas,
  };
}

// Distância da derrota: nas perdas por preço, quanto o nosso valor final ficou
// acima do vencedor. Ponderada por valor: soma ofertada ÷ soma dos vencedores
// − 1. Só entram perdidos com os dois valores preenchidos e com a nossa oferta
// maior ou igual à do vencedor (perder com oferta menor não foi por preço).
export function calcularDistanciaDerrota(
  unidades: UnidadeResultado[],
  nomeDaFamilia: (id: string) => string
): IndicadorPercentual {
  const base = unidades.filter(
    (u) =>
      u.resultado === 'perdido' &&
      u.valorOfertado != null &&
      u.valorOfertado > 0 &&
      u.valorVencedor != null &&
      u.valorVencedor > 0 &&
      u.valorOfertado >= u.valorVencedor
  );
  return percentualPorFamilia(base, nomeDaFamilia, (lista) => {
    const ofertado = lista.reduce((s, u) => s + (u.valorOfertado ?? 0), 0);
    const vencedor = lista.reduce((s, u) => s + (u.valorVencedor ?? 0), 0);
    return vencedor > 0 ? (ofertado / vencedor - 1) * 100 : null;
  });
}

// Desconto médio sobre o valor de referência do edital: nos ganhos,
// 1 − (soma ofertada ÷ soma das referências), ponderado por valor. Um valor
// negativo significa que, em média, o ganho ficou acima da referência.
export function calcularDescontoMedio(
  unidades: UnidadeResultado[],
  nomeDaFamilia: (id: string) => string
): IndicadorPercentual {
  const base = unidades.filter(
    (u) =>
      u.resultado === 'ganho' &&
      u.valorOfertado != null &&
      u.valorOfertado > 0 &&
      u.valorReferencia != null &&
      u.valorReferencia > 0
  );
  return percentualPorFamilia(base, nomeDaFamilia, (lista) => {
    const ofertado = lista.reduce((s, u) => s + (u.valorOfertado ?? 0), 0);
    const referencia = lista.reduce((s, u) => s + (u.valorReferencia ?? 0), 0);
    return referencia > 0 ? (1 - ofertado / referencia) * 100 : null;
  });
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
// Produtos e marcas
// ---------------------------------------------------------------------------
/** Taxa de vitória por família (por quantidade): só itens e grupos ganhos ou
 *  perdidos, a mesma base da taxa de vitória geral. */
export function calcularTaxaVitoriaFamilia(
  unidades: UnidadeResultado[],
  nomeDaFamilia: (id: string) => string
): TaxaVitoriaFamilia {
  const base = unidades.filter((u) => u.resultado === 'ganho' || u.resultado === 'perdido');
  const taxa = (lista: UnidadeResultado[]) => {
    const ganhos = lista.filter((u) => u.resultado === 'ganho').length;
    return { ganhos, disputados: lista.length, percentual: lista.length > 0 ? (ganhos / lista.length) * 100 : null };
  };
  const mapa = new Map<string, { nome: string; lista: UnidadeResultado[] }>();
  base.forEach((u) => {
    const chave = u.tipo === 'grupo' ? CHAVE_GRUPOS : (u.familiaId ?? CHAVE_SEM_FAMILIA);
    const nome = u.tipo === 'grupo' ? 'Grupos' : u.familiaId ? nomeDaFamilia(u.familiaId) : 'Sem família';
    const atual = mapa.get(chave) ?? { nome, lista: [] };
    atual.lista.push(u);
    mapa.set(chave, atual);
  });
  const geral = taxa(base);
  const porFamilia: TaxaFamilia[] = [...mapa.entries()]
    .map(([chave, { nome, lista }]) => ({ chave, nome, ...taxa(lista) }))
    .sort((a, b) => b.disputados - a.disputados || (b.percentual ?? 0) - (a.percentual ?? 0))
    .slice(0, LIMITE_TOP);
  return { geral: geral.percentual, ganhos: geral.ganhos, disputados: geral.disputados, porFamilia };
}

/** Marcas mais cotadas e mais ganhas (top 10). Cotadas = itens soltos com
 *  preço mínimo informado pelo cliente; ganhas = itens soltos ganhos. Itens de
 *  grupo não entram, porque o resultado é do grupo. Com filtro de família ou
 *  de marca, só os itens correspondentes. */
export function calcularMarcas(
  licitacoes: Licitacao[],
  unidades: UnidadeResultado[],
  filtroFamilia?: string,
  filtroMarca?: string
): BarraMarca[] {
  const mapa = new Map<string, BarraMarca>();
  function barra(marcaTexto: string | undefined): BarraMarca {
    const nome = (marcaTexto ?? '').trim().replace(/\s+/g, ' ');
    const chave = nome ? normalizarNome(nome) : CHAVE_SEM_MARCA;
    const existente = mapa.get(chave);
    if (existente) return existente;
    const nova = { chave, nome: nome || 'Sem marca', cotadas: 0, ganhas: 0 };
    mapa.set(chave, nova);
    return nova;
  }
  const familiaCombina = (i: ItemLicitacao) =>
    !filtroFamilia || (filtroFamilia === FILTRO_SEM_FAMILIA ? !i.familiaId : i.familiaId === filtroFamilia);

  licitacoes.forEach((l) => {
    l.itens
      .filter((i) => !i.grupoId && itemTemProposta(i) && familiaCombina(i) && (!filtroMarca || marcaDoItem(i) === filtroMarca))
      .forEach((i) => {
        barra(i.propostaCliente?.marca).cotadas += 1;
      });
  });
  unidades
    .filter((u) => u.tipo === 'item' && u.resultado === 'ganho')
    .forEach((u) => {
      barra(u.marca).ganhas += 1;
    });

  return [...mapa.values()]
    .sort((a, b) => b.cotadas - a.cotadas || b.ganhas - a.ganhas || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, LIMITE_TOP);
}

/** Produtos disputados (ganho ou perdido) que nunca ganharam. Só entram itens
 *  com produto identificado (código interno, marca e modelo ou descrição). */
export function calcularProdutosNuncaGanhos(unidades: UnidadeResultado[]): ProdutosNuncaGanhos {
  const mapa = new Map<string, { nome: string; ganhos: number; perdas: number }>();
  unidades
    .filter((u) => u.tipo === 'item' && u.produtoChave && (u.resultado === 'ganho' || u.resultado === 'perdido'))
    .forEach((u) => {
      const atual = mapa.get(u.produtoChave as string) ?? { nome: u.produtoNome ?? '', ganhos: 0, perdas: 0 };
      if (u.resultado === 'ganho') atual.ganhos += 1;
      else atual.perdas += 1;
      mapa.set(u.produtoChave as string, atual);
    });
  const nunca: ProdutoNuncaGanho[] = [...mapa.entries()]
    .filter(([, v]) => v.ganhos === 0 && v.perdas > 0)
    .map(([chave, v]) => ({ chave, nome: v.nome, perdas: v.perdas }))
    .sort((a, b) => b.perdas - a.perdas || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { totalProdutos: mapa.size, quantidade: nunca.length, linhas: nunca.slice(0, LIMITE_TOP) };
}

const LIMITE_FAMILIAS_CONCORRENCIA = 5;
const LIMITE_CONCORRENTES_POR_FAMILIA = 3;

/** Contra quem perdemos em cada família: até 5 famílias com mais perdas e, em
 *  cada uma, os 3 concorrentes que mais ganharam de nós. Só perdas com o nome
 *  do vencedor informado. */
export function calcularConcorrentesFamilia(
  unidades: UnidadeResultado[],
  nomeDaFamilia: (id: string) => string
): ConcorrentesFamilia[] {
  const familias = new Map<string, { nome: string; perdas: number; concorrentes: Map<string, { nome: string; vitorias: number }> }>();
  unidades
    .filter((u) => u.resultado === 'perdido' && u.nomeVencedor?.trim())
    .forEach((u) => {
      const chave = u.tipo === 'grupo' ? CHAVE_GRUPOS : (u.familiaId ?? CHAVE_SEM_FAMILIA);
      const nome = u.tipo === 'grupo' ? 'Grupos' : u.familiaId ? nomeDaFamilia(u.familiaId) : 'Sem família';
      const fam = familias.get(chave) ?? { nome, perdas: 0, concorrentes: new Map() };
      fam.perdas += 1;
      const nomeConcorrente = (u.nomeVencedor as string).trim();
      const chaveConcorrente = normalizarNome(nomeConcorrente);
      const conc = fam.concorrentes.get(chaveConcorrente) ?? { nome: nomeConcorrente, vitorias: 0 };
      conc.vitorias += 1;
      fam.concorrentes.set(chaveConcorrente, conc);
      familias.set(chave, fam);
    });
  return [...familias.entries()]
    .map(([chave, fam]) => ({
      chave,
      nome: fam.nome,
      perdas: fam.perdas,
      concorrentes: [...fam.concorrentes.values()]
        .sort((a, b) => b.vitorias - a.vitorias || a.nome.localeCompare(b.nome, 'pt-BR'))
        .slice(0, LIMITE_CONCORRENTES_POR_FAMILIA),
    }))
    .sort((a, b) => b.perdas - a.perdas || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, LIMITE_FAMILIAS_CONCORRENCIA);
}

// ---------------------------------------------------------------------------
// Pipeline e prazos (gestão da carteira e da operação — uso interno)
// ---------------------------------------------------------------------------
const ROTULO_FASE: Record<FasePipeline, string> = {
  aguardando_cliente: 'Aguardando o cliente',
  sem_decisao: 'Sessão passou sem decisão',
  proposta: 'Proposta em preparo',
  em_disputa: 'Em disputa',
  finalizada: 'Finalizadas',
  recusada: 'Recusadas pelo cliente',
};

const ORDEM_FASES: FasePipeline[] = [
  'aguardando_cliente',
  'sem_decisao',
  'proposta',
  'em_disputa',
  'finalizada',
  'recusada',
];

type DesfechoFinal = 'ganha' | 'perdida' | null;

/** Desfecho final da licitação: o resultado da disputa manda; sem disputa,
 *  vale o status (que a própria disputa sincroniza). */
function desfechoFinal(l: Licitacao, disputa: Disputa | undefined): DesfechoFinal {
  if (disputa) {
    if (disputa.resultado === 'ganho' || disputa.resultado === 'homologado') return 'ganha';
    if (disputa.resultado === 'perdido') return 'perdida';
  }
  if (l.status === 'ganho') return 'ganha';
  if (l.status === 'perdido') return 'perdida';
  return null;
}

function faseDaLicitacao(l: Licitacao, disputa: Disputa | undefined, agora: Date): FasePipeline {
  if (desfechoFinal(l, disputa) !== null) return 'finalizada';
  if (l.decisaoCliente === 'recusar') return 'recusada';
  if (l.decisaoCliente === 'participar') return l.statusProposta === 'enviada' ? 'em_disputa' : 'proposta';
  // Decisão pendente.
  return new Date(dataDaLicitacao(l)) < agora ? 'sem_decisao' : 'aguardando_cliente';
}

export function calcularPipeline(licitacoes: Licitacao[], disputas: Disputa[], agora: Date = new Date()): Pipeline {
  const disputaPorLicitacao = new Map(disputas.map((d) => [d.licitacaoId, d]));
  const etapas: EtapaPipeline[] = ORDEM_FASES.map((chave) => ({
    chave,
    rotulo: ROTULO_FASE[chave],
    quantidade: 0,
    valorReferencia: 0,
    ...(chave === 'finalizada' ? { ganhas: 0, perdidas: 0 } : {}),
  }));
  const porChave = new Map(etapas.map((e) => [e.chave, e]));
  let resultadoALancar = 0;

  licitacoes.forEach((l) => {
    const disputa = disputaPorLicitacao.get(l.id);
    const fase = faseDaLicitacao(l, disputa, agora);
    const etapa = porChave.get(fase) as EtapaPipeline;
    etapa.quantidade += 1;
    etapa.valorReferencia += valorReferenciaLicitacao(l);
    if (fase === 'finalizada') {
      if (desfechoFinal(l, disputa) === 'ganha') etapa.ganhas = (etapa.ganhas ?? 0) + 1;
      else etapa.perdidas = (etapa.perdidas ?? 0) + 1;
    }
    if (fase === 'em_disputa' && new Date(dataDaLicitacao(l)) < agora) resultadoALancar += 1;
  });

  return { etapas, total: licitacoes.length, resultadoALancar };
}

const JANELA_PRAZOS_DIAS = 7;

export function calcularPrazosProximos(
  licitacoes: Licitacao[],
  disputas: Disputa[],
  nomeDoCliente: (id: string) => string,
  agora: Date = new Date()
): PrazosProximos {
  const disputaPorLicitacao = new Map(disputas.map((d) => [d.licitacaoId, d]));
  const limite = new Date(agora.getTime() + JANELA_PRAZOS_DIAS * 86_400_000);

  const linhas: PrazoProximo[] = [];
  licitacoes.forEach((l) => {
    const sessao = dataDaLicitacao(l);
    if (new Date(sessao) < agora) return; // sessão já passou
    const fase = faseDaLicitacao(l, disputaPorLicitacao.get(l.id), agora);
    if (fase === 'finalizada' || fase === 'recusada') return;
    const prazo = calcularPrazoInterno(sessao);
    if (prazo > limite) return; // prazo interno ainda longe
    linhas.push({
      licitacaoId: l.id,
      clienteNome: nomeDoCliente(l.clienteId),
      numeroPregao: l.numeroPregao,
      orgao: l.orgao,
      dataSessao: sessao,
      prazoInterno: prazo.toISOString(),
      urgencia: classificarUrgenciaPrazo(sessao, agora),
      decisaoCliente: l.decisaoCliente,
    });
  });

  linhas.sort((a, b) => a.prazoInterno.localeCompare(b.prazoInterno));
  return {
    janelaDias: JANELA_PRAZOS_DIAS,
    linhas,
    vencidos: linhas.filter((x) => x.urgencia === 'vencido').length,
    vencendoEm24h: linhas.filter((x) => x.urgencia === 'atencao').length,
    semDecisaoDoCliente: linhas.filter((x) => x.decisaoCliente === 'pendente').length,
  };
}

// ---------------------------------------------------------------------------
// Conjunto completo (painel do Administrador)
// ---------------------------------------------------------------------------
export function calcularIndicadoresAdmin(
  dados: DadosBaseIndicadores,
  filtros: FiltrosIndicadores,
  agora: Date = new Date()
): IndicadoresAdmin {
  const nomeDaFamilia = (id: string) => dados.familias.find((f) => f.id === id)?.nome ?? 'Família removida';
  const nomeDoCliente = (id: string) => dados.clientes.find((c) => c.id === id)?.nome ?? '—';

  const licitacoes = filtrarLicitacoes(dados.licitacoes, filtros, dados.disputas, agora);
  const unidades = montarUnidades(licitacoes, dados.disputas, filtros.familiaId, filtros.marca);

  // Período anterior (mesmos demais filtros) para a variação da taxa de vitória.
  const anterior = periodoAnterior(filtros);
  let taxaAnterior: TaxaVitoria | null = null;
  if (anterior) {
    const licitacoesAnteriores = filtrarLicitacoes(dados.licitacoes, { ...filtros, ...anterior }, dados.disputas, agora);
    taxaAnterior = calcularTaxaVitoria(
      montarUnidades(licitacoesAnteriores, dados.disputas, filtros.familiaId, filtros.marca)
    );
  }

  return {
    funil: calcularFunil(licitacoes, unidades),
    taxaVitoria: { atual: calcularTaxaVitoria(unidades), anterior: taxaAnterior },
    volumePorMes: calcularVolumePorMes(licitacoes),
    // Com filtro de família, o gráfico mostra só a família escolhida.
    familias: calcularFamilias(licitacoes, unidades, nomeDaFamilia, filtros.marca).filter(
      (barra) => !filtros.familiaId || barra.chave === filtros.familiaId
    ),
    ganhoSobreMinimo: calcularGanhoSobreMinimo(unidades, nomeDaFamilia),
    perdasEvitaveis: calcularPerdasEvitaveis(licitacoes, unidades, nomeDoCliente),
    valorAdjudicado: calcularValorAdjudicado(licitacoes, unidades),
    foraDeMercado: calcularForaDeMercado(licitacoes, unidades, nomeDoCliente),
    distanciaDerrota: calcularDistanciaDerrota(unidades, nomeDaFamilia),
    descontoMedio: calcularDescontoMedio(unidades, nomeDaFamilia),
    orgaos: calcularOrgaos(licitacoes, unidades),
    concorrentes: calcularConcorrentes(unidades),
    taxaVitoriaFamilia: calcularTaxaVitoriaFamilia(unidades, nomeDaFamilia),
    marcas: calcularMarcas(licitacoes, unidades, filtros.familiaId, filtros.marca),
    produtosNuncaGanhos: calcularProdutosNuncaGanhos(unidades),
    concorrentesFamilia: calcularConcorrentesFamilia(unidades, nomeDaFamilia),
    pipeline: calcularPipeline(licitacoes, dados.disputas, agora),
    // Os prazos olham sempre a partir de agora: ignoram o filtro de período.
    prazosProximos: calcularPrazosProximos(
      filtrarLicitacoes(dados.licitacoes, { ...filtros, dataDe: undefined, dataAte: undefined }, dados.disputas, agora),
      dados.disputas,
      nomeDoCliente,
      agora
    ),
    totalLicitacoes: licitacoes.length,
  };
}
