// src/components/Licitacoes/PropostaComercialCards.tsx
//
// Novo layout em cartões (Grupo → Itens) que substitui a planilha
// (PropostaComercialTable.tsx) tanto na tela do Cliente quanto na do
// Admin — aprovado a partir do protótipo visual feito no Artifact.
//
// ETAPA 2 (acrescenta à Etapa 1):
//   - Formulário de preenchimento por item (Valor unitário / Marca/Fabricante
//     / Modelo/Versão) — os 3 campos definidos com o Márcio, substituindo os
//     5 campos antigos da planilha (Código interno e Descrição ofertada
//     saem do fluxo, mas continuam existindo no banco se já tiverem sido
//     preenchidos antes — só não são mais editados aqui).
//   - Edição dos dados de referência pelo Admin (Unid. / Quant. / Valor
//     unit. ref.), num mini-painel dentro do próprio cartão do item.
//   - Campo de Frete (%) editável no cabeçalho, aplicado à proposta inteira
//     (mesma regra de sempre — não é por item).
//   - Botão "Salvar", chamando onSalvar com o mesmo contrato
//     (SalvarPropostaComercialPayload) que a tabela antiga já usava — troca
//     de componente sem precisar mudar o service nem o backend.
//
// ETAPA 3 (acrescenta à Etapa 2):
//   - Cartão "TOTAL GERAL" ao final da lista de grupos — mesma regra da
//     tabela antiga: soma referência x proposta de TODOS os itens
//     participáveis (exclui os bloqueados por ME/EPP quando o Cliente é
//     "demais"), calcula o % de diferença e classifica com a mesma escala
//     (🚀 Forte / ⚖️ Positiva / ❌ Não participar).
//
// Ainda falta (Etapa 4): revisão final das regras de negócio (prazo de
// edição, aviso de licitação inteira ME/EPP) — essas já são resolvidas pela
// PÁGINA que usa este componente, não pelo componente em si, então a
// checagem da Etapa 4 é mais uma conferência do que código novo. Depois
// disso, Etapa 5: trocar de verdade nas telas.

import { useEffect, useMemo, useState } from 'react'
import { Licitacao, ItemLicitacao, GrupoItens, PropostaClienteItem } from '@/types/licitacao'
import { PorteEmpresa } from '@/types/cliente'
import {
  calcularAnaliseItem,
  classificarStatusProposta,
  totalReferenciaItem,
  totalReferenciaGrupo,
} from '@/utils/licitacaoCalculos'
import { formatarMoeda } from '@/utils/prazoUtils'

// Mesmo contrato que PropostaComercialTable.tsx já usa — mantido aqui com o
// mesmo nome e formato para a troca de componente (Etapa 5) não exigir
// mudar nada nas páginas que chamam onSalvar nem no licitacaoService.
export interface SalvarPropostaComercialPayload {
  itensReferencia?: Array<Pick<ItemLicitacao, 'id' | 'descricao' | 'unidadeMedida' | 'quantidade' | 'precoReferencia'>>
  propostaPorItem: Array<{ id: string; propostaCliente: PropostaClienteItem }>
  incluirFrete: boolean
  percentualFrete?: number
}

interface PropostaComercialCardsProps {
  licitacao: Licitacao
  /** Admin: pode editar os dados de referência (Unid./Quant./Valor ref.). */
  podeEditarItens: boolean
  /** Admin ou Cliente dentro do prazo: pode preencher/editar a proposta
   *  (Valor unitário/Marca/Modelo) e o frete. Funcionário (só leitura) e
   *  Cliente fora do prazo: false — mostra tudo em modo leitura. */
  podeEditarPropostaComercial: boolean
  salvando?: boolean
  onSalvar: (payload: SalvarPropostaComercialPayload) => Promise<void>
  textoBotaoSalvar?: string
  /** Porte do Cliente logado — só passado na tela do Cliente. Quando
   *  'demais', bloqueia visualmente os itens exclusivos ME/EPP. */
  porteCliente?: PorteEmpresa
  /** true na tela do Admin — itens "❌ Não participar" ficam ocultos por
   *  padrão, com um botão para revelar a lista inteira. */
  ocultarNaoParticiparPorPadrao?: boolean
}

