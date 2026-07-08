"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { createTransaction } from "@/services/transactionService";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/types/transaction";
import { createWorker } from "tesseract.js";
import Navbar from "@/components/Navbar";
import { validateTransactionInput } from "@/lib/validation";

type PipelineStage = "idle" | "ocr" | "validation" | "extraction" | "ready" | "saved" | "error";

interface ScannedTransaction {
  type: "income" | "expense";
  amount: string;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  currency: string;
  confidence?: number;
}

export default function ReceiptUploadPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    activeBusinessId,
    activeBusinessIncomeCategories,
    activeBusinessExpenseCategories,
  } = useBusiness();
  const router = useRouter();

  const incomeCategories = activeBusinessIncomeCategories || INCOME_CATEGORIES;
  const expenseCategories = activeBusinessExpenseCategories || EXPENSE_CATEGORIES;

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Pipeline states
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [pipelineText, setPipelineText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Extracted data (editable)
  const [extractedData, setExtractedData] = useState<ScannedTransaction | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, router, user]);

  // Clean up preview URL
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type)) {
      setError("Unsupported file format. Please upload a JPG, JPEG, or PNG image.");
      setStage("error");
      return;
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
    setExtractedData(null);
    setStage("idle");
    setPipelineProgress(0);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    setExtractedData(null);
    setStage("idle");
    setError(null);
    setPipelineProgress(0);
  };

  // Run the OCR and AI Extraction pipeline
  const runExtractionPipeline = async () => {
    if (!selectedFile || !activeBusinessId) return;

    setError(null);
    setExtractedData(null);

    try {
      // Step 1: OCR Text Extraction
      setStage("ocr");
      setPipelineText("Scanning image text (OCR)...");
      setPipelineProgress(25);

      let ocrText = "";
      try {
        const worker = await createWorker("eng");
        const { data } = await worker.recognize(selectedFile);
        ocrText = data.text;
        await worker.terminate();
      } catch (ocrErr) {
        console.error("OCR scan failure:", ocrErr);
        throw new Error("OCR Processing failed. The receipt image might be too blurry or corrupted.");
      }

      if (!ocrText || ocrText.trim().length < 10) {
        throw new Error("The scanner could not extract legible text. Please upload a clearer, well-lit receipt.");
      }

      // Step 2: Validate Document Intent and Extract structured JSON
      setStage("validation");
      setPipelineText("Validating receipt document intent...");
      setPipelineProgress(50);

      const idToken = user ? await user.getIdToken() : "";
      const responsePromise = fetch("/api/receipts/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          ocrText,
          currentDate: new Date().toISOString().split("T")[0],
          businessId: activeBusinessId,
        }),
      });

      const timer = setTimeout(() => {
        setStage("extraction");
        setPipelineText("Extracting transaction details via Gemini...");
        setPipelineProgress(80);
      }, 1500);

      const response = await responsePromise;
      clearTimeout(timer);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze receipt data.");
      }

      setPipelineProgress(100);
      setStage("ready");

      const extracted = data.extractedData;
      setExtractedData({
        type: extracted.type,
        amount: extracted.amount ? String(extracted.amount) : "",
        category: extracted.category || expenseCategories[0],
        description: extracted.description || "",
        date: extracted.date || new Date().toISOString().split("T")[0],
        merchant: extracted.merchant || "",
        currency: extracted.currency || "$",
        confidence: data.confidence,
      });
    } catch (err) {
      console.error("Pipeline failure:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred during receipt processing.");
      setStage("error");
    }
  };

  // Save the confirmed transaction to Firestore
  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractedData || !activeBusinessId) return;

    const validation = validateTransactionInput({
      businessId: activeBusinessId,
      type: extractedData.type,
      amount: extractedData.amount,
      description: extractedData.description,
      category: extractedData.category,
      createdAt: extractedData.date,
      merchant: extractedData.merchant || undefined,
      currency: extractedData.currency || undefined,
    }, incomeCategories, expenseCategories);

    if (!validation.isValid || !validation.sanitized) {
      setError(validation.errors.join(". "));
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

    setSaving(true);
    setError(null);

    try {
      await createTransaction({
        businessId: activeBusinessId,
        type: valType,
        amount: valAmount,
        description: valDesc,
        category: valCat,
        createdAt: valCreatedAt,
        merchant: valMerchant,
        currency: valCurrency,
      });

      setStage("saved");
    } catch (err) {
      console.error("Firestore save error:", err);
      setError(err instanceof Error ? err.message : "Failed to save the transaction to Firestore.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    handleRemoveFile();
  };

  const categoryOptions =
    extractedData?.type === "income" ? incomeCategories : expenseCategories;

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
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">AI Receipt Scanner</h1>
          </div>

        {!activeBusinessId ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Select a business to upload receipts</h2>
            <p className="mt-2 text-sm text-slate-600">
              Scanned receipts are categorized and saved inside the active business scope.
            </p>
            <Link
              href="/businesses"
              className="mt-6 inline-flex rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Select Business
            </Link>
          </section>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Column: Image Selection & Preview */}
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-bold text-slate-800">1. Upload Receipt Image</h3>

                {!selectedFile ? (
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      dragActive
                        ? "border-indigo-600 bg-indigo-50/30"
                        : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <p className="text-xs font-bold text-slate-800">Drag and drop receipt image here</p>
                    <p className="text-[10px] text-slate-500 mt-1">Supports JPG, JPEG, PNG (max 10MB)</p>
                    <button
                      type="button"
                      className="mt-3 rounded-md bg-white border border-slate-300 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
                    >
                      Browse Files
                    </button>
                  </div>
                ) : (
                  <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-900 group aspect-[4/3] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview || ""}
                      alt="Uploaded receipt preview"
                      className="max-w-full max-h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="rounded-md bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition shadow"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}

                {selectedFile && stage === "idle" && (
                  <button
                    type="button"
                    onClick={runExtractionPipeline}
                    className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition flex items-center justify-center gap-1.5 shadow"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                    </svg>
                    Scan & Extract Receipt
                  </button>
                )}
              </div>

              {/* Progress Panel */}
              {(stage === "ocr" || stage === "validation" || stage === "extraction") && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Processing Pipeline</h4>
                    <span className="text-xs font-semibold text-indigo-600 animate-pulse">{pipelineProgress}%</span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pipelineProgress}%` }}
                    />
                  </div>

                  <p className="text-xs text-slate-600 italic">{pipelineText}</p>

                  <div className="flex flex-col gap-2 text-xs font-medium border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        stage === "ocr" ? "bg-indigo-100 text-indigo-600 font-bold" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {stage === "ocr" ? "⚡" : "✓"}
                      </span>
                      <span className={stage === "ocr" ? "text-slate-900 font-semibold" : "text-slate-500"}>OCR Raw Text Scan</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        stage === "ocr"
                          ? "bg-slate-100 text-slate-400"
                          : stage === "validation"
                          ? "bg-indigo-100 text-indigo-600 font-bold"
                          : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {stage === "ocr" ? "○" : stage === "validation" ? "⚡" : "✓"}
                      </span>
                      <span className={stage === "validation" ? "text-slate-900 font-semibold" : "text-slate-500"}>Intent Document Validation</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        stage === "extraction"
                          ? "bg-indigo-100 text-indigo-600 font-bold"
                          : "bg-slate-100 text-slate-400"
                      }`}>
                        {stage === "extraction" ? "⚡" : "○"}
                      </span>
                      <span className={stage === "extraction" ? "text-slate-900 font-semibold" : "text-slate-500"}>Gemini Detail Extraction</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Panel */}
              {stage === "error" && error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                    <span className="text-base">⚠</span>
                    <span>Extraction Error</span>
                  </div>
                  <p className="text-xs text-red-700 leading-relaxed">{error}</p>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="self-start rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100/50 transition bg-white"
                  >
                    Reset & Try Again
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Editable Confirmation Card */}
            <div className="flex flex-col gap-4">
              {stage === "ready" && extractedData && (
                <form
                  onSubmit={handleConfirmSave}
                  className="rounded-xl border border-emerald-500 ring-4 ring-emerald-500/5 bg-white p-5 shadow-lg flex flex-col gap-4 text-slate-900"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                        $
                      </span>
                      <span className="text-sm font-bold text-slate-800">2. Review Scanned Details</span>
                    </div>
                    {extractedData.confidence !== undefined && (
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        {Math.round(extractedData.confidence * 100)}% Match
                      </span>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <label className="flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-500">Transaction Type</span>
                      <select
                        value={extractedData.type}
                        onChange={(e) => {
                          const newType = e.target.value as "income" | "expense";
                          setExtractedData({
                            ...extractedData,
                            type: newType,
                            category: newType === "income" ? incomeCategories[0] : expenseCategories[0],
                          });
                        }}
                        disabled={saving}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                      >
                        <option value="income">Income (Inflow)</option>
                        <option value="expense">Expense (Outflow)</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-500">Merchant</span>
                      <input
                        type="text"
                        value={extractedData.merchant}
                        onChange={(e) => setExtractedData({ ...extractedData, merchant: e.target.value })}
                        disabled={saving}
                        placeholder="e.g. Walmart, Slack"
                        className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-500">Category</span>
                      <select
                        value={extractedData.category}
                        onChange={(e) => setExtractedData({ ...extractedData, category: e.target.value })}
                        disabled={saving}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                      >
                        {categoryOptions.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid grid-cols-[1fr_80px] gap-2">
                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Amount</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={extractedData.amount}
                          onChange={(e) => setExtractedData({ ...extractedData, amount: e.target.value })}
                          disabled={saving}
                          placeholder="0.00"
                          className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                        />
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="font-semibold text-slate-500">Currency</span>
                        <input
                          type="text"
                          value={extractedData.currency}
                          onChange={(e) => setExtractedData({ ...extractedData, currency: e.target.value })}
                          disabled={saving}
                          placeholder="$"
                          className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                        />
                      </label>
                    </div>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-500">Receipt Date</span>
                      <input
                        type="date"
                        value={extractedData.date}
                        onChange={(e) => setExtractedData({ ...extractedData, date: e.target.value })}
                        disabled={saving}
                        className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="font-semibold text-slate-500">Description</span>
                      <input
                        type="text"
                        value={extractedData.description}
                        onChange={(e) => setExtractedData({ ...extractedData, description: e.target.value })}
                        disabled={saving}
                        placeholder="Description of transaction"
                        className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                      />
                    </label>
                  </div>

                  <div className="flex gap-2 justify-end border-t border-slate-100 pt-3 text-xs">
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={saving}
                      className="h-9 rounded-lg border border-slate-200 px-4 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-5 font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-emerald-400 flex items-center gap-1.5 shadow"
                    >
                      {saving ? (
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
                </form>
              )}

              {/* Saved Success Panel */}
              {stage === "saved" && (
                <div className="rounded-xl border border-emerald-500 bg-emerald-50/40 p-6 shadow-md flex flex-col gap-4 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xl font-bold">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Transaction Saved!</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Receipt details were successfully scanned and logged into your Firestore business ledger.
                    </p>
                  </div>

                  <div className="flex gap-2 justify-center mt-2 text-xs">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                      Scan Another Receipt
                    </button>
                    <Link
                      href="/transactions"
                      className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 transition shadow"
                    >
                      Go to Ledger
                    </Link>
                  </div>
                </div>
              )}

              {/* Blank State (Idle/Waiting) */}
              {stage === "idle" && !selectedFile && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 shadow-sm flex flex-col items-center justify-center h-full min-h-[300px]">
                  <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  <p className="text-xs font-bold text-slate-700">Awaiting scan data...</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[220px]">
                    Select and scan a receipt image to trigger AI OCR and detail extraction.
                  </p>
                </div>
              )}

              {/* Extraction Processing Skeleton */}
              {(stage === "ocr" || stage === "validation" || stage === "extraction") && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="h-9 bg-slate-100 rounded-lg" />
                    <div className="h-9 bg-slate-100 rounded-lg" />
                    <div className="h-9 bg-slate-100 rounded-lg" />
                    <div className="h-9 bg-slate-100 rounded-lg" />
                    <div className="h-9 bg-slate-100 rounded-lg sm:col-span-2" />
                  </div>
                  <div className="h-9 bg-slate-200 rounded-lg w-1/4 self-end mt-2" />
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
    </div>
  );
}
