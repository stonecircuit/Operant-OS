"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useBusiness } from "./BusinessContext";
import { getTransactions } from "@/services/transactionService";
import { buildProfitLossReport } from "@/lib/reporting";
import { generateInsights } from "@/lib/insights";
import { getProducts } from "@/services/inventoryService";

export interface Notification {
  id: string;
  type: "success" | "warning" | "info" | "error";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  isAi?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (
    type: Notification["type"],
    title: string,
    message: string
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  refreshInsightAlerts: () => Promise<void>;
}

const NotificationContext =
  createContext<NotificationContextType | undefined>(
    undefined
  );

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeBusinessId } = useBusiness();
  
  const [manualNotifications, setManualNotifications] = useState<Notification[]>([]);
  const [insightNotifications, setInsightNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);

  // Calculate unread count
  const allNotifications = useMemo(() => {
    return [...manualNotifications, ...insightNotifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [manualNotifications, insightNotifications]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => !n.read).length;
  }, [allNotifications]);

  // Expose a method to manually add notifications (e.g. on transaction CRUD success/warning)
  const addNotification = useCallback(
    (type: Notification["type"], title: string, message: string) => {
      const newNotification: Notification = {
        id: crypto.randomUUID(),
        type,
        title,
        message,
        createdAt: new Date().toISOString(),
        read: false,
      };
      setManualNotifications((prev) => [newNotification, ...prev]);

      // Trigger animated toast alert popup
      setToasts((prev) => [...prev, newNotification]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newNotification.id));
      }, 4000);
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setManualNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setInsightNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setManualNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setInsightNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setManualNotifications([]);
    setInsightNotifications([]);
  }, []);

  // Compute insight-based alerts dynamically
  const refreshInsightAlerts = useCallback(async () => {
    if (!activeBusinessId) {
      setInsightNotifications([]);
      return;
    }

    try {
      const transactions = await getTransactions(activeBusinessId);
      const report = buildProfitLossReport({
        businessId: activeBusinessId,
        transactions,
        dateRange: "all-time",
      });
      const insights = generateInsights(report);

      const mapped = insights
        .filter((ins) => ins.id !== "no-data")
        .map((ins) => {
          let type: Notification["type"] = "info";
          if (ins.severity === "warning") type = "warning";
          if (ins.severity === "positive") type = "success";

          return {
            id: ins.id,
            type,
            title: ins.title,
            message: ins.description,
            createdAt: new Date().toISOString(),
            read: false,
            isAi: true,
          } as Notification;
        });

      // Low stock warnings
      let lowStockNotifications: Notification[] = [];
      try {
        const products = await getProducts(activeBusinessId);
        const lowStockProducts = products.filter(
          (p) => p.currentStock <= p.minStock
        );
        lowStockNotifications = lowStockProducts.map((p) => ({
          id: `low-stock-${p.id}`,
          type: "warning",
          title: `Low Stock Alert: ${p.name}`,
          message: `Product ${p.name} (SKU: ${p.sku}) has reached ${p.currentStock} ${p.unit} (minimum: ${p.minStock} ${p.unit}).`,
          createdAt: new Date().toISOString(),
          read: false,
          isAi: true,
        }));
      } catch (prodErr) {
        console.warn("Could not fetch products for low stock alert:", prodErr);
      }

      setInsightNotifications([...mapped, ...lowStockNotifications]);
    } catch (error) {
      console.error("Error generating dynamic notifications:", error);
    }
  }, [activeBusinessId]);

  // Load alert notifications when active business changes
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshInsightAlerts();
    }, 0);
    return () => clearTimeout(timer);
  }, [activeBusinessId, refreshInsightAlerts]);

  const value = useMemo(
    () => ({
      notifications: allNotifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearAll,
      refreshInsightAlerts,
    }),
    [
      allNotifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearAll,
      refreshInsightAlerts,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Toast notifications float container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          let typeStyles = "bg-white border-slate-200 text-slate-900";
          let icon = "ℹ️";
          if (toast.type === "success") {
            typeStyles = "bg-emerald-50/95 border-emerald-250 text-emerald-950 shadow-emerald-500/10";
            icon = "✓";
          } else if (toast.type === "error") {
            typeStyles = "bg-rose-50/95 border-rose-250 text-rose-950 shadow-rose-500/10";
            icon = "✕";
          } else if (toast.type === "warning") {
            typeStyles = "bg-amber-50/95 border-amber-250 text-amber-950 shadow-amber-500/10";
            icon = "⚠️";
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl transition-all duration-300 translate-x-0 animate-in slide-in-from-right-12 ${typeStyles}`}
            >
              <span className="flex h-5 w-5 shrink-0 select-none items-center justify-center rounded-full bg-white/60 text-xs font-bold shadow-xs">
                {icon}
              </span>
              <div className="flex-1 flex flex-col gap-0.5 text-xs">
                <span className="font-extrabold">{toast.title}</span>
                <span className="text-[10px] opacity-85 leading-normal">{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-400 hover:text-slate-700 shrink-0 font-bold ml-1 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }

  return context;
}
