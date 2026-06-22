export interface Transaction {
  id: string;
  businessId: string;
  type: TransactionType;
  amount: number;
  description: string;
  createdAt: string;
}

export type TransactionType =
  | "income"
  | "expense";

export interface CreateTransactionInput {
  businessId: string;
  type: TransactionType;
  amount: number;
  description: string;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  totalTransactions: number;
}
