// src/pages/admin/disputas/DisputaFormModal.tsx
//
// Registra o resultado de uma sessão de disputa já realizada no SIGA
// Pregão.
//
// REESTRUTURADO em 30/09, a pedido do Márcio: o resultado deixou de ser
// registrado por GRUPO INTEIRO (uma linha só, somando os itens do grupo) e
// passou a ser por ITEM INDIVIDUAL, mesmo quando o item pertence a um
// grupo — cada item agora tem seus próprios 4 campos: Posição, Valor de
// referência, Mínimo (c/ frete) e Valor ofertado. Os itens continuam
// visualmente organizados sob o cabeçalho do grupo a que pertencem, só que
// cada um é preenchido separadamente. Isso SUBSTITUI a decisão de 28/09
// ("a disputa acontece pelo grupo como um todo") — Total e % acima do
// mínimo saíram do card (não são mais calculados/exibidos aqui).
//
// ATENÇÃO — disputas salvas ANTES desta mudança, que tinham uma linha só
// por grupo (sem itemId, só grupoId): ao reabrir essas disputas antigas
// para edição, os valores que estavam na linha do grupo NÃO aparecem mais
// pré-preenchidos em nenhum item (a chave salva era o grupoId, e agora
// cada item usa seu próprio itemId como chave) — o dado antigo continua no
// banco até a disputa ser salva de novo, só não é mais lido por esta tela.
// Se isso for um problema pra alguma disputa específica já registrada,
// avisa que a gente confere caso a caso.
//
// Pra montar a tabela, o modal busca a licitação completa (com itens e
// grupos) assim que abre — `licitacaoId` sozinho não é suficiente, porque
// a lista carregada em DisputasPage (licitacaoService.listar) não traz os
// itens completos (só buscarPorId traz).

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../components/Modal';
import { TextField } from '../../../components/TextField';
import { SelectField } from '../../../components/SelectField';
import { Button } from '../../../components/Button';
import {
  Disputa,
  DisputaFormData,
  DisputaResultadoLinhaFormData,
  ResultadoDisputa,
  RESULTADO_DISPUTA_LABEL,
  ResultadoItemDisputa,
  RESULTADO_ITEM_DISPUTA_LABEL,
} from '../../../types/disputa';
import { Licitacao, ItemLicitacao } from '../../../types/licitacao';
import { licitacaoService } from '../../../services/licitacaoService';
import { calcularAnaliseItem } from '../../../utils/licitacaoCalculos';
import { formatarNumero, formatarMoeda } from '../../../utils/prazoUtils';

// Insere o ponto de milhar na parte inteira de um texto já no padrão BR
// (vírgula decimal) — "305978,18" -> "305.978,18". A pedido do Márcio
// (01/10): todo valor numérico exibido no sistema tem que vir com ponto
// separando milhar, vírgula separando decimal (ex.: 4.578.122,15) — não só
// em texto de leitura, mas também no que aparece dentro dos campos de
// digitação assim que o valor é carregado/salvo (ver onBlur do campo
// "Valor ofertado" abaixo, que reformata o texto digitado nesse padrão).
function aplicarSeparadorMilhar(texto: string): string {
  const negativo = texto.startsWith('-');
  const semSinal = negativo ? texto.slice(1) : texto;
  const [parteInteira, parteDecimal] = semSinal.split(',');
  const parteInteiraComPontos = parteInteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resultado = parteDecimal !== undefined ? `${parteInteiraComPontos},${parteDecimal}` : parteInteiraComPontos;
  return negativo ? `-${resultado}` : resultado;
}

// Mesmo padrão de formatação BR (ponto de milhar, vírgula decimal) já usado
// no resto do sistema — substitui o <input type="number"> nativo, que
// corrompe silenciosamente valores digitados com separador de milhar.
function numeroParaCampoDecimal(valor: number | null | undefined, casas: number): string {
  if (valor == null) return '';
  // O corte de "zeros sobrando" só pode acontecer quando existe separador
  // decimal (casas > 0) — ex.: "100,4000" -> "100,4". Sem essa checagem, um
  // valor inteiro terminado em zero (ex.: 100, 1000) teria o próprio número
  // cortado por engano (100 -> 1) — bug encontrado em numeroParaCampoDecimal
  // de LicitacaoFormModal.tsx (01/10), corrigido aqui também por segurança.
  let textoBruto = valor.toFixed(casas);
  if (casas > 0) {
    textoBruto = textoBruto.replace(/0+$/, '').replace(/\.$/, '');
  }
  const texto = textoBruto === '' || textoBruto === '-' ? '0' : textoBruto.replace('.', ',');
  return aplicarSeparadorMilhar(texto);
}

function campoParaNumeroDecimal(texto: string, casas: number): number | undefined {
  const limpo = texto.trim();
  if (!limpo) return undefined;
  const semSeparadorMilhar = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : /^[1-9]\d{0,2}(\.\d{3})+$/.test(limpo)
      ? limpo.replace(/\./g, '')
      : limpo;
  const numero = parseFloat(semSeparadorMilhar);
  if (isNaN(numero)) return undefined;
  const fator = Math.pow(10, casas);
  return Math.round(numero * fator) / fator;
}

// Uma linha da tabela de resultado: sempre UM item (mesmo quando ele
// pertence a um grupo — grupoId/grupoRotulo aqui são só pra organizar a
// exibição sob o cabeçalho certo, não mudam como o item é salvo).
interface LinhaResultado {
  chave: string; // sempre o itemId
  itemId: string;
  grupoId?: string;
  grupoRotulo?: string;
  rotulo: string;
  item: ItemLicitacao;
  precoMinimoComFreteUnitario: number;
}

// A pedido do Márcio (30/09): admin/analista só devem ver, nesta tela, os
// itens que o Cliente de fato preencheu na Proposta Comercial — não a
// licitação inteira. Se o Cliente decidir depois preencher mais itens,
// eles passam a aparecer automaticamente (não é uma escolha manual do
// admin, é reflexo direto do que está preenchido em itens_licitacao).
// "Participou" = tem propostaCliente.precoMinimo preenchido.
//
// `chavesForcadas` mantém visível um item que o Cliente não preencheu (ou
// desistiu depois), mas que já tem resultado de disputa salvo antes — pra
// não sumir um resultado já registrado ao reabrir uma disputa existente.
//
// REGRA DE 06/10 (Márcio) — preço acima da referência:
//   - GRUPO cujo total (já com frete) fica acima do total de referência não
//     tem opção de concorrer: fica FORA da disputa, sem decisão possível.
//   - ITEM INDIVIDUAL (sem grupo) acima da referência só entra na disputa
//     se o Admin/Analista LIBEROU na Proposta Comercial (migração 032).
//     Pendente ou barrado = fora da disputa.
// Quem ficou de fora vai na lista `foraDaDisputa`, só para a tela avisar —
// não aparece como card. Um grupo/item que já tem resultado salvo continua
// visível (chavesForcadas), para não sumir um resultado já registrado.
interface LinhasDaDisputa {
  linhas: LinhaResultado[];
  foraDaDisputa: string[];
}

