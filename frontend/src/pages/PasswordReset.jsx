import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/Card';
import { CheckCircle2, GraduationCap } from 'lucide-react';

export default function PasswordReset() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { login } = useAuth();

  const initialCredentials = location.state || {};
  const [step, setStep] = useState(initialCredentials.password ? 'reset' : 'initial'); // 'initial' | 'reset' | 'success'
  const [email, setEmail] = useState(initialCredentials.email || '');
  const [password, setPassword] = useState(initialCredentials.password || '');
  const [tempPassword, setTempPassword] = useState(initialCredentials.password || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState('');

  const navigateToHome = (role) => {
    if (role === 'admin') navigate('/admin/cohorts', { replace: true });
    else if (role === 'mentor') navigate('/mentor/dashboard', { replace: true });
    else navigate('/nominator/dashboard', { replace: true });
  };

  // Password strength checker
  const checkPasswordStrength = (pwd) => {
    if (!pwd) return '';
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};:'"|,.<>\/?]/.test(pwd);
    const isLongEnough = pwd.length >= 8;

    const strength = [hasUpper, hasLower, hasDigit, hasSpecial, isLongEnough].filter(Boolean).length;
    
    if (strength === 5) return 'strong';
    if (strength >= 3) return 'medium';
    return 'weak';
  };

  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setNewPassword(pwd);
    setPasswordStrength(checkPasswordStrength(pwd));
  };

  const handleFirstTimeLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/login-first-time', {
        email,
        password,
      });

      if (response.data.requiresPasswordReset) {
        setStep('reset');
        setTempPassword(password);
        showToast('You must set a new password on first login', 'info');
      } else {
        const user = await login(email, password);
        showToast('Login successful! Redirecting...', 'success');
        navigateToHome(user.role);
      }
    } catch (error) {
      showToast(
        error.response?.data?.detail || 'Login failed. Please check your credentials.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    const strength = checkPasswordStrength(newPassword);
    if (strength === 'weak') {
      showToast(
        'Password is too weak. Must have uppercase, lowercase, digit, special char, and 8+ characters',
        'error'
      );
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-temporary-password', {
        email,
        tempPassword,
        newPassword,
        confirmPassword,
      });

      const user = await login(email, newPassword);

      setStep('success');
      showToast('Password reset successfully!', 'success');

      setTimeout(() => navigateToHome(user.role), 1200);
    } catch (error) {
      showToast(
        error.response?.data?.detail || 'Password reset failed',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Mentorship Cohort Manager</h1>
          <p className="mt-1 text-sm text-slate-500">Secure your account before continuing</p>
        </div>

        <Card className="shadow-soft-hover">
          <div className="p-8">
        {step === 'initial' && (
          <>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">First Time Login</h2>
            <p className="mb-6 mt-1 text-sm leading-relaxed text-slate-500">Enter the temporary credentials provided by your administrator.</p>
            
            <form onSubmit={handleFirstTimeLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">Email Address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">Current Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <button type="submit" className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading}>
                {loading ? 'Verifying…' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Set New Password</h2>
            <p className="mb-6 mt-1 text-sm leading-relaxed text-slate-500">For security, create a new password to finish signing in.</p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="current-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">Current Password</label>
                <input
                  id="current-password"
                  type="password"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Enter your temporary password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                {newPassword && (
                  <div className={`mt-2 inline-flex rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${passwordStrength === 'strong' ? 'bg-emerald-50 text-emerald-700' : passwordStrength === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                    Strength: {passwordStrength}
                  </div>
                )}
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-xs font-bold text-slate-700">Password must contain:</p>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> At least 8 characters</li>
                    <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> One uppercase letter</li>
                    <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> One lowercase letter</li>
                    <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> One digit</li>
                    <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> One special character</li>
                  </ul>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">Confirm Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <button type="submit" className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading}>
                {loading ? 'Setting password…' : 'Set Password & Login'}
              </button>
            </form>
          </>
        )}

        {step === 'success' && (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-600" />
            <h2 className="text-xl font-extrabold text-slate-900">Password Reset Successful</h2>
            <p className="mt-2 text-sm text-slate-500">Your account is secure and ready to use.</p>
            <p className="mt-5 text-xs font-semibold text-emerald-700">Redirecting to your workspace…</p>
          </div>
        )}
          </div>
        </Card>
      </main>
    </div>
  );
}
