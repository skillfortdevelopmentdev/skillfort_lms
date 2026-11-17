export const REGISTRATION_BRANCHES = [
  'Skill fort - Development',
  'Skill fort - Testing',
] as const;

export const HIGHEST_QUALIFICATIONS = [
  '10th / SSLC',
  '12th / HSC',
  'Diploma',
  "Bachelor's Degree",
  "Master's Degree",
  'PhD',
  'Other',
] as const;

export const REQUIRED_COURSES = [
  'Digital Marketing',
  'MERN Stack',
  'Data Engineer',
  'Data Analyst',
  'Testing',
  'Oracle',
  'Python',
  'React JS',
  'Angular',
  'Data Science',
  'AWS',
  'DevOps',
  'Java',
  '.NET',
  'Others',
] as const;

export const REGISTRATION_SOURCES = [
  'Google / Search Engine',
  'Social Media',
  'Friend / Referral',
  'College / Campus Event',
  'Advertisement / Flyer',
  'WhatsApp',
  'Walk-in',
  'Other',
] as const;

export const PASSOUT_YEARS = Array.from({ length: 35 }, (_, i) =>
  String(new Date().getFullYear() - i)
);
