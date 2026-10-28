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
// REFEITO em 26/10/2026, a pedido do Márcio, exatamente como o layout
// "Tela Disputa – Resultado" (Claude Design): duas seções numeradas —
// "1. Acompanhamento do processo" (situação do processo, ação pendente e
// prazo, adjudicada em, homologada em, observação) e "2. Resultado do
// cliente por grupo/item" (posição, valores, deságio e acima do mínimo
// calculados, resultado do cliente, vencedor e motivo da perda). O campo
// "Resultado" geral e a "Situação do resultado" saíram: o resultado geral é
// calculado a partir dos itens e o selo provisório/definitivo, a partir da
// data de homologação. Exige a migração 059.
//
// Pra montar a tabela, o modal busca a licitação completa (com itens e
// grupos) assim que abre — `licitacaoId` sozinho não é suficiente, porque
// a lista carregada em DisputasPage (licitacaoService.listar) não traz os
// itens completos (só buscarPorId traz).

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import {
  Disputa,
  DisputaFormData,
  DisputaResultadoLinhaFormData,
  ResultadoDisputa,
  ResultadoItemDisputa,
  RESULTADO_ITEM_DISPUTA_LABEL,
  RESULTADOS_DE_PERDA,
  MotivoPerda,
  MOTIVO_PERDA_LABEL,
  MotivoPerdaEvitavel,
  MOTIVO_PERDA_EVITAVEL_LABEL,
  MotivoPerdaHabilitacao,
  SituacaoProcesso,
  SITUACAO_PROCESSO_LABEL,
  AcaoPendente,
  ACAO_PENDENTE_LABEL,
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

// Data (yyyy-mm-dd) no fuso local a partir de um ISO — usada no campo
// "Homologada em".
function isoParaDataLocal(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Data e hora (yyyy-mm-ddThh:mm) no fuso local a partir de um ISO — usada nos
// campos "Data/hora da sessão" e "Prazo da ação".
function isoParaDataHoraLocal(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface ValoresLinha {
  posicaoTexto: string;
  valorOfertadoTexto: string;
  // Resultado do cliente. '' = ainda não informado.
  resultadoItem: ResultadoItemDisputa | '';
  valorVencedorTexto: string;
  nomeVencedor: string;
  motivoPerda: MotivoPerda | '';
  // Por que a perda foi evitável (só quando o vencedor ficou igual ou acima do
  // nosso mínimo). '' = ainda não informado.
  motivoPerdaEvitavel: MotivoPerdaEvitavel | '';
  // Origem da desclassificação (só com o motivo "Desclassificado na proposta"):
  // grava no motivo detalhado da migração 054, de onde o relatório "Perdas na
  // habilitação" tira a origem. '' = ainda não informada.
  origemDesclassificacao: OrigemDesclassificacao | '';
  // Marca de vitória por convocação: liga ao escolher "Convocado" e é mantida
  // quando o resultado passa a "Ganho (homologado)" (relatório de vitórias por
  // convocação).
  convocacao: boolean;
}

const VALORES_VAZIOS: ValoresLinha = {
  posicaoTexto: '',
  valorOfertadoTexto: '',
  resultadoItem: '',
  valorVencedorTexto: '',
  nomeVencedor: '',
  motivoPerda: '',
  motivoPerdaEvitavel: '',
  origemDesclassificacao: '',
  convocacao: false,
};

// Origem da desclassificação: cada opção corresponde a um motivo detalhado da
// migração 054 (a etapa e a origem saem dele, sem coluna nova).
type OrigemDesclassificacao = Extract<
  MotivoPerdaHabilitacao,
  'desclass_documentacao_produto' | 'desclass_amostra_especificacao' | 'desclass_erro_proposta'
>;

const ORIGEM_DESCLASSIFICACAO_LABEL: Record<OrigemDesclassificacao, string> = {
  desclass_documentacao_produto: 'Indústria — documentação do produto (ficha técnica, catálogo, registro, certificação)',
  desclass_amostra_especificacao: 'Produto — amostra reprovada ou especificação não atendida',
  desclass_erro_proposta: 'Salutti — erro na proposta (preço, marca, modelo)',
};

function origemDesclassificacaoDe(
  motivo: MotivoPerdaHabilitacao | undefined,
): OrigemDesclassificacao | '' {
  return motivo && motivo in ORIGEM_DESCLASSIFICACAO_LABEL ? (motivo as OrigemDesclassificacao) : '';
}

// Campos que só valem para a linha salva antes desta tela (migração 054):
// preservados ao reabrir uma disputa, para não apagar o detalhe já gravado.
interface DetalheLegado {
  motivoPerdaHabilitacao?: DisputaResultadoLinhaFormData['motivoPerdaHabilitacao'];
  motivoPerdaEvitavel?: DisputaResultadoLinhaFormData['motivoPerdaEvitavel'];
  cnpjVencedor?: string;
}

// ---------------------------------------------------------------------------
// Estilos do layout "Tela Disputa – Resultado" (26/10/2026)
// ---------------------------------------------------------------------------
const CLASSE_ROTULO = 'font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4B5651]';
const CLASSE_CAMPO =
  'box-border h-11 w-full rounded-md border border-[#C9D3CD] bg-white px-3 text-sm text-ink focus:border-forest focus:outline-none disabled:bg-[#F1F3F1] disabled:text-[#5E6863]';
const CLASSE_CALCULO =
  'box-border flex h-11 items-center rounded-md bg-[#E6EFE9] px-3 text-sm font-semibold text-[#1E4D3A]';
const CLASSE_LEITURA =
  'box-border flex h-11 items-center rounded-md border border-[#C9D3CD] bg-white px-3 text-sm font-semibold text-ink';

function formatarPercentual(valor: number | null, comSinal: boolean): string {
  if (valor == null || !isFinite(valor)) return '—';
  const texto = valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${comSinal && valor > 0 ? '+' : ''}${texto}%`;
}

interface CartaoResultadoProps {
  /** Título do card (item, ou "Grupo N — Total do grupo"). */
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  valores: ValoresLinha;
  onChange: <K extends keyof ValoresLinha>(campo: K, valor: ValoresLinha[K]) => void;
  /** Valor de referência e mínimo (c/ frete), já na mesma base do "Valor ofertado". */
  referencia: number;
  minimo: number | null;
  /** Rótulo extra do valor ofertado: "(unit.)" ou "(total)". */
  baseValor: 'unit.' | 'total';
  /** Posição apenas para leitura (item de grupo no modo "Grupo e item"). */
  posicaoSomenteLeitura?: string;
  /** Quando preenchido, o valor ofertado é só informativo (valor do grupo). */
  ofertadoSomenteLeitura?: string;
  /** Texto de apoio abaixo do valor ofertado. */
  ofertadoAjuda?: string;
  /** Há data de "Homologada em": libera Ganho/Perdido (homologado). */
  homologada: boolean;
  /** Item de grupo: tom verde claro com faixa lateral. */
  dentroDeGrupo?: boolean;
  children?: React.ReactNode;
}

/** Card de resultado do cliente (grupo ou item), no padrão do layout aprovado:
 *  linha 1 = posição, referência, mínimo, valor ofertado e os dois cálculos
 *  automáticos; linha 2 = resultado, vencedor e motivo da perda. */
function CartaoResultado({
  titulo,
  subtitulo,
  valores,
  onChange,
  referencia,
  minimo,
  baseValor,
  posicaoSomenteLeitura,
  ofertadoSomenteLeitura,
  ofertadoAjuda,
  homologada,
  dentroDeGrupo,
  children,
}: CartaoResultadoProps) {
  const posicaoTexto = posicaoSomenteLeitura ?? valores.posicaoTexto;
  const posicao = posicaoTexto && Number(posicaoTexto) > 0 ? Number(posicaoTexto) : null;
  const ofertado = campoParaNumeroDecimal(valores.valorOfertadoTexto, 2);
  const vencedor = campoParaNumeroDecimal(valores.valorVencedorTexto, 2);
  const emPrimeiro = posicao === 1;
  const atrasDoPrimeiro = posicao != null && posicao > 1;

  const desagio = referencia > 0 && ofertado != null ? (1 - ofertado / referencia) * 100 : null;
  const acimaDoMinimo = minimo != null && minimo > 0 && ofertado != null ? (ofertado / minimo - 1) * 100 : null;
  const diferencaVencedor = vencedor != null && vencedor > 0 && ofertado != null ? (ofertado / vencedor - 1) * 100 : null;
  const mostrarDiferencaVencedor = atrasDoPrimeiro && diferencaVencedor != null;

  const resultado = valores.resultadoItem;
  const mostrarMotivo = resultado !== '' && RESULTADOS_DE_PERDA.includes(resultado);
  // Perda evitável: perdemos e o vencedor ficou igual ou acima do nosso mínimo
  // (c/ frete) — mesma regra do card "Perdas evitáveis" dos Indicadores.
  const perdaEvitavel =
    (resultado === 'perdido_analise' || resultado === 'perdido') &&
    vencedor != null &&
    minimo != null &&
    minimo > 0 &&
    vencedor >= minimo;
  const vencedorLiberado = atrasDoPrimeiro || (resultado !== '' && RESULTADOS_DE_PERDA.includes(resultado));
  const textoVencedorBloqueado = emPrimeiro ? '— (cliente em 1º)' : '— (informe a posição)';

  const estiloCard = emPrimeiro
    ? 'border-[#C9D9CF] bg-[#F7FAF8]'
    : atrasDoPrimeiro
      ? 'border-[#E6CFCF] bg-[#FCF8F8]'
      : dentroDeGrupo
        ? 'border-forest/20 border-l-4 border-l-forest/50 bg-forest-mist/25'
        : 'border-ink-soft/15 bg-white';

  return (
    <div className={`flex flex-col gap-4 rounded-[10px] border p-[18px] font-body ${estiloCard}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-ink">{titulo}</div>
          {subtitulo && <div className="mt-0.5 text-[13px] text-[#5E6863]">{subtitulo}</div>}
        </div>
        {emPrimeiro && (
          <span className="rounded-full bg-[#DCEEE3] px-2.5 py-1 text-xs font-bold text-[#1E4D3A]">Cliente em 1º</span>
        )}
        {atrasDoPrimeiro && (
          <span className="rounded-full bg-[#F6E0E0] px-2.5 py-1 text-xs font-bold text-[#8A2323]">
            Cliente em {posicao}º
          </span>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
        <div className="flex flex-col gap-1.5">
          <span className={CLASSE_ROTULO}>Posição</span>
          {posicaoSomenteLeitura !== undefined ? (
            <div className={`${CLASSE_LEITURA} bg-[#F1F3F1] text-[#5E6863]`}>{posicaoSomenteLeitura || '—'}</div>
          ) : (
            <input
              type="number"
              min={1}
              aria-label="Posição"
              value={valores.posicaoTexto}
              onChange={(e) => onChange('posicaoTexto', e.target.value)}
              placeholder="—"
              className={CLASSE_CAMPO}
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={CLASSE_ROTULO}>Valor de referência</span>
          <div className={CLASSE_LEITURA}>{referencia > 0 ? formatarMoeda(referencia) : '—'}</div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={CLASSE_ROTULO}>Mínimo (c/ frete)</span>
          <div className={CLASSE_LEITURA}>{minimo != null && minimo > 0 ? formatarMoeda(minimo) : '—'}</div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={CLASSE_ROTULO}>
            Valor ofertado <span className="normal-case tracking-normal">({baseValor})</span>
          </span>
          {ofertadoSomenteLeitura !== undefined ? (
            <div className={`${CLASSE_LEITURA} bg-[#F1F3F1] text-[#5E6863]`}>{ofertadoSomenteLeitura}</div>
          ) : (
            <input
              type="text"
              inputMode="decimal"
              aria-label="Valor ofertado"
              value={valores.valorOfertadoTexto}
              onChange={(e) => onChange('valorOfertadoTexto', e.target.value)}
              onBlur={() =>
                onChange(
                  'valorOfertadoTexto',
                  numeroParaCampoDecimal(campoParaNumeroDecimal(valores.valorOfertadoTexto, 2), 2),
                )
              }
              placeholder="R$ 0,00"
              className={CLASSE_CAMPO}
            />
          )}
          {ofertadoAjuda && <span className="text-[11px] text-[#5E6863]">{ofertadoAjuda}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={CLASSE_ROTULO}>Deságio s/ referência</span>
          <div className={CLASSE_CALCULO}>{formatarPercentual(desagio, false)}</div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={CLASSE_ROTULO}>{mostrarDiferencaVencedor ? 'Diferença p/ vencedor' : 'Acima do mínimo'}</span>
          <div className={`${CLASSE_CALCULO} ${mostrarDiferencaVencedor ? '!bg-[#F6E0E0] !text-[#8A2323]' : ''}`}>
            {formatarPercentual(mostrarDiferencaVencedor ? diferencaVencedor : acimaDoMinimo, true)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        <div className="flex flex-col gap-1.5">
          <span className={CLASSE_ROTULO}>Resultado do cliente *</span>
          <select
            aria-label="Resultado do cliente"
            value={valores.resultadoItem}
            onChange={(e) => onChange('resultadoItem', e.target.value as ResultadoItemDisputa | '')}
            className={`${CLASSE_CAMPO} ${emPrimeiro ? '!border-2 !border-[#1E4D3A]' : ''}`}
          >
            <option value="">Selecione</option>
            {(Object.keys(RESULTADO_ITEM_DISPUTA_LABEL) as ResultadoItemDisputa[]).map((valor) => {
              const exigeHomologacao = valor === 'ganho' || valor === 'perdido';
              return (
                <option key={valor} value={valor} disabled={exigeHomologacao && !homologada && resultado !== valor}>
                  {RESULTADO_ITEM_DISPUTA_LABEL[valor]}
                </option>
              );
            })}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={CLASSE_ROTULO}>Valor do vencedor</span>
          {vencedorLiberado ? (
            <input
              type="text"
              inputMode="decimal"
              aria-label="Valor do vencedor"
              value={valores.valorVencedorTexto}
              onChange={(e) => onChange('valorVencedorTexto', e.target.value)}
              onBlur={() =>
                onChange(
                  'valorVencedorTexto',
                  numeroParaCampoDecimal(campoParaNumeroDecimal(valores.valorVencedorTexto, 2), 2),
                )
              }
              placeholder="R$ 0,00"
              className={CLASSE_CAMPO}
            />
          ) : (
            <input type="text" aria-label="Valor do vencedor" value={textoVencedorBloqueado} disabled className={CLASSE_CAMPO} />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={CLASSE_ROTULO}>Empresa vencedora</span>
          {vencedorLiberado ? (
            <input
              type="text"
              aria-label="Empresa vencedora"
              value={valores.nomeVencedor}
              onChange={(e) => onChange('nomeVencedor', e.target.value)}
              placeholder="Nome da empresa"
              className={CLASSE_CAMPO}
            />
          ) : (
            <input type="text" aria-label="Empresa vencedora" value={textoVencedorBloqueado} disabled className={CLASSE_CAMPO} />
          )}
        </div>
        {mostrarMotivo && (
          <div className="flex flex-col gap-1.5">
            <span className={CLASSE_ROTULO}>
              Motivo da perda {resultado === 'perdido_habilitacao' ? '*' : ''}
            </span>
            <select
              aria-label="Motivo da perda"
              value={valores.motivoPerda}
              onChange={(e) => onChange('motivoPerda', e.target.value as MotivoPerda | '')}
              className={CLASSE_CAMPO}
            >
              <option value="">Selecione</option>
              {(Object.keys(MOTIVO_PERDA_LABEL) as MotivoPerda[]).map((valor) => (
                <option key={valor} value={valor}>
                  {MOTIVO_PERDA_LABEL[valor]}
                </option>
              ))}
            </select>
            <span className="text-xs text-[#5E6863]">aparece só quando o resultado é de perda</span>
          </div>
        )}
        {mostrarMotivo && valores.motivoPerda === 'desclassificado_proposta' && (
          <div className="flex flex-col gap-1.5">
            <span className={CLASSE_ROTULO}>Origem da desclassificação</span>
            <select
              aria-label="Origem da desclassificação"
              value={valores.origemDesclassificacao}
              onChange={(e) => onChange('origemDesclassificacao', e.target.value as OrigemDesclassificacao | '')}
              className={CLASSE_CAMPO}
            >
              <option value="">Não informada</option>
              {(Object.keys(ORIGEM_DESCLASSIFICACAO_LABEL) as OrigemDesclassificacao[]).map((valor) => (
                <option key={valor} value={valor}>
                  {ORIGEM_DESCLASSIFICACAO_LABEL[valor]}
                </option>
              ))}
            </select>
            <span className="text-xs text-[#5E6863]">de onde veio a causa; alimenta "Perdas na habilitação"</span>
          </div>
        )}
        {perdaEvitavel && (
          <div className="flex flex-col gap-1.5">
            <span className={CLASSE_ROTULO}>Por que foi evitável</span>
            <select
              aria-label="Por que a perda foi evitável"
              value={valores.motivoPerdaEvitavel}
              onChange={(e) => onChange('motivoPerdaEvitavel', e.target.value as MotivoPerdaEvitavel | '')}
              className={CLASSE_CAMPO}
            >
              <option value="">Selecione</option>
              {(Object.keys(MOTIVO_PERDA_EVITAVEL_LABEL) as MotivoPerdaEvitavel[]).map((valor) => (
                <option key={valor} value={valor}>
                  {MOTIVO_PERDA_EVITAVEL_LABEL[valor]}
                </option>
              ))}
            </select>
            <span className="text-xs text-[#5E6863]">o vencedor ficou igual ou acima do nosso mínimo</span>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

// Especificação de item cheia demais pra mostrar de cara na tabela (ver
// nota sobre "ver mais/ver menos" mais abaixo). Limite aproximado — não
// mede linhas renderizadas de fato, só o tamanho do texto.
const LIMITE_DESCRICAO_CURTA = 150;

function criarFormularioVazio(licitacaoId: string): DisputaFormData {
  return {
    licitacaoId,
    dataSessaoRealizada: undefined,
    resultado: 'em_andamento',
    homologadoEm: undefined,
    situacaoProcesso: 'em_julgamento',
    acaoPendente: 'nenhuma',
    prazoAcao: undefined,
    adjudicadaEm: undefined,
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
  // Datas do processo (layout de 26/10): "Homologada em" torna o resultado
  // DEFINITIVO; "Adjudicada em" registra a adjudicação.
  const [dataHomologacao, setDataHomologacao] = useState('');
  const [dataAdjudicacao, setDataAdjudicacao] = useState('');
  const [prazoAcaoTexto, setPrazoAcaoTexto] = useState('');
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

  // Detalhe gravado antes desta tela (migração 054), por chave (itemId ou
  // grupoId): é devolvido ao salvar para não ser apagado sem querer.
  const detalhesLegados = useMemo(() => {
    const mapa = new Map<string, DetalheLegado>();
    (disputaEmEdicao?.itens ?? []).forEach((linha) => {
      const chave = linha.itemId ?? linha.grupoId;
      if (!chave) return;
      mapa.set(chave, {
        motivoPerdaHabilitacao: linha.motivoPerdaHabilitacao,
        motivoPerdaEvitavel: linha.motivoPerdaEvitavel,
        cnpjVencedor: linha.cnpjVencedor,
      });
    });
    return mapa;
  }, [disputaEmEdicao]);

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
          homologadoEm: disputaEmEdicao.homologadoEm,
          // Disputa antiga, sem situação do processo: "homologada" se já tem
          // data de homologação; senão, "em julgamento".
          situacaoProcesso:
            disputaEmEdicao.situacaoProcesso ?? (disputaEmEdicao.homologadoEm ? 'homologada' : 'em_julgamento'),
          acaoPendente: disputaEmEdicao.acaoPendente ?? 'nenhuma',
          prazoAcao: disputaEmEdicao.prazoAcao,
          adjudicadaEm: disputaEmEdicao.adjudicadaEm,
          observacoes: disputaEmEdicao.observacoes,
          linkAtaSigaPregao: disputaEmEdicao.linkAtaSigaPregao,
          itens: [],
        }
      : criarFormularioVazio(licitacaoId);
    setForm(inicial);
    setDataHomologacao(isoParaDataLocal(disputaEmEdicao?.homologadoEm));
    setDataAdjudicacao(disputaEmEdicao?.adjudicadaEm?.slice(0, 10) ?? '');
    setPrazoAcaoTexto(isoParaDataHoraLocal(disputaEmEdicao?.prazoAcao));
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
        motivoPerda: linha.motivoPerda ?? '',
        motivoPerdaEvitavel: linha.motivoPerdaEvitavel ?? '',
        origemDesclassificacao: origemDesclassificacaoDe(linha.motivoPerdaHabilitacao),
        convocacao: linha.vitoriaPorConvocacao ?? false,
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

  // Aplica uma alteração num conjunto de valores. Trocar o resultado ajusta a
  // marca de convocação: "Convocado" liga; "Ganho (homologado)" mantém o que
  // já estava (a vitória foi por convocação); qualquer outro desliga.
  function aplicarAlteracao<K extends keyof ValoresLinha>(
    atual: ValoresLinha | undefined,
    campo: K,
    valor: ValoresLinha[K],
  ): ValoresLinha {
    const base = atual ?? VALORES_VAZIOS;
    const novo: ValoresLinha = { ...base, [campo]: valor };
    if (campo === 'resultadoItem') {
      const resultado = valor as ResultadoItemDisputa | '';
      novo.convocacao = resultado === 'convocado' ? true : resultado === 'ganho' ? base.convocacao : false;
    }
    return novo;
  }

  function atualizarValorLinha<K extends keyof ValoresLinha>(chave: string, campo: K, valor: ValoresLinha[K]) {
    setValoresPorLinha((atual) => ({ ...atual, [chave]: aplicarAlteracao(atual[chave], campo, valor) }));
  }

  function atualizarValorGrupo<K extends keyof ValoresLinha>(grupoId: string, campo: K, valor: ValoresLinha[K]) {
    setValoresPorGrupo((atual) => ({ ...atual, [grupoId]: aplicarAlteracao(atual[grupoId], campo, valor) }));
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

  const situacaoProcesso = form.situacaoProcesso ?? 'em_julgamento';
  // "Homologada em" só vale quando a situação do processo é "Homologada";
  // "Adjudicada em" vale em "Adjudicada" e "Homologada".
  const homologadaEmLiberada = situacaoProcesso === 'homologada';
  const adjudicadaEmLiberada = situacaoProcesso === 'adjudicada' || situacaoProcesso === 'homologada';
  const resultadoDefinitivo = homologadaEmLiberada && !!dataHomologacao;

  // Itens/grupos ainda "em análise" — candidatos à conversão ao homologar.
  function listarEmAnalise(): { onde: 'linha' | 'grupo'; chave: string; resultado: ResultadoItemDisputa }[] {
    const lista: { onde: 'linha' | 'grupo'; chave: string; resultado: ResultadoItemDisputa }[] = [];
    Object.entries(valoresPorLinha).forEach(([chave, v]) => {
      if (v.resultadoItem === 'arrematado_analise' || v.resultadoItem === 'perdido_analise') {
        lista.push({ onde: 'linha', chave, resultado: v.resultadoItem });
      }
    });
    Object.entries(valoresPorGrupo).forEach(([chave, v]) => {
      if (v.resultadoItem === 'arrematado_analise' || v.resultadoItem === 'perdido_analise') {
        lista.push({ onde: 'grupo', chave, resultado: v.resultadoItem });
      }
    });
    return lista;
  }
  const quantidadeEmAnalise = resultadoDefinitivo ? listarEmAnalise().length : 0;

  function converterEmAnaliseParaHomologado() {
    listarEmAnalise().forEach(({ onde, chave, resultado }) => {
      const novo: ResultadoItemDisputa = resultado === 'arrematado_analise' ? 'ganho' : 'perdido';
      if (onde === 'linha') atualizarValorLinha(chave, 'resultadoItem', novo);
      else atualizarValorGrupo(chave, 'resultadoItem', novo);
    });
  }

  // Dados que serão gravados para uma linha (item ou grupo).
  function dadosDaLinha(valores: ValoresLinha | undefined, chaveLegada: string, posicaoFixa?: number) {
    const resultadoItem = valores?.resultadoItem || undefined;
    const emPerda = !!resultadoItem && RESULTADOS_DE_PERDA.includes(resultadoItem);
    const legado = detalhesLegados.get(chaveLegada);
    return {
      posicao: posicaoFixa ?? (valores?.posicaoTexto ? Number(valores.posicaoTexto) : undefined),
      valorFechado: valores ? campoParaNumeroDecimal(valores.valorOfertadoTexto, 2) : undefined,
      resultadoItem,
      // Vencedor: só nos resultados de perda (o campo só abre quando o
      // cliente não está em 1º ou quando o resultado é de perda).
      valorVencedor: emPerda && valores ? campoParaNumeroDecimal(valores.valorVencedorTexto, 2) : undefined,
      nomeVencedor: emPerda && valores?.nomeVencedor.trim() ? valores.nomeVencedor.trim() : undefined,
      motivoPerda: emPerda && valores?.motivoPerda ? valores.motivoPerda : undefined,
      vitoriaPorConvocacao:
        resultadoItem === 'convocado' || (resultadoItem === 'ganho' && !!valores?.convocacao),
      // Detalhe da migração 054, preservado se o resultado continua o mesmo tipo.
      // Origem informada na tela (desclassificação na proposta); senão, preserva o
      // detalhe gravado antes desta tela quando o resultado continua o mesmo tipo.
      motivoPerdaHabilitacao:
        emPerda && valores?.motivoPerda === 'desclassificado_proposta' && valores.origemDesclassificacao
          ? valores.origemDesclassificacao
          : resultadoItem === 'perdido_habilitacao' && valores?.motivoPerda !== 'desclassificado_proposta'
            ? legado?.motivoPerdaHabilitacao
            : undefined,
      // Só nas perdas por preço (provisória ou definitiva); vale como registro mesmo
      // se o vencedor mudar depois: o indicador só lê as perdas que seguem evitáveis.
      motivoPerdaEvitavel:
        (resultadoItem === 'perdido' || resultadoItem === 'perdido_analise') && valores?.motivoPerdaEvitavel
          ? valores.motivoPerdaEvitavel
          : undefined,
      cnpjVencedor: emPerda ? legado?.cnpjVencedor : undefined,
    };
  }

  function erroDaLinha(valores: ValoresLinha | undefined, nome: string): string | null {
    if (!valores) return null;
    const preencheu = !!valores.posicaoTexto || !!valores.valorOfertadoTexto.trim();
    if (preencheu && !valores.resultadoItem) return `${nome}: informe o "Resultado do cliente".`;
    if (valores.resultadoItem === 'perdido_habilitacao' && !valores.motivoPerda) {
      return `${nome}: informe o "Motivo da perda".`;
    }
    return null;
  }

  async function handleSalvar() {
    const itens: DisputaResultadoLinhaFormData[] = [];
    let erroPreenchimento: string | null = null;

    // Regras do processo (layout de 26/10).
    if (adjudicadaEmLiberada && !dataAdjudicacao) {
      setErroSalvar('Informe a data em "Adjudicada em" (a situação do processo é Adjudicada ou Homologada).');
      return;
    }
    if (homologadaEmLiberada && !dataHomologacao) {
      setErroSalvar('Informe a data em "Homologada em" (a situação do processo é Homologada).');
      return;
    }
    if (form.acaoPendente && form.acaoPendente !== 'nenhuma' && !prazoAcaoTexto) {
      setErroSalvar('Informe o "Prazo da ação" para a ação pendente escolhida.');
      return;
    }

    blocosVisuais.forEach((bloco) => {
      // "Tratar como grupo" = este bloco tem grupo E o modo escolhido pede
      // uma linha só pro grupo inteiro (não uma por item). Item solto
      // (bloco.grupoId undefined) nunca cai aqui — não existe "grupo" pra
      // gravar o valor.
      const tratarComoGrupo = !!bloco.grupoId && (modoResultado === 'grupo' || modoResultado === 'grupo_e_item');

      if (tratarComoGrupo && bloco.grupoId) {
        const valores = valoresPorGrupo[bloco.grupoId];
        const emGrupoEItem = modoResultado === 'grupo_e_item';
        const dados = dadosDaLinha(valores, bloco.grupoId);
        // Total do grupo: o que o Analista digitou; se deixou em branco no
        // modo "Grupo e item", vale a soma dos itens.
        const valorFechado = dados.valorFechado ?? (emGrupoEItem ? somaItensDoBloco(bloco) ?? undefined : undefined);
        erroPreenchimento = erroPreenchimento ?? erroDaLinha(valores, bloco.grupoRotulo ?? 'Grupo');
        if (dados.posicao != null || valorFechado != null || dados.resultadoItem) {
          itens.push({ grupoId: bloco.grupoId, ...dados, valorFechado });
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
        const dados = dadosDaLinha(valores, linha.chave);
        const posicao = posicaoSoNoGrupo ? undefined : dados.posicao;
        erroPreenchimento = erroPreenchimento ?? erroDaLinha(valores, `Item ${linha.item.numero}`);
        // Só grava linha que tenha algo preenchido — não polui o banco com
        // linhas vazias pra item que o analista ainda não chegou a
        // registrar.
        if (posicao != null || dados.valorFechado != null || dados.resultadoItem) {
          itens.push({ itemId: linha.itemId, ...dados, posicao });
        }
      });
    });

    if (erroPreenchimento) {
      setErroSalvar(erroPreenchimento);
      return;
    }

    // Resultado GERAL da disputa (usado para atualizar o status da licitação),
    // calculado a partir dos resultados por item/grupo — não é mais um campo da
    // tela: ganho se ao menos um item/grupo é "Ganho (homologado)"; perdido se
    // todos os informados são perdas homologadas; senão, em andamento.
    const informados = itens.map((i) => i.resultadoItem).filter((r): r is ResultadoItemDisputa => !!r);
    let resultadoGeral: ResultadoDisputa = 'em_andamento';
    if (informados.some((r) => r === 'ganho')) resultadoGeral = 'ganho';
    else if (informados.length > 0 && informados.every((r) => r === 'perdido' || r === 'perdido_habilitacao')) {
      resultadoGeral = 'perdido';
    }
    if (form.resultado === 'homologado' && resultadoGeral === 'ganho') resultadoGeral = 'homologado';

    setSalvando(true);
    setErroSalvar(null);
    try {
      const homologadoEm = homologadaEmLiberada && dataHomologacao ? new Date(`${dataHomologacao}T12:00:00`).toISOString() : undefined;
      await onSave({
        ...form,
        resultado: resultadoGeral,
        situacaoProcesso,
        acaoPendente: form.acaoPendente ?? 'nenhuma',
        prazoAcao: prazoAcaoTexto ? new Date(prazoAcaoTexto).toISOString() : undefined,
        adjudicadaEm: adjudicadaEmLiberada && dataAdjudicacao ? dataAdjudicacao : undefined,
        homologadoEm,
        itens,
      });
      onClose();
    } catch (erro) {
      setErroSalvar(erro instanceof Error ? erro.message : 'Erro desconhecido ao salvar o resultado.');
    } finally {
      setSalvando(false);
    }
  }

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
      <div className="space-y-7">
        {/* Selo calculado pelo sistema: provisório até haver a data de
            homologação. */}
        <div className="flex flex-wrap items-center gap-3.5">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              resultadoDefinitivo ? 'bg-[#DCEEE3] text-[#1E4D3A]' : 'bg-[#FDF0DC] text-[#7A4A06]'
            }`}
          >
            {resultadoDefinitivo ? 'Resultado definitivo' : 'Resultado provisório'}
          </span>
          <span className="text-xs text-[#5E6863]">
            calculado pelo sistema: vira “definitivo” quando houver data de homologação
          </span>
        </div>

        <div className="rounded-md border border-[#E1E7E3] bg-[#F4F6F4] px-4 py-3 text-[13px]">
          <span className="text-[#5E6863]">Portal:</span> <strong>{licitacao?.portal || '—'}</strong>
        </div>

        {/* ------------------------------------------------------------------
            1. Acompanhamento do processo
           ------------------------------------------------------------------ */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-display text-lg text-[#1E4D3A]">1. Acompanhamento do processo</h2>
            <span className="text-[13px] text-[#5E6863]">em que fase a licitação está no órgão</span>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[18px]">
            <label className="flex flex-col gap-1.5">
              <span className={CLASSE_ROTULO}>Data/hora da sessão</span>
              <input
                type="datetime-local"
                value={isoParaDataHoraLocal(form.dataSessaoRealizada)}
                onChange={(e) =>
                  atualizarCampo('dataSessaoRealizada', e.target.value ? new Date(e.target.value).toISOString() : undefined)
                }
                className={CLASSE_CAMPO}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={CLASSE_ROTULO}>Situação do processo *</span>
              <select
                value={situacaoProcesso}
                onChange={(e) => atualizarCampo('situacaoProcesso', e.target.value as SituacaoProcesso)}
                className={`${CLASSE_CAMPO} !border-2 !border-[#1E4D3A]`}
              >
                {(Object.keys(SITUACAO_PROCESSO_LABEL) as SituacaoProcesso[]).map((valor) => (
                  <option key={valor} value={valor}>
                    {SITUACAO_PROCESSO_LABEL[valor]}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[#5E6863]">substitui “Resultado: Em andamento”</span>
            </label>

            {/* Como a disputa aconteceu — define se o Valor ofertado é
                preenchido por GRUPO inteiro (um valor só, já total) ou por
                ITEM (preço unitário, somado automaticamente). A pedido do
                Márcio (05/10). */}
            {!!licitacao && licitacao.grupos.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className={CLASSE_ROTULO}>Como a disputa aconteceu</span>
                <div className="flex flex-wrap gap-2">
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
                      className={`min-h-11 rounded-md border px-4 text-[13px] ${
                        modoResultado === opcao.valor
                          ? 'border-[#1E4D3A] bg-[#1E4D3A] font-bold text-white'
                          : 'border-[#C9D3CD] bg-white text-ink'
                      }`}
                    >
                      {opcao.rotulo}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-[#5E6863]">
                  {modoResultado === 'grupo' && 'O valor ofertado é preenchido uma vez, já total, no card do grupo.'}
                  {modoResultado === 'item' && 'O valor ofertado é preenchido por item (preço unitário).'}
                  {modoResultado === 'grupo_e_item' &&
                    'O grupo recebe a posição e o valor total; cada item recebe o valor unitário.'}
                </span>
              </div>
            )}
          </div>

          {/* Ação pendente + prazo: transformam a tela em acompanhamento. */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[18px] rounded-lg border border-[#F0D9AE] bg-[#FFF8EC] p-[18px]">
            <label className="flex flex-col gap-1.5">
              <span className={`${CLASSE_ROTULO} !text-[#6B4206]`}>Ação pendente</span>
              <select
                value={form.acaoPendente ?? 'nenhuma'}
                onChange={(e) => {
                  const acao = e.target.value as AcaoPendente;
                  atualizarCampo('acaoPendente', acao);
                  if (acao === 'nenhuma') setPrazoAcaoTexto('');
                }}
                className={CLASSE_CAMPO}
              >
                {(Object.keys(ACAO_PENDENTE_LABEL) as AcaoPendente[]).map((valor) => (
                  <option key={valor} value={valor}>
                    {ACAO_PENDENTE_LABEL[valor]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={`${CLASSE_ROTULO} !text-[#6B4206]`}>
                Prazo da ação {form.acaoPendente && form.acaoPendente !== 'nenhuma' ? '*' : ''}
              </span>
              <input
                type="datetime-local"
                value={prazoAcaoTexto}
                onChange={(e) => setPrazoAcaoTexto(e.target.value)}
                disabled={!form.acaoPendente || form.acaoPendente === 'nenhuma'}
                className={CLASSE_CAMPO}
              />
            </label>
            <div className="flex flex-col justify-end">
              <span className="text-[13px] leading-snug text-[#6B4206]">
                <strong>Alerta:</strong> o prazo fica registrado na disputa e gera aviso no sino e no cartão de
                prazos do painel quando estiver vencido ou próximo.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[18px]">
            <label className="flex flex-col gap-1.5">
              <span className={CLASSE_ROTULO}>Adjudicada em {adjudicadaEmLiberada ? '*' : ''}</span>
              <input
                type="date"
                value={adjudicadaEmLiberada ? dataAdjudicacao : ''}
                onChange={(e) => setDataAdjudicacao(e.target.value)}
                disabled={!adjudicadaEmLiberada}
                className={CLASSE_CAMPO}
              />
              <span className="text-xs text-[#5E6863]">liberado quando a situação for Adjudicada ou Homologada</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={CLASSE_ROTULO}>Homologada em {homologadaEmLiberada ? '*' : ''}</span>
              <input
                type="date"
                value={homologadaEmLiberada ? dataHomologacao : ''}
                onChange={(e) => setDataHomologacao(e.target.value)}
                disabled={!homologadaEmLiberada}
                className={CLASSE_CAMPO}
              />
              <span className="text-xs text-[#5E6863]">obrigatório só quando a situação for Homologada</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={CLASSE_ROTULO}>Observação</span>
              <input
                type="text"
                value={form.observacoes}
                onChange={(e) => atualizarCampo('observacoes', e.target.value)}
                className={CLASSE_CAMPO}
              />
            </label>
          </div>

          {quantidadeEmAnalise > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#F0D9AE] bg-[#FFF8EC] px-4 py-3 text-[13px] text-[#6B4206]">
              <span>
                Com a homologação, {quantidadeEmAnalise}{' '}
                {quantidadeEmAnalise === 1 ? 'resultado ainda está' : 'resultados ainda estão'} "em análise". Converter
                "Arrematado" em "Ganho (homologado)" e "Perdido" em "Perdido (homologado)"?
              </span>
              <button
                type="button"
                onClick={converterEmAnaliseParaHomologado}
                className="min-h-11 rounded-md bg-[#1E4D3A] px-4 text-[13px] font-bold text-white"
              >
                Converter
              </button>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------------
            2. Resultado do cliente por grupo/item
           ------------------------------------------------------------------ */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-display text-lg text-[#1E4D3A]">2. Resultado do cliente por grupo/item</h2>
            <span className="text-[13px] text-[#5E6863]">como o cliente ficou em cada grupo ou item</span>
          </div>

          {!resultadoDefinitivo && (
            <p className="text-xs text-[#5E6863]">
              "Ganho (homologado)" e "Perdido (homologado)" ficam liberados quando houver a data em "Homologada em".
            </p>
          )}
          {carregandoLicitacao && <p className="font-body text-xs text-ink-soft">Carregando itens da licitação...</p>}
          {!carregandoLicitacao && linhasResultado.length === 0 && (
            <p className="font-body text-xs text-ink-soft">
              {foraDaDisputa.length > 0
                ? 'Nenhum grupo ou item está liberado para a disputa.'
                : 'Esta licitação ainda não tem itens cadastrados.'}
            </p>
          )}
          {!carregandoLicitacao && foraDaDisputa.length > 0 && (
            <div className="rounded-lg border border-brass/40 bg-brass-pale px-3 py-2 font-body text-xs text-brass">
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
                // no card do grupo. Item solto (sem grupo) nunca entra aqui.
                const tratarComoGrupo = !!bloco.grupoId && (modoResultado === 'grupo' || modoResultado === 'grupo_e_item');
                const valoresGrupo = bloco.grupoId ? valoresPorGrupo[bloco.grupoId] : undefined;
                // Itens do grupo ficam só para conferência no modo "Por
                // grupo". No modo "Grupo e item" continuam abertos para
                // preenchimento individual (pedido do Márcio, 06/10).
                const itensTravados = tratarComoGrupo && modoResultado === 'grupo';

                const totalReferenciaGrupo = bloco.linhas.reduce(
                  (soma, linha) => soma + linha.item.precoReferencia * linha.item.quantidade,
                  0,
                );
                const totalMinimoComFreteGrupo = bloco.linhas.reduce(
                  (soma, linha) => soma + linha.precoMinimoComFreteUnitario * linha.item.quantidade,
                  0,
                );
                const algumMinimoPreenchido = bloco.linhas.some((linha) => linha.precoMinimoComFreteUnitario > 0);
                const somaItens = somaItensDoBloco(bloco);

                return (
                  <div key={bloco.grupoId ?? `sem-grupo-${indiceBloco}`} className="space-y-3">
                    {bloco.grupoId && (
                      <>
                        <button
                          type="button"
                          onClick={() => alternarGrupoColapsado(bloco.grupoId!)}
                          className="flex items-center gap-1.5 text-left font-display text-sm font-semibold text-ink"
                        >
                          <span className="text-ink-soft">{colapsado ? '▸' : '▾'}</span>
                          {bloco.grupoRotulo}
                          <span className="font-body text-xs font-normal text-ink-soft">({bloco.linhas.length} itens)</span>
                        </button>

                        {tratarComoGrupo ? (
                          <CartaoResultado
                            titulo={
                              <>
                                {bloco.grupoRotulo} — Total do grupo{' '}
                                <span className="text-[13px] font-normal text-[#5E6863]">· {bloco.linhas.length} itens</span>
                              </>
                            }
                            valores={valoresGrupo ?? VALORES_VAZIOS}
                            onChange={(campo, valor) => atualizarValorGrupo(bloco.grupoId!, campo, valor)}
                            referencia={totalReferenciaGrupo}
                            minimo={algumMinimoPreenchido ? totalMinimoComFreteGrupo : null}
                            baseValor="total"
                            ofertadoAjuda={
                              modoResultado === 'grupo_e_item' && somaItens != null
                                ? `soma dos itens: ${formatarMoeda(somaItens)}`
                                : undefined
                            }
                            homologada={resultadoDefinitivo}
                          />
                        ) : (
                          <CartaoResultado
                            titulo={
                              <>
                                {bloco.grupoRotulo} — Total do grupo{' '}
                                <span className="text-[13px] font-normal text-[#5E6863]">· {bloco.linhas.length} itens</span>
                              </>
                            }
                            valores={{
                              ...VALORES_VAZIOS,
                              posicaoTexto:
                                bloco.linhas
                                  .map((linha) => valoresPorLinha[linha.chave]?.posicaoTexto)
                                  .find((texto) => texto && texto.trim() !== '') ?? '',
                              valorOfertadoTexto: somaItens != null ? numeroParaCampoDecimal(somaItens, 2) : '',
                            }}
                            onChange={() => undefined}
                            referencia={totalReferenciaGrupo}
                            minimo={algumMinimoPreenchido ? totalMinimoComFreteGrupo : null}
                            baseValor="total"
                            posicaoSomenteLeitura={
                              bloco.linhas
                                .map((linha) => valoresPorLinha[linha.chave]?.posicaoTexto)
                                .find((texto) => texto && texto.trim() !== '') ?? ''
                            }
                            ofertadoSomenteLeitura={somaItens != null ? formatarMoeda(somaItens) : '—'}
                            ofertadoAjuda="soma dos itens (valor × quantidade)"
                            homologada={resultadoDefinitivo}
                          />
                        )}
                      </>
                    )}

                    {!colapsado &&
                      bloco.linhas.map((linha) => {
                        const valores = valoresPorLinha[linha.chave] ?? VALORES_VAZIOS;
                        const descricaoExpandida = descricoesExpandidas.has(linha.chave);
                        const descricao = (
                          <>
                            <span className={`block ${descricaoExpandida ? '' : 'line-clamp-2'}`}>{linha.rotulo}</span>
                            {linha.rotulo.length > LIMITE_DESCRICAO_CURTA && (
                              <button
                                type="button"
                                onClick={() => alternarDescricaoExpandida(linha.chave)}
                                className="mt-0.5 text-xs font-semibold text-forest-deep hover:underline"
                              >
                                {descricaoExpandida ? 'ver menos' : 'ver mais'}
                              </button>
                            )}
                          </>
                        );
                        const subtitulo = `${linha.item.propostaCliente?.marca || '—'} · ${
                          linha.item.propostaCliente?.modelo || '—'
                        } · Qtd. ${formatarNumero(linha.item.quantidade)}`;

                        // Modo "Por grupo": o item é só conferência (linha
                        // compacta), como no layout aprovado.
                        if (itensTravados) {
                          return (
                            <div
                              key={linha.chave}
                              className="grid grid-cols-[minmax(220px,2fr)_repeat(3,minmax(110px,1fr))] items-center gap-3 border-t border-dashed border-[#C9D9CF] px-1 pt-3 text-[13px]"
                            >
                              <span>
                                <strong className="block font-semibold">{descricao}</strong>
                                <span className="text-[#5E6863]">{subtitulo}</span>
                              </span>
                              <span>Ref.: {linha.item.precoReferencia > 0 ? formatarMoeda(linha.item.precoReferencia) : '—'}</span>
                              <span>
                                Mín.:{' '}
                                {linha.precoMinimoComFreteUnitario > 0
                                  ? formatarMoeda(linha.precoMinimoComFreteUnitario)
                                  : '—'}
                              </span>
                              <span className="text-[#5E6863]">ofertado no grupo</span>
                            </div>
                          );
                        }

                        const posicaoDoGrupo =
                          bloco.grupoId && modoResultado === 'grupo_e_item' ? valoresGrupo?.posicaoTexto ?? '' : undefined;

                        return (
                          <CartaoResultado
                            key={linha.chave}
                            titulo={descricao}
                            subtitulo={subtitulo}
                            valores={valores}
                            onChange={(campo, valor) => atualizarValorLinha(linha.chave, campo, valor)}
                            referencia={linha.item.precoReferencia}
                            minimo={linha.precoMinimoComFreteUnitario > 0 ? linha.precoMinimoComFreteUnitario : null}
                            baseValor="unit."
                            posicaoSomenteLeitura={posicaoDoGrupo}
                            homologada={resultadoDefinitivo}
                            dentroDeGrupo={!!bloco.grupoId}
                          />
                        );
                      })}
                  </div>
                );
              })}

              {/* Resumo geral da disputa — mantido da versão anterior (não
                  consta no layout aprovado; fica ao final da seção 2). */}
              {(() => {
                const ofertadoDoBloco = (bloco: (typeof blocosVisuais)[number]): number | null => {
                  const tratarComoGrupo = !!bloco.grupoId && (modoResultado === 'grupo' || modoResultado === 'grupo_e_item');
                  if (tratarComoGrupo && bloco.grupoId) {
                    const valorGrupo = campoParaNumeroDecimal(valoresPorGrupo[bloco.grupoId]?.valorOfertadoTexto ?? '', 2);
                    if (valorGrupo != null) return valorGrupo;
                    if (modoResultado === 'grupo') return null;
                  }
                  return somaItensDoBloco(bloco);
                };
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
                let totalOfertadoGeral = 0;
                let algumPreenchido = false;
                // Mínimo (c/ frete) só dos blocos já preenchidos — para o
                // percentual comparar o que foi ofertado com o mínimo do
                // MESMO conjunto.
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
                        <span className="text-base font-semibold text-forest-deep">
                          {algumPreenchido && minimoDosPreenchidos > 0 ? formatarMoeda(minimoDosPreenchidos) : '—'}
                        </span>
                        {algumMinimoGeral && (
                          <span className="text-[11px] text-ink-soft">de {formatarMoeda(totalMinimoGeral)} no total</span>
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
                      O percentual e a diferença em R$ comparam o total ofertado com o mínimo (c/ frete) apenas dos
                      grupos/itens já preenchidos. Positivo = acima do mínimo; negativo = abaixo do mínimo.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </section>

        {erroSalvar && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-xs text-red-700">
            Não foi possível salvar: {erroSalvar}
          </div>
        )}
      </div>
    </Modal>
  );
}
