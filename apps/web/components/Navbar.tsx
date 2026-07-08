"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { getBusinesses } from "@/services/businessService";
import type { Business } from "@/types/business";
import { logout } from "@/services/authService";

const formatTimeAgo = (isoString: string) => {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

export default function Navbar() {
  const { user } = useAuth();
  const {
    activeBusinessId,
    activeBusinessName,
    setActiveBusiness,
  } = useBusiness();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotifications();

  const pathname = usePathname();
  const router = useRouter();

  // Dropdown/menu visibility states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [businessDropdownOpen, setBusinessDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // List of other businesses for active switcher
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const businessDropdownRef = useRef<HTMLDivElement>(null);
  const notificationDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Load user's businesses
  useEffect(() => {
    if (!user) return;
    const ownerId = user.uid;
    async function loadSwitcherBusinesses() {
      try {
        const list = await getBusinesses(ownerId);
        setBusinesses(list);
      } catch (err) {
        console.error("Error loading switcher businesses:", err);
      }
    }
    loadSwitcherBusinesses();
  }, [user]);

  // Click outside handlers to close dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (businessDropdownRef.current && !businessDropdownRef.current.contains(e.target as Node)) {
        setBusinessDropdownOpen(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(e.target as Node)) {
        setNotificationDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const navItems = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Transactions", href: "/transactions" },
    { name: "Inventory", href: "/inventory" },
    { name: "Reports", href: "/reports" },
    { name: "AI Copilot", href: "/copilot" },
    { name: "Settings", href: "/settings" },
  ];

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-lg shadow-md shadow-indigo-500/20">
                O
              </span>
              <span className="font-extrabold text-base tracking-tight text-slate-900 sm:text-lg">
                Operant<span className="text-indigo-600">OS</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex md:items-center md:gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            
            {/* Active Business Switcher */}
            {activeBusinessId && (
              <div className="relative" ref={businessDropdownRef}>
                <button
                  type="button"
                  onClick={() => setBusinessDropdownOpen(!businessDropdownOpen)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 transition hover:bg-slate-100 hover:border-slate-300"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="max-w-[90px] truncate sm:max-w-[140px]">
                    {activeBusinessName}
                  </span>
                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {businessDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-150 bg-white p-2 shadow-lg ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Switch Business
                    </div>
                    <div className="max-h-60 overflow-y-auto mt-1 flex flex-col gap-0.5">
                      {businesses
                        .filter((b) => b.id !== activeBusinessId)
                        .map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setActiveBusiness({
                                activeBusinessId: b.id,
                                activeBusinessName: b.name,
                              });
                              setBusinessDropdownOpen(false);
                            }}
                            className="w-full text-left rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                          >
                            {b.name}
                          </button>
                        ))}
                      {businesses.length <= 1 && (
                        <div className="px-3 py-3 text-center text-xs text-slate-400 italic">
                          No other businesses found
                        </div>
                      )}
                    </div>
                    <div className="border-t border-slate-100 mt-1.5 pt-1.5">
                      <Link
                        href="/businesses"
                        onClick={() => setBusinessDropdownOpen(false)}
                        className="flex w-full items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition"
                      >
                        Manage Businesses
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notification Center Bell */}
            <div className="relative" ref={notificationDropdownRef}>
              <button
                type="button"
                onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
                className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition"
              >
                <svg className="h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-extrabold text-white ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-150 bg-white shadow-xl ring-1 ring-black/5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                    <span className="text-xs font-bold text-slate-800">Notifications Center</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.map((n) => {
                      let typeColor = "bg-indigo-50 text-indigo-600";
                      let iconStr = "⚡";
                      if (n.type === "success") {
                        typeColor = "bg-emerald-50 text-emerald-700";
                        iconStr = "✓";
                      } else if (n.type === "warning") {
                        typeColor = "bg-amber-50 text-amber-700";
                        iconStr = "⚠";
                      } else if (n.type === "error") {
                        typeColor = "bg-rose-50 text-rose-700";
                        iconStr = "✕";
                      }

                      return (
                        <div
                          key={n.id}
                          className={`flex items-start gap-3 p-3.5 transition-colors ${
                            n.read ? "bg-white opacity-70" : "bg-indigo-50/10 hover:bg-slate-50/50"
                          }`}
                        >
                          <span
                            onClick={() => markAsRead(n.id)}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${typeColor} cursor-pointer hover:scale-105 transition`}
                          >
                            {iconStr}
                          </span>
                          <div className="flex-1 flex flex-col gap-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className={`text-xs font-bold text-slate-900 ${n.read ? "font-semibold" : ""}`}>
                                {n.title}
                              </h5>
                              <span className="text-[9px] font-semibold text-slate-400 shrink-0">
                                {formatTimeAgo(n.createdAt)}
                              </span>
                            </div>
                            <p className="text-[11px] leading-normal text-slate-600">{n.message}</p>
                          </div>
                        </div>
                      );
                    })}
                    {notifications.length === 0 && (
                      <div className="px-4 py-8 text-center flex flex-col items-center justify-center text-slate-400 gap-2">
                        <span className="text-xl">🔔</span>
                        <span className="text-xs font-semibold text-slate-500">All caught up!</span>
                        <span className="text-[10px] text-slate-400">No new notifications at this time.</span>
                      </div>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={clearAll}
                        className="text-[10px] font-bold text-slate-500 hover:text-red-600 transition"
                      >
                        Clear all notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={userDropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 transition text-xs font-bold text-slate-700"
              >
                {user?.email ? user.email.slice(0, 2).toUpperCase() : "U"}
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-150 bg-white p-2 shadow-lg ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 truncate">
                    {user?.email}
                  </div>
                  <div className="border-b border-slate-100 my-1" />
                  <Link
                    href="/settings"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex w-full rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                  >
                    Account Settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full text-left rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Hamburger Toggle (Mobile) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition md:hidden"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 py-3 md:hidden animate-in fade-in duration-100 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
