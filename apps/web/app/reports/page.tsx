"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import {
  buildProfitLossReport,
  generateReportCsv,
} from "@/lib/reporting";
import { getTransactions } from "@/services/transactionService";
import type {
  DateRangeOption,
  ReportDateRange,
} from "@/types/reporting";
import type { Transaction } from "@/types/transaction";

const dateRangeOptions: DateRangeOption[] =
  [
    {
      value: "last-7-days",
      label: "Last 7 Days",
    },
    {
      value: "last-30-days",
      label: "Last 30 Days",
    },
    {
      value: "last-90-days",
      label: "Last 90 Days",
    },
    {
      value: "all-time",
      label: "All Time",
    },
  ];

const currencyFormatter =
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

function formatChartCurrency(
  value: number
): string {
  return currencyFormatter.format(value);
}

function createExportFileName(
  businessName: string,
  dateRange: ReportDateRange
): string {
  const safeBusinessName = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${safeBusinessName || "business"}-${dateRange}-report.csv`;
}

export default function ReportsPage() {
  const { user, loading: authLoading } =
    useAuth();
  const {
    activeBusinessId,
    activeBusinessName,
  } = useBusiness();
  const router = useRouter();

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [dateRange, setDateRange] =
    useState<ReportDateRange>(
      "last-30-days"
    );

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (
      authLoading ||
      !user ||
      !activeBusinessId
    ) {
      return;
    }

    const businessId = activeBusinessId;
    let isCurrent = true;

    async function loadTransactions() {
      setTransactionsLoading(true);
      setErrorMessage(null);

      try {
        const businessTransactions =
          await getTransactions(
            businessId
          );

        if (isCurrent) {
          setTransactions(
            businessTransactions
          );
        }
      } catch (error) {
        console.error(
          "Reports Transactions Error:",
          error
        );

        if (isCurrent) {
          setErrorMessage(
            "Unable to load report data."
          );
          setTransactions([]);
        }
      } finally {
        if (isCurrent) {
          setTransactionsLoading(false);
        }
      }
    }

    loadTransactions();

    return () => {
      isCurrent = false;
    };
  }, [
    activeBusinessId,
    authLoading,
    user,
  ]);

  const report = useMemo(() => {
    if (!activeBusinessId) {
      return null;
    }

    return buildProfitLossReport({
      businessId: activeBusinessId,
      transactions,
      dateRange,
    });
  }, [
    activeBusinessId,
    dateRange,
    transactions,
  ]);

  function handleExportCsv() {
    if (
      !report ||
      !activeBusinessName ||
      report.summary.transactionCount === 0
    ) {
      return;
    }

    const csv =
      generateReportCsv(report);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url =
      URL.createObjectURL(blob);
    const link =
      document.createElement("a");

    link.href = url;
    link.download = createExportFileName(
      activeBusinessName,
      dateRange
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <section className="mx-auto w-full max-w-6xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-600">
            Loading account...
          </p>
        </section>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Reporting Engine
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Reports
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {activeBusinessName
                ? `Active business: ${activeBusinessName}`
                : "No active business selected"}
            </p>
          </div>

          <nav className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link
              href="/dashboard"
              className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Dashboard
            </Link>
            <Link
              href="/transactions"
              className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Transactions
            </Link>
            <Link
              href="/businesses"
              className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Businesses
            </Link>
          </nav>
        </header>

        {!activeBusinessId ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Select a business to view reports
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Reports are generated from the active business transaction ledger.
            </p>
            <Link
              href="/businesses"
              className="mt-6 inline-flex rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Select Business
            </Link>
          </section>
        ) : (
          <>
            <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Date Range
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {dateRangeOptions.map(
                    (option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setDateRange(
                            option.value
                          )
                        }
                        className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                          dateRange ===
                          option.value
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-300 text-slate-700 hover:border-slate-900 hover:text-slate-950"
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={
                  !report ||
                  report.summary
                    .transactionCount === 0
                }
                className="rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Export CSV
              </button>
            </section>

            {transactionsLoading ? (
              <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
                <p className="text-sm font-medium text-slate-600">
                  Loading report data...
                </p>
              </section>
            ) : errorMessage ? (
              <section className="rounded-lg border border-red-200 bg-red-50 p-8 text-red-700">
                <p className="font-medium">
                  {errorMessage}
                </p>
              </section>
            ) : !report ||
              report.summary
                .transactionCount === 0 ? (
              <section className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">
                  No report data for this range
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Add transactions or choose a wider date range to generate reporting insights.
                </p>
                <Link
                  href="/transactions"
                  className="mt-6 inline-flex rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Add Transaction
                </Link>
              </section>
            ) : (
              <>
                <section className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                      Total Income
                    </p>
                    <p className="mt-3 text-2xl font-bold text-emerald-700">
                      {currencyFormatter.format(
                        report.summary
                          .totalIncome
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                      Total Expenses
                    </p>
                    <p className="mt-3 text-2xl font-bold text-rose-700">
                      {currencyFormatter.format(
                        report.summary
                          .totalExpenses
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                      Net Profit
                    </p>
                    <p className="mt-3 text-2xl font-bold text-slate-950">
                      {currencyFormatter.format(
                        report.summary
                          .netProfit
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                      Transaction Count
                    </p>
                    <p className="mt-3 text-2xl font-bold text-slate-950">
                      {
                        report.summary
                          .transactionCount
                      }
                    </p>
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                      Largest Income Category
                    </p>
                    <p className="mt-3 text-2xl font-bold text-emerald-700">
                      {report.largestIncomeCategory
                        ? `${report.largestIncomeCategory.category} (${currencyFormatter.format(
                            report.largestIncomeCategory.amount
                          )})`
                        : "None"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                      Largest Expense Category
                    </p>
                    <p className="mt-3 text-2xl font-bold text-rose-700">
                      {report.largestExpenseCategory
                        ? `${report.largestExpenseCategory.category} (${currencyFormatter.format(
                            report.largestExpenseCategory.amount
                          )})`
                        : "None"}
                    </p>
                  </div>
                </section>

                <section className="grid gap-6 md:grid-cols-2">
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <h2 className="text-xl font-bold text-slate-950">
                        Income Breakdown by Category
                      </h2>
                    </div>
                    <div className="p-5">
                      {report.incomeBreakdown.length === 0 ? (
                        <p className="text-sm text-slate-500">No income categories found.</p>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {report.incomeBreakdown.map((item) => (
                            <div key={item.category} className="flex flex-col gap-1">
                              <div className="flex justify-between text-sm font-medium text-slate-900">
                                <span>{item.category}</span>
                                <span>
                                  {currencyFormatter.format(item.amount)} ({item.percentage.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600 rounded-full"
                                  style={{ width: `${item.percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">
                                {item.transactionCount} transaction{item.transactionCount === 1 ? "" : "s"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <h2 className="text-xl font-bold text-slate-950">
                        Expense Breakdown by Category
                      </h2>
                    </div>
                    <div className="p-5">
                      {report.expenseBreakdown.length === 0 ? (
                        <p className="text-sm text-slate-500">No expense categories found.</p>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {report.expenseBreakdown.map((item) => (
                            <div key={item.category} className="flex flex-col gap-1">
                              <div className="flex justify-between text-sm font-medium text-slate-900">
                                <span>{item.category}</span>
                                <span>
                                  {currencyFormatter.format(item.amount)} ({item.percentage.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-rose-600 rounded-full"
                                  style={{ width: `${item.percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">
                                {item.transactionCount} transaction{item.transactionCount === 1 ? "" : "s"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-col gap-1">
                    <h2 className="text-xl font-bold text-slate-950">
                      Trends
                    </h2>
                    <p className="text-sm text-slate-600">
                      Income, expenses, and profit by month.
                    </p>
                  </div>

                  <div className="h-80 w-full">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <LineChart
                        data={
                          report.chartData
                        }
                        margin={{
                          top: 10,
                          right: 20,
                          left: 0,
                          bottom: 0,
                        }}
                      >
                        <CartesianGrid stroke="#e2e8f0" />
                        <XAxis
                          dataKey="month"
                          tick={{
                            fill: "#475569",
                            fontSize: 12,
                          }}
                        />
                        <YAxis
                          tick={{
                            fill: "#475569",
                            fontSize: 12,
                          }}
                          tickFormatter={
                            formatChartCurrency
                          }
                          width={90}
                        />
                        <Tooltip
                          formatter={(
                            value
                          ) =>
                            formatChartCurrency(
                              Number(value)
                            )
                          }
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="income"
                          name="Income"
                          stroke="#047857"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="expenses"
                          name="Expenses"
                          stroke="#be123c"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="profit"
                          name="Profit"
                          stroke="#0f172a"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h2 className="text-xl font-bold text-slate-950">
                      Monthly Breakdown
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-semibold">
                            Month
                          </th>
                          <th className="px-5 py-3 font-semibold">
                            Income
                          </th>
                          <th className="px-5 py-3 font-semibold">
                            Expenses
                          </th>
                          <th className="px-5 py-3 font-semibold">
                            Net Profit
                          </th>
                          <th className="px-5 py-3 font-semibold">
                            Transactions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {report.monthlyReports.map(
                          (monthlyReport) => (
                            <tr
                              key={
                                monthlyReport.month
                              }
                            >
                              <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">
                                {
                                  monthlyReport.monthLabel
                                }
                              </td>
                              <td className="whitespace-nowrap px-5 py-4 text-emerald-700">
                                {currencyFormatter.format(
                                  monthlyReport.totalIncome
                                )}
                              </td>
                              <td className="whitespace-nowrap px-5 py-4 text-rose-700">
                                {currencyFormatter.format(
                                  monthlyReport.totalExpenses
                                )}
                              </td>
                              <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">
                                {currencyFormatter.format(
                                  monthlyReport.netProfit
                                )}
                              </td>
                              <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                                {
                                  monthlyReport.transactionCount
                                }
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
