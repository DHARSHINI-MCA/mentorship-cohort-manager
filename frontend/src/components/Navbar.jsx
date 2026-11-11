import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, LogOut, ChevronRight } from 'lucide-react';

export function Navbar() {
  const { user, role, logout } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  const roleMeta = {
    admin: { label: 'Admin', color: 'bg-indigo-100 text-indigo-700' },
    mentor: { label: 'Mentor', color: 'bg-blue-100 text-blue-700' },
    nominator: { label: 'Nominator', color: 'bg-purple-100 text-purple-700' },
  };
  const meta = roleMeta[role] || { label: role, color: 'bg-slate-100 text-slate-600' };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-11">

          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center text-white">
                <GraduationCap className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-sm text-slate-800 tracking-tight">
                Cohort<span className="text-emerald-600">Manager</span>
              </span>
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-0 border-l border-slate-200 pl-6">
              {role === 'admin' && (
                <>
                  {[
                    { to: '/admin/cohorts', label: 'Cohorts' },
                    { to: '/admin/training-templates', label: 'Training Plans' },
                    { to: '/admin/feedback-templates', label: 'Feedback Forms' },
                    { to: '/admin/reports', label: 'Reports' },
                  ].map(({ to, label }) => (
                    <Link
                      key={to}
                      to={to}
                      className={`px-3 py-1 text-xs font-semibold transition-colors ${
                        isActive(to)
                          ? 'text-slate-900 border-b-2 border-emerald-600'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </>
              )}
              {role === 'mentor' && (
                <>
                  {[
                    { to: '/mentor/dashboard', label: 'Trainees' },
                    { to: '/mentor/plan', label: 'Training Plan' },
                    { to: '/mentor/batches', label: 'Batches' },
                    { to: '/mentor/sessions', label: 'Sessions' },
                  ].map(({ to, label }) => (
                    <Link
                      key={to}
                      to={to}
                      className={`px-3 py-1 text-xs font-semibold transition-colors ${
                        isActive(to)
                          ? 'text-slate-900 border-b-2 border-emerald-600'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </>
              )}
              {role === 'nominator' && (
                <Link
                  to="/nominator/cohorts"
                  className={`px-3 py-1 text-xs font-semibold transition-colors ${
                    isActive('/nominator/cohorts')
                      ? 'text-slate-900 border-b-2 border-emerald-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Nominations
                </Link>
              )}
            </nav>
          </div>

          {/* User identity */}
          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${meta.color}`}>
              {meta.label}
            </span>
            <span className="text-xs text-slate-700 font-semibold hidden sm:block">{user?.name}</span>
            <span className="text-[11px] text-slate-400 hidden sm:block">{user?.email}</span>
            <button
              onClick={logout}
              title="Sign out"
              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
