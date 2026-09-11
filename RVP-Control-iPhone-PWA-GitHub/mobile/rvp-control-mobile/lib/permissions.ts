import type { AdminRole } from '@/types';

export type MobilePageId =
  | 'contractors'
  | 'acts'
  | 'calendar'
  | 'finance'
  | 'rating'
  | 'archive'
  | 'automation'
  | 'audit-log';

const FULL_ACCESS: MobilePageId[] = [
  'contractors', 'acts', 'calendar', 'finance', 'rating',
  'archive', 'automation', 'audit-log',
];

const DISPATCHER_ACCESS: MobilePageId[] = [
  'contractors', 'acts', 'calendar', 'rating', 'archive',
];

const ACCOUNTANT_ACCESS: MobilePageId[] = [
  'finance', 'acts', 'audit-log', 'archive',
];

const VIEWER_ACCESS: MobilePageId[] = [
  'contractors', 'acts', 'calendar', 'rating', 'archive',
];

export function getAllowedPages(role: AdminRole | null): MobilePageId[] {
  if (!role) return [];
  switch (role) {
    case 'owner': return FULL_ACCESS;
    case 'admin': return FULL_ACCESS;
    case 'dispatcher': return DISPATCHER_ACCESS;
    case 'accountant': return ACCOUNTANT_ACCESS;
    case 'viewer': return VIEWER_ACCESS;
    default: return FULL_ACCESS;
  }
}

export function canAssignContractor(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'dispatcher';
}

export function canManageFinance(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'accountant';
}

export function canManageAutomation(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin';
}
