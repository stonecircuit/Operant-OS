"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { useNotifications } from "@/contexts/NotificationContext";
import Navbar from "@/components/Navbar";
import {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  performStockOperation,
  getInventoryHistory,
} from "@/services/inventoryService";
import type { Product, InventoryOperation } from "@/types/inventory";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeBusinessId, activeBusinessCurrency } = useBusiness();
  const { addNotification, refreshInsightAlerts } = useNotifications();
  const router = useRouter();

  // Core inventory states
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<InventoryOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"products" | "history" | "charts">("products");
  const [mounted, setMounted] = useState(false);

  // Modals & Action States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form inputs for Add/Edit Product
  const [nameInput, setNameInput] = useState("");
  const [skuInput, setSkuInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [purchasePriceInput, setPurchasePriceInput] = useState("0");
  const [sellingPriceInput, setSellingPriceInput] = useState("0");
  const [minStockInput, setMinStockInput] = useState("5");
  const [unitInput, setUnitInput] = useState("pcs");
  const [initialStockInput, setInitialStockInput] = useState("0");

  // Form inputs for Stock Operation
  const [stockOpType, setStockOpType] = useState<"stock_in" | "stock_out">("stock_in");
  const [stockOpQuantity, setStockOpQuantity] = useState("1");
  const [stockOpReason, setStockOpReason] = useState("");
  const [stockOpNotes, setStockOpNotes] = useState("");

  const [saving, setSaving] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Redirect if unauthenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, router, user]);

  // Load products data
  const loadInventoryData = useCallback(async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const prodList = await getProducts(activeBusinessId);
      setProducts(prodList);
    } catch (err) {
      console.error("Error loading products:", err);
      setErrorMessage("Failed to retrieve product list.");
    } finally {
      setLoading(false);
    }
  }, [activeBusinessId]);

  // Load history data
  const loadHistoryData = useCallback(async () => {
    if (!activeBusinessId) return;
    setHistoryLoading(true);
    try {
      const histList = await getInventoryHistory(activeBusinessId);
      setHistory(histList);
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [activeBusinessId]);

  useEffect(() => {
    if (activeBusinessId) {
      const timer = setTimeout(() => {
        loadInventoryData();
        loadHistoryData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeBusinessId, loadInventoryData, loadHistoryData]);

  // Format currency dynamically
  const formatCurrency = useMemo(() => {
    const currency = activeBusinessCurrency || "USD";
    return (value: number) => {
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
        }).format(value);
      } catch {
        return `$${value.toFixed(2)}`;
      }
    };
  }, [activeBusinessCurrency]);

  // Inventory KPI calculations
  const kpis = useMemo(() => {
    const totalValue = products.reduce((sum, p) => sum + p.currentStock * p.purchasePrice, 0);
    const totalUnits = products.reduce((sum, p) => sum + p.currentStock, 0);
    const lowStockCount = products.filter((p) => p.currentStock <= p.minStock).length;

    // Resolve top category
    const categoryValueMap: Record<string, number> = {};
    products.forEach((p) => {
      categoryValueMap[p.category] = (categoryValueMap[p.category] || 0) + p.currentStock * p.purchasePrice;
    });
    let topCategory = "N/A";
    let topCategoryVal = 0;
    Object.entries(categoryValueMap).forEach(([cat, val]) => {
      if (val > topCategoryVal) {
        topCategory = cat;
        topCategoryVal = val;
      }
    });

    return {
      totalValue,
      totalUnits,
      lowStockCount,
      topCategory,
    };
  }, [products]);

  // Recharts Chart Data Formatting
  const categoryChartData = useMemo(() => {
    const dataMap: Record<string, { name: string; value: number }> = {};
    products.forEach((p) => {
      const val = p.currentStock * p.purchasePrice;
      if (val > 0) {
        dataMap[p.category] = {
          name: p.category,
          value: (dataMap[p.category]?.value || 0) + val,
        };
      }
    });
    return Object.values(dataMap);
  }, [products]);

  const stockLevelChartData = useMemo(() => {
    return products.slice(0, 10).map((p) => ({
      name: p.name.length > 15 ? `${p.name.slice(0, 12)}...` : p.name,
      Stock: p.currentStock,
      Min: p.minStock,
    }));
  }, [products]);

  // CRUD handlers
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusinessId) return;

    setSaving(true);
    try {
      await createProduct({
        businessId: activeBusinessId,
        name: nameInput,
        sku: skuInput,
        category: categoryInput,
        purchasePrice: Number(purchasePriceInput),
        sellingPrice: Number(sellingPriceInput),
        minStock: Number(minStockInput),
        unit: unitInput,
        initialStock: Number(initialStockInput),
      });

      addNotification("success", "Product Created", `Product ${nameInput} was added to inventory.`);
      setIsAddModalOpen(false);
      resetProductForm();
      await loadInventoryData();
      await loadHistoryData();
      refreshInsightAlerts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setSaving(true);
    try {
      await updateProduct(selectedProduct.id, {
        name: nameInput,
        sku: skuInput,
        category: categoryInput,
        purchasePrice: Number(purchasePriceInput),
        sellingPrice: Number(sellingPriceInput),
        minStock: Number(minStockInput),
        unit: unitInput,
      });

      addNotification("success", "Product Updated", `Details for product ${nameInput} were updated.`);
      setIsEditModalOpen(false);
      resetProductForm();
      await loadInventoryData();
      refreshInsightAlerts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete ${productName}?`)) return;

    try {
      await deleteProduct(productId);
      addNotification("info", "Product Deleted", `Product ${productName} was removed from the catalog.`);
      await loadInventoryData();
      refreshInsightAlerts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete product");
    }
  };

  const handleStockOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusinessId || !selectedProduct) return;

    setSaving(true);
    try {
      const newStock = await performStockOperation(
        activeBusinessId,
        selectedProduct.id,
        stockOpType,
        Number(stockOpQuantity),
        stockOpReason || (stockOpType === "stock_in" ? "Restocking" : "Sale Adjustment"),
        stockOpNotes,
        user?.uid,
        user?.email || undefined
      );

      addNotification(
        "success",
        stockOpType === "stock_in" ? "Stock Received" : "Stock Dispatched",
        `${stockOpQuantity} ${selectedProduct.unit} of ${selectedProduct.name} logged. New stock level: ${newStock} ${selectedProduct.unit}.`
      );

      setIsStockModalOpen(false);
      setSelectedProduct(null);
      setStockOpQuantity("1");
      setStockOpReason("");
      setStockOpNotes("");
      await loadInventoryData();
      await loadHistoryData();
      refreshInsightAlerts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to perform stock adjustment");
    } finally {
      setSaving(false);
    }
  };

  // CSV Export
  const downloadCSVReport = () => {
    if (products.length === 0) return;

    const headers = ["Product Name", "SKU", "Category", "Purchase Price", "Selling Price", "Current Stock", "Min Stock", "Unit", "Asset Value"];
    const rows = products.map((p) => [
      p.name,
      p.sku,
      p.category,
      p.purchasePrice,
      p.sellingPrice,
      p.currentStock,
      p.minStock,
      p.unit,
      (p.currentStock * p.purchasePrice).toFixed(2),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((val) => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inventory_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetProductForm = () => {
    setNameInput("");
    setSkuInput("");
    setCategoryInput("");
    setPurchasePriceInput("0");
    setSellingPriceInput("0");
    setMinStockInput("5");
    setUnitInput("pcs");
    setInitialStockInput("0");
    setSelectedProduct(null);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setNameInput(product.name);
    setSkuInput(product.sku);
    setCategoryInput(product.category);
    setPurchasePriceInput(String(product.purchasePrice));
    setSellingPriceInput(String(product.sellingPrice));
    setMinStockInput(String(product.minStock));
    setUnitInput(product.unit);
    setIsEditModalOpen(true);
  };

  const openStockModal = (product: Product, type: "stock_in" | "stock_out") => {
    setSelectedProduct(product);
    setStockOpType(type);
    setIsStockModalOpen(true);
  };

  // Colors list for category pie chart
  const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#3b82f6"];

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <section className="mx-auto w-full max-w-6xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Loading catalog...</p>
        </section>
      </main>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Inventory Management</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-1">Inventory Core</h1>
          </div>
          {activeBusinessId && (
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={downloadCSVReport}
                disabled={products.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                📥 Export CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  resetProductForm();
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
              >
                ✚ Add Product
              </button>
            </div>
          )}
        </div>

        {!activeBusinessId ? (
          <section className="rounded-xl border border-dashed border-slate-350 bg-white p-12 text-center shadow-md my-10 max-w-lg mx-auto">
            <h2 className="text-xl font-bold text-slate-900">Choose a business to load inventory metrics</h2>
            <p className="mt-2 text-sm text-slate-600">
              Operant OS tracks stock adjustments, product catalogues, and low stock notifications linked to your active business.
            </p>
            <Link
              href="/businesses"
              className="mt-6 inline-flex rounded-lg bg-slate-950 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
            >
              Select Business
            </Link>
          </section>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inventory Value</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(kpis.totalValue)}</div>
                <span className="text-[10px] text-slate-500 mt-1 block">At purchase cost</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Stocked Volume</span>
                <div className="text-2xl font-black text-indigo-600 mt-1">{kpis.totalUnits} items</div>
                <span className="text-[10px] text-slate-500 mt-1 block">Across all categories</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Low Stock Items</span>
                <div className={`text-2xl font-black mt-1 ${kpis.lowStockCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {kpis.lowStockCount} items
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Below minimum stock level</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Category</span>
                <div className="text-xl font-extrabold text-slate-900 mt-2 truncate">{kpis.topCategory}</div>
                <span className="text-[10px] text-slate-500 mt-1 block">By total inventory value</span>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-700">
                {errorMessage}
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab("products")}
                className={`py-3 px-5 text-sm font-bold border-b-2 transition ${
                  activeTab === "products"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                Products catalog
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`py-3 px-5 text-sm font-bold border-b-2 transition ${
                  activeTab === "history"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                Stock History Log
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("charts")}
                className={`py-3 px-5 text-sm font-bold border-b-2 transition ${
                  activeTab === "charts"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                Visual Analytics
              </button>
            </div>

            {/* TAB CONTENTS */}
            
            {/* Products Tab */}
            {activeTab === "products" && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-200 tracking-wider">
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-4">SKU</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Purchase Price</th>
                        <th className="py-3 px-4">Selling Price</th>
                        <th className="py-3 px-4 text-center">Available Stock</th>
                        <th className="py-3 px-4 text-center">Min Stock</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {products.map((p) => {
                        const isLow = p.currentStock <= p.minStock;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-3 px-4 font-bold text-slate-950">{p.name}</td>
                            <td className="py-3 px-4 text-slate-600 uppercase font-mono">{p.sku}</td>
                            <td className="py-3 px-4">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                {p.category}
                              </span>
                            </td>
                            <td className="py-3 px-4">{formatCurrency(p.purchasePrice)}</td>
                            <td className="py-3 px-4">{formatCurrency(p.sellingPrice)}</td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                  isLow
                                    ? "bg-rose-50 text-rose-700 ring-1 ring-rose-250"
                                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-250"
                                }`}
                              >
                                {p.currentStock} {p.unit}
                                {isLow && <span className="animate-ping w-1.5 h-1.5 rounded-full bg-rose-500" />}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-slate-500 font-semibold">
                              {p.minStock} {p.unit}
                            </td>
                            <td className="py-3 px-4 text-right flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openStockModal(p, "stock_in")}
                                className="bg-emerald-600 text-white rounded px-2.5 py-1.5 text-[10px] font-bold hover:bg-emerald-700 transition"
                              >
                                Stock In
                              </button>
                              <button
                                type="button"
                                onClick={() => openStockModal(p, "stock_out")}
                                className="bg-indigo-600 text-white rounded px-2.5 py-1.5 text-[10px] font-bold hover:bg-indigo-700 transition"
                              >
                                Stock Out
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(p)}
                                className="bg-slate-100 text-slate-700 rounded p-1.5 text-[10px] font-bold hover:bg-slate-200 transition"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                className="bg-rose-50 text-rose-700 rounded p-1.5 text-[10px] font-bold hover:bg-rose-100 transition"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {products.length === 0 && !loading && (
                        <tr>
                           <td colSpan={8} className="py-8 px-4 text-center text-slate-400 italic">
                             No products in inventory catalog. Click &quot;Add Product&quot; to get started.
                           </td>
                        </tr>
                      )}
                      {loading && (
                        <tr>
                          <td colSpan={8} className="py-8 px-4 text-center text-slate-500">
                            Loading catalog data...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-200 tracking-wider">
                        <th className="py-3 px-4">Date/Time</th>
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-4">SKU</th>
                        <th className="py-3 px-4 text-center">Type</th>
                        <th className="py-3 px-4 text-center">Quantity</th>
                        <th className="py-3 px-4">Reason</th>
                        <th className="py-3 px-4">Notes</th>
                        <th className="py-3 px-4 text-right">Performed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {history.map((h) => {
                        const isStockIn = h.type === "stock_in";
                        return (
                          <tr key={h.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-3 px-4 text-slate-500 font-medium">
                              {new Date(h.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-950">{h.productName}</td>
                            <td className="py-3 px-4 text-slate-500 uppercase font-mono">{h.sku}</td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-extrabold ${
                                  isStockIn
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {isStockIn ? "STOCK IN" : "STOCK OUT"}
                              </span>
                            </td>
                            <td className={`py-3 px-4 text-center font-extrabold ${isStockIn ? "text-emerald-700" : "text-amber-700"}`}>
                              {isStockIn ? "+" : "-"}
                              {h.quantity}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-700">{h.reason}</td>
                            <td className="py-3 px-4 text-slate-400 italic max-w-[200px] truncate">{h.notes || "-"}</td>
                            <td className="py-3 px-4 text-right text-slate-500 font-medium">{h.userEmail}</td>
                          </tr>
                        );
                      })}
                      {history.length === 0 && !historyLoading && (
                        <tr>
                          <td colSpan={8} className="py-8 px-4 text-center text-slate-400 italic">
                            No inventory operations history found.
                          </td>
                        </tr>
                      )}
                      {historyLoading && (
                        <tr>
                          <td colSpan={8} className="py-8 px-4 text-center text-slate-500">
                            Loading operations history...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Charts Tab */}
            {activeTab === "charts" && (
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Value Category distribution chart */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b pb-2">
                    Asset Value by Category
                  </h3>
                  <div className="h-64">
                    {categoryChartData.length > 0 && mounted ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          >
                            {categoryChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(val: unknown) => typeof val === "number" ? formatCurrency(val) : String(val)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                        No product values found to construct category distributions.
                      </div>
                    )}
                  </div>
                </div>

                {/* Stock levels check */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b pb-2">
                    Product Stock levels vs Min Stock (Top 10)
                  </h3>
                  <div className="h-64">
                    {stockLevelChartData.length > 0 && mounted ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stockLevelChartData}>
                          <XAxis dataKey="name" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                          <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                          <RechartsTooltip />
                          <Legend />
                          <Bar dataKey="Stock" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Min" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                        No products available.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </>
        )}

      </main>

      {/* ADD PRODUCT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleAddProduct}
            className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 text-slate-900 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="border-b pb-2 flex justify-between items-center">
              <h2 className="text-sm font-black text-slate-900 uppercase">Create New Product</h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3 text-xs">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-slate-500">Product Name *</span>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Intel Core i7 Processor"
                  className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-semibold text-slate-500">SKU Code *</span>
                <input
                  type="text"
                  required
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  placeholder="e.g. CPU-INT-I7"
                  className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 uppercase"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-semibold text-slate-500">Category *</span>
                <input
                  type="text"
                  required
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  placeholder="e.g. Processors, Accessories"
                  className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-500">Purchase Price ($) *</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={purchasePriceInput}
                    onChange={(e) => setPurchasePriceInput(e.target.value)}
                    className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-500">Selling Price ($) *</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={sellingPriceInput}
                    onChange={(e) => setSellingPriceInput(e.target.value)}
                    className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-500">Initial Stock *</span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={initialStockInput}
                    onChange={(e) => setInitialStockInput(e.target.value)}
                    className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-500">Min Alert Stock *</span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={minStockInput}
                    onChange={(e) => setMinStockInput(e.target.value)}
                    className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-500">Unit (pcs, kg) *</span>
                  <input
                    type="text"
                    required
                    value={unitInput}
                    onChange={(e) => setUnitInput(e.target.value)}
                    placeholder="pcs"
                    className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t pt-3 mt-2 text-xs">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="h-9 rounded-lg border border-slate-200 px-4 text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 font-bold text-white transition disabled:opacity-50"
              >
                {saving ? "Creating..." : "Save Product"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleEditProduct}
            className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 text-slate-900 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="border-b pb-2 flex justify-between items-center">
              <h2 className="text-sm font-black text-slate-900 uppercase">Edit Product Details</h2>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3 text-xs">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-slate-500">Product Name *</span>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-semibold text-slate-500">SKU Code *</span>
                <input
                  type="text"
                  required
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 uppercase"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-semibold text-slate-500">Category *</span>
                <input
                  type="text"
                  required
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-500">Purchase Price ($) *</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={purchasePriceInput}
                    onChange={(e) => setPurchasePriceInput(e.target.value)}
                    className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-500">Selling Price ($) *</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={sellingPriceInput}
                    onChange={(e) => setSellingPriceInput(e.target.value)}
                    className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-500">Min Alert Stock *</span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={minStockInput}
                    onChange={(e) => setMinStockInput(e.target.value)}
                    className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-500">Unit (pcs, kg) *</span>
                  <input
                    type="text"
                    required
                    value={unitInput}
                    onChange={(e) => setUnitInput(e.target.value)}
                    className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t pt-3 mt-2 text-xs">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="h-9 rounded-lg border border-slate-200 px-4 text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 font-bold text-white transition disabled:opacity-50"
              >
                {saving ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STOCK OPERATION MODAL */}
      {isStockModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleStockOperation}
            className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 text-slate-900 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="border-b pb-2 flex justify-between items-center">
              <h2 className="text-sm font-black text-slate-900 uppercase">
                {stockOpType === "stock_in" ? "📦 Restock Inventory (Stock In)" : "📤 Dispatch Inventory (Stock Out)"}
              </h2>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border text-xs flex flex-col gap-1">
              <div>
                <span className="font-bold text-slate-500">Product Name:</span> {selectedProduct.name}
              </div>
              <div>
                <span className="font-bold text-slate-500">SKU Code:</span> {selectedProduct.sku}
              </div>
              <div>
                <span className="font-bold text-slate-500">Current Stock:</span> {selectedProduct.currentStock} {selectedProduct.unit}
              </div>
            </div>

            <div className="grid gap-3 text-xs">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-slate-500">Quantity to Adjust *</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={stockOpQuantity}
                  onChange={(e) => setStockOpQuantity(e.target.value)}
                  className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-semibold text-slate-500">Reason/Source *</span>
                <input
                  type="text"
                  required
                  value={stockOpReason}
                  onChange={(e) => setStockOpReason(e.target.value)}
                  placeholder={stockOpType === "stock_in" ? "e.g. Purchased from Vendor A" : "e.g. Sale order #102"}
                  className="h-9 rounded-lg border px-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-semibold text-slate-500">Additional Notes (Optional)</span>
                <textarea
                  value={stockOpNotes}
                  onChange={(e) => setStockOpNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Received partial delivery of batch #2"
                  className="rounded-lg border p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                />
              </label>
            </div>

            <div className="flex gap-2 justify-end border-t pt-3 mt-2 text-xs">
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="h-9 rounded-lg border border-slate-200 px-4 text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`h-9 rounded-lg px-4 font-bold text-white transition disabled:opacity-50 ${
                  stockOpType === "stock_in" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {saving ? "Processing..." : stockOpType === "stock_in" ? "Add to Stock" : "Reduce Stock"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
