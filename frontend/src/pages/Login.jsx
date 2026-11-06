import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardBody } from '../components/Card';
import { GraduationCap, ArrowRight, Shield, Award, Users } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const routeToRoleHome = (user) => {
    if (user.role === 'admin') navigate('/admin/cohorts');
    else if (user.role === 'mentor') navigate('/mentor/dashboard');
    else if (user.role === 'nominator') navigate('/nominator/cohorts');
  };

  const routeToPasswordSetup = (loginEmail, loginPassword) => {
    showToast('Use your temporary password to set a new password', 'info');
    navigate('/password-reset', { state: { email: loginEmail, password: loginPassword } });
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!email || !password) {
      showToast('Please enter both email and password', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const user = await login(email, password);
      showToast(`Welcome back, ${user.name}!`, 'success');
      routeToRoleHome(user);
    } catch (err) {
      if (err.response?.data?.code === 'TEMPORARY_PASSWORD_RESET_REQUIRED') {
        routeToPasswordSetup(email, password);
        return;
      }
      const detail = err.response?.data?.detail || 'Invalid email or password';
      showToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setIsSubmitting(true);
    login(demoEmail, demoPassword)
      .then((user) => {
        showToast(`Signed in as ${user.name} (${user.role})`, 'success');
        routeToRoleHome(user);
      })
      .catch((err) => {
        if (err.response?.data?.code === 'TEMPORARY_PASSWORD_RESET_REQUIRED') {
          routeToPasswordSetup(demoEmail, demoPassword);
          return;
        }
        showToast(err.response?.data?.detail || 'Login failed', 'error');
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 mx-auto mb-4">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Mentorship Cohort Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Sign in to manage training tracks, cohorts, and weekly reviews
          </p>
        </div>

        {/* Login Card */}
        <Card className="shadow-soft-hover">
          <CardBody className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all text-slate-800 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all text-slate-800 placeholder-slate-400"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Logins: Admin and Mentor Only */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 text-center">
                Quick Demo Switcher
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@example.com', 'Admin@123')}
                  className="p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 flex flex-col items-center gap-1.5 text-center transition-all group"
                >
                  <Shield className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-slate-800">Admin</span>
                  <span className="text-[10px] text-slate-400">admin@example.com</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('sarah.jenkins@example.com', 'Mentor@123')}
                  className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex flex-col items-center gap-1.5 text-center transition-all group"
                >
                  <Award className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-slate-800">Mentor</span>
                  <span className="text-[10px] text-slate-400">sarah.jenkins@example.com</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('nominator@example.com', 'Nominator@123')}
                  className="p-3 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 flex flex-col items-center gap-1.5 text-center transition-all group"
                >
                  <Users className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-slate-800">Nominator</span>
                  <span className="text-[10px] text-slate-400">nominator@example.com</span>
                </button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
