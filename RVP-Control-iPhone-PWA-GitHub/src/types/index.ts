export type ApplicationStatus =
  | 'Нова'
  | 'Прийнята'
  | 'В роботі'
  | 'Виконана'
  | 'Скасована';

export type PayoutStatus = 'Очікує' | 'Виплачено';

export type ContractorStatus = 'Активний' | 'Неактивний';

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

export type Region = 'Київ' | 'Дніпро';

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
