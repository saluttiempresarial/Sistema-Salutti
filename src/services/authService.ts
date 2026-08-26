import { supabase } from '@/lib/supabaseClient'
import type { AuthUser, LoginCredentials, UserRole } from '@/types/auth'

/**
 * Camada de serviço de autenticação — conectada ao Supabase Auth de verdade.
 *
 * Um login (supabase.auth) por si só não diz qual PERFIL a pessoa tem no
 * sistema — por isso, depois de autenticar, sempre buscamos o cadastro
 * correspondente: primeiro em `funcionarios` (Admin/Funcionário), e se não
 * achar, em `usuarios_cliente` (Cliente). É esse cadastro que carrega o
 * "role" e os ids usados pelas permissões (ver usePermissoes.ts).
 */

async function montarAuthUser(supabaseUserId: string, email: string): Promise<AuthUser | null> {
  const { data: funcionario } = await supabase
    .from('funcionarios')
    .select('id, nome_completo, perfil, status, forcar_troca_senha')
    .eq('auth_user_id', supabaseUserId)
    .maybeSingle()

  if (funcionario) {
    if (funcionario.status !== 'ativo') return null
    return {
      id: supabaseUserId,
      name: funcionario.nome_completo,
      email,
      role: funcionario.perfil as UserRole, // 'admin' | 'funcionario'
      funcionarioId: funcionario.id,
      forcarTrocaSenha: funcionario.forcar_troca_senha,
    }
  }

  const { data: usuarioCliente } = await supabase
    .from('usuarios_cliente')
    .select('id, nome, cliente_id, status')
    .eq('auth_user_id', supabaseUserId)
    .maybeSingle()

  if (usuarioCliente) {
    if (usuarioCliente.status !== 'ativo') return null
    return {
      id: supabaseUserId,
      name: usuarioCliente.nome,
      email,
      role: 'cliente',
      clienteId: usuarioCliente.cliente_id,
      usuarioClienteId: usuarioCliente.id,
    }
  }

  // Login existe no Supabase Auth, mas não está vinculado a nenhum
  // cadastro ativo (funcionário ou usuário de cliente) — trata como
  // "sem acesso", em vez de deixar a pessoa entrar sem perfil nenhum.
  return null
}

export const authService = {
  async signIn(credentials: LoginCredentials): Promise<{ user: AuthUser | null; error?: string }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email.trim(),
      password: credentials.password,
    })

    if (error || !data.user) {
      return { user: null, error: 'E-mail ou senha inválidos.' }
    }

    const user = await montarAuthUser(data.user.id, data.user.email ?? credentials.email)
    if (!user) {
      // Desfaz o login no Supabase — a pessoa não tem cadastro ativo aqui.
      await supabase.auth.signOut()
      return {
        user: null,
        error: 'Este login não está vinculado a nenhum cadastro ativo no sistema.',
      }
    }

    return { user }
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut()
  },

  /** Recupera a sessão atual do Supabase (se houver) e monta o AuthUser
   *  correspondente — usado ao recarregar a página. */
  async getSession(): Promise<AuthUser | null> {
    const { data } = await supabase.auth.getSession()
    const supabaseUser = data.session?.user
    if (!supabaseUser) return null
    return montarAuthUser(supabaseUser.id, supabaseUser.email ?? '')
  },

  /** Troca a senha do usuário atualmente logado. Não pede a senha atual —
   *  o Supabase exige apenas uma sessão válida (já garantida pelo login).
   *  Retorna erro amigável em português para exibir no formulário. */
  async updatePassword(novaSenha: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) {
      return { success: false, error: 'Não foi possível alterar a senha. Tente novamente.' }
    }
    return { success: true }
  },

  /** Zera forcar_troca_senha do funcionário logado, via função no banco
   *  (security definer) — ver desativar_troca_senha_obrigatoria() no
   *  Supabase. Necessário porque a RLS de UPDATE em `funcionarios` só
   *  libera para admin; esta função é a única exceção controlada. */
  async limparForcarTrocaSenha(): Promise<void> {
    const { error } = await supabase.rpc('desativar_troca_senha_obrigatoria')
    if (error) throw new Error(error.message)
  },
}
