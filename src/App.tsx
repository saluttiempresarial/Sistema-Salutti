import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminLayout } from '@/components/AdminLayout'
import { ClienteLayout } from '@/components/ClienteLayout'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { RoleRedirect } from '@/pages/RoleRedirect'
import { TrocarSenhaPage } from '@/pages/TrocarSenhaPage'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { ClientesPage } from '@/pages/admin/ClientesPage'
import { FuncionariosPage } from '@/pages/admin/FuncionariosPage'
import { LicitacoesPage } from '@/pages/admin/licitacoes/LicitacoesPage'
import { PropostaComercialPage as AdminPropostaComercialPage } from '@/pages/admin/licitacoes/PropostaComercialPage'
import { DisputasPage } from '@/pages/admin/disputas/DisputasPage'
import { RelatoriosPage } from '@/pages/admin/relatorios/RelatoriosPage'
import { IndicadoresPage } from '@/pages/admin/indicadores/IndicadoresPage'
import { ConfiguracoesPage } from '@/pages/admin/ConfiguracoesPage'
import { CalendarioPage as AdminCalendarioPage } from '@/pages/admin/CalendarioPage'
import { FuncionarioDashboard } from '@/pages/funcionario/FuncionarioDashboard'
import { InicioPage as ClienteInicioPage } from '@/pages/cliente/InicioPage'
import { LicitacoesPage as ClienteLicitacoesPage } from '@/pages/cliente/LicitacoesPage'
import { LicitacaoDetalhePage } from '@/pages/cliente/LicitacaoDetalhePage'
import { PropostaComercialPage as ClientePropostaComercialPage } from '@/pages/cliente/PropostaComercialPage'
import { CalendarioPage as ClienteCalendarioPage } from '@/pages/cliente/CalendarioPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useAuth } from '@/context/AuthContext'

// /admin/indicadores: o Administrador é levado à aba Indicadores de Relatórios
// (links antigos continuam funcionando); o Analista mantém a página própria.
function IndicadoresAdminRota() {
  const { user } = useAuth()
  if (user?.role === 'admin') return <Navigate to="/admin/relatorios?aba=indicadores" replace />
  return <IndicadoresPage />
}

export default function App() {
  // O cache da regra de prazo interno (dias úteis antes + horário) é carregado
  // pelo AuthProvider assim que há um usuário logado (20/10): antes do login a
  // leitura é negada pelo banco (erro 401 no console) e o cache ficava no
  // padrão de fábrica. Ver src/utils/prazoUtils.ts.
  return (
    // basename vem de import.meta.env.BASE_URL (configurado em vite.config.ts):
    // "/" em desenvolvimento local, "/Salutti-licitacoes/" no build para o
    // GitHub Pages — sem isso, as rotas quebram assim que o app roda fora da raiz.
    // As duas "future flags" abaixo só adotam desde já o comportamento do React
    // Router v7 e silenciam os dois avisos amarelos do console.
    <BrowserRouter
      basename={import.meta.env.BASE_URL}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/redirecionando" element={<RoleRedirect />} />

          {/* Troca de senha obrigatória (senha temporária definida pelo
              Admin no cadastro). Sem allowedRoles: qualquer perfil
              autenticado pode cair aqui — o ProtectedRoute é quem decide,
              via user.forcarTrocaSenha, se a pessoa é redirecionada pra cá. */}
          <Route
            path="/trocar-senha"
            element={
              <ProtectedRoute>
                <TrocarSenhaPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/clientes"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <ClientesPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/funcionarios"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <FuncionariosPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/licitacoes"
            element={
              <ProtectedRoute allowedRoles={['admin', 'funcionario']} requiredModule="licitacoes">
                <AdminLayout>
                  <LicitacoesPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/licitacoes/:id/proposta"
            element={
              <ProtectedRoute allowedRoles={['admin', 'funcionario']} requiredModule="licitacoes">
                <AdminLayout>
                  <AdminPropostaComercialPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/disputas"
            element={
              <ProtectedRoute allowedRoles={['admin', 'funcionario']} requiredModule="disputas">
                <AdminLayout>
                  <DisputasPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/calendario"
            element={
              <ProtectedRoute allowedRoles={['admin', 'funcionario']} requiredModule="licitacoes">
                <AdminLayout>
                  <AdminCalendarioPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/relatorios"
            element={
              <ProtectedRoute allowedRoles={['admin', 'funcionario']} requiredModule="relatorios">
                <AdminLayout>
                  <RelatoriosPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/indicadores"
            element={
              <ProtectedRoute allowedRoles={['admin', 'funcionario']} requiredModule="relatorios">
                <AdminLayout>
                  <IndicadoresAdminRota />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/configuracoes"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <ConfiguracoesPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/funcionario"
            element={
              <ProtectedRoute allowedRoles={['funcionario']}>
                <AdminLayout>
                  <FuncionarioDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/cliente"
            element={
              <ProtectedRoute allowedRoles={['cliente']}>
                <ClienteLayout>
                  <ClienteInicioPage />
                </ClienteLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/cliente/licitacoes"
            element={
              <ProtectedRoute allowedRoles={['cliente']}>
                <ClienteLayout>
                  <ClienteLicitacoesPage />
                </ClienteLayout>
              </ProtectedRoute>
            }
          />

          {/* Detalhe da licitação e Proposta Comercial seguem sem a
              sidebar por enquanto (tela cheia, com o Header antigo) —
              não foram incluídas nesta etapa do redesenho; revisar
              depois se também devem entrar no ClienteLayout. */}
          <Route
            path="/cliente/licitacoes/:id"
            element={
              <ProtectedRoute allowedRoles={['cliente']}>
                <LicitacaoDetalhePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/cliente/licitacoes/:id/proposta"
            element={
              <ProtectedRoute allowedRoles={['cliente']}>
                <ClientePropostaComercialPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/cliente/calendario"
            element={
              <ProtectedRoute allowedRoles={['cliente']}>
                <ClienteLayout>
                  <ClienteCalendarioPage />
                </ClienteLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/cliente/indicadores"
            element={
              <ProtectedRoute allowedRoles={['cliente']}>
                <ClienteLayout>
                  <IndicadoresPage />
                </ClienteLayout>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
