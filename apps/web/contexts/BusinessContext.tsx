"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface ActiveBusiness {
  activeBusinessId: string;
  activeBusinessName: string;
}

interface BusinessContextType {
  activeBusinessId: string | null;
  activeBusinessName: string | null;
  setActiveBusiness: (
    business: ActiveBusiness
  ) => void;
  clearActiveBusiness: () => void;
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
  const [
    activeBusinessId,
    setActiveBusinessId,
  ] = useState<string | null>(null);

  const [
    activeBusinessName,
    setActiveBusinessName,
  ] = useState<string | null>(null);

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

    window.localStorage.removeItem(
      ACTIVE_BUSINESS_STORAGE_KEY
    );
  }, []);

  const value = useMemo(
    () => ({
      activeBusinessId,
      activeBusinessName,
      setActiveBusiness,
      clearActiveBusiness,
    }),
    [
      activeBusinessId,
      activeBusinessName,
      setActiveBusiness,
      clearActiveBusiness,
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
