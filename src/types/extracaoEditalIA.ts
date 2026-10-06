// src/types/extracaoEditalIA.ts
//
// Formato devolvido pela Edge Function `extrair-edital-ia`
// (supabase/functions/extrair-edital-ia/index.ts) — espelha o schema de
// validação (zod) de lá. Qualquer mudança de campo precisa ser feita nos
// dois lados (a function não importa este arquivo, e este arquivo não
// importa a function — são runtimes diferentes, Deno vs. Vite/browser).
//
// Usado só pelo fluxo de importação de edital por IA no cadastro de
// Licitação (editalIaService.ts + LicitacaoFormModal.tsx). Não é o mesmo
// tipo de LicitacaoFormData — é um subconjunto (só os campos que vêm do
// edital em si, nunca os operacionais como clienteId/status).
//
// Os campos que são enum em LicitacaoFormData (modalidade, estrutura,
// participacao, tipoContratacao, procedimento, formaPagamento) importam o
// tipo de licitacao.ts de propósito: se algum desses enums mudar lá, este
// arquivo para de compilar até o schema/prompt da Edge Function
// (supabase/functions/extrair-edital-ia/index.ts) ser atualizado junto —
// evita os dois lados saírem de sincronia silenciosamente.

import type {
  ModalidadeLicitacao,
  EstruturaLicitacao,
  ParticipacaoLicitacao,
  TipoContratacaoLicitacao,
  ProcedimentoLicitacao,
  FormaPagamento,
} from './licitacao';

export interface ItemChecklistExtraidoIA {
  id: string;
  status: 'exigido' | 'nao_exigido';
  detalhamento: string;
}

export interface ExtracaoEditalIA {
  dataLicitacao?: string; // ISO datetime
  portal: string;
  objeto: string;
  numeroPregao: string;
  orgao: string;
  estado: string; // UF
  municipio: string;
  modalidade: ModalidadeLicitacao;
  estrutura: EstruturaLicitacao;
  tipoContratacao: TipoContratacaoLicitacao;
  procedimento: ProcedimentoLicitacao;
  formaDisputa: string; // campo livre no formulário, não é enum
  modoDisputa: string; // idem
  participacao: ParticipacaoLicitacao;
  capag?: string;
  valorTotalLicitacao?: number;

  habilitacao: {
    juridica: ItemChecklistExtraidoIA[];
    fiscalSocialTrabalhista: ItemChecklistExtraidoIA[];
    economicoFinanceira: ItemChecklistExtraidoIA[];
    tecnica: ItemChecklistExtraidoIA[];
  };

  declaracoes: ItemChecklistExtraidoIA[];

  condicoesComerciais: {
    tipoIntervaloLances?: 'valor' | 'percentual';
    valorIntervaloLances?: number;
    percentualIntervaloLances?: number;
    intervaloLancesDetalhe?: string;
    formaPagamento: FormaPagamento;
    prazoPagamentoDias?: number;
    possuiGarantias: boolean;
    garantiasDetalhe?: string;
    prazoEntregaDias?: number;
    localEntrega: string;
    validadePropostaDias?: number;
  };

  outrasExigencias: ItemChecklistExtraidoIA[];

  grupos: { numero: string; nome: string }[];
  itens: {
    grupoNumero?: string;
    numero: string;
    descricao: string;
    unidadeMedida: string;
    quantidade: number;
    precoReferencia: number;
    exclusivoMeEpp: boolean;
  }[];

  pontosAtencao: string;

  // Nomes dos campos (ex.: "valorTotalLicitacao",
  // "condicoesComerciais.prazoEntregaDias") que a IA preencheu com baixa
  // certeza — usado pra destacar "confira com atenção" no formulário.
  camposComBaixaConfianca: string[];
}
