import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import '../../styles/UserManagement.css';

export default function UserManagement() {
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [tempPassword, setTempPassword] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'mentor',
    location: '',
    timezone: '',
  });

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { role: filter } : {};
      const response = await api.get('/admin/users/users', { params });
      setUsers(response.data);
    } catch (error) {
      showToast('Failed to fetch users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  // Handle create user with temp password
  const handleCreateUser = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.role) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      const response = await api.post('/admin/users/create-with-temp-password', formData);
      
      setTempPassword(response.data.tempPassword);
      setShowCreateModal(false);
      setShowTempPasswordModal(true);

      // Reset form
      setFormData({
        name: '',
        email: '',
        role: 'mentor',
        location: '',
        timezone: '',
      });

      // Refresh users list
      await fetchUsers();
      showToast('User created successfully', 'success');
    } catch (error) {
      showToast(
        error.response?.data?.detail || 'Failed to create user',
        'error'
      );
    }
  };

  // Handle deactivate user
  const handleDeactivateUser = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;

    try {
      await api.put(`/admin/users/users/${userId}/deactivate`);
      showToast('User deactivated', 'success');
      fetchUsers();
    } catch (error) {
      showToast('Failed to deactivate user', 'error');
    }
  };

  // Handle activate user
  const handleActivateUser = async (userId) => {
    try {
      await api.put(`/admin/users/users/${userId}/activate`);
      showToast('User activated', 'success');
      fetchUsers();
    } catch (error) {
      showToast('Failed to activate user', 'error');
    }
  };

  // Handle reset temp password
  const handleResetTempPassword = async (userId) => {
    try {
      const response = await api.post(`/admin/users/users/${userId}/reset-temp-password`);
      setTempPassword(response.data.tempPassword);
      setSelectedUser({ userId, email: response.data.email });
      setShowTempPasswordModal(true);
      showToast('Temporary password reset', 'success');
    } catch (error) {
      showToast('Failed to reset password', 'error');
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    showToast('Password copied to clipboard', 'success');
  };

  const filteredUsers = users;

  return (
    <div className="user-management-page">
      <div className="user-management-header">
        <div>
          <h1>User Management</h1>
          <p>Create and manage user accounts</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Create User
        </button>
      </div>

      <div className="user-management-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Users
        </button>
        <button 
          className={`filter-btn ${filter === 'admin' ? 'active' : ''}`}
          onClick={() => setFilter('admin')}
        >
          Admins
        </button>
        <button 
          className={`filter-btn ${filter === 'nominator' ? 'active' : ''}`}
          onClick={() => setFilter('nominator')}
        >
          Nominators
        </button>
        <button 
          className={`filter-btn ${filter === 'mentor' ? 'active' : ''}`}
          onClick={() => setFilter('mentor')}
        >
          Mentors
        </button>
        <button 
          className={`filter-btn ${filter === 'trainee' ? 'active' : ''}`}
          onClick={() => setFilter('trainee')}
        >
          Trainees
        </button>
      </div>

      {loading ? (
        <Card>
          <p className="loading">Loading users...</p>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <p className="empty-state">No users found</p>
        </Card>
      ) : (
        <div className="users-grid">
          {filteredUsers.map((user) => (
            <Card key={user.id}>
              <div className="user-card">
                <div className="user-header">
                  <div>
                    <h3>{user.name}</h3>
                    <p className="email">{user.email}</p>
                  </div>
                  <Badge 
                    text={user.role}
                    variant={
                      user.role === 'admin' ? 'danger' :
                      user.role === 'nominator' ? 'warning' :
                      user.role === 'mentor' ? 'info' : 'default'
                    }
                  />
                </div>

                <div className="user-details">
                  <p>
                    <span className="label">Status:</span>
                    <span className={`status ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                  {user.firstLoginPasswordReset && (
                    <p className="warning-text">
                      ⚠️ Requires password reset on first login
                    </p>
                  )}
                  {user.createdAt && (
                    <p>
                      <span className="label">Created:</span>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  )}
                  {user.lastLoginAt && (
                    <p>
                      <span className="label">Last Login:</span>
                      {new Date(user.lastLoginAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="user-actions">
                  <button 
                    className="action-btn reset"
                    onClick={() => handleResetTempPassword(user.id)}
                    title="Reset temporary password"
                  >
                    🔐 Reset Password
                  </button>
                  {user.isActive ? (
                    <button 
                      className="action-btn deactivate"
                      onClick={() => handleDeactivateUser(user.id)}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button 
                      className="action-btn activate"
                      onClick={() => handleActivateUser(user.id)}
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create User Modal */}
      <Modal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User"
      >
        <form onSubmit={handleCreateUser}>
          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter user's full name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Role *</label>
            <select 
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              required
            >
              <option value="mentor">Mentor</option>
              <option value="nominator">Nominator</option>
              <option value="trainee">Trainee</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., New York, USA"
            />
          </div>

          <div className="form-group">
            <label htmlFor="timezone">Timezone</label>
            <select 
              id="timezone"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            >
              <option value="">Select timezone</option>
              <option value="UTC">UTC</option>
              <option value="EST">Eastern Time (EST)</option>
              <option value="CST">Central Time (CST)</option>
              <option value="MST">Mountain Time (MST)</option>
              <option value="PST">Pacific Time (PST)</option>
              <option value="IST">Indian Standard Time (IST)</option>
              <option value="GST">Gulf Standard Time (GST)</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create User
            </button>
          </div>
        </form>
      </Modal>

      {/* Temporary Password Display Modal */}
      <Modal 
        isOpen={showTempPasswordModal}
        onClose={() => setShowTempPasswordModal(false)}
        title="Temporary Password Created"
      >
        <div className="temp-password-modal">
          <p className="info-text">
            Share this temporary password with the user. They must reset it on their first login.
          </p>

          <div className="password-box">
            <div className="password-display">
              <code>{tempPassword}</code>
              <button 
                type="button"
                className="copy-btn"
                onClick={handleCopyPassword}
                title="Copy to clipboard"
              >
                📋 Copy
              </button>
            </div>
          </div>

          <div className="warning-section">
            <p className="warning-title">⚠️ Important:</p>
            <ul>
              <li>This password is only shown once</li>
              <li>User must reset it on first login</li>
              <li>Never share passwords through insecure channels</li>
              <li>Use secure email or direct message to share</li>
            </ul>
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={() => setShowTempPasswordModal(false)}
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