function construirLinhas(licitacao: Licitacao, chavesForcadas: Set<string>): LinhasDaDisputa {
  const taxaFrete = licitacao.percentualFrete ?? 0;
  const linhas: LinhaResultado[] = [];
  const foraDaDisputa: string[] = [];

  function linhaDoItem(item: ItemLicitacao, grupoId?: string, grupoRotulo?: string): LinhaResultado {
    const analise = calcularAnaliseItem(item, taxaFrete, true);
    return {
      chave: item.id,
      itemId: item.id,
      grupoId,
      grupoRotulo,
      rotulo: `${item.numero} — ${item.descricao}`,
      item,
      precoMinimoComFreteUnitario: analise.precoComFrete ?? 0,
    };
  }

  licitacao.grupos.forEach((grupo) => {
    const grupoRotulo = grupo.nome?.trim() ? grupo.nome : `Grupo ${grupo.numero}`;
    const itensDoGrupo = licitacao.itens.filter((item) => item.grupoId === grupo.id);

    // Grupo acima da referência: só dá para medir com o grupo 100%
    // preenchido (mesma regra da Proposta Comercial).
    const grupoCompleto = itensDoGrupo.length > 0 && itensDoGrupo.every((item) => item.propostaCliente?.precoMinimo != null);
    const totalReferencia = itensDoGrupo.reduce((soma, item) => soma + item.precoReferencia * item.quantidade, 0);
    const totalProposta = itensDoGrupo.reduce(
      (soma, item) => soma + (calcularAnaliseItem(item, taxaFrete, true).valorTotal ?? 0),
      0,
    );
    const grupoAcimaDaReferencia = grupoCompleto && totalReferencia > 0 && totalProposta > totalReferencia;
    const grupoComResultado = chavesForcadas.has(grupo.id) || itensDoGrupo.some((item) => chavesForcadas.has(item.id));

    if (grupoAcimaDaReferencia && !grupoComResultado) {
      foraDaDisputa.push(`${grupoRotulo} (grupo acima da referência)`);
      return;
    }

    itensDoGrupo.forEach((item) => {
      const participou = item.propostaCliente?.precoMinimo != null;
      if (!participou && !chavesForcadas.has(item.id)) return;
      linhas.push(linhaDoItem(item, grupo.id, grupoRotulo));
    });
  });

  licitacao.itens
    .filter((item) => !item.grupoId)
    .forEach((item) => {
      const participou = item.propostaCliente?.precoMinimo != null;
      if (!participou && !chavesForcadas.has(item.id)) return;

      const percentual = calcularAnaliseItem(item, taxaFrete, true).percentualDiferenca;
      const acimaDaReferencia = percentual != null && percentual > 0;
      if (acimaDaReferencia && item.decisaoAcimaReferencia !== 'liberado' && !chavesForcadas.has(item.id)) {
        foraDaDisputa.push(
          `Item ${item.numero} (${item.decisaoAcimaReferencia === 'barrado' ? 'não participar — decisão do analista' : 'acima da referência, aguardando decisão'})`,
        );
        return;
      }
      linhas.push(linhaDoItem(item));
    });

  return { linhas, foraDaDisputa };
}

interface ValoresLinha {
  posicaoTexto: string;
  valorOfertadoTexto: string;
  // Resultado do item (migração 036). '' = ainda não informado.
  resultadoItem: ResultadoItemDisputa | '';
  valorVencedorTexto: string; // só vale quando resultadoItem = 'perdido'
  nomeVencedor: string; // só vale quando resultadoItem = 'perdido'
}

const VALORES_VAZIOS: ValoresLinha = {
  posicaoTexto: '',
  valorOfertadoTexto: '',
  resultadoItem: '',
  valorVencedorTexto: '',
  nomeVencedor: '',
};

// Especificação de item cheia demais pra mostrar de cara na tabela (ver
// nota sobre "ver mais/ver menos" mais abaixo). Limite aproximado — não
// mede linhas renderizadas de fato, só o tamanho do texto.
const LIMITE_DESCRICAO_CURTA = 150;

function criarFormularioVazio(licitacaoId: string): DisputaFormData {
  return {
    licitacaoId,
    dataSessaoRealizada: undefined,
    resultado: 'em_andamento',
    observacoes: '',
    linkAtaSigaPregao: '',
    itens: [],
  };
}

interface DisputaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: DisputaFormData) => Promise<void>;
  licitacaoId: string;
  numeroPregaoReferencia: string;
  disputaEmEdicao?: Disputa | null;
}

