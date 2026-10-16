// src/pages/admin/licitacoes/LicitacoesPage.tsx
//
// Tela principal do módulo de Licitações (/admin/licitacoes), no mesmo
// padrão de ClientesPage / FuncionariosPage: listagem com busca, filtro por
// status, paginação, e modal de formulário para criar/editar.
//
// Redesenho (15/10, a pedido do Márcio): barra de busca e filtro em cartão,
// tabela mais espaçada (data e hora em duas linhas, modalidade sob o órgão,
// ações em ícones), lista em cartões nas telas menores (sem rolagem
// horizontal) e o rodapé "Mostrando X de Y licitações". A tela também
// entende endereços vindos do painel inicial: ?busca=termo (já filtra),
// ?nova=1 (abre o cadastro) e ?editar=ID (abre a edição daquela licitação).

import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../../../context/AuthContext';
import { usePermissoes } from '../../../hooks/usePermissoes';
import { Pagination } from '../../../components/Pagination';
import { StatusPill, StatusTone } from '../../../components/StatusPill';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button } from '../../../components/Button';
import { LicitacaoFormModal } from './LicitacaoFormModal';
import { licitacaoService } from '../../../services/licitacaoService';
import { propostaPendenciasService } from '../../../services/propostaPendenciasService';
import { pendenciaDeFaltas, type PendenciaIdentificacao } from '../../../utils/propostaPendencias';
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
import { limparCacheLicitacoesInternas } from '../../../hooks/useLicitacoesInternas';
import { formatarDataCurta, formatarHora } from '../../../utils/eventosPainel';
import { IconeBusca, IconeLapis, IconeLixeira, IconeOlho } from '../../../components/icones';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const buscaDaUrl = searchParams.get('busca');
  const [busca, setBusca] = useState(buscaDaUrl ?? '');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [licitacaoEmEdicao, setLicitacaoEmEdicao] = useState<Licitacao | null>(null);
  const [carregandoEdicao, setCarregandoEdicao] = useState(false);
  const [licitacaoParaExcluir, setLicitacaoParaExcluir] = useState<Licitacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Mapa id -> nome fantasia, carregado direto do Supabase (tabela `clientes`).
  // Substituiu o antigo `mockClientesResumo` — que era uma lista fixa de
  // clientes fictícios e não continha os clientes reais cadastrados no banco
  // (ex.: a coluna "Cliente" ficava em branco para qualquer cliente real).
  const [nomesClientes, setNomesClientes] = useState<Record<string, string>>({});

  // Alerta "Falta marca/modelo" por licitação (15/10, Márcio): itens com valor
  // preenchido e sem marca e/ou modelo. Falha na consulta não bloqueia a lista.
  const [pendencias, setPendencias] = useState<Record<string, PendenciaIdentificacao>>({});

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

    try {
      const faltas = await propostaPendenciasService.faltasPorLicitacao(resultado.itens.map((l) => l.id));
      const mapa: Record<string, PendenciaIdentificacao> = {};
      resultado.itens.forEach((l) => {
        const pendencia = pendenciaDeFaltas(l, faltas[l.id] ?? []);
        if (pendencia) mapa[l.id] = pendencia;
      });
      setPendencias(mapa);
    } catch {
      setPendencias({});
    }
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

  // Vindo da busca do cabeçalho (?busca=termo): aplica o termo também quando
  // a tela já estava aberta.
  useEffect(() => {
    if (buscaDaUrl !== null) {
      setBusca(buscaDaUrl);
      setPage(1);
    }
  }, [buscaDaUrl]);

  // Vindo do painel inicial: ?nova=1 abre o cadastro e ?editar=ID abre a
  // edição daquela licitação. Só abre para quem pode editar; o parâmetro é
  // removido do endereço em seguida, para não reabrir ao recarregar.
  useEffect(() => {
    if (carregandoPermissoes) return;
    const nova = searchParams.get('nova');
    const editarId = searchParams.get('editar');
    if (!nova && !editarId) return;

    if (podeEditar) {
      if (editarId) abrirEdicaoPorId(editarId);
      else abrirNova();
    }
    const restantes = new URLSearchParams(searchParams);
    restantes.delete('nova');
    restantes.delete('editar');
    setSearchParams(restantes, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoPermissoes]);

  // Busca o registro completo (com grupos/itens/histórico) antes de abrir o
  // modal — o objeto vindo da listagem (`licitacaoService.listar()`) não traz
  // esses dados, por design (evita pesar a listagem com joins desnecessários).
  async function abrirEdicao(licitacao: Licitacao) {
    setCarregandoEdicao(true);
    setModalAberto(true);
    try {
      const completa = await licitacaoService.buscarPorId(licitacao.id);
      setLicitacaoEmEdicao(completa ?? licitacao);
    } finally {
      setCarregandoEdicao(false);
    }
  }

  async function abrirEdicaoPorId(id: string) {
    setLicitacaoEmEdicao(null);
    setCarregandoEdicao(true);
    setModalAberto(true);
    try {
      const completa = await licitacaoService.buscarPorId(id);
      if (completa) setLicitacaoEmEdicao(completa);
      else setModalAberto(false); // não achou: não abre um cadastro em branco por engano
    } catch {
      setModalAberto(false);
    } finally {
      setCarregandoEdicao(false);
    }
  }

  async function salvar(dados: LicitacaoFormData) {
    if (licitacaoEmEdicao) {
      await licitacaoService.atualizar(licitacaoEmEdicao.id, dados, usuarioAtual);
    } else {
      await licitacaoService.criar(dados, usuarioAtual);
    }
    limparCacheLicitacoesInternas();
    await carregar();
  }

  async function confirmarExclusao() {
    if (!licitacaoParaExcluir) return;
    setExcluindo(true);
    try {
      await licitacaoService.excluir(licitacaoParaExcluir.id);
      limparCacheLicitacoesInternas();
      setLicitacaoParaExcluir(null);
      await carregar();
    } finally {
      setExcluindo(false);
    }
  }

  function nomeCliente(clienteId: string): string {
    return nomesClientes[clienteId] ?? '—';
  }

  // Exporta para Excel todas as licitações que batem com a busca/filtro de
  // status atuais — não só a página visível na tabela (a listagem aqui é
  // paginada de 8 em 8). Por isso busca de novo com um pageSize alto, em vez
  // de reaproveitar `itens`.
  async function exportarExcel() {
    setExportando(true);
    try {
      const resultado = await licitacaoService.listar({
        busca,
        status: statusFiltro,
        page: 1,
        pageSize: 10000,
        ...restricaoDados,
      });

      const linhas = resultado.itens.map((licitacao) => {
        const dataReferencia = licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao;
        return {
          Pregão: licitacao.numeroPregao,
          Órgão: licitacao.orgao,
          Modalidade:
            MODALIDADE_LICITACAO_LABEL[licitacao.modalidade as ModalidadeLicitacao] ?? licitacao.modalidade,
          Cliente: nomeCliente(licitacao.clienteId),
          'Data da licitação': dataReferencia ? formatarDataHora(dataReferencia) : '—',
          Valor: licitacao.valorTotalLicitacao != null ? licitacao.valorTotalLicitacao : 'Sigiloso',
          Status: STATUS_LICITACAO_LABEL[licitacao.status],
          'Decisão do cliente': DECISAO_CLIENTE_LABEL[licitacao.decisaoCliente],
          Itens: licitacao.totalItens ?? 0,
        };
      });

      const planilha = XLSX.utils.json_to_sheet(linhas);
      planilha['!cols'] = [
        { wch: 18 }, // Pregão
        { wch: 40 }, // Órgão
        { wch: 20 }, // Modalidade
        { wch: 28 }, // Cliente
        { wch: 20 }, // Data da licitação
        { wch: 16 }, // Valor
        { wch: 14 }, // Status
        { wch: 20 }, // Decisão do cliente
        { wch: 10 }, // Itens
      ];

      const livro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(livro, planilha, 'Licitações');

      const hoje = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(livro, `licitacoes-salutti-${hoje}.xlsx`);
    } finally {
      setExportando(false);
    }
  }

  // ----- Peças reutilizadas pela tabela (telas largas) e pelos cartões (telas menores) -----

  function textoPendencia(pendencia: PendenciaIdentificacao): string {
    return pendencia.urgencia === 'travada'
      ? 'Prazo definitivo encerrado: só o Administrador consegue completar.'
      : pendencia.urgencia === 'urgente'
        ? 'O prazo do cliente está encerrando. Confira com o cliente ou complete direto na proposta.'
        : 'Marca/fabricante e modelo/versão são obrigatórios.';
  }

  function blocoItens(licitacao: Licitacao) {
    const pendencia = pendencias[licitacao.id];
    return (
      <>
        {licitacao.totalItens ? (
          `${licitacao.totalItens} ${licitacao.totalItens === 1 ? 'item' : 'itens'}`
        ) : (
          <span className="text-brass">Sem itens</span>
        )}
        {pendencia && (
          <span
            title={textoPendencia(pendencia)}
            className={`mt-1 block w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              pendencia.urgencia === 'normal' ? 'bg-brass-pale text-brass' : 'bg-red-50 text-red-700'
            }`}
          >
            ⚠ {pendencia.mensagem}
          </span>
        )}
      </>
    );
  }

  function blocoDecisao(licitacao: Licitacao) {
    return (
      <span
        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-body text-xs font-medium ${
          licitacao.decisaoCliente === 'participar'
            ? 'bg-forest-mist text-forest-deep'
            : licitacao.decisaoCliente === 'recusar'
            ? 'bg-slate-100 text-slate-600'
            : 'bg-brass-pale text-brass'
        }`}
      >
        {DECISAO_CLIENTE_LABEL[licitacao.decisaoCliente]}
      </span>
    );
  }

  function blocoData(licitacao: Licitacao) {
    const dataReferencia = licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao;
    const urgencia = classificarUrgenciaPrazo(dataReferencia);
    const sessao = new Date(dataReferencia);
    const dia = formatarDataCurta(sessao);
    const hora = formatarHora(sessao);
    return (
      <>
        <p className="font-medium text-ink">{dia}</p>
        <p
          className={`text-xs ${
            urgencia === 'vencido' ? 'font-semibold text-red-600' : urgencia === 'atencao' ? 'font-semibold text-brass' : 'text-ink-soft'
          }`}
        >
          {hora}
          {urgencia === 'vencido' && ' · ⚠ vencido'}
          {urgencia === 'atencao' && ' · ⚠ prazo próximo'}
        </p>
      </>
    );
  }

  function blocoAcoes(licitacao: Licitacao) {
    const classe =
      'inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-forest-mist hover:text-forest-deep';
    return (
      <div className="flex items-center justify-end gap-1">
        <Link
          to={`/admin/licitacoes/${licitacao.id}/proposta`}
          title="Ver proposta"
          aria-label={`Ver proposta da licitação ${licitacao.numeroPregao}`}
          className={classe}
        >
          <IconeOlho className="h-[18px] w-[18px]" />
        </Link>
        {podeEditar && (
          <>
            <button
              type="button"
              onClick={() => abrirEdicao(licitacao)}
              title="Editar licitação"
              aria-label={`Editar a licitação ${licitacao.numeroPregao}`}
              className={classe}
            >
              <IconeLapis className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setLicitacaoParaExcluir(licitacao)}
              title="Excluir licitação"
              aria-label={`Excluir a licitação ${licitacao.numeroPregao}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600/80 transition-colors hover:bg-red-50 hover:text-red-700"
            >
              <IconeLixeira className="h-[18px] w-[18px]" />
            </button>
          </>
        )}
      </div>
    );
  }

  function nomeModalidade(licitacao: Licitacao): string {
    return MODALIDADE_LICITACAO_LABEL[licitacao.modalidade as ModalidadeLicitacao] ?? licitacao.modalidade;
  }

  const controleClasse =
    'rounded-lg border border-ink-soft/20 bg-white px-3 py-2.5 font-body text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20';

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest-deep sm:text-3xl">Licitações</h1>
          <p className="font-body text-sm text-ink-soft">
            Cadastro e acompanhamento de todas as licitações em andamento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={exportarExcel} disabled={exportando}>
            {exportando ? 'Exportando...' : '⭳ Exportar Excel'}
          </Button>
          {podeEditar && <Button onClick={abrirNova}>+ Nova licitação</Button>}
        </div>
      </header>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-ink-soft/10 bg-white p-3 shadow-soft sm:flex-row">
        <div className="relative flex-1">
          <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-soft" />
          <input
            value={busca}
            onChange={(e) => {
              setPage(1);
              setBusca(e.target.value);
            }}
            placeholder="Buscar por número do pregão, órgão ou objeto..."
            aria-label="Buscar licitações"
            className={`${controleClasse} w-full pl-10`}
          />
        </div>
        <select
          value={statusFiltro}
          onChange={(e) => {
            setPage(1);
            setStatusFiltro(e.target.value);
          }}
          aria-label="Filtrar por status"
          className={`${controleClasse} sm:w-56`}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LICITACAO_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-ink-soft/10 bg-white shadow-soft">
        {carregando && (
          <p className="px-4 py-10 text-center font-body text-sm text-ink-soft">Carregando licitações...</p>
        )}

        {!carregando && itens.length === 0 && (
          <p className="px-4 py-10 text-center font-body text-sm text-ink-soft">Nenhuma licitação encontrada.</p>
        )}

        {!carregando && itens.length > 0 && (
          <>
            {/* Tabela: telas largas */}
            <div className="hidden overflow-x-auto 2xl:block">
              <table className="w-full font-body text-sm">
                <thead className="bg-paper-2/70 text-left font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-3.5">Pregão</th>
                    <th className="px-3 py-3.5">Órgão</th>
                    <th className="px-3 py-3.5">Cliente</th>
                    <th className="whitespace-nowrap px-3 py-3.5">Data da licitação</th>
                    <th className="whitespace-nowrap px-3 py-3.5">Valor</th>
                    <th className="whitespace-nowrap px-3 py-3.5">Status</th>
                    <th className="whitespace-nowrap px-3 py-3.5">Decisão do cliente</th>
                    <th className="whitespace-nowrap px-3 py-3.5">Itens</th>
                    <th className="whitespace-nowrap px-3 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-soft/10">
                  {itens.map((licitacao) => (
                    <tr key={licitacao.id} className="align-middle transition-colors hover:bg-paper-2/50">
                      <td className="whitespace-nowrap px-3 py-4 font-semibold text-ink">{licitacao.numeroPregao}</td>
                      <td className="min-w-[130px] max-w-[240px] px-3 py-4" title={licitacao.orgao}>
                        <p className="line-clamp-2 text-ink">{licitacao.orgao}</p>
                        <p className="text-xs text-ink-soft">{nomeModalidade(licitacao)}</p>
                      </td>
                      <td className="min-w-[120px] max-w-[200px] px-3 py-4 text-ink-soft" title={nomeCliente(licitacao.clienteId)}>
                        <p className="line-clamp-2">{nomeCliente(licitacao.clienteId)}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4">{blocoData(licitacao)}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-ink-soft">
                        {licitacao.valorTotalLicitacao != null ? formatarMoeda(licitacao.valorTotalLicitacao) : 'Sigiloso'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4">
                        <StatusPill label={STATUS_LICITACAO_LABEL[licitacao.status]} tone={STATUS_TONE[licitacao.status]} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-4">{blocoDecisao(licitacao)}</td>
                      <td className="min-w-[130px] px-3 py-4 text-ink-soft">{blocoItens(licitacao)}</td>
                      <td className="whitespace-nowrap px-3 py-4">{blocoAcoes(licitacao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartões: celular e tablet */}
            <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 2xl:hidden">
              {itens.map((licitacao) => (
                <li key={licitacao.id} className="rounded-xl border border-ink-soft/10 p-4 font-body text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-semibold text-ink">Nº {licitacao.numeroPregao}</p>
                    <StatusPill label={STATUS_LICITACAO_LABEL[licitacao.status]} tone={STATUS_TONE[licitacao.status]} />
                  </div>
                  <p className="mt-1 text-ink">{licitacao.orgao}</p>
                  <p className="text-xs text-ink-soft">
                    {nomeModalidade(licitacao)} · {nomeCliente(licitacao.clienteId)}
                  </p>

                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">Data da licitação</dt>
                      <dd className="mt-0.5">{blocoData(licitacao)}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">Valor</dt>
                      <dd className="mt-0.5 text-ink">
                        {licitacao.valorTotalLicitacao != null ? formatarMoeda(licitacao.valorTotalLicitacao) : 'Sigiloso'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">Itens</dt>
                      <dd className="mt-0.5 text-ink-soft">{blocoItens(licitacao)}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">Decisão do cliente</dt>
                      <dd className="mt-0.5">{blocoDecisao(licitacao)}</dd>
                    </div>
                  </dl>

                  <div className="mt-3 border-t border-ink-soft/10 pt-2">{blocoAcoes(licitacao)}</div>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="px-4">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            itemSingular="licitação"
            itemPlural="licitações"
          />
        </div>
      </div>

      <LicitacaoFormModal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSave={salvar}
        licitacaoEmEdicao={licitacaoEmEdicao}
        carregando={carregandoEdicao}
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
