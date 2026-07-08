"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { calculateTransactionSummary } from "@/lib/transactions";
import { buildProfitLossReport } from "@/lib/reporting";
import { generateInsights } from "@/lib/insights";
import { getTransactions } from "@/services/transactionService";
import type { Transaction } from "@/types/transaction";
import Navbar from "@/components/Navbar";

// Recharts imports for visual data
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    activeBusinessId,
    activeBusinessCurrency,
  } = useBusiness();

  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Prevent Recharts hydration mismatch in Next.js
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, router, user]);

  // Load transactions
  useEffect(() => {
    if (authLoading || !user || !activeBusinessId) {
      return;
    }

    const businessId = activeBusinessId;
    let isCurrent = true;

    async function loadTransactions() {
      setTransactionsLoading(true);
      setErrorMessage(null);

      try {
        const businessTransactions = await getTransactions(businessId);
        if (isCurrent) {
          setTransactions(businessTransactions);
        }
      } catch (error) {
        console.error("Dashboard Transactions Error:", error);
        if (isCurrent) {
          setErrorMessage("Unable to load dashboard totals.");
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
  }, [activeBusinessId, authLoading, user]);

  // Format currency dynamically based on business setting
  const formatCurrency = useMemo(() => {
    const currency = activeBusinessCurrency || "USD";
    return (value: number) => {
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
        }).format(value);
      } catch {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(value);
      }
    };
  }, [activeBusinessCurrency]);

  const summary = useMemo(() => {
    return calculateTransactionSummary(transactions);
  }, [transactions]);

  const report = useMemo(() => {
    if (!activeBusinessId) return null;
    return buildProfitLossReport({
      businessId: activeBusinessId,
      transactions,
      dateRange: "all-time",
    });
  }, [activeBusinessId, transactions]);

  // AI insights
  const insights = useMemo(() => {
    const list = generateInsights(report);
    return list.filter((ins) => ins.id !== "no-data").slice(0, 3);
  }, [report]);

  // 1. Business Health Score (0-100)
  const healthMetrics = useMemo(() => {
    if (transactions.length === 0) return { score: 100, label: "New Ledger", color: "text-slate-500", barColor: "bg-slate-200" };
    
    let score = 75; // baseline
    const income = summary.totalIncome;
    const expenses = summary.totalExpenses;
    
    // Profit margin check
    if (income > 0) {
      const margin = ((income - expenses) / income) * 100;
      if (margin < 0) {
        score -= 25; // deficit penalty
      } else if (margin > 30) {
        score += 20; // high margin bonus
      } else {
        score += 5;
      }
    } else {
      score -= 30; // no income penalty
    }

    // Warnings penalty
    const warningsCount = insights.filter(ins => ins.severity === "warning").length;
    score -= warningsCount * 10;

    const finalScore = Math.max(0, Math.min(100, score));
    
    let label = "Healthy";
    let color = "text-emerald-600";
    let barColor = "bg-emerald-500";
    if (finalScore < 50) {
      label = "Attention Needed";
      color = "text-rose-600";
      barColor = "bg-rose-500";
    } else if (finalScore < 75) {
      label = "Stable";
      color = "text-amber-500";
      barColor = "bg-amber-500";
    }

    return { score: finalScore, label, color, barColor };
  }, [summary, insights, transactions.length]);

  // Last 5 transactions
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5);
  }, [transactions]);

  // Group transactions by month for Recharts Bar Chart (Last 6 Months)
  const monthlyFlowData = useMemo(() => {
    const months: Record<string, { name: string; Income: number; Expenses: number; order: number }> = {};
    const d = new Date();
    
    // Prefill last 6 months
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const label = targetDate.toLocaleString("default", { month: "short", year: "2-digit" });
      const order = targetDate.getFullYear() * 12 + targetDate.getMonth();
      months[label] = { name: label, Income: 0, Expenses: 0, order };
    }

    transactions.forEach((t) => {
      const date = new Date(t.createdAt);
      const label = date.toLocaleString("default", { month: "short", year: "2-digit" });
      if (months[label]) {
        if (t.type === "income") {
          months[label].Income += t.amount;
        } else {
          months[label].Expenses += t.amount;
        }
      }
    });

    return Object.values(months).sort((a, b) => a.order - b.order);
  }, [transactions]);

  // Group expense categories for Pie Chart
  const expenseCategoryData = useMemo(() => {
    if (!report || report.expenseBreakdown.length === 0) return [];
    const colors = ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6", "#64748B"];
    return report.expenseBreakdown.map((item, idx) => ({
      name: item.category,
      value: item.amount,
      color: colors[idx % colors.length],
    }));
  }, [report]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="mx-auto w-full max-w-6xl flex flex-col gap-6">
          
          {/* Quick Actions Grid */}
          {activeBusinessId && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Link
                href="/transactions"
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-indigo-500 hover:shadow-md group"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-semibold group-hover:bg-indigo-100 transition">
                  ＋
                </span>
                <span className="text-xs font-bold text-slate-700">Add Transaction</span>
              </Link>
              <Link
                href="/transactions/receipt"
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-indigo-500 hover:shadow-md group"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-semibold group-hover:bg-emerald-100 transition">
                  📄
                </span>
                <span className="text-xs font-bold text-slate-700">Scan Receipt</span>
              </Link>
              <Link
                href="/copilot"
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-indigo-500 hover:shadow-md group"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-700 font-semibold group-hover:bg-purple-100 transition">
                  🤖
                </span>
                <span className="text-xs font-bold text-slate-700">AI Copilot</span>
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-indigo-500 hover:shadow-md group"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 font-semibold group-hover:bg-amber-100 transition">
                  ⚙
                </span>
                <span className="text-xs font-bold text-slate-700">Settings</span>
              </Link>
            </div>
          )}

          {/* Core States */}
          {!activeBusinessId ? (
            <section className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm max-w-lg mx-auto w-full mt-8">
              <h2 className="text-lg font-extrabold text-slate-900">Select a business to consult Dashboard</h2>
              <p className="mt-2 text-xs text-slate-500">
                Operant OS compiles financial analytics, insights, and charts for your selected business.
              </p>
              <Link
                href="/businesses"
                className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 shadow"
              >
                Choose Business
              </Link>
            </section>
          ) : transactionsLoading ? (
            /* Skeleton Loading Grid */
            <div className="grid gap-6">
              <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse flex flex-col justify-between">
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-6 bg-slate-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="h-80 rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse md:col-span-2" />
                <div className="h-80 rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse" />
              </div>
            </div>
          ) : errorMessage ? (
            <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
              <p className="text-sm font-semibold">{errorMessage}</p>
            </section>
          ) : (
            /* Dashboard 2.0 Content */
            <div className="grid gap-6">
              
              {/* KPI Section */}
              <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Income</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                      ▲ Inflow
                    </span>
                  </div>
                  <p className="text-2xl font-black text-emerald-700">
                    {formatCurrency(summary.totalIncome)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Expenses</span>
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                      ▼ Outflow
                    </span>
                  </div>
                  <p className="text-2xl font-black text-rose-700">
                    {formatCurrency(summary.totalExpenses)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Profit</span>
                    {summary.totalIncome > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        summary.netBalance >= 0 ? "bg-indigo-50 text-indigo-700" : "bg-rose-50 text-rose-700"
                      }`}>
                        {Math.round((summary.netBalance / summary.totalIncome) * 100)}% Margin
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    {formatCurrency(summary.netBalance)}
                  </p>
                </div>

                {/* Business Health KPI Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Health Score</span>
                    <span className={`text-[10px] font-extrabold ${healthMetrics.color}`}>
                      {healthMetrics.label}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex items-end justify-between">
                      <p className="text-2xl font-black text-slate-900 leading-none">
                        {healthMetrics.score}<span className="text-xs font-bold text-slate-400">/100</span>
                      </p>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full ${healthMetrics.barColor}`} style={{ width: `${healthMetrics.score}%` }} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Charts & Breakdown */}
              {transactions.length > 0 && mounted && (
                <section className="grid gap-6 md:grid-cols-3">
                  
                  {/* Income vs Expenses Bar Chart */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 flex flex-col gap-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cash Flow Overview (Monthly)</h4>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} stroke="#64748B" />
                          <YAxis fontSize={11} fontWeight={600} tickLine={false} axisLine={false} stroke="#64748B" />
                          <Tooltip
                            contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                            labelStyle={{ fontWeight: "bold" }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }} />
                          <Bar dataKey="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Expenses breakdown Donut Chart */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expenses by Category</h4>
                    <div className="relative h-44 w-full flex items-center justify-center">
                      {expenseCategoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={expenseCategoryData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {expenseCategoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              formatter={(value: any) => formatCurrency(Number(value || 0))}
                              contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-xs text-slate-400 font-semibold italic">No expenses recorded yet</div>
                      )}
                    </div>
                    {/* Color legends */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600 max-h-24 overflow-y-auto pr-1">
                      {expenseCategoryData.map((item) => (
                        <div key={item.name} className="flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="truncate">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* AI Insights & Recent Feed */}
              <section className="grid gap-6 md:grid-cols-3">
                
                {/* AI Insights Panel */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-1 flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Automated AI Insights</h3>
                  <div className="flex flex-col gap-3">
                    {insights.map((insight) => {
                      let severityClasses = "bg-slate-50 border-slate-100 text-slate-800";
                      let iconStr = "⚡";
                      if (insight.severity === "positive") {
                        severityClasses = "bg-emerald-50/50 border-emerald-100 text-emerald-800";
                        iconStr = "✓";
                      } else if (insight.severity === "warning") {
                        severityClasses = "bg-amber-50/50 border-amber-100 text-amber-800";
                        iconStr = "⚠";
                      }

                      return (
                        <div
                          key={insight.id}
                          className={`rounded-xl border p-3.5 flex items-start gap-3 ${severityClasses}`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-[10px] font-bold shadow-sm">
                            {iconStr}
                          </span>
                          <div className="flex flex-col gap-0.5">
                            <h4 className="font-bold text-xs">{insight.title}</h4>
                            <p className="text-[11px] leading-relaxed opacity-90">{insight.description}</p>
                          </div>
                        </div>
                      );
                    })}
                    {insights.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs font-semibold italic">
                        Not enough ledger data for insights.
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Transactions List */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Activity</h3>
                    {transactions.length > 5 && (
                      <Link href="/transactions" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">
                        View All →
                      </Link>
                    )}
                  </div>
                  
                  <div className="flex flex-col divide-y divide-slate-100">
                    {recentTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 text-xs">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                            tx.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}>
                            {tx.type === "income" ? "+" : "-"}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 truncate max-w-[140px] sm:max-w-xs">
                              {tx.merchant || tx.description}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold mt-0.5">
                              {tx.category} • {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                        <span className={`font-black text-right ${
                          tx.type === "income" ? "text-emerald-700" : "text-slate-900"
                        }`}>
                          {tx.type === "income" ? "" : "-"}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}

                    {transactions.length === 0 && (
                      <div className="text-center py-10 flex flex-col items-center justify-center gap-3">
                        <p className="text-xs font-bold text-slate-500">No transactions recorded yet</p>
                        <p className="text-[10px] text-slate-400 max-w-[240px]">
                          Click &apos;Add Transaction&apos; or scan a receipt to log your business&apos;s financial ledger entries.
                        </p>
                        <Link
                          href="/transactions"
                          className="rounded-lg bg-slate-900 px-4 py-2 text-[10px] font-bold text-white transition hover:bg-slate-800 shadow"
                        >
                          Add Transaction
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

              </section>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
