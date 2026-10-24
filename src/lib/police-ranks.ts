/** Police seniority is descriptive; authorization remains role-based. */
export const POLICE_RANKS = [
  { name: 'Deputy Inspector General of Police', abbreviation: 'DIGP' },
  { name: 'Commissioner of Police', abbreviation: 'Comm.' },
  { name: 'Deputy Commissioner of Police', abbreviation: 'DCP' },
  { name: 'Assistant Commissioner of Police', abbreviation: 'ACP' },
  { name: 'Chief Superintendent of Police', abbreviation: 'CSP' },
  { name: 'Superintendent of Police', abbreviation: 'SUPT.' },
  { name: 'Chief Inspector of Police', abbreviation: 'CIP' },
  { name: 'Inspector of Police', abbreviation: 'Insp.' },
  { name: 'Sergeant', abbreviation: 'SGT.' },
  { name: 'Corporal', abbreviation: 'Cpl.' },
] as const;

export function policeRankOptions(current?: string) {
  const options = POLICE_RANKS.map(rank => ({ value: String(rank.name), label: `${rank.name} (${rank.abbreviation})` }));
  // Preserve historical values rather than silently translating or clearing them.
  if (current && !options.some(option => option.value === current)) {
    options.push({ value: current, label: current });
  }
  return options;
}