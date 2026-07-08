"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/types/transaction";

interface ActiveBusiness {
  activeBusinessId: string;
  activeBusinessName: string;
}

interface BusinessContextType {
  activeBusinessId: string | null;
  activeBusinessName: string | null;
  activeBusinessCurrency: string;
  activeBusinessTimezone: string;
  activeBusinessFinancialYear: string;
  activeBusinessCountry: string;
  activeUserRole: "owner" | "admin" | "staff" | null;
  activeBusinessIncomeCategories: string[];
  activeBusinessExpenseCategories: string[];
  activeBusinessPreferences: {
    darkMode?: boolean;
    receiveAlerts?: boolean;
    defaultView?: string;
  };
  setActiveBusiness: (
    business: ActiveBusiness
  ) => void;
  clearActiveBusiness: () => void;
  refreshActiveBusiness: () => Promise<void>;
}

const ACTIVE_BUSINESS_STORAGE_KEY =
  "operant-os-active-business";

const BusinessContext =
  createContext<BusinessContextType | undefined>(
    undefined
  );

function readStoredActiveBusiness():
  | ActiveBusiness
  | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(
    ACTIVE_BUSINESS_STORAGE_KEY
  );

  if (!storedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      storedValue
    ) as Partial<ActiveBusiness>;

    if (
      typeof parsed.activeBusinessId ===
        "string" &&
      typeof parsed.activeBusinessName ===
        "string"
    ) {
      return {
        activeBusinessId:
          parsed.activeBusinessId,
        activeBusinessName:
          parsed.activeBusinessName,
      };
    }
  } catch {
    window.localStorage.removeItem(
      ACTIVE_BUSINESS_STORAGE_KEY
    );
  }

  return null;
}

export function BusinessProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  const [
    activeBusinessId,
    setActiveBusinessId,
  ] = useState<string | null>(null);

  const [
    activeBusinessName,
    setActiveBusinessName,
  ] = useState<string | null>(null);

  // Localization and preferences states
  const [activeBusinessCurrency, setActiveBusinessCurrency] = useState("USD");
  const [activeBusinessTimezone, setActiveBusinessTimezone] = useState("UTC");
  const [activeBusinessFinancialYear, setActiveBusinessFinancialYear] = useState("Jan-Dec");
  const [activeBusinessCountry, setActiveBusinessCountry] = useState("US");
  const [activeUserRole, setActiveUserRole] = useState<"owner" | "admin" | "staff" | null>(null);
  const [activeBusinessIncomeCategories, setActiveBusinessIncomeCategories] = useState<string[]>([...INCOME_CATEGORIES]);
  const [activeBusinessExpenseCategories, setActiveBusinessExpenseCategories] = useState<string[]>([...EXPENSE_CATEGORIES]);
  const [activeBusinessPreferences, setActiveBusinessPreferences] = useState<{
    darkMode?: boolean;
    receiveAlerts?: boolean;
    defaultView?: string;
  }>({});

  const fetchBusinessSettings = useCallback(async (businessId: string) => {
    try {
      const docRef = doc(db, "businesses", businessId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setActiveBusinessCurrency(data.currency || "USD");
        setActiveBusinessTimezone(data.timezone || "UTC");
        setActiveBusinessFinancialYear(data.financialYear || "Jan-Dec");
        setActiveBusinessCountry(data.country || "US");
        setActiveBusinessPreferences(data.preferences || {});
        setActiveBusinessIncomeCategories(data.incomeCategories || [...INCOME_CATEGORIES]);
        setActiveBusinessExpenseCategories(data.expenseCategories || [...EXPENSE_CATEGORIES]);

        // Resolve user role
        if (user) {
          if (data.ownerId === user.uid) {
            setActiveUserRole("owner");
          } else if (data.members && data.members[user.uid]) {
            setActiveUserRole(data.members[user.uid]);
          } else {
            setActiveUserRole("staff");
          }
        } else {
          setActiveUserRole(null);
        }

        // Keep name in sync in case it changed in settings
        if (data.name && data.name !== activeBusinessName) {
          setActiveBusinessName(data.name);
          // Update local storage
          window.localStorage.setItem(
            ACTIVE_BUSINESS_STORAGE_KEY,
            JSON.stringify({
              activeBusinessId: businessId,
              activeBusinessName: data.name,
            })
          );
        }
      }
    } catch (error) {
      console.error("Error fetching business settings:", error);
    }
  }, [activeBusinessName, user]);

  useEffect(() => {
    const animationFrameId =
      window.requestAnimationFrame(() => {
        const storedBusiness =
          readStoredActiveBusiness();

        if (!storedBusiness) {
          return;
        }

        setActiveBusinessId(
          storedBusiness.activeBusinessId
        );
        setActiveBusinessName(
          storedBusiness.activeBusinessName
        );
      });

    return () => {
      window.cancelAnimationFrame(
        animationFrameId
      );
    };
  }, []);

  // Fetch business settings whenever activeBusinessId or user changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeBusinessId) {
        fetchBusinessSettings(activeBusinessId);
      } else {
        setActiveBusinessCurrency("USD");
        setActiveBusinessTimezone("UTC");
        setActiveBusinessFinancialYear("Jan-Dec");
        setActiveBusinessCountry("US");
        setActiveUserRole(null);
        setActiveBusinessIncomeCategories([...INCOME_CATEGORIES]);
        setActiveBusinessExpenseCategories([...EXPENSE_CATEGORIES]);
        setActiveBusinessPreferences({});
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeBusinessId, fetchBusinessSettings, user]);

  const setActiveBusiness = useCallback(
    (business: ActiveBusiness) => {
      setActiveBusinessId(
        business.activeBusinessId
      );
      setActiveBusinessName(
        business.activeBusinessName
      );

      window.localStorage.setItem(
        ACTIVE_BUSINESS_STORAGE_KEY,
        JSON.stringify(business)
      );
    },
    []
  );

  const clearActiveBusiness = useCallback(() => {
    setActiveBusinessId(null);
    setActiveBusinessName(null);
    setActiveUserRole(null);

    window.localStorage.removeItem(
      ACTIVE_BUSINESS_STORAGE_KEY
    );
  }, []);

  // Reset context states when user logs out (prevent session/permission leaks)
  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => {
        clearActiveBusiness();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, loading, clearActiveBusiness]);

  const refreshActiveBusiness = useCallback(async () => {
    if (activeBusinessId) {
      await fetchBusinessSettings(activeBusinessId);
    }
  }, [activeBusinessId, fetchBusinessSettings]);

  const value = useMemo(
    () => ({
      activeBusinessId,
      activeBusinessName,
      activeBusinessCurrency,
      activeBusinessTimezone,
      activeBusinessFinancialYear,
      activeBusinessCountry,
      activeUserRole,
      activeBusinessIncomeCategories,
      activeBusinessExpenseCategories,
      activeBusinessPreferences,
      setActiveBusiness,
      clearActiveBusiness,
      refreshActiveBusiness,
    }),
    [
      activeBusinessId,
      activeBusinessName,
      activeBusinessCurrency,
      activeBusinessTimezone,
      activeBusinessFinancialYear,
      activeBusinessCountry,
      activeUserRole,
      activeBusinessIncomeCategories,
      activeBusinessExpenseCategories,
      activeBusinessPreferences,
      setActiveBusiness,
      clearActiveBusiness,
      refreshActiveBusiness,
    ]
  );

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);

  if (!context) {
    throw new Error(
      "useBusiness must be used within BusinessProvider"
    );
  }

  return context;
}

