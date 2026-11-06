import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import '../../styles/NominationsList.css';

export default function NominationsList() {
  const { cohortId } = useParams();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedNomination, setSelectedNomination] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch nominations for cohort
  const { data: nominations, isLoading } = useQuery({
    queryKey: ['cohortNominations', cohortId, typeFilter, statusFilter, page],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({
          page,
          limit: 10,
        });
        if (typeFilter) params.append('type_filter', typeFilter);
        if (statusFilter) params.append('status_filter', statusFilter);

        const res = await api.get(
          `/nominator/cohorts/${cohortId}/nominations?${params}`
        );
        return res.data;
      } catch (error) {
        showToast('Failed to load nominations', 'error');
        return null;
      }
    },
    enabled: !!cohortId,
  });

  // Update nomination status mutation
  const updateMutation = useMutation({
    mutationFn: async ({ nominationId, status, notes }) => {
      return await api.put(
        `/nominator/nominations/${nominationId}/status`,
        { status, notes }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohortNominations'] });
      queryClient.invalidateQueries({ queryKey: ['nominatorDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['nominatorStats'] });
      showToast('Nomination status updated', 'success');
      setShowModal(false);
      setSelectedNomination(null);
    },
    onError: (error) => {
      showToast(error.response?.data?.detail || 'Failed to update nomination', 'error');
    },
  });

  const handleStatusUpdate = (nomination) => {
    setSelectedNomination(nomination);
    setNewStatus(nomination.status);
    setNotes(nomination.notes || '');
    setShowModal(true);
  };

  const handleSaveUpdate = () => {
    if (!newStatus) {
      showToast('Please select a status', 'error');
      return;
    }

    updateMutation.mutate({
      nominationId: selectedNomination.id,
      status: newStatus,
      notes,
    });
  };

  const totalPages = nominations ? Math.ceil(nominations.total / nominations.limit) : 1;

  return (
    <div className="nominations-list">
      <div className="page-header">
        <h1>Nominations</h1>
        <p>Review and manage mentor and trainee nominations</p>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Type</label>
          <select
            value={typeFilter || ''}
            onChange={(e) => {
              setTypeFilter(e.target.value || null);
              setPage(1);
            }}
          >
            <option value="">All Types</option>
            <option value="mentor">Mentors</option>
            <option value="trainee">Trainees</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Status</label>
          <select
            value={statusFilter || ''}
            onChange={(e) => {
              setStatusFilter(e.target.value || null);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="filter-summary">
          {nominations && (
            <p>Showing {nominations.items.length} of {nominations.total} nominations</p>
          )}
        </div>
      </div>

      {/* Nominations List */}
      {isLoading ? (
        <Card>
          <p className="loading-text">Loading nominations...</p>
        </Card>
      ) : !nominations || nominations.items.length === 0 ? (
        <Card>
          <div className="empty-state">
            <p>No nominations found</p>
          </div>
        </Card>
      ) : (
        <div className="nominations-table">
          <div className="table-header">
            <div className="col col-name">Name</div>
            <div className="col col-type">Type</div>
            <div className="col col-location">Location</div>
            <div className="col col-status">Status</div>
            <div className="col col-action">Action</div>
          </div>

          <div className="table-body">
            {nominations.items.map((nomination) => (
              <div key={nomination.id} className="table-row">
                <div className="col col-name">
                  <div className="nominee-info">
                    <p className="name">{nomination.name}</p>
                    <p className="email">{nomination.email}</p>
                  </div>
                </div>

                <div className="col col-type">
                  <Badge
                    text={nomination.type}
                    variant={nomination.type === 'mentor' ? 'info' : 'default'}
                  />
                </div>

                <div className="col col-location">
                  <div className="location-info">
                    {nomination.location && <p>{nomination.location}</p>}
                    {nomination.timezone && <p className="timezone">{nomination.timezone}</p>}
                  </div>
                </div>

                <div className="col col-status">
                  <Badge
                    text={nomination.status}
                    variant={
                      nomination.status === 'approved' ? 'success' :
                      nomination.status === 'pending' ? 'warning' : 'danger'
                    }
                  />
                </div>

                <div className="col col-action">
                  <button
                    className="action-btn"
                    onClick={() => handleStatusUpdate(nomination)}
                    disabled={updateMutation.isPending}
                  >
                    Update
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {nominations && totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="pagination-btn"
          >
            ← Previous
          </button>

          <div className="pagination-info">
            Page {page} of {totalPages}
          </div>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="pagination-btn"
          >
            Next →
          </button>
        </div>
      )}

      {/* Update Status Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedNomination(null);
        }}
        title="Update Nomination Status"
      >
        {selectedNomination && (
          <div className="modal-content">
            <div className="nominee-details">
              <p><strong>{selectedNomination.name}</strong></p>
              <p className="email">{selectedNomination.email}</p>
              <p className="type">
                Type: <Badge text={selectedNomination.type} />
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="">Select Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes (Optional)</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes or reasons for this decision"
                rows="4"
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveUpdate}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
