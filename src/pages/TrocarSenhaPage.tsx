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

// Ícone de "olho" (mostrar) / "olho cortado" (ocultar) para alternar a
// visibilidade da senha digitada — SVG inline para não depender de nenhuma
// biblioteca de ícones externa que o projeto talvez não tenha instalada.
function IconeOlho({ visivel }: { visivel: boolean }) {
  if (visivel) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a17.9 17.9 0 0 1-2.29 3.36M6.61 6.61A17.9 17.9 0 0 0 2 11.99s3.5 7 10 7a10.9 10.9 0 0 0 5.39-1.41M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M2 2l20 20" />
    </svg>
  )
}

// Campo de senha com botão de "olho" para alternar entre texto oculto e
// visível — reutilizado nos dois campos da tela (Nova senha / Confirmar
// nova senha) para não duplicar o input + botão duas vezes.
function CampoSenha({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (valor: string) => void
  disabled: boolean
  placeholder: string
}) {
  const [visivel, setVisivel] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="font-body text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={visivel ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-ink-soft/20 px-3 py-2.5 pr-10 font-body text-sm text-ink outline-none transition-colors focus:border-forest disabled:cursor-not-allowed disabled:bg-paper-2/60"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisivel((atual) => !atual)}
          disabled={disabled}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visivel}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-soft/60 hover:text-ink-soft disabled:cursor-not-allowed"
        >
          <IconeOlho visivel={visivel} />
        </button>
      </div>
    </div>
  )
}

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
          <CampoSenha
            id="nova-senha"
            label="Nova senha"
            value={novaSenha}
            onChange={setNovaSenha}
            disabled={salvando}
            placeholder={`Mínimo ${TAMANHO_MINIMO_SENHA} caracteres`}
          />

          <CampoSenha
            id="confirmar-senha"
            label="Confirmar nova senha"
            value={confirmarSenha}
            onChange={setConfirmarSenha}
            disabled={salvando}
            placeholder="Repita a nova senha"
          />

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
