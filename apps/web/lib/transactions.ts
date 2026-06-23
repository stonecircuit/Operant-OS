import type {
  Transaction,
  TransactionSummary,
} from "@/types/transaction";

export function calculateTransactionSummary(
  transactions: Transaction[]
): TransactionSummary {
  const incomeGroups: Record<string, number> = {};
  const expenseGroups: Record<string, number> = {};

  const summary = transactions.reduce<TransactionSummary>(
    (summary, transaction) => {
      const category =
        transaction.category ||
        (transaction.type === "income" ? "Revenue" : "Miscellaneous");

      if (transaction.type === "income") {
        summary.totalIncome += transaction.amount;
        incomeGroups[category] = (incomeGroups[category] || 0) + transaction.amount;
      } else {
        summary.totalExpenses += transaction.amount;
        expenseGroups[category] = (expenseGroups[category] || 0) + transaction.amount;
      }

      summary.netBalance =
        summary.totalIncome -
        summary.totalExpenses;
      summary.totalTransactions += 1;

      return summary;
    },
    {
      totalIncome: 0,
      totalExpenses: 0,
      netBalance: 0,
      totalTransactions: 0,
      topIncomeCategory: null,
      topExpenseCategory: null,
    }
  );

  let maxIncome = -1;
  let topIncome: string | null = null;
  for (const [category, amount] of Object.entries(incomeGroups)) {
    if (amount > maxIncome) {
      maxIncome = amount;
      topIncome = category;
    }
  }

  let maxExpense = -1;
  let topExpense: string | null = null;
  for (const [category, amount] of Object.entries(expenseGroups)) {
    if (amount > maxExpense) {
      maxExpense = amount;
      topExpense = category;
    }
  }

  summary.topIncomeCategory = topIncome;
  summary.topExpenseCategory = topExpense;

  return summary;
}

