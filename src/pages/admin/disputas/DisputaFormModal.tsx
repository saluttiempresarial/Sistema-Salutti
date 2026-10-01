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
  const semSeparadorMilhar = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
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
function construirLinhas(licitacao: Licitacao, chavesForcadas: Set<string>): LinhaResultado[] {
  const taxaFrete = licitacao.percentualFrete ?? 0;
  const linhas: LinhaResultado[] = [];

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
    licitacao.itens
      .filter((item) => item.grupoId === grupo.id)
      .forEach((item) => {
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
      linhas.push(linhaDoItem(item));
    });

  return linhas;
}

interface ValoresLinha {
  posicaoTexto: string;
  valorOfertadoTexto: string;
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
          itens: disputaEmEdicao.itens.map(({ itemId, grupoId, posicao, valorFechado }) => ({
            itemId,
            grupoId,
            posicao,
            valorFechado,
          })),
        }
      : criarFormularioVazio(licitacaoId);
    setForm(inicial);
    setErroSalvar(null);

    const valores: Record<string, ValoresLinha> = {};
    (disputaEmEdicao?.itens ?? []).forEach((linha) => {
      const chave = linha.itemId ?? linha.grupoId;
      if (!chave) return;
      valores[chave] = {
        posicaoTexto: linha.posicao != null ? String(linha.posicao) : '',
        valorOfertadoTexto: numeroParaCampoDecimal(linha.valorFechado, 2),
      };
    });
    setValoresPorLinha(valores);
  }, [isOpen, disputaEmEdicao, licitacaoId]);

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

  const linhasResultado = useMemo(
    () => (licitacao ? construirLinhas(licitacao, chavesComResultadoRegistrado) : []),
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

  function atualizarValorLinha(chave: string, campo: keyof ValoresLinha, valor: string) {
    setValoresPorLinha((atual) => ({
      ...atual,
      [chave]: {
        ...(atual[chave] ?? { posicaoTexto: '', valorOfertadoTexto: '' }),
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

  async function handleSalvar() {
    const itens: DisputaResultadoLinhaFormData[] = linhasResultado
      .map((linha) => {
        const valores = valoresPorLinha[linha.chave];
        const posicao = valores?.posicaoTexto ? Number(valores.posicaoTexto) : undefined;
        const valorFechado = valores ? campoParaNumeroDecimal(valores.valorOfertadoTexto, 2) : undefined;
        return {
          itemId: linha.itemId,
          posicao,
          valorFechado,
        };
      })
      // Só grava linha que tenha algo preenchido — não polui o banco com
      // linhas vazias pra item que o analista ainda não chegou a
      // registrar.
      .filter((linha) => linha.posicao != null || linha.valorFechado != null);

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
          </div>
        </div>

        {/* Resultado por item — um card por item, sempre (mesmo dentro de
            um grupo). Posição e Valor ofertado são preenchidos por
            admin/analista; Valor de referência e Mínimo (c/ frete) vêm
            calculados, só pra referência durante o preenchimento. */}
        <div>
          <h3 className="mb-2 font-display text-sm font-semibold text-ink">Resultado por item</h3>
          {carregandoLicitacao && <p className="font-body text-xs text-ink-soft">Carregando itens da licitação...</p>}
          {!carregandoLicitacao && linhasResultado.length === 0 && (
            <p className="font-body text-xs text-ink-soft">Esta licitação ainda não tem itens cadastrados.</p>
          )}
          {!carregandoLicitacao && linhasResultado.length > 0 && (
            <div className="space-y-4">
              {blocosVisuais.map((bloco, indiceBloco) => {
                const colapsado = bloco.grupoId ? gruposColapsados.has(bloco.grupoId) : false;
                // Soma dos "Valor ofertado" já digitados pros itens deste
                // grupo — a pedido do Márcio (30/09), pra ele acompanhar o
                // total sem precisar somar item por item. Some só o que já
                // foi preenchido; fica "—" enquanto nada tiver valor ainda.
                const valoresOfertadosGrupo = bloco.linhas.map((linha) =>
                  campoParaNumeroDecimal(valoresPorLinha[linha.chave]?.valorOfertadoTexto ?? '', 2),
                );
                const totalOfertadoGrupo = valoresOfertadosGrupo.reduce(
                  (soma: number, valor) => soma + (valor ?? 0),
                  0,
                );
                const algumOfertadoPreenchido = valoresOfertadosGrupo.some((valor) => valor != null);
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
                const posicaoGrupoTexto = bloco.linhas
                  .map((linha) => valoresPorLinha[linha.chave]?.posicaoTexto)
                  .find((texto) => texto && texto.trim() !== '');

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
                                <span className="flex items-center justify-center rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 w-14">
                                  <span className="text-sm font-semibold text-ink">
                                    {posicaoGrupoTexto || '—'}
                                  </span>
                                </span>
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
                                <span className="flex items-center rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5">
                                  <span className="text-sm font-semibold text-ink">
                                    {algumOfertadoPreenchido ? formatarMoeda(totalOfertadoGrupo) : '—'}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {!colapsado && (
                      <div className="space-y-3">
                        {bloco.linhas.map((linha) => {
                          const valores = valoresPorLinha[linha.chave] ?? {
                            posicaoTexto: '',
                            valorOfertadoTexto: '',
                          };
                          const descricaoExpandida = descricoesExpandidas.has(linha.chave);

                          return (
                            <div
                              key={linha.chave}
                              className="rounded-2xl border border-ink-soft/15 bg-white p-5 font-body shadow-soft"
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
                                    <input
                                      type="number"
                                      min={1}
                                      value={valores.posicaoTexto}
                                      onChange={(e) => atualizarValorLinha(linha.chave, 'posicaoTexto', e.target.value)}
                                      placeholder="—"
                                      className="w-14 rounded-lg border border-ink-soft/20 px-2 py-1.5 text-center text-sm font-semibold text-ink focus:border-forest focus:outline-none"
                                    />
                                  </label>

                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                      Valor de referência
                                    </span>
                                    <span className="flex items-center rounded-lg border border-ink-soft/20 px-2.5 py-1.5">
                                      <span className="text-sm font-semibold text-ink">
                                        {formatarMoeda(linha.item.precoReferencia)}
                                      </span>
                                    </span>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                      Mínimo (c/ frete)
                                    </span>
                                    <span className="flex items-center rounded-lg border border-ink-soft/20 px-2.5 py-1.5">
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
                                      Valor ofertado
                                    </span>
                                    <span className="flex items-center gap-1 rounded-lg border border-ink-soft/20 px-2.5 py-1.5 focus-within:border-forest">
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
                                  </label>
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
