import { supabase } from '@/lib/supabaseClient'

/**
 * Chama a Edge Function `gerenciar-login-usuario` (supabase/functions/) —
 * a única forma seria pra criar/redefinir um login real (Supabase Auth)
 * a partir do site, já que isso exige a service_role key, que não pode
 * ficar no código do navegador.
 *
 * Usada por funcionarioService e usuarioClienteService — não chame essa
 * função diretamente de um componente de tela.
 */

// Quando a Edge Function responde com status de erro (4xx/5xx), o cliente
// do Supabase joga fora o corpo da resposta e só entrega uma mensagem
// genérica ("Edge Function returned a non-2xx status code") em
// `error.message` — a mensagem de verdade (o campo `erro` que a função
// manda) fica escondida dentro de `error.context`, que é o Response cru.
// Essa função lê esse Response e recupera a mensagem real.
async function extrairMensagemDeErro(error: unknown): Promise<string> {
  const contexto = (error as { context?: Response })?.context
  if (contexto && typeof contexto.json === 'function') {
    try {
      const corpo = await contexto.clone().json()
      if (corpo?.erro) return corpo.erro as string
    } catch {
      // corpo não era JSON — cai pro fallback abaixo
    }
  }
  return error instanceof Error ? error.message : 'Erro desconhecido ao falar com a função de login'
}

export const loginUsuarioService = {
  async criar(tabela: 'funcionarios' | 'usuarios_cliente', registroId: string, email: string, senha: string) {
    const { data, error } = await supabase.functions.invoke('gerenciar-login-usuario', {
      body: { acao: 'criar', tabela, registroId, email, senha },
    })
    if (error) throw new Error(await extrairMensagemDeErro(error))
    if (data?.erro) throw new Error(data.erro)
    return data as { ok: true; authUserId: string }
  },

  async redefinirSenha(tabela: 'funcionarios' | 'usuarios_cliente', registroId: string, email: string, senha: string) {
    const { data, error } = await supabase.functions.invoke('gerenciar-login-usuario', {
      body: { acao: 'redefinir_senha', tabela, registroId, email, senha },
    })
    if (error) throw new Error(await extrairMensagemDeErro(error))
    if (data?.erro) throw new Error(data.erro)
    return data as { ok: true }
  },
}
