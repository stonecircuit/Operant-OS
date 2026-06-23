"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import {
  createTransaction,
  deleteTransaction,
  getTransactions,
} from "@/services/transactionService";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
} from "@/types/transaction";
import type {
  Transaction,
  TransactionType,
} from "@/types/transaction";

const currencyFormatter =
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

const dateFormatter =
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function TransactionsPage() {
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
  const [submitting, setSubmitting] =
    useState(false);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);
  const [type, setType] =
    useState<TransactionType>("income");
  const [category, setCategory] =
    useState<string>(INCOME_CATEGORIES[0]);
  const [amount, setAmount] =
    useState("");
  const [description, setDescription] =
    useState("");
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [formError, setFormError] =
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
          "Load Transactions Error:",
          error
        );

        if (isCurrent) {
          setErrorMessage(
            "Unable to load transactions."
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

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort(
        (first, second) =>
          new Date(
            second.createdAt
          ).getTime() -
          new Date(
            first.createdAt
          ).getTime()
      ),
    [transactions]
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!activeBusinessId) {
      setFormError(
        "Select an active business before creating transactions."
      );
      return;
    }

    const parsedAmount =
      Number(amount);
    const cleanDescription =
      description.trim();

    if (
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setFormError(
        "Amount must be greater than zero."
      );
      return;
    }

    if (!cleanDescription) {
      setFormError(
        "Description is required."
      );
      return;
    }

    if (!category) {
      setFormError(
        "Category is required."
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setErrorMessage(null);

    try {
      const transaction =
        await createTransaction({
          businessId: activeBusinessId,
          type,
          amount: parsedAmount,
          description:
            cleanDescription,
          category,
        });

      setTransactions((current) =>
        [transaction, ...current].sort(
          (first, second) =>
            new Date(
              second.createdAt
            ).getTime() -
            new Date(
              first.createdAt
            ).getTime()
        )
      );
      setAmount("");
      setDescription("");
      setType("income");
      setCategory(INCOME_CATEGORIES[0]);
    } catch (error) {
      console.error(
        "Create Transaction Error:",
        error
      );
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to create transaction."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(
    transactionId: string
  ) {
    setDeletingId(transactionId);
    setErrorMessage(null);

    try {
      await deleteTransaction(
        transactionId
      );

      setTransactions((current) =>
        current.filter(
          (transaction) =>
            transaction.id !==
            transactionId
        )
      );
    } catch (error) {
      console.error(
        "Delete Transaction Error:",
        error
      );
      setErrorMessage(
        "Unable to delete transaction."
      );
    } finally {
      setDeletingId(null);
    }
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
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Transaction Engine
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Transactions
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {activeBusinessName
                ? `Active business: ${activeBusinessName}`
                : "No active business selected"}
            </p>
          </div>

          <nav className="flex gap-3 text-sm font-semibold">
            <Link
              href="/dashboard"
              className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Dashboard
            </Link>
            <Link
              href="/businesses"
              className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Businesses
            </Link>
            <Link
              href="/reports"
              className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Reports
            </Link>
          </nav>
        </header>

        {!activeBusinessId ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Select a business to manage transactions
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Transactions belong to a single business. Choose one before recording income or expenses.
            </p>
            <Link
              href="/businesses"
              className="mt-6 inline-flex rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Select Business
            </Link>
          </div>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="grid gap-5 md:grid-cols-[140px_160px_140px_1fr_auto] md:items-end">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Type
                  </span>
                  <select
                    value={type}
                    onChange={(event) => {
                      const newType = event.target.value as TransactionType;
                      setType(newType);
                      setCategory(
                        newType === "income"
                          ? INCOME_CATEGORIES[0]
                          : EXPENSE_CATEGORIES[0]
                      );
                    }}
                    className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  >
                    <option value="income">
                      Income
                    </option>
                    <option value="expense">
                      Expense
                    </option>
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Category
                  </span>
                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value)
                    }
                    className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  >
                    {type === "income"
                      ? INCOME_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))
                      : EXPENSE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Amount
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) =>
                      setAmount(
                        event.target.value
                      )
                    }
                    className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    placeholder="0.00"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Description
                  </span>
                  <input
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value
                      )
                    }
                    className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    placeholder="Client payment, rent, software..."
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {submitting
                    ? "Saving..."
                    : "Add Transaction"}
                </button>
              </div>

              {formError ? (
                <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {formError}
                </p>
              ) : null}
            </form>

            {errorMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
                <p className="font-medium">
                  {errorMessage}
                </p>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {transactionsLoading ? (
                <div className="p-8">
                  <p className="text-sm font-medium text-slate-600">
                    Loading transactions...
                  </p>
                </div>
              ) : sortedTransactions.length ===
                0 ? (
                <div className="p-10 text-center">
                  <h2 className="text-lg font-bold text-slate-900">
                    No transactions yet
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Record the first income or expense for this business.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">
                          Date
                        </th>
                        <th className="px-5 py-3 font-semibold">
                          Type
                        </th>
                        <th className="px-5 py-3 font-semibold">
                          Category
                        </th>
                        <th className="px-5 py-3 font-semibold">
                          Amount
                        </th>
                        <th className="px-5 py-3 font-semibold">
                          Description
                        </th>
                        <th className="px-5 py-3 text-right font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {sortedTransactions.map(
                        (transaction) => (
                          <tr
                            key={transaction.id}
                          >
                            <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                              {dateFormatter.format(
                                new Date(
                                  transaction.createdAt
                                )
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                  transaction.type ===
                                  "income"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700"
                                }`}
                              >
                                {transaction.type ===
                                "income"
                                  ? "Income"
                                  : "Expense"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                              {transaction.category}
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">
                              {currencyFormatter.format(
                                transaction.amount
                              )}
                            </td>
                            <td className="max-w-md px-5 py-4 text-slate-700">
                              {
                                transaction.description
                              }
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDelete(
                                    transaction.id
                                  )
                                }
                                disabled={
                                  deletingId ===
                                  transaction.id
                                }
                                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                              >
                                {deletingId ===
                                transaction.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
