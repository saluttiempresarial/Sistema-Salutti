// src/pages/admin/licitacoes/LicitacaoFormModal.tsx
//
// Formulário de criação/edição de Licitação — reconstruído a partir da
// Especificação Funcional v2.1, seção 4.2, em 5 abas:
//   1. Informações Gerais
//   2. Habilitação
//   3. Condições Comerciais
//   4. Pontos de Atenção
//   5. Itens
//
// O campo "Cliente vinculado" e "Status" não fazem parte de nenhuma das 5
// abas descritas na spec, mas são necessários para o fluxo de atribuição de
// licitações a clientes (seção 2.1/6.1) — foram colocados na Aba 1.
//
// Usa os componentes genéricos do projeto (Modal, Tabs, TextField,
// SelectField, TextAreaField, CheckboxField, Button).
//
// PROP "carregando": true enquanto a página busca o registro completo
// (grupos/itens) via licitacaoService.buscarPorId() antes de abrir em modo
// edição — a listagem não traz esses dados, por design. Mostra um estado
// simples de carregamento no lugar do formulário enquanto isso acontece.

import { useEffect, useState } from 'react';
import { Modal } from '../../../components/Modal';
import { Tabs } from '../../../components/Tabs';
import { TextField } from '../../../components/TextField';
import { SelectField } from '../../../components/SelectField';
import { TextAreaField } from '../../../components/TextAreaField';
import { CheckboxField } from '../../../components/CheckboxField';
import { Button } from '../../../components/Button';
import {
  Licitacao,
  LicitacaoFormData,
  StatusLicitacao,
  STATUS_LICITACAO_LABEL,
  FormaPagamento,
  FORMA_PAGAMENTO_LABEL,
  ModalidadeLicitacao,
  MODALIDADE_LICITACAO_LABEL,
  Habilitacao,
  CondicoesComerciais,
  ItemLicitacao,
  GrupoItens,
  DECISAO_CLIENTE_LABEL,
} from '../../../types/licitacao';
import { clienteService } from '../../../services/clienteService';
import { calcularPrazoInterno, formatarDataHora, formatarMoeda, classificarUrgenciaPrazo } from '../../../utils/prazoUtils';
import { totalReferenciaItem, totalReferenciaGrupo, totalReferenciaOportunidade } from '../../../utils/licitacaoCalculos';

const TABS = [
  { id: 'gerais', label: 'Informações Gerais' },
  { id: 'habilitacao', label: 'Habilitação' },
  { id: 'comerciais', label: 'Cond. Comerciais' },
  { id: 'atencao', label: 'Pontos de Atenção' },
  { id: 'itens', label: 'Itens' },
];

