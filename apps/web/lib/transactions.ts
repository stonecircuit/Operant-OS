import type {
  Transaction,
  TransactionSummary,
} from "@/types/transaction";

export function calculateTransactionSummary(
  transactions: Transaction[]
): TransactionSummary {
  return transactions.reduce<TransactionSummary>(
    (summary, transaction) => {
      if (transaction.type === "income") {
        summary.totalIncome +=
          transaction.amount;
      } else {
        summary.totalExpenses +=
          transaction.amount;
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
    }
  );
}
