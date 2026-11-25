/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta extraída de styles.css do site institucional — não alterar sem
        // atualizar também o site estático, para manter as duas frentes consistentes.
        forest: {
          DEFAULT: '#0B5C3C',
          // "deep" é o verde escuro dos VALORES FINANCEIROS e destaques (texto) e
          // do hover dos botões. Segue o token de texto --texto-valor (index.css).
          deep: 'rgb(var(--texto-valor) / <alpha-value>)',
          mist: '#E7F0EA',
        },
        // Verde exato extraído do arquivo do logo oficial (círculo do ícone
        // "S" e texto "SALUTTI" usam essa MESMA cor no logo) — mantido
        // separado do "forest" (usado no resto da UI) porque são fontes
        // diferentes: este é para reproduzir o logo com fidelidade de cor,
        // aquele é a paleta funcional do app.
        brandGreen: '#057046',
        mint: '#7FD9AC',
        brass: {
          DEFAULT: '#A9822F',
          light: '#C79C42',
          pale: '#F1E4C4',
        },
        charcoal: {
          DEFAULT: '#16211B',
          2: '#1E2B23',
          3: '#26362C',
        },
        paper: {
          DEFAULT: '#F7F4EC',
          2: '#EFEADA',
        },
        // TIPOGRAFIA (ajuste de legibilidade de 25/11/2026) — as cores vêm de
        // variáveis CSS em src/index.css (:root), para trocar a paleta num só
        // lugar. Formato "rgb(var(--x) / <alpha-value>)" mantém funcionando as
        // classes com transparência (ex.: border-ink-soft/10).
        //   ink        = texto principal e títulos            (#1F2937)
        //   ink-soft   = descrições e textos de conteúdo      (#333333)
        //   ink-aux    = legendas e informações auxiliares    (#64748B)
        //   forest-deep (acima) = valores financeiros/destaque (#174B36)
        ink: {
          DEFAULT: 'rgb(var(--texto-titulo) / <alpha-value>)',
          soft: 'rgb(var(--texto-conteudo) / <alpha-value>)',
          aux: 'rgb(var(--texto-auxiliar) / <alpha-value>)',
        },
      },
      // Texto na cor "brass" (dourado) sobre o fundo brass-pale tinha contraste de
      // 2,8:1 (abaixo do mínimo de 4,5). Só o TEXTO usa o dourado escuro; fundos,
      // bordas e anéis continuam com o dourado original.
      textColor: {
        brass: 'rgb(var(--texto-ouro) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        body: ['"Source Sans 3"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 2px 8px rgba(15,25,18,0.06)',
        card: '0 12px 32px rgba(15,25,18,0.14)',
      },
    },
  },
  plugins: [],
}
