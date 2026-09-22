// src/pages/TrocarSenhaPage.tsx
//
// Tela obrigatória de troca de senha — rota /trocar-senha. O ProtectedRoute
// redireciona para cá automaticamente sempre que o `user.forcarTrocaSenha`
// (Funcionário ou Admin criado com "Senha Temporária" pelo cadastro) estiver
// true, qualquer que seja a rota que a pessoa tentar acessar.
//
// Fluxo ao confirmar:
//   1. authService.updatePassword — troca a senha de fato no Supabase Auth.
//   2. authService.limparForcarTrocaSenha — zera forcar_troca_senha no banco
//      (via RPC, porque a RLS de UPDATE em `funcionarios` só libera para admin).
//   3. refreshUser (AuthContext) — recarrega o `user` em memória já sem a
//      flag, senão o ProtectedRoute continuaria mandando de volta pra cá.
//   4. navigate para o dashboard do próprio perfil.
//
// Não é a tela de "esqueci minha senha" (essa não existe ainda) — é só o
// passo obrigatório de trocar uma senha temporária definida pelo Admin.

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { authService } from '@/services/authService'
import { Button } from '@/components/Button'
import { ROLE_HOME_ROUTE } from '@/types/auth'

const TAMANHO_MINIMO_SENHA = 6

export function TrocarSenhaPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (novaSenha.length < TAMANHO_MINIMO_SENHA) {
      setErro(`A nova senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`)
      return
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }

    setSalvando(true)
    try {
      const resultado = await authService.updatePassword(novaSenha)
      if (!resultado.success) {
        setErro(resultado.error || 'Não foi possível alterar a senha. Tente novamente.')
        return
      }

      await authService.limparForcarTrocaSenha()
      await refreshUser()

      navigate(user ? ROLE_HOME_ROUTE[user.role] : '/', { replace: true })
    } catch {
      setErro('Não foi possível concluir a troca de senha. Tente novamente em instantes.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md rounded-xl border border-ink-soft/10 bg-white p-8 shadow-soft">
        <p className="font-mono text-xs uppercase tracking-widest text-forest">Acesso ao sistema</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-forest-deep">Troque sua senha</h1>
        <p className="mt-2 font-body text-sm text-ink-soft">
          Por segurança, você precisa definir uma nova senha antes de continuar. Essa etapa é
          obrigatória apenas na primeira vez.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="nova-senha" className="font-body text-sm font-medium text-ink">
              Nova senha
            </label>
            <input
              id="nova-senha"
              type="password"
              autoComplete="new-password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              disabled={salvando}
              className="mt-1.5 w-full rounded-lg border border-ink-soft/20 px-3 py-2.5 font-body text-sm text-ink outline-none transition-colors focus:border-forest disabled:cursor-not-allowed disabled:bg-paper-2/60"
              placeholder={`Mínimo ${TAMANHO_MINIMO_SENHA} caracteres`}
            />
          </div>

          <div>
            <label htmlFor="confirmar-senha" className="font-body text-sm font-medium text-ink">
              Confirmar nova senha
            </label>
            <input
              id="confirmar-senha"
              type="password"
              autoComplete="new-password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              disabled={salvando}
              className="mt-1.5 w-full rounded-lg border border-ink-soft/20 px-3 py-2.5 font-body text-sm text-ink outline-none transition-colors focus:border-forest disabled:cursor-not-allowed disabled:bg-paper-2/60"
              placeholder="Repita a nova senha"
            />
          </div>

          {erro && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 font-body text-xs text-red-700">
              {erro}
            </p>
          )}

          <Button type="submit" disabled={salvando} className="w-full justify-center">
            {salvando ? 'Salvando...' : 'Confirmar nova senha'}
          </Button>
        </form>
      </div>
    </div>
  )
}
