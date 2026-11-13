// src/utils/importacaoEditalJson.ts
//
// Lê o texto colado pelo analista (resultado do "Prompt SALUTTI – Importação
// para o Sistema") e o transforma em uma ExtracaoEditalIA pronta para
// pré-preencher o cadastro de licitação. Nunca grava nada: só valida,
// normaliza e devolve a lista de avisos (o que foi ignorado ou corrigido)
// para o analista conferir.
//
// Regras: valores nulos são ignorados; datas sem fuso valem no horário local;
// listas fechadas fora do permitido viram vazio (com aviso); itens de checklist
// com id desconhecido são descartados (com aviso).

import { unidadeDaLista } from '@/utils/unidadesMedida'
import type { ExtracaoEditalIA, ItemChecklistExtraidoIA } from '@/types/extracaoEditalIA'
import {
  listasDeExigencias,
  tipoDoObjeto,
  type EsferaLicitacao,
  type EstruturaLicitacao,
  type FormaPagamento,
  type ModalidadeLicitacao,
  type ParticipacaoLicitacao,
  type ProcedimentoLicitacao,
  type TipoContratacaoLicitacao,
  CRITERIOS_JULGAMENTO,
} from '@/types/licitacao'

export interface ResultadoImportacaoJson {
  extracao: ExtracaoEditalIA
  avisos: string[]
}

const MODALIDADES: ModalidadeLicitacao[] = ['pregao_eletronico', 'concorrencia']
const TIPOS_CONTRATACAO: TipoContratacaoLicitacao[] = ['licitacao', 'dispensa', 'adesao_arp']
const PROCEDIMENTOS: ProcedimentoLicitacao[] = ['convencional', 'srp']
const ESTRUTURAS: EstruturaLicitacao[] = ['item', 'lote_grupo', 'item_lote_grupo']
const PARTICIPACOES: ParticipacaoLicitacao[] = ['exclusiva_me_epp', 'ampla_concorrencia']
const FORMAS_PAGAMENTO: FormaPagamento[] = ['credito_conta', 'boleto', 'pix', 'outros']
const ESFERAS: EsferaLicitacao[] = ['municipal', 'estadual', 'federal', 'distrital']
const FORMAS_DISPUTA = CRITERIOS_JULGAMENTO
const MODOS_DISPUTA = ['Aberto', 'Fechado', 'Aberto/Fechado', 'Fechado/Aberto']
const OBJETOS = ['Produto', 'Serviços', 'Obra', 'Serviços Técnicos']

type Obj = Record<string, unknown>

function ehObjeto(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
}

