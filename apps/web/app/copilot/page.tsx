"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { createTransaction } from "@/services/transactionService";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/types/transaction";
import Navbar from "@/components/Navbar";
import { validateTransactionInput } from "@/lib/validation";
import { getProducts, performStockOperation } from "@/services/inventoryService";
import type { Product } from "@/types/inventory";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  extractedData?: {
    type: "income" | "expense";
    amount: number;
    category: string;
    description: string;
    date: string; // YYYY-MM-DD
  };
  extractedInventoryData?: {
    productId?: string;
    productName: string;
    type: "stock_in" | "stock_out";
    quantity: number;
    reason: string;
    notes?: string;
  };
  status?: "pending" | "confirmed" | "cancelled";
  transactionId?: string;
}

const suggestedQuestions = [
  "How is my business doing?",
  "Where am I spending money?",
  "What is my biggest expense?",
  "Explain my financial health.",
  "What trends do you notice?",
];

export default function CopilotPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    activeBusinessId,
    activeBusinessName,
    activeBusinessIncomeCategories,
    activeBusinessExpenseCategories,
  } = useBusiness();
  const router = useRouter();

  const incomeCategories = activeBusinessIncomeCategories || INCOME_CATEGORIES;
  const expenseCategories = activeBusinessExpenseCategories || EXPENSE_CATEGORIES;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // Load products for auto-matching in confirmation cards
  useEffect(() => {
    const businessId = activeBusinessId;
    if (!businessId) {
      setProducts([]);
      return;
    }
    async function loadProducts() {
      try {
        const list = await getProducts(businessId as string);
        setProducts(list);
      } catch (err) {
        console.error("Error loading products in copilot page:", err);
      }
    }
    loadProducts();
  }, [activeBusinessId]);

  // Card operation states
  const [savingMsgIds, setSavingMsgIds] = useState<Record<string, boolean>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string | null>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, router, user]);

  const displayedMessages = useMemo(() => {
    if (!activeBusinessName) {
      return [];
    }
    const welcomeMessage: ChatMessage = {
      id: "welcome",
      role: "assistant",
      content: `Hello! I am your AI Financial Copilot for **${activeBusinessName || "your business"}**. I can analyze your transactions, category breakdowns, and insights to answer your financial questions. Ask me anything, or try one of the suggested questions below!`,
    };
    return [welcomeMessage, ...messages];
  }, [activeBusinessName, messages]);

  // Scroll to bottom of message list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(textToSend: string) {
    const cleanText = textToSend.trim();
    if (!cleanText || !activeBusinessId) {
      return;
    }

    const userMsgId = crypto.randomUUID();
    const newMessages: ChatMessage[] = [
      ...messages,
      { id: userMsgId, role: "user", content: cleanText },
    ];

    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      // Send history excluding the current prompt
      const requestHistory = newMessages.slice(0, -1).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const idToken = user ? await user.getIdToken() : "";
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          businessId: activeBusinessId,
          businessName: activeBusinessName,
          message: cleanText,
          history: requestHistory,
        }),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = null;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        throw new Error(data?.error || `Request failed with status ${response.status}: ${response.statusText || 'Internal Server Error'}`);
      }

      if (!data) {
        throw new Error("Received empty or invalid response format from server.");
      }

      let extractedInv = data.extractedInventoryData;
      if (extractedInv && !extractedInv.productId && products.length > 0) {
        const matched = products.find(
          (p) => p.name.toLowerCase() === extractedInv.productName.toLowerCase()
        );
        if (matched) {
          extractedInv = { ...extractedInv, productId: matched.id };
        }
      }

      const responseMsgId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: responseMsgId,
          role: "assistant",
          content: data.response,
          intent: data.intent,
          extractedData: data.extractedData,
          extractedInventoryData: extractedInv,
          status: (data.extractedData || extractedInv) ? "pending" : undefined,
        },
      ]);
    } catch (err) {
      console.error("Copilot request error:", err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred while communicating with the Copilot.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function handleClearChat() {
    setMessages([]);
    setError(null);
    setCardErrors({});
    setSavingMsgIds({});
  }

  const updateExtractedInventoryField = (
    msgId: string,
    field: keyof NonNullable<ChatMessage["extractedInventoryData"]>,
    value: string | number | boolean | undefined
  ) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === msgId && msg.extractedInventoryData) {
          const updatedData = { ...msg.extractedInventoryData, [field]: value };
          if (field === "productId") {
            const found = products.find((p) => p.id === value);
            if (found) {
              updatedData.productName = found.name;
            }
          }
          return {
            ...msg,
            extractedInventoryData: updatedData,
          };
        }
        return msg;
      })
    );
  };

  const handleConfirmInventorySave = async (msg: ChatMessage) => {
    if (!msg.extractedInventoryData || !activeBusinessId) {
      return;
    }

    const { productId, type, quantity, reason, notes } = msg.extractedInventoryData;

    if (!productId) {
      setCardErrors((prev) => ({
        ...prev,
        [msg.id]: "Please select a product from the list.",
      }));
      return;
    }

    if (quantity <= 0) {
      setCardErrors((prev) => ({
        ...prev,
        [msg.id]: "Quantity must be greater than zero.",
      }));
      return;
    }

    setSavingMsgIds((prev) => ({ ...prev, [msg.id]: true }));
    setCardErrors((prev) => ({ ...prev, [msg.id]: null }));

    try {
      await performStockOperation(
        activeBusinessId,
        productId,
        type,
        Number(quantity),
        reason || "AI Adjustment",
        notes,
        user?.uid,
        user?.email || undefined
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, status: "confirmed" } : m
        )
      );
    } catch (err) {
      console.error("Save stock operation error from card:", err);
      setCardErrors((prev) => ({
        ...prev,
        [msg.id]: err instanceof Error ? err.message : "Failed to log stock adjustment.",
      }));
    } finally {
      setSavingMsgIds((prev) => ({ ...prev, [msg.id]: false }));
    }
  };

  const handleConfirmSave = async (msg: ChatMessage) => {
    if (!msg.extractedData || !activeBusinessId) {
      return;
    }

    const validation = validateTransactionInput({
      businessId: activeBusinessId,
      type: msg.extractedData.type,
      amount: msg.extractedData.amount,
      description: msg.extractedData.description,
      category: msg.extractedData.category,
      createdAt: msg.extractedData.date,
    }, incomeCategories, expenseCategories);

    if (!validation.isValid || !validation.sanitized) {
      setCardErrors((prev) => ({ ...prev, [msg.id]: validation.errors.join(". ") }));
      return;
    }

    const {
      type: valType,
      amount: valAmount,
      description: valDesc,
      category: valCat,
      createdAt: valCreatedAt,
    } = validation.sanitized;

    setSavingMsgIds((prev) => ({ ...prev, [msg.id]: true }));
    setCardErrors((prev) => ({ ...prev, [msg.id]: null }));

    try {
      const createdTx = await createTransaction({
        businessId: activeBusinessId,
        type: valType,
        amount: valAmount,
        description: valDesc,
        category: valCat,
        createdAt: valCreatedAt,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, status: "confirmed", transactionId: createdTx.id }
            : m
        )
      );
    } catch (err) {
      console.error("Save transaction error from card:", err);
      setCardErrors((prev) => ({
        ...prev,
        [msg.id]: err instanceof Error ? err.message : "Failed to save transaction.",
      }));
    } finally {
      setSavingMsgIds((prev) => ({ ...prev, [msg.id]: false }));
    }
  };

  const handleCancelCard = (msgId: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === msgId ? { ...msg, status: "cancelled" } : msg))
    );
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <section className="mx-auto w-full max-w-6xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Loading account...</p>
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
        <section className="mx-auto flex w-full max-w-4xl flex-col flex-1 gap-6">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
            <p className="text-sm font-medium text-slate-500 font-semibold uppercase tracking-wider">Operant OS</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">AI Copilot</h1>
          </div>

        {!activeBusinessId ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Select a business to consult the Copilot</h2>
            <p className="mt-2 text-sm text-slate-600">
              The AI Copilot uses active business metrics, categories, reports, and insights to answer questions.
            </p>
            <Link
              href="/businesses"
              className="mt-6 inline-flex rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Select Business
            </Link>
          </section>
        ) : (
          <div key={activeBusinessId || "no-business"} className="flex flex-col flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[500px]">
            {/* Chat header */}
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-pulse" />
                <span className="text-sm font-bold text-slate-800">AI Central Router</span>
              </div>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="text-xs font-semibold text-slate-500 hover:text-red-600 transition"
                >
                  Clear Chat
                </button>
              )}
            </div>

            {/* Chat messages */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-5 max-h-[500px]">
              {displayedMessages.map((msg, index) => {
                const isUser = msg.role === "user";
                const cardError = cardErrors[msg.id];
                const isSaving = savingMsgIds[msg.id];
                const categoryOptions = msg.extractedData?.type === "income" ? incomeCategories : expenseCategories;

                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col max-w-[85%] ${
                      isUser ? "self-end items-end" : "self-start items-start"
                    }`}
                  >
                    <span className="text-[10px] font-semibold text-slate-400 mb-1">
                      {isUser ? "You" : "Copilot"}
                    </span>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm border ${
                        isUser
                          ? "bg-slate-900 border-slate-900 text-white rounded-tr-none"
                          : "bg-slate-50 border-slate-200 text-slate-900 rounded-tl-none"
                      }`}
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {msg.content}
                    </div>

                    {/* Editable Confirmation Card */}
                    {!isUser && msg.intent === "create_transaction" && msg.extractedData && msg.status && (
                      <div
                        className={`mt-3 w-full min-w-[280px] sm:min-w-[460px] max-w-lg rounded-xl border p-5 shadow-lg flex flex-col gap-4 text-slate-900 transition-all duration-300 bg-white ${
                          msg.status === "confirmed"
                            ? "border-emerald-500 ring-4 ring-emerald-500/5 bg-emerald-50/5"
                            : msg.status === "cancelled"
                            ? "border-slate-200 bg-slate-50/50 opacity-85"
                            : "border-indigo-200 ring-4 ring-indigo-500/5"
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              msg.status === "confirmed"
                                ? "bg-emerald-100 text-emerald-700"
                                : msg.status === "cancelled"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-indigo-50 text-indigo-600"
                            }`}>
                              {msg.status === "confirmed" ? "✓" : msg.status === "cancelled" ? "✕" : "$"}
                            </span>
                            <span className="text-sm font-bold text-slate-800">Transaction Draft</span>
                          </div>
                          <div>
                            {msg.status === "confirmed" && (
                              <span className="inline-flex items-center rounded-md bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                Saved to Ledger
                              </span>
                            )}
                            {msg.status === "cancelled" && (
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                                Cancelled
                              </span>
                            )}
                            {msg.status === "pending" && (
                              <span className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 animate-pulse">
                                Needs Approval
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Form Grid */}
                        <div className="grid gap-3 sm:grid-cols-2 text-xs">
                          <label className="flex flex-col gap-1.5">
                            <span className="font-semibold text-slate-500">Transaction Type</span>
                            <select
                              value={msg.extractedData.type}
                              onChange={(e) => {
                                const val = e.target.value as "income" | "expense";
                                setMessages((prev) =>
                                  prev.map((m) =>
                                    m.id === msg.id && m.extractedData
                                      ? {
                                          ...m,
                                          extractedData: {
                                            ...m.extractedData,
                                            type: val,
                                            category: val === "income" ? incomeCategories[0] : expenseCategories[0],
                                          },
                                        }
                                      : m
                                  )
                                );
                              }}
                              disabled={msg.status !== "pending" || isSaving}
                              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500"
                            >
                              <option value="income">Income (Inflow)</option>
                              <option value="expense">Expense (Outflow)</option>
                            </select>
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="font-semibold text-slate-500">Category</span>
                            <select
                              value={msg.extractedData.category}
                              onChange={(e) => {
                                setMessages((prev) =>
                                  prev.map((m) =>
                                    m.id === msg.id && m.extractedData
                                      ? {
                                          ...m,
                                          extractedData: {
                                            ...m.extractedData,
                                            category: e.target.value,
                                          },
                                        }
                                      : m
                                  )
                                );
                              }}
                              disabled={msg.status !== "pending" || isSaving}
                              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500"
                            >
                              {categoryOptions.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="font-semibold text-slate-500">Amount ($)</span>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={msg.extractedData.amount}
                              onChange={(e) => {
                                setMessages((prev) =>
                                  prev.map((m) =>
                                    m.id === msg.id && m.extractedData
                                      ? {
                                          ...m,
                                          extractedData: {
                                            ...m.extractedData,
                                            amount: Number(e.target.value),
                                          },
                                        }
                                      : m
                                  )
                                );
                              }}
                              disabled={msg.status !== "pending" || isSaving}
                              placeholder="0.00"
                              className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500"
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="font-semibold text-slate-500">Date</span>
                            <input
                              type="date"
                              value={msg.extractedData.date}
                              onChange={(e) => {
                                setMessages((prev) =>
                                  prev.map((m) =>
                                    m.id === msg.id && m.extractedData
                                      ? {
                                          ...m,
                                          extractedData: {
                                            ...m.extractedData,
                                            date: e.target.value,
                                          },
                                        }
                                      : m
                                  )
                                );
                              }}
                              disabled={msg.status !== "pending" || isSaving}
                              className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500"
                            />
                          </label>

                          <label className="flex flex-col gap-1.5 sm:col-span-2">
                            <span className="font-semibold text-slate-500">Description</span>
                            <input
                              type="text"
                              value={msg.extractedData.description}
                              onChange={(e) => {
                                setMessages((prev) =>
                                  prev.map((m) =>
                                    m.id === msg.id && m.extractedData
                                      ? {
                                          ...m,
                                          extractedData: {
                                            ...m.extractedData,
                                            description: e.target.value,
                                          },
                                        }
                                      : m
                                  )
                                );
                              }}
                              disabled={msg.status !== "pending" || isSaving}
                              placeholder="e.g. Software subscription"
                              className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500"
                            />
                          </label>
                        </div>

                        {/* Error message */}
                        {cardError && (
                          <div className="rounded-lg bg-red-50 p-3 text-[11px] font-medium text-red-700 border border-red-100">
                            {cardError}
                          </div>
                        )}

                        {/* Actions (Pending only) */}
                        {msg.status === "pending" && (
                          <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                            <button
                              type="button"
                              onClick={() => handleCancelCard(msg.id)}
                              disabled={isSaving}
                              className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmSave(msg)}
                              disabled={isSaving}
                              className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-emerald-400 flex items-center gap-1.5"
                            >
                              {isSaving ? (
                                <>
                                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  Saving...
                                </>
                              ) : (
                                "Confirm & Save"
                              )}
                            </button>
                          </div>
                        )}

                        {/* Success Banner */}
                        {msg.status === "confirmed" && (
                          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800 border border-emerald-100 flex items-center justify-between">
                            <span>✓ Transaction successfully saved to Firestore.</span>
                            {msg.transactionId && (
                              <Link
                                href="/transactions"
                                className="underline hover:text-emerald-950 text-[10px]"
                              >
                                View Ledger →
                              </Link>
                            )}
                          </div>
                        )}

                        {/* Cancelled Banner */}
                        {msg.status === "cancelled" && (
                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500 border border-slate-100">
                            ✕ Transaction draft discarded.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Editable Inventory Confirmation Card */}
                    {!isUser && msg.intent === "inventory_action" && msg.extractedInventoryData && msg.status && (
                      <div
                        className={`mt-3 w-full min-w-[280px] sm:min-w-[460px] max-w-lg rounded-xl border p-5 shadow-lg flex flex-col gap-4 text-slate-900 transition-all duration-300 bg-white ${
                          msg.status === "confirmed"
                            ? "border-emerald-500 ring-4 ring-emerald-500/5 bg-emerald-50/5"
                            : msg.status === "cancelled"
                            ? "border-slate-200 bg-slate-50/50 opacity-85"
                            : "border-indigo-200 ring-4 ring-indigo-500/5"
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              msg.status === "confirmed"
                                ? "bg-emerald-100 text-emerald-700"
                                : msg.status === "cancelled"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-indigo-50 text-indigo-600"
                            }`}>
                              {msg.status === "confirmed" ? "✓" : msg.status === "cancelled" ? "✕" : "📦"}
                            </span>
                            <span className="text-sm font-bold text-slate-800">Inventory Stock Draft</span>
                          </div>
                          <div>
                            {msg.status === "confirmed" && (
                              <span className="inline-flex items-center rounded-md bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                Stock Updated
                              </span>
                            )}
                            {msg.status === "cancelled" && (
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                                Discarded
                              </span>
                            )}
                            {msg.status === "pending" && (
                              <span className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 animate-pulse">
                                Awaiting Review
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Form Fields */}
                        <div className="grid gap-3 sm:grid-cols-2 text-xs">
                          <label className="flex flex-col gap-1.5 sm:col-span-2">
                            <span className="font-semibold text-slate-500">Select Product</span>
                            <select
                              value={msg.extractedInventoryData.productId || ""}
                              onChange={(e) => updateExtractedInventoryField(msg.id, "productId", e.target.value)}
                              disabled={msg.status !== "pending" || isSaving}
                              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500"
                            >
                              <option value="">-- Choose Product --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (SKU: {p.sku}) [Current: {p.currentStock} {p.unit}]
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="font-semibold text-slate-500">Operation Type</span>
                            <select
                              value={msg.extractedInventoryData.type}
                              onChange={(e) => updateExtractedInventoryField(msg.id, "type", e.target.value)}
                              disabled={msg.status !== "pending" || isSaving}
                              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500"
                            >
                              <option value="stock_in">Stock In (Add)</option>
                              <option value="stock_out">Stock Out (Sell/Reduce)</option>
                            </select>
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="font-semibold text-slate-500">Quantity</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={msg.extractedInventoryData.quantity}
                              onChange={(e) => updateExtractedInventoryField(msg.id, "quantity", Number(e.target.value))}
                              disabled={msg.status !== "pending" || isSaving}
                              className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500"
                            />
                          </label>

                          <label className="flex flex-col gap-1.5 sm:col-span-2">
                            <span className="font-semibold text-slate-500">Reason</span>
                            <input
                              type="text"
                              value={msg.extractedInventoryData.reason}
                              onChange={(e) => updateExtractedInventoryField(msg.id, "reason", e.target.value)}
                              disabled={msg.status !== "pending" || isSaving}
                              placeholder="e.g. Sales, restocking"
                              className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500"
                            />
                          </label>
                        </div>

                        {/* Error alert */}
                        {cardError && (
                          <div className="rounded-lg bg-red-50 p-3 text-[11px] font-medium text-red-700 border border-red-100">
                            {cardError}
                          </div>
                        )}

                        {/* Actions */}
                        {msg.status === "pending" && (
                          <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                            <button
                              type="button"
                              onClick={() => handleCancelCard(msg.id)}
                              disabled={isSaving}
                              className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmInventorySave(msg)}
                              disabled={isSaving}
                              className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-indigo-400 flex items-center gap-1.5"
                            >
                              {isSaving ? "Saving..." : "Confirm & Adjust"}
                            </button>
                          </div>
                        )}

                        {/* Success Banner */}
                        {msg.status === "confirmed" && (
                          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800 border border-emerald-100 flex items-center justify-between">
                            <span>✓ Stock adjustment successfully logged to inventory.</span>
                            <Link href="/inventory" className="underline hover:text-emerald-950 text-[10px]">
                              View Inventory →
                            </Link>
                          </div>
                        )}

                        {/* Cancelled Banner */}
                        {msg.status === "cancelled" && (
                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500 border border-slate-100">
                            ✕ Adjustment discarded.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div className="flex flex-col items-start max-w-[80%] self-start">
                  <span className="text-[10px] font-semibold text-slate-400 mb-1">Copilot</span>
                  <div className="rounded-2xl rounded-tl-none px-4 py-3 bg-slate-50 border border-slate-200 text-sm text-slate-500 shadow-sm flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="ml-1 text-xs">AI routing query...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 self-stretch">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions */}
            <div className="px-6 py-3 border-t border-slate-100 flex flex-wrap gap-2 items-center bg-slate-50/30">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Ask:</span>
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSend(q)}
                  className="text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input area */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="p-4 border-t border-slate-200 bg-white flex gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask financial performance or type transaction e.g., 'Spent $50 on Travel today'..."
                disabled={loading}
                className="flex-1 h-11 rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="h-11 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
    </div>
  );
}
