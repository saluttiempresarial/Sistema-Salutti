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
import { formatarMoeda } from '../../../utils/prazoUtils';

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
}

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

    const valores: Record<string, ValoresLinha> = {};
    (disputaEmEdicao?.itens ?? []).forEach((linha) => {
      const chave = linha.itemId ?? linha.grupoId;
      if (!chave) return;
      valores[chave] = {
        posicaoTexto: linha.posicao != null ? String(linha.posicao) : '',
        valorFechadoTexto: numeroParaCampoDecimal(linha.valorFechado, 2),
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
      [chave]: { ...(atual[chave] ?? { posicaoTexto: '', valorFechadoTexto: '' }), [campo]: valor },
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

  async function handleSalvar() {
    const itens: DisputaResultadoLinhaFormData[] = linhasResultado
      .map((linha) => {
        const valores = valoresPorLinha[linha.chave];
        const posicao = valores?.posicaoTexto ? Number(valores.posicaoTexto) : undefined;
        const valorFechado = valores ? campoParaNumeroDecimal(valores.valorFechadoTexto, 2) : undefined;
        return {
          itemId: linha.itemId,
          grupoId: linha.grupoId,
          posicao,
          valorFechado,
        };
      })
      // Só grava linha que tenha algo preenchido — não polui o banco com
      // linhas vazias pra item/grupo que o analista ainda não chegou a
      // registrar.
      .filter((linha) => linha.posicao != null || linha.valorFechado != null);

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

        {/* Tabela de resultado — por item avulso ou por grupo inteiro. */}
        <div>
          <h3 className="mb-2 font-display text-sm font-semibold text-ink">Resultado por item/grupo</h3>
          {carregandoLicitacao && <p className="font-body text-xs text-ink-soft">Carregando itens da licitação...</p>}
          {!carregandoLicitacao && linhasResultado.length === 0 && (
            <p className="font-body text-xs text-ink-soft">Esta licitação ainda não tem itens cadastrados.</p>
          )}
          {!carregandoLicitacao && linhasResultado.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-ink-soft/15">
              <table className="w-full font-body text-xs">
                <thead className="bg-paper-2 text-left uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="px-3 py-2">Item / Grupo</th>
                    <th className="px-3 py-2">Valor mínimo (c/ frete)</th>
                    <th className="px-3 py-2 w-24">Posição</th>
                    <th className="px-3 py-2 w-32">Valor fechado</th>
                    <th className="px-3 py-2 w-32">Total</th>
                    <th className="px-3 py-2 w-28">% acima do mínimo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-soft/10">
                  {linhasResultado.map((linha) => {
                    const valores = valoresPorLinha[linha.chave] ?? { posicaoTexto: '', valorFechadoTexto: '' };
                    const valorFechadoNumero = campoParaNumeroDecimal(valores.valorFechadoTexto, 2);
                    const totalLinha = linha.itemId
                      ? (valorFechadoNumero ?? 0) * (linha.itensDetalhe[0]?.quantidade ?? 0)
                      : valorFechadoNumero;
                    const percentual =
                      valorFechadoNumero != null && linha.precoMinimoComFreteBase > 0
                        ? valorFechadoNumero / linha.precoMinimoComFreteBase - 1
                        : null;
                    const expandido = gruposExpandidos.has(linha.chave);

                    return (
                      <>
                        <tr key={linha.chave} className="align-top hover:bg-paper-2/50">
                          <td className="px-3 py-2">
                            {linha.grupoId ? (
                              <button
                                type="button"
                                onClick={() => alternarGrupoExpandido(linha.chave)}
                                className="flex items-center gap-1.5 font-semibold text-ink"
                              >
                                <span className="text-ink-soft">{expandido ? '▾' : '▸'}</span>
                                {linha.rotulo}
                                <span className="font-normal text-ink-soft">({linha.itensDetalhe.length} itens)</span>
                              </button>
                            ) : (
                              <div>
                                <p className="font-semibold text-ink">{linha.rotulo}</p>
                                <p className="text-ink-soft">
                                  {linha.itensDetalhe[0]?.propostaCliente?.marca || '—'} ·{' '}
                                  {linha.itensDetalhe[0]?.propostaCliente?.modelo || '—'} ·{' '}
                                  Qtd. {linha.itensDetalhe[0]?.quantidade}
                                </p>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-ink-soft">
                            {linha.precoMinimoComFreteBase > 0 ? formatarMoeda(linha.precoMinimoComFreteBase) : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={1}
                              value={valores.posicaoTexto}
                              onChange={(e) => atualizarValorLinha(linha.chave, 'posicaoTexto', e.target.value)}
                              placeholder="Ex: 1"
                              className="w-20 rounded-md border border-ink-soft/25 px-2 py-1.5 text-xs focus:border-forest focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={valores.valorFechadoTexto}
                              onChange={(e) => atualizarValorLinha(linha.chave, 'valorFechadoTexto', e.target.value)}
                              placeholder="Ex.: 1,90"
                              className="w-28 rounded-md border border-ink-soft/25 px-2 py-1.5 text-xs focus:border-forest focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-ink-soft">
                            {totalLinha != null ? formatarMoeda(totalLinha) : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {percentual != null ? (
                              <span className={percentual <= 0 ? 'font-semibold text-forest' : 'font-semibold text-red-600'}>
                                {(percentual * 100).toFixed(1)}%
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                        {linha.grupoId && expandido && (
                          <tr key={`${linha.chave}-detalhe`}>
                            <td colSpan={6} className="bg-paper-2/40 px-3 py-2">
                              <table className="w-full text-xs">
                                <tbody className="divide-y divide-ink-soft/10">
                                  {linha.itensDetalhe.map((item) => (
                                    <tr key={item.id}>
                                      <td className="py-1 pl-4 text-ink">
                                        {item.numero} — {item.descricao}
                                      </td>
                                      <td className="py-1 text-ink-soft">{item.propostaCliente?.marca || '—'}</td>
                                      <td className="py-1 text-ink-soft">{item.propostaCliente?.modelo || '—'}</td>
                                      <td className="py-1 text-ink-soft">Qtd. {item.quantidade}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <TextField
          label="Link da ata no portal da licitação"
          value={form.linkAtaSigaPregao ?? ''}
          onChange={(e) => atualizarCampo('linkAtaSigaPregao', e.target.value)}
          placeholder="https://..."
        />
      </div>
    </Modal>
  );
}
