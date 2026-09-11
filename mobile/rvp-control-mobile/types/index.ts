export type ApplicationStatus =
  | 'Нова'
  | 'Прийнята'
  | 'В роботі'
  | 'Виконана'
  | 'Скасована';

export type PayoutStatus = 'Очікує' | 'Виплачено';

export type AdminRole = 'owner' | 'admin' | 'dispatcher' | 'accountant' | 'viewer';

export interface AdminUser {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
}

export interface Contractor {
  id: string;
  name: string;
  phone: string;
  status: 'active' | 'inactive';
  region: string;
  totalApplications: number;
  completedApplications: number;
  activeApplications: number;
  totalPayout: number;
}

export interface Application {
  id: string;
  number: string;
  date: string;
  customer: string;
  address: string;
  contractorId: string;
  contractorName: string;
  contractorPhone: string;
  status: ApplicationStatus;
  amount: number;
  scheduledDate: string;
  description: string;
  managerComment: string;
  actualVolume: number;
  unitPrice: number;
  payoutAmount: number;
  payoutStatus: PayoutStatus;
  azkCode?: string;
  region?: string;
  deadline?: string;
}

export interface Act {
  id: string;
  applicationId: string;
  applicationNumber: string;
  contractorName: string;
  uploadDate: string;
  status: 'approved' | 'pending' | 'rejected';
  actNumber: string | null;
}

export interface WorkHistoryEntry {
  id: string;
  title: string;
  description: string | null;
  completedAt: string;
}

export interface ControlCenterItem {
  id: string;
  type: 'overdue' | 'no_contractor' | 'problem' | 'deadline_today' | 'act_pending' | 'payout_pending';
  title: string;
  description: string;
  applicationId: string;
  applicationNumber: string;
  severity: 'critical' | 'warning' | 'info';
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  applicationId: string | null;
  read: boolean;
  createdAt: string;
}

export interface ApplicationFile {
  id: string;
  applicationId: string;
  fileName: string;
  fileType: string;
  category: 'before' | 'after' | 'act' | 'receipt' | 'other';
  createdAt: string;
  url: string | null;
}

export interface ApplicationComment {
  id: string;
  applicationId: string;
  adminName: string;
  message: string;
  createdAt: string;
}
