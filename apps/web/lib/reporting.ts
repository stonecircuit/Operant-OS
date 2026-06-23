import type {
  MonthlyReport,
  ProfitLossReport,
  ReportDateRange,
  ReportSummary,
  ReportTrendPoint,
  CategoryBreakdownItem,
  LargestCategoryInfo,
} from "@/types/reporting";
import type { Transaction, TransactionType } from "@/types/transaction";

const monthFormatter =
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  });

function parseTransactionDate(
  transaction: Transaction
): Date {
  return new Date(transaction.createdAt);
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getDateRangeStart(
  dateRange: ReportDateRange,
  now = new Date()
): Date | null {
  if (dateRange === "all-time") {
    return null;
  }

  const daysByRange: Record<
    Exclude<
      ReportDateRange,
      "all-time"
    >,
    number
  > = {
    "last-7-days": 7,
    "last-30-days": 30,
    "last-90-days": 90,
  };

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(
    start.getDate() -
      (daysByRange[dateRange] - 1)
  );

  return start;
}

export function filterTransactionsByDateRange(
  transactions: Transaction[],
  dateRange: ReportDateRange,
  now = new Date()
): Transaction[] {
  const start = getDateRangeStart(
    dateRange,
    now
  );

  if (!start) {
    return [...transactions];
  }

  return transactions.filter(
    (transaction) =>
      parseTransactionDate(
        transaction
      ).getTime() >= start.getTime()
  );
}

export function calculateTotalIncome(
  transactions: Transaction[]
): number {
  return transactions.reduce(
    (total, transaction) =>
      transaction.type === "income"
        ? total + transaction.amount
        : total,
    0
  );
}

export function calculateTotalExpenses(
  transactions: Transaction[]
): number {
  return transactions.reduce(
    (total, transaction) =>
      transaction.type === "expense"
        ? total + transaction.amount
        : total,
    0
  );
}

export function calculateNetProfit(
  transactions: Transaction[]
): number {
  return (
    calculateTotalIncome(transactions) -
    calculateTotalExpenses(transactions)
  );
}

export function calculateTransactionCount(
  transactions: Transaction[]
): number {
  return transactions.length;
}

export function calculateReportSummary(
  transactions: Transaction[]
): ReportSummary {
  const totalIncome =
    calculateTotalIncome(transactions);
  const totalExpenses =
    calculateTotalExpenses(transactions);

  return {
    totalIncome,
    totalExpenses,
    netProfit:
      totalIncome - totalExpenses,
    transactionCount:
      calculateTransactionCount(
        transactions
      ),
  };
}

export function calculateMonthlySummaries(
  transactions: Transaction[]
): MonthlyReport[] {
  const reportsByMonth =
    new Map<string, MonthlyReport>();

  for (const transaction of transactions) {
    const date =
      parseTransactionDate(transaction);
    const month = getMonthKey(date);
    const existingReport =
      reportsByMonth.get(month) ?? {
        month,
        monthLabel:
          monthFormatter.format(date),
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        transactionCount: 0,
      };

    if (transaction.type === "income") {
      existingReport.totalIncome +=
        transaction.amount;
    } else {
      existingReport.totalExpenses +=
        transaction.amount;
    }

    existingReport.netProfit =
      existingReport.totalIncome -
      existingReport.totalExpenses;
    existingReport.transactionCount += 1;

    reportsByMonth.set(
      month,
      existingReport
    );
  }

  return Array.from(
    reportsByMonth.values()
  ).sort((first, second) =>
    second.month.localeCompare(first.month)
  );
}

export function buildReportTrendData(
  monthlyReports: MonthlyReport[]
): ReportTrendPoint[] {
  return [...monthlyReports]
    .sort((first, second) =>
      first.month.localeCompare(
        second.month
      )
    )
    .map((report) => ({
      month: report.monthLabel,
      income: report.totalIncome,
      expenses: report.totalExpenses,
      profit: report.netProfit,
    }));
}

export function calculateCategoryBreakdown(
  transactions: Transaction[],
  type: TransactionType
): CategoryBreakdownItem[] {
  const filtered = transactions.filter((t) => t.type === type);
  const totalAmount = filtered.reduce((sum, t) => sum + t.amount, 0);

  const groups = new Map<string, { amount: number; count: number }>();

  for (const t of filtered) {
    const cat =
      t.category || (type === "income" ? "Revenue" : "Miscellaneous");
    const current = groups.get(cat) ?? { amount: 0, count: 0 };
    current.amount += t.amount;
    current.count += 1;
    groups.set(cat, current);
  }

  return Array.from(groups.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
      transactionCount: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function getLargestCategory(
  breakdown: CategoryBreakdownItem[]
): LargestCategoryInfo | null {
  if (breakdown.length === 0) {
    return null;
  }
  return {
    category: breakdown[0].category,
    amount: breakdown[0].amount,
  };
}

export function buildProfitLossReport({
  businessId,
  transactions,
  dateRange,
  now = new Date(),
}: {
  businessId: string;
  transactions: Transaction[];
  dateRange: ReportDateRange;
  now?: Date;
}): ProfitLossReport {
  const filteredTransactions =
    filterTransactionsByDateRange(
      transactions,
      dateRange,
      now
    );
  const monthlyReports =
    calculateMonthlySummaries(
      filteredTransactions
    );

  const incomeBreakdown = calculateCategoryBreakdown(
    filteredTransactions,
    "income"
  );
  const expenseBreakdown = calculateCategoryBreakdown(
    filteredTransactions,
    "expense"
  );

  return {
    businessId,
    generatedAt: now.toISOString(),
    dateRange,
    summary:
      calculateReportSummary(
        filteredTransactions
      ),
    monthlyReports,
    chartData:
      buildReportTrendData(
        monthlyReports
      ),
    incomeBreakdown,
    expenseBreakdown,
    largestIncomeCategory: getLargestCategory(incomeBreakdown),
    largestExpenseCategory: getLargestCategory(expenseBreakdown),
  };
}

function escapeCsvValue(
  value: string | number
): string {
  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll(
      '"',
      '""'
    )}"`;
  }

  return stringValue;
}

export function generateReportCsv(
  report: ProfitLossReport
): string {
  const rows: Array<
    Array<string | number>
  > = [
    [
      "Month",
      "Total Income",
      "Total Expenses",
      "Net Profit",
      "Transaction Count",
    ],
    ...report.monthlyReports.map(
      (monthlyReport) => [
        monthlyReport.monthLabel,
        monthlyReport.totalIncome,
        monthlyReport.totalExpenses,
        monthlyReport.netProfit,
        monthlyReport.transactionCount,
      ]
    ),
    [],
    ["Summary"],
    [
      "Total Income",
      report.summary.totalIncome,
    ],
    [
      "Total Expenses",
      report.summary.totalExpenses,
    ],
    [
      "Net Profit",
      report.summary.netProfit,
    ],
    [
      "Transaction Count",
      report.summary.transactionCount,
    ],
  ];

  return rows
    .map((row) =>
      row.map(escapeCsvValue).join(",")
    )
    .join("\n");
}
