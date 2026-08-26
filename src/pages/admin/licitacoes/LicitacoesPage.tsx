// src/pages/admin/licitacoes/LicitacoesPage.tsx
//
// Tela principal do módulo de Licitações (/admin/licitacoes), no mesmo
// padrão de ClientesPage / FuncionariosPage: listagem com busca, filtro por
// status, paginação, e modal de formulário para criar/editar.

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { usePermissoes } from '../../../hooks/usePermissoes';
import { Pagination } from '../../../components/Pagination';
import { StatusPill, StatusTone } from '../../../components/StatusPill';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button } from '../../../components/Button';
import { LicitacaoFormModal } from './LicitacaoFormModal';
import { licitacaoService } from '../../../services/licitacaoService';
import {
  Licitacao,
  LicitacaoFormData,
  StatusLicitacao,
  STATUS_LICITACAO_LABEL,
  ModalidadeLicitacao,
  MODALIDADE_LICITACAO_LABEL,
  DECISAO_CLIENTE_LABEL,
} from '../../../types/licitacao';
import { clienteService } from '../../../services/clienteService';
import { formatarDataHora, formatarMoeda, classificarUrgenciaPrazo } from '../../../utils/prazoUtils';

const STATUS_TONE: Record<StatusLicitacao, StatusTone> = {
  pendente: 'neutral',
  em_analise: 'info',
  enviado: 'warning',
  ganho: 'success',
  perdido: 'danger',
};

const PAGE_SIZE = 8;

