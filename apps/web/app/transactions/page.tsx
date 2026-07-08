"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, FormEvent, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  createTransaction,
  deleteTransaction,
  getTransactionsPaginated,
  updateTransaction,
} from "@/services/transactionService";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/types/transaction";
import type { Transaction, TransactionType } from "@/types/transaction";
import Navbar from "@/components/Navbar";
import { logAction } from "@/services/auditLogService";
import { validateTransactionInput } from "@/lib/validation";
import { QueryDocumentSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function TransactionsPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    activeBusinessId,
    activeBusinessCurrency,
    activeBusinessTimezone,
    activeUserRole,
    activeBusinessIncomeCategories,
    activeBusinessExpenseCategories,
    refreshActiveBusiness,
  } = useBusiness();

  const incomeCategories = activeBusinessIncomeCategories || INCOME_CATEGORIES;
  const expenseCategories = activeBusinessExpenseCategories || EXPENSE_CATEGORIES;
  const { addNotification, refreshInsightAlerts } = useNotifications();
  const router = useRouter();

  // Data loading states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // New Transaction Form State
  const [type, setType] = useState<TransactionType>("expense");
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [currency, setCurrency] = useState("");
  const [createdAtDate, setCreatedAtDate] = useState("");

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Inline category creation states
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreatingNewCategoryEdit, setIsCreatingNewCategoryEdit] = useState(false);
  const [newCategoryNameEdit, setNewCategoryNameEdit] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modal / Side Panel States
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState<{
    type: TransactionType;
    category: string;
    amount: string;
    description: string;
    merchant: string;
    currency: string;
    date: string;
  } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Virtualization Scroll Container ref & state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const rowHeight = 52; // Height of each row in px
  const viewportHeight = 400; // Fixed visible area height

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, router, user]);

  // Load Transactions (first page)
  const loadFirstPage = useCallback(async () => {
    if (!activeBusinessId) return;
    setTransactionsLoading(true);
    setErrorMessage(null);
    try {
      const { transactions: list, lastVisible: docCursor } = await getTransactionsPaginated(
        activeBusinessId,
        25,
        {
          type: filterType,
          category: filterCategory,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          sortBy,
          searchQuery: debouncedSearchQuery,
        }
      );
      setTransactions(list);
      setLastVisible(docCursor);
      setHasMore(docCursor !== null);
    } catch (error) {
      console.error("Load Transactions Error:", error);
      setErrorMessage("Unable to load transactions.");
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  }, [activeBusinessId, filterType, filterCategory, startDate, endDate, sortBy, debouncedSearchQuery]);

  useEffect(() => {
    if (authLoading || !user || !activeBusinessId) {
      return;
    }
    const timer = setTimeout(() => {
      loadFirstPage();
    }, 0);
    return () => clearTimeout(timer);
  }, [activeBusinessId, authLoading, user, loadFirstPage]);

  // Load More (next page)
  const handleLoadMore = useCallback(async () => {
    if (!activeBusinessId || loadingMore || !lastVisible) return;
    setLoadingMore(true);
    try {
      const { transactions: list, lastVisible: docCursor } = await getTransactionsPaginated(
        activeBusinessId,
        25,
        {
          type: filterType,
          category: filterCategory,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          sortBy,
          searchQuery: debouncedSearchQuery,
          lastDocSnapshot: lastVisible,
        }
      );
      setTransactions((prev) => [...prev, ...list]);
      setLastVisible(docCursor);
      setHasMore(docCursor !== null);
    } catch (err) {
      console.error("Error loading next page of transactions:", err);
      setErrorMessage("Failed to load more transactions.");
    } finally {
      setLoadingMore(false);
    }
  }, [activeBusinessId, filterType, filterCategory, startDate, endDate, sortBy, debouncedSearchQuery, lastVisible, loadingMore]);

  // Sync edit form with editTx selection
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editTx) {
        setEditForm({
          type: editTx.type,
          category: editTx.category,
          amount: String(editTx.amount),
          description: editTx.description,
          merchant: editTx.merchant || "",
          currency: editTx.currency || activeBusinessCurrency || "USD",
          date: new Date(editTx.createdAt).toISOString().split("T")[0],
        });
        setEditFormError(null);
      } else {
        setEditForm(null);
        setEditFormError(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [editTx, activeBusinessCurrency]);

  // Dynamic currency and date format helpers
  const formatCurrency = useMemo(() => {
    const defaultCurrency = activeBusinessCurrency || "USD";
    return (value: number, customCode?: string) => {
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: customCode || defaultCurrency,
        }).format(value);
      } catch {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(value);
      }
    };
  }, [activeBusinessCurrency]);

  const formatDate = useMemo(() => {
    const tz = activeBusinessTimezone || "UTC";
    return (isoString: string) => {
      try {
        return new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: tz,
        }).format(new Date(isoString));
      } catch {
        return new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date(isoString));
      }
    };
  }, [activeBusinessTimezone]);

  // Filtered & Sorted Transactions (applied on local memory state)
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        // Amount filters
        if (minAmount && t.amount < Number(minAmount)) return false;
        if (maxAmount && t.amount > Number(maxAmount)) return false;
        return true;
      });
  }, [transactions, minAmount, maxAmount]);

  // Virtualization slicing values
  const { visibleTransactions, topPadding, bottomPadding } = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
    const endIndex = Math.min(filteredTransactions.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 2);
    const sliced = filteredTransactions.slice(startIndex, endIndex);
    
    return {
      visibleTransactions: sliced,
      topPadding: startIndex * rowHeight,
      bottomPadding: (filteredTransactions.length - endIndex) * rowHeight,
    };
  }, [filteredTransactions, scrollTop]);

  async function handleCreateCategoryInline() {
    if (!activeBusinessId || !user) return;

    if (activeUserRole === "staff") {
      addNotification("error", "Unauthorized", "Staff members cannot modify categories.");
      return;
    }

    const cleanCat = newCategoryName.trim();
    if (!cleanCat) {
      addNotification("error", "Error", "Category name cannot be empty.");
      return;
    }

    const currentList = type === "income" ? incomeCategories : expenseCategories;
    if (currentList.includes(cleanCat)) {
      addNotification("error", "Error", "Category already exists.");
      return;
    }

    const updatedList = [...currentList, cleanCat];

    try {
      const docRef = doc(db, "businesses", activeBusinessId);
      const updatePayload = type === "income" 
        ? { incomeCategories: updatedList }
        : { expenseCategories: updatedList };
      
      await updateDoc(docRef, updatePayload);

      await logAction(
        activeBusinessId,
        user.uid,
        user.email || "",
        `add_business_category_${type}`,
        { category: cleanCat }
      );

      addNotification("success", "Category Created", `Successfully added "${cleanCat}" category.`);
      setIsCreatingNewCategory(false);
      setCategory(cleanCat);
      await refreshActiveBusiness();
    } catch (err) {
      console.error("Add category inline error:", err);
      addNotification("error", "Error", err instanceof Error ? err.message : "Failed to add category.");
    }
  }

  async function handleCreateCategoryInlineEdit() {
    if (!activeBusinessId || !user || !editForm) return;

    if (activeUserRole === "staff") {
      addNotification("error", "Unauthorized", "Staff members cannot modify categories.");
      return;
    }

    const cleanCat = newCategoryNameEdit.trim();
    if (!cleanCat) {
      addNotification("error", "Error", "Category name cannot be empty.");
      return;
    }

    const currentList = editForm.type === "income" ? incomeCategories : expenseCategories;
    if (currentList.includes(cleanCat)) {
      addNotification("error", "Error", "Category already exists.");
      return;
    }

    const updatedList = [...currentList, cleanCat];

    try {
      const docRef = doc(db, "businesses", activeBusinessId);
      const updatePayload = editForm.type === "income" 
        ? { incomeCategories: updatedList }
        : { expenseCategories: updatedList };
      
      await updateDoc(docRef, updatePayload);

      await logAction(
        activeBusinessId,
        user.uid,
        user.email || "",
        `add_business_category_${editForm.type}`,
        { category: cleanCat }
      );

      addNotification("success", "Category Created", `Successfully added "${cleanCat}" category.`);
      setIsCreatingNewCategoryEdit(false);
      setEditForm({ ...editForm, category: cleanCat });
      await refreshActiveBusiness();
    } catch (err) {
      console.error("Add category inline error:", err);
      addNotification("error", "Error", err instanceof Error ? err.message : "Failed to add category.");
    }
  }

  // Form handlers
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeBusinessId || !user) {
      setFormError("Select an active business before creating transactions.");
      return;
    }

    const validation = validateTransactionInput({
      businessId: activeBusinessId,
      type,
      amount,
      description,
      category: category || (type === "income" ? incomeCategories[0] : expenseCategories[0]),
      createdAt: createdAtDate || undefined,
      merchant: merchant || undefined,
      currency: currency || undefined,
    }, incomeCategories, expenseCategories);

    if (!validation.isValid || !validation.sanitized) {
      setFormError(validation.errors.join(". "));
      return;
    }

    const {
      amount: valAmount,
      description: valDesc,
      category: valCat,
      createdAt: valCreatedAt,
      merchant: valMerchant,
      currency: valCurrency,
    } = validation.sanitized;

    setSubmitting(true);
    setFormError(null);
    setErrorMessage(null);

    try {
      const transaction = await createTransaction({
        businessId: activeBusinessId,
        type,
        amount: valAmount,
        description: valDesc,
        category: valCat,
        merchant: valMerchant || undefined,
        currency: valCurrency || activeBusinessCurrency || "USD",
        createdAt: valCreatedAt,
      });

      // Audit log entry
      await logAction(
        activeBusinessId,
        user.uid,
        user.email || "",
        "create_transaction",
        {
          transactionId: transaction.id,
          amount: valAmount,
          category: valCat,
          type,
        }
      );

      setTransactions((current) => [transaction, ...current]);
      setAmount("");
      setDescription("");
      setMerchant("");
      setCurrency("");
      setCreatedAtDate("");
      setType("expense");
      setCategory(EXPENSE_CATEGORIES[0]);
      
      addNotification("success", "Transaction Added", `Successfully logged ${formatCurrency(valAmount)} to ${valCat}.`);
      refreshInsightAlerts();
    } catch (error) {
      console.error("Create Transaction Error:", error);
      setFormError(error instanceof Error ? error.message : "Unable to create transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  // Edit save handler
  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editTx || !editForm || !user || !activeBusinessId) return;

    const validation = validateTransactionInput({
      businessId: activeBusinessId,
      type: editForm.type,
      amount: editForm.amount,
      description: editForm.description,
      category: editForm.category,
      createdAt: editForm.date,
      merchant: editForm.merchant || undefined,
      currency: editForm.currency || undefined,
    }, incomeCategories, expenseCategories);

    if (!validation.isValid || !validation.sanitized) {
      setEditFormError(validation.errors.join(". "));
      return;
    }

    const {
      type: valType,
      amount: valAmount,
      description: valDesc,
      category: valCat,
      createdAt: valCreatedAt,
      merchant: valMerchant,
      currency: valCurrency,
    } = validation.sanitized;

    setSubmitting(true);
    setEditFormError(null);
    try {
      await updateTransaction(editTx.id, {
        type: valType,
        category: valCat,
        amount: valAmount,
        description: valDesc,
        merchant: valMerchant || "",
        currency: valCurrency || "",
        createdAt: valCreatedAt,
      });

      // Audit log entry
      await logAction(
        activeBusinessId,
        user.uid,
        user.email || "",
        "update_transaction",
        {
          transactionId: editTx.id,
          amount: valAmount,
          category: valCat,
          type: valType,
        }
      );

      // Update state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editTx.id
            ? {
                ...t,
                type: valType,
                category: valCat,
                amount: valAmount,
                description: valDesc,
                merchant: valMerchant,
                currency: valCurrency,
                createdAt: valCreatedAt,
              }
            : t
        )
      );

      setEditTx(null);
      setEditFormError(null);
      addNotification("success", "Transaction Updated", "Successfully saved transaction modifications.");
      refreshInsightAlerts();
    } catch (err) {
      console.error("Error editing transaction:", err);
      setEditFormError(err instanceof Error ? err.message : "Failed to save edits.");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete handler
  async function handleDeleteConfirm() {
    if (!confirmDeleteId || !user || !activeBusinessId) return;

    if (activeUserRole === "staff") {
      addNotification("error", "Unauthorized", "Staff members cannot delete transactions.");
      setConfirmDeleteId(null);
      return;
    }

    setDeleting(true);
    try {
      await deleteTransaction(confirmDeleteId);

      // Audit log entry
      await logAction(
        activeBusinessId,
        user.uid,
        user.email || "",
        "delete_transaction",
        {
          transactionId: confirmDeleteId,
        }
      );

      setTransactions((current) => current.filter((t) => t.id !== confirmDeleteId));
      
      addNotification("warning", "Transaction Deleted", "Removed transaction entry from the database.");
      setConfirmDeleteId(null);
      refreshInsightAlerts();
    } catch (error) {
      console.error("Delete Transaction Error:", error);
      setErrorMessage("Unable to delete transaction.");
    } finally {
      setDeleting(false);
    }
  }

  // Duplicate handler
  async function handleDuplicate(tx: Transaction) {
    if (!activeBusinessId || !user) return;
    try {
      const duplicated = await createTransaction({
        businessId: activeBusinessId,
        type: tx.type,
        amount: tx.amount,
        description: `${tx.description} (Copy)`,
        category: tx.category,
        merchant: tx.merchant,
        currency: tx.currency,
        createdAt: new Date().toISOString(), // set to today
      });

      // Audit log entry
      await logAction(
        activeBusinessId,
        user.uid,
        user.email || "",
        "duplicate_transaction",
        {
          originalId: tx.id,
          duplicatedId: duplicated.id,
        }
      );

      setTransactions((prev) => [duplicated, ...prev]);
      addNotification("success", "Transaction Duplicated", `Cloned entry for ${tx.description} successfully.`);
      refreshInsightAlerts();
    } catch (err) {
      console.error("Error duplicating transaction:", err);
      addNotification("error", "Duplicate Error", "Failed to duplicate transaction.");
    }
  }

  const allCategoryOptions = useMemo(() => {
    return [...incomeCategories, ...expenseCategories];
  }, [incomeCategories, expenseCategories]);

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery !== "" ||
      filterType !== "all" ||
      filterCategory !== "all" ||
      minAmount !== "" ||
      maxAmount !== "" ||
      startDate !== "" ||
      endDate !== "" ||
      sortBy !== "date-desc"
    );
  }, [searchQuery, filterType, filterCategory, minAmount, maxAmount, startDate, endDate, sortBy]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setFilterType("all");
    setFilterCategory("all");
    setMinAmount("");
    setMaxAmount("");
    setStartDate("");
    setEndDate("");
    setSortBy("date-desc");
  }, []);

  const isStaff = activeUserRole === "staff";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 sm:px-6 py-8">
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          
          {!activeBusinessId ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm max-w-lg mx-auto w-full mt-8">
              <h2 className="text-lg font-extrabold text-slate-900">Select a business to manage transactions</h2>
              <p className="mt-2 text-xs text-slate-500">
                Transactions belong to a single business scope. Choose one before recording ledger entries.
              </p>
              <Link
                href="/businesses"
                className="mt-6 inline-flex rounded-lg bg-slate-950 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
              >
                Select Business
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              
              {/* Left Column: Form & Filters */}
              <div className="lg:col-span-1 flex flex-col gap-6">
                
                {/* Add Transaction Form */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Add Transaction</h3>
                    <div className="flex gap-1.5">
                      <Link
                        href="/transactions/receipt"
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition"
                      >
                        📄 Scan Receipt
                      </Link>
                      <Link
                        href="/transactions/ai"
                        className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 transition"
                      >
                        🤖 AI Chat Entry
                      </Link>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Type</span>
                        <select
                          value={type}
                          onChange={(e) => {
                            const newType = e.target.value as TransactionType;
                            setType(newType);
                            setCategory(newType === "income" ? incomeCategories[0] : expenseCategories[0]);
                          }}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                        >
                          <option value="expense">Expense (Outflow)</option>
                          <option value="income">Income (Inflow)</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Category</span>
                        <select
                          value={category || (type === "income" ? incomeCategories[0] : expenseCategories[0])}
                          onChange={(e) => {
                            if (e.target.value === "__new__") {
                              setIsCreatingNewCategory(true);
                              setNewCategoryName("");
                            } else {
                              setCategory(e.target.value);
                            }
                          }}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                        >
                          {type === "income"
                            ? incomeCategories.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))
                            : expenseCategories.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                          {activeUserRole !== "staff" && (
                            <option value="__new__">＋ Create New Category...</option>
                          )}
                        </select>
                      </label>
                    </div>

                    {isCreatingNewCategory && (
                      <div className="flex flex-col gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-lg mb-3">
                        <span className="text-xs font-semibold text-slate-500">Create New {type === "income" ? "Income" : "Expense"} Category</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Category name"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                          />
                          <button
                            type="button"
                            onClick={handleCreateCategoryInline}
                            className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-semibold text-sm flex items-center justify-center whitespace-nowrap cursor-pointer"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingNewCategory(false);
                              setCategory(type === "income" ? incomeCategories[0] : expenseCategories[0]);
                            }}
                            className="h-9 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 rounded-lg transition text-sm flex items-center justify-center cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-[1fr_80px] gap-3">
                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Amount</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                        />
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Currency</span>
                        <input
                          type="text"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          placeholder={activeBusinessCurrency || "USD"}
                          className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 uppercase"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Merchant</span>
                        <input
                          type="text"
                          value={merchant}
                          onChange={(e) => setMerchant(e.target.value)}
                          placeholder="e.g. Amazon, Uber"
                          className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                        />
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Date (Optional)</span>
                        <input
                          type="date"
                          value={createdAtDate}
                          onChange={(e) => setCreatedAtDate(e.target.value)}
                          className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                        />
                      </label>
                    </div>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-500">Description</span>
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g. Office supplies purchase"
                        className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="mt-2 h-9 rounded-lg bg-slate-900 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      {submitting ? "Saving..." : "Add Transaction"}
                    </button>

                    {formError && (
                      <p className="rounded-lg bg-red-50 p-2.5 text-[11px] font-semibold text-red-700 border border-red-100">
                        {formError}
                      </p>
                    )}
                  </form>
                </div>

                {/* Collapsible Search & Filters */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between w-full text-xs font-bold text-slate-800">
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(!filtersOpen)}
                      className="flex items-center gap-1.5 focus:outline-none"
                    >
                      <span>🔍</span>
                      <span>Filters & Search</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">
                        {filtersOpen ? "▴" : "▾"}
                      </span>
                    </button>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800 transition focus:outline-none"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>

                  <div className={`flex flex-col gap-3.5 text-xs transition-all ${filtersOpen ? "block" : "hidden"}`}>
                    <label className="flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-500">Search text</span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search merchant or description..."
                        className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Type</span>
                        <select
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500"
                        >
                          <option value="all">All Types</option>
                          <option value="income">Income</option>
                          <option value="expense">Expense</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Category</span>
                        <select
                          value={filterCategory}
                          onChange={(e) => setFilterCategory(e.target.value)}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500"
                        >
                          <option value="all">All Categories</option>
                          {allCategoryOptions.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Min Amount</span>
                        <input
                          type="number"
                          value={minAmount}
                          onChange={(e) => setMinAmount(e.target.value)}
                          placeholder="0.00"
                          className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Max Amount</span>
                        <input
                          type="number"
                          value={maxAmount}
                          onChange={(e) => setMaxAmount(e.target.value)}
                          placeholder="0.00"
                          className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Start Date</span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">End Date</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Sort By</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500"
                        >
                          <option value="date-desc">Newest First</option>
                          <option value="date-asc">Oldest First</option>
                          <option value="amount-desc">Amount: High-Low</option>
                          <option value="amount-asc">Amount: Low-High</option>
                          <option value="desc-asc">Desc: A-Z</option>
                          <option value="desc-desc">Desc: Z-A</option>
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setFilterType("all");
                          setFilterCategory("all");
                          setMinAmount("");
                          setMaxAmount("");
                          setStartDate("");
                          setEndDate("");
                          setSortBy("date-desc");
                        }}
                        className="self-end h-9 rounded-lg border border-slate-250 font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Reset Filters
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Ledger List */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                
                {errorMessage && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
                    {errorMessage}
                  </div>
                )}

                {isStaff && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-medium text-slate-500">
                    ℹ️ You are in read-only ledger viewing mode for delete actions.
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                  {transactionsLoading ? (
                    /* Skeletons */
                    <div className="flex flex-col divide-y divide-slate-100 p-5 gap-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center justify-between gap-4 py-2 animate-pulse">
                          <div className="flex flex-col gap-1 flex-1">
                            <div className="h-4 bg-slate-200 rounded w-1/3" />
                            <div className="h-3 bg-slate-100 rounded w-1/4" />
                          </div>
                          <div className="h-5 bg-slate-200 rounded w-16" />
                        </div>
                      ))}
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
                      <span className="text-2xl">📁</span>
                      <h4 className="text-sm font-bold text-slate-800">No matching transactions</h4>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Adjust your search query, change filter dropdowns, or add a new transaction to populate this list.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Virtualized Table Scroll Box */}
                      <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="overflow-y-auto"
                        style={{ height: `${viewportHeight}px`, position: "relative" }}
                      >
                        <div style={{ height: `${filteredTransactions.length * rowHeight}px`, position: "relative" }}>
                          <table className="min-w-full divide-y divide-slate-200 text-xs" style={{ position: "absolute", top: 0, left: 0, width: "100%" }}>
                            <thead className="bg-slate-50 text-left uppercase font-bold text-slate-500 sticky top-0 z-10">
                              <tr>
                                <th className="px-5 py-3.5 tracking-wider">Date</th>
                                <th className="px-5 py-3.5 tracking-wider">Type</th>
                                <th className="px-5 py-3.5 tracking-wider">Source</th>
                                <th className="px-5 py-3.5 tracking-wider">Category</th>
                                <th className="px-5 py-3.5 tracking-wider text-right">Amount</th>
                                <th className="px-5 py-3.5 text-right tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {/* Top spacer for virtualization offset */}
                              <tr style={{ height: `${topPadding}px` }}><td colSpan={6} className="p-0 border-0"></td></tr>
                              
                              {visibleTransactions.map((tx) => (
                                <tr key={tx.id} style={{ height: `${rowHeight}px` }} className="hover:bg-slate-50/50 transition">
                                  <td className="whitespace-nowrap px-5 py-3 text-slate-500 font-semibold align-middle">
                                    {formatDate(tx.createdAt)}
                                  </td>
                                  <td className="px-5 py-3 align-middle">
                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                      tx.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                    }`}>
                                      {tx.type === "income" ? "Income" : "Expense"}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 font-bold text-slate-800 truncate max-w-[140px] align-middle">
                                    {tx.merchant || tx.description}
                                  </td>
                                  <td className="whitespace-nowrap px-5 py-3 text-slate-600 font-medium align-middle">
                                    {tx.category}
                                  </td>
                                  <td className={`whitespace-nowrap px-5 py-3 font-extrabold text-right align-middle ${
                                    tx.type === "income" ? "text-emerald-700" : "text-slate-900"
                                  }`}>
                                    {tx.type === "income" ? "" : "-"}{formatCurrency(tx.amount, tx.currency)}
                                  </td>
                                  <td className="px-5 py-3 text-right flex items-center justify-end gap-1.5 h-full align-middle">
                                    <button
                                      type="button"
                                      onClick={() => setDetailTx(tx)}
                                      title="View Details"
                                      className="rounded bg-slate-100 hover:bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700 transition"
                                    >
                                      View
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditTx(tx)}
                                      title="Edit"
                                      className="rounded bg-indigo-50 hover:bg-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-700 transition"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicate(tx)}
                                      title="Clone"
                                      className="rounded bg-emerald-50 hover:bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700 transition"
                                    >
                                      Clone
                                    </button>
                                    {!isStaff && (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(tx.id)}
                                        title="Delete"
                                        className="rounded border border-slate-200 hover:border-red-500 hover:bg-red-50 hover:text-red-700 px-2 py-1 text-[10px] font-bold text-slate-600 transition"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              
                              {/* Bottom spacer for virtualization offset */}
                              <tr style={{ height: `${bottomPadding}px` }}><td colSpan={6} className="p-0 border-0"></td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Pagination Controls */}
                      {hasMore && (
                        <div className="border-t border-slate-200 bg-slate-50 p-3.5 flex justify-center">
                          <button
                            type="button"
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="h-8 rounded-lg border border-slate-350 px-5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition disabled:opacity-50 shadow-xs"
                          >
                            {loadingMore ? "Loading more..." : "Load More Transactions"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

              </div>

            </div>
          )}

        </section>
      </main>

      {/* Details Side-Drawer Panel */}
      {detailTx && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/20 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col gap-6 animate-in slide-in-from-right duration-250">
            <div className="flex items-center justify-between border-b border-slate-150 pb-4">
              <h3 className="text-base font-extrabold text-slate-900">Transaction Details</h3>
              <button
                type="button"
                onClick={() => setDetailTx(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-5 text-xs">
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Transaction ID</span>
                  <span className="font-mono text-[10px] text-slate-600">{detailTx.id}</span>
                </div>
                <span className={`rounded-full px-3 py-0.5 text-[10px] font-bold ${
                  detailTx.type === "income" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}>
                  {detailTx.type === "income" ? "Income" : "Expense"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Merchant</span>
                  <span className="text-slate-800 font-bold text-sm">{detailTx.merchant || "None"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</span>
                  <span className={`font-black text-sm ${detailTx.type === "income" ? "text-emerald-700" : "text-slate-900"}`}>
                    {detailTx.type === "income" ? "" : "-"}{formatCurrency(detailTx.amount, detailTx.currency)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</span>
                  <span className="text-slate-700 font-semibold">{detailTx.category}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created Date</span>
                  <span className="text-slate-700 font-semibold">{formatDate(detailTx.createdAt)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</span>
                <p className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-slate-700 leading-normal">
                  {detailTx.description}
                </p>
              </div>

              {detailTx.currency && detailTx.currency !== activeBusinessCurrency && (
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3.5 text-[11px] text-indigo-800 font-semibold">
                  ℹ This transaction was recorded in foreign currency ({detailTx.currency}) and was converted relative to your base currency ({activeBusinessCurrency || "USD"}).
                </div>
              )}
            </div>

            <div className="border-t border-slate-150 pt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditTx(detailTx);
                  setDetailTx(null);
                }}
                className="flex-1 h-10 rounded-lg bg-indigo-600 text-xs font-bold text-white transition hover:bg-indigo-700"
              >
                Edit Transaction
              </button>
              <button
                type="button"
                onClick={() => setDetailTx(null)}
                className="flex-1 h-10 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal Dialog */}
      {editTx && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 backdrop-blur-xs animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Edit Transaction Details</h3>
              <button
                type="button"
                onClick={() => setEditTx(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {editFormError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 font-semibold leading-relaxed">
                {editFormError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-semibold text-slate-500">Transaction Type</span>
                <select
                  value={editForm.type}
                  onChange={(e) => {
                    const newType = e.target.value as TransactionType;
                    setEditForm({
                      ...editForm,
                      type: newType,
                      category: newType === "income" ? incomeCategories[0] : expenseCategories[0],
                    });
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 focus:ring-2"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-semibold text-slate-500">Category</span>
                <select
                  value={editForm.category}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setIsCreatingNewCategoryEdit(true);
                      setNewCategoryNameEdit("");
                    } else {
                      setEditForm({ ...editForm, category: e.target.value });
                    }
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 focus:ring-2"
                >
                  {editForm.type === "income"
                    ? incomeCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))
                    : expenseCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  {activeUserRole !== "staff" && (
                    <option value="__new__">＋ Create New Category...</option>
                  )}
                </select>
              </label>
            </div>

            {isCreatingNewCategoryEdit && (
              <div className="flex flex-col gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs font-semibold text-slate-500">Create New {editForm.type === "income" ? "Income" : "Expense"} Category</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Category name"
                    value={newCategoryNameEdit}
                    onChange={(e) => setNewCategoryNameEdit(e.target.value)}
                    className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none text-sm focus:border-indigo-500 focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategoryInlineEdit}
                    className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-semibold text-sm flex items-center justify-center whitespace-nowrap cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewCategoryEdit(false);
                      setEditForm({
                        ...editForm,
                        category: editForm.type === "income" ? incomeCategories[0] : expenseCategories[0],
                      });
                    }}
                    className="h-9 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 rounded-lg transition text-sm flex items-center justify-center cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-[1fr_80px] gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-semibold text-slate-500">Amount</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-semibold text-slate-500">Currency</span>
                <input
                  type="text"
                  value={editForm.currency}
                  onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                  className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 uppercase"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-semibold text-slate-500">Merchant</span>
                <input
                  type="text"
                  value={editForm.merchant}
                  onChange={(e) => setEditForm({ ...editForm, merchant: e.target.value })}
                  className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-semibold text-slate-500">Date</span>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-semibold text-slate-500">Description</span>
              <input
                type="text"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500"
              />
            </label>

            <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setEditTx(null)}
                className="h-9 rounded-lg border border-slate-200 px-4 font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-5 font-bold text-white transition disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150 text-xs">
            <h3 className="text-sm font-bold text-slate-800">Confirm Deletion</h3>
            <p className="text-slate-600 leading-normal">
              Are you sure you want to permanently delete this transaction? This action cannot be undone and will immediately recalculate profit/loss summaries.
            </p>
            <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="h-9 rounded-lg border border-slate-200 px-4 font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="h-9 rounded-lg bg-red-600 hover:bg-red-700 px-5 font-bold text-white transition disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
