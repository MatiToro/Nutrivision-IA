import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth, RequireOnboarding } from './routes/guards';
import AppLayout from './components/AppLayout';

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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Requiere sesión, pero es la propia pantalla de onboarding */}
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>

      {/* Requiere sesión + objetivos ya configurados */}
      <Route element={<RequireAuth />}>
        <Route element={<RequireOnboarding />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/scan" element={<UploadMealPage />} />
            <Route path="/meals/:id" element={<MealResultPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/download" element={<DownloadAppPage />} />
            <Route path="/pricing" element={<PricingPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
      <p className="eyebrow">Error 404</p>
      <h1>No encontramos esa página</h1>
      <a href="/dashboard" className="btn btn-primary">Volver al panel</a>
    </div>
  );
}
