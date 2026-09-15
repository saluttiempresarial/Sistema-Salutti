// @ts-nocheck
// Este arquivo roda no runtime Deno do Supabase, não no Node/Vite do
// resto do projeto — por isso o VS Code mostra erros de tipo aqui (não
// reconhece `Deno.serve`, `Deno.env`, nem import direto de URL). O
// `@ts-nocheck` acima é só pra silenciar isso no editor; não afeta o
// `npm run build` (o tsconfig.json do projeto só inclui a pasta `src`).
//
// supabase/functions/gerenciar-login-usuario/index.ts
//
// Edge Function que faltava (pendência antiga): cria o login real
// (Supabase Auth) de um Funcionário ou Usuário do Cliente, e vincula o
// auth_user_id de volta na tabela certa. Também redefine senha quando o
// Admin preenche "Senha Temporária" na edição de um cadastro já
// existente.
//
// Por que isso precisa ser uma Edge Function e não código do site: criar
// um login exige a "service_role key" do Supabase — uma chave com
// poderes totais que NUNCA pode aparecer no código do navegador (qualquer
// pessoa que abrisse o "Inspecionar" do site conseguiria copiá-la). Rodando
// aqui dentro do Supabase, essa chave fica só no servidor, nunca é
// enviada pro navegador.
//
// Segurança: antes de fazer qualquer coisa, confere se quem está chamando
// é o Admin logado de verdade (usando o token de quem chamou, não a
// service_role) — sem isso, qualquer pessoa poderia criar login pra
// qualquer e-mail.
//
// Body esperado (JSON):
//   {
//     acao: 'criar' | 'redefinir_senha',
//     tabela: 'funcionarios' | 'usuarios_cliente',
//     registroId: string,   // id da linha em funcionarios/usuarios_cliente
//     email: string,
//     senha: string,
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4'

const TABELAS_PERMITIDAS = ['funcionarios', 'usuarios_cliente']

// CORS: sem isso, o navegador bloqueia a chamada antes mesmo dela chegar
// aqui (o Supabase JS client mostra isso como "Failed to send a request
// to the Edge Function", sem detalhe nenhum do erro real). Toda resposta
// precisa desses cabeçalhos, incluindo a checagem "OPTIONS" que o
// navegador manda automaticamente antes do POST de verdade.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  // Requisição de checagem que o navegador manda sozinho antes do POST —
  // só precisa responder OK com os cabeçalhos de CORS, sem lógica nenhuma.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ erro: 'Método não permitido' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ erro: 'Não autenticado' }, 401)
  }

  // Cliente "fraco" (chave pública), mas usando o token de quem chamou —
  // só serve pra confirmar que quem está pedindo isso é mesmo o Admin.
  const supabaseComoChamador = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: ehAdmin, error: erroChecagem } = await supabaseComoChamador.rpc('is_admin_ativo')
  if (erroChecagem || !ehAdmin) {
    return jsonResponse({ erro: 'Só o Administrador pode criar ou redefinir logins' }, 403)
  }

  let corpo: { acao?: string; tabela?: string; registroId?: string; email?: string; senha?: string }
  try {
    corpo = await req.json()
  } catch {
    return jsonResponse({ erro: 'Corpo da requisição inválido' }, 400)
  }

  const { acao, tabela, registroId, email, senha } = corpo

  if (!acao || !tabela || !registroId || !email || !senha) {
    return jsonResponse({ erro: 'Campos obrigatórios faltando' }, 400)
  }
  if (!TABELAS_PERMITIDAS.includes(tabela)) {
    return jsonResponse({ erro: 'Tabela inválida' }, 400)
  }
  if (senha.length < 6) {
    return jsonResponse({ erro: 'Senha precisa ter pelo menos 6 caracteres' }, 400)
  }

  // Cliente "forte" (service_role) — só a partir daqui, e só depois de já
  // termos confirmado que quem chamou é Admin.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  if (acao === 'criar') {
    const { data: novoUsuario, error: erroCriar } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true, // não depende de e-mail de confirmação
    })
    if (erroCriar) {
      return jsonResponse({ erro: `Falha ao criar login: ${erroCriar.message}` }, 400)
    }

    const { error: erroVincular } = await supabaseAdmin
      .from(tabela)
      .update({ auth_user_id: novoUsuario.user.id })
      .eq('id', registroId)

    if (erroVincular) {
      // Login foi criado mas não conseguimos vincular — desfaz o login
      // criado pra não deixar um usuário "órfão" no Supabase Auth.
      await supabaseAdmin.auth.admin.deleteUser(novoUsuario.user.id)
      return jsonResponse({ erro: `Falha ao vincular login: ${erroVincular.message}` }, 500)
    }

    return jsonResponse({ ok: true, authUserId: novoUsuario.user.id })
  }

  if (acao === 'redefinir_senha') {
    const { data: registro, error: erroBuscar } = await supabaseAdmin
      .from(tabela)
      .select('auth_user_id')
      .eq('id', registroId)
      .single()

    if (erroBuscar || !registro?.auth_user_id) {
      return jsonResponse(
        { erro: 'Este cadastro ainda não tem login vinculado — use a ação "criar" primeiro' },
        400
      )
    }

    const { error: erroSenha } = await supabaseAdmin.auth.admin.updateUserById(registro.auth_user_id, {
      password: senha,
    })
    if (erroSenha) {
      return jsonResponse({ erro: `Falha ao redefinir senha: ${erroSenha.message}` }, 400)
    }

    return jsonResponse({ ok: true })
  }

  return jsonResponse({ erro: 'Ação inválida' }, 400)
})
