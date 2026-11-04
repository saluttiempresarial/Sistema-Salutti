// src/utils/unidadesMedida.ts
//
// Lista fixa de unidades de medida dos itens (04/11, a pedido do Márcio), da
// mais usada para a menos usada. O sistema guarda só a sigla (ex.: "CX");
// quem precisar de outra unidade escolhe "Outra" e escreve o texto.

export interface UnidadeMedida {
  sigla: string
  nome: string
}

export const UNIDADES_MEDIDA: UnidadeMedida[] = [
  { sigla: 'UN', nome: 'Unidade' },
  { sigla: 'CX', nome: 'Caixa' },
  { sigla: 'PCT', nome: 'Pacote' },
  { sigla: 'KG', nome: 'Quilograma' },
  { sigla: 'L', nome: 'Litro' },
  { sigla: 'M', nome: 'Metro' },
  { sigla: 'M²', nome: 'Metro quadrado' },
  { sigla: 'PÇ', nome: 'Peça' },
  { sigla: 'PAR', nome: 'Par' },
  { sigla: 'KIT', nome: 'Kit' },
  { sigla: 'RL', nome: 'Rolo' },
  { sigla: 'FD', nome: 'Fardo' },
  { sigla: 'SV', nome: 'Serviço' },
  { sigla: 'H', nome: 'Hora' },
  { sigla: 'MÊS', nome: 'Mês' },
]

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Acha a unidade da lista a partir do valor gravado (ignora maiúsculas e
 *  acentos: "pç", "PC" não casam, mas "un" e "UN" sim). Undefined = texto livre. */
export function unidadeDaLista(valor?: string | null): UnidadeMedida | undefined {
  const chave = semAcento((valor ?? '').trim().toUpperCase())
  if (!chave) return undefined
  return UNIDADES_MEDIDA.find((u) => semAcento(u.sigla.toUpperCase()) === chave)
}
