interface LogoProps {
  className?: string
  /** 'default' é o tamanho usado no cabeçalho das telas internas;
   *  'lg' é usado na tela de login, onde o logo é o elemento principal
   *  da página e precisa de mais destaque. */
  size?: 'default' | 'lg'
}

const TAMANHOS = {
  default: { icone: 'h-8', texto: 'text-lg' },
  lg: { icone: 'h-14', texto: 'text-3xl' },
}

/**
 * Reproduz o lockup textual do logotipo do site institucional: o ícone
 * oficial (fita verde em forma de "S" + martelo dourado atravessado,
 * arquivo em /public/brand/icone-salutti.png, com fundo removido) ao lado
 * do texto "SALUTTI" na cor e fonte exatas do logo.
 */
export function Logo({ className = '', size = 'default' }: LogoProps) {
  const tamanho = TAMANHOS[size]
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={`${import.meta.env.BASE_URL}brand/icone-salutti.png`}
        alt=""
        className={`${tamanho.icone} w-auto`}
      />
      <span className={`font-body ${tamanho.texto} font-extrabold uppercase tracking-tight text-brandGreen`}>
        SALUTTI
      </span>
    </div>
  )
}
