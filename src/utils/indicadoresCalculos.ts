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

import { ESFERA_LICITACAO_LABEL, MODALIDADE_LICITACAO_LABEL } from '../types/licitacao';
import type { EsferaLicitacao, Licitacao, ItemLicitacao, ModalidadeLicitacao } from '../types/licitacao';
import type { Disputa, ResultadoItemDisputa } from '../types/disputa';
import {
  situacaoDaDisputa,
  ETAPA_ORIGEM_PERDA_HABILITACAO,
  MOTIVO_PERDA_HABILITACAO_LABEL,
  MOTIVO_PERDA_LABEL,
} from '../types/disputa';
import { GRUPO_MOTIVO_LABEL, definicaoDoMotivo } from '../types/motivoNaoParticipacao';
import type { ChaveMotivoIndicador, GrupoMotivo } from '../types/motivoNaoParticipacao';
import {
  CHAVE_GRUPOS,
  CHAVE_SEM_FAMILIA,
  CHAVE_SEM_MARCA,
  FILTRO_SEM_ESFERA,
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
  type GanhoSobreMinimoMarca,
  type RelatorioPrincipal,
  type SituacaoInatividade,
  type MedidaTempo,
  type ReaberturaDecisao,
  type TextoMotivoOutro,
  type ForaDeMercadoGrupo,
  type TaxaVitoriaMes,
  type DistanciaDerrota,
  type DistanciaMarca,
  type PerdaPorPouco,
  type PerdasHabilitacao,
  type LinhaPerdaHabilitacao,
  type VitoriasConvocacao,
  type LinhaAlertaAcompanhamento,
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
  type Aproveitamento,
  type ClientesSemAtividade,
  type ConcentracaoCarteira,
  type DesempenhoModalidade,
  type DesempenhoTerritorio,
  type ClienteResumo,
  type GrupoMotivoNaoParticipacao,
  type LinhaMotivoNaoParticipacao,
  type MercadoUfEsfera,
  type MotivosNaoParticipacao,
  type FatiaCarteira,
  type TempoResposta,
  type ValorCliente,
  type TaxaVitoria,
  type TaxaVitoriaFamilia,
  type UnidadeResultado,
  type ValorAdjudicado,
  type ValorAdjudicadoMes,
  type VolumeMes,
} from '../types/indicadores';
import { calcularAnaliseItem, licitacaoExclusivaMeEpp, totalReferenciaItem, totalReferenciaOportunidade } from './licitacaoCalculos';
import { calcularPrazoInterno, classificarUrgenciaPrazo, subtrairDiasUteis } from './prazoUtils';

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
/** UF da licitação em maiúsculas e sem espaços ("" se não informada). */
function ufDaLicitacao(l: Licitacao): string {
  return (l.estado ?? '').trim().toUpperCase();
}

