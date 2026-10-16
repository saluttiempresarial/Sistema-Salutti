// src/components/dashboard/FraseInstitucional.tsx
//
// Frase institucional da Salutti (a mesma da arte do LinkedIn), exibida no
// canto direito do cabeçalho da tela inicial: "Qualidade que gera confiança.
// Estratégia que entrega resultados." — mesmas cores da arte: verde, escuro
// e dourado. Escondida em telas pequenas, para não ocupar espaço do conteúdo.

export function FraseInstitucional() {
  return (
    <div
      className="hidden shrink-0 border-l-2 border-brass pl-5 md:block"
      aria-label="Qualidade que gera confiança. Estratégia que entrega resultados."
    >
      <p className="font-body text-lg font-extrabold uppercase leading-tight tracking-tight xl:text-2xl">
        <span className="text-forest">Qualidade</span> <span className="text-ink">que gera</span>{' '}
        <span className="text-brass">confiança.</span>
      </p>
      <p className="font-body text-lg font-extrabold uppercase leading-tight tracking-tight xl:text-2xl">
        <span className="text-forest">Estratégia</span> <span className="text-ink">que entrega</span>{' '}
        <span className="text-brass">resultados.</span>
      </p>
    </div>
  )
}
