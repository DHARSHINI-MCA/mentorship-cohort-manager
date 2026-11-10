import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from './Navbar';

export function ProtectedRoute({ allowedRoles = [] }) {
  const { user, role, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 font-semibold tracking-wide">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // Redirect based on current role
    if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (role === 'nominator') return <Navigate to="/nominator/cohorts" replace />;
    if (role === 'mentor') return <Navigate to="/mentor/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-5">
        <Outlet />
      </main>
    </div>
  );
}
