import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { ArrowLeft, UserPlus, Award, Users, CheckCircle, Mail, Briefcase, Hash } from 'lucide-react';

const traineeCities = [
  { city: 'Ahmedabad', country: 'India', timezone: 'Asia/Kolkata' },
  { city: 'Bengaluru', country: 'India', timezone: 'Asia/Kolkata' },
  { city: 'Chennai', country: 'India', timezone: 'Asia/Kolkata' },
  { city: 'Delhi', country: 'India', timezone: 'Asia/Kolkata' },
  { city: 'Hyderabad', country: 'India', timezone: 'Asia/Kolkata' },
  { city: 'Jaipur', country: 'India', timezone: 'Asia/Kolkata' },
  { city: 'Kochi', country: 'India', timezone: 'Asia/Kolkata' },
  { city: 'Kolkata', country: 'India', timezone: 'Asia/Kolkata' },
  { city: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata' },
  { city: 'Pune', country: 'India', timezone: 'Asia/Kolkata' },
  { city: 'Austin', country: 'USA', timezone: 'America/Chicago' },
  { city: 'Boston', country: 'USA', timezone: 'America/New_York' },
  { city: 'Chicago', country: 'USA', timezone: 'America/Chicago' },
  { city: 'Dallas', country: 'USA', timezone: 'America/Chicago' },
  { city: 'Denver', country: 'USA', timezone: 'America/Denver' },
  { city: 'Honolulu', country: 'USA', timezone: 'Pacific/Honolulu' },
  { city: 'Los Angeles', country: 'USA', timezone: 'America/Los_Angeles' },
  { city: 'New York', country: 'USA', timezone: 'America/New_York' },
  { city: 'San Francisco', country: 'USA', timezone: 'America/Los_Angeles' },
  { city: 'Seattle', country: 'USA', timezone: 'America/Los_Angeles' },
];

const timezonesByCountry = {
  India: [{ value: 'Asia/Kolkata', label: 'India Standard Time (IST)' }],
  USA: [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii-Aleutian Time (HAT)' },
  ],
};

export function CohortNominate() {
  const { id: cohortId } = useParams();
  const [activeTab, setActiveTab] = useState('trainees'); // 'trainees' | 'mentors'
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Mentor form state
  const [mentorName, setMentorName] = useState('');
  const [mentorEmail, setMentorEmail] = useState('');
  const [mentorEmpId, setMentorEmpId] = useState('');

  // Trainee form state
  const [traineeName, setTraineeName] = useState('');
  const [traineeEmail, setTraineeEmail] = useState('');
  const [traineeEmpId, setTraineeEmpId] = useState('');
  const [traineeLocation, setTraineeLocation] = useState('');
  const [traineeTimezone, setTraineeTimezone] = useState('');
  const selectedCity = traineeCities.find(({ city, country }) => traineeLocation === `${city}, ${country}`);
  const timezoneOptions = selectedCity ? timezonesByCountry[selectedCity.country] : [];

  // Fetch Cohort Info
  const { data: cohort, isLoading: cohortLoading } = useQuery({
    queryKey: ['cohort', cohortId],
    queryFn: async () => {
      const res = await api.get(`/cohorts/${cohortId}`);
      return res.data;
    },
  });

  // Fetch Own Mentor Nominees
  const { data: mentorsData, isLoading: mentorsLoading } = useQuery({
    queryKey: ['myNominatedMentors', cohortId],
    queryFn: async () => {
      const res = await api.get(`/cohorts/${cohortId}/mentors?limit=50`);
      return res.data;
    },
  });

  // Fetch Own Trainee Nominees
  const { data: traineesData, isLoading: traineesLoading } = useQuery({
    queryKey: ['myNominatedTrainees', cohortId],
    queryFn: async () => {
      const res = await api.get(`/cohorts/${cohortId}/trainees?limit=50`);
      return res.data;
    },
  });

  const nominateMentorMutation = useMutation({
    mutationFn: async (payload) => {
      return await api.post(`/cohorts/${cohortId}/mentors`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myNominatedMentors', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['nominatorDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['nominatorStats'] });
      showToast('Mentor nominated successfully');
      setMentorName('');
      setMentorEmail('');
      setMentorEmpId('');
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to nominate mentor', 'error');
    },
  });

  const nominateTraineeMutation = useMutation({
    mutationFn: async (payload) => {
      return await api.post(`/cohorts/${cohortId}/trainees`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myNominatedTrainees', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['nominatorDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['nominatorStats'] });
      showToast('Trainee nominated successfully');
      setTraineeName('');
      setTraineeEmail('');
      setTraineeEmpId('');
      setTraineeLocation('');
      setTraineeTimezone('');
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to nominate trainee', 'error');
    },
  });

  const handleMentorSubmit = (e) => {
    e.preventDefault();
    if (!mentorName || !mentorEmail || !mentorEmpId) {
      showToast('Please fill all mentor fields', 'warning');
      return;
    }
    nominateMentorMutation.mutate({
      name: mentorName,
      email: mentorEmail,
      employeeId: mentorEmpId,
      department: '',
    });
  };

  const handleTraineeSubmit = (e) => {
    e.preventDefault();
    if (!traineeName || !traineeEmail || !traineeEmpId || !traineeLocation || !traineeTimezone) {
      showToast('Please fill all trainee fields', 'warning');
      return;
    }
    nominateTraineeMutation.mutate({
      name: traineeName,
      email: traineeEmail,
      employeeId: traineeEmpId,
      department: '',
      location: traineeLocation,
      timezone: traineeTimezone,
    });
  };

  if (cohortLoading) {
    return <SkeletonCard count={2} />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          to="/nominator/cohorts"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Cohorts</span>
        </Link>

        <Card className="border-purple-100 bg-gradient-to-r from-white via-white to-purple-50/30">
          <CardBody className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <h1 className="text-2xl font-black text-slate-900">{cohort?.name}</h1>
                  <Badge variant={cohort?.status}>{cohort?.status}</Badge>
                </div>
                <p className="text-xs text-slate-500 max-w-xl">{cohort?.description}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-500 block">Nomination Period</span>
                <span className="text-xs font-semibold text-purple-700">{cohort?.startDate} &rarr; {cohort?.endDate}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('trainees')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'trainees'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Nominate Trainees ({traineesData?.total || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('mentors')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'mentors'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Nominate Mentors ({mentorsData?.total || 0})</span>
        </button>
      </div>

      {/* TRAINEES VIEW */}
      {activeTab === 'trainees' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Card */}
          <Card className="lg:col-span-1 border-emerald-100">
            <CardHeader>
              <CardTitle subtitle="Trainees are nominated separately from mentors">
                Nominate Trainee
              </CardTitle>
            </CardHeader>
            <CardBody className="p-6">
              <form onSubmit={handleTraineeSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={traineeName}
                    onChange={(e) => setTraineeName(e.target.value)}
                    placeholder="e.g. Jordan Scott"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={traineeEmail}
                    onChange={(e) => setTraineeEmail(e.target.value)}
                    placeholder="jordan.scott@example.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    required
                    value={traineeEmpId}
                    onChange={(e) => setTraineeEmpId(e.target.value)}
                    placeholder="EMP-305"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Location
                  </label>
                  <select
                    required
                    value={traineeLocation}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTraineeLocation(value);
                      const city = traineeCities.find(({ city, country }) => value === `${city}, ${country}`);
                      setTraineeTimezone(city?.timezone || '');
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select a city</option>
                    <optgroup label="India">
                      {traineeCities.filter(({ country }) => country === 'India').map(({ city, country }) => (
                        <option key={city} value={`${city}, ${country}`}>{city}, {country}</option>
                      ))}
                    </optgroup>
                    <optgroup label="USA">
                      {traineeCities.filter(({ country }) => country === 'USA').map(({ city, country }) => (
                        <option key={city} value={`${city}, ${country}`}>{city}, USA</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Time Zone
                  </label>
                  <select
                    required
                    value={traineeTimezone}
                    onChange={(e) => setTraineeTimezone(e.target.value)}
                    disabled={!selectedCity}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">{selectedCity ? 'Select a time zone' : 'Select a city first'}</option>
                    {timezoneOptions.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={nominateTraineeMutation.isPending}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Submit Trainee Nomination</span>
                </button>
              </form>
            </CardBody>
          </Card>

          {/* Nominees Grid */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Your Nominated Trainees</h3>
            {traineesLoading ? (
              <SkeletonCard count={3} />
            ) : traineesData?.items?.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No trainees nominated yet"
                description="Use the form on the left to nominate candidates for this cohort."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {traineesData?.items?.map((trainee) => (
                  <Card key={trainee.id}>
                    <CardBody className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{trainee.name}</h4>
                          <p className="text-xs text-slate-500">{trainee.email}</p>
                        </div>
                        <span className="font-mono text-[10px] bg-slate-100 font-bold px-2 py-0.5 rounded text-slate-600">
                          {trainee.employeeId}
                        </span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 flex justify-between items-center">
                        <span className="font-medium bg-slate-100 px-2 py-0.5 rounded">
                          {trainee.location || 'Location not provided'}
                        </span>
                        <span className="text-[11px] text-slate-400">{trainee.timezone || 'Time zone not provided'}</span>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MENTORS VIEW */}
      {activeTab === 'mentors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Card */}
          <Card className="lg:col-span-1 border-blue-100">
            <CardHeader>
              <CardTitle subtitle="Nominated mentors are reviewed by admin">
                Nominate Mentor
              </CardTitle>
            </CardHeader>
            <CardBody className="p-6">
              <form onSubmit={handleMentorSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mentor Name
                  </label>
                  <input
                    type="text"
                    required
                    value={mentorName}
                    onChange={(e) => setMentorName(e.target.value)}
                    placeholder="e.g. Morgan Taylor"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={mentorEmail}
                    onChange={(e) => setMentorEmail(e.target.value)}
                    placeholder="morgan.taylor@example.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    required
                    value={mentorEmpId}
                    onChange={(e) => setMentorEmpId(e.target.value)}
                    placeholder="e.g. EMP-123456"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={nominateMentorMutation.isPending}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Submit Mentor Nomination</span>
                </button>
              </form>
            </CardBody>
          </Card>

          {/* Mentors Grid */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Your Nominated Mentors</h3>
            {mentorsLoading ? (
              <SkeletonCard count={3} />
            ) : mentorsData?.items?.length === 0 ? (
              <EmptyState
                icon={Award}
                title="No mentors nominated yet"
                description="Use the form on the left to nominate mentors for this cohort."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mentorsData?.items?.map((mentor) => (
                  <Card key={mentor.id}>
                    <CardBody className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{mentor.name}</h4>
                          <p className="text-xs text-slate-500">{mentor.email}</p>
                        </div>
                        <Badge variant={!mentor.isLoginActive || !mentor.isAccountActive ? 'draft' : 'active'}>
                          {!mentor.isLoginActive ? 'Pending Activation' : !mentor.isAccountActive ? 'Account Deactivated' : 'Login Active'}
                        </Badge>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 flex justify-between items-center">
                        <span className="font-medium bg-slate-100 px-2 py-0.5 rounded">
                          {mentor.employeeId || 'Employee ID not provided'}
                        </span>
                        <span className="text-[11px] text-slate-400">Nominated by you</span>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
