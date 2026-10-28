import type { Employee } from './hr';

export const PERSONNEL_CATEGORIES = ['Newly Recruited Officer', 'In-Service Officer', 'Civilian Staff', 'Contract Staff', 'Volunteer', 'Consultant', 'Other'] as const;
export type PersonnelCategory = (typeof PERSONNEL_CATEGORIES)[number];
export const OFFICER_CATEGORIES: readonly string[] = ['Newly Recruited Officer', 'In-Service Officer'];

export const EMPLOYMENT_TYPES = ['Permanent', 'Contract', 'Temporary', 'Volunteer', 'Consultant'];
export const EMPLOYMENT_STATUSES = ['Active', 'On Leave', 'Suspended', 'Retired', 'Terminated', 'Deceased'];
export const ENROLLMENT_DOCUMENTS = ['Passport Photo', 'Appointment Letter', 'Promotion Letter', 'Transfer Letter', 'Academic Certificate', 'Professional Certificate', 'National ID', 'Birth Certificate', 'Medical Report', 'Police Clearance', 'Training Certificate', 'Service Record', 'Performance Evaluation', 'Other Document'];

/** Which extra form sections each category shows. */
export function categorySections(category: string) {
  return {
    probation: category === 'Newly Recruited Officer',
    initialAssignment: category === 'Newly Recruited Officer',
    inService: category === 'In-Service Officer',
  };
}

export function emailSubject(category: string) {
  return category === 'In-Service Officer' ? 'Personnel Record Enrollment Confirmation' : 'Welcome to LNPATS';
}

export function emailBody(e: Pick<Employee, 'full_name' | 'service_number' | 'rank' | 'employee_number'> & { category: string; department?: string; position?: string | null }) {
  const lines = e.category === 'In-Service Officer'
    ? [`Dear ${e.rank} ${e.full_name},`, '', 'This is to confirm that your personnel record has been enrolled in the LNPATS ERP master personnel registry.', '',
      `Service Number: ${e.service_number}`, `Employee Number: ${e.employee_number ?? '—'}`, `Department: ${e.department ?? '—'}`, `Position: ${e.position ?? '—'}`, '',
      'Please review your details and report any corrections to the Human Resource Section.']
    : [`Dear ${e.full_name},`, '', 'Welcome to the Liberia National Police Academy and Training School (LNPATS).', '',
      'Your personnel record has been created with the following details:', `Service Number: ${e.service_number}`, `Employee Number: ${e.employee_number ?? '—'}`, `Department: ${e.department ?? '—'}`, `Position: ${e.position ?? '—'}`, '',
      'Please report to the Human Resource Section with your original documents to complete your enrollment.'];
  return [...lines, '', 'Regards,', 'Human Resource Section', 'LNPATS'].join('\n');
}

export function yearsBetween(from: string | null | undefined, to = new Date()) {
  if (!from) return null;
  const d = new Date(from);
  if (Number.isNaN(d.getTime())) return null;
  let y = to.getFullYear() - d.getFullYear();
  if (to.getMonth() < d.getMonth() || (to.getMonth() === d.getMonth() && to.getDate() < d.getDate())) y--;
  return y;
}

/** Retiring within the next 12 months. */
export function nearingRetirement(retirement: string | null | undefined, now = new Date()) {
  if (!retirement) return false;
  const r = new Date(retirement).getTime();
  return r >= now.getTime() && r - now.getTime() <= 365 * 86400000;
}
