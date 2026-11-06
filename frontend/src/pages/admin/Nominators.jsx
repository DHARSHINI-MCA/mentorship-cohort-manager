import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card, CardBody, CardFooter } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { Users, PlusCircle, Trash2, Mail, Shield, Calendar } from 'lucide-react';

export function Nominators() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Nominator@123');
  const [selectedCohorts, setSelectedCohorts] = useState([]);

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: nominators = [], isLoading } = useQuery({
    queryKey: ['nominatorsList'],
    queryFn: async () => {
      const res = await api.get('/users/nominators');
      return res.data;
    },
  });

  const { data: cohortsData } = useQuery({
    queryKey: ['cohortsSelection'],
    queryFn: async () => {
      const res = await api.get('/cohorts?limit=50');
      return res.data?.items || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      return await api.post('/users/nominators', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nominatorsList'] });
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
      showToast('Nominator account created');
      setIsModalOpen(false);
      setName('');
      setEmail('');
      setPassword('Nominator@123');
      setSelectedCohorts([]);
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to create nominator', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await api.delete(`/users/nominators/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nominatorsList'] });
      showToast('Nominator removed');
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to remove nominator', 'error');
    },
  });

  const toggleCohort = (id) => {
    setSelectedCohorts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }
    createMutation.mutate({
      name,
      email,
      password,
      assignedCohortIds: selectedCohorts,
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Nominator Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create nominator users and assign them to specific cohorts so they can submit mentor and trainee nominations
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Nominator</span>
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard count={3} />
        </div>
      ) : nominators.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No nominators registered"
          description="Create your first nominator to delegate mentor and trainee nominations."
          action={
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Nominator</span>
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nominators.map((nominator) => (
            <Card key={nominator.id} hover className="flex flex-col justify-between">
              <CardBody className="p-6">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{nominator.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{nominator.email}</span>
                    </div>
                  </div>
                  <Badge variant="nominator">Nominator</Badge>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Added {new Date(nominator.createdAt).toLocaleDateString()}</span>
                  </div>
                  <span className="font-semibold text-emerald-600">Active</span>
                </div>
              </CardBody>

              <CardFooter className="bg-slate-50/50 justify-end">
                <button
                  onClick={() => {
                    if (window.confirm(`Delete nominator "${nominator.name}"?`)) {
                      deleteMutation.mutate(nominator.id);
                    }
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Remove nominator"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Nominator Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Nominator">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rachel Foster"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rachel.foster@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Login Password</label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          {/* Cohort Assignment */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Assign to Initial Cohorts
            </label>
            {cohortsData?.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No cohorts available.</p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2.5">
                {cohortsData?.map((cohort) => {
                  const isChecked = selectedCohorts.includes(cohort.id);
                  return (
                    <label
                      key={cohort.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs font-semibold ${
                        isChecked ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{cohort.name}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCohort(cohort.id)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Nominator'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
