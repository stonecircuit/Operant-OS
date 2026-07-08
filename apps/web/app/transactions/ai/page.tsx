"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { createTransaction } from "@/services/transactionService";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/types/transaction";
import type { TransactionType } from "@/types/transaction";
import Navbar from "@/components/Navbar";

interface ExtractedTransaction {
  type: TransactionType;
  amount: string;
  category: string;
  description: string;
  date: string;
}

export default function AITransactionEntryPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    activeBusinessId,
    activeBusinessIncomeCategories,
    activeBusinessExpenseCategories,
  } = useBusiness();
  const router = useRouter();

  const incomeCategories = activeBusinessIncomeCategories || INCOME_CATEGORIES;
  const expenseCategories = activeBusinessExpenseCategories || EXPENSE_CATEGORIES;

  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extracted and editable state
  const [extracted, setExtracted] = useState<ExtractedTransaction | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, router, user]);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeBusinessId) {
      return;
    }

    setParsing(true);
    setError(null);
    setExtracted(null);

    try {
      const idToken = user ? await user.getIdToken() : "";
      const response = await fetch("/api/transactions/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          message: text,
          currentDate: new Date().toISOString().split("T")[0],
          businessId: activeBusinessId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze transaction text.");
      }

      setExtracted({
        type: data.type,
        amount: String(data.amount),
        category: data.category,
        description: data.description,
        date: data.date,
      });
    } catch (err) {
      console.error("AI parse error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while parsing the text. Please try again."
      );
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirmSave(e: React.FormEvent) {
    e.preventDefault();
    if (!extracted || !activeBusinessId) {
      return;
    }

    const amountNum = Number(extracted.amount);
    if (!amountNum || amountNum <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    if (!extracted.description.trim()) {
      setError("Description is required.");
      return;
    }

    if (!extracted.category) {
      setError("Category is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Create transaction via service
      // We will customize createTransaction call to pass category
      // Wait, is date supported in createTransaction?
      await createTransaction({
        businessId: activeBusinessId,
        type: extracted.type,
        amount: amountNum,
        description: extracted.description.trim(),
        category: extracted.category,
        createdAt: new Date(extracted.date).toISOString(),
      });

      // Redirect back to transactions ledger
      router.push("/transactions");
    } catch (err) {
      console.error("Save transaction error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to save transaction."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setExtracted(null);
    setError(null);
  }

  // Categories list options based on selected type in the form
  const categoryOptions =
    extracted?.type === "income" ? incomeCategories : expenseCategories;

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
    <div className="min-h-screen bg-slate-50 text-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1 px-6 py-8 flex flex-col">
        <section className="mx-auto flex w-full max-w-3xl flex-col flex-1 gap-6">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
            <p className="text-sm font-medium text-slate-500 font-semibold uppercase tracking-wider">Operant OS</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">AI Transaction Entry</h1>
          </div>

        {!activeBusinessId ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Select a business to use AI Entry
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Transactions are created within the context of your active business selection.
            </p>
            <Link
              href="/businesses"
              className="mt-6 inline-flex rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Select Business
            </Link>
          </section>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Input Form */}
            <form
              onSubmit={handleAnalyze}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4"
            >
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">
                  Describe the transaction
                </span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={parsing || !!extracted}
                  placeholder='e.g., "Paid ₹2,500 for Meta Ads yesterday." or "Received ₹40,000 from ABC Hospital."'
                  rows={3}
                  className="rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50 disabled:text-slate-400 resize-none"
                />
              </label>

              {!extracted && (
                <button
                  type="submit"
                  disabled={parsing || !text.trim()}
                  className="self-start h-11 rounded-md bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {parsing ? "Analyzing transaction details..." : "Analyze Transaction"}
                </button>
              )}
            </form>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Editable Confirmation Card */}
            {extracted && (
              <form
                onSubmit={handleConfirmSave}
                className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-5 border-emerald-500 ring-2 ring-emerald-500/10"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Confirm AI Transaction Details</h3>
                  <p className="text-xs text-slate-500">Please review and edit details extracted by Gemini before saving.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-700">Type</span>
                    <select
                      value={extracted.type}
                      onChange={(e) => {
                        const newType = e.target.value as TransactionType;
                        setExtracted({
                          ...extracted,
                          type: newType,
                          category: newType === "income" ? incomeCategories[0] : expenseCategories[0],
                        });
                      }}
                      className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-700">Category</span>
                    <select
                      value={extracted.category}
                      onChange={(e) => setExtracted({ ...extracted, category: e.target.value })}
                      className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    >
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-700">Amount</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={extracted.amount}
                      onChange={(e) => setExtracted({ ...extracted, amount: e.target.value })}
                      className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="0.00"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-700">Date</span>
                    <input
                      type="date"
                      value={extracted.date}
                      onChange={(e) => setExtracted({ ...extracted, date: e.target.value })}
                      className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                  </label>

                  <label className="flex flex-col gap-2 sm:col-span-2">
                    <span className="text-xs font-semibold text-slate-700">Description</span>
                    <input
                      type="text"
                      value={extracted.description}
                      onChange={(e) => setExtracted({ ...extracted, description: e.target.value })}
                      className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="Meta Ads, Software subscription..."
                    />
                  </label>
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="h-11 rounded-md border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-11 rounded-md bg-emerald-600 hover:bg-emerald-700 px-6 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-emerald-400"
                  >
                    {saving ? "Saving..." : "Confirm & Save"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>
    </main>
    </div>
  );
}