function gerarIdLocal(prefixo: string): string {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Converte um ISO string (UTC, como salvo no banco/estado) para o formato
 *  "AAAA-MM-DDTHH:mm" que o input datetime-local espera, respeitando o
 *  fuso horário LOCAL do navegador — ao contrário de um slice() direto no
 *  ISO (que pega a hora em UTC e "engana" o campo, fazendo 09:30 local
 *  aparecer como 12:30 depois de salvo, no fuso do Brasil UTC-3). */
function paraInputDatetimeLocal(isoString?: string): string {
  if (!isoString) return '';
  const data = new Date(isoString);
  if (Number.isNaN(data.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

function criarFormularioVazio(): LicitacaoFormData {
  return {
    dataLicitacao: '',
    portal: '',
    objeto: '',
    numeroPregao: '',
    orgao: '',
    estado: '',
    municipio: '',
    distanciaMatriz: '',
    modalidade: '',
    formaDisputa: '',
    modoDisputa: '',
    participacao: '',
    capag: '',
    restricoesMeEpp: '',
    linkEdital: '',
    nomeArquivoEdital: '',
    valorTotalLicitacao: undefined,

    clienteId: '',
    status: 'pendente',

    habilitacao: {
      exigeAtestado: '',
      qualificacaoTecnica: '',
      qualificacaoEconomicoFinanceira: '',
      regularidadeFiscal: '',
      exigeAmostras: '',
      outrosRequisitos: '',
    },

    condicoesComerciais: {
      intervaloLances: '',
      formaPagamento: 'credito_conta',
      recebimentoBanco: '',
      possuiGarantias: false,
      localEntrega: '',
    },

    pontosAtencao: '',

    grupos: [],
    itens: [],

    decisaoCliente: 'pendente',
    cobrarFrete: false,
    statusProposta: 'rascunho',

    observacoes: '',
  };
}

interface LicitacaoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: LicitacaoFormData) => Promise<void>;
  licitacaoEmEdicao?: Licitacao | null;
  /** true enquanto a página está buscando o registro completo (grupos/itens)
   *  antes de abrir em modo edição — mostra um estado de carregamento no
   *  lugar do formulário. Opcional: se omitida, o formulário renderiza
   *  normalmente assim que `licitacaoEmEdicao` chegar. */
  carregando?: boolean;
}

export function LicitacaoFormModal({ isOpen, onClose, onSave, licitacaoEmEdicao, carregando: carregandoDados }: LicitacaoFormModalProps) {
  const [abaAtiva, setAbaAtiva] = useState('gerais');
  const [form, setForm] = useState<LicitacaoFormData>(criarFormularioVazio());
  const [salvando, setSalvando] = useState(false);
  const [clientes, setClientes] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    if (!isOpen) return;
    setAbaAtiva('gerais');
    setForm(licitacaoEmEdicao ? { ...licitacaoEmEdicao } : criarFormularioVazio());
  }, [isOpen, licitacaoEmEdicao]);

  useEffect(() => {
    if (!isOpen) return;
    let ativo = true;
    // 200 cobre a carteira inteira sem precisar de paginação aqui — a
    // lista de clientes deste seletor não costuma passar disso.
    clienteService.list({ page: 1, pageSize: 200 }).then((resultado) => {
      if (!ativo) return;
      setClientes(resultado.data.map((c) => ({ value: c.id, label: c.empresa.nomeFantasia })));
    });
    return () => {
      ativo = false;
    };
  }, [isOpen]);

  function atualizarCampo<K extends keyof LicitacaoFormData>(campo: K, valor: LicitacaoFormData[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  function atualizarHabilitacao<K extends keyof Habilitacao>(campo: K, valor: Habilitacao[K]) {
    setForm((atual) => ({ ...atual, habilitacao: { ...atual.habilitacao, [campo]: valor } }));
  }

  function atualizarCondicoes<K extends keyof CondicoesComerciais>(campo: K, valor: CondicoesComerciais[K]) {
    setForm((atual) => ({ ...atual, condicoesComerciais: { ...atual.condicoesComerciais, [campo]: valor } }));
  }

  // --- Aba 5 — Itens: grupos e itens ------------------------------------

  function adicionarGrupo() {
    const numero = String(form.grupos.length + 1);
    const novoGrupo: GrupoItens = { id: gerarIdLocal('grp'), numero, nome: `Grupo ${numero}` };
    setForm((atual) => ({ ...atual, grupos: [...atual.grupos, novoGrupo] }));
  }

  function renumerarGrupo(id: string, numero: string) {
    setForm((atual) => ({
      ...atual,
      grupos: atual.grupos.map((g) => (g.id === id ? { ...g, numero } : g)),
    }));
  }

  function renomearGrupo(id: string, nome: string) {
    setForm((atual) => ({
      ...atual,
      grupos: atual.grupos.map((g) => (g.id === id ? { ...g, nome } : g)),
    }));
  }

  function removerGrupo(id: string) {
    // Remove o grupo e os itens que pertenciam a ele — para manter um item
    // órfão, seria preciso "desvincular" antes de excluir o grupo.
    setForm((atual) => ({
      ...atual,
      grupos: atual.grupos.filter((g) => g.id !== id),
      itens: atual.itens.filter((i) => i.grupoId !== id),
    }));
  }

  function adicionarItem(grupoId?: string) {
    const novoItem: ItemLicitacao = {
      id: gerarIdLocal('item'),
      grupoId,
      numero: '',
      descricao: '',
      unidadeMedida: '',
      quantidade: 1,
      precoReferencia: 0,
      exclusivoMeEpp: false,
    };
    setForm((atual) => ({ ...atual, itens: [...atual.itens, novoItem] }));
  }

  function atualizarItem<K extends keyof ItemLicitacao>(id: string, campo: K, valor: ItemLicitacao[K]) {
    setForm((atual) => ({
      ...atual,
      itens: atual.itens.map((item) => (item.id === id ? { ...item, [campo]: valor } : item)),
    }));
  }

  function removerItem(id: string) {
    setForm((atual) => ({ ...atual, itens: atual.itens.filter((i) => i.id !== id) }));
  }

  async function handleSalvar() {
    setSalvando(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  const dataParaPrazo = form.dataEfetivaLicitacao || form.dataLicitacao;
  const prazoInterno = dataParaPrazo ? calcularPrazoInterno(dataParaPrazo) : null;
  const urgencia = dataParaPrazo ? classificarUrgenciaPrazo(dataParaPrazo) : null;

  const itensIndividuais = form.itens.filter((i) => !i.grupoId);
  const totalOportunidade = totalReferenciaOportunidade(form.itens);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={licitacaoEmEdicao ? `Editar licitação — ${licitacaoEmEdicao.numeroPregao}` : 'Nova licitação'}
      size="xl"
      footer={
        carregandoDados ? undefined : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar licitação'}
            </Button>
          </>
        )
      }
    >
      {carregandoDados ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <p className="font-body text-sm text-ink-soft">Carregando dados da licitação...</p>
        </div>
      ) : (
        <>
          <Tabs tabs={TABS} activeTab={abaAtiva} onChange={setAbaAtiva} />

          <div className="mt-5 min-h-[320px]">
        {/* Aba 1 — Informações Gerais */}
        {abaAtiva === 'gerais' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Data e horário da licitação *"
                required
                type="datetime-local"
                value={paraInputDatetimeLocal(form.dataLicitacao)}
                onChange={(e) =>
                  atualizarCampo(
                    'dataLicitacao',
                    e.target.value ? new Date(e.target.value).toISOString() : ''
                  )
                }
              />
              <TextField
                label="Data efetiva (se suspensa e remarcada)"
                type="datetime-local"
                value={paraInputDatetimeLocal(form.dataEfetivaLicitacao)}
                onChange={(e) =>
                  atualizarCampo('dataEfetivaLicitacao', e.target.value ? new Date(e.target.value).toISOString() : undefined)
                }
              />
            </div>

            {prazoInterno && (
              <div
                className={`rounded-lg border px-4 py-3 font-body text-sm ${
                  urgencia === 'vencido'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : urgencia === 'atencao'
                    ? 'border-brass/40 bg-brass-pale text-brass'
                    : 'border-forest/30 bg-forest-mist text-forest-deep'
                }`}
              >
                <strong>Limite de retorno do cliente (automático):</strong> {formatarDataHora(prazoInterno.toISOString())}
                {urgencia === 'vencido' && ' — já vencido!'}
                {urgencia === 'atencao' && ' — atenção, prazo próximo!'}
                {licitacaoEmEdicao && (
                  <span className="ml-1 text-xs opacity-80">
                    (cadastrada em {formatarDataHora(licitacaoEmEdicao.criadoEm)})
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Portal *"
                required
                value={form.portal}
                onChange={(e) => atualizarCampo('portal', e.target.value)}
                placeholder="Ex: ComprasNet, BEC, Licitações-e"
              />
              <TextField
                label="Número do pregão *"
                required
                value={form.numeroPregao}
                onChange={(e) => atualizarCampo('numeroPregao', e.target.value)}
                placeholder="Ex: PE 045/2026"
              />
              <TextField
                label="Órgão *"
                required
                value={form.orgao}
                onChange={(e) => atualizarCampo('orgao', e.target.value)}
                placeholder="Ex: Prefeitura Municipal de..."
              />
              <div className="col-span-2">
                <TextAreaField
                  label="Objeto da licitação"
                  value={form.objeto}
                  onChange={(e) => atualizarCampo('objeto', e.target.value)}
                  rows={2}
                  placeholder="Descreva o objeto desta licitação"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Estado (UF) *"
                  required
                  maxLength={2}
                  value={form.estado}
                  onChange={(e) => atualizarCampo('estado', e.target.value.toUpperCase())}
                  placeholder="SP"
                />
                <TextField
                  label="Município *"
                  required
                  value={form.municipio}
                  onChange={(e) => atualizarCampo('municipio', e.target.value)}
                />
              </div>
              <TextField
                label="Distância da matriz"
                value={form.distanciaMatriz}
                onChange={(e) => atualizarCampo('distanciaMatriz', e.target.value)}
                placeholder="Ex: 120km ou cerca de 2h de viagem"
              />
              <SelectField
                label="Modalidade *"
                required
                value={form.modalidade}
                onChange={(e) => atualizarCampo('modalidade', e.target.value as ModalidadeLicitacao)}
                placeholder="Selecione"
                options={Object.entries(MODALIDADE_LICITACAO_LABEL).map(([value, label]) => ({ value, label }))}
              />
              <SelectField
                label="Forma de disputa"
                value={form.formaDisputa}
                onChange={(e) => atualizarCampo('formaDisputa', e.target.value)}
                placeholder="Selecione"
                options={[
                  { value: 'Menor Preço', label: 'Menor Preço' },
                  { value: 'Maior Desconto', label: 'Maior Desconto' },
                ]}
              />
              <SelectField
                label="Modo de disputa"
                value={form.modoDisputa}
                onChange={(e) => atualizarCampo('modoDisputa', e.target.value)}
                placeholder="Selecione"
                options={[
                  { value: 'Aberto', label: 'Aberto' },
                  { value: 'Fechado', label: 'Fechado' },
                  { value: 'Aberto/Fechado', label: 'Aberto/Fechado' },
                  { value: 'Fechado/Aberto', label: 'Fechado/Aberto' },
                ]}
              />
              <SelectField
                label="Participação"
                value={form.participacao}
                onChange={(e) => atualizarCampo('participacao', e.target.value)}
                placeholder="Selecione"
                options={[
                  { value: 'Individual', label: 'Individual' },
                  { value: 'Por lote', label: 'Por lote' },
                ]}
              />
              <TextField
                label="Valor total da licitação (R$)"
                type="number"
                value={form.valorTotalLicitacao ?? ''}
                onChange={(e) =>
                  atualizarCampo('valorTotalLicitacao', e.target.value === '' ? undefined : Number(e.target.value))
                }
                placeholder="Deixe em branco = orçamento sigiloso"
              />
              <TextField
                label="Link do edital"
                value={form.linkEdital ?? ''}
                onChange={(e) => atualizarCampo('linkEdital', e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-xs uppercase tracking-wide text-ink-soft">
                PDF do edital
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => atualizarCampo('nomeArquivoEdital', e.target.files?.[0]?.name ?? '')}
                className="block w-full font-body text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-forest-mist file:px-3.5 file:py-2 file:font-body file:text-sm file:font-medium file:text-forest-deep"
              />
              {form.nomeArquivoEdital && (
                <p className="mt-1 font-body text-xs text-ink-soft">
                  Arquivo selecionado: {form.nomeArquivoEdital}{' '}
                  <span className="italic">(upload simulado — sem backend de arquivos ainda)</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="CAPAG"
                value={form.capag}
                onChange={(e) => atualizarCampo('capag', e.target.value)}
                placeholder="Ex: B (3,96%)"
              />
              <TextField
                label="Restrições à participação. Exclusiva ME/EPP?"
                value={form.restricoesMeEpp}
                onChange={(e) => atualizarCampo('restricoesMeEpp', e.target.value)}
                placeholder="Ex: Não é exclusiva. A preferência para ME/EPP não será aplicada"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-ink-soft/10 pt-5">
              <SelectField
                label="Cliente vinculado *"
                required
                value={form.clienteId}
                onChange={(e) => atualizarCampo('clienteId', e.target.value)}
                placeholder="Selecione um cliente"
                options={clientes}
              />
              <SelectField
                label="Status *"
                required
                value={form.status}
                onChange={(e) => atualizarCampo('status', e.target.value as StatusLicitacao)}
                options={Object.entries(STATUS_LICITACAO_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </div>

            {licitacaoEmEdicao && (
              <div className="rounded-lg border border-ink-soft/15 bg-forest-mist/30 px-4 py-3 font-body text-sm">
                <p className="mb-0.5 font-medium text-ink">Decisão do cliente (Portal do Cliente)</p>
                <p className="text-ink-soft">
                  {DECISAO_CLIENTE_LABEL[licitacaoEmEdicao.decisaoCliente]}
                  {licitacaoEmEdicao.decisaoClienteEm && ` em ${formatarDataHora(licitacaoEmEdicao.decisaoClienteEm)}`}
                  {licitacaoEmEdicao.motivoRecusaCliente && ` — "${licitacaoEmEdicao.motivoRecusaCliente}"`}
                </p>
                <p className="mt-1 text-xs text-ink-soft/70">
                  Essa decisão é registrada pelo próprio cliente no Portal do Cliente, não é editável por aqui.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Aba 2 — Habilitação (Critérios de Habilitação) */}
        {abaAtiva === 'habilitacao' && (
          <div className="space-y-5">
            <TextAreaField
              label="Qualificação técnica"
              value={form.habilitacao.qualificacaoTecnica}
              onChange={(e) => atualizarHabilitacao('qualificacaoTecnica', e.target.value)}
              rows={3}
            />

            <TextAreaField
              label="Qualificação econômico-financeira"
              value={form.habilitacao.qualificacaoEconomicoFinanceira}
              onChange={(e) => atualizarHabilitacao('qualificacaoEconomicoFinanceira', e.target.value)}
              rows={3}
            />

            <TextAreaField
              label="Regularidade fiscal e trabalhista"
              value={form.habilitacao.regularidadeFiscal}
              onChange={(e) => atualizarHabilitacao('regularidadeFiscal', e.target.value)}
              rows={3}
            />

            <TextAreaField
              label="Exigência de atestado de fornecimento?"
              value={form.habilitacao.exigeAtestado}
              onChange={(e) => atualizarHabilitacao('exigeAtestado', e.target.value)}
              rows={2}
              placeholder='Ex: Sim, para ambos os itens. O(s) atestado(s) devem comprovar fornecimento similar ao objeto...'
            />

            <TextAreaField
              label="Exigência de amostras?"
              value={form.habilitacao.exigeAmostras}
              onChange={(e) => atualizarHabilitacao('exigeAmostras', e.target.value)}
              rows={2}
              placeholder="Ex: Sim. O licitante classificado em primeiro lugar deverá apresentar a amostra"
            />
            {form.habilitacao.exigeAmostras.trim() && (
              <TextField
                label="Prazo para entrega da amostra (dias)"
                type="number"
                value={form.habilitacao.prazoEntregaAmostraDias ?? ''}
                onChange={(e) =>
                  atualizarHabilitacao(
                    'prazoEntregaAmostraDias',
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
                className="max-w-xs"
              />
            )}

            <TextAreaField
              label="Outros requisitos"
              value={form.habilitacao.outrosRequisitos}
              onChange={(e) => atualizarHabilitacao('outrosRequisitos', e.target.value)}
              rows={3}
            />
          </div>
        )}

        {/* Aba 3 — Condições Comerciais */}
        {abaAtiva === 'comerciais' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Intervalo de lances"
                value={form.condicoesComerciais.intervaloLances}
                onChange={(e) => atualizarCondicoes('intervaloLances', e.target.value)}
                placeholder="Ex: R$ 500,00 entre lances"
              />
              <SelectField
                label="Forma de pagamento"
                value={form.condicoesComerciais.formaPagamento}
                onChange={(e) => atualizarCondicoes('formaPagamento', e.target.value as FormaPagamento)}
                options={Object.entries(FORMA_PAGAMENTO_LABEL).map(([value, label]) => ({ value, label }))}
              />
              <SelectField
                label="Recebimento em qual banco"
                value={form.condicoesComerciais.recebimentoBanco}
                onChange={(e) => atualizarCondicoes('recebimentoBanco', e.target.value)}
                placeholder="Selecione"
                options={[
                  { value: 'Banco do Brasil', label: 'Banco do Brasil' },
                  { value: 'Outros', label: 'Outros' },
                ]}
              />
              <TextField
                label="Prazo de pagamento (dias)"
                type="number"
                value={form.condicoesComerciais.prazoPagamentoDias ?? ''}
                onChange={(e) =>
                  atualizarCondicoes('prazoPagamentoDias', e.target.value === '' ? undefined : Number(e.target.value))
                }
              />
              <TextField
                label="Prazo de entrega (dias, até 2 dígitos)"
                type="number"
                maxLength={2}
                value={form.condicoesComerciais.prazoEntregaDias ?? ''}
                onChange={(e) => {
                  const valor = e.target.value === '' ? undefined : Math.min(99, Number(e.target.value));
                  atualizarCondicoes('prazoEntregaDias', valor);
                }}
              />
              <TextField
                label="Validade da proposta (dias, até 3 dígitos)"
                type="number"
                maxLength={3}
                value={form.condicoesComerciais.validadePropostaDias ?? ''}
                onChange={(e) => {
                  const valor = e.target.value === '' ? undefined : Math.min(999, Number(e.target.value));
                  atualizarCondicoes('validadePropostaDias', valor);
                }}
              />
            </div>

            <TextAreaField
              label="Local de entrega"
              value={form.condicoesComerciais.localEntrega}
              onChange={(e) => atualizarCondicoes('localEntrega', e.target.value)}
              rows={2}
            />

            <CheckboxField
              label="Possui garantias?"
              checked={form.condicoesComerciais.possuiGarantias}
              onChange={(e) => atualizarCondicoes('possuiGarantias', e.target.checked)}
            />
            {form.condicoesComerciais.possuiGarantias && (
              <TextAreaField
                label="Detalhamento das garantias"
                value={form.condicoesComerciais.garantiasDetalhe ?? ''}
                onChange={(e) => atualizarCondicoes('garantiasDetalhe', e.target.value)}
                rows={2}
              />
            )}

            <div className="border-t border-ink-soft/10 pt-5">
              <CheckboxField
                label="Cobrar frete?"
                checked={form.cobrarFrete}
                onChange={(e) => atualizarCampo('cobrarFrete', e.target.checked)}
              />
              {form.cobrarFrete && (
                <TextField
                  label="Percentual de frete (%)"
                  type="number"
                  value={form.percentualFrete ?? ''}
                  onChange={(e) =>
                    atualizarCampo('percentualFrete', e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  className="mt-3 max-w-xs"
                />
              )}
            </div>
          </div>
        )}

        {/* Aba 4 — Pontos de Atenção */}
        {abaAtiva === 'atencao' && (
          <div className="space-y-2">
            <p className="font-body text-sm text-ink-soft">
              Riscos, restrições, observações e estratégia. Futuramente será preenchido automaticamente pela IA a
              partir da leitura do edital.
            </p>
            <TextAreaField
              label="Pontos de atenção"
              value={form.pontosAtencao}
              onChange={(e) => atualizarCampo('pontosAtencao', e.target.value)}
              rows={8}
              placeholder="Descreva riscos, restrições e estratégia para esta licitação"
            />
          </div>
        )}

        {/* Aba 5 — Itens */}
        {abaAtiva === 'itens' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="font-body text-sm text-ink-soft">
                Cadastre os itens individuais ou organize-os em grupos. O total da oportunidade é calculado
                automaticamente a partir do preço de referência × quantidade de cada item.
              </p>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" onClick={adicionarGrupo} className="whitespace-nowrap">
                  + Novo grupo
                </Button>
                <Button variant="ghost" onClick={() => adicionarItem()} className="whitespace-nowrap">
                  + Item individual
                </Button>
              </div>
            </div>

            {form.grupos.map((grupo) => {
              const itensDoGrupo = form.itens.filter((i) => i.grupoId === grupo.id);
              return (
                <div key={grupo.id} className="rounded-xl border border-ink-soft/15 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <input
                      value={grupo.numero}
                      onChange={(e) => renumerarGrupo(grupo.id, e.target.value)}
                      placeholder="Nº"
                      className="w-14 rounded-md border border-transparent bg-transparent font-body text-sm font-semibold text-ink hover:border-ink-soft/20 focus:border-forest focus:outline-none"
                    />
                    <input
                      value={grupo.nome}
                      onChange={(e) => renomearGrupo(grupo.id, e.target.value)}
                      className="flex-1 rounded-md border border-transparent bg-transparent font-body text-sm font-semibold text-ink hover:border-ink-soft/20 focus:border-forest focus:outline-none"
                    />
                    <div className="flex shrink-0 gap-2">
                      <Button variant="ghost" onClick={() => adicionarItem(grupo.id)} className="text-xs">
                        + Item no grupo
                      </Button>
                      <button
                        type="button"
                        onClick={() => removerGrupo(grupo.id)}
                        className="font-body text-xs text-red-600 hover:underline"
                      >
                        Excluir grupo
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {itensDoGrupo.map((item) => (
                      <ItemLicitacaoRow key={item.id} item={item} onChange={atualizarItem} onRemover={removerItem} />
                    ))}
                    {itensDoGrupo.length === 0 && (
                      <p className="font-body text-xs italic text-ink-soft">Nenhum item neste grupo ainda.</p>
                    )}
                  </div>

                  <p className="mt-3 text-right font-body text-sm font-medium text-forest-deep">
                    Total do grupo: {formatarMoeda(totalReferenciaGrupo(form.itens, grupo.id))}
                  </p>
                </div>
              );
            })}

            {(itensIndividuais.length > 0 || form.grupos.length === 0) && (
              <div className="rounded-xl border border-ink-soft/15 p-4">
                <p className="mb-3 font-body text-sm font-semibold text-ink">Itens individuais</p>
                <div className="space-y-3">
                  {itensIndividuais.map((item) => (
                    <ItemLicitacaoRow key={item.id} item={item} onChange={atualizarItem} onRemover={removerItem} />
                  ))}
                  {itensIndividuais.length === 0 && (
                    <p className="font-body text-xs italic text-ink-soft">Nenhum item individual ainda.</p>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-forest/30 bg-forest-mist px-4 py-3 text-right">
              <span className="font-body text-sm font-semibold text-forest-deep">
                Total da oportunidade: {formatarMoeda(totalOportunidade)}
              </span>
            </div>
          </div>
        )}
          </div>
        </>
      )}
    </Modal>
  );
}

// Linha de edição de um item — reutilizada tanto dentro de grupos quanto na
// lista de itens individuais.
function ItemLicitacaoRow({
  item,
  onChange,
  onRemover,
}: {
  item: ItemLicitacao;
  onChange: <K extends keyof ItemLicitacao>(id: string, campo: K, valor: ItemLicitacao[K]) => void;
  onRemover: (id: string) => void;
}) {
  return (
    <div className="relative rounded-lg bg-paper-2/60 p-3">
      <button
        type="button"
        onClick={() => onRemover(item.id)}
        aria-label="Remover item"
        className="absolute right-2 top-2 rounded-md p-1 text-ink-soft/50 hover:bg-red-50 hover:text-red-600"
      >
        ✕
      </button>

      <div className="flex flex-wrap items-end gap-2 pr-8">
        <div className="w-16 shrink-0">
          <TextField
            label="Nº"
            value={item.numero}
            onChange={(e) => onChange(item.id, 'numero', e.target.value)}
          />
        </div>
        <div className="w-32 shrink-0">
          <TextField
            label="Unidade de medida"
            value={item.unidadeMedida}
            onChange={(e) => onChange(item.id, 'unidadeMedida', e.target.value)}
          />
        </div>
        <div className="w-28 shrink-0">
          <TextField
            label="Qtde"
            type="number"
            value={item.quantidade}
            onChange={(e) => onChange(item.id, 'quantidade', Number(e.target.value))}
          />
        </div>
        <div className="w-44 shrink-0">
          <TextField
            label="Valor Unit. Referência"
            type="number"
            value={item.precoReferencia}
            onChange={(e) => onChange(item.id, 'precoReferencia', Number(e.target.value))}
          />
        </div>
        <div className="w-48 shrink-0">
          <p className="mb-1.5 whitespace-nowrap font-mono text-xs uppercase tracking-wide text-ink-soft">
            Total Referência
          </p>
          <div className="whitespace-nowrap rounded-md border border-ink-soft/20 bg-white px-3 py-2.5 font-body text-sm font-medium text-ink">
            {formatarMoeda(totalReferenciaItem(item))}
          </div>
        </div>
      </div>

      <div className="mt-2">
        <TextAreaField
          label="Descrição"
          value={item.descricao}
          onChange={(e) => onChange(item.id, 'descricao', e.target.value)}
          rows={3}
        />
      </div>

      <div className="mt-2">
        <CheckboxField
          label="Exclusivo para ME/EPP"
          checked={item.exclusivoMeEpp}
          onChange={(e) => onChange(item.id, 'exclusivoMeEpp', e.target.checked)}
        />
      </div>
    </div>
  );
}
