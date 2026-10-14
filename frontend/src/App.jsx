import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { HomeRedirect, RequireAuth, RequireOnboarding, RequireRole } from './routes/guards';
import AppLayout from './components/AppLayout';
import { NutriProvider } from './context/NutriContext';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import UploadMealPage from './pages/UploadMealPage';
import MealResultPage from './pages/MealResultPage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';
import DownloadAppPage from './pages/DownloadAppPage';
import PricingPage from './pages/PricingPage';

// Nutricionista
import NutriGate from './pages/nutri/NutriGate';
import NutriApplicationPage from './pages/nutri/NutriApplicationPage';
import NutriPatientsPage from './pages/nutri/NutriPatientsPage';
import NutriPatientPage from './pages/nutri/NutriPatientPage';
import NutriGoalsPage from './pages/nutri/NutriGoalsPage';
import NutriProfilePage from './pages/nutri/NutriProfilePage';
import NutriSubscriptionPage from './pages/nutri/NutriSubscriptionPage';

// Administrador
import AdminSummaryPage from './pages/admin/AdminSummaryPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminUserPage from './pages/admin/AdminUserPage';
import AdminNutritionistsPage from './pages/admin/AdminNutritionistsPage';
import AdminNutritionistPage from './pages/admin/AdminNutritionistPage';

// Datos de la cuenta de nutricionista disponibles en todas sus pantallas.
function NutriRoot() {
  return (
    <NutriProvider>
      <Outlet />
    </NutriProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        {/* Paciente (usuario común) */}
        <Route element={<RequireRole role="USER" />}>
          {/* La propia pantalla de onboarding */}
          <Route path="/onboarding" element={<OnboardingPage />} />
          {/* Requiere objetivos ya configurados */}
          <Route element={<RequireOnboarding />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/scan" element={<UploadMealPage />} />
              <Route path="/meals/:id" element={<MealResultPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/pricing" element={<PricingPage />} />
            </Route>
          </Route>
        </Route>

        {/* Nutricionista */}
        <Route element={<RequireRole role="NUTRITIONIST" />}>
          <Route element={<NutriRoot />}>
            <Route element={<AppLayout />}>
              <Route path="/nutri/solicitud" element={<NutriApplicationPage />} />
              <Route element={<NutriGate />}>
                <Route path="/nutri" element={<Navigate to="/nutri/pacientes" replace />} />
                <Route path="/nutri/pacientes" element={<NutriPatientsPage />} />
                <Route path="/nutri/pacientes/:id" element={<NutriPatientPage />} />
                <Route path="/nutri/pacientes/:id/metas" element={<NutriGoalsPage />} />
                <Route path="/nutri/pacientes/:patientId/comidas/:id" element={<MealResultPage />} />
                <Route path="/nutri/perfil" element={<NutriProfilePage />} />
                <Route path="/nutri/suscripcion" element={<NutriSubscriptionPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        {/* Administrador */}
        <Route element={<RequireRole role="ADMIN" />}>
          <Route element={<AppLayout />}>
            <Route path="/admin" element={<AdminSummaryPage />} />
            <Route path="/admin/usuarios" element={<AdminUsersPage />} />
            <Route path="/admin/usuarios/:id" element={<AdminUserPage />} />
            <Route path="/admin/nutricionistas" element={<AdminNutritionistsPage />} />
            <Route path="/admin/nutricionistas/:id" element={<AdminNutritionistPage />} />
          </Route>
        </Route>

        {/* "Descargar app": la ven todos los roles */}
        <Route element={<AppLayout />}>
          <Route path="/download" element={<DownloadAppPage />} />
        </Route>
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="page page--narrow" style={{ minHeight: '100vh', justifyContent: 'center' }}>
      <div className="card">
        <div className="empty-state">
          <div className="empty-state__icon" style={{ background: '#fff', boxShadow: 'var(--shadow-card)' }}>
            <img src="/logo.png" alt="" style={{ height: 34 }} />
          </div>
          <span className="eyebrow">Error 404</span>
          <h3 style={{ fontSize: '1.3rem', marginTop: 4 }}>No encontramos esa página</h3>
          <p>Puede que el enlace esté mal escrito o que la página ya no exista.</p>
          <a href="/" className="btn btn-primary" style={{ marginTop: 16 }}>Volver al inicio</a>
        </div>
      </div>
    </div>
  );
}
