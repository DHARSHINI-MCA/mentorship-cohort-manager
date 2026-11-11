export const cities = [
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

export const timezonesByCountry = {
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
