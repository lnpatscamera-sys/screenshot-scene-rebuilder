import type { AppRole } from './auth';
import { z } from 'zod';

export const STOCK_READ_ROLES: AppRole[] = ['storekeeper', 'commandant'];
export const stockAnalysisInput = z.object({ itemId: z.string().uuid(), description: z.string().trim().min(10).max(4000) });
export function canAnalyzeStock(roles: AppRole[]) { return roles.includes('system_admin') || roles.includes('storekeeper'); }
export function validBooking(start: string, end: string) { return Number.isFinite(Date.parse(start)) && Number.isFinite(Date.parse(end)) && Date.parse(end) > Date.parse(start); }