"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { calculateTransactionSummary } from "@/lib/transactions";
import { logout } from "@/services/authService";
import { getTransactions } from "@/services/transactionService";
import type { Transaction } from "@/types/transaction";

const currencyFormatter =
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

export default function DashboardPage() {
  const { user, loading: authLoading } =
    useAuth();
  const {
    activeBusinessId,
    activeBusinessName,
  } =
    useBusiness();

  const router = useRouter();

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

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
          "Dashboard Transactions Error:",
          error
        );

        if (isCurrent) {
          setErrorMessage(
            "Unable to load dashboard totals."
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

  const summary = useMemo(
    () =>
      calculateTransactionSummary(
        transactions
      ),
    [transactions]
  );

  async function handleLogout() {
    await logout();

    router.push("/login");
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <section className="mx-auto w-full max-w-6xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-600">
            Loading dashboard...
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
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Operant OS
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Logged in as{" "}
              <span className="font-semibold text-slate-900">
                {user.email}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/businesses"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Businesses
            </Link>
            <Link
              href="/transactions"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Transactions
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Active Business
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-950">
            {activeBusinessName ??
              "No business selected"}
          </p>
        </section>

        {!activeBusinessId ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Select a business to view financial activity
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Dashboard totals are calculated from the active business transactions.
            </p>
            <Link
              href="/businesses"
              className="mt-6 inline-flex rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Select Business
            </Link>
          </section>
        ) : transactionsLoading ? (
          <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-medium text-slate-600">
              Loading dashboard totals...
            </p>
          </section>
        ) : errorMessage ? (
          <section className="rounded-lg border border-red-200 bg-red-50 p-8 text-red-700">
            <p className="font-medium">
              {errorMessage}
            </p>
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
                    summary.totalIncome
                  )}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Total Expenses
                </p>
                <p className="mt-3 text-2xl font-bold text-rose-700">
                  {currencyFormatter.format(
                    summary.totalExpenses
                  )}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Net Balance
                </p>
                <p className="mt-3 text-2xl font-bold text-slate-950">
                  {currencyFormatter.format(
                    summary.netBalance
                  )}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Total Transactions
                </p>
                <p className="mt-3 text-2xl font-bold text-slate-950">
                  {summary.totalTransactions}
                </p>
              </div>
            </section>

            {summary.totalTransactions ===
            0 ? (
              <section className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  No transactions yet
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Add income or expenses to start building this business ledger.
                </p>
                <Link
                  href="/transactions"
                  className="mt-6 inline-flex rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Add Transaction
                </Link>
              </section>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
