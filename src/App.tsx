import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminLayout } from '@/components/AdminLayout'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { RoleRedirect } from '@/pages/RoleRedirect'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { ClientesPage } from '@/pages/admin/ClientesPage'
import { FuncionariosPage } from '@/pages/admin/FuncionariosPage'
import { LicitacoesPage } from '@/pages/admin/licitacoes/LicitacoesPage'
import { DisputasPage } from '@/pages/admin/disputas/DisputasPage'
import { RelatoriosPage } from '@/pages/admin/relatorios/RelatoriosPage'
import { ConfiguracoesPage } from '@/pages/admin/ConfiguracoesPage'
import { CalendarioPage as AdminCalendarioPage } from '@/pages/admin/CalendarioPage'
import { FuncionarioDashboard } from '@/pages/funcionario/FuncionarioDashboard'
import { ClienteDashboard } from '@/pages/cliente/ClienteDashboard'
import { CalendarioPage as ClienteCalendarioPage } from '@/pages/cliente/CalendarioPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { carregarRegraPrazoCache } from '@/utils/prazoUtils'

export default function App() {
  // Popula o cache em memória da regra de prazo interno (dias úteis antes +
  // horário) uma vez, ao carregar o app — ver comentário no topo de
  // src/utils/prazoUtils.ts. Sem isso, os cálculos de prazo usam o padrão
  // de fábrica (3 dias úteis, 18h) mesmo que o Administrador tenha
  // configurado outro valor em Configurações.
  useEffect(() => {
    carregarRegraPrazoCache()
  }, [])

  return (
    // basename vem de import.meta.env.BASE_URL (configurado em vite.config.ts):
    // "/" em desenvolvimento local, "/Salutti-licitacoes/" no build para o
    // GitHub Pages — sem isso, as rotas quebram assim que o app roda fora da raiz.
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/redirecionando" element={<RoleRedirect />} />

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
                <ClienteDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/cliente/calendario"
            element={
              <ProtectedRoute allowedRoles={['cliente']}>
                <ClienteCalendarioPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
