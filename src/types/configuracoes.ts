// src/types/configuracoes.ts
//
// Configurações gerais do sistema (Cap. 5 do PRD — módulo "Configurações").
// Centraliza aqui o que hoje está espalhado como constantes fixas no
// código (links rápidos, regra de prazo) para que o admin possa ajustar
// sem precisar mexer em código.
//
// NOTA: o campo `checklistPadrao` que existia aqui foi removido — o
// checklist de licitação não existe mais desde a reconstrução do módulo de
// Licitações seguindo a Especificação Funcional v2.1 (5 abas: Informações
// Gerais, Habilitação, Condições Comerciais, Pontos de Atenção, Itens —
// sem checklist).

export interface DadosEmpresa {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  email: string;
}

export interface RegraPrazoInterno {
  diasUteisAntes: number; // hoje: 3 (Cap. 6 do PRD)
  horario: string; // formato "HH:mm", hoje: "18:00"
}

/** Faixas, em dias, do indicador "Clientes sem atividade" (item 15 do documento
 *  de relatórios). Sempre crescentes: faixa 1 < faixa 2 < faixa 3. Padrão 7/14/21. */
export interface FaixasInatividade {
  faixa1Dias: number;
  faixa2Dias: number;
  faixa3Dias: number;
}

export const FAIXAS_INATIVIDADE_PADRAO: FaixasInatividade = { faixa1Dias: 7, faixa2Dias: 14, faixa3Dias: 21 };

export interface LinkRapido {
  id: string;
  label: string;
  url: string;
}

export interface ConfiguracoesSistema {
  dadosEmpresa: DadosEmpresa;
  regraPrazoInterno: RegraPrazoInterno;
  faixasInatividade: FaixasInatividade;
  linksRapidos: LinkRapido[]; // portais mostrados na Mesa de Trabalho
  atualizadoEm: string;
}
