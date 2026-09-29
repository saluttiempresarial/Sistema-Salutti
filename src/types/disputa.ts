// src/types/disputa.ts
//
// Registro do resultado da sessão de disputa (Cap. 5 do PRD: "Disputas —
// SIGA Pregão"). Relação 1:1 com Licitação — cada licitação tem, no
// máximo, uma disputa registrada (a sessão em si acontece fora do sistema,
// no app do SIGA Pregão; aqui só guardamos o resultado).
//
// REESTRUTURADO em 28/09, a pedido do Márcio: o resultado deixou de ser um
// valor único pra disputa inteira (posição/oferta/vencedor de uma vez só)
// e passou a ser por ITEM — ou por GRUPO inteiro, quando os itens estão
// agrupados (a disputa/lance no pregão acontece pelo grupo como um todo,
// não item por item). Alinhado 1:1 com a planilha real da Salutti (aba
// "Produtos", bloco "RESULTADO DA LICITAÇÃO"):
//   - Item avulso: Valor Fechado é o preço UNITÁRIO; Total = Valor Fechado
//     × quantidade do item.
//   - Grupo: Valor Fechado é o valor TOTAL já fechado pro grupo inteiro
//     (soma), porque os itens de um grupo costumam ter unidades/preços
//     diferentes entre si — não faz sentido um "unitário" pro grupo.
// Em ambos os casos, % Acima do Mínimo = (Valor Fechado ÷ Preço Mínimo já
// com frete) − 1 — mesma fórmula da planilha (coluna Z/T), só que aplicada
// ao total no caso do grupo.
//
// AJUSTADO em 29/09, a pedido do Márcio: Posição, Valor Fechado e Total são
// os três preenchidos manualmente por admin/analista (Total deixou de ser
// calculado automaticamente como Valor Fechado × quantidade — na prática o
// valor total mostrado no portal pode diferir um pouco da multiplicação
// simples, por arredondamento). Só o % Acima do Mínimo continua automático,
// calculado a partir do Valor Fechado, como já era.

export type ResultadoDisputa = 'em_andamento' | 'ganho' | 'perdido' | 'homologado';

export const RESULTADO_DISPUTA_LABEL: Record<ResultadoDisputa, string> = {
  em_andamento: 'Em andamento',
  ganho: 'Ganho',
  perdido: 'Perdido',
  homologado: 'Homologado',
};

/** Um item avulso é preenchido com `itemId`; um grupo inteiro é preenchido
 *  com `grupoId`. Nunca os dois ao mesmo tempo — ver constraint no banco
 *  (disputa_itens_item_xor_grupo, migração 021). */
export interface DisputaResultadoLinha {
  id: string;
  disputaId: string;
  itemId?: string;
  grupoId?: string;
  posicao?: number; // classificação obtida na disputa (ex.: 1, 2, 22...)
  valorFechado?: number; // unitário (item avulso) ou total (grupo)
  totalFechado?: number; // preenchido manualmente — não é mais Valor Fechado × quantidade
}

export type DisputaResultadoLinhaFormData = Omit<DisputaResultadoLinha, 'id' | 'disputaId'>;

export interface Disputa {
  id: string;
  licitacaoId: string;

  dataSessaoRealizada?: string; // ISO datetime — quando a sessão de fato ocorreu
  resultado: ResultadoDisputa;
  observacoes: string;
  linkAtaSigaPregao?: string; // link/registro da ata no app do SIGA Pregão

  itens: DisputaResultadoLinha[]; // 1 linha por item avulso ou por grupo

  criadoEm: string;
  atualizadoEm: string;
}

export type DisputaFormData = Omit<Disputa, 'id' | 'criadoEm' | 'atualizadoEm' | 'itens'> & {
  itens: DisputaResultadoLinhaFormData[];
};
