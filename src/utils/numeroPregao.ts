// src/utils/numeroPregao.ts
//
// O campo "Número do pregão" costuma ser copiado do edital já com o prefixo
// "Nº" (ex.: "Nº 75/2026"), e as telas do sistema já escrevem o seu próprio
// "Nº " antes do número, o que resultava em "Nº Nº 75/2026" (20/10).
// Esta função remove o prefixo digitado (Nº, N°, N.º, N. º, No ou No.).
// "No" só é removido quando vem seguido de número, para não cortar nomes
// como "Novo 12/2026".
export function limparNumeroPregao(numero: string): string {
  return numero.replace(/^\s*(?:n\s*\.?\s*[º°]\.?|no\.?(?=\s*\d))\s*/i, '').trim()
}
