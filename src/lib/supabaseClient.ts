// src/lib/supabaseClient.ts
//
// Ponto único de conexão com o Supabase. Todos os services (clienteService,
// funcionarioService, licitacaoService etc.) vão importar `supabase` daqui
// em vez de cada um criar sua própria conexão.
//
// As credenciais vêm do arquivo .env (nunca ficam escritas direto no
// código) — ver .env.example para saber quais variáveis são necessárias.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY não encontradas. ' +
      'Confira se o arquivo .env existe na raiz do projeto (veja .env.example).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
