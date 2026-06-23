export interface Transaction {
  id: string;
  businessId: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
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
  category: string;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  totalTransactions: number;
  topIncomeCategory: string | null;
  topExpenseCategory: string | null;
}

export const INCOME_CATEGORIES = ["Revenue"] as const;

export const EXPENSE_CATEGORIES = [
  "Software",
  "Marketing",
  "Operations",
  "Equipment",
  "Travel",
  "Tax",
  "Salary",
  "Miscellaneous",
] as const;

export type IncomeCategory = typeof INCOME_CATEGORIES[number];
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
export type TransactionCategory = IncomeCategory | ExpenseCategory;

