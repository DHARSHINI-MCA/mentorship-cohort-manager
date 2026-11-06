import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { Login } from './pages/Login';
import PasswordReset from './pages/PasswordReset';
import { CohortsList } from './pages/admin/CohortsList';
import { CohortDetail } from './pages/admin/CohortDetail';
import { TrainingTemplates } from './pages/admin/TrainingTemplates';
import { FeedbackTemplates } from './pages/admin/FeedbackTemplates';
import { AdminReports } from './pages/admin/AdminReports';

import { MentorDashboard } from './pages/mentor/MentorDashboard';
import { TraineeDetail } from './pages/mentor/TraineeDetail';
import { MentorPlan } from './pages/mentor/MentorPlan';
import BatchManagement from './pages/mentor/BatchManagement';
import SessionHistory from './pages/mentor/SessionHistory';
import NominatorDashboard from './pages/nominator/NominatorDashboard';
import { CohortNominate } from './pages/nominator/CohortNominate';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RootRedirect() {
  const { role, isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (role === 'admin') return <Navigate to="/admin/cohorts" replace />;
  if (role === 'mentor') return <Navigate to="/mentor/dashboard" replace />;
  if (role === 'nominator') return <Navigate to="/nominator/cohorts" replace />;
  return <Navigate to="/login" replace />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Route */}
              <Route path="/login" element={<Login />} />
              <Route path="/password-reset" element={<PasswordReset />} />

              {/* Admin Routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin/dashboard" element={<Navigate to="/admin/cohorts" replace />} />
                <Route path="/admin/cohorts" element={<CohortsList />} />
                <Route path="/admin/cohorts/:id" element={<CohortDetail />} />
                <Route path="/admin/training-templates" element={<TrainingTemplates />} />
                <Route path="/admin/feedback-templates" element={<FeedbackTemplates />} />
                <Route path="/admin/reports" element={<AdminReports />} />
              </Route>

              {/* Mentor Routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'mentor']} />}>
                <Route path="/mentor/dashboard" element={<MentorDashboard />} />
                <Route path="/mentor/plan" element={<MentorPlan />} />
                <Route path="/mentor/trainees/:id" element={<TraineeDetail />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['mentor']} />}>
                <Route path="/mentor/batches" element={<BatchManagement />} />
                <Route path="/mentor/sessions" element={<SessionHistory />} />
              </Route>

              {/* Nominator Routes */}
              <Route element={<ProtectedRoute allowedRoles={['nominator']} />}>
                <Route path="/nominator/cohorts" element={<NominatorDashboard />} />
                <Route path="/nominator/cohorts/:id/nominations" element={<CohortNominate />} />
              </Route>

              {/* Root Fallback */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