export function filtrarLicitacoes(
  licitacoes: Licitacao[],
  filtros: FiltrosIndicadores,
  disputas: Disputa[] = [],
  agora: Date = new Date()
): Licitacao[] {
  const disputaPorLicitacao =
    filtros.resultado || filtros.fase ? new Map(disputas.map((d) => [d.licitacaoId, d])) : null;
  const passou = licitacoes.filter((l) => {
    if (!dentroDoPeriodo(dataDaLicitacao(l), filtros.dataDe, filtros.dataAte)) return false;
    if (filtros.clienteId && l.clienteId !== filtros.clienteId) return false;
    if (filtros.modalidade && l.modalidade !== filtros.modalidade) return false;
    if (filtros.familiaId) {
      const alvo = filtros.familiaId;
      const temItem = l.itens.some((i) => (alvo === FILTRO_SEM_FAMILIA ? !i.familiaId : i.familiaId === alvo));
      if (!temItem) return false;
    }
    if (filtros.orgao && normalizarNome(l.orgao) !== filtros.orgao) return false;
    if (filtros.uf && ufDaLicitacao(l) !== filtros.uf) return false;
    if (filtros.esfera && (l.esfera ?? FILTRO_SEM_ESFERA) !== filtros.esfera) return false;
    if (filtros.marca && !l.itens.some((i) => marcaDoItem(i) === filtros.marca)) return false;
    if (disputaPorLicitacao) {
      const disputa = disputaPorLicitacao.get(l.id);
      if (filtros.fase && faseDaLicitacao(l, disputa, agora) !== filtros.fase) return false;
    }
    return true;
  });
  if (!filtros.resultado || !disputaPorLicitacao) return passou;

  // Filtro "Resultado": segue a MESMA regra dos cards (resultado por item e
  // grupo, só definitivo — ou também provisório, conforme a caixa "Incluir
  // resultados provisórios"). Ganho = ao menos 1 item/grupo ganho; Perdido =
  // nenhum ganho e ao menos 1 perdido. Sem resultado lançado, vale a regra
  // antiga (recusa, sessão passada sem decisão ou em andamento).
  const unidades = montarUnidades(passou, disputas, filtros.familiaId, filtros.marca, filtros.incluirProvisorios);
  const comGanho = new Set(unidades.filter((u) => u.resultado === 'ganho').map((u) => u.licitacaoId));
  const comPerda = new Set(unidades.filter((u) => ehPerdida(u)).map((u) => u.licitacaoId));
  return passou.filter((l) => {
    const disputa = disputaPorLicitacao.get(l.id);
    let resultado: ResultadoLicitacaoFiltro;
    if (comGanho.has(l.id)) resultado = 'ganho';
    else if (comPerda.has(l.id)) resultado = 'perdido';
    else if (!disputa) resultado = resultadoDaLicitacao(l, disputa, agora);
    else if (l.decisaoCliente === 'recusar') resultado = 'nao_participou';
    else if (l.decisaoCliente === 'pendente' && new Date(dataDaLicitacao(l)) < agora) resultado = 'nao_participou';
    else resultado = 'em_andamento';
    return resultado === filtros.resultado;
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
/** Converte os resultados "em análise" e "convocado" (migração 059) nos
 *  resultados-base que os cálculos conhecem, marcando-os como provisórios. */
function normalizarResultado(resultado?: ResultadoItemDisputa): {
  resultado?: ResultadoItemDisputa;
  provisorio: boolean;
  convocacao: boolean;
} {
  if (resultado === 'arrematado_analise') return { resultado: 'ganho', provisorio: true, convocacao: false };
  if (resultado === 'perdido_analise') return { resultado: 'perdido', provisorio: true, convocacao: false };
  if (resultado === 'convocado') return { resultado: 'ganho', provisorio: true, convocacao: true };
  return { resultado, provisorio: false, convocacao: false };
}

export function montarUnidades(
  licitacoes: Licitacao[],
  disputas: Disputa[],
  filtroFamilia?: string,
  filtroMarca?: string,
  incluirProvisorios = false
): UnidadeResultado[] {
  const licitacaoPorId = new Map(licitacoes.map((l) => [l.id, l]));
  const unidades: UnidadeResultado[] = [];

  disputas.forEach((disputa) => {
    const licitacao = licitacaoPorId.get(disputa.licitacaoId);
    if (!licitacao) return;
    const definitiva = situacaoDaDisputa(disputa) === 'definitiva';
    const taxaFrete = taxaFreteDaLicitacao(licitacao);
    const dataSessao = disputa.dataSessaoRealizada || dataDaLicitacao(licitacao);
    const procedimento: 'srp' | 'convencional' = licitacao.procedimento === 'srp' ? 'srp' : 'convencional';

    // Grupos que têm resultado próprio: os itens deles não contam de novo.
    const gruposComResultado = new Set(
      disputa.itens.filter((linha) => linha.grupoId && linha.resultadoItem).map((linha) => linha.grupoId as string)
    );

    disputa.itens.forEach((linhaOriginal) => {
      // "Em análise" e "Convocado" ainda dependem da homologação: contam como
      // ganho/perda PROVISÓRIOS. Resultado provisório (disputa sem "Homologada
      // em", ou item ainda em análise) só entra quando pedido.
      const norm = normalizarResultado(linhaOriginal.resultadoItem);
      const definitivaLinha = definitiva && !norm.provisorio;
      if (!definitivaLinha && !incluirProvisorios) return;
      const linha = {
        ...linhaOriginal,
        resultadoItem: norm.resultado,
        vitoriaPorConvocacao: linhaOriginal.vitoriaPorConvocacao || norm.convocacao,
      };
      const comuns = { definitiva: definitivaLinha, dataSessao, procedimento };
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
          marcasComposicao: item.propostaCliente?.marcasComposicao?.filter((m) => m.trim()) ?? undefined,
          produtoChave: produtoDoItem(item)?.chave,
          produtoNome: produtoDoItem(item)?.nome,
          resultado: linha.resultadoItem,
          valorOfertado: linha.valorFechado != null ? linha.valorFechado * item.quantidade : null,
          valorMinimoComFrete: minimoUnitario != null ? minimoUnitario * item.quantidade : null,
          valorReferencia: totalReferenciaItem(item) > 0 ? totalReferenciaItem(item) : null,
          valorVencedor: linha.valorVencedor != null ? linha.valorVencedor * item.quantidade : null,
          nomeVencedor: linha.nomeVencedor,
          vitoriaPorConvocacao: linha.vitoriaPorConvocacao,
          motivoPerdaHabilitacao: linha.motivoPerdaHabilitacao,
          cnpjVencedor: linha.cnpjVencedor,
          posicao: linha.posicao,
          motivoPerda: linha.motivoPerda,
          ...comuns,
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
          vitoriaPorConvocacao: linha.vitoriaPorConvocacao,
          motivoPerdaHabilitacao: linha.motivoPerdaHabilitacao,
          cnpjVencedor: linha.cnpjVencedor,
          posicao: linha.posicao,
          motivoPerda: linha.motivoPerda,
          ...comuns,
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
// 1 (novo) — Relatório principal: total de licitações e funil
//
// REGRAS:
//   - Enviadas = licitações já liberadas ao cliente (liberadaAoClienteEm).
//   - Retornadas = enviadas em que o cliente decidiu (participar ou recusar).
//   - Não participação = recusa do cliente + bloqueio do sistema (ME/EPP ou
//     exclusiva ME/EPP). O bloqueio não é resposta do cliente: continua também
//     em "sem retorno".
//   - Resultado por licitação (só entre as que o cliente decidiu participar):
//       Ganha     = disputa homologada com ao menos um item/grupo ganho;
//       Perdida   = disputa homologada sem item/grupo ganho;
//       Arrematada em análise = ainda sem homologação e há item arrematado
//                   (ou convocado);
//       Perdida em análise = ainda sem homologação, outro em 1º, sem item nosso
//                   em 1º.
//     Fracassado/deserto/cancelado não contam como ganho nem perda.
// ---------------------------------------------------------------------------
export function calcularRelatorioPrincipal(
  licitacoes: Licitacao[],
  todasUnidades: UnidadeResultado[],
  clientes: ClienteResumo[],
  agora: Date
): RelatorioPrincipal {
  const enviadasLista = licitacoes.filter((l) => !!l.liberadaAoClienteEm);
  const porte = new Map(clientes.map((c) => [c.id, c.porte]));

  const unidadesPorLicitacao = new Map<string, UnidadeResultado[]>();
  todasUnidades.forEach((u) => {
    const lista = unidadesPorLicitacao.get(u.licitacaoId) ?? [];
    lista.push(u);
    unidadesPorLicitacao.set(u.licitacaoId, lista);
  });

  let retornadas = 0;
  let recusa = 0;
  let bloqueio = 0;
  let participou = 0;
  let arrematadas = 0;
  let perdidasAnalise = 0;
  let ganhas = 0;
  let perdidas = 0;

  enviadasLista.forEach((l) => {
    if (l.decisaoCliente !== 'pendente') retornadas += 1;
    if (l.decisaoCliente === 'recusar') recusa += 1;
    else {
      const motivo = motivoNaoParticipacaoDaLicitacao(l, porte.get(l.clienteId), agora);
      if (motivo === 'bloqueio_porte' || motivo === 'exclusiva_me_epp') bloqueio += 1;
    }
    if (l.decisaoCliente !== 'participar') return;
    participou += 1;

    const unidades = unidadesPorLicitacao.get(l.id) ?? [];
    const ganhoDefinitivo = unidades.some((u) => u.resultado === 'ganho' && u.definitiva);
    const perdaDefinitiva = unidades.some((u) => ehPerdida(u) && u.definitiva);
    const ganhoProvisorio = unidades.some((u) => u.resultado === 'ganho' && !u.definitiva);
    const perdaProvisoria = unidades.some((u) => ehPerdida(u) && !u.definitiva);
    if (ganhoDefinitivo) ganhas += 1;
    else if (ganhoProvisorio) arrematadas += 1;
    else if (perdaDefinitiva) perdidas += 1;
    else if (perdaProvisoria) perdidasAnalise += 1;
  });

  const enviadas = enviadasLista.length;
  return {
    cadastradas: licitacoes.length,
    emPreparacao: licitacoes.length - enviadas,
    enviadas,
    retornadas,
    semRetorno: enviadas - retornadas,
    naoParticipacao: recusa + bloqueio,
    naoParticipacaoRecusa: recusa,
    naoParticipacaoBloqueio: bloqueio,
    participou,
    arrematadasEmAnalise: arrematadas,
    perdidasEmAnalise: perdidasAnalise,
    ganhas,
    perdidas,
    aguardandoResultado: participou - arrematadas - perdidasAnalise - ganhas - perdidas,
  };
}

// ---------------------------------------------------------------------------
// Perdas na habilitação, vitórias por convocação e alerta de acompanhamento
// ---------------------------------------------------------------------------
const ORIGEM_NAO_INFORMADA = 'Não informada';

/** Etapa, motivo e origem de uma perda na aceitação/habilitação.
 *  1) Se houver o motivo detalhado (migração 054), ele manda.
 *  2) Senão, usa o "Motivo da perda" simples da tela de Disputa (059): a
 *     inabilitação tem origem no cliente (as duas causas do documento são
 *     dele); a desclassificação pode vir da indústria, do produto ou da
 *     Salutti, então a origem fica "Não informada". */
function detalhePerdaHabilitacao(u: UnidadeResultado): { etapa: string; motivo: string; origem: string } {
  if (u.motivoPerdaHabilitacao) {
    const eo = ETAPA_ORIGEM_PERDA_HABILITACAO[u.motivoPerdaHabilitacao];
    return {
      etapa: eo.etapa,
      motivo: MOTIVO_PERDA_HABILITACAO_LABEL[u.motivoPerdaHabilitacao],
      origem: eo.origem,
    };
  }
  if (u.motivoPerda === 'inabilitado') {
    return { etapa: 'Inabilitação', motivo: MOTIVO_PERDA_LABEL.inabilitado, origem: 'Cliente' };
  }
  if (u.motivoPerda === 'desclassificado_proposta') {
    return { etapa: 'Desclassificação', motivo: MOTIVO_PERDA_LABEL.desclassificado_proposta, origem: ORIGEM_NAO_INFORMADA };
  }
  return {
    etapa: 'Não informada',
    motivo: u.motivoPerda ? MOTIVO_PERDA_LABEL[u.motivoPerda] : 'Motivo não informado',
    origem: ORIGEM_NAO_INFORMADA,
  };
}

export function calcularPerdasHabilitacao(
  licitacoes: Licitacao[],
  unidades: UnidadeResultado[],
  nomeDoCliente: (id: string) => string
): PerdasHabilitacao {
  const licitacaoPorId = new Map(licitacoes.map((l) => [l.id, l]));
  const linhas: LinhaPerdaHabilitacao[] = unidades
    .filter((u) => u.resultado === 'perdido_habilitacao')
    .map((u) => {
      const l = licitacaoPorId.get(u.licitacaoId);
      return {
        licitacaoId: u.licitacaoId,
        numeroPregao: l?.numeroPregao ?? '—',
        orgao: l?.orgao?.trim() || '—',
        cliente: nomeDoCliente(u.clienteId),
        rotulo: u.rotulo,
        ehGrupo: u.tipo === 'grupo',
        valor: u.valorOfertado,
        definitiva: u.definitiva,
        ...detalhePerdaHabilitacao(u),
      };
    })
    .sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));

  const porOrigem = new Map<string, { origem: string; quantidade: number; valor: number }>();
  linhas.forEach((l) => {
    const atual = porOrigem.get(l.origem) ?? { origem: l.origem, quantidade: 0, valor: 0 };
    atual.quantidade += 1;
    atual.valor += l.valor ?? 0;
    porOrigem.set(l.origem, atual);
  });

  return {
    quantidade: linhas.length,
    valorPerdido: linhas.reduce((s, l) => s + (l.valor ?? 0), 0),
    porOrigem: [...porOrigem.values()].sort((a, b) => b.valor - a.valor || b.quantidade - a.quantidade),
    linhas,
  };
}

/** Vitórias que vieram da desclassificação de concorrentes (convocação). */
export function calcularVitoriasConvocacao(
  licitacoes: Licitacao[],
  unidades: UnidadeResultado[],
  nomeDoCliente: (id: string) => string
): VitoriasConvocacao {
  const licitacaoPorId = new Map(licitacoes.map((l) => [l.id, l]));
  const linhas = unidades
    .filter((u) => u.resultado === 'ganho' && u.vitoriaPorConvocacao)
    .map((u) => {
      const l = licitacaoPorId.get(u.licitacaoId);
      return {
        licitacaoId: u.licitacaoId,
        numeroPregao: l?.numeroPregao ?? '—',
        orgao: l?.orgao?.trim() || '—',
        cliente: nomeDoCliente(u.clienteId),
        rotulo: u.rotulo,
        ehGrupo: u.tipo === 'grupo',
        valor: u.valorOfertado,
        definitiva: u.definitiva,
      };
    })
    .sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));
  return { quantidade: linhas.length, valor: linhas.reduce((s, l) => s + (l.valor ?? 0), 0), linhas };
}

/** Alerta de acompanhamento: perdida em análise (sem homologação) com o
 *  cliente em 2º ou 3º lugar. Se o 1º for desclassificado, a vez pode passar
 *  ao cliente. Recebe unidades COM provisórias. */
export function calcularAlertaAcompanhamento(
  licitacoes: Licitacao[],
  unidades: UnidadeResultado[],
  nomeDoCliente: (id: string) => string
): LinhaAlertaAcompanhamento[] {
  const licitacaoPorId = new Map(licitacoes.map((l) => [l.id, l]));
  return unidades
    .filter((u) => !u.definitiva && u.resultado === 'perdido' && (u.posicao === 2 || u.posicao === 3))
    .map((u) => {
      const l = licitacaoPorId.get(u.licitacaoId);
      return {
        licitacaoId: u.licitacaoId,
        numeroPregao: l?.numeroPregao ?? '—',
        orgao: l?.orgao?.trim() || '—',
        cliente: nomeDoCliente(u.clienteId),
        rotulo: u.rotulo,
        ehGrupo: u.tipo === 'grupo',
        posicao: u.posicao as number,
        valorNosso: u.valorOfertado,
        valorVencedor: u.valorVencedor,
        nomeVencedor: u.nomeVencedor?.trim() || 'não informado',
      };
    })
    .sort((a, b) => a.posicao - b.posicao || (b.valorNosso ?? 0) - (a.valorNosso ?? 0));
}

// ---------------------------------------------------------------------------
// 2 — Taxa de vitória
// ---------------------------------------------------------------------------
/** Perdida = perdida no lance ou perdida na aceitação/habilitação. */
export function ehPerdida(u: UnidadeResultado): boolean {
  return u.resultado === 'perdido' || u.resultado === 'perdido_habilitacao';
}

export function calcularTaxaVitoria(unidades: UnidadeResultado[]): TaxaVitoria {
  const ganhas = unidades.filter((u) => u.resultado === 'ganho');
  const perdidas = unidades.filter(ehPerdida);
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
    umACada: ganhas.length > 0 ? disputados / ganhas.length : null,
  };
}

/** Evolução mês a mês da taxa de vitória (mês da sessão). Cada mês usa os
 *  próprios totais; nunca a média das taxas mensais. */
export function calcularTaxaVitoriaPorMes(unidades: UnidadeResultado[]): TaxaVitoriaMes[] {
  const meses = new Map<string, UnidadeResultado[]>();
  unidades.forEach((u) => {
    if (u.resultado !== 'ganho' && !ehPerdida(u)) return;
    if (!u.dataSessao) return;
    const mes = diaLocal(u.dataSessao).slice(0, 7);
    const lista = meses.get(mes) ?? [];
    lista.push(u);
    meses.set(mes, lista);
  });
  return [...meses.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, lista]) => {
      const taxa = calcularTaxaVitoria(lista);
      return {
        mes,
        rotulo: `${MESES_ABREVIADOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`,
        ganhos: taxa.ganhos,
        perdidos: taxa.perdidos,
        percentualQuantidade: taxa.percentualQuantidade,
        percentualValor: taxa.percentualValor,
      };
    });
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

  // Ganhos com valor fechado, mas sem mínimo: não dá para medir o ganho.
  const semMinimo = unidades.filter(
    (u) =>
      u.resultado === 'ganho' &&
      u.valorOfertado != null &&
      u.valorOfertado > 0 &&
      !(u.valorMinimoComFrete != null && u.valorMinimoComFrete > 0)
  ).length;

  const valorFechado = base.reduce((s, u) => s + (u.valorOfertado ?? 0), 0);
  const valorGanho = base.reduce((s, u) => s + ((u.valorOfertado ?? 0) - (u.valorMinimoComFrete ?? 0)), 0);

  const faixas = { noLimite: 0, saudavel: 0, forte: 0 };
  base.forEach((u) => {
    const pct = (((u.valorOfertado as number) - (u.valorMinimoComFrete as number)) / (u.valorMinimoComFrete as number)) * 100;
    if (pct <= 3) faixas.noLimite += 1;
    else if (pct <= 10) faixas.saudavel += 1;
    else faixas.forte += 1;
  });

  const marcas = new Map<string, { nome: string; lista: UnidadeResultado[] }>();
  base.forEach((u) => {
    if (u.tipo !== 'item') return;
    const nome = (u.marca ?? '').trim().replace(/\s+/g, ' ');
    if (!nome) return;
    const chave = normalizarNome(nome);
    const atual = marcas.get(chave) ?? { nome, lista: [] };
    atual.lista.push(u);
    marcas.set(chave, atual);
  });
  const porMarca: GanhoSobreMinimoMarca[] = [...marcas.entries()]
    .map(([chave, { nome, lista }]) => ({
      chave,
      nome,
      percentual: percentual(lista),
      valorGanho: lista.reduce((s, u) => s + ((u.valorOfertado ?? 0) - (u.valorMinimoComFrete ?? 0)), 0),
      quantidade: lista.length,
    }))
    .sort((a, b) => b.valorGanho - a.valorGanho)
    .slice(0, LIMITE_TOP);

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
    valorGanho,
    valorFechado,
    faixas,
    semMinimo,
    porMarca,
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
  function mesDe(licitacaoId: string, mesDaSessao?: string): ValorAdjudicadoMes | null {
    const l = licitacaoPorId.get(licitacaoId);
    if (!l) return null;
    const mes = diaLocal(mesDaSessao ?? dataDaLicitacao(l)).slice(0, 7);
    const existente = meses.get(mes);
    if (existente) return existente;
    const nova: ValorAdjudicadoMes = {
      mes,
      rotulo: `${MESES_ABREVIADOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`,
      valor: 0,
      valorSrp: 0,
      valorConvencional: 0,
      licitacoesGanhas: 0,
    };
    meses.set(mes, nova);
    return nova;
  }

  // O mês é o da sessão realizada; a licitação conta no mês da primeira
  // unidade ganha dela.
  const sessaoDaLicitacao = new Map<string, string | undefined>();
  ganhos.forEach((u) => {
    const atual = sessaoDaLicitacao.get(u.licitacaoId);
    if (!sessaoDaLicitacao.has(u.licitacaoId) || (u.dataSessao && (!atual || u.dataSessao < atual))) {
      sessaoDaLicitacao.set(u.licitacaoId, u.dataSessao);
    }
  });
  comGanho.forEach((id) => {
    const m = mesDe(id, sessaoDaLicitacao.get(id));
    if (m) m.licitacoesGanhas += 1;
  });
  let total = 0;
  ganhos.forEach((u) => {
    const valor = u.valorOfertado ?? 0;
    total += valor;
    const m = mesDe(u.licitacaoId, u.dataSessao);
    if (m) {
      m.valor += valor;
      if (u.procedimento === 'srp') m.valorSrp += valor;
      else m.valorConvencional += valor;
    }
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
/** Preço do vencedor 30% ou mais abaixo do mínimo: referência interna de
 *  preço possivelmente inexequível (não é critério legal). */
const LIMITE_INEXEQUIVEL_PERCENTUAL = 30;

export function calcularForaDeMercado(
  licitacoes: Licitacao[],
  unidades: UnidadeResultado[],
  nomeDoCliente: (id: string) => string,
  nomeDaFamilia: (id: string) => string = () => 'Sem família'
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
        possivelmenteInexequivel: ((minimo - vencedor) / minimo) * 100 >= LIMITE_INEXEQUIVEL_PERCENTUAL,
      };
    })
    .sort((a, b) => b.percentualAbaixo - a.percentualAbaixo);

  const somaMinimo = linhas.reduce((s, l) => s + l.valorMinimo, 0);
  const somaVencedor = linhas.reduce((s, l) => s + l.valorVencedor, 0);

  // Composição das perdas DEFINITIVAS (homologadas).
  const composicao = { total: 0, foraDeMercado: 0, perdaEvitavel: 0, perdidaHabilitacao: 0, semPrecoVencedor: 0 };
  unidades
    .filter((u) => u.definitiva && ehPerdida(u))
    .forEach((u) => {
      composicao.total += 1;
      if (u.resultado === 'perdido_habilitacao') composicao.perdidaHabilitacao += 1;
      else if (!(u.valorVencedor != null && u.valorVencedor > 0 && u.valorMinimoComFrete != null && u.valorMinimoComFrete > 0))
        composicao.semPrecoVencedor += 1;
      else if ((u.valorVencedor as number) < (u.valorMinimoComFrete as number)) composicao.foraDeMercado += 1;
      else composicao.perdaEvitavel += 1;
    });

  function agrupar(chaveDe: (u: UnidadeResultado) => { chave: string; nome: string } | null): ForaDeMercadoGrupo[] {
    const mapa = new Map<string, { nome: string; lista: UnidadeResultado[] }>();
    fora.forEach((u) => {
      const k = chaveDe(u);
      if (!k) return;
      const atual = mapa.get(k.chave) ?? { nome: k.nome, lista: [] };
      atual.lista.push(u);
      mapa.set(k.chave, atual);
    });
    return [...mapa.entries()]
      .map(([chave, { nome, lista }]) => {
        const min = lista.reduce((s, u) => s + (u.valorMinimoComFrete as number), 0);
        const ven = lista.reduce((s, u) => s + (u.valorVencedor as number), 0);
        return { chave, nome, quantidade: lista.length, distanciaMedia: min > 0 ? ((min - ven) / min) * 100 : null };
      })
      .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, LIMITE_TOP);
  }
  const porFamilia = agrupar((u) => ({
    chave: u.tipo === 'grupo' ? CHAVE_GRUPOS : (u.familiaId ?? CHAVE_SEM_FAMILIA),
    nome: u.tipo === 'grupo' ? 'Grupos' : u.familiaId ? nomeDaFamilia(u.familiaId) : 'Sem família',
  }));
  const porMarca = agrupar((u) => {
    if (u.tipo !== 'item') return null;
    const nome = (u.marca ?? '').trim().replace(/\s+/g, ' ');
    return nome ? { chave: normalizarNome(nome), nome } : null;
  });

  return {
    possivelmenteInexequiveis: linhas.filter((l) => l.possivelmenteInexequivel).length,
    composicao,
    porFamilia,
    porMarca,
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
  licitacoes: Licitacao[],
  unidades: UnidadeResultado[],
  nomeDaFamilia: (id: string) => string,
  nomeDoCliente: (id: string) => string
): DistanciaDerrota {
  const base = unidades.filter(
    (u) =>
      u.resultado === 'perdido' &&
      u.valorOfertado != null &&
      u.valorOfertado > 0 &&
      u.valorVencedor != null &&
      u.valorVencedor > 0 &&
      u.valorOfertado >= u.valorVencedor
  );
  const calc = (lista: UnidadeResultado[]) => {
    const ofertado = lista.reduce((s, u) => s + (u.valorOfertado ?? 0), 0);
    const vencedor = lista.reduce((s, u) => s + (u.valorVencedor ?? 0), 0);
    return vencedor > 0 ? (ofertado / vencedor - 1) * 100 : null;
  };
  const pctDe = (u: UnidadeResultado) => ((u.valorOfertado as number) / (u.valorVencedor as number) - 1) * 100;
  const acima = (u: UnidadeResultado) => (u.valorOfertado as number) - (u.valorVencedor as number);

  const faixas = { ate3: 0, de3a10: 0, acima10: 0 };
  base.forEach((u) => {
    const p = pctDe(u);
    if (p <= 3) faixas.ate3 += 1;
    else if (p <= 10) faixas.de3a10 += 1;
    else faixas.acima10 += 1;
  });

  const marcas = new Map<string, { nome: string; lista: UnidadeResultado[] }>();
  base.forEach((u) => {
    if (u.tipo !== 'item') return;
    const nome = (u.marca ?? '').trim().replace(/\s+/g, ' ');
    if (!nome) return;
    const chave = normalizarNome(nome);
    const atual = marcas.get(chave) ?? { nome, lista: [] };
    atual.lista.push(u);
    marcas.set(chave, atual);
  });
  const porMarca: DistanciaMarca[] = [...marcas.entries()]
    .map(([chave, { nome, lista }]) => ({
      chave,
      nome,
      percentual: calc(lista),
      valorAcima: lista.reduce((s, u) => s + acima(u), 0),
      quantidade: lista.length,
    }))
    .sort((a, b) => b.valorAcima - a.valorAcima)
    .slice(0, LIMITE_TOP);

  const licitacaoPorId = new Map(licitacoes.map((l) => [l.id, l]));
  const perdasPorPouco: PerdaPorPouco[] = base
    .filter((u) => pctDe(u) <= 3)
    .map((u) => {
      const l = licitacaoPorId.get(u.licitacaoId);
      return {
        licitacaoId: u.licitacaoId,
        numeroPregao: l?.numeroPregao ?? '—',
        orgao: l?.orgao?.trim() || '—',
        cliente: nomeDoCliente(u.clienteId),
        rotulo: u.rotulo,
        ehGrupo: u.tipo === 'grupo',
        valorNosso: u.valorOfertado as number,
        valorVencedor: u.valorVencedor as number,
        percentual: pctDe(u),
        nomeVencedor: u.nomeVencedor?.trim() || 'não informado',
      };
    })
    .sort((a, b) => a.percentual - b.percentual);

  return {
    ...percentualPorFamilia(base, nomeDaFamilia, calc),
    valorAcima: base.reduce((s, u) => s + acima(u), 0),
    faixas,
    porMarca,
    perdasPorPouco,
  };
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
  const adjudicadoPorLicitacao = new Map<string, number>();
  unidades
    .filter((u) => u.resultado === 'ganho')
    .forEach((u) => adjudicadoPorLicitacao.set(u.licitacaoId, (adjudicadoPorLicitacao.get(u.licitacaoId) ?? 0) + (u.valorOfertado ?? 0)));
  const mapa = new Map<string, BarraOrgao>();
  licitacoes.forEach((l) => {
    const nome = l.orgao.trim() || '—';
    const chave = normalizarNome(nome);
    const atual: BarraOrgao = mapa.get(chave) ?? {
      orgao: nome,
      participacoes: 0,
      vitorias: 0,
      licitacoes: 0,
      taxaVitoria: null,
      valorAdjudicado: 0,
    };
    atual.licitacoes += 1;
    if (!atual.cnpj && l.orgaoCnpj) atual.cnpj = l.orgaoCnpj;
    if (!atual.uasg && l.orgaoUasg) atual.uasg = l.orgaoUasg;
    if (l.decisaoCliente === 'participar') atual.participacoes += 1;
    if (comGanho.has(l.id)) atual.vitorias += 1;
    atual.valorAdjudicado += adjudicadoPorLicitacao.get(l.id) ?? 0;
    mapa.set(chave, atual);
  });
  return [...mapa.values()]
    .filter((o) => o.participacoes > 0 || o.vitorias > 0)
    .map((o) => ({ ...o, taxaVitoria: o.participacoes > 0 ? (o.vitorias / o.participacoes) * 100 : null }))
    .sort((a, b) => b.participacoes - a.participacoes || b.vitorias - a.vitorias || a.orgao.localeCompare(b.orgao, 'pt-BR'))
    .slice(0, LIMITE_TOP);
}

// ---------------------------------------------------------------------------
// 8 — Concorrentes que mais vencem o cliente (top 10)
// ---------------------------------------------------------------------------
export function calcularConcorrentes(
  unidades: UnidadeResultado[],
  nomeDaFamilia: (id: string) => string = () => 'Sem família'
): Concorrente[] {
  type Acc = {
    nome: string;
    cnpj?: string;
    vitorias: number;
    licitacoes: Set<string>;
    valorTotal: number;
    somaNossoComBase: number;
    somaVencedorComBase: number;
    familias: Map<string, { nome: string; vitorias: number }>;
  };
  const mapa = new Map<string, Acc>();
  // CNPJ identifica o concorrente de forma única; sem CNPJ, vale o nome.
  const nomePorCnpj = new Map<string, string>();
  unidades.forEach((u) => {
    if (u.resultado === 'perdido' && u.cnpjVencedor && u.nomeVencedor?.trim() && !nomePorCnpj.has(u.cnpjVencedor)) {
      nomePorCnpj.set(u.cnpjVencedor, u.nomeVencedor.trim());
    }
  });
  unidades
    .filter((u) => u.resultado === 'perdido' && (u.nomeVencedor?.trim() || u.cnpjVencedor))
    .forEach((u) => {
      const nome = (u.cnpjVencedor ? nomePorCnpj.get(u.cnpjVencedor) : undefined) ?? (u.nomeVencedor as string).trim();
      const chave = u.cnpjVencedor ? `cnpj:${u.cnpjVencedor}` : normalizarNome(nome);
      const atual: Acc = mapa.get(chave) ?? {
        nome,
        cnpj: u.cnpjVencedor || undefined,
        vitorias: 0,
        licitacoes: new Set<string>(),
        valorTotal: 0,
        somaNossoComBase: 0,
        somaVencedorComBase: 0,
        familias: new Map(),
      };
      atual.vitorias += 1;
      atual.licitacoes.add(u.licitacaoId);
      atual.valorTotal += u.valorVencedor ?? 0;
      if (u.valorOfertado != null && u.valorOfertado > 0 && u.valorVencedor != null && u.valorVencedor > 0) {
        atual.somaNossoComBase += u.valorOfertado;
        atual.somaVencedorComBase += u.valorVencedor;
      }
      const chaveFam = u.tipo === 'grupo' ? CHAVE_GRUPOS : (u.familiaId ?? CHAVE_SEM_FAMILIA);
      const nomeFam = u.tipo === 'grupo' ? 'Grupos' : u.familiaId ? nomeDaFamilia(u.familiaId) : 'Sem família';
      const fam = atual.familias.get(chaveFam) ?? { nome: nomeFam, vitorias: 0 };
      fam.vitorias += 1;
      atual.familias.set(chaveFam, fam);
      mapa.set(chave, atual);
    });
  return [...mapa.values()]
    .map((c) => ({
      nome: c.nome,
      cnpj: c.cnpj,
      vitorias: c.vitorias,
      licitacoes: c.licitacoes.size,
      valorTotal: c.valorTotal,
      distanciaMedia:
        c.somaNossoComBase > 0 ? ((c.somaNossoComBase - c.somaVencedorComBase) / c.somaNossoComBase) * 100 : null,
      familias: [...c.familias.values()].sort((a, b) => b.vitorias - a.vitorias || a.nome.localeCompare(b.nome, 'pt-BR')),
    }))
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
  const base = unidades.filter((u) => u.resultado === 'ganho' || ehPerdida(u));
  const soma = (lista: UnidadeResultado[]) => lista.reduce((s, u) => s + (u.valorOfertado ?? 0), 0);
  const taxa = (lista: UnidadeResultado[]) => {
    const ganhosLista = lista.filter((u) => u.resultado === 'ganho');
    const valorDisputado = soma(lista);
    return {
      ganhos: ganhosLista.length,
      disputados: lista.length,
      percentual: lista.length > 0 ? (ganhosLista.length / lista.length) * 100 : null,
      percentualValor: valorDisputado > 0 ? (soma(ganhosLista) / valorDisputado) * 100 : null,
    };
  };
  // Ganho sobre o mínimo (%, ponderado) só nos ganhos com valor e mínimo.
  const ganhoSobre = (lista: UnidadeResultado[]): number | null => {
    const com = lista.filter(
      (u) =>
        u.resultado === 'ganho' &&
        u.valorOfertado != null &&
        u.valorOfertado > 0 &&
        u.valorMinimoComFrete != null &&
        u.valorMinimoComFrete > 0
    );
    const minimo = com.reduce((s, u) => s + (u.valorMinimoComFrete as number), 0);
    return minimo > 0 ? ((soma(com) - minimo) / minimo) * 100 : null;
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
  // Premissas da leitura (o documento não fixa os cortes):
  //   taxa "alta" = a da família é igual ou maior que a taxa geral do período;
  //   ganho "alto" = acima de 3% sobre o mínimo (fora da faixa "no limite").
  const porFamilia: TaxaFamilia[] = [...mapa.entries()]
    .map(([chave, { nome, lista }]) => {
      const t = taxa(lista);
      const ganho = ganhoSobre(lista);
      const amostraPequena = t.disputados < 5;
      let leitura: TaxaFamilia['leitura'] = null;
      if (!amostraPequena && t.percentual !== null && geral.percentual !== null && ganho !== null) {
        const taxaAlta = t.percentual >= geral.percentual;
        const ganhoAlto = ganho > 3;
        leitura = taxaAlta ? (ganhoAlto ? 'forte' : 'no_limite') : ganhoAlto ? 'preco_alto' : 'dificil';
      }
      return { chave, nome, ...t, amostraPequena, ganhoSobreMinimo: ganho, leitura };
    })
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
        // Marcas que compõem cestas e kits também contam como cotadas (presença).
        (i.propostaCliente?.marcasComposicao ?? [])
          .filter((m) => m.trim() && normalizarNome(m) !== normalizarNome(i.propostaCliente?.marca ?? ''))
          .forEach((m) => {
            barra(m).cotadas += 1;
          });
      });
  });
  unidades
    .filter((u) => u.tipo === 'item' && u.resultado === 'ganho')
    .forEach((u) => {
      barra(u.marca).ganhas += 1;
      (u.marcasComposicao ?? [])
        .filter((m) => normalizarNome(m) !== normalizarNome(u.marca ?? ''))
        .forEach((m) => {
          barra(m).ganhas += 1;
        });
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
    .filter((u) => u.tipo === 'item' && u.produtoChave && (u.resultado === 'ganho' || ehPerdida(u)))
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
// Gestão da carteira e da operação (lote 1)
//
// REGRAS ADOTADAS:
//   - Aproveitamento: "analisadas" = todas as licitações apresentadas ao cliente
//     (já com os filtros); "participou" = decisão "participar"; "recusou" =
//     decisão "recusar"; o resto está sem decisão.
//   - Tempo de resposta: da data de cadastro da licitação até a data da decisão
//     do cliente (participar ou recusar). Decisões sem data, ou com data
//     anterior ao cadastro, ficam de fora. Substitui "envio da análise", que
//     ainda não é registrado.
//   - Clientes sem atividade: última atividade = o que for mais recente entre o
//     cadastro de uma licitação e uma decisão do cliente. Ignora os filtros.
//   - Concentração: pelo valor de referência das licitações; mostra os 8
//     maiores clientes e agrupa o restante em "Outros".
//   - Valor por cliente: "em disputa" = valor de referência das licitações em
//     que o cliente confirmou participação e ainda não há resultado final;
//     "adjudicado" = soma dos itens e grupos ganhos (não é faturamento).
//   - Modalidade: taxa = licitações com vitória ÷ licitações em que o cliente
//     participou.
// ---------------------------------------------------------------------------
const MS_DIA = 86_400_000;
const LIMITE_LISTA_GESTAO = 10;

function arredondar(valor: number, casas = 1): number {
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
}

export function calcularAproveitamento(
  licitacoes: Licitacao[],
  nomeDoCliente: (id: string) => string
): Aproveitamento {
  let participou = 0;
  let recusou = 0;
  const porCliente = new Map<string, { chave: string; nome: string; analisadas: number; participou: number }>();

  licitacoes.forEach((l) => {
    if (l.decisaoCliente === 'participar') participou += 1;
    else if (l.decisaoCliente === 'recusar') recusou += 1;
    const atual = porCliente.get(l.clienteId) ?? {
      chave: l.clienteId,
      nome: nomeDoCliente(l.clienteId),
      analisadas: 0,
      participou: 0,
    };
    atual.analisadas += 1;
    if (l.decisaoCliente === 'participar') atual.participou += 1;
    porCliente.set(l.clienteId, atual);
  });

  const analisadas = licitacoes.length;
  return {
    analisadas,
    participou,
    recusou,
    semDecisao: analisadas - participou - recusou,
    percentual: analisadas > 0 ? (participou / analisadas) * 100 : null,
    porCliente: [...porCliente.values()]
      .sort((a, b) => b.analisadas - a.analisadas || a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, LIMITE_LISTA_GESTAO),
  };
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

/** Dias úteis (segunda a sexta, sem feriados) entre dois instantes, com fração:
 *  cada dia útil conta pelo tempo que o intervalo ocupa dentro dele. Retorna
 *  negativo quando o fim é anterior ao início. */
export function diasUteisEntre(inicio: Date, fim: Date): number {
  if (fim.getTime() < inicio.getTime()) return -diasUteisEntre(fim, inicio);
  let total = 0;
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  while (cursor.getTime() < fim.getTime()) {
    const proximo = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    const dia = cursor.getDay();
    if (dia !== 0 && dia !== 6) {
      const de = Math.max(cursor.getTime(), inicio.getTime());
      const ate = Math.min(proximo.getTime(), fim.getTime());
      if (ate > de) total += (ate - de) / MS_DIA;
    }
    cursor.setTime(proximo.getTime());
  }
  return total;
}

/** Prazo do cliente para decidir: 3 dias úteis antes da sessão. */
const DIAS_UTEIS_PRAZO_CLIENTE = 3;
const JANELA_CURTA_DIAS_UTEIS = 2;

function medidaTempo(valores: number[]): MedidaTempo {
  if (valores.length === 0) return { quantidade: 0, medianaDias: null, mediaDias: null };
  const media = valores.reduce((s, x) => s + x, 0) / valores.length;
  return { quantidade: valores.length, medianaDias: arredondar(mediana(valores) as number), mediaDias: arredondar(media) };
}

export function calcularTempoResposta(
  licitacoes: Licitacao[],
  nomeDoCliente: (id: string) => string,
  reaberturas?: ReaberturaDecisao[]
): TempoResposta {
  const todos: number[] = [];
  const porCliente = new Map<string, number[]>();
  const porAnalista = new Map<string, number[]>();
  const antecedencias: number[] = [];
  const janelas: number[] = [];
  let janelaCurta = 0;
  let aguardando = 0;
  const prazoClientePorLicitacao = new Map<string, Date>();

  licitacoes.forEach((l) => {
    // O relógio começa na LIBERAÇÃO ao cliente (migração 055), não no
    // cadastro: licitação ainda não liberada não está esperando o cliente.
    if (!l.liberadaAoClienteEm) return;
    const liberada = new Date(l.liberadaAoClienteEm);
    const sessao = new Date(dataDaLicitacao(l));
    if (Number.isFinite(sessao.getTime())) {
      const prazoCliente = subtrairDiasUteis(sessao, DIAS_UTEIS_PRAZO_CLIENTE);
      prazoClientePorLicitacao.set(l.id, prazoCliente);
      antecedencias.push(diasUteisEntre(liberada, sessao));
      const janela = diasUteisEntre(liberada, prazoCliente);
      janelas.push(janela);
      if (janela < JANELA_CURTA_DIAS_UTEIS) janelaCurta += 1;
    }
    if (l.decisaoCliente === 'pendente') {
      aguardando += 1;
      return;
    }
    if (!l.decisaoClienteEm) return;
    const dias = diasUteisEntre(liberada, new Date(l.decisaoClienteEm));
    if (!Number.isFinite(dias) || dias < 0) return;
    todos.push(dias);
    const lista = porCliente.get(l.clienteId) ?? [];
    lista.push(dias);
    porCliente.set(l.clienteId, lista);
    const analista = l.liberadaAoClientePor?.trim() || 'Não informado';
    const listaAnalista = porAnalista.get(analista) ?? [];
    listaAnalista.push(dias);
    porAnalista.set(analista, listaAnalista);
  });

  const resumo = (chave: string, nome: string, lista: number[]) => {
    const m = medidaTempo(lista);
    return { chave, nome, mediaDias: m.mediaDias as number, medianaDias: m.medianaDias as number, quantidade: lista.length };
  };
  const ordenar = (a: { medianaDias: number; mediaDias: number; nome: string }, b: typeof a) =>
    b.medianaDias - a.medianaDias || b.mediaDias - a.mediaDias || a.nome.localeCompare(b.nome, 'pt-BR');

  const geral = medidaTempo(todos);
  return {
    quantidade: todos.length,
    mediaDias: geral.mediaDias,
    medianaDias: geral.medianaDias,
    aguardando,
    porCliente: [...porCliente.entries()].map(([id, lista]) => resumo(id, nomeDoCliente(id), lista)).sort(ordenar),
    porAnalista: [...porAnalista.entries()].map(([nome, lista]) => resumo(nome, nome, lista)).sort(ordenar),
    envio: {
      antecedencia: medidaTempo(antecedencias),
      janelaCliente: medidaTempo(janelas),
      janelaCurta,
      reaberturasForaDoPrazo: reaberturas
        ? reaberturas.filter((r) => {
            const prazo = prazoClientePorLicitacao.get(r.licitacaoId);
            return prazo !== undefined && new Date(r.em).getTime() > prazo.getTime();
          }).length
        : null,
    },
  };
}

/** Valor adjudicado (itens e grupos ganhos, definitivos) por cliente. */
function valorAdjudicadoPorCliente(unidades: UnidadeResultado[]): Map<string, number> {
  const mapa = new Map<string, number>();
  unidades
    .filter((u) => u.resultado === 'ganho')
    .forEach((u) => mapa.set(u.clienteId, (mapa.get(u.clienteId) ?? 0) + (u.valorOfertado ?? 0)));
  return mapa;
}

export function calcularClientesSemAtividade(
  licitacoes: Licitacao[],
  clientes: DadosBaseIndicadores['clientes'],
  agora: Date = new Date(),
  faixas: ClientesSemAtividade['faixas'] = { faixa1Dias: 7, faixa2Dias: 14, faixa3Dias: 21 },
  valorAdjudicadoPorCliente: Map<string, number> = new Map()
): ClientesSemAtividade {
  const maior = (a: number | undefined, iso?: string) => {
    if (!iso) return a;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t > (a ?? 0) ? t : a;
  };
  const dias = (t: number) => Math.max(0, Math.floor((agora.getTime() - t) / MS_DIA));
  const nivelDe = (d: number | null): 0 | 1 | 2 | 3 =>
    d === null || d >= faixas.faixa3Dias ? 3 : d >= faixas.faixa2Dias ? 2 : d >= faixas.faixa1Dias ? 1 : 0;

  const linhas = clientes.map((c) => {
    const dele = licitacoes.filter((l) => l.clienteId === c.id);
    let ultimoEnvio: number | undefined;
    let ultimaResposta: number | undefined;
    let ultimaParticipacao: number | undefined;
    let pendenteMaisAntiga: number | undefined; // enviada e sem decisão há mais tempo
    dele.forEach((l) => {
      ultimoEnvio = maior(ultimoEnvio, l.liberadaAoClienteEm);
      ultimaResposta = maior(ultimaResposta, l.decisaoClienteEm);
      if (l.decisaoCliente === 'participar') ultimaParticipacao = maior(ultimaParticipacao, l.decisaoClienteEm);
      if (l.liberadaAoClienteEm && l.decisaoCliente === 'pendente') {
        const t = new Date(l.liberadaAoClienteEm).getTime();
        if (Number.isFinite(t) && (pendenteMaisAntiga === undefined || t < pendenteMaisAntiga)) pendenteMaisAntiga = t;
      }
    });

    // Três situações candidatas; vale a mais grave (maior faixa, depois mais dias).
    const candidatas: { situacao: SituacaoInatividade; dias: number | null }[] = [
      { situacao: 'sem_envio', dias: ultimoEnvio === undefined ? null : dias(ultimoEnvio) },
    ];
    if (pendenteMaisAntiga !== undefined) {
      candidatas.push({ situacao: 'sem_resposta', dias: dias(pendenteMaisAntiga) });
    }
    if (ultimaResposta !== undefined) {
      candidatas.push({
        situacao: 'sem_participacao',
        dias: ultimaParticipacao === undefined ? null : dias(ultimaParticipacao),
      });
    }
    const avaliadas = candidatas.map((x) => ({ ...x, nivel: nivelDe(x.dias) }));
    // Empate de faixa: "sem resposta" (cliente com licitação parada) é a mais
    // acionável, depois "sem participação", depois "sem envio".
    const prioridade: Record<SituacaoInatividade, number> = { sem_resposta: 0, sem_participacao: 1, sem_envio: 2, ok: 3 };
    avaliadas.sort(
      (a, b) =>
        b.nivel - a.nivel || prioridade[a.situacao] - prioridade[b.situacao] || (b.dias ?? Infinity) - (a.dias ?? Infinity)
    );
    const pior = avaliadas[0];
    const ok = pior.nivel === 0;

    return {
      clienteId: c.id,
      nome: c.nome,
      situacao: ok ? ('ok' as const) : pior.situacao,
      nivel: pior.nivel,
      diasDaSituacao: ok ? null : pior.dias,
      ultimoEnvio: ultimoEnvio === undefined ? undefined : new Date(ultimoEnvio).toISOString(),
      ultimaResposta: ultimaResposta === undefined ? undefined : new Date(ultimaResposta).toISOString(),
      ultimaParticipacao: ultimaParticipacao === undefined ? undefined : new Date(ultimaParticipacao).toISOString(),
      valorAdjudicado: valorAdjudicadoPorCliente.get(c.id) ?? 0,
      // Compatibilidade com a visão antiga (última atividade geral).
      ultimaAtividade: undefined as string | undefined,
      dias: null as number | null,
    };
  });

  // Ordem pelo RISCO: faixa maior primeiro; dentro dela, quem tem mais valor
  // adjudicado (mais a perder); depois quem está parado há mais tempo.
  linhas.sort(
    (a, b) =>
      b.nivel - a.nivel ||
      b.valorAdjudicado - a.valorAdjudicado ||
      (b.diasDaSituacao ?? Infinity) - (a.diasDaSituacao ?? Infinity) ||
      a.nome.localeCompare(b.nome, 'pt-BR')
  );
  return { faixas, linhas };
}

function montarFatias(
  mapa: Map<string, { nome: string; valor: number; licitacoes: number }>,
  total: number,
  limite?: number
): FatiaCarteira[] {
  const ordenadas = [...mapa.entries()]
    .map(([chave, v]) => ({
      chave,
      nome: v.nome,
      valor: v.valor,
      licitacoes: v.licitacoes,
      percentual: total > 0 ? (v.valor / total) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'));
  if (!limite || ordenadas.length <= limite) return ordenadas;
  const principais = ordenadas.slice(0, limite);
  const resto = ordenadas.slice(limite);
  const valor = resto.reduce((soma, f) => soma + f.valor, 0);
  principais.push({
    chave: 'outros',
    nome: `Outros (${resto.length})`,
    valor,
    licitacoes: resto.reduce((soma, f) => soma + f.licitacoes, 0),
    percentual: total > 0 ? (valor / total) * 100 : 0,
  });
  return principais;
}

export function calcularConcentracaoCarteira(
  licitacoes: Licitacao[],
  clientes: DadosBaseIndicadores['clientes']
): ConcentracaoCarteira {
  const clientePorId = new Map(clientes.map((c) => [c.id, c]));
  const porCliente = new Map<string, { nome: string; valor: number; licitacoes: number }>();
  const porSegmento = new Map<string, { nome: string; valor: number; licitacoes: number }>();
  let total = 0;

  licitacoes.forEach((l) => {
    const valor = valorReferenciaLicitacao(l);
    total += valor;
    const cliente = clientePorId.get(l.clienteId);

    const c = porCliente.get(l.clienteId) ?? { nome: cliente?.nome ?? '—', valor: 0, licitacoes: 0 };
    c.valor += valor;
    c.licitacoes += 1;
    porCliente.set(l.clienteId, c);

    const nomeSegmento = (cliente?.segmento ?? '').trim() || 'Sem segmento';
    const chaveSegmento = normalizarNome(nomeSegmento);
    const sg = porSegmento.get(chaveSegmento) ?? { nome: nomeSegmento, valor: 0, licitacoes: 0 };
    sg.valor += valor;
    sg.licitacoes += 1;
    porSegmento.set(chaveSegmento, sg);
  });

  return {
    total,
    porCliente: montarFatias(porCliente, total, 8),
    porSegmento: montarFatias(porSegmento, total),
  };
}

export function calcularValorPorCliente(
  licitacoes: Licitacao[],
  unidades: UnidadeResultado[],
  disputas: Disputa[],
  nomeDoCliente: (id: string) => string
): ValorCliente[] {
  const disputaPorLicitacao = new Map(disputas.map((d) => [d.licitacaoId, d]));
  const mapa = new Map<string, ValorCliente>();
  const garantir = (id: string): ValorCliente => {
    const existente = mapa.get(id);
    if (existente) return existente;
    const novo: ValorCliente = {
      chave: id,
      nome: nomeDoCliente(id),
      valorEmDisputa: 0,
      valorAdjudicado: 0,
      licitacoesGanhas: 0,
      enviadas: 0,
      participacoes: 0,
      taxaVitoria: null,
      ganhoSobreMinimo: null,
    };
    mapa.set(id, novo);
    return novo;
  };

  licitacoes.forEach((l) => {
    const cliente = garantir(l.clienteId);
    if (l.liberadaAoClienteEm) cliente.enviadas += 1;
    if (l.decisaoCliente === 'participar') cliente.participacoes += 1;
    if (l.decisaoCliente !== 'participar') return;
    if (desfechoFinal(l, disputaPorLicitacao.get(l.id)) !== null) return;
    cliente.valorEmDisputa += valorReferenciaLicitacao(l);
  });

  // Taxa de vitória e ganho sobre o mínimo por cliente (mesma base do relatório).
  const unidadesPorCliente = new Map<string, UnidadeResultado[]>();
  unidades.forEach((u) => {
    const lista = unidadesPorCliente.get(u.clienteId) ?? [];
    lista.push(u);
    unidadesPorCliente.set(u.clienteId, lista);
  });
  unidadesPorCliente.forEach((lista, id) => {
    const cliente = garantir(id);
    cliente.taxaVitoria = calcularTaxaVitoria(lista).percentualQuantidade;
    const ganhos = lista.filter(
      (u) =>
        u.resultado === 'ganho' &&
        u.valorOfertado != null &&
        u.valorOfertado > 0 &&
        u.valorMinimoComFrete != null &&
        u.valorMinimoComFrete > 0
    );
    const minimo = ganhos.reduce((s, u) => s + (u.valorMinimoComFrete as number), 0);
    const ofertado = ganhos.reduce((s, u) => s + (u.valorOfertado as number), 0);
    cliente.ganhoSobreMinimo = minimo > 0 ? ((ofertado - minimo) / minimo) * 100 : null;
  });

  const ganhasPorCliente = new Map<string, Set<string>>();
  unidades.forEach((u) => {
    if (u.resultado !== 'ganho') return;
    garantir(u.clienteId).valorAdjudicado += u.valorOfertado ?? 0;
    const conjunto = ganhasPorCliente.get(u.clienteId) ?? new Set<string>();
    conjunto.add(u.licitacaoId);
    ganhasPorCliente.set(u.clienteId, conjunto);
  });
  ganhasPorCliente.forEach((conjunto, id) => {
    garantir(id).licitacoesGanhas = conjunto.size;
  });

  return [...mapa.values()]
    // Todos os clientes (sem corte nos 10 maiores), do maior valor adjudicado
    // para o menor.
    .sort(
      (a, b) =>
        b.valorAdjudicado - a.valorAdjudicado ||
        b.valorEmDisputa - a.valorEmDisputa ||
        a.nome.localeCompare(b.nome, 'pt-BR')
    );
}

export function calcularDesempenhoModalidade(
  licitacoes: Licitacao[],
  unidades: UnidadeResultado[]
): DesempenhoModalidade[] {
  const comGanho = new Set(unidades.filter((u) => u.resultado === 'ganho').map((u) => u.licitacaoId));
  const mapa = new Map<string, DesempenhoModalidade>();

  licitacoes.forEach((l) => {
    const chave = l.modalidade || 'sem-modalidade';
    const nome = MODALIDADE_LICITACAO_LABEL[l.modalidade as ModalidadeLicitacao] ?? (l.modalidade || 'Sem modalidade');
    const atual = mapa.get(chave) ?? { chave, nome, licitacoes: 0, participou: 0, ganhou: 0, taxa: null };
    atual.licitacoes += 1;
    if (l.decisaoCliente === 'participar') atual.participou += 1;
    if (comGanho.has(l.id)) atual.ganhou += 1;
    mapa.set(chave, atual);
  });

  return [...mapa.values()]
    .map((m) => ({ ...m, taxa: m.participou > 0 ? (m.ganhou / m.participou) * 100 : null }))
    .sort((a, b) => b.licitacoes - a.licitacoes || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// ---------------------------------------------------------------------------
// Mercado por UF e por esfera (Especificação 3.6) — 19/10
// ---------------------------------------------------------------------------
const ORDEM_ESFERAS: EsferaLicitacao[] = ['municipal', 'estadual', 'federal', 'distrital'];

function agruparDesempenhoTerritorio(
  licitacoes: Licitacao[],
  comGanho: Set<string>,
  chaveDe: (l: Licitacao) => { chave: string; nome: string }
): DesempenhoTerritorio[] {
  const mapa = new Map<string, DesempenhoTerritorio>();
  licitacoes.forEach((l) => {
    const { chave, nome } = chaveDe(l);
    const atual = mapa.get(chave) ?? { chave, nome, licitacoes: 0, participou: 0, ganhou: 0, taxa: null };
    atual.licitacoes += 1;
    if (l.decisaoCliente === 'participar') atual.participou += 1;
    if (comGanho.has(l.id)) atual.ganhou += 1;
    mapa.set(chave, atual);
  });
  return [...mapa.values()].map((m) => ({ ...m, taxa: m.participou > 0 ? (m.ganhou / m.participou) * 100 : null }));
}

/** Licitações, participações e vitórias por UF (as 10 com mais licitações) e por
 *  esfera. Licitação sem UF cai em "Sem UF" e sem esfera em "Não informada", para
 *  o dado faltante ficar visível. Vitória = ao menos 1 item ou grupo ganho. */
export function calcularMercadoUfEsfera(licitacoes: Licitacao[], unidades: UnidadeResultado[]): MercadoUfEsfera {
  const comGanho = new Set(unidades.filter((u) => u.resultado === 'ganho').map((u) => u.licitacaoId));

  const porUf = agruparDesempenhoTerritorio(licitacoes, comGanho, (l) => {
    const uf = ufDaLicitacao(l);
    return uf ? { chave: uf, nome: uf } : { chave: 'sem-uf', nome: 'Sem UF' };
  })
    .sort((a, b) => b.licitacoes - a.licitacoes || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, LIMITE_LISTA_GESTAO);

  const esferas = agruparDesempenhoTerritorio(licitacoes, comGanho, (l) =>
    l.esfera
      ? { chave: l.esfera, nome: ESFERA_LICITACAO_LABEL[l.esfera] ?? l.esfera }
      : { chave: FILTRO_SEM_ESFERA, nome: 'Não informada' }
  );
  const posicao = (chave: string) => {
    const i = ORDEM_ESFERAS.indexOf(chave as EsferaLicitacao);
    return i === -1 ? ORDEM_ESFERAS.length : i;
  };
  const porEsfera = esferas.sort((a, b) => posicao(a.chave) - posicao(b.chave));

  return { porUf, porEsfera };
}

/** Motivo de não participação de uma licitação, ou null se o cliente participou
 *  ou a licitação ainda está em aberto. Recusa: vale o motivo gravado (recusas
 *  anteriores à lista ficam "não classificado"). Sessão passada sem decisão:
 *  empresa ME/EPP = bloqueio do sistema; licitação exclusiva ME/EPP e empresa
 *  "Demais" = bloqueio do sistema; o resto = sem resposta do cliente. */
export function motivoNaoParticipacaoDaLicitacao(
  l: Licitacao,
  porteDoCliente: 'me_epp' | 'demais' | undefined,
  agora: Date
): ChaveMotivoIndicador | null {
  if (l.decisaoCliente === 'recusar') return l.motivoNaoParticipacao ?? 'nao_classificado';
  if (l.decisaoCliente === 'pendente' && new Date(dataDaLicitacao(l)) < agora) {
    if (porteDoCliente === 'me_epp') return 'bloqueio_porte';
    if (porteDoCliente === 'demais' && l.itens.length > 0 && licitacaoExclusivaMeEpp(l.itens)) return 'exclusiva_me_epp';
    return 'sem_resposta';
  }
  return null;
}

/** Licitações sem participação do cliente, por motivo e por grupo de motivo.
 *  Mesma definição de "Não participou" do filtro de resultado. */
export function calcularMotivosNaoParticipacao(
  licitacoes: Licitacao[],
  clientes: ClienteResumo[],
  agora: Date
): MotivosNaoParticipacao {
  const nomeDoCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? '—';
  const porte = new Map(clientes.map((c) => [c.id, c.porte]));
  const contagem = new Map<ChaveMotivoIndicador, number>();
  let total = 0;
  let valorReferenciaDescartado = 0;
  let semRespostaQtd = 0;
  let semRespostaValor = 0;
  let recusasCliente = 0;
  let outro = 0;
  let triagem = 0;
  const textosOutro: TextoMotivoOutro[] = [];
  licitacoes.forEach((l) => {
    const chave = motivoNaoParticipacaoDaLicitacao(l, porte.get(l.clienteId), agora);
    if (!chave) return;
    total += 1;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    const valor = valorReferenciaLicitacao(l);
    valorReferenciaDescartado += valor;
    if (chave === 'sem_resposta') {
      semRespostaQtd += 1;
      semRespostaValor += valor;
    }
    if (l.decisaoCliente === 'recusar') {
      recusasCliente += 1;
      if (chave === 'produto_nao_trabalha' || chave === 'especificacao_nao_atende') triagem += 1;
      if (chave === 'outro') {
        outro += 1;
        const texto = l.motivoRecusaCliente?.trim();
        if (texto) {
          textosOutro.push({ licitacaoId: l.id, numeroPregao: l.numeroPregao, cliente: nomeDoCliente(l.clienteId), texto });
        }
      }
    }
  });

  const percentual = (q: number) => (total > 0 ? (q / total) * 100 : 0);
  const motivos: LinhaMotivoNaoParticipacao[] = [];
  const grupos = new Map<GrupoMotivo, number>();
  contagem.forEach((quantidade, chave) => {
    const def = definicaoDoMotivo(chave);
    const grupo: GrupoMotivo = def?.grupo ?? 'outro';
    motivos.push({
      chave,
      nome: def?.rotulo ?? chave,
      grupo,
      origem: def?.origem ?? 'cliente',
      quantidade,
      percentual: percentual(quantidade),
    });
    grupos.set(grupo, (grupos.get(grupo) ?? 0) + quantidade);
  });
  motivos.sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'));

  const porGrupo: GrupoMotivoNaoParticipacao[] = [...grupos.entries()]
    .map(([grupo, quantidade]) => ({ grupo, nome: GRUPO_MOTIVO_LABEL[grupo], quantidade, percentual: percentual(quantidade) }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    total,
    valorReferenciaDescartado,
    semResposta: {
      quantidade: semRespostaQtd,
      valorReferencia: semRespostaValor,
      percentual: percentual(semRespostaQtd),
    },
    recusasCliente,
    textosOutro,
    percentualOutro: recusasCliente > 0 ? (outro / recusasCliente) * 100 : null,
    percentualTriagem: recusasCliente > 0 ? (triagem / recusasCliente) * 100 : null,
    motivos,
    porGrupo,
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

  // Com o filtro de resultado "Ganho" ou "Perdido", os cálculos por item/grupo
  // consideram só o que tem esse resultado (os demais itens da licitação saem).
  const soResultado = (us: UnidadeResultado[]) =>
    filtros.resultado === 'ganho'
      ? us.filter((u) => u.resultado === 'ganho')
      : filtros.resultado === 'perdido'
        ? us.filter((u) => ehPerdida(u))
        : us;

  const licitacoes = filtrarLicitacoes(dados.licitacoes, filtros, dados.disputas, agora);
  const unidades = soResultado(
    montarUnidades(licitacoes, dados.disputas, filtros.familiaId, filtros.marca, filtros.incluirProvisorios)
  );

  // Período anterior (mesmos demais filtros) para a variação da taxa de vitória.
  const anterior = periodoAnterior(filtros);
  let taxaAnterior: TaxaVitoria | null = null;
  if (anterior) {
    const licitacoesAnteriores = filtrarLicitacoes(dados.licitacoes, { ...filtros, ...anterior }, dados.disputas, agora);
    taxaAnterior = calcularTaxaVitoria(
      soResultado(
        montarUnidades(licitacoesAnteriores, dados.disputas, filtros.familiaId, filtros.marca, filtros.incluirProvisorios)
      )
    );
  }

  // Para o relatório principal: todos os resultados, definitivos e provisórios.
  const unidadesComProvisorios = soResultado(
    montarUnidades(licitacoes, dados.disputas, filtros.familiaId, filtros.marca, true)
  );

  return {
    taxaVitoriaPorMes: calcularTaxaVitoriaPorMes(unidades),
    perdasHabilitacao: calcularPerdasHabilitacao(licitacoes, unidades, nomeDoCliente),
    vitoriasConvocacao: calcularVitoriasConvocacao(licitacoes, unidades, nomeDoCliente),
    alertaAcompanhamento: calcularAlertaAcompanhamento(licitacoes, unidadesComProvisorios, nomeDoCliente),
    relatorioPrincipal: calcularRelatorioPrincipal(licitacoes, unidadesComProvisorios, dados.clientes, agora),
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
    foraDeMercado: calcularForaDeMercado(licitacoes, unidades, nomeDoCliente, nomeDaFamilia),
    distanciaDerrota: calcularDistanciaDerrota(licitacoes, unidades, nomeDaFamilia, nomeDoCliente),
    descontoMedio: calcularDescontoMedio(unidades, nomeDaFamilia),
    orgaos: calcularOrgaos(licitacoes, unidades),
    concorrentes: calcularConcorrentes(unidades, nomeDaFamilia),
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
    aproveitamento: calcularAproveitamento(licitacoes, nomeDoCliente),
    tempoResposta: calcularTempoResposta(licitacoes, nomeDoCliente, dados.reaberturas),
    // Olha sempre a atividade mais recente de cada cliente: ignora os filtros.
    // Só o filtro de cliente vale aqui: com um cliente escolhido, mostra só ele.
    clientesSemAtividade: calcularClientesSemAtividade(
      filtros.clienteId ? dados.licitacoes.filter((l) => l.clienteId === filtros.clienteId) : dados.licitacoes,
      filtros.clienteId ? dados.clientes.filter((c) => c.id === filtros.clienteId) : dados.clientes,
      agora,
      dados.faixasInatividade,
      valorAdjudicadoPorCliente(montarUnidades(dados.licitacoes, dados.disputas))
    ),
    concentracaoCarteira: calcularConcentracaoCarteira(licitacoes, dados.clientes),
    valorPorCliente: calcularValorPorCliente(licitacoes, unidades, dados.disputas, nomeDoCliente),
    desempenhoModalidade: calcularDesempenhoModalidade(licitacoes, unidades),
    mercadoUfEsfera: calcularMercadoUfEsfera(licitacoes, unidades),
    motivosNaoParticipacao: calcularMotivosNaoParticipacao(licitacoes, dados.clientes, agora),
    totalLicitacoes: licitacoes.length,
  };
}
