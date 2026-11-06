import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import '../../styles/NominatorDashboard.css';

export default function NominatorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Fetch nominator dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['nominatorDashboard'],
    queryFn: async () => {
      try {
        const res = await api.get('/nominator/dashboard');
        return res.data;
      } catch (error) {
        showToast('Failed to load dashboard', 'error');
        return null;
      }
    },
    enabled: !!user,
  });

  const isLoading = dashboardLoading;

  if (isLoading) {
    return (
      <div className="nominator-dashboard">
        <div className="loading-container">
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="nominator-dashboard">
      {/* Assigned Cohorts */}
      {dashboard && (
        <div className="cohorts-section">
          <div className="section-header">
            <h2>Your Assigned Cohorts</h2>
            <span className="badge-count">{dashboard.assignedCohorts}</span>
          </div>

          {dashboard.cohortsList.length === 0 ? (
            <Card>
              <div className="empty-state">
                <p>No cohorts assigned yet. Contact your administrator.</p>
              </div>
            </Card>
          ) : (
            <div className="cohorts-grid">
              {dashboard.cohortsList.map((cohort) => {
                const status = (cohort.status || 'active').toLowerCase();
                const statusVariant = status === 'active'
                  ? 'active'
                  : status === 'draft'
                    ? 'draft'
                    : ['closed', 'complete', 'completed'].includes(status)
                      ? 'closed'
                      : 'default';

                return (
                <Card key={cohort.cohortId} clickable>
                  <div className="cohort-card">
                    <div className="cohort-header">
                      <h3>{cohort.cohortName}</h3>
                      <Badge variant={statusVariant}>{status}</Badge>
                    </div>

                    <div className="cohort-stats">
                      <div className="stat">
                        <span className="label">Mentors</span>
                        <span className="value">{cohort.mentorsNominated}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Trainees</span>
                        <span className="value">{cohort.traineesNominated}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Unassigned</span>
                        <span className="value pending">{cohort.pendingNominations}</span>
                      </div>
                    </div>

                    <button
                      className="view-btn"
                      onClick={() => navigate(`/nominator/cohorts/${cohort.cohortId}/nominations`)}
                    >
                      Nominate / View Candidates →
                    </button>
                  </div>
                </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
