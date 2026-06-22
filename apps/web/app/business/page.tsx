"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { createBusiness } from "@/services/businessService";

export default function BusinessPage() {
  const { user, loading: authLoading } =
    useAuth();
  const { setActiveBusiness } =
    useBusiness();
  const router = useRouter();

  const [name, setName] = useState("");
  const [submitting, setSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, router, user]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      setErrorMessage(
        "Business name is required."
      );
      return;
    }

    if (!user) {
      setErrorMessage(
        "You must be logged in to create a business."
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result =
        await createBusiness(
          user.uid,
          cleanName
        );

      setActiveBusiness({
        activeBusinessId: result.id,
        activeBusinessName: cleanName,
      });

      router.push("/dashboard");
    } catch (error) {
      console.error(
        "Create Business Error:",
        error
      );
      setErrorMessage(
        "Unable to create business."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <section className="mx-auto w-full max-w-xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-600">
            Loading account...
          </p>
        </section>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto flex w-full max-w-xl flex-col gap-8">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-medium text-slate-500">
            Business Setup
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Create Business
          </h1>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Business Name
            </span>
            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              placeholder="Acme Services"
            />
          </label>

          {errorMessage ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting
                ? "Creating..."
                : "Create Business"}
            </button>
            <Link
              href="/businesses"
              className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              View Businesses
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
