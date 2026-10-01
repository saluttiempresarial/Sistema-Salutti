module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  // supabase/functions roda em Deno (outro runtime, outros globals/imports
  // de URL) — lintar com as regras do app React quebraria sem motivo real.
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules', 'scripts', 'supabase/functions'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // Prefixo "_" pra variável/argumento intencionalmente não usado (ex.:
    // o `_taxaFretePreenchida` em licitacaoCalculos.ts) não é erro.
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
