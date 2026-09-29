// src/pages/admin/disputas/DisputaFormModal.tsx
//
// Registra o resultado de uma sessão de disputa já realizada no SIGA
// Pregão.
//
// REESTRUTURADO em 28/09, a pedido do Márcio: o resultado deixou de ser um
// valor único pra disputa inteira (posição/oferta/vencedor de uma vez só)
// e virou uma tabela POR ITEM — ou por GRUPO inteiro, quando os itens
// estão agrupados (a disputa/lance no pregão acontece pelo grupo como um
// todo, não item por item; "soma total do grupo", confirmado com o
// Márcio). Alinhado 1:1 com a planilha real da Salutti (aba "Produtos",
// bloco "RESULTADO DA LICITAÇÃO" + aba "Lances por Item" pra entender o
// que "Posição" representa).
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

// Mesmo padrão de formatação BR (vírgula decimal) já usado no resto do
// sistema — substitui o <input type="number"> nativo, que corrompe
// silenciosamente valores digitados com separador de milhar.
function numeroParaCampoDecimal(valor: number | null | undefined, casas: number): string {
  if (valor == null) return '';
  const texto = valor
    .toFixed(casas)
    .replace(/0+$/, '')
    .replace(/,$|\.$/, '')
    .replace('.', ',');
  return texto === '' || texto === '-' ? '0' : texto;
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

// Uma linha da tabela de resultado: um item avulso OU um grupo inteiro
// (nunca os dois — ver disputa_itens_item_xor_grupo na migração 021).
interface LinhaResultado {
  chave: string; // itemId ou grupoId — usada como key de state/React
  itemId?: string;
  grupoId?: string;
  rotulo: string;
  itensDetalhe: ItemLicitacao[]; // 1 item (avulso) ou os itens do grupo
  // Base do % Acima do Mínimo — unitária no caso de item avulso, soma total
  // no caso de grupo (mesma unidade em que o analista digita Valor Fechado
  // pra cada tipo de linha).
  precoMinimoComFreteBase: number;
}

function construirLinhas(licitacao: Licitacao): LinhaResultado[] {
  const taxaFrete = licitacao.percentualFrete ?? 0;
  const linhas: LinhaResultado[] = [];

  licitacao.grupos.forEach((grupo) => {
    const itensDoGrupo = licitacao.itens.filter((item) => item.grupoId === grupo.id);
    const precoMinimoComFreteBase = itensDoGrupo.reduce((soma, item) => {
      const analise = calcularAnaliseItem(item, taxaFrete, true);
      return soma + (analise.valorTotal ?? 0);
    }, 0);
    linhas.push({
      chave: grupo.id,
      grupoId: grupo.id,
      rotulo: grupo.nome?.trim() ? grupo.nome : `Grupo ${grupo.numero}`,
      itensDetalhe: itensDoGrupo,
      precoMinimoComFreteBase,
    });
  });

  licitacao.itens
    .filter((item) => !item.grupoId)
    .forEach((item) => {
      const analise = calcularAnaliseItem(item, taxaFrete, true);
      linhas.push({
        chave: item.id,
        itemId: item.id,
        rotulo: `${item.numero} — ${item.descricao}`,
        itensDetalhe: [item],
        precoMinimoComFreteBase: analise.precoComFrete ?? 0,
      });
    });

  return linhas;
}

interface ValoresLinha {
  posicaoTexto: string;
  valorFechadoTexto: string;
  totalTexto: string;
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
  const [carregandoLicitacao, setCarregandoLicitacao] = useState(false);
  const [licitacao, setLicitacao] = useState<Licitacao | null>(null);
  const [valoresPorLinha, setValoresPorLinha] = useState<Record<string, ValoresLinha>>({});
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());
  // Especificações longas (linha.rotulo do item avulso ou item.descricao
  // dentro de um grupo) começam truncadas em 2 linhas — cada uma pode ser
  // expandida individualmente com "ver mais". Chave = itemId.
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
          itens: disputaEmEdicao.itens.map(({ itemId, grupoId, posicao, valorFechado, totalFechado }) => ({
            itemId,
            grupoId,
            posicao,
            valorFechado,
            totalFechado,
          })),
        }
      : criarFormularioVazio(licitacaoId);
    setForm(inicial);

    const valores: Record<string, ValoresLinha> = {};
    (disputaEmEdicao?.itens ?? []).forEach((linha) => {
      const chave = linha.itemId ?? linha.grupoId;
      if (!chave) return;
      valores[chave] = {
        posicaoTexto: linha.posicao != null ? String(linha.posicao) : '',
        valorFechadoTexto: numeroParaCampoDecimal(linha.valorFechado, 2),
        totalTexto: numeroParaCampoDecimal(linha.totalFechado, 2),
      };
    });
    setValoresPorLinha(valores);
  }, [isOpen, disputaEmEdicao, licitacaoId]);

  const linhasResultado = useMemo(() => (licitacao ? construirLinhas(licitacao) : []), [licitacao]);

  function atualizarCampo<K extends keyof DisputaFormData>(campo: K, valor: DisputaFormData[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  function atualizarValorLinha(chave: string, campo: keyof ValoresLinha, valor: string) {
    setValoresPorLinha((atual) => ({
      ...atual,
      [chave]: {
        ...(atual[chave] ?? { posicaoTexto: '', valorFechadoTexto: '', totalTexto: '' }),
        [campo]: valor,
      },
    }));
  }

  function alternarGrupoExpandido(grupoId: string) {
    setGruposExpandidos((atual) => {
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
        const valorFechado = valores ? campoParaNumeroDecimal(valores.valorFechadoTexto, 2) : undefined;
        const totalFechado = valores ? campoParaNumeroDecimal(valores.totalTexto, 2) : undefined;
        return {
          itemId: linha.itemId,
          grupoId: linha.grupoId,
          posicao,
          valorFechado,
          totalFechado,
        };
      })
      // Só grava linha que tenha algo preenchido — não polui o banco com
      // linhas vazias pra item/grupo que o analista ainda não chegou a
      // registrar.
      .filter((linha) => linha.posicao != null || linha.valorFechado != null || linha.totalFechado != null);

    setSalvando(true);
    try {
      await onSave({ ...form, itens });
      onClose();
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
        <div className="rounded-lg border border-ink-soft/15 bg-forest-mist/30 px-4 py-3 font-body text-xs text-ink-soft">
          A sessão de disputa acontece no portal da licitação
          {licitacao?.portal ? (
            <>
              {' '}
              (<strong className="text-ink">{licitacao.portal}</strong>)
            </>
          ) : (
            ''
          )}
          . Use este formulário só para registrar o resultado final aqui no sistema, depois que a sessão
          ocorrer.
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

        {/* Resultado por item/grupo — 1 card por item avulso ou grupo
            inteiro. Posição, Valor Fechado e Total são preenchidos por
            admin/analista; só % Acima do Mínimo é calculado
            automaticamente (ver nota no topo de types/disputa.ts). */}
        <div>
          <h3 className="mb-2 font-display text-sm font-semibold text-ink">Resultado por item/grupo</h3>
          {carregandoLicitacao && <p className="font-body text-xs text-ink-soft">Carregando itens da licitação...</p>}
          {!carregandoLicitacao && linhasResultado.length === 0 && (
            <p className="font-body text-xs text-ink-soft">Esta licitação ainda não tem itens cadastrados.</p>
          )}
          {!carregandoLicitacao && linhasResultado.length > 0 && (
            <div className="space-y-3">
              {linhasResultado.map((linha) => {
                const valores = valoresPorLinha[linha.chave] ?? {
                  posicaoTexto: '',
                  valorFechadoTexto: '',
                  totalTexto: '',
                };
                const valorFechadoNumero = campoParaNumeroDecimal(valores.valorFechadoTexto, 2);
                const percentual =
                  valorFechadoNumero != null && linha.precoMinimoComFreteBase > 0
                    ? valorFechadoNumero / linha.precoMinimoComFreteBase - 1
                    : null;
                const expandido = gruposExpandidos.has(linha.chave);
                const descricaoExpandida = descricoesExpandidas.has(linha.chave);

                return (
                  <div
                    key={linha.chave}
                    className="rounded-2xl border border-ink-soft/15 bg-white p-5 font-body shadow-soft"
                  >
                    <div className="flex items-stretch gap-6">
                      {/* Item / grupo */}
                      <div className="w-[340px] shrink-0">
                        {linha.grupoId ? (
                          <button
                            type="button"
                            onClick={() => alternarGrupoExpandido(linha.chave)}
                            className="flex items-center gap-1.5 text-left font-display text-sm font-semibold text-ink"
                          >
                            <span className="text-ink-soft">{expandido ? '▾' : '▸'}</span>
                            {linha.rotulo}
                            <span className="font-body text-xs font-normal text-ink-soft">
                              ({linha.itensDetalhe.length} itens)
                            </span>
                          </button>
                        ) : (
                          <>
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
                              {linha.itensDetalhe[0]?.propostaCliente?.marca || '—'} ·{' '}
                              {linha.itensDetalhe[0]?.propostaCliente?.modelo || '—'} ·{' '}
                              Qtd. {linha.itensDetalhe[0]?.quantidade}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="w-px shrink-0 self-stretch bg-ink-soft/10" />

                      {/* Posição / Mínimo / Valor Fechado / Total / % */}
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
                            Mínimo (c/ frete)
                          </span>
                          <span className="flex items-center gap-1 rounded-lg border border-ink-soft/20 px-2.5 py-1.5">
                            {linha.precoMinimoComFreteBase > 0 ? (
                              <>
                                <span className="text-xs text-ink-soft">R$</span>
                                <span className="text-sm font-semibold text-ink">
                                  {linha.precoMinimoComFreteBase.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-ink-soft">—</span>
                            )}
                          </span>
                        </div>

                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                            Valor fechado
                          </span>
                          <span className="flex items-center gap-1 rounded-lg border border-ink-soft/20 px-2.5 py-1.5 focus-within:border-forest">
                            <span className="text-xs text-ink-soft">R$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={valores.valorFechadoTexto}
                              onChange={(e) => atualizarValorLinha(linha.chave, 'valorFechadoTexto', e.target.value)}
                              placeholder="0,00"
                              className="w-16 text-sm font-semibold text-ink focus:outline-none"
                            />
                          </span>
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                            Total
                          </span>
                          <span className="flex items-center gap-1 rounded-lg border border-ink-soft/20 px-2.5 py-1.5 focus-within:border-forest">
                            <span className="text-xs text-ink-soft">R$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={valores.totalTexto}
                              onChange={(e) => atualizarValorLinha(linha.chave, 'totalTexto', e.target.value)}
                              placeholder="0,00"
                              className="w-20 text-sm font-semibold text-ink focus:outline-none"
                            />
                          </span>
                        </label>

                        <div className="ml-auto flex flex-col gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                            % acima do mínimo
                          </span>
                          <span
                            className={`rounded-lg border px-2.5 py-1.5 text-sm font-bold ${
                              percentual == null
                                ? 'border-ink-soft/20 text-ink-soft'
                                : percentual <= 0
                                  ? 'border-forest-mist bg-forest-mist text-forest-deep'
                                  : 'border-red-100 bg-red-50 text-red-700'
                            }`}
                          >
                            {percentual != null ? `${(percentual * 100).toFixed(1)}%` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Itens dentro do grupo, quando expandido — só descrição,
                        sem campos de resultado próprios (o resultado é do
                        grupo inteiro). */}
                    {linha.grupoId && expandido && (
                      <div className="ml-6 mt-3 space-y-1.5 rounded-lg bg-paper-2/60 p-3">
                        {linha.itensDetalhe.map((item) => {
                          const rotuloItem = `${item.numero} — ${item.descricao}`;
                          const itemExpandido = descricoesExpandidas.has(item.id);
                          return (
                            <div key={item.id} className="flex items-start justify-between gap-3 text-xs">
                              <div className="flex-1">
                                <p className={itemExpandido ? 'text-ink' : 'line-clamp-2 text-ink'}>{rotuloItem}</p>
                                {rotuloItem.length > LIMITE_DESCRICAO_CURTA && (
                                  <button
                                    type="button"
                                    onClick={() => alternarDescricaoExpandida(item.id)}
                                    className="font-semibold text-forest-deep hover:underline"
                                  >
                                    {itemExpandido ? 'ver menos' : 'ver mais'}
                                  </button>
                                )}
                              </div>
                              <span className="shrink-0 whitespace-nowrap text-ink-soft">
                                {item.propostaCliente?.marca || '—'} · {item.propostaCliente?.modelo || '—'} · Qtd.{' '}
                                {item.quantidade}
                              </span>
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
      </div>
    </Modal>
  );
}
