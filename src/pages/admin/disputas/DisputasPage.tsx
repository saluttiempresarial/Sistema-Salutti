// src/pages/admin/disputas/DisputasPage.tsx
//
// Tela de Disputas (/admin/disputas). Lista o resultado de cada disputa já
// registrada, com destaque visual para ganhos/perdas e link direto para a
// ata no SIGA Pregão, quando informado.
//
// REESTRUTURADO em 28/09: o resultado deixou de ser um valor único pra
// disputa inteira (Nossa oferta/Valor vencedor/Vencedor) e virou uma
// tabela por item/grupo dentro do DisputaFormModal — essas colunas somem
// daqui e entram "Itens com resultado" (quantos itens/grupos já têm
// Posição/Valor Fechado preenchido) como resumo rápido na listagem.
//
// AJUSTADO em 26/10/2026: a lista virou painel de ACOMPANHAMENTO. Mostra a
// "Situação do processo" (com o selo provisório/definitivo embaixo) e a "Ação
// pendente" com o prazo — vencido em vermelho, próximo (até 24 h) em âmbar.
// Quem tem ação pendente aparece primeiro, pelo prazo mais próximo.

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { usePermissoes } from '../../../hooks/usePermissoes';
import { StatusPill, StatusTone } from '../../../components/StatusPill';
import { DisputaFormModal } from './DisputaFormModal';
import { disputaService } from '../../../services/disputaService';
import { licitacaoService } from '../../../services/licitacaoService';
import {
  Disputa,
  DisputaFormData,
  ResultadoDisputa,
  RESULTADO_DISPUTA_LABEL,
  SITUACAO_PROCESSO_LABEL,
  ACAO_PENDENTE_LABEL,
  situacaoDaDisputa,
} from '../../../types/disputa';
import { Licitacao } from '../../../types/licitacao';
import { formatarDataHora } from '../../../utils/prazoUtils';

const RESULTADO_TONE: Record<ResultadoDisputa, StatusTone> = {
  em_andamento: 'neutral',
  ganho: 'success',
  perdido: 'danger',
  homologado: 'success',
};

type SituacaoProcessoTipo = NonNullable<Disputa['situacaoProcesso']>;

// Tom do selo da situação do processo: andamento = neutro/azul; adjudicada e
// homologada = verde; encerradas sem vencedor = vermelho; suspensa = âmbar.
const SITUACAO_PROCESSO_TONE: Record<SituacaoProcessoTipo, StatusTone> = {
  em_julgamento: 'info',
  em_habilitacao: 'info',
  em_fase_recursal: 'info',
  adjudicada: 'success',
  homologada: 'success',
  suspensa: 'warning',
  deserta: 'danger',
  fracassada: 'danger',
  revogada: 'danger',
  anulada: 'danger',
};

/** Situação do processo da disputa; as antigas (sem o campo) deduzem pela
 *  data de homologação. */
function situacaoDoProcesso(d: Disputa): SituacaoProcessoTipo {
  return d.situacaoProcesso ?? (d.homologadoEm ? 'homologada' : 'em_julgamento');
}

function temAcaoPendente(d: Disputa): boolean {
  return !!d.acaoPendente && d.acaoPendente !== 'nenhuma';
}

/** Urgência do prazo da ação: vencido, próximo (até 24 h) ou normal. */
function urgenciaDoPrazo(prazoIso?: string): 'vencido' | 'proximo' | 'normal' | null {
  if (!prazoIso) return null;
  const prazo = new Date(prazoIso).getTime();
  if (isNaN(prazo)) return null;
  const agora = Date.now();
  if (prazo < agora) return 'vencido';
  if (prazo - agora <= 24 * 60 * 60 * 1000) return 'proximo';
  return 'normal';
}

