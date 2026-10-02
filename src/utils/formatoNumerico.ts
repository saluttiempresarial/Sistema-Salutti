// src/utils/formatoNumerico.ts
//
// Padrão numérico BR usado em todo o sistema: VÍRGULA é sempre o separador
// decimal, PONTO é sempre o separador de milhar — nunca o contrário, em
// nenhum campo. Essas funções existiam duplicadas (cada uma com sua
// própria cópia quase idêntica) em LicitacaoFormModal.tsx e
// PropostaComercialCards.tsx, o que levou a uma falha real: quando o texto
// digitado não tinha vírgula, o código tratava um ponto solto como
// separador DECIMAL (padrão americano) em vez de milhar — "10.000"
// (dez mil) virava 10 (dez). Corrigido e centralizado aqui em 02/10, a
// pedido do Márcio, exatamente para que uma correção futura valha para
// todos os campos de uma vez, em vez de ter que lembrar de replicar em
// cada arquivo.

/** Insere o ponto de milhar na parte inteira de um texto já no padrão BR
 *  (vírgula decimal) — "4575501,4" -> "4.575.501,4". */
export function aplicarSeparadorMilhar(texto: string): string {
  const negativo = texto.startsWith('-')
  const semSinal = negativo ? texto.slice(1) : texto
  const [parteInteira, parteDecimal] = semSinal.split(',')
  const parteInteiraComPontos = parteInteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const resultado = parteDecimal !== undefined ? `${parteInteiraComPontos},${parteDecimal}` : parteInteiraComPontos
  return negativo ? `-${resultado}` : resultado
}

/** Converte um número para o texto exibido no campo, no padrão BR (ponto de
 *  milhar, vírgula decimal), com até `casas` casas decimais.
 *
 *  `casasMinimas` controla o que acontece com zeros de sobra quando o valor
 *  é "redondo":
 *  - 0 (padrão): corta tudo — ex. 4575501 -> "4.575.501", não "4575501,000000".
 *    Usado em campos que NÃO são dinheiro (quantidade, percentual) ou em
 *    campos de referência de preço com muitas casas de precisão, onde forçar
 *    zeros à direita não ajuda em nada.
 *  - 2: NUNCA corta abaixo de 2 casas — ex. 10000015 -> "10.000.015,00", não
 *    "10.000.015". Usado nos campos que são dinheiro de fato (Valor total,
 *    Valor unitário, Valor de referência), por decisão explícita de
 *    02/10: valor monetário sempre mostra os centavos, mesmo "redondo" —
 *    evita a ambiguidade de "10.000" parecer dez mil inteiros. Se o valor
 *    tiver mais precisão real além da 2ª casa (ex.: 4,5755014), essa
 *    precisão é preservada — só os zeros de sobra são cortados.
 *
 *  Usada para reformatar o campo ao perder o foco (onBlur) e ao carregar
 *  valores existentes na tela. */
export function numeroParaCampoDecimal(
  valor: number | null | undefined,
  casas: number,
  casasMinimas = 0
): string {
  if (valor == null) return ''
  let textoBruto = valor.toFixed(casas)
  if (casas > 0) {
    const minimo = Math.min(casasMinimas, casas)
    const [parteInteira, parteDecimal = ''] = textoBruto.split('.')
    let parteDecimalCortada = parteDecimal
    while (parteDecimalCortada.length > minimo && parteDecimalCortada.endsWith('0')) {
      parteDecimalCortada = parteDecimalCortada.slice(0, -1)
    }
    textoBruto = parteDecimalCortada ? `${parteInteira}.${parteDecimalCortada}` : parteInteira
  }
  const texto = textoBruto === '' || textoBruto === '-' ? '0' : textoBruto.replace('.', ',')
  return aplicarSeparadorMilhar(texto)
}

/** Converte o texto do campo de volta para número. Regra fixa (02/10): o
 *  texto SEMPRE segue o padrão BR — se tiver vírgula, ela é o separador
 *  decimal e todo ponto no texto é de milhar; se NÃO tiver vírgula, todo
 *  ponto TAMBÉM é de milhar (nunca decimal), e o número é lido como
 *  inteiro. Não existe mais um "modo ponto decimal solto" (padrão
 *  americano) — foi essa ambiguidade que causava "10.000" virar 10. */
export function campoParaNumeroDecimal(texto: string, casas: number): number | undefined {
  const limpo = texto.trim()
  if (!limpo) return undefined
  const numero = limpo.includes(',')
    ? parseFloat(limpo.replace(/\./g, '').replace(',', '.'))
    : parseFloat(limpo.replace(/\./g, ''))
  if (isNaN(numero)) return undefined
  const fator = Math.pow(10, casas)
  return Math.round(numero * fator) / fator
}

/** Máscara aplicada EM TEMPO REAL, a cada tecla digitada (onChange) — ao
 *  contrário das funções acima (que só convertem/formatam o texto já
 *  parado), esta reformata a cada caractere digitado: insere o ponto de
 *  milhar conforme a pessoa digita, aceita só a PRIMEIRA vírgula digitada
 *  (ignora qualquer vírgula extra) e ignora qualquer ponto ou sinal de
 *  menos que a pessoa tente digitar diretamente — o ponto só aparece como
 *  resultado da formatação automática, nunca como algo digitado à mão (e
 *  valor negativo nunca é permitido nestes campos). `casas` limita quantos
 *  dígitos decimais a pessoa consegue digitar depois da vírgula — 0
 *  bloqueia a vírgula inteiramente (usado em campos sempre inteiros, como
 *  quantidade/dias). */
export function aplicarMascaraAoDigitar(textoDigitado: string, casas: number): string {
  let apenasDigitosEVirgula = ''
  let virgulaJaUsada = false
  for (const caractere of textoDigitado) {
    if (caractere >= '0' && caractere <= '9') {
      apenasDigitosEVirgula += caractere
    } else if (caractere === ',' && !virgulaJaUsada && casas > 0) {
      apenasDigitosEVirgula += caractere
      virgulaJaUsada = true
    }
  }

  if (apenasDigitosEVirgula === '') return ''
  if (apenasDigitosEVirgula === ',') return '0,'

  const [parteInteiraBruta = '', parteDecimalBruta] = apenasDigitosEVirgula.split(',')
  // Remove zeros à esquerda enquanto a pessoa digita (ex.: "0010" -> "10"),
  // sem apagar um "0" sozinho (ex.: começar digitando "0," pra "0,50").
  const parteInteiraSemZerosIniciais = parteInteiraBruta.replace(/^0+(?=\d)/, '')
  const parteInteiraComMilhar = aplicarSeparadorMilhar(parteInteiraSemZerosIniciais || '0')

  if (parteDecimalBruta === undefined) return parteInteiraComMilhar

  const parteDecimalLimitada = parteDecimalBruta.slice(0, casas)
  return `${parteInteiraComMilhar},${parteDecimalLimitada}`
}
