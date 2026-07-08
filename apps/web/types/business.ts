export interface Business {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  currency?: string;
  timezone?: string;
  financialYear?: string;
  country?: string;
  description?: string;
  address?: string;
  taxId?: string;
  members?: Record<string, "owner" | "admin" | "staff">;
  preferences?: {
    darkMode?: boolean;
    receiveAlerts?: boolean;
    defaultView?: string;
  };
  incomeCategories?: string[];
  expenseCategories?: string[];
}