interface BlocoGrupo {
  grupo: GrupoItens | null
  itens: ItemLicitacao[]
}

interface FormProposta {
  marca: string
  modelo: string
  precoMinimo: string // string p/ aceitar vírgula decimal enquanto digita
}

interface FormReferencia {
  unidadeMedida: string
  quantidade: string
  precoReferencia: string
}

// `casas` limita quantas casas decimais o valor guarda (o corte só acontece
// na conversão de volta pra número — nunca no texto que a pessoa está
// digitando). Preço (referência/proposta) usa 6 casas; frete usa 2.
function numeroParaCampo(valor: number | null | undefined, casas = 6): string {
  if (valor == null) return ''
  const texto = valor
    .toFixed(casas)
    .replace(/0+$/, '')
    .replace(/,$|\.$/, '')
    .replace('.', ',')
  return texto === '' || texto === '-' ? '0' : texto
}

// Aceita tanto vírgula decimal com ponto de milhar ("1.234,5678") quanto
// ponto decimal solto ("1234.5678") — sem isso, um valor como "1.234,56"
// vira "1.23456" ao trocar só a vírgula por ponto (o ponto de milhar não é
// removido antes), corrompendo o número silenciosamente.
function campoParaNumero(valor: string, casas = 6): number | undefined {
  const limpo = valor.trim()
  if (!limpo) return undefined
  const semSeparadorMilhar = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const numero = parseFloat(semSeparadorMilhar)
  if (isNaN(numero)) return undefined
  const fator = Math.pow(10, casas)
  return Math.round(numero * fator) / fator
}

function montarFormPropostaInicial(itens: ItemLicitacao[]): Record<string, FormProposta> {
  const mapa: Record<string, FormProposta> = {}
  itens.forEach((item) => {
    mapa[item.id] = {
      marca: item.propostaCliente?.marca ?? '',
      modelo: item.propostaCliente?.modelo ?? '',
      precoMinimo: numeroParaCampo(item.propostaCliente?.precoMinimo),
    }
  })
  return mapa
}

function montarFormReferenciaInicial(itens: ItemLicitacao[]): Record<string, FormReferencia> {
  const mapa: Record<string, FormReferencia> = {}
  itens.forEach((item) => {
    mapa[item.id] = {
      unidadeMedida: item.unidadeMedida,
      quantidade: String(item.quantidade),
      // 10 casas — mesmo limite usado no cadastro da licitação
      // (LicitacaoFormModal): valor de referência pode vir do edital com
      // mais de 6 casas decimais (ex.: 4,57550140), e o padrão de 6 casas
      // do numeroParaCampo estava truncando esse valor ao abrir o campo
      // aqui para edição pelo Admin.
      precoReferencia: numeroParaCampo(item.precoReferencia, 10),
    }
  })
  return mapa
}

// O campo "Número do pregão" costuma já vir digitado com o prefixo "Nº"
// (ex.: "Nº 95/2026 - 13/2026", copiado direto do edital) — remove esse
// prefixo antes de exibir no cabeçalho, que já adiciona o seu próprio "Nº ",
// para não duplicar ("Nº Nº 95/2026..."). Cobre variações comuns de como a
// pessoa pode ter digitado (Nº, N°, N.º, No, com ou sem espaço).
function removerPrefixoNumero(numeroPregao: string): string {
  return numeroPregao.replace(/^\s*n[ºo°.]*\s*/i, '').trim()
}

// Agrupa os itens por grupo/lote. Licitações com estrutura "Item" (sem
// grupo) caem todas num único bloco "Itens", pra não forçar navegação em 2
// níveis quando não existe divisão em grupos.
function agruparItens(licitacao: Licitacao): BlocoGrupo[] {
  if (licitacao.grupos.length === 0) {
    return [{ grupo: null, itens: licitacao.itens }]
  }
  return licitacao.grupos.map((grupo) => ({
    grupo,
    itens: licitacao.itens.filter((item) => item.grupoId === grupo.id),
  }))
}

