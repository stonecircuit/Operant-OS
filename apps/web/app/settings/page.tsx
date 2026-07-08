"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, FormEvent, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { updateBusiness } from "@/services/businessService";
import Navbar from "@/components/Navbar";
import { logAction, getAuditLogs, AuditLog } from "@/services/auditLogService";
import { sanitizeString, validateEmail } from "@/lib/validation";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/types/transaction";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    activeBusinessId,
    activeBusinessName,
    activeBusinessCurrency,
    activeBusinessTimezone,
    activeBusinessFinancialYear,
    activeBusinessCountry,
    activeBusinessPreferences,
    activeUserRole,
    refreshActiveBusiness,
  } = useBusiness();

  const { addNotification } = useNotifications();
  const router = useRouter();

  // Settings form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("US");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [financialYear, setFinancialYear] = useState("Jan-Dec");
  const [receiveAlerts, setReceiveAlerts] = useState(true);
  const [defaultView, setDefaultView] = useState("dashboard");

  // State management
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Team Management states
  const [membersList, setMembersList] = useState<{ uid: string; email: string; role: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "staff">("staff");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Audit Logs state
  const [auditLogsList, setAuditLogsList] = useState<AuditLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Category Management states
  const [incomeCategoriesList, setIncomeCategoriesList] = useState<string[]>([]);
  const [expenseCategoriesList, setExpenseCategoriesList] = useState<string[]>([]);
  const [newIncomeCategory, setNewIncomeCategory] = useState("");
  const [newExpenseCategory, setNewExpenseCategory] = useState("");

  // Helper to load business details, members and audit logs
  const loadBusinessDetails = useCallback(async () => {
    if (!activeBusinessId) return;

    try {
      const docRef = doc(db, "businesses", activeBusinessId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setDescription(data.description || "");
        setAddress(data.address || "");
        setTaxId(data.taxId || "");

        // Fetch user records to resolve member email addresses
        const membersMap = data.members || {};
        const resolvedMembers: { uid: string; email: string; role: string }[] = [];

        // Owner Info
        const ownerSnap = await getDoc(doc(db, "users", data.ownerId));
        if (ownerSnap.exists()) {
          resolvedMembers.push({
            uid: data.ownerId,
            email: ownerSnap.data().email,
            role: "owner",
          });
        } else {
          resolvedMembers.push({
            uid: data.ownerId,
            email: "Owner (Pending details)",
            role: "owner",
          });
        }

        // Other members
        for (const [memberUid, memberRole] of Object.entries(membersMap)) {
          if (memberUid === data.ownerId) continue;
          const memberSnap = await getDoc(doc(db, "users", memberUid));
          if (memberSnap.exists()) {
            resolvedMembers.push({
              uid: memberUid,
              email: memberSnap.data().email,
              role: memberRole as string,
            });
          } else {
            resolvedMembers.push({
              uid: memberUid,
              email: `User (${memberUid})`,
              role: memberRole as string,
            });
          }
        }

        setMembersList(resolvedMembers);
        setIncomeCategoriesList(data.incomeCategories || [...INCOME_CATEGORIES]);
        setExpenseCategoriesList(data.expenseCategories || [...EXPENSE_CATEGORIES]);
      }

      // Fetch Audit Logs (Owners and Admins only)
      if (activeUserRole === "owner" || activeUserRole === "admin") {
        setLoadingAuditLogs(true);
        const logs = await getAuditLogs(activeBusinessId, 10);
        setAuditLogsList(logs);
        setLoadingAuditLogs(false);
      }
    } catch (err) {
      console.error("Error loading business context details:", err);
    }
  }, [activeBusinessId, activeUserRole]);

  // Sync state with Context when loaded
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeBusinessId) {
        setName(activeBusinessName || "");
        setCurrency(activeBusinessCurrency || "USD");
        setTimezone(activeBusinessTimezone || "UTC");
        setFinancialYear(activeBusinessFinancialYear || "Jan-Dec");
        setCountry(activeBusinessCountry || "US");
        setReceiveAlerts(activeBusinessPreferences.receiveAlerts !== false);
        setDefaultView(activeBusinessPreferences.defaultView || "dashboard");

        loadBusinessDetails();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [
    activeBusinessId,
    activeBusinessName,
    activeBusinessCurrency,
    activeBusinessTimezone,
    activeBusinessFinancialYear,
    activeBusinessCountry,
    activeBusinessPreferences,
    loadBusinessDetails,
  ]);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, router, user]);

  // Handle updates to business configurations
  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!activeBusinessId || !user) return;

    if (activeUserRole === "staff") {
      setError("Unauthorized: Staff members cannot modify settings.");
      return;
    }

    const cleanName = sanitizeString(name);
    if (!cleanName) {
      setError("Business Name is required.");
      return;
    }

    setSaving(true);
    setSuccess(false);
    setError(null);

    const updatedData = {
      name: cleanName,
      currency,
      timezone,
      financialYear,
      country,
      description: sanitizeString(description),
      address: sanitizeString(address),
      taxId: sanitizeString(taxId),
      preferences: {
        receiveAlerts,
        defaultView,
      },
    };

    try {
      await updateBusiness(activeBusinessId, updatedData);

      // Audit Log registration
      await logAction(
        activeBusinessId,
        user.uid,
        user.email || "",
        "update_business_settings",
        {
          name: cleanName,
          currency,
          timezone,
          country,
        }
      );

      // Refresh context so changes take effect immediately
      await refreshActiveBusiness();
      setSuccess(true);
      addNotification(
        "success",
        "Settings Saved",
        `Successfully updated settings for ${cleanName}.`
      );

      await loadBusinessDetails();
    } catch (err) {
      console.error("Error saving settings:", err);
      setError(err instanceof Error ? err.message : "Failed to update business settings.");
      addNotification("error", "Settings Save Failed", "Failed to save settings modifications.");
    } finally {
      setSaving(false);
    }
  }

  // Handle adding team members by email address
  async function handleInviteMember(e: FormEvent) {
    e.preventDefault();
    if (!activeBusinessId || !user || !inviteEmail.trim()) return;

    if (activeUserRole !== "owner" && activeUserRole !== "admin") {
      setInviteError("Unauthorized: Only owners and admins can invite members.");
      return;
    }

    if (!validateEmail(inviteEmail)) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(false);

    try {
      // Find matching user document by email
      const usersQuery = query(
        collection(db, "users"),
        where("email", "==", inviteEmail.trim().toLowerCase())
      );
      const userSnapshot = await getDocs(usersQuery);

      if (userSnapshot.empty) {
        throw new Error("No user registered with this email. Users must sign up to Operant OS before joining ledgers.");
      }

      const invitedUser = userSnapshot.docs[0].data();
      const invitedUid = invitedUser.uid;
      const invitedEmail = invitedUser.email;

      // Fetch business to append member
      const docRef = doc(db, "businesses", activeBusinessId);
      const bizSnapshot = await getDoc(docRef);
      if (bizSnapshot.exists()) {
        const bizData = bizSnapshot.data();
        const currentMembers = bizData.members || {};

        if (currentMembers[invitedUid]) {
          throw new Error("This user is already a member of this business.");
        }

        const updatedMembers = {
          ...currentMembers,
          [invitedUid]: inviteRole,
        };

        await updateDoc(docRef, {
          members: updatedMembers,
        });

        // Audit Log entry
        await logAction(
          activeBusinessId,
          user.uid,
          user.email || "",
          "add_business_member",
          {
            invitedUid,
            invitedEmail,
            role: inviteRole,
          }
        );

        setInviteEmail("");
        setInviteSuccess(true);
        addNotification("success", "Member Added", `Successfully added ${invitedEmail} as ${inviteRole}.`);
        await loadBusinessDetails();
      }
    } catch (err) {
      console.error("Invite member error:", err);
      setInviteError(err instanceof Error ? err.message : "Failed to add member.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleAddCategory(type: "income" | "expense") {
    if (!activeBusinessId || !user) return;

    if (activeUserRole === "staff") {
      addNotification("error", "Unauthorized", "Staff members cannot modify categories.");
      return;
    }

    const newCat = (type === "income" ? newIncomeCategory : newExpenseCategory).trim();
    if (!newCat) {
      addNotification("error", "Error", "Category name cannot be empty.");
      return;
    }

    const currentList = type === "income" ? incomeCategoriesList : expenseCategoriesList;
    if (currentList.includes(newCat)) {
      addNotification("error", "Error", "Category already exists.");
      return;
    }

    const updatedList = [...currentList, newCat];

    try {
      const docRef = doc(db, "businesses", activeBusinessId);
      const updatePayload = type === "income" 
        ? { incomeCategories: updatedList }
        : { expenseCategories: updatedList };
      
      await updateDoc(docRef, updatePayload);

      // Audit Log
      await logAction(
        activeBusinessId,
        user.uid,
        user.email || "",
        `add_business_category_${type}`,
        { category: newCat }
      );

      if (type === "income") {
        setIncomeCategoriesList(updatedList);
        setNewIncomeCategory("");
      } else {
        setExpenseCategoriesList(updatedList);
        setNewExpenseCategory("");
      }

      addNotification("success", "Category Added", `Successfully added ${newCat} to ${type} categories.`);
      await refreshActiveBusiness();
    } catch (err) {
      console.error("Add category error:", err);
      addNotification("error", "Error", err instanceof Error ? err.message : "Failed to add category.");
    }
  }

  async function handleRemoveCategory(type: "income" | "expense", categoryToRemove: string) {
    if (!activeBusinessId || !user) return;

    if (activeUserRole === "staff") {
      addNotification("error", "Unauthorized", "Staff members cannot modify categories.");
      return;
    }

    const currentList = type === "income" ? incomeCategoriesList : expenseCategoriesList;
    if (currentList.length <= 1) {
      addNotification("error", "Error", "You must keep at least one category.");
      return;
    }

    if (!confirm(`Are you sure you want to delete the category "${categoryToRemove}"? Existing transactions in this category will remain, but you won't be able to select it for new entries.`)) {
      return;
    }

    const updatedList = currentList.filter((cat) => cat !== categoryToRemove);

    try {
      const docRef = doc(db, "businesses", activeBusinessId);
      const updatePayload = type === "income" 
        ? { incomeCategories: updatedList }
        : { expenseCategories: updatedList };
      
      await updateDoc(docRef, updatePayload);

      // Audit Log
      await logAction(
        activeBusinessId,
        user.uid,
        user.email || "",
        `remove_business_category_${type}`,
        { category: categoryToRemove }
      );

      if (type === "income") {
        setIncomeCategoriesList(updatedList);
      } else {
        setExpenseCategoriesList(updatedList);
      }

      addNotification("warning", "Category Removed", `Successfully removed ${categoryToRemove} from ${type} categories.`);
      await refreshActiveBusiness();
    } catch (err) {
      console.error("Remove category error:", err);
      addNotification("error", "Error", err instanceof Error ? err.message : "Failed to remove category.");
    }
  }

  // Handle removing team members
  async function handleRemoveMember(memberUid: string, memberEmail: string) {
    if (!activeBusinessId || !user) return;

    if (activeUserRole !== "owner" && activeUserRole !== "admin") {
      addNotification("error", "Unauthorized", "Only owners and admins can remove members.");
      return;
    }

    if (memberUid === user.uid) {
      addNotification("error", "Invalid Request", "You cannot remove yourself from this business.");
      return;
    }

    if (!confirm(`Are you sure you want to remove ${memberEmail} from this business?`)) {
      return;
    }

    try {
      const docRef = doc(db, "businesses", activeBusinessId);
      const bizSnapshot = await getDoc(docRef);
      if (bizSnapshot.exists()) {
        const bizData = bizSnapshot.data();
        const currentMembers = { ...(bizData.members || {}) };

        if (bizData.ownerId === memberUid) {
          addNotification("error", "Invalid Request", "The business owner cannot be removed.");
          return;
        }

        delete currentMembers[memberUid];

        await updateDoc(docRef, {
          members: currentMembers,
        });

        // Audit Log entry
        await logAction(
          activeBusinessId,
          user.uid,
          user.email || "",
          "remove_business_member",
          {
            removedUid: memberUid,
            removedEmail: memberEmail,
          }
        );

        addNotification("warning", "Member Removed", `Removed ${memberEmail} from this business ledger.`);
        await loadBusinessDetails();
      }
    } catch (err) {
      console.error("Remove member error:", err);
      addNotification("error", "Error", err instanceof Error ? err.message : "Failed to remove member.");
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <section className="mx-auto w-full max-w-6xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Loading settings...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const isStaff = activeUserRole === "staff";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 sm:px-6 py-8">
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <header className="border-b border-slate-200 pb-4">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Business Settings</h2>
            <p className="text-xs text-slate-500 mt-1">Configure profile localization and preferences for the active business scope.</p>
          </header>

          {isStaff && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
              ⚠️ You are accessing this business as a **Staff** member. You have read-only access to settings and cannot invite users or delete records.
            </div>
          )}

          {!activeBusinessId ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
              <h3 className="text-sm font-bold text-slate-700">No Active Business</h3>
              <p className="text-xs text-slate-500 mt-1">Select or create a business ledger first to manage settings.</p>
              <Link
                href="/businesses"
                className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
              >
                Go to Businesses
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <form onSubmit={handleSave} className="flex flex-col gap-5 text-xs text-slate-800">
                {/* Profile Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Business Profile</h3>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-600">Business Name *</span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={isStaff}
                        placeholder="e.g. Acme Corp"
                        className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-600">Tax ID / Registration Number</span>
                      <input
                        type="text"
                        value={taxId}
                        onChange={(e) => setTaxId(e.target.value)}
                        disabled={isStaff}
                        placeholder="e.g. EIN 12-3456789"
                        className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 text-xs disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="font-semibold text-slate-600">Business Description</span>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isStaff}
                        placeholder="Brief description of business activities..."
                        rows={3}
                        className="rounded-lg border border-slate-200 p-2.5 outline-none focus:border-indigo-500 text-xs resize-none disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="font-semibold text-slate-600">Address</span>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={isStaff}
                        placeholder="123 Financial Way, Suite 100"
                        className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 text-xs disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </label>
                  </div>
                </div>

                {/* Localization Settings */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Localization & Compliance</h3>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-600">Base Currency</span>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        disabled={isStaff}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="USD">USD ($) - US Dollar</option>
                        <option value="EUR">EUR (€) - Euro</option>
                        <option value="INR">INR (₹) - Indian Rupee</option>
                        <option value="GBP">GBP (£) - British Pound</option>
                        <option value="CAD">CAD ($) - Canadian Dollar</option>
                        <option value="AUD">AUD ($) - Australian Dollar</option>
                        <option value="JPY">JPY (¥) - Japanese Yen</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-600">Timezone</span>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        disabled={isStaff}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="UTC">UTC (GMT+0)</option>
                        <option value="America/New_York">US Eastern Time (EST/EDT)</option>
                        <option value="America/Los_Angeles">US Pacific Time (PST/PDT)</option>
                        <option value="Europe/London">London Time (GMT/BST)</option>
                        <option value="Asia/Kolkata">Indian Standard Time (IST)</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-600">Financial Year</span>
                      <select
                        value={financialYear}
                        onChange={(e) => setFinancialYear(e.target.value)}
                        disabled={isStaff}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="Jan-Dec">January - December</option>
                        <option value="Apr-Mar">April - March</option>
                        <option value="Jul-Jun">July - June</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="font-semibold text-slate-600">Country</span>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        disabled={isStaff}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="US">United States</option>
                        <option value="IN">India</option>
                        <option value="GB">United Kingdom</option>
                        <option value="CA">Canada</option>
                        <option value="AU">Australia</option>
                        <option value="JP">Japan</option>
                      </select>
                    </label>
                  </div>
                </div>

                {/* Preferences */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preferences</h3>
                  
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={receiveAlerts}
                        onChange={(e) => setReceiveAlerts(e.target.checked)}
                        disabled={isStaff}
                        className="h-4 w-4 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-700">Receive Financial Alerts</span>
                        <span className="text-[10px] text-slate-400">Trigger warnings and notifications in the navigation bell dropdown.</span>
                      </div>
                    </label>

                    <div className="border-t border-slate-100 my-1" />

                    <label className="flex flex-col gap-1.5 max-w-xs">
                      <span className="font-semibold text-slate-600">Default View Mode</span>
                      <select
                        value={defaultView}
                        onChange={(e) => setDefaultView(e.target.value)}
                        disabled={isStaff}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="dashboard">Financial Dashboard</option>
                        <option value="transactions">Ledger Transactions</option>
                        <option value="copilot">AI Financial Copilot</option>
                      </select>
                    </label>
                  </div>
                </div>

                {/* Save Trigger Banner */}
                <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                  <div>
                    {success && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                        ✓ Settings successfully saved and applied.
                      </span>
                    )}
                    {error && (
                      <span className="text-xs font-bold text-red-700 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                        ✕ {error}
                      </span>
                    )}
                  </div>

                  {!isStaff && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-6 text-xs font-bold text-white transition disabled:opacity-50 shadow"
                    >
                      {saving ? "Saving Changes..." : "Save Settings"}
                    </button>
                  )}
                </div>
              </form>

              {/* Team Management Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Team Management</h3>
                
                {/* List Active Members */}
                <div className="flex flex-col gap-2">
                  <span className="font-semibold text-slate-600 text-xs">Active Team Members</span>
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                    {membersList.map((m) => (
                      <div key={m.uid} className="flex items-center justify-between p-3 text-xs">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{m.email}</span>
                          <span className="text-[10px] text-slate-400 font-medium">UID: {m.uid}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            m.role === "owner"
                              ? "bg-slate-900 text-white"
                              : m.role === "admin"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                              : "bg-slate-50 text-slate-600 border border-slate-100"
                          }`}>
                            {m.role}
                          </span>

                          {!isStaff && m.role !== "owner" && m.uid !== user.uid && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.uid, m.email)}
                              className="rounded border border-slate-200 hover:border-red-500 hover:bg-red-50 hover:text-red-700 px-2 py-1 text-[10px] font-bold text-slate-600 transition"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Member Form (Owners/Admins only) */}
                {!isStaff && (
                  <form onSubmit={handleInviteMember} className="border-t border-slate-100 pt-4 flex flex-col gap-3">
                    <span className="font-semibold text-slate-600 text-xs">Add New Member</span>
                    <div className="grid gap-3 sm:grid-cols-[1fr_120px_100px]">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Invite member by email..."
                        required
                        className="h-9 rounded-lg border border-slate-200 px-2.5 outline-none focus:border-indigo-500 text-xs font-semibold"
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as "admin" | "staff")}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-indigo-500 text-xs font-semibold"
                      >
                        <option value="staff">Staff Role</option>
                        <option value="admin">Admin Role</option>
                      </select>
                      <button
                        type="submit"
                        disabled={inviteLoading}
                        className="h-9 rounded-lg bg-slate-950 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 shadow"
                      >
                        {inviteLoading ? "Adding..." : "Add Member"}
                      </button>
                    </div>

                    {inviteSuccess && (
                      <span className="text-[10px] font-bold text-emerald-700">
                        ✓ Member added successfully.
                      </span>
                    )}
                    {inviteError && (
                      <span className="text-[10px] font-bold text-red-700">
                        ✕ {inviteError}
                      </span>
                    )}
                  </form>
                )}
              </div>

              {/* Category Management Card */}
              {activeBusinessId && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category Management</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Customize transaction classification categories for this business scope.</p>
                  </div>
                  
                  <div className="grid gap-6 md:grid-cols-2 text-xs">
                    {/* Income Categories */}
                    <div className="flex flex-col gap-3">
                      <span className="font-semibold text-slate-600">Income Categories</span>
                      <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/30">
                        {incomeCategoriesList.map((cat) => (
                          <div key={cat} className="flex items-center justify-between p-2.5">
                            <span className="font-medium text-slate-800">{cat}</span>
                            {!isStaff && incomeCategoriesList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCategory("income", cat)}
                                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 transition"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {!isStaff && (
                        <div className="flex gap-2 mt-1">
                          <input
                            type="text"
                            value={newIncomeCategory}
                            onChange={(e) => setNewIncomeCategory(e.target.value)}
                            placeholder="New income category..."
                            className="h-8 flex-1 rounded-md border border-slate-200 px-2.5 outline-none focus:border-indigo-500 text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddCategory("income")}
                            className="h-8 rounded-md bg-slate-950 px-3 text-[11px] font-bold text-white transition hover:bg-slate-800 shadow"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expense Categories */}
                    <div className="flex flex-col gap-3">
                      <span className="font-semibold text-slate-600">Expense Categories</span>
                      <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/30 max-h-60 overflow-y-auto">
                        {expenseCategoriesList.map((cat) => (
                          <div key={cat} className="flex items-center justify-between p-2.5">
                            <span className="font-medium text-slate-800">{cat}</span>
                            {!isStaff && expenseCategoriesList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCategory("expense", cat)}
                                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 transition"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {!isStaff && (
                        <div className="flex gap-2 mt-1">
                          <input
                            type="text"
                            value={newExpenseCategory}
                            onChange={(e) => setNewExpenseCategory(e.target.value)}
                            placeholder="New expense category..."
                            className="h-8 flex-1 rounded-md border border-slate-200 px-2.5 outline-none focus:border-indigo-500 text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddCategory("expense")}
                            className="h-8 rounded-md bg-slate-950 px-3 text-[11px] font-bold text-white transition hover:bg-slate-800 shadow"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Compliance Audit Logging Card (Owners/Admins only) */}
              {(activeUserRole === "owner" || activeUserRole === "admin") && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Compliance Audit Logs</h3>
                  <div className="flex flex-col gap-2">
                    <span className="font-semibold text-slate-600 text-xs">Recent Activities</span>
                    
                    {loadingAuditLogs ? (
                      <p className="text-xs text-slate-500 italic">Loading audit trail...</p>
                    ) : auditLogsList.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 border border-slate-100 rounded-lg">No logged actions recorded yet.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                        {auditLogsList.map((log) => (
                          <div key={log.id} className="p-3 text-[11px] hover:bg-slate-50/50 flex flex-col gap-1">
                            <div className="flex justify-between font-bold text-slate-700">
                              <span className="text-indigo-700 uppercase">{log.action.replace(/_/g, " ")}</span>
                              <span className="text-slate-400 font-medium">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="text-slate-600">
                              Executed by: <span className="font-semibold">{log.userEmail}</span> ({log.userId})
                            </div>
                            {log.details && Object.keys(log.details).length > 0 && (
                              <pre className="mt-1 bg-slate-50 border border-slate-100 p-1.5 rounded text-[10px] text-slate-500 font-mono overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