export function LicitacoesPage() {
  const { user } = useAuth();
  const { carregando: carregandoPermissoes, restricaoDados, podeAcessarModulo } = usePermissoes();
  const usuarioAtual = user?.name ?? 'Usuário atual';
  const podeEditar = podeAcessarModulo('licitacoes', 'editar');

  const [itens, setItens] = useState<Licitacao[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [licitacaoEmEdicao, setLicitacaoEmEdicao] = useState<Licitacao | null>(null);
  const [licitacaoParaExcluir, setLicitacaoParaExcluir] = useState<Licitacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Mapa id -> nome fantasia, carregado direto do Supabase (tabela `clientes`).
  // Substituiu o antigo `mockClientesResumo` — que era uma lista fixa de
  // clientes fictícios e não continha os clientes reais cadastrados no banco
  // (ex.: a coluna "Cliente" ficava em branco para qualquer cliente real).
  const [nomesClientes, setNomesClientes] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    if (carregandoPermissoes) return;
    setCarregando(true);
    const resultado = await licitacaoService.listar({
      busca,
      status: statusFiltro,
      page,
      pageSize: PAGE_SIZE,
      ...restricaoDados,
    });
    setItens(resultado.itens);
    setTotal(resultado.total);
    setCarregando(false);
  }, [busca, statusFiltro, page, carregandoPermissoes, restricaoDados]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    let ativo = true;
    // 200 cobre a carteira inteira sem precisar de paginação aqui — mesmo
    // padrão já usado no seletor "Cliente vinculado" do LicitacaoFormModal.
    clienteService.list({ page: 1, pageSize: 200 }).then((resultado) => {
      if (!ativo) return;
      const mapa: Record<string, string> = {};
      resultado.data.forEach((c) => {
        mapa[c.id] = c.empresa.nomeFantasia;
      });
      setNomesClientes(mapa);
    });
    return () => {
      ativo = false;
    };
  }, []);

  function abrirNova() {
    setLicitacaoEmEdicao(null);
    setModalAberto(true);
  }

  function abrirEdicao(licitacao: Licitacao) {
    setLicitacaoEmEdicao(licitacao);
    setModalAberto(true);
  }

  async function salvar(dados: LicitacaoFormData) {
    if (licitacaoEmEdicao) {
      await licitacaoService.atualizar(licitacaoEmEdicao.id, dados, usuarioAtual);
    } else {
      await licitacaoService.criar(dados, usuarioAtual);
    }
    await carregar();
  }

  async function confirmarExclusao() {
    if (!licitacaoParaExcluir) return;
    setExcluindo(true);
    try {
      await licitacaoService.excluir(licitacaoParaExcluir.id);
      setLicitacaoParaExcluir(null);
      await carregar();
    } finally {
      setExcluindo(false);
    }
  }

  function nomeCliente(clienteId: string): string {
    return nomesClientes[clienteId] ?? '—';
  }

  return (
    <div className="min-h-screen bg-paper p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Licitações</h1>
          <p className="font-body text-sm text-ink-soft">
            Cadastro e acompanhamento de todas as licitações em andamento.
          </p>
        </div>
        {podeEditar && <Button onClick={abrirNova}>+ Nova licitação</Button>}
      </header>

      <div className="mb-4 flex gap-3 font-body text-sm">
        <input
          value={busca}
          onChange={(e) => {
            setPage(1);
            setBusca(e.target.value);
          }}
          placeholder="Buscar por número do pregão, órgão ou objeto..."
          className="flex-1 rounded-md border border-charcoal-3/20 bg-white px-3 py-2 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        />
        <select
          value={statusFiltro}
          onChange={(e) => {
            setPage(1);
            setStatusFiltro(e.target.value);
          }}
          className="rounded-md border border-charcoal-3/20 bg-white px-3 py-2 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LICITACAO_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-charcoal-3/10 bg-white shadow-soft">
        <table className="w-full font-body text-sm">
          <thead className="bg-paper-2 text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-4 py-3">Pregão</th>
              <th className="px-4 py-3">Órgão</th>
              <th className="px-4 py-3">Modalidade</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Data da licitação</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Decisão do cliente</th>
              {podeEditar && <th className="px-4 py-3 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-3/10">
            {carregando && (
              <tr>
                <td colSpan={podeEditar ? 9 : 8} className="px-4 py-8 text-center text-ink-soft">
                  Carregando licitações...
                </td>
              </tr>
            )}

            {!carregando && itens.length === 0 && (
              <tr>
                <td colSpan={podeEditar ? 9 : 8} className="px-4 py-8 text-center text-ink-soft">
                  Nenhuma licitação encontrada.
                </td>
              </tr>
            )}

            {!carregando &&
              itens.map((licitacao) => {
                const dataReferencia = licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao;
                const urgencia = classificarUrgenciaPrazo(dataReferencia);

                return (
                  <tr key={licitacao.id} className="hover:bg-paper-2/60">
                    <td className="px-4 py-3 font-medium text-ink">{licitacao.numeroPregao}</td>
                    <td className="px-4 py-3 text-ink-soft">{licitacao.orgao}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {MODALIDADE_LICITACAO_LABEL[licitacao.modalidade as ModalidadeLicitacao] ?? licitacao.modalidade}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{nomeCliente(licitacao.clienteId)}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {formatarDataHora(dataReferencia)}
                      {urgencia === 'vencido' && (
                        <span className="ml-2 text-xs font-medium text-red-600">⚠ vencido</span>
                      )}
                      {urgencia === 'atencao' && (
                        <span className="ml-2 text-xs font-medium text-brass">⚠ prazo próximo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {licitacao.valorTotalLicitacao != null ? formatarMoeda(licitacao.valorTotalLicitacao) : 'Sigiloso'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill label={STATUS_LICITACAO_LABEL[licitacao.status]} tone={STATUS_TONE[licitacao.status]} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 font-body text-xs ${
                          licitacao.decisaoCliente === 'participar'
                            ? 'bg-forest-mist text-forest-deep'
                            : licitacao.decisaoCliente === 'recusar'
                            ? 'bg-charcoal-3/10 text-ink-soft'
                            : 'bg-brass-pale text-brass'
                        }`}
                      >
                        {DECISAO_CLIENTE_LABEL[licitacao.decisaoCliente]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(licitacao)}
                        className="mr-3 text-forest-deep hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setLicitacaoParaExcluir(licitacao)}
                        className="text-red-600 hover:underline"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      <LicitacaoFormModal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSave={salvar}
        licitacaoEmEdicao={licitacaoEmEdicao}
      />

      <ConfirmDialog
        open={!!licitacaoParaExcluir}
        title="Excluir licitação"
        description={`Tem certeza que deseja excluir a licitação "${licitacaoParaExcluir?.numeroPregao}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        isLoading={excluindo}
        onConfirm={confirmarExclusao}
        onCancel={() => setLicitacaoParaExcluir(null)}
      />
    </div>
  );
}
