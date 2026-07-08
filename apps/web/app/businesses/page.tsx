"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import {
  getBusinesses,
} from "@/services/businessService";
import type { Business } from "@/services/businessService";

export default function BusinessesPage() {
  const { user, loading: authLoading } =
    useAuth();

  const {
    activeBusinessId,
    activeBusinessName,
    setActiveBusiness,
  } = useBusiness();

  const router = useRouter();

  const [businesses, setBusinesses] =
    useState<Business[]>([]);

  const [businessesLoading, setBusinessesLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      return;
    }

    const ownerId = user.uid;
    let isCurrent = true;

    async function loadBusinesses() {
      setBusinessesLoading(true);
      setErrorMessage(null);

      try {
        const userBusinesses =
          await getBusinesses(ownerId);

        if (isCurrent) {
          setBusinesses(userBusinesses);
        }
      } catch (error) {
        console.error(
          "Load Businesses Error:",
          error
        );

        if (isCurrent) {
          setErrorMessage(
            "Unable to load businesses."
          );
          setBusinesses([]);
        }
      } finally {
        if (isCurrent) {
          setBusinessesLoading(false);
        }
      }
    }

    loadBusinesses();

    return () => {
      isCurrent = false;
    };
  }, [authLoading, user]);

  const isLoading =
    authLoading || businessesLoading;

  const visibleBusinesses = user
    ? businesses
    : [];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Business Dashboard
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Your Businesses
            </h1>
          </div>

          <div className="flex items-center gap-3.5">
            {visibleBusinesses.length > 0 && (
              <Link
                href="/business"
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 shadow"
              >
                ＋ Create Business
              </Link>
            )}
            <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Total businesses
              </p>

              <p className="mt-1 text-3xl font-bold">
                {visibleBusinesses.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Active Business:
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-950">
            {activeBusinessName ??
              "No business selected"}
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm animate-pulse">
            <p className="text-sm font-medium text-slate-600">
              Loading businesses...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-red-700">
            <p className="font-medium">
              {errorMessage}
            </p>
          </div>
        ) : visibleBusinesses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm flex flex-col items-center justify-center gap-3">
            <span className="text-3xl">🏢</span>
            <p className="text-sm font-extrabold text-slate-700">
              No businesses found
            </p>
            <p className="text-xs text-slate-500 max-w-xs leading-normal">
              You haven&apos;t created or joined any business ledger accounts yet. Set up your first business to begin tracking cashflows.
            </p>
            <Link
              href="/business"
              className="mt-2 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 shadow"
            >
              ＋ Create a Business
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {visibleBusinesses.map((business) => (
              <li
                key={business.id}
                className="flex items-center justify-between gap-4 px-6 py-5"
              >
                <p className="truncate text-base font-semibold text-slate-900">
                  {business.name}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setActiveBusiness({
                      activeBusinessId:
                        business.id,
                      activeBusinessName:
                        business.name,
                    });
                    router.push("/dashboard");
                  }}
                  className="shrink-0 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-default disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                  disabled={
                    activeBusinessId ===
                    business.id
                  }
                >
                  {activeBusinessId === business.id
                    ? "Selected"
                    : "Select"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