export function DisputaFormModal({
  isOpen,
  onClose,
  onSave,
  licitacaoId,
  numeroPregaoReferencia,
  disputaEmEdicao,
}: DisputaFormModalProps) {
  const [form, setForm] = useState<DisputaFormData>(criarFormularioVazio(licitacaoId));
  const [salvando, setSalvando] = useState(false);
  // Erro ao salvar (30/09, a pedido do Márcio: "clico em salvar e não
  // salva" — antes um erro do Supabase (permissão, constraint etc.) era
  // engolido em silêncio: o modal só ficava aberto de novo, sem nenhuma
  // pista do que aconteceu. Agora a mensagem aparece na tela.
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [carregandoLicitacao, setCarregandoLicitacao] = useState(false);
  const [licitacao, setLicitacao] = useState<Licitacao | null>(null);
  const [valoresPorLinha, setValoresPorLinha] = useState<Record<string, ValoresLinha>>({});
  // Posição/Valor ofertado preenchido no nível do GRUPO (um valor só pro
  // grupo inteiro, já total) — usado quando `modoResultado` trata o bloco
  // como "grupo". Chave = grupoId. A pedido do Márcio (05/10): o resultado
  // de uma disputa pode ter acontecido por grupo (lote fechado como um
  // todo), por item (cada item com seu próprio preço unitário), ou os dois
  // ao mesmo tempo (licitação com grupos E itens soltos) — a tela de
  // Disputa precisa deixar escolher, já que o dado (grupoId vs itemId por
  // linha) já existe desde antes da reestruturação de 30/09.
  const [valoresPorGrupo, setValoresPorGrupo] = useState<Record<string, ValoresLinha>>({});
  type ModoResultado = 'grupo' | 'item' | 'grupo_e_item';
  const [modoResultado, setModoResultado] = useState<ModoResultado>('item');
  // true assim que o Analista troca o modo manualmente — a partir daí o
  // sistema para de tentar adivinhar e respeita a escolha, até o modal ser
  // reaberto (fechado e aberto de novo, ou pra outra licitação).
  const [modoEscolhidoManualmente, setModoEscolhidoManualmente] = useState(false);
  // Colapsa/expande os itens de um grupo (por grupoId) — default expandido,
  // já que agora cada item precisa ser preenchido individualmente.
  const [gruposColapsados, setGruposColapsados] = useState<Set<string>>(new Set());
  // Especificações longas (linha.rotulo) começam truncadas em 2 linhas —
  // cada uma pode ser expandida individualmente com "ver mais". Chave =
  // itemId.
  const [descricoesExpandidas, setDescricoesExpandidas] = useState<Set<string>>(new Set());

  // Busca a licitação completa (com itens/grupos) assim que o modal abre —
  // a lista de DisputasPage não traz os itens, só buscarPorId traz.
  useEffect(() => {
    if (!isOpen) return;
    let ativo = true;
    setCarregandoLicitacao(true);
    licitacaoService.buscarPorId(licitacaoId).then((resultado) => {
      if (!ativo) return;
      setLicitacao(resultado);
      setCarregandoLicitacao(false);
    });
    return () => {
      ativo = false;
    };
  }, [isOpen, licitacaoId]);

  useEffect(() => {
    if (!isOpen) return;
    const inicial: DisputaFormData = disputaEmEdicao
      ? {
          licitacaoId: disputaEmEdicao.licitacaoId,
          dataSessaoRealizada: disputaEmEdicao.dataSessaoRealizada,
          resultado: disputaEmEdicao.resultado,
          observacoes: disputaEmEdicao.observacoes,
          linkAtaSigaPregao: disputaEmEdicao.linkAtaSigaPregao,
          itens: disputaEmEdicao.itens.map(
            ({ itemId, grupoId, posicao, valorFechado, resultadoItem, valorVencedor, nomeVencedor, observacao }) => ({
              itemId,
              grupoId,
              posicao,
              valorFechado,
              resultadoItem,
              valorVencedor,
              nomeVencedor,
              observacao,
            })
          ),
        }
      : criarFormularioVazio(licitacaoId);
    setForm(inicial);
    setErroSalvar(null);
    setModoEscolhidoManualmente(false); // reabriu o modal — libera a detecção automática de novo

    // Separa os valores salvos em dois mapas — um por item, outro por grupo
    // — porque cada linha salva é SEMPRE uma coisa ou outra (nunca as duas),
    // conforme a constraint do banco (disputa_itens_item_xor_grupo).
    const valoresItem: Record<string, ValoresLinha> = {};
    const valoresGrupo: Record<string, ValoresLinha> = {};
    (disputaEmEdicao?.itens ?? []).forEach((linha) => {
      const valoresLinha: ValoresLinha = {
        posicaoTexto: linha.posicao != null ? String(linha.posicao) : '',
        valorOfertadoTexto: numeroParaCampoDecimal(linha.valorFechado, 2),
        resultadoItem: linha.resultadoItem ?? '',
        valorVencedorTexto: numeroParaCampoDecimal(linha.valorVencedor, 2),
        nomeVencedor: linha.nomeVencedor ?? '',
      };
      if (linha.itemId) valoresItem[linha.itemId] = valoresLinha;
      else if (linha.grupoId) valoresGrupo[linha.grupoId] = valoresLinha;
    });
    setValoresPorLinha(valoresItem);
    setValoresPorGrupo(valoresGrupo);
  }, [isOpen, disputaEmEdicao, licitacaoId]);

  // Decide o modo de preenchimento (grupo / item / grupo e item): numa
  // disputa já salva, detecta pelo que já está gravado; numa disputa nova,
  // sugere pela estrutura da licitação. Só roda enquanto o Analista não
  // tiver trocado manualmente (ver `modoEscolhidoManualmente`).
  useEffect(() => {
    if (!isOpen || !licitacao || modoEscolhidoManualmente) return;

    const linhasSalvas = disputaEmEdicao?.itens ?? [];
    if (linhasSalvas.length > 0) {
      const temLinhaDeGrupo = linhasSalvas.some((linha) => linha.grupoId);
      const temLinhaDeItem = linhasSalvas.some((linha) => linha.itemId);
      if (temLinhaDeGrupo && temLinhaDeItem) setModoResultado('grupo_e_item');
      else if (temLinhaDeGrupo) setModoResultado('grupo');
      else setModoResultado('item');
      return;
    }

    const temGrupo = licitacao.grupos.length > 0;
    const temItemSolto = licitacao.itens.some((item) => !item.grupoId);
    setModoResultado(temGrupo && temItemSolto ? 'grupo_e_item' : temGrupo ? 'grupo' : 'item');
  }, [isOpen, licitacao, disputaEmEdicao, modoEscolhidoManualmente]);

  function escolherModoResultado(modo: ModoResultado) {
    setModoResultado(modo);
    setModoEscolhidoManualmente(true);
  }

  // Chaves (itemId — ou grupoId, de disputas antigas) que já têm resultado
  // salvo nesta disputa — ficam visíveis mesmo que o Cliente não tenha (ou
  // não tenha mais) preenchido a proposta desse item, pra não sumir um
  // resultado já registrado.
  const chavesComResultadoRegistrado = useMemo(
    () =>
      new Set(
        (disputaEmEdicao?.itens ?? [])
          .map((linha) => linha.itemId ?? linha.grupoId)
          .filter((chave): chave is string => !!chave),
      ),
    [disputaEmEdicao],
  );

  const { linhas: linhasResultado, foraDaDisputa } = useMemo(
    () =>
      licitacao
        ? construirLinhas(licitacao, chavesComResultadoRegistrado)
        : { linhas: [] as LinhaResultado[], foraDaDisputa: [] as string[] },
    [licitacao, chavesComResultadoRegistrado],
  );

  // Agrupa as linhas consecutivas do mesmo grupo (ou sem grupo) só pra
  // organizar a exibição — o cabeçalho do grupo aparece uma vez, os itens
  // dele embaixo, cada um com seus próprios campos.
  const blocosVisuais = useMemo(() => {
    const blocos: { grupoId?: string; grupoRotulo?: string; linhas: LinhaResultado[] }[] = [];
    linhasResultado.forEach((linha) => {
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && ultimo.grupoId === linha.grupoId) {
        ultimo.linhas.push(linha);
      } else {
        blocos.push({ grupoId: linha.grupoId, grupoRotulo: linha.grupoRotulo, linhas: [linha] });
      }
    });
    return blocos;
  }, [linhasResultado]);

  function atualizarCampo<K extends keyof DisputaFormData>(campo: K, valor: DisputaFormData[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  function atualizarValorLinha<K extends keyof ValoresLinha>(chave: string, campo: K, valor: ValoresLinha[K]) {
    setValoresPorLinha((atual) => ({
      ...atual,
      [chave]: {
        ...(atual[chave] ?? VALORES_VAZIOS),
        [campo]: valor,
      },
    }));
  }

  function atualizarValorGrupo<K extends keyof ValoresLinha>(grupoId: string, campo: K, valor: ValoresLinha[K]) {
    setValoresPorGrupo((atual) => ({
      ...atual,
      [grupoId]: {
        ...(atual[grupoId] ?? VALORES_VAZIOS),
        [campo]: valor,
      },
    }));
  }

  function alternarGrupoColapsado(grupoId: string) {
    setGruposColapsados((atual) => {
      const novo = new Set(atual);
      if (novo.has(grupoId)) novo.delete(grupoId);
      else novo.add(grupoId);
      return novo;
    });
  }

  function alternarDescricaoExpandida(itemId: string) {
    setDescricoesExpandidas((atual) => {
      const novo = new Set(atual);
      if (novo.has(itemId)) novo.delete(itemId);
      else novo.add(itemId);
      return novo;
    });
  }

  // Soma dos itens do bloco (valor unitário × quantidade) — null se nenhum
  // item foi preenchido. No modo "Grupo e item" é o que alimenta o total do
  // grupo automaticamente, igual ao modo "Por item".
  function somaItensDoBloco(bloco: (typeof blocosVisuais)[number]): number | null {
    let algum = false;
    const soma = bloco.linhas.reduce((acc, linha) => {
      const unitario = campoParaNumeroDecimal(valoresPorLinha[linha.chave]?.valorOfertadoTexto ?? '', 2);
      if (unitario == null) return acc;
      algum = true;
      return acc + unitario * linha.item.quantidade;
    }, 0);
    return algum ? soma : null;
  }

  async function handleSalvar() {
    const itens: DisputaResultadoLinhaFormData[] = [];

    blocosVisuais.forEach((bloco) => {
      // "Tratar como grupo" = este bloco tem grupo E o modo escolhido pede
      // uma linha só pro grupo inteiro (não uma por item). Item solto
      // (bloco.grupoId undefined) nunca cai aqui — não existe "grupo" pra
      // gravar o valor.
      const tratarComoGrupo = !!bloco.grupoId && (modoResultado === 'grupo' || modoResultado === 'grupo_e_item');

      if (tratarComoGrupo && bloco.grupoId) {
        const valores = valoresPorGrupo[bloco.grupoId];
        const emGrupoEItem = modoResultado === 'grupo_e_item';
        const posicao = valores?.posicaoTexto ? Number(valores.posicaoTexto) : undefined;
        // Total do grupo: o que o Analista digitou; se deixou em branco no
        // modo "Grupo e item", vale a soma dos itens.
        const valorFechado =
          (valores ? campoParaNumeroDecimal(valores.valorOfertadoTexto, 2) : undefined) ??
          (emGrupoEItem ? somaItensDoBloco(bloco) ?? undefined : undefined);
        const resultadoGrupo = valores?.resultadoItem || undefined;
        const grupoPerdido = resultadoGrupo === 'perdido';
        const valorVencedorGrupo =
          grupoPerdido && valores ? campoParaNumeroDecimal(valores.valorVencedorTexto, 2) : undefined;
        const nomeVencedorGrupo = grupoPerdido && valores?.nomeVencedor.trim() ? valores.nomeVencedor.trim() : undefined;
        if (posicao != null || valorFechado != null || resultadoGrupo) {
          itens.push({
            grupoId: bloco.grupoId,
            posicao,
            valorFechado,
            resultadoItem: resultadoGrupo,
            valorVencedor: valorVencedorGrupo,
            nomeVencedor: nomeVencedorGrupo,
          });
        }
        // Só no modo "Por grupo" os itens do grupo não são gravados. No modo
        // "Grupo e item" o grupo grava o total E cada item grava o seu
        // próprio resultado (linhas distintas — grupoId numa, itemId na
        // outra — o que respeita a constraint disputa_itens_item_xor_grupo).
        if (modoResultado === 'grupo') return;
      }

      bloco.linhas.forEach((linha) => {
        const valores = valoresPorLinha[linha.chave];
        // No modo "Grupo e item", a posição vale para o grupo inteiro e fica só
        // na linha do grupo — o item de um grupo grava apenas o valor.
        const posicaoSoNoGrupo = !!bloco.grupoId && modoResultado === 'grupo_e_item';
        const posicao = !posicaoSoNoGrupo && valores?.posicaoTexto ? Number(valores.posicaoTexto) : undefined;
        const valorFechado = valores ? campoParaNumeroDecimal(valores.valorOfertadoTexto, 2) : undefined;
        const resultadoItem = valores?.resultadoItem || undefined;
        // Vencedor só faz sentido quando perdemos o item: nos demais
        // resultados (ganho, fracassado, deserto, cancelado) os dois campos
        // são descartados, mesmo que tenham sido digitados antes de trocar o
        // resultado.
        const perdeu = resultadoItem === 'perdido';
        const valorVencedor = perdeu && valores ? campoParaNumeroDecimal(valores.valorVencedorTexto, 2) : undefined;
        const nomeVencedor = perdeu && valores?.nomeVencedor.trim() ? valores.nomeVencedor.trim() : undefined;
        // Só grava linha que tenha algo preenchido — não polui o banco com
        // linhas vazias pra item que o analista ainda não chegou a
        // registrar.
        if (posicao != null || valorFechado != null || resultadoItem) {
          itens.push({ itemId: linha.itemId, posicao, valorFechado, resultadoItem, valorVencedor, nomeVencedor });
        }
      });
    });

    setSalvando(true);
    setErroSalvar(null);
    try {
      await onSave({ ...form, itens });
      onClose();
    } catch (erro) {
      setErroSalvar(erro instanceof Error ? erro.message : 'Erro desconhecido ao salvar o resultado.');
    } finally {
      setSalvando(false);
    }
  }

  const resultadoMudaStatus = form.resultado === 'ganho' || form.resultado === 'perdido';

  // Sugestão do resultado GERAL a partir dos resultados por item/grupo (a
  // pedido do Márcio, 08/10). Só um texto: nunca altera o campo sozinha.
  //   - ao menos um item/grupo ganho  -> sugere "Ganho"
  //   - todos perdidos                -> sugere "Perdido"
  //   - demais casos (fracassado, deserto, cancelado, misturas sem ganho)
  //                                   -> sem sugestão; decisão do Analista
  // Conta as mesmas unidades que são gravadas em handleSalvar: o resultado do
  // grupo quando o bloco é tratado como grupo (e, no modo "Grupo e item", os
  // itens do grupo só entram se o grupo não tiver resultado); o resultado de
  // cada item solto.
  const resultadosInformados: ResultadoItemDisputa[] = [];
  blocosVisuais.forEach((bloco) => {
    const tratarComoGrupo = !!bloco.grupoId && (modoResultado === 'grupo' || modoResultado === 'grupo_e_item');
    const doGrupo = tratarComoGrupo && bloco.grupoId ? valoresPorGrupo[bloco.grupoId]?.resultadoItem : '';
    if (doGrupo) {
      resultadosInformados.push(doGrupo);
      return;
    }
    if (tratarComoGrupo && modoResultado === 'grupo') return;
    bloco.linhas.forEach((linha) => {
      const resultado = valoresPorLinha[linha.chave]?.resultadoItem;
      if (resultado) resultadosInformados.push(resultado);
    });
  });
  const sugestaoResultadoGeral: 'ganho' | 'perdido' | null =
    resultadosInformados.length === 0
      ? null
      : resultadosInformados.some((r) => r === 'ganho')
        ? 'ganho'
        : resultadosInformados.every((r) => r === 'perdido')
          ? 'perdido'
          : null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Disputa — ${numeroPregaoReferencia}`}
      size="full"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando || carregandoLicitacao}>
            {salvando ? 'Salvando...' : 'Salvar resultado'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Simplificado a pedido do Márcio (30/09): só o portal, sem o texto
            explicativo completo. */}
        <div className="rounded-lg border border-ink-soft/15 bg-forest-mist/30 px-4 py-3 font-body text-xs text-ink-soft">
          Portal: <strong className="text-ink">{licitacao?.portal || '—'}</strong>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Data/hora da sessão realizada"
            type="datetime-local"
            value={form.dataSessaoRealizada?.slice(0, 16) ?? ''}
            onChange={(e) =>
              atualizarCampo('dataSessaoRealizada', e.target.value ? new Date(e.target.value).toISOString() : undefined)
            }
          />
          <div>
            <SelectField
              label="Resultado *"
              required
              value={form.resultado}
              onChange={(e) => atualizarCampo('resultado', e.target.value as ResultadoDisputa)}
              options={Object.entries(RESULTADO_DISPUTA_LABEL).map(([value, label]) => ({ value, label }))}
            />
            {resultadoMudaStatus && (
              <p className="mt-1 font-body text-xs text-ink-soft">
                Isso vai atualizar automaticamente o status da licitação.
              </p>
            )}
            {resultadosInformados.length > 0 && (
              <p
                className={`mt-1 font-body text-xs ${
                  sugestaoResultadoGeral && sugestaoResultadoGeral !== form.resultado
                    ? 'font-semibold text-brass'
                    : 'text-ink-soft'
                }`}
              >
                {sugestaoResultadoGeral === 'ganho' &&
                  (form.resultado === 'ganho'
                    ? 'Coerente com os resultados: ao menos um item/grupo foi ganho.'
                    : 'Sugestão pelos resultados dos itens: "Ganho" (ao menos um item/grupo foi ganho).')}
                {sugestaoResultadoGeral === 'perdido' &&
                  (form.resultado === 'perdido'
                    ? 'Coerente com os resultados: todos os itens/grupos foram perdidos.'
                    : 'Sugestão pelos resultados dos itens: "Perdido" (todos os itens/grupos foram perdidos).')}
                {sugestaoResultadoGeral === null &&
                  'Sem sugestão: os resultados dos itens não indicam ganho nem perda total — decisão do Analista.'}
              </p>
            )}
          </div>
        </div>

        {/* Como a disputa aconteceu — define se o Valor ofertado é
            preenchido por GRUPO inteiro (um valor só, já total) ou por ITEM
            (preço unitário, somado automaticamente). A pedido do Márcio
            (05/10): essa licitação tem grupo E item solto ao mesmo tempo,
            então a tela precisa deixar escolher em vez de assumir um dos
            dois. Sugerido automaticamente pela estrutura da licitação (ou
            pelo que já está salvo, se a disputa já existe), mas pode trocar
            a qualquer momento. */}
        {!!licitacao && (licitacao.grupos.length > 0) && (
          <div className="rounded-xl border border-ink-soft/15 p-4">
            <p className="mb-3 font-body text-sm font-semibold text-ink">Como a disputa aconteceu?</p>
            <div className="flex gap-2">
              {(
                [
                  { valor: 'grupo', rotulo: 'Por grupo' },
                  { valor: 'item', rotulo: 'Por item' },
                  { valor: 'grupo_e_item', rotulo: 'Grupo e item' },
                ] as { valor: ModoResultado; rotulo: string }[]
              ).map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => escolherModoResultado(opcao.valor)}
                  className={`rounded-lg border px-3.5 py-2 font-body text-sm font-semibold transition-colors ${
                    modoResultado === opcao.valor
                      ? 'border-forest bg-forest text-white'
                      : 'border-ink-soft/25 text-ink-soft hover:border-forest/50'
                  }`}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
            <p className="mt-2 font-body text-xs text-ink-soft">
              {modoResultado === 'grupo' &&
                'O "Valor ofertado" é preenchido uma vez, já total, no card do grupo.'}
              {modoResultado === 'item' &&
                'O "Valor ofertado" é preenchido por item (preço unitário) — o total do grupo e o total geral somam automaticamente (valor × quantidade).'}
              {modoResultado === 'grupo_e_item' &&
                'Cada grupo recebe a posição e o valor total; abaixo dele, cada item recebe apenas o valor ofertado (preço unitário). Itens soltos (fora de grupo) recebem posição e valor individualmente.'}
            </p>
          </div>
        )}

        {/* Resultado por item — um card por item, ou um card por grupo
            inteiro quando `modoResultado` tratar o bloco como grupo (ver
            `tratarComoGrupo` abaixo). Valor de referência e Mínimo (c/
            frete) vêm calculados, só pra referência durante o
            preenchimento. */}
        <div>
          <h3 className="mb-2 font-display text-sm font-semibold text-ink">Resultado por item</h3>
          {carregandoLicitacao && <p className="font-body text-xs text-ink-soft">Carregando itens da licitação...</p>}
          {!carregandoLicitacao && linhasResultado.length === 0 && (
            <p className="font-body text-xs text-ink-soft">
              {foraDaDisputa.length > 0
                ? 'Nenhum grupo ou item está liberado para a disputa.'
                : 'Esta licitação ainda não tem itens cadastrados.'}
            </p>
          )}
          {!carregandoLicitacao && foraDaDisputa.length > 0 && (
            <div className="mb-3 rounded-lg border border-brass/40 bg-brass-pale px-3 py-2 font-body text-xs text-brass">
              <p className="font-semibold">Fora da disputa por estarem acima da referência:</p>
              <ul className="mt-1 list-disc pl-4">
                {foraDaDisputa.map((texto) => (
                  <li key={texto}>{texto}</li>
                ))}
              </ul>
            </div>
          )}
          {!carregandoLicitacao && linhasResultado.length > 0 && (
            <div className="space-y-4">
              {blocosVisuais.map((bloco, indiceBloco) => {
                const colapsado = bloco.grupoId ? gruposColapsados.has(bloco.grupoId) : false;
                // "Tratar como grupo" = o modo escolhido pede uma linha só
                // pro grupo inteiro — Posição/Valor ofertado ficam editáveis
                // no card do grupo, e os itens abaixo viram só conferência.
                // Item solto (sem grupo) nunca entra aqui.
                const tratarComoGrupo = !!bloco.grupoId && (modoResultado === 'grupo' || modoResultado === 'grupo_e_item');
                const valoresGrupo = bloco.grupoId ? valoresPorGrupo[bloco.grupoId] : undefined;
                // Itens do grupo ficam travados ("preenchido no grupo acima")
                // só no modo "Por grupo". No modo "Grupo e item" o grupo tem
                // o total e os itens continuam abertos para preenchimento
                // individual (pedido do Márcio, 06/10).
                const itensTravados = tratarComoGrupo && modoResultado === 'grupo';

                // Total ofertado do grupo: quando tratado como grupo, é o
                // próprio valor digitado (já é o total do lote, não
                // unitário). Quando os itens é que são preenchidos, cada
                // "Valor ofertado" é unitário — o total do grupo é a soma
                // de (valor × quantidade) de cada item, igual à mesma conta
                // já usada pra "Total de referência"/"Mínimo" logo abaixo
                // (antes desta correção, 05/10, a soma não multiplicava
                // pela quantidade — subestimava o total sempre que o preço
                // ofertado não era "1" por unidade).
                const totalOfertadoGrupo = tratarComoGrupo
                  ? campoParaNumeroDecimal(valoresGrupo?.valorOfertadoTexto ?? '', 2) ?? 0
                  : bloco.linhas.reduce((soma, linha) => {
                      const unitario = campoParaNumeroDecimal(valoresPorLinha[linha.chave]?.valorOfertadoTexto ?? '', 2);
                      return soma + (unitario ?? 0) * linha.item.quantidade;
                    }, 0);
                const algumOfertadoPreenchido = tratarComoGrupo
                  ? campoParaNumeroDecimal(valoresGrupo?.valorOfertadoTexto ?? '', 2) != null
                  : bloco.linhas.some(
                      (linha) => campoParaNumeroDecimal(valoresPorLinha[linha.chave]?.valorOfertadoTexto ?? '', 2) != null,
                    );
                const totalReferenciaGrupo = bloco.linhas.reduce(
                  (soma, linha) => soma + linha.item.precoReferencia * linha.item.quantidade,
                  0,
                );
                const totalMinimoComFreteGrupo = bloco.linhas.reduce(
                  (soma, linha) => soma + linha.precoMinimoComFreteUnitario * linha.item.quantidade,
                  0,
                );
                const algumMinimoPreenchido = bloco.linhas.some((linha) => linha.precoMinimoComFreteUnitario > 0);
                // Posição do grupo: na disputa/lance do pregão, todos os
                // itens de um mesmo grupo/lote saem com a MESMA posição
                // (é o grupo inteiro que disputa, não cada item) — por
                // isso mostra a primeira posição já preenchida entre os
                // itens, em vez de somar (não faria sentido somar posição).
                const posicaoGrupoTexto = tratarComoGrupo
                  ? valoresGrupo?.posicaoTexto ?? ''
                  : bloco.linhas
                      .map((linha) => valoresPorLinha[linha.chave]?.posicaoTexto)
                      .find((texto) => texto && texto.trim() !== '') ?? '';

                return (
                  <div key={bloco.grupoId ?? `sem-grupo-${indiceBloco}`}>
                    {bloco.grupoId && (
                      <>
                        <button
                          type="button"
                          onClick={() => alternarGrupoColapsado(bloco.grupoId!)}
                          className="mb-2 flex items-center gap-1.5 text-left font-display text-sm font-semibold text-ink"
                        >
                          <span className="text-ink-soft">{colapsado ? '▸' : '▾'}</span>
                          {bloco.grupoRotulo}
                          <span className="font-body text-xs font-normal text-ink-soft">
                            ({bloco.linhas.length} itens)
                          </span>
                        </button>

                        {/* Card de totais do grupo — mesmo layout dos cards
                            de item, a pedido do Márcio (30/09), em vez de um
                            texto simples. Fica sempre visível, mesmo com o
                            grupo colapsado, já que é um resumo (não tem
                            campo editável — quem se edita são os itens
                            abaixo). */}
                        <div className="mb-3 rounded-2xl border border-forest/25 bg-forest-mist/40 p-5 font-body shadow-soft">
                          <div className="flex items-stretch gap-6">
                            <div className="w-[340px] shrink-0">
                              <p className="text-sm font-semibold text-ink">Total do grupo</p>
                              <p className="mt-1 text-xs text-ink-soft">{bloco.linhas.length} itens</p>
                            </div>

                            <div className="w-px shrink-0 self-stretch bg-forest/15" />

                            <div className="flex flex-1 flex-wrap items-center gap-5">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                  Posição
                                </span>
                                {tratarComoGrupo ? (
                                  <input
                                    type="number"
                                    min={1}
                                    value={valoresGrupo?.posicaoTexto ?? ''}
                                    onChange={(e) =>
                                      atualizarValorGrupo(bloco.grupoId!, 'posicaoTexto', e.target.value)
                                    }
                                    placeholder="—"
                                    className="w-14 rounded-lg border border-ink-soft/20 bg-white px-2 py-1.5 text-center text-sm font-semibold text-ink focus:border-forest focus:outline-none"
                                  />
                                ) : (
                                  <span className="flex items-center justify-center rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 w-14">
                                    <span className="text-sm font-semibold text-ink">
                                      {posicaoGrupoTexto || '—'}
                                    </span>
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                  Valor de referência
                                </span>
                                <span className="flex items-center rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5">
                                  <span className="text-sm font-semibold text-ink">
                                    {formatarMoeda(totalReferenciaGrupo)}
                                  </span>
                                </span>
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                  Mínimo (c/ frete)
                                </span>
                                <span className="flex items-center rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5">
                                  <span className="text-sm font-semibold text-ink">
                                    {algumMinimoPreenchido ? formatarMoeda(totalMinimoComFreteGrupo) : '—'}
                                  </span>
                                </span>
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                  Valor ofertado
                                </span>
                                {tratarComoGrupo ? (
                                  <>
                                  <span className="flex items-center gap-1 rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 focus-within:border-forest">
                                    <span className="text-xs text-ink-soft">R$</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={
                                        valoresGrupo?.valorOfertadoTexto ||
                                        (modoResultado === 'grupo_e_item' && somaItensDoBloco(bloco) != null
                                          ? numeroParaCampoDecimal(somaItensDoBloco(bloco), 2)
                                          : '')
                                      }
                                      onChange={(e) =>
                                        atualizarValorGrupo(bloco.grupoId!, 'valorOfertadoTexto', e.target.value)
                                      }
                                      onBlur={() =>
                                        atualizarValorGrupo(
                                          bloco.grupoId!,
                                          'valorOfertadoTexto',
                                          numeroParaCampoDecimal(
                                            campoParaNumeroDecimal(valoresGrupo?.valorOfertadoTexto ?? '', 2),
                                            2
                                          )
                                        )
                                      }
                                      placeholder="0,00"
                                      className="w-24 text-sm font-semibold text-ink focus:outline-none"
                                    />
                                  </span>
                                  {modoResultado === 'grupo_e_item' &&
                                    valoresGrupo?.valorOfertadoTexto &&
                                    somaItensDoBloco(bloco) != null &&
                                    campoParaNumeroDecimal(valoresGrupo.valorOfertadoTexto, 2) !== somaItensDoBloco(bloco) && (
                                      <span className="text-[11px] text-ink-soft">
                                        soma dos itens: {formatarMoeda(somaItensDoBloco(bloco) ?? 0)}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="flex items-center rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5">
                                    <span className="text-sm font-semibold text-ink">
                                      {algumOfertadoPreenchido ? formatarMoeda(totalOfertadoGrupo) : '—'}
                                    </span>
                                  </span>
                                )}
                              </div>

                              {/* Resultado do GRUPO (migração 036): quando o grupo é
                                  disputado como um todo, o resultado e o vencedor
                                  também são do grupo — valores em TOTAL, como o
                                  Valor ofertado ao lado. */}
                              {tratarComoGrupo && (
                                <>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                      Resultado do grupo
                                    </span>
                                    <select
                                      value={valoresGrupo?.resultadoItem ?? ''}
                                      onChange={(e) =>
                                        atualizarValorGrupo(
                                          bloco.grupoId!,
                                          'resultadoItem',
                                          e.target.value as ResultadoItemDisputa | ''
                                        )
                                      }
                                      className="rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 text-sm font-semibold text-ink focus:border-forest focus:outline-none"
                                    >
                                      <option value="">—</option>
                                      {Object.entries(RESULTADO_ITEM_DISPUTA_LABEL).map(([valor, rotulo]) => (
                                        <option key={valor} value={valor}>
                                          {rotulo}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  {valoresGrupo?.resultadoItem === 'perdido' && (
                                    <>
                                      <label className="flex flex-col gap-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                          Valor do vencedor <span className="normal-case font-normal text-ink-soft/70">(total)</span>
                                        </span>
                                        <span className="flex items-center gap-1 rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 focus-within:border-forest">
                                          <span className="text-xs text-ink-soft">R$</span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={valoresGrupo.valorVencedorTexto}
                                            onChange={(e) =>
                                              atualizarValorGrupo(bloco.grupoId!, 'valorVencedorTexto', e.target.value)
                                            }
                                            onBlur={() =>
                                              atualizarValorGrupo(
                                                bloco.grupoId!,
                                                'valorVencedorTexto',
                                                numeroParaCampoDecimal(
                                                  campoParaNumeroDecimal(valoresGrupo.valorVencedorTexto, 2),
                                                  2
                                                )
                                              )
                                            }
                                            placeholder="0,00"
                                            className="w-24 text-sm font-semibold text-ink focus:outline-none"
                                          />
                                        </span>
                                      </label>
                                      <label className="flex flex-col gap-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                          Vencedor
                                        </span>
                                        <input
                                          type="text"
                                          value={valoresGrupo.nomeVencedor}
                                          onChange={(e) => atualizarValorGrupo(bloco.grupoId!, 'nomeVencedor', e.target.value)}
                                          placeholder="Nome da empresa"
                                          className="w-48 rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-forest focus:outline-none"
                                        />
                                      </label>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {!colapsado && (
                      <div className="space-y-3">
                        {bloco.linhas.map((linha) => {
                          const valores = valoresPorLinha[linha.chave] ?? VALORES_VAZIOS;
                          const descricaoExpandida = descricoesExpandidas.has(linha.chave);

                          return (
                            <div
                              key={linha.chave}
                              // Item dentro de um grupo ganha um tom verde claro
                              // (com faixa lateral) para se diferenciar do item
                              // solto, que continua branco (pedido do Márcio, 06/10).
                              className={`rounded-2xl border p-5 font-body shadow-soft ${
                                bloco.grupoId
                                  ? 'border-forest/20 border-l-4 border-l-forest/50 bg-forest-mist/25'
                                  : 'border-ink-soft/15 bg-white'
                              }`}
                            >
                              <div className="flex items-stretch gap-6">
                                {/* Item */}
                                <div className="w-[340px] shrink-0">
                                  <p className={`text-sm font-semibold text-ink ${descricaoExpandida ? '' : 'line-clamp-2'}`}>
                                    {linha.rotulo}
                                  </p>
                                  {linha.rotulo.length > LIMITE_DESCRICAO_CURTA && (
                                    <button
                                      type="button"
                                      onClick={() => alternarDescricaoExpandida(linha.chave)}
                                      className="mt-0.5 text-xs font-semibold text-forest-deep hover:underline"
                                    >
                                      {descricaoExpandida ? 'ver menos' : 'ver mais'}
                                    </button>
                                  )}
                                  <p className="mt-1 text-xs text-ink-soft">
                                    {linha.item.propostaCliente?.marca || '—'} ·{' '}
                                    {linha.item.propostaCliente?.modelo || '—'} ·{' '}
                                    Qtd. {formatarNumero(linha.item.quantidade)}
                                  </p>
                                </div>

                                <div className="w-px shrink-0 self-stretch bg-ink-soft/10" />

                                {/* Posição / Valor de referência / Mínimo / Valor ofertado */}
                                <div className="flex flex-1 flex-wrap items-center gap-5">
                                  <label className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                      Posição
                                    </span>
                                    {itensTravados || (bloco.grupoId && modoResultado === 'grupo_e_item') ? (
                                      // Posição do grupo: só se preenche no card do grupo.
                                      <span className="flex items-center justify-center rounded-lg border border-ink-soft/10 bg-paper-2/50 px-2.5 py-1.5 w-14">
                                        <span className="text-sm text-ink-soft">
                                          {!itensTravados && valoresGrupo?.posicaoTexto ? valoresGrupo.posicaoTexto : '—'}
                                        </span>
                                      </span>
                                    ) : (
                                      <input
                                        type="number"
                                        min={1}
                                        value={valores.posicaoTexto}
                                        onChange={(e) => atualizarValorLinha(linha.chave, 'posicaoTexto', e.target.value)}
                                        placeholder="—"
                                        className="w-14 rounded-lg border border-ink-soft/20 bg-white px-2 py-1.5 text-center text-sm font-semibold text-ink focus:border-forest focus:outline-none"
                                      />
                                    )}
                                  </label>

                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                      Valor de referência
                                    </span>
                                    <span className="flex items-center rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5">
                                      <span className="text-sm font-semibold text-ink">
                                        {formatarMoeda(linha.item.precoReferencia)}
                                      </span>
                                    </span>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                      Mínimo (c/ frete)
                                    </span>
                                    <span className="flex items-center rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5">
                                      {linha.precoMinimoComFreteUnitario > 0 ? (
                                        <span className="text-sm font-semibold text-ink">
                                          {formatarMoeda(linha.precoMinimoComFreteUnitario)}
                                        </span>
                                      ) : (
                                        <span className="text-sm text-ink-soft">—</span>
                                      )}
                                    </span>
                                  </div>

                                  <label className="flex flex-col gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                      Valor ofertado {!itensTravados && <span className="normal-case font-normal text-ink-soft/70">(unit.)</span>}
                                    </span>
                                    {itensTravados ? (
                                      <span className="flex items-center rounded-lg border border-ink-soft/10 bg-paper-2/50 px-2.5 py-1.5">
                                        <span className="text-sm text-ink-soft">preenchido no grupo acima</span>
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1 rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 focus-within:border-forest">
                                        <span className="text-xs text-ink-soft">R$</span>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={valores.valorOfertadoTexto}
                                          onChange={(e) =>
                                            atualizarValorLinha(linha.chave, 'valorOfertadoTexto', e.target.value)
                                          }
                                          onBlur={() =>
                                            atualizarValorLinha(
                                              linha.chave,
                                              'valorOfertadoTexto',
                                              numeroParaCampoDecimal(
                                                campoParaNumeroDecimal(valores.valorOfertadoTexto, 2),
                                                2
                                              )
                                            )
                                          }
                                          placeholder="0,00"
                                          className="w-20 text-sm font-semibold text-ink focus:outline-none"
                                        />
                                      </span>
                                    )}
                                  </label>

                                  {/* Resultado do item (migração 036) — alimenta os
                                      relatórios. Em "Por grupo" os itens ficam
                                      travados e não têm resultado próprio. */}
                                  {!itensTravados && (
                                    <>
                                      <label className="flex flex-col gap-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                          Resultado do item
                                        </span>
                                        <select
                                          value={valores.resultadoItem}
                                          onChange={(e) =>
                                            atualizarValorLinha(
                                              linha.chave,
                                              'resultadoItem',
                                              e.target.value as ResultadoItemDisputa | ''
                                            )
                                          }
                                          className="rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 text-sm font-semibold text-ink focus:border-forest focus:outline-none"
                                        >
                                          <option value="">—</option>
                                          {Object.entries(RESULTADO_ITEM_DISPUTA_LABEL).map(([valor, rotulo]) => (
                                            <option key={valor} value={valor}>
                                              {rotulo}
                                            </option>
                                          ))}
                                        </select>
                                      </label>

                                      {valores.resultadoItem === 'perdido' && (
                                        <>
                                          <label className="flex flex-col gap-1">
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                              Valor do vencedor <span className="normal-case font-normal text-ink-soft/70">(unit.)</span>
                                            </span>
                                            <span className="flex items-center gap-1 rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 focus-within:border-forest">
                                              <span className="text-xs text-ink-soft">R$</span>
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                value={valores.valorVencedorTexto}
                                                onChange={(e) =>
                                                  atualizarValorLinha(linha.chave, 'valorVencedorTexto', e.target.value)
                                                }
                                                onBlur={() =>
                                                  atualizarValorLinha(
                                                    linha.chave,
                                                    'valorVencedorTexto',
                                                    numeroParaCampoDecimal(
                                                      campoParaNumeroDecimal(valores.valorVencedorTexto, 2),
                                                      2
                                                    )
                                                  )
                                                }
                                                placeholder="0,00"
                                                className="w-20 text-sm font-semibold text-ink focus:outline-none"
                                              />
                                            </span>
                                          </label>
                                          <label className="flex flex-col gap-1">
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                              Vencedor
                                            </span>
                                            <input
                                              type="text"
                                              value={valores.nomeVencedor}
                                              onChange={(e) => atualizarValorLinha(linha.chave, 'nomeVencedor', e.target.value)}
                                              placeholder="Nome da empresa"
                                              className="w-48 rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-forest focus:outline-none"
                                            />
                                          </label>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Resumo geral — Total de referência (vem da licitação), Mínimo
                  (c/ frete) (vem da Proposta Comercial do Cliente), Total
                  ofertado (soma conforme o Analista preenche: grupos pelo
                  total do grupo, itens soltos por unitário × quantidade) e
                  o percentual do ofertado sobre o mínimo (c/ frete). A
                  pedido do Márcio (06/10). */}
              {(() => {
                const totalReferenciaGeral = blocosVisuais.reduce(
                  (soma, bloco) =>
                    soma + bloco.linhas.reduce((s2, linha) => s2 + linha.item.precoReferencia * linha.item.quantidade, 0),
                  0,
                );
                const totalMinimoGeral = blocosVisuais.reduce(
                  (soma, bloco) =>
                    soma + bloco.linhas.reduce((s2, linha) => s2 + linha.precoMinimoComFreteUnitario * linha.item.quantidade, 0),
                  0,
                );
                const algumMinimoGeral = blocosVisuais.some((bloco) =>
                  bloco.linhas.some((linha) => linha.precoMinimoComFreteUnitario > 0),
                );

                // Valor ofertado de um bloco (null = Analista ainda não
                // preencheu nada nele). Grupo com total digitado usa o total;
                // no modo "Grupo e item", sem total digitado, usa a soma dos
                // itens (unitário × quantidade).
                const ofertadoDoBloco = (bloco: (typeof blocosVisuais)[number]): number | null => {
                  const tratarComoGrupo = !!bloco.grupoId && (modoResultado === 'grupo' || modoResultado === 'grupo_e_item');
                  if (tratarComoGrupo && bloco.grupoId) {
                    const valorGrupo = campoParaNumeroDecimal(valoresPorGrupo[bloco.grupoId]?.valorOfertadoTexto ?? '', 2);
                    if (valorGrupo != null) return valorGrupo;
                    if (modoResultado === 'grupo') return null;
                  }
                  let algum = false;
                  const soma = bloco.linhas.reduce((acc, linha) => {
                    const unitario = campoParaNumeroDecimal(valoresPorLinha[linha.chave]?.valorOfertadoTexto ?? '', 2);
                    if (unitario == null) return acc;
                    algum = true;
                    return acc + unitario * linha.item.quantidade;
                  }, 0);
                  return algum ? soma : null;
                };

                let totalOfertadoGeral = 0;
                let algumPreenchido = false;
                // Mínimo (c/ frete) só dos blocos já preenchidos — para o
                // percentual comparar o que foi ofertado com o mínimo do
                // MESMO conjunto (senão, com a disputa preenchida pela
                // metade, o percentual ficaria falsamente negativo).
                let minimoDosPreenchidos = 0;
                blocosVisuais.forEach((bloco) => {
                  const ofertado = ofertadoDoBloco(bloco);
                  if (ofertado == null) return;
                  algumPreenchido = true;
                  totalOfertadoGeral += ofertado;
                  minimoDosPreenchidos += bloco.linhas.reduce(
                    (soma, linha) => soma + linha.precoMinimoComFreteUnitario * linha.item.quantidade,
                    0,
                  );
                });

                const percentualSobreMinimo =
                  algumPreenchido && minimoDosPreenchidos > 0 ? (totalOfertadoGeral / minimoDosPreenchidos - 1) * 100 : null;
                // Diferença em R$ entre o ofertado e o mínimo (c/ frete) do
                // mesmo conjunto de grupos/itens preenchidos.
                const diferencaReais =
                  algumPreenchido && minimoDosPreenchidos > 0 ? totalOfertadoGeral - minimoDosPreenchidos : null;
                const diferencaTexto =
                  diferencaReais == null
                    ? '—'
                    : `${diferencaReais > 0 ? '+' : diferencaReais < 0 ? '−' : ''}${formatarMoeda(Math.abs(diferencaReais))}`;
                const percentualTexto =
                  percentualSobreMinimo == null
                    ? '—'
                    : `${percentualSobreMinimo > 0 ? '+' : ''}${percentualSobreMinimo.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}%`;

                return (
                  <div className="rounded-2xl border border-forest/30 bg-forest-mist px-5 py-4 font-body">
                    <p className="mb-3 text-sm font-semibold text-forest-deep">Resumo geral da disputa</p>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                          Total de referência
                        </span>
                        <span className="text-base font-semibold text-forest-deep">
                          {formatarMoeda(totalReferenciaGeral)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                          Mínimo (c/ frete)
                        </span>
                        {/* Vai somando conforme o Analista preenche: só entra o
                            mínimo dos grupos/itens que já têm valor ofertado. */}
                        <span className="text-base font-semibold text-forest-deep">
                          {algumPreenchido && minimoDosPreenchidos > 0 ? formatarMoeda(minimoDosPreenchidos) : '—'}
                        </span>
                        {algumMinimoGeral && (
                          <span className="text-[11px] text-ink-soft">
                            de {formatarMoeda(totalMinimoGeral)} no total
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                          Total geral ofertado
                        </span>
                        <span className="text-base font-semibold text-forest-deep">
                          {algumPreenchido ? formatarMoeda(totalOfertadoGeral) : '—'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                          % ofertado × mínimo (c/ frete)
                        </span>
                        <span
                          className={`text-base font-semibold ${
                            percentualSobreMinimo == null
                              ? 'text-forest-deep'
                              : percentualSobreMinimo >= 0
                                ? 'text-forest'
                                : 'text-red-700'
                          }`}
                        >
                          {percentualTexto}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                          Diferença (R$) ofertado − mínimo
                        </span>
                        <span
                          className={`text-base font-semibold ${
                            diferencaReais == null
                              ? 'text-forest-deep'
                              : diferencaReais >= 0
                                ? 'text-forest'
                                : 'text-red-700'
                          }`}
                        >
                          {diferencaTexto}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-ink-soft">
                      O percentual e a diferença em R$ comparam o total ofertado com o mínimo (c/ frete) apenas dos grupos/itens já preenchidos.
                      Positivo = acima do mínimo; negativo = abaixo do mínimo.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {erroSalvar && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-xs text-red-700">
            Não foi possível salvar: {erroSalvar}
          </div>
        )}
      </div>
    </Modal>
  );
}
