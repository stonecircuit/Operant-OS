export type ReportDateRange =
  | "last-7-days"
  | "last-30-days"
  | "last-90-days"
  | "all-time";

export interface ReportSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
}

export interface MonthlyReport {
  month: string;
  monthLabel: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface LargestCategoryInfo {
  category: string;
  amount: number;
}

export interface ProfitLossReport {
  businessId: string;
  generatedAt: string;
  dateRange: ReportDateRange;
  summary: ReportSummary;
  monthlyReports: MonthlyReport[];
  chartData: ReportTrendPoint[];
  incomeBreakdown: CategoryBreakdownItem[];
  expenseBreakdown: CategoryBreakdownItem[];
  largestIncomeCategory: LargestCategoryInfo | null;
  largestExpenseCategory: LargestCategoryInfo | null;
}

export interface ReportTrendPoint {
  month: string;
  income: number;
  expenses: number;
  profit: number;
}

export interface DateRangeOption {
  value: ReportDateRange;
  label: string;
}

