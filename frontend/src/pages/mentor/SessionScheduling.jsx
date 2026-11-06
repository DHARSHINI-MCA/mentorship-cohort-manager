import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import '../../styles/SessionScheduling.css';

export default function SessionScheduling() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [batchId, setBatchId] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showMarkAttendanceModal, setShowMarkAttendanceModal] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    sessionDate: '',
    startTime: '09:00',
    endTime: '10:00',
    format: 'online',
    location: '',
    meetingLink: '',
  });

  // Fetch sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessionsList', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      try {
        const res = await api.get(`/sessions?batch_id=${batchId}`);
        return res.data;
      } catch (error) {
        showToast('Failed to load sessions', 'error');
        return [];
      }
    },
    enabled: !!batchId,
  });

  // Create session
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const sessionDate = new Date(`${data.sessionDate}T${data.startTime}`);
      return await api.post('/sessions/', {
        ...data,
        batchId,
        sessionDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessionsList'] });
      showToast('Session created successfully!', 'success');
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        sessionDate: '',
        startTime: '09:00',
        endTime: '10:00',
        format: 'online',
        location: '',
        meetingLink: '',
      });
    },
    onError: (error) => {
      showToast(error.response?.data?.detail || 'Failed to create session', 'error');
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.sessionDate) {
      showToast('Title and date are required', 'error');
      return;
    }
    createMutation.mutate(formData);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled':
        return 'info';
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'danger';
      default:
        return 'default';
    }
  };

  const formatDateTime = (date, time) => {
    const sessionDate = new Date(date);
    return `${sessionDate.toLocaleDateString()} at ${time}`;
  };

  return (
    <div className="session-scheduling-page">
      <div className="page-header">
        <h1>Session Scheduling</h1>
        <p>Create and manage training sessions</p>
      </div>

      {/* Batch Selector */}
      <Card>
        <div className="batch-selector">
          <label htmlFor="batch-select">Select Batch</label>
          <select
            id="batch-select"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          >
            <option value="">Choose a batch...</option>
            {/* Would be populated from API */}
          </select>
        </div>
      </Card>

      {batchId && (
        <>
          {/* Controls */}
          <div className="session-controls">
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              + Schedule Session
            </button>
          </div>

          {/* Sessions List */}
          {isLoading ? (
            <Card>
              <p className="loading-text">Loading sessions...</p>
            </Card>
          ) : !sessions || sessions.length === 0 ? (
            <Card>
              <div className="empty-state">
                <p>No sessions scheduled. Create one to get started.</p>
              </div>
            </Card>
          ) : (
            <div className="sessions-list">
              {sessions.map((session) => (
                <Card key={session.id} clickable>
                  <div className="session-item">
                    <div className="session-header">
                      <div>
                        <h3>{session.title}</h3>
                        <p className="session-datetime">
                          📅 {formatDateTime(session.sessionDate, session.startTime)}
                        </p>
                      </div>
                      <Badge text={session.status} variant={getStatusColor(session.status)} />
                    </div>

                    {session.description && (
                      <p className="session-description">{session.description}</p>
                    )}

                    <div className="session-details">
                      <p>
                        <strong>Format:</strong> {session.format || 'Not specified'}
                      </p>
                      <p>
                        <strong>Duration:</strong> {session.startTime} - {session.endTime}
                      </p>
                      {session.format === 'in-person' && session.location && (
                        <p>
                          <strong>Location:</strong> {session.location}
                        </p>
                      )}
                      {session.format === 'online' && session.meetingLink && (
                        <p>
                          <strong>Meeting:</strong> <a href={session.meetingLink} target="_blank" rel="noopener noreferrer">Join</a>
                        </p>
                      )}
                    </div>

                    <div className="attendance-summary">
                      <div className="stat">
                        <span className="label">Total Trainees</span>
                        <span className="value">{session.totalTrainees}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Present</span>
                        <span className="value present">{session.presentCount}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Marked</span>
                        <span className="value">{session.attendanceCount}</span>
                      </div>
                    </div>

                    <div className="session-actions">
                      <button
                        className="action-btn primary"
                        onClick={() => {
                          setSelectedSession(session);
                          setShowMarkAttendanceModal(true);
                        }}
                        disabled={session.status === 'completed'}
                      >
                        Mark Attendance
                      </button>
                      <button className="action-btn secondary">
                        View Details
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Session Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Schedule New Session"
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="form-group">
            <label htmlFor="session-title">Session Title *</label>
            <input
              id="session-title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Week 1: Introduction to Project"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="session-description">Description</label>
            <textarea
              id="session-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What will be covered in this session..."
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="session-date">Date *</label>
              <input
                id="session-date"
                type="date"
                value={formData.sessionDate}
                onChange={(e) => setFormData({ ...formData, sessionDate: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="session-start-time">Start Time *</label>
              <input
                id="session-start-time"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="session-end-time">End Time *</label>
              <input
                id="session-end-time"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="session-format">Format *</label>
              <select
                id="session-format"
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value })}
              >
                <option value="online">Online</option>
                <option value="in-person">In-Person</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            {formData.format !== 'online' && (
              <div className="form-group">
                <label htmlFor="session-location">Location</label>
                <input
                  id="session-location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Building, Room"
                />
              </div>
            )}

            {formData.format !== 'in-person' && (
              <div className="form-group">
                <label htmlFor="session-link">Meeting Link</label>
                <input
                  id="session-link"
                  type="url"
                  value={formData.meetingLink}
                  onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Scheduling...' : 'Schedule Session'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Mark Attendance Modal */}
      <Modal
        isOpen={showMarkAttendanceModal}
        onClose={() => {
          setShowMarkAttendanceModal(false);
          setSelectedSession(null);
        }}
        title={selectedSession ? `Mark Attendance - ${selectedSession.title}` : 'Mark Attendance'}
      >
        {selectedSession && (
          <div className="mark-attendance-modal">
            <p className="session-info">
              {formatDateTime(selectedSession.sessionDate, selectedSession.startTime)}
            </p>
            <p className="trainee-count">
              {selectedSession.totalTrainees} trainees registered for this session
            </p>
            
            <div className="attendance-note">
              <p>Marking attendance for {selectedSession.totalTrainees} trainees...</p>
              <p className="helper-text">Use the attendance marking interface below</p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowMarkAttendanceModal(false);
                  setSelectedSession(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
