// src/pages/HomePage.tsx
//
// A entrada do sistema é a própria tela de acesso (/login): quem chega em "/"
// sem sessão vai direto para lá, e quem já está logado vai para a sua área.

import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ROLE_HOME_ROUTE } from '@/types/auth'

export function HomePage() {
  const { isAuthenticated, user } = useAuth()

  if (isAuthenticated && user) {
    return <Navigate to={ROLE_HOME_ROUTE[user.role]} replace />
  }

  return <Navigate to="/login" replace />
}
