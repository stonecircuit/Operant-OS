import type { ProfitLossReport } from "@/types/reporting";
import type { Insight, InsightSeverity } from "@/types/insights";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function generateInsights(report: ProfitLossReport | null): Insight[] {
  if (!report || report.summary.transactionCount === 0) {
    return [
      {
        id: "no-data",
        title: "No Data",
        description: "Add transactions to generate financial insights.",
        severity: "neutral",
      },
    ];
  }

  const insights: Insight[] = [];
  const { totalIncome, netProfit } = report.summary;

  // 1. Business Health
  let healthTitle = "Stable";
  let healthDesc = "Your business finances are stable.";
  let healthSeverity: InsightSeverity = "neutral";

  const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  if (netProfit < 0) {
    healthTitle = "Needs Attention";
    healthDesc = `Your business has a net loss of ${formatCurrency(Math.abs(netProfit))} for this period. Review expenses to improve profitability.`;
    healthSeverity = "warning";
  } else if (margin > 20) {
    healthTitle = "Healthy";
    healthDesc = `Your business is performing well with a strong net profit of ${formatCurrency(netProfit)}.`;
    healthSeverity = "positive";
  } else {
    healthTitle = "Stable";
    healthDesc = `Your business is stable with a net profit of ${formatCurrency(netProfit)}.`;
    healthSeverity = "neutral";
  }

  insights.push({
    id: "business-health",
    title: `Business Health: ${healthTitle}`,
    description: healthDesc,
    severity: healthSeverity,
  });

  // 2. Profit Margin
  if (totalIncome > 0) {
    const marginSeverity: InsightSeverity = margin >= 20 ? "positive" : margin >= 0 ? "neutral" : "warning";
    insights.push({
      id: "profit-margin",
      title: "Profit Margin",
      description: `Your profit margin is ${margin.toFixed(0)}%.`,
      severity: marginSeverity,
    });
  }

  // 3. Largest Expense Category
  if (report.expenseBreakdown && report.expenseBreakdown.length > 0) {
    const largestExpense = report.expenseBreakdown[0];
    insights.push({
      id: "largest-expense-category",
      title: "Largest Expense Category",
      description: `${largestExpense.category} is your largest expense category.`,
      severity: "neutral",
    });

    // 4. Expense Concentration
    const expConcentration = largestExpense.percentage;
    const expSeverity: InsightSeverity = expConcentration > 50 ? "warning" : "neutral";
    insights.push({
      id: "expense-concentration",
      title: "Expense Concentration",
      description: `${expConcentration.toFixed(0)}% of expenses come from ${largestExpense.category}.`,
      severity: expSeverity,
    });
  }

  // 5. Largest Income Category
  if (report.incomeBreakdown && report.incomeBreakdown.length > 0) {
    const largestIncome = report.incomeBreakdown[0];
    insights.push({
      id: "largest-income-category",
      title: "Largest Income Source",
      description: `${largestIncome.category} is your largest income source.`,
      severity: "positive",
    });

    // 6. Revenue Concentration
    const revConcentration = largestIncome.percentage;
    insights.push({
      id: "revenue-concentration",
      title: "Revenue Concentration",
      description: `${revConcentration.toFixed(0)}% of income comes from ${largestIncome.category}.`,
      severity: "neutral",
    });
  }

  return insights;
}
