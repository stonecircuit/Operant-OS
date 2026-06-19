"use client";

import { useState } from "react";
import { signUp } from "@/services/authService";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSignup() {
    try {
      await signUp(email, password);

      alert("Account created successfully");
    } catch (error) {
      console.error(error);
      alert("Signup failed");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8 border rounded-lg">
        <h1 className="text-3xl font-bold mb-6">
          Create Account
        </h1>

        <input
          className="border p-3 w-full mb-4"
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
        />

        <input
          type="password"
          className="border p-3 w-full mb-4"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
        />

        <button
          onClick={handleSignup}
          className="border px-4 py-3 w-full"
        >
          Create Account
        </button>
      </div>
    </main>
  );
}