import React, { useState } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';
import '../styles/ChangePassword.css';

export default function ChangePassword() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      showToast('Current password is required', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
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
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });

      showToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStrength('');
    } catch (error) {
      showToast(
        error.response?.data?.detail || 'Failed to change password',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-page">
      <Card>
        <div className="change-password-content">
          <h2>Change Password</h2>
          <p className="description">Update your password to keep your account secure</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="current-password">Current Password</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                required
              />
            </div>

            <div className="divider"></div>

            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={handlePasswordChange}
                placeholder="Create a strong password"
                required
              />
              {newPassword && (
                <div className={`password-strength ${passwordStrength}`}>
                  Strength: {passwordStrength}
                </div>
              )}
              <div className="password-requirements">
                <p>Password must contain:</p>
                <ul>
                  <li>At least 8 characters</li>
                  <li>One uppercase letter</li>
                  <li>One lowercase letter</li>
                  <li>One digit</li>
                  <li>One special character</li>
                </ul>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                required
              />
            </div>

            <div className="button-group">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
