"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/services/authService";
import { useNotifications } from "@/contexts/NotificationContext";
import { validateEmail } from "@/lib/validation";

export default function SignupPage() {
  const router = useRouter();
  const { addNotification } = useNotifications();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg("Email address is required.");
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setErrorMsg("Password is required.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      await signUp(cleanEmail, password);
      addNotification("success", "Welcome to Operant OS", "Your account was successfully registered.");
      router.push("/business"); // Redirect to set up their first business ledger!
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Account creation failed.");
      addNotification("error", "Signup Failed", err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Decorative Gradients */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-violet-500/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800 p-8 shadow-2xl flex flex-col gap-6 relative z-10 text-xs">
        <div className="flex flex-col gap-1.5 text-center">
          <h1 className="text-xl font-black text-white tracking-tight">Create Account</h1>
          <p className="text-slate-400 font-medium">Join Operant OS and setup your workspace</p>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-300 font-semibold leading-relaxed">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-bold text-slate-400">Email Address</span>
            <input
              type="email"
              disabled={submitting}
              className="h-11 rounded-xl border border-slate-800 bg-slate-950/50 px-4 text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition disabled:opacity-50"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-bold text-slate-400">Password</span>
            <input
              type="password"
              disabled={submitting}
              className="h-11 rounded-xl border border-slate-800 bg-slate-950/50 px-4 text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition disabled:opacity-50"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-xl bg-indigo-600 font-extrabold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Registering account...</span>
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <div className="text-center font-medium text-slate-400 border-t border-slate-800 pt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-bold transition">
            Log In
          </Link>
        </div>
      </div>
    </main>
  );
}