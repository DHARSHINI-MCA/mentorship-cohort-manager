import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useParams } from 'react-router-dom';
import Card from '../../components/Card';
import '../../styles/NominateForm.css';

export default function NominateMentor() {
  const { cohortId } = useParams();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    employeeId: '',
    location: '',
    timezone: '',
    experience: '',
    skills: '',
  });

  const [loading, setLoading] = useState(false);

  // Get available timezones
  const timezones = [
    'UTC', 'EST', 'CST', 'MST', 'PST',
    'IST', 'GST', 'SGT', 'JST', 'AEST'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSkillsChange = (e) => {
    const skills = e.target.value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    setFormData(prev => ({
      ...prev,
      skills: e.target.value
    }));
  };

  const nominateMutation = useMutation({
    mutationFn: async (data) => {
      return await api.post(
        `/nominations/mentors?cohort_id=${cohortId}`,
        {
          name: data.name,
          email: data.email,
          department: data.department,
          employeeId: data.employeeId,
          location: data.location,
          timezone: data.timezone,
          experience: data.experience,
          skills: data.skills
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0)
        }
      );
    },
    onSuccess: () => {
      showToast('Mentor nominated successfully!', 'success');
      setFormData({
        name: '',
        email: '',
        department: '',
        employeeId: '',
        location: '',
        timezone: '',
        experience: '',
        skills: '',
      });
    },
    onError: (error) => {
      showToast(
        error.response?.data?.detail || 'Failed to nominate mentor',
        'error'
      );
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.department) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    nominateMutation.mutate(formData);
  };

  return (
    <div className="nominate-form-page">
      <div className="form-header">
        <h1>Nominate a Mentor</h1>
        <p>Add a new mentor to this cohort</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="nominate-form">
          {/* Basic Information */}
          <div className="form-section">
            <h3>Basic Information</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="department">Department *</label>
                <input
                  id="department"
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="e.g., Engineering"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="employeeId">Employee ID</label>
                <input
                  id="employeeId"
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  placeholder="e.g., EMP-123456"
                />
              </div>
            </div>
          </div>

          {/* Location & Timezone */}
          <div className="form-section">
            <h3>Location & Timezone</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                  id="location"
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., New York, USA"
                />
              </div>

              <div className="form-group">
                <label htmlFor="timezone">Timezone</label>
                <select
                  id="timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                >
                  <option value="">Select Timezone</option>
                  {timezones.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Experience & Skills */}
          <div className="form-section">
            <h3>Experience & Skills</h3>

            <div className="form-group">
              <label htmlFor="experience">Years of Experience</label>
              <input
                id="experience"
                type="text"
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                placeholder="e.g., 5+ years in software development"
              />
            </div>

            <div className="form-group">
              <label htmlFor="skills">Technical Skills (comma-separated)</label>
              <textarea
                id="skills"
                name="skills"
                value={formData.skills}
                onChange={handleSkillsChange}
                placeholder="e.g., Python, JavaScript, React, Node.js"
                rows="4"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={nominateMutation.isPending}
            >
              {nominateMutation.isPending ? 'Nominating...' : 'Nominate Mentor'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
