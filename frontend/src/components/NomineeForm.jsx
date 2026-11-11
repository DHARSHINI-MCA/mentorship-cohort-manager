import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { cities, timezonesByCountry } from '../data/cities';

const inputClass =
  'w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400';
const labelClass = 'block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1';

/**
 * Nomination form for one mentor or trainee.
 * No cohort is involved: nominees go into a pool that an admin adds to cohorts.
 * `onSubmit(payload)` must return a promise; the form clears itself when it resolves.
 */
export function NomineeForm({ kind, onSubmit, isPending = false }) {
  const isTrainee = kind === 'trainee';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState('');

  const selectedCity = cities.find(({ city, country }) => location === `${city}, ${country}`);
  const timezoneOptions = selectedCity ? timezonesByCountry[selectedCity.country] : [];

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      name: name.trim(),
      email: email.trim(),
      employeeId: employeeId.trim(),
      location: location || null,
      timezone: timezone || null,
    };
    try {
      await onSubmit(payload);
      setName('');
      setEmail('');
      setEmployeeId('');
      setLocation('');
      setTimezone('');
    } catch {
      // the parent shows the error toast; keep the typed values so nothing is lost
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Full Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jordan Scott" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jordan.scott@example.com" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Employee ID</label>
        <input required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP-305" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Location{isTrainee ? '' : ' (optional)'}</label>
        <select
          required={isTrainee}
          value={location}
          onChange={(e) => {
            const value = e.target.value;
            setLocation(value);
            const match = cities.find(({ city, country }) => value === `${city}, ${country}`);
            setTimezone(match?.timezone || '');
          }}
          className={inputClass}
        >
          <option value="">Select a city</option>
          {['India', 'USA'].map((country) => (
            <optgroup key={country} label={country}>
              {cities.filter((c) => c.country === country).map(({ city }) => (
                <option key={city} value={`${city}, ${country}`}>{city}, {country}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Time Zone{isTrainee ? '' : ' (optional)'}</label>
        <select
          required={isTrainee}
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          disabled={!selectedCity}
          className={inputClass}
        >
          <option value="">{selectedCity ? 'Select a time zone' : 'Select a city first'}</option>
          {timezoneOptions.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
      >
        <UserPlus className="w-4 h-4" />
        <span>{isPending ? 'Submitting…' : `Submit ${isTrainee ? 'Trainee' : 'Mentor'} Nomination`}</span>
      </button>
    </form>
  );
}
