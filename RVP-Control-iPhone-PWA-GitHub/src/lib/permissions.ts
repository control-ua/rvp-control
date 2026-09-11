import type { AdminRole } from '@/types';

export type PageId =
  | 'dashboard'
  | 'applications'
  | 'contractors'
  | 'acts'
  | 'payouts'
  | 'statistics'
  | 'administrators'
  | 'audit-log'
  | 'notifications'
  | 'settings'
  | 'problems'
  | 'object-map'
  | 'control-center'
  | 'contractor-rating'
  | 'calendar'
  | 'finance'
  | 'automation'
  | 'archive';

const FULL_ACCESS: PageId[] = [
  'dashboard', 'applications', 'contractors', 'acts', 'payouts', 'statistics',
  'administrators', 'audit-log', 'notifications', 'settings', 'problems',
  'object-map', 'control-center', 'contractor-rating', 'calendar', 'finance',
  'automation', 'archive',
];

const DISPATCHER_ACCESS: PageId[] = [
  'dashboard', 'applications', 'contractors', 'acts', 'problems',
  'object-map', 'control-center', 'contractor-rating', 'calendar', 'archive',
  'notifications', 'settings',
];

const ACCOUNTANT_ACCESS: PageId[] = [
  'dashboard', 'payouts', 'finance', 'statistics', 'applications',
  'acts', 'audit-log', 'notifications', 'settings', 'archive',
];

const VIEWER_ACCESS: PageId[] = [
  'dashboard', 'applications', 'contractors', 'acts', 'payouts',
  'statistics', 'problems', 'object-map', 'control-center',
  'contractor-rating', 'calendar', 'archive', 'notifications', 'settings',
];

export function getAllowedPages(role: AdminRole | null): PageId[] {
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

export function canManageAdmins(role: AdminRole | null): boolean {
  return role === 'owner';
}

export function canManageFinance(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'accountant';
}

export function canAssignContractor(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'dispatcher';
}

export function canManageAutomation(role: AdminRole | null): boolean {
  return role === 'owner' || role === 'admin';
}
