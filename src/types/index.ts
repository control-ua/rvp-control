export type ApplicationStatus =
  | 'Нова'
  | 'Прийнята'
  | 'В роботі'
  | 'Виконана'
  | 'Скасована';

export type PayoutStatus = 'Очікує' | 'Виплачено';
export type ContractorStatus = 'Активний' | 'Неактивний';
export type AdminRole = 'owner' | 'admin' | 'dispatcher' | 'accountant' | 'viewer';
export type Region = 'Київ' | 'Дніпро';

export interface Contractor {
  id: string;
  name: string;
  phone: string;
  telegramId: string;
  status: ContractorStatus;
  region: Region;
  totalApplications: number;
  completedApplications: number;
  totalPayout: number;
  avatar?: string;
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
  phone: string;
  status: ApplicationStatus;
  amount: number;
  scheduledDate: string;
  description: string;
  managerComment: string;
  actualVolume: number;
  unitPrice: number;
  payoutAmount: number;
  payoutStatus: PayoutStatus;
  payoutReceipt?: string;
  payoutReceiptName?: string;
  payoutReceiptType?: string;
  azkCode?: string;
  region?: Region;
  deadline?: string;
}

export interface Act {
  id: string;
  applicationId: string;
  applicationNumber: string;
  contractorId: string;
  contractorName: string;
  uploadDate: string;
  status: 'Підтверджено' | 'На перевірці' | 'Відхилено';
  photo: string;
}

export interface Payout {
  id: string;
  applicationId: string;
  applicationNumber: string;
  contractorId: string;
  contractorName: string;
  contractorPhone: string;
  amount: number;
  status: PayoutStatus;
  paymentDate?: string;
  receipt?: string;
}

export interface ApplicationComment {
  id: string;
  applicationId: string;
  adminUserId: string;
  adminName: string;
  message: string;
  createdAt: string;
}

export interface ApplicationFile {
  id: string;
  applicationId: string;
  fileName: string;
  fileType: string;
  storagePath: string | null;
  telegramFileId: string | null;
  category: 'before' | 'after' | 'document' | 'other';
  uploadedBy: string | null;
  createdAt: string;
  url: string | null;
}

export interface AutomationRule {
  id: string;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerCount: number;
}

export interface ActivityFeedItem {
  id: string;
  type:
    | 'problem'
    | 'payout_paid'
    | 'payout_created'
    | 'application_completed'
    | 'contractor_departed'
    | 'work_started'
    | 'contractor_assigned'
    | 'application_created';
  title: string;
  description: string;
  applicationNumber: string;
  contractorName: string;
  createdAt: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface SearchResult {
  id: string;
  type: 'application' | 'contractor' | 'act';
  title: string;
  subtitle: string;
  number: string;
}

export interface CalendarEvent {
  id: string;
  applicationId: string;
  number: string;
  title: string;
  status: ApplicationStatus;
  date: string;
  deadline: boolean;
}

export interface ControlCenterItem {
  id: string;
  type:
    | 'overdue'
    | 'deadline_today'
    | 'no_contractor'
    | 'problem'
    | 'act_pending'
    | 'payout_pending';
  title: string;
  description: string;
  applicationId: string;
  applicationNumber: string;
  severity: 'critical' | 'warning' | 'info';
  createdAt: string;
}

export interface FinanceStats {
  accruedToday: number;
  accruedThisMonth: number;
  paidThisMonth: number;
  pendingPayout: number;
  totalDebt: number;
}

export interface FinanceDailyPoint {
  date: string;
  amount: number;
}

export interface FinanceTopContractor {
  id: string;
  name: string;
  totalPayout: number;
  payoutCount: number;
}

export interface ContractorRatingItem {
  id: string;
  name: string;
  phone: string | null;
  activeApplications: number;
  totalApplications: number;
  completedApplications: number;
  problemApplications: number;
  completionRate: number;
  totalPayout: number;
  avgCompletionHours: number | null;
  rank: number;
}
