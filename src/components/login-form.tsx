"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({})) as { error?: string };
          setError(data.error ?? "Could not sign in. Try again.");
          return;
        }
        const destination = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
        router.replace(destination);
        router.refresh();
      } catch {
        setError("The site could not be reached. Try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-white/75">Password</span>
        <span className="flex items-center rounded-2xl border border-white/15 bg-black/30 px-4 transition focus-within:border-fuchsia-200/70 focus-within:ring-2 focus-within:ring-fuchsia-300/15">
          <input type="password" name="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="login-password h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none" />
        </span>
      </label>
      {error && <p role="alert" className="rounded-xl border border-rose-200/25 bg-rose-300/10 px-3 py-2.5 text-xs text-rose-100">{error}</p>}
      <button type="submit" disabled={pending || !password} className="flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-300 via-rose-300 to-amber-200 text-sm font-semibold text-[#20121c] shadow-lg shadow-fuchsia-950/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
        {pending ? "Opening…" : "Enter Horizon"}
      </button>
    </form>
  );
}