export function DisputasPage() {
  const { user } = useAuth();
  const { carregando: carregandoPermissoes, restricaoDados, podeAcessarModulo } = usePermissoes();
  const usuarioAtual = user?.name ?? 'Usuário atual';
  const podeEditar = podeAcessarModulo('disputas', 'editar');

  const [disputas, setDisputas] = useState<Disputa[]>([]);
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroResultado, setFiltroResultado] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');
  // 30/09, a pedido do Márcio: um erro no carregamento (ex.: falha de
  // permissão/consulta no Supabase) deixava a tela travada em "Carregando
  // disputas..." pra sempre, porque setCarregando(false) só rodava no
  // caminho de sucesso. Agora sempre desliga o carregando e mostra o erro.
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [disputaEmEdicao, setDisputaEmEdicao] = useState<Disputa | null>(null);
  const [licitacaoSelecionada, setLicitacaoSelecionada] = useState<Licitacao | null>(null);

  const carregar = useCallback(async () => {
    if (carregandoPermissoes) return;
    setCarregando(true);
    setErroCarregar(null);
    try {
      const [todasDisputas, resultadoLicitacoes] = await Promise.all([
        disputaService.listarTodas(),
        licitacaoService.listar({ pageSize: 1000, ...restricaoDados }),
      ]);
      // Licitações já vêm filtradas pela permissão — restringe as disputas às
      // que pertencem a uma dessas licitações (evita expor disputa de um
      // cliente fora da carteira do funcionário).
      const idsLicitacoesPermitidas = new Set(resultadoLicitacoes.itens.map((l) => l.id));
      setDisputas(todasDisputas.filter((d) => idsLicitacoesPermitidas.has(d.licitacaoId)));
      setLicitacoes(resultadoLicitacoes.itens);
    } catch (erro) {
      setErroCarregar(erro instanceof Error ? erro.message : 'Erro desconhecido ao carregar as disputas.');
    } finally {
      setCarregando(false);
    }
  }, [carregandoPermissoes, restricaoDados]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const licitacaoPorId = useMemo(() => {
    const mapa = new Map<string, Licitacao>();
    licitacoes.forEach((l) => mapa.set(l.id, l));
    return mapa;
  }, [licitacoes]);

  // Licitações que ainda não têm disputa registrada — candidatas a "nova disputa"
  const licitacoesSemDisputa = useMemo(() => {
    const idsComDisputa = new Set(disputas.map((d) => d.licitacaoId));
    // Antes checava l.status !== 'pendente' — mas "status" (Pendente/Em
    // Análise/Enviado/Ganho/Perdido) é um campo separado, editado
    // manualmente pelo admin/analista, e não muda sozinho quando o
    // cliente confirma participação. Quem realmente indica "o cliente
    // topou, essa licitação vai a disputa" é decisaoCliente (setado por
    // registrar_decisao_cliente quando o cliente clica "Quero
    // Participar") — corrigido em 29/09 depois de uma licitação com
    // sessão já realizada não aparecer pra registrar disputa porque
    // "status" nunca tinha saído de "pendente".
    return licitacoes.filter((l) => !idsComDisputa.has(l.id) && l.decisaoCliente === 'participar');
  }, [disputas, licitacoes]);

  const disputasFiltradas = useMemo(() => {
    const filtradas = disputas.filter(
      (d) =>
        (!filtroResultado || d.resultado === filtroResultado) &&
        (!filtroSituacao || situacaoDoProcesso(d) === filtroSituacao) &&
        (!filtroAcao || (filtroAcao === 'com_acao' ? temAcaoPendente(d) : !temAcaoPendente(d))),
    );
    // Quem tem ação pendente vem primeiro, pelo prazo mais próximo; o restante
    // mantém a ordem original (mais recentemente atualizadas primeiro).
    return [...filtradas].sort((a, b) => {
      const aAcao = temAcaoPendente(a);
      const bAcao = temAcaoPendente(b);
      if (aAcao !== bAcao) return aAcao ? -1 : 1;
      if (!aAcao) return 0;
      const aPrazo = a.prazoAcao ? new Date(a.prazoAcao).getTime() : Number.MAX_SAFE_INTEGER;
      const bPrazo = b.prazoAcao ? new Date(b.prazoAcao).getTime() : Number.MAX_SAFE_INTEGER;
      return aPrazo - bPrazo;
    });
  }, [disputas, filtroResultado, filtroSituacao, filtroAcao]);

  function abrirNova(licitacao: Licitacao) {
    setLicitacaoSelecionada(licitacao);
    setDisputaEmEdicao(null);
    setModalAberto(true);
  }

  function abrirEdicao(disputa: Disputa) {
    const licitacao = licitacaoPorId.get(disputa.licitacaoId);
    if (!licitacao) return;
    setLicitacaoSelecionada(licitacao);
    setDisputaEmEdicao(disputa);
    setModalAberto(true);
  }

  async function salvar(dados: DisputaFormData) {
    if (disputaEmEdicao) {
      await disputaService.atualizar(disputaEmEdicao.id, dados, usuarioAtual);
    } else {
      await disputaService.criar(dados, usuarioAtual);
    }
    await carregar();
  }

  return (
    <div className="min-h-screen bg-paper p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Disputas</h1>
        </div>
        {podeEditar && licitacoesSemDisputa.length > 0 && (
          <select
            onChange={(e) => {
              const licitacao = licitacoesSemDisputa.find((l) => l.id === e.target.value);
              if (licitacao) abrirNova(licitacao);
              e.target.value = '';
            }}
            defaultValue=""
            className="rounded-md bg-forest px-4 py-2.5 font-body text-sm font-medium text-paper shadow-soft"
          >
            <option value="" disabled className="bg-white text-ink-soft">
              + Registrar disputa para...
            </option>
            {licitacoesSemDisputa.map((l) => (
              <option key={l.id} value={l.id} className="bg-white text-ink">
                {l.numeroPregao} — {l.orgao}
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="mb-4 font-body text-sm">
        <select
          value={filtroResultado}
          onChange={(e) => setFiltroResultado(e.target.value)}
          className="rounded-md border border-charcoal-3/20 bg-white px-3 py-2 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        >
          <option value="">Todos os resultados</option>
          {Object.entries(RESULTADO_DISPUTA_LABEL)
            .filter(([value]) => value !== 'homologado')
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
        <select
          value={filtroSituacao}
          onChange={(e) => setFiltroSituacao(e.target.value)}
          className="ml-3 rounded-md border border-charcoal-3/20 bg-white px-3 py-2 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        >
          <option value="">Todas as situações do processo</option>
          {Object.entries(SITUACAO_PROCESSO_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={filtroAcao}
          onChange={(e) => setFiltroAcao(e.target.value)}
          className="ml-3 rounded-md border border-charcoal-3/20 bg-white px-3 py-2 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        >
          <option value="">Todas as ações</option>
          <option value="com_acao">Com ação pendente</option>
          <option value="sem_acao">Sem ação pendente</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-charcoal-3/10 bg-white shadow-soft">
        <table className="w-full font-body text-sm">
          <thead className="bg-paper-2 text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-4 py-3">Licitação</th>
              <th className="px-4 py-3">Sessão realizada</th>
              <th className="px-4 py-3">Itens com resultado</th>
              <th className="px-4 py-3">Situação do processo</th>
              <th className="px-4 py-3">Ação pendente</th>
              <th className="px-4 py-3">Resultado</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-3/10">
            {carregando && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-soft">
                  Carregando disputas...
                </td>
              </tr>
            )}
            {!carregando && erroCarregar && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-red-700">
                  Não foi possível carregar as disputas: {erroCarregar}
                </td>
              </tr>
            )}
            {!carregando && !erroCarregar && disputasFiltradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-soft">
                  Nenhuma disputa registrada ainda.
                </td>
              </tr>
            )}
            {!carregando &&
              disputasFiltradas.map((disputa) => {
                const licitacao = licitacaoPorId.get(disputa.licitacaoId);
                return (
                  <tr key={disputa.id} className="hover:bg-paper-2/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{licitacao?.numeroPregao ?? '—'}</p>
                      <p className="text-xs text-ink-soft">{licitacao?.orgao}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {disputa.dataSessaoRealizada ? formatarDataHora(disputa.dataSessaoRealizada) : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {disputa.itens.length > 0
                        ? `${disputa.itens.length} ${disputa.itens.length === 1 ? 'registrado' : 'registrados'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        label={SITUACAO_PROCESSO_LABEL[situacaoDoProcesso(disputa)]}
                        tone={SITUACAO_PROCESSO_TONE[situacaoDoProcesso(disputa)]}
                      />
                      <p className="mt-1 text-xs text-ink-soft">
                        {situacaoDaDisputa(disputa) === 'definitiva'
                          ? `Definitivo — homologada em ${new Date(disputa.homologadoEm as string).toLocaleDateString('pt-BR')}`
                          : 'Resultado provisório'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {temAcaoPendente(disputa) ? (
                        <>
                          <p className="font-medium text-ink">{ACAO_PENDENTE_LABEL[disputa.acaoPendente!]}</p>
                          {disputa.prazoAcao && (
                            <p
                              className={`text-xs ${
                                urgenciaDoPrazo(disputa.prazoAcao) === 'vencido'
                                  ? 'font-semibold text-red-700'
                                  : urgenciaDoPrazo(disputa.prazoAcao) === 'proximo'
                                    ? 'font-semibold text-brass'
                                    : 'text-ink-soft'
                              }`}
                            >
                              {urgenciaDoPrazo(disputa.prazoAcao) === 'vencido' ? 'Vencido em ' : 'Prazo: '}
                              {formatarDataHora(disputa.prazoAcao)}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        label={RESULTADO_DISPUTA_LABEL[disputa.resultado]}
                        tone={RESULTADO_TONE[disputa.resultado]}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {disputa.linkAtaSigaPregao && (
                        <a
                          href={disputa.linkAtaSigaPregao}
                          target="_blank"
                          rel="noreferrer"
                          className="mr-3 text-forest-deep hover:underline"
                        >
                          Ver ata ↗
                        </a>
                      )}
                      {podeEditar && (
                        <button
                          type="button"
                          onClick={() => abrirEdicao(disputa)}
                          className="text-forest-deep hover:underline"
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {licitacaoSelecionada && (
        <DisputaFormModal
          isOpen={modalAberto}
          onClose={() => setModalAberto(false)}
          onSave={salvar}
          licitacaoId={licitacaoSelecionada.id}
          numeroPregaoReferencia={licitacaoSelecionada.numeroPregao}
          disputaEmEdicao={disputaEmEdicao}
        />
      )}
    </div>
  );
}