/** Aceita número ou texto ("1.250,50", "R$ 88.370,00", "0,01", "12"). */
function numero(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (typeof v !== 'string') return undefined
  let t = v.replace(/[^\d,.-]/g, '')
  if (!t) return undefined
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

function opcao<T extends string>(v: unknown, permitidos: readonly T[]): T | undefined {
  const t = texto(v)
  return (permitidos as readonly string[]).includes(t) ? (t as T) : undefined
}

// Sinônimos comuns nos editais, levados para a sigla da lista de unidades do
// sistema (ex.: "und", "unid." e "Unidade" viram "UN"). O que não for
// reconhecido continua como texto livre ("Outra"), sem perda.
const SINONIMOS_UNIDADE: Record<string, string> = {
  UND: 'UN', UNID: 'UN', UNIDADE: 'UN', UNIDADES: 'UN',
  CAIXA: 'CX', CAIXAS: 'CX',
  PACOTE: 'PCT', PACOTES: 'PCT',
  QUILO: 'KG', QUILOGRAMA: 'KG', KILO: 'KG',
  LITRO: 'L', LITROS: 'L', LT: 'L',
  METRO: 'M', METROS: 'M', MT: 'M',
  M2: 'M²', 'METRO QUADRADO': 'M²',
  PECA: 'PÇ', PECAS: 'PÇ', PC: 'PÇ', PCA: 'PÇ',
  PARES: 'PAR', KITS: 'KIT', ROLO: 'RL', ROLOS: 'RL', FARDO: 'FD', FARDOS: 'FD',
  SERVICO: 'SV', SERVICOS: 'SV', HORA: 'H', HORAS: 'H', HR: 'H', MES: 'MÊS', MESES: 'MÊS',
}

function normalizarUnidade(bruta: string): string {
  const limpa = bruta.trim().replace(/\.$/, '')
  if (!limpa) return ''
  const chave = limpa.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  const sigla = SINONIMOS_UNIDADE[chave]
  if (sigla) return sigla
  return unidadeDaLista(limpa)?.sigla ?? limpa
}

function extrairJson(bruto: string): unknown {
  let t = bruto.trim()
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (cerca) t = cerca[1].trim()
  const ini = t.indexOf('{')
  const fim = t.lastIndexOf('}')
  if (ini === -1 || fim === -1 || fim < ini) {
    throw new Error('Não encontrei um bloco JSON no texto colado. Cole a resposta completa do prompt de importação.')
  }
  try {
    return JSON.parse(t.slice(ini, fim + 1))
  } catch (e) {
    const detalhe = e instanceof Error ? ` (${e.message})` : ''
    throw new Error(`O texto colado não é um JSON válido${detalhe}. Confira se a resposta foi copiada inteira.`)
  }
}

function lerChecklist(
  bruto: unknown,
  idsValidos: ReadonlySet<string>,
  secao: string,
  avisos: string[]
): ItemChecklistExtraidoIA[] {
  if (!Array.isArray(bruto)) return []
  const vistos = new Set<string>()
  const itens: ItemChecklistExtraidoIA[] = []
  for (const x of bruto) {
    if (!ehObjeto(x)) continue
    const id = texto(x.id)
    const status = x.status === 'exigido' || x.status === 'nao_exigido' ? x.status : undefined
    if (!id || !status) {
      avisos.push(`${secao}: um item sem identificação ou sem situação (exigido / não exigido) foi ignorado.`)
      continue
    }
    if (!idsValidos.has(id)) {
      avisos.push(`${secao}: o item "${id}" não existe na lista do sistema e foi ignorado.`)
      continue
    }
    if (vistos.has(id)) {
      avisos.push(`${secao}: o item "${id}" veio repetido; vale o primeiro.`)
      continue
    }
    vistos.add(id)
    itens.push({ id, status, detalhamento: texto(x.detalhamento) })
  }
  return itens
}

export function lerImportacaoEditalJson(bruto: string): ResultadoImportacaoJson {
  const dado = extrairJson(bruto)
  if (!ehObjeto(dado)) throw new Error('O JSON colado precisa ser um objeto ({ ... }).')

  const avisos: string[] = []

  // --- Identificação ---
  const objetoTxt = opcao(dado.objeto, OBJETOS)
  if (dado.objeto && !objetoTxt) avisos.push(`Objeto "${texto(dado.objeto)}" fora da lista (Produto, Serviços, Obra, Serviços Técnicos): confira.`)
  const objeto = objetoTxt ?? ''
  const listas = listasDeExigencias(tipoDoObjeto(objeto))
  const hab = ehObjeto(dado.habilitacao) ? dado.habilitacao : {}

  let dataLicitacao: string | undefined
  if (dado.dataLicitacao) {
    const d = new Date(texto(dado.dataLicitacao))
    if (Number.isNaN(d.getTime())) avisos.push('Data e horário da licitação não reconhecidos: preencha à mão.')
    else dataLicitacao = d.toISOString()
  }

  const cnpj = texto(dado.orgaoCnpj).replace(/\D/g, '')
  if (cnpj && cnpj.length !== 14) avisos.push('CNPJ do órgão com tamanho inválido: ignorado.')
  const uasg = texto(dado.orgaoUasg).replace(/\D/g, '')

  const lista = <T extends string>(v: unknown, permitidos: readonly T[], rotulo: string): T | undefined => {
    const r = opcao(v, permitidos)
    if (texto(v) && !r) avisos.push(`${rotulo}: valor "${texto(v)}" não é aceito pelo sistema; escolha à mão.`)
    return r
  }

  const modalidade = lista(dado.modalidade, MODALIDADES, 'Modalidade')
  const estrutura = lista(dado.estrutura, ESTRUTURAS, 'Estrutura')
  const tipoContratacao = lista(dado.tipoContratacao, TIPOS_CONTRATACAO, 'Tipo de contratação')
  const procedimento = lista(dado.procedimento, PROCEDIMENTOS, 'Registro de preços')
  const participacao = lista(dado.participacao, PARTICIPACOES, 'Participação')
  const esfera = opcao(dado.esfera, ESFERAS)
  const formaDisputa = lista(dado.formaDisputa, FORMAS_DISPUTA, 'Forma de disputa')
  const modoDisputa = lista(dado.modoDisputa, MODOS_DISPUTA, 'Modo de disputa')

  const capagBruta = texto(dado.capag).toUpperCase()
  const capag = ['A', 'B', 'C', 'N/D'].includes(capagBruta) ? capagBruta : undefined

  // --- Condições comerciais ---
  const cc = ehObjeto(dado.condicoesComerciais) ? dado.condicoesComerciais : {}
  const formaPagamento = lista(cc.formaPagamento, FORMAS_PAGAMENTO, 'Forma de pagamento') ?? 'credito_conta'
  const condicoes: ExtracaoEditalIA['condicoesComerciais'] = {
    formaPagamento,
    possuiGarantias: cc.possuiGarantias === true,
    localEntrega: texto(cc.localEntrega),
  }
  const tipoInt = opcao(cc.tipoIntervaloLances, ['valor', 'percentual'] as const)
  if (tipoInt) condicoes.tipoIntervaloLances = tipoInt
  const vInt = numero(cc.valorIntervaloLances)
  if (vInt !== undefined) condicoes.valorIntervaloLances = vInt
  const pInt = numero(cc.percentualIntervaloLances)
  if (pInt !== undefined) condicoes.percentualIntervaloLances = pInt
  if (texto(cc.intervaloLancesDetalhe)) condicoes.intervaloLancesDetalhe = texto(cc.intervaloLancesDetalhe)
  if (texto(cc.garantiasDetalhe)) condicoes.garantiasDetalhe = texto(cc.garantiasDetalhe)
  const prazoPag = numero(cc.prazoPagamentoDias)
  if (prazoPag !== undefined) condicoes.prazoPagamentoDias = Math.round(prazoPag)
  const prazoEnt = numero(cc.prazoEntregaDias)
  if (prazoEnt !== undefined) condicoes.prazoEntregaDias = Math.round(prazoEnt)
  const validade = numero(cc.validadePropostaDias)
  if (validade !== undefined) condicoes.validadePropostaDias = Math.round(validade)
  if (texto(cc.prazoVigencia)) condicoes.prazoVigencia = texto(cc.prazoVigencia)
  if (texto(cc.reajusteRepactuacao)) condicoes.reajusteRepactuacao = texto(cc.reajusteRepactuacao)
  const sub = opcao(cc.subcontratacao, ['permitida', 'permitida_com_limite', 'vedada', 'omisso'] as const)
  if (sub) condicoes.subcontratacao = sub
  const parcelada = opcao(cc.entregaParcelada, ['sim', 'nao'] as const)
  if (parcelada) condicoes.entregaParcelada = parcelada
  if (texto(cc.entregaParceladaDetalhe)) condicoes.entregaParceladaDetalhe = texto(cc.entregaParceladaDetalhe)
  const plan = opcao(cc.exigePlanilhaCustos, ['sim', 'nao'] as const)
  if (plan) condicoes.exigePlanilhaCustos = plan

  // --- Grupos e itens ---
  const grupos: { numero: string; nome: string }[] = []
  if (Array.isArray(dado.grupos)) {
    for (const g of dado.grupos) {
      if (!ehObjeto(g) || !texto(g.numero)) continue
      grupos.push({ numero: texto(g.numero), nome: texto(g.nome) || `Lote ${texto(g.numero)}` })
    }
  }
  const itens: ExtracaoEditalIA['itens'] = []
  if (Array.isArray(dado.itens)) {
    dado.itens.forEach((x, posicao) => {
      if (!ehObjeto(x)) return
      const num = texto(x.numero)
      const descricao = texto(x.descricao)
      if (!num || !descricao) {
        avisos.push(`Item na posição ${posicao + 1} sem número ou sem descrição: ignorado.`)
        return
      }
      const qtd = numero(x.quantidade)
      const preco = numero(x.precoReferencia)
      if (qtd === undefined) avisos.push(`Item ${num}: quantidade não reconhecida (ficou 0).`)
      if (preco === undefined) avisos.push(`Item ${num}: valor de referência não reconhecido (ficou 0).`)
      const item: ExtracaoEditalIA['itens'][number] = {
        numero: num,
        descricao,
        unidadeMedida: normalizarUnidade(texto(x.unidadeMedida)),
        quantidade: qtd ?? 0,
        precoReferencia: preco ?? 0,
        exclusivoMeEpp: x.exclusivoMeEpp === true,
      }
      const gnum = texto(x.grupoNumero)
      if (gnum) {
        item.grupoNumero = gnum
        if (!grupos.some((g) => g.numero === gnum)) {
          grupos.push({ numero: gnum, nome: `Lote ${gnum}` })
          avisos.push(`Item ${num} citava o lote ${gnum}, que não estava na lista de grupos; o lote foi criado.`)
        }
      }
      itens.push(item)
    })
  }
  if (itens.length === 0) avisos.push('Nenhum item foi encontrado no JSON: cadastre os itens na aba Itens.')

  const valorTotal = numero(dado.valorTotalLicitacao)

  const extracao: ExtracaoEditalIA = {
    dataLicitacao,
    portal: texto(dado.portal),
    objeto,
    numeroPregao: texto(dado.numeroPregao),
    orgao: texto(dado.orgao),
    estado: texto(dado.estado).toUpperCase().slice(0, 2),
    municipio: texto(dado.municipio),
    esfera: esfera ?? null,
    modalidade: (modalidade ?? '') as ModalidadeLicitacao,
    estrutura: (estrutura ?? '') as EstruturaLicitacao,
    tipoContratacao: (tipoContratacao ?? '') as TipoContratacaoLicitacao,
    procedimento: (procedimento ?? '') as ProcedimentoLicitacao,
    formaDisputa: formaDisputa ?? '',
    modoDisputa: modoDisputa ?? '',
    participacao: (participacao ?? '') as ParticipacaoLicitacao,
    capag,
    valorTotalLicitacao: valorTotal,
    orgaoCnpj: cnpj.length === 14 ? cnpj : undefined,
    orgaoUasg: uasg || undefined,
    habilitacao: {
      juridica: lerChecklist(hab.juridica, new Set(listas.juridica.map((i) => i.id)), 'Habilitação jurídica', avisos),
      fiscalSocialTrabalhista: lerChecklist(
        hab.fiscalSocialTrabalhista,
        new Set(listas.fiscalSocialTrabalhista.map((i) => i.id)),
        'Regularidade fiscal, social e trabalhista',
        avisos
      ),
      economicoFinanceira: lerChecklist(
        hab.economicoFinanceira,
        new Set(listas.economicoFinanceira.map((i) => i.id)),
        'Qualificação econômico-financeira',
        avisos
      ),
      tecnica: lerChecklist(hab.tecnica, new Set(listas.tecnica.map((i) => i.id)), 'Qualificação técnica', avisos),
    },
    declaracoes: lerChecklist(dado.declaracoes, new Set(listas.declaracoes.map((i) => i.id)), 'Declarações', avisos),
    condicoesComerciais: condicoes,
    outrasExigencias: lerChecklist(
      dado.outrasExigencias,
      new Set(listas.outras.map((i) => i.id)),
      'Outras exigências',
      avisos
    ),
    grupos,
    itens,
    pontosAtencao: texto(dado.pontosAtencao),
    camposComBaixaConfianca: Array.isArray(dado.camposComBaixaConfianca)
      ? dado.camposComBaixaConfianca.map(texto).filter(Boolean)
      : [],
  }

  if (!extracao.dataLicitacao && !avisos.some((a) => a.startsWith('Data'))) avisos.push('Data e horário da licitação ausentes: preencha à mão.')
  if (!extracao.orgao) avisos.push('Órgão ausente: preencha à mão.')
  if (!extracao.numeroPregao) avisos.push('Número da licitação ausente: preencha à mão.')

  return { extracao, avisos }
}