export function PropostaComercialCards({
  licitacao,
  podeEditarItens,
  podeEditarPropostaComercial,
  salvando,
  onSalvar,
  textoBotaoSalvar,
  porteCliente,
  ocultarNaoParticiparPorPadrao,
}: PropostaComercialCardsProps) {
  const blocos = useMemo(() => agruparItens(licitacao), [licitacao])
  const [grupoAberto, setGrupoAberto] = useState<string | null>(
    blocos[0] ? (blocos[0].grupo?.id ?? '__sem_grupo__') : null
  )
  const [itemAberto, setItemAberto] = useState<string | null>(null)
  const [ocultarNaoParticipar, setOcultarNaoParticipar] = useState(!!ocultarNaoParticiparPorPadrao)

  const [formPorItem, setFormPorItem] = useState<Record<string, FormProposta>>(() =>
    montarFormPropostaInicial(licitacao.itens)
  )
  const [formReferenciaPorItem, setFormReferenciaPorItem] = useState<Record<string, FormReferencia>>(() =>
    montarFormReferenciaInicial(licitacao.itens)
  )
  const [taxaFrete, setTaxaFrete] = useState<string>(numeroParaCampo(licitacao.percentualFrete, 2))
  const [erro, setErro] = useState<string | null>(null)

  // Depois de salvar, a página recarrega a licitação (atualizadoEm muda) —
  // resincroniza os formulários locais com o que voltou do banco, pra não
  // ficar com rascunho "fantasma" divergindo do que foi realmente salvo.
  useEffect(() => {
    setFormPorItem(montarFormPropostaInicial(licitacao.itens))
    setFormReferenciaPorItem(montarFormReferenciaInicial(licitacao.itens))
    setTaxaFrete(numeroParaCampo(licitacao.percentualFrete, 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licitacao.atualizadoEm])

  const taxaFreteNumero = campoParaNumero(taxaFrete, 2) ?? 0
  const taxaFretePreenchida = campoParaNumero(taxaFrete, 2) != null

  // Aplica o rascunho local (proposta +, se o Admin puder editar, a
  // referência) por cima do item persistido — é o que alimenta os cálculos
  // de análise em tempo real, antes de salvar.
  function itemAoVivo(item: ItemLicitacao): ItemLicitacao {
    const formProposta = formPorItem[item.id]
    const formReferencia = podeEditarItens ? formReferenciaPorItem[item.id] : undefined
    return {
      ...item,
      unidadeMedida: formReferencia?.unidadeMedida ?? item.unidadeMedida,
      quantidade: formReferencia ? Number(formReferencia.quantidade) || item.quantidade : item.quantidade,
      precoReferencia: formReferencia ? campoParaNumero(formReferencia.precoReferencia, 10) ?? item.precoReferencia : item.precoReferencia,
      propostaCliente: {
        ...item.propostaCliente,
        marca: formProposta?.marca ?? item.propostaCliente?.marca ?? '',
        modelo: formProposta?.modelo ?? item.propostaCliente?.modelo ?? '',
        precoMinimo: formProposta ? campoParaNumero(formProposta.precoMinimo) : item.propostaCliente?.precoMinimo,
      },
    }
  }

  const itensAoVivo = useMemo(() => licitacao.itens.map(itemAoVivo), [licitacao.itens, formPorItem, formReferenciaPorItem, podeEditarItens])

  const totalItens = itensAoVivo.length
  const preenchidos = itensAoVivo.filter((item) => item.propostaCliente?.precoMinimo != null).length

  // TOTAL GERAL — a pedido do Márcio (24/09): antes somava o valor de
  // referência de TODOS os itens participáveis, mesmo de grupos que o
  // cliente nunca tocou — isso inflava o valor de referência do total (ex.:
  // um grupo inteiro sem nenhum preço lançado ainda entrava na conta) e
  // distorcia o % de diferença. Agora só entram no TOTAL GERAL os grupos
  // (ou os itens individuais "sem grupo") em que o cliente já preencheu
  // pelo menos 1 item — ex.: se ele só participa dos Grupos 1 e 4, o valor
  // de referência do total é só desses dois grupos, não da licitação
  // inteira. Um grupo com preenchimento parcial (17 de 18, por ex.) já
  // conta como "escolhido" e entra inteiro, igual ao card do próprio grupo.
  const resumoGeral = useMemo(() => {
    const idGrupoDoItem = (item: ItemLicitacao) => item.grupoId ?? '__sem_grupo__'

    const participaveisTodos = itensAoVivo.filter((item) => !(item.exclusivoMeEpp && porteCliente === 'demais'))
    const bloqueadosMeEpp = itensAoVivo.length - participaveisTodos.length

    const gruposEscolhidos = new Set(
      participaveisTodos.filter((item) => item.propostaCliente?.precoMinimo != null).map(idGrupoDoItem)
    )
    const gruposParticipaveisTodos = new Set(participaveisTodos.map(idGrupoDoItem))
    const gruposAindaNaoEscolhidos = gruposParticipaveisTodos.size - gruposEscolhidos.size

    const participaveis = participaveisTodos.filter((item) => gruposEscolhidos.has(idGrupoDoItem(item)))

    // Dentro dos grupos escolhidos, a referência conta só os itens já
    // preenchidos — não o grupo inteiro. Um grupo com 17 de 18 preenchidos
    // não pode somar a referência dos 18 (o item que falta ainda não tem
    // preço pra comparar), senão o "Valor de referência" fica maior que a
    // quantidade de itens preenchidos sugere, e a % de diferença falseia.
    let valorTotalReferencia = 0
    let valorTotalProposta = 0
    let itensPreenchidos = 0
    participaveis.forEach((item) => {
      const analise = calcularAnaliseItem(item, taxaFreteNumero, taxaFretePreenchida)
      if (item.propostaCliente?.precoMinimo != null) {
        valorTotalReferencia += totalReferenciaItem(item)
        itensPreenchidos += 1
      }
      if (analise.valorTotal != null) valorTotalProposta += analise.valorTotal
    })
    const percentualTotal = valorTotalReferencia > 0 ? (valorTotalProposta - valorTotalReferencia) / valorTotalReferencia : null
    const statusGeral = classificarStatusProposta(percentualTotal)
    return {
      valorTotalReferencia,
      valorTotalProposta,
      percentualTotal,
      statusGeral,
      itensPreenchidos,
      totalParticipaveis: participaveis.length,
      bloqueadosMeEpp,
      gruposAindaNaoEscolhidos,
    }
  }, [itensAoVivo, porteCliente, taxaFreteNumero, taxaFretePreenchida])

  function atualizarCampoProposta(itemId: string, campo: keyof FormProposta, valor: string) {
    setFormPorItem((atual) => ({
      ...atual,
      [itemId]: { ...atual[itemId], [campo]: valor },
    }))
  }

  function atualizarCampoReferencia(itemId: string, campo: keyof FormReferencia, valor: string) {
    setFormReferenciaPorItem((atual) => ({
      ...atual,
      [itemId]: { ...atual[itemId], [campo]: valor },
    }))
  }

  // Regra do Márcio (25/09): o cliente não pode enviar proposta de só
  // parte de um grupo — ou preenche TODOS os itens participáveis do grupo
  // (excluindo os bloqueados por ME/EPP, que ele nem consegue preencher),
  // ou deixa o grupo inteiro sem preço (não participa dele). Um grupo pela
  // metade não tem como ser corretamente comparado contra a referência —
  // por isso o cálculo de competitividade do grupo (acima) também só roda
  // quando ele está 100% preenchido.
  function gruposComPreenchimentoParcial(): string[] {
    const nomes: string[] = []
    blocos.forEach(({ grupo, itens }) => {
      const itensVivos = itens.map(itemAoVivo)
      const participaveis = itensVivos.filter((item) => !(item.exclusivoMeEpp && porteCliente === 'demais'))
      if (participaveis.length === 0) return
      const preenchidos = participaveis.filter((item) => item.propostaCliente?.precoMinimo != null).length
      if (preenchidos > 0 && preenchidos < participaveis.length) {
        nomes.push(grupo ? (grupo.nome?.trim() ? grupo.nome : `Grupo ${grupo.numero}`) : 'Itens individuais')
      }
    })
    return nomes
  }

  async function handleSalvar() {
    setErro(null)

    const incompletos = gruposComPreenchimentoParcial()
    if (incompletos.length > 0) {
      setErro(
        `${incompletos.length === 1 ? 'Este grupo está' : 'Estes grupos estão'} com preenchimento parcial: ${incompletos.join(
          ', '
        )}. Preencha todos os itens do grupo pra participar dele, ou apague os preços já lançados pra não participar.`
      )
      return
    }

    try {
      const propostaPorItem = itensAoVivo.map((item) => ({
        id: item.id,
        propostaCliente: {
          // Preserva codigoInterno/descricaoProduto se já existirem de um
          // preenchimento anterior (planilha antiga) — não são mais
          // editados aqui, mas não é pra apagar dado histórico.
          codigoInterno: item.propostaCliente?.codigoInterno,
          descricaoProduto: item.propostaCliente?.descricaoProduto,
          marca: item.propostaCliente?.marca,
          modelo: item.propostaCliente?.modelo,
          precoMinimo: item.propostaCliente?.precoMinimo,
        } satisfies PropostaClienteItem,
      }))

      const itensReferencia = podeEditarItens
        ? itensAoVivo.map((item) => ({
            id: item.id,
            descricao: item.descricao,
            unidadeMedida: item.unidadeMedida,
            quantidade: item.quantidade,
            precoReferencia: item.precoReferencia,
          }))
        : undefined

      await onSalvar({
        propostaPorItem,
        itensReferencia,
        incluirFrete: taxaFreteNumero > 0,
        percentualFrete: taxaFreteNumero > 0 ? taxaFreteNumero : undefined,
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho — número, órgão, critério de julgamento, modo de disputa
          (já preenchidos pelo Analista no cadastro) + frete da proposta. */}
      <div className="flex flex-col gap-4 rounded-2xl border border-ink-soft/10 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-forest-mist px-2.5 py-1 font-body text-[10px] font-bold uppercase tracking-wide text-forest-deep">
            {licitacao.modalidade === 'concorrencia' ? 'Concorrência' : 'Pregão Eletrônico'}
          </span>
          {licitacao.procedimento === 'srp' && (
            <span className="rounded-full bg-brass-pale px-2.5 py-1 font-body text-[10px] font-bold uppercase tracking-wide text-brass">
              SRP
            </span>
          )}
        </div>

        <div>
          <h1 className="font-display text-xl text-ink">
            Nº {removerPrefixoNumero(licitacao.numeroPregao)} — {licitacao.orgao}
          </h1>
          {/* Município/UF removidos daqui (24/09) — o órgão já costuma
              trazer a cidade/UF no próprio nome (ex.: "Prefeitura Municipal
              de Nova Campina/SP"), então repetir abaixo era redundante.
              O objeto continua aparecendo quando estiver preenchido. */}
          {licitacao.objeto && <p className="mt-1 font-body text-sm text-ink-soft">{licitacao.objeto}</p>}
        </div>

        <div className="border-t border-ink-soft/10 pt-3">
          <label className="mb-1 block font-body text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
            Frete (%)
          </label>
          {podeEditarPropostaComercial ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={taxaFrete}
                onChange={(e) => setTaxaFrete(e.target.value)}
                className="w-24 rounded-lg border border-forest/30 bg-forest-mist/20 px-3 py-2 font-body text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
              />
              <span className="font-body text-[11px] text-ink-soft">aplicado a todos os itens da proposta</span>
            </div>
          ) : (
            <p className="font-body text-sm font-semibold text-ink">
              {taxaFretePreenchida ? `${taxaFrete}%` : '— não informado'}
            </p>
          )}
        </div>

        {/* TOTAL GERAL — antes ficava num cartão separado, embaixo da lista
            de grupos; movido para o cabeçalho para ficar visível sem
            precisar rolar a tela. Só aparece quando pelo menos 1 item
            participável já foi preenchido, igual à tabela antiga. */}
        {resumoGeral.itensPreenchidos > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-forest bg-forest-mist/20 p-4">
            <div>
              <div className="font-display text-sm font-bold text-forest-deep">ANÁLISE DA PARTICIPAÇÃO</div>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <CampoResumo label="Valor de referência" valor={formatarMoeda(resumoGeral.valorTotalReferencia)} />
              <CampoResumo label="Valor da proposta" valor={formatarMoeda(resumoGeral.valorTotalProposta)} />
              <CampoResumo
                label="Diferença"
                valor={resumoGeral.percentualTotal != null ? `${(resumoGeral.percentualTotal * 100).toFixed(1)}%` : '—'}
              />
              <span className={`whitespace-nowrap rounded-full px-3 py-1.5 font-body text-xs font-semibold ${resumoGeral.statusGeral.classe}`}>
                {resumoGeral.statusGeral.label}
              </span>
            </div>
          </div>
        )}
      </div>

      {ocultarNaoParticiparPorPadrao && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper-2/70 px-3 py-2">
          <p className="font-body text-xs text-ink-soft">
            {ocultarNaoParticipar
              ? 'Itens com status "❌ Não participar" estão ocultos nesta visualização.'
              : 'Mostrando todos os itens, incluindo os "❌ Não participar".'}
          </p>
          <button
            type="button"
            onClick={() => setOcultarNaoParticipar((atual) => !atual)}
            className="whitespace-nowrap font-body text-xs font-semibold text-forest hover:underline"
          >
            {ocultarNaoParticipar ? 'Mostrar tudo' : 'Ocultar "Não participar" de novo'}
          </button>
        </div>
      )}

      {/* Grupos */}
      {blocos.map(({ grupo, itens }) => {
        const idBloco = grupo?.id ?? '__sem_grupo__'
        const aberto = grupoAberto === idBloco
        const itensAoVivoDoGrupo = itens.map(itemAoVivo)
        const preenchidosGrupo = itensAoVivoDoGrupo.filter((item) => item.propostaCliente?.precoMinimo != null).length
        // Itens que o cliente PODE preencher neste grupo (exclui os
        // bloqueados por ME/EPP quando ele é "demais") — é contra esse
        // número que checamos se o grupo está 100% preenchido.
        const itensParticipaveisGrupo = itensAoVivoDoGrupo.filter(
          (item) => !(item.exclusivoMeEpp && porteCliente === 'demais')
        ).length
        const grupoCompleto = itensParticipaveisGrupo > 0 && preenchidosGrupo === itensParticipaveisGrupo

        // Valor de referência = valor FIXO do edital (soma de todos os itens
        // do grupo), independente do cliente já ter preenchido ou não — a
        // pedido do Márcio (25/09). "Valor da proposta" (antigo "Valor do
        // grupo") é que muda conforme ele preenche.
        const valorRefGrupo = grupo
          ? totalReferenciaGrupo(itensAoVivo, grupo.id)
          : itensAoVivoDoGrupo.reduce((soma, item) => soma + totalReferenciaItem(item), 0)
        const valorPropostaGrupo = itensAoVivoDoGrupo.reduce((soma, item) => {
          const analise = calcularAnaliseItem(item, taxaFreteNumero, taxaFretePreenchida)
          return soma + (analise.valorTotal ?? 0)
        }, 0)
        // A competitividade (%/selo) só é calculada quando o grupo está
        // 100% preenchido — comparar a referência fixa do grupo inteiro
        // contra uma proposta ainda parcial (ex.: 1 de 5 itens) dava
        // resultado sem sentido (ex.: "Super competitivo" só porque os
        // outros 4 itens ainda somam R$ 0). Isso também casa com a regra
        // de só poder salvar um grupo inteiro, nunca parcial.
        const percentualGrupo = grupoCompleto && valorRefGrupo > 0 ? (valorPropostaGrupo - valorRefGrupo) / valorRefGrupo : null
        const statusGrupo = classificarStatusProposta(percentualGrupo)
        const nomeGrupo = grupo ? (grupo.nome?.trim() ? grupo.nome : `Grupo ${grupo.numero}`) : 'Itens individuais'

        const itensVisiveis = ocultarNaoParticipar
          ? itensAoVivoDoGrupo.filter((item) => {
              const analise = calcularAnaliseItem(item, taxaFreteNumero, taxaFretePreenchida)
              return classificarStatusProposta(analise.percentualDiferenca).chave !== 'nao_participar'
            })
          : itensAoVivoDoGrupo

        return (
          <div key={idBloco} className="overflow-hidden rounded-2xl border border-ink-soft/10 bg-white shadow-soft">
            <button
              type="button"
              onClick={() => setGrupoAberto(aberto ? null : idBloco)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-paper-2/40"
            >
              <div className="flex items-center gap-3">
                <IconeGrupo />
                <div className="font-display text-base font-bold text-ink">
                  {nomeGrupo}
                  <span className="ml-1.5 font-body text-xs font-normal text-ink-soft">
                    | {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <span
                  className={`whitespace-nowrap rounded-full px-3 py-1 font-body text-xs font-semibold ${
                    preenchidosGrupo === itens.length
                      ? 'bg-forest-mist text-forest-deep'
                      : 'bg-brass-pale text-brass'
                  }`}
                >
                  {preenchidosGrupo} de {itens.length} preenchidos
                </span>
                <div className="text-right">
                  <div className="font-body text-[10px] uppercase tracking-wide text-ink-soft">Valor de referência</div>
                  <div className="font-body text-sm font-bold text-ink">{formatarMoeda(valorRefGrupo)}</div>
                </div>
                <div className="text-right">
                  <div className="font-body text-[10px] uppercase tracking-wide text-ink-soft">Valor da proposta</div>
                  <div className="font-body text-sm font-bold text-ink">{formatarMoeda(valorPropostaGrupo)}</div>
                </div>
                <span className={`whitespace-nowrap rounded-full px-3 py-1 font-body text-xs font-semibold ${statusGrupo.classe}`}>
                  {statusGrupo.label}
                </span>
                <IconeChevron aberto={aberto} />
              </div>
            </button>

            {aberto && (
              <div className="flex flex-col gap-2 border-t border-ink-soft/10 p-3">
                {itensVisiveis.map((itemVivo) => {
                  const analise = calcularAnaliseItem(itemVivo, taxaFreteNumero, taxaFretePreenchida)
                  const status = classificarStatusProposta(analise.percentualDiferenca)
                  const bloqueadoMeEpp = !!(itemVivo.exclusivoMeEpp && porteCliente === 'demais')
                  const itemAbertoAgora = itemAberto === itemVivo.id
                  const formProposta = formPorItem[itemVivo.id] ?? { marca: '', modelo: '', precoMinimo: '' }
                  const formReferencia = formReferenciaPorItem[itemVivo.id]

                  return (
                    <div key={itemVivo.id} className="rounded-xl border border-ink-soft/10 bg-paper-2/30">
                      <button
                        type="button"
                        onClick={() => setItemAberto(itemAbertoAgora ? null : itemVivo.id)}
                        className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left"
                      >
                        <div className="min-w-0">
                          <div className="font-body text-sm font-semibold text-ink">
                            {itemVivo.numero}. {itemVivo.descricao}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="font-body text-xs text-ink-soft">
                              {itemVivo.unidadeMedida} · Qtd. {itemVivo.quantidade} · Ref. unit. {formatarMoeda(itemVivo.precoReferencia)}
                            </span>
                            {itemVivo.exclusivoMeEpp && (
                              <span className="rounded-full bg-brass-pale px-2 py-0.5 font-body text-[10px] font-bold uppercase text-brass">
                                Exclusividade ME/EPP
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 font-body text-[11px] font-semibold ${status.classe}`}>
                            {status.label}
                          </span>
                          <IconeChevron aberto={itemAbertoAgora} />
                        </div>
                      </button>

                      {itemAbertoAgora && (
                        <div className="border-t border-ink-soft/10 p-4">
                          {bloqueadoMeEpp ? (
                            <p className="rounded-lg bg-paper-2 px-3 py-2 font-body text-xs text-ink-soft">
                              Item exclusivo para ME/EPP — sua empresa está classificada como &quot;Demais&quot; e não pode ofertar
                              aqui.
                            </p>
                          ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              <div>
                                <label className="mb-1 block font-body text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                  Quantidade ofertada
                                </label>
                                <div className="rounded-lg bg-paper-2 px-3 py-2 font-body text-sm text-ink-soft">
                                  {itemVivo.quantidade}
                                </div>
                              </div>

                              {podeEditarPropostaComercial ? (
                                <>
                                  <CampoEditavel
                                    label="Valor unitário (R$)"
                                    valor={formProposta.precoMinimo}
                                    placeholder="0,00"
                                    onChange={(v) => atualizarCampoProposta(itemVivo.id, 'precoMinimo', v)}
                                  />
                                  <CampoEditavel
                                    label="Marca/Fabricante"
                                    valor={formProposta.marca}
                                    placeholder="digite a marca e o fabricante"
                                    onChange={(v) => atualizarCampoProposta(itemVivo.id, 'marca', v)}
                                  />
                                  <CampoEditavel
                                    label="Modelo/Versão"
                                    valor={formProposta.modelo}
                                    placeholder="digite o modelo/versão"
                                    onChange={(v) => atualizarCampoProposta(itemVivo.id, 'modelo', v)}
                                  />
                                </>
                              ) : (
                                <>
                                  <MiniCampo
                                    label="Valor unitário"
                                    valor={itemVivo.propostaCliente?.precoMinimo != null ? formatarMoeda(itemVivo.propostaCliente.precoMinimo) : '— pendente'}
                                  />
                                  <MiniCampo label="Marca/Fabricante" valor={itemVivo.propostaCliente?.marca || '—'} />
                                  <MiniCampo label="Modelo/Versão" valor={itemVivo.propostaCliente?.modelo || '—'} />
                                </>
                              )}

                              <div className="col-span-2 flex items-center justify-end gap-3 border-t border-dashed border-ink-soft/20 pt-2 sm:col-span-4">
                                {taxaFretePreenchida && analise.precoComFrete != null && (
                                  <span className="font-body text-xs text-ink-soft">
                                    c/ frete: {formatarMoeda(analise.precoComFrete)}/un
                                  </span>
                                )}
                                <span className="font-body text-xs text-ink-soft">Valor total do item</span>
                                <span className="font-body text-base font-bold text-forest-deep">
                                  {analise.valorTotal != null ? formatarMoeda(analise.valorTotal) : '—'}
                                </span>
                              </div>
                            </div>
                          )}

                          {podeEditarItens && formReferencia && (
                            <div className="mt-4 rounded-lg border border-dashed border-ink-soft/20 p-3">
                              <p className="mb-2 font-body text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                Dados de referência (Admin)
                              </p>
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <CampoEditavel
                                  label="Unidade"
                                  valor={formReferencia.unidadeMedida}
                                  onChange={(v) => atualizarCampoReferencia(itemVivo.id, 'unidadeMedida', v)}
                                />
                                <CampoEditavel
                                  label="Quantidade"
                                  valor={formReferencia.quantidade}
                                  onChange={(v) => atualizarCampoReferencia(itemVivo.id, 'quantidade', v)}
                                />
                                <CampoEditavel
                                  label="Valor unit. referência (R$)"
                                  valor={formReferencia.precoReferencia}
                                  onChange={(v) => atualizarCampoReferencia(itemVivo.id, 'precoReferencia', v)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Rodapé — salvar */}
      {podeEditarPropostaComercial && (
        <div className="flex flex-col items-end gap-2 pt-2">
          {erro && (
            <p className="w-full rounded-lg bg-red-50 px-3 py-2 font-body text-sm text-red-700">{erro}</p>
          )}
          <div className="flex items-center gap-4">
            <span className="font-body text-sm text-ink-soft">{preenchidos} de {totalItens} itens preenchidos</span>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={!!salvando}
              className="inline-flex items-center justify-center rounded-lg bg-forest px-6 py-2.5 font-body text-sm font-semibold text-white transition-colors hover:bg-forest-deep disabled:cursor-not-allowed disabled:bg-forest/50"
            >
              {salvando ? 'Salvando...' : textoBotaoSalvar || 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CampoResumo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="font-body text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="font-body text-sm font-semibold text-ink">{valor}</div>
    </div>
  )
}

function MiniCampo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="font-body text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="font-body text-sm text-ink">{valor}</div>
    </div>
  )
}

function CampoEditavel({
  label,
  valor,
  placeholder,
  onChange,
}: {
  label: string
  valor: string
  placeholder?: string
  onChange: (valor: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block font-body text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{label}</label>
      <input
        type="text"
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-forest/30 bg-forest-mist/20 px-3 py-2 font-body text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
      />
    </div>
  )
}

function IconeGrupo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-forest">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
    </svg>
  )
}

function IconeChevron({ aberto }: { aberto: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`text-ink-soft transition-transform ${aberto ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
