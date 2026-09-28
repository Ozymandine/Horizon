"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
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
        <span className="mb-2 block text-xs font-medium text-slate-300">Password</span>
        <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 focus-within:border-cyan-200/40">
          <LockKeyhole size={16} className="shrink-0 text-slate-500" />
          <input autoFocus type="password" name="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600" />
        </span>
      </label>
      {error && <p role="alert" className="rounded-xl border border-rose-300/15 bg-rose-300/[.06] px-3 py-2.5 text-xs text-rose-100">{error}</p>}
      <button type="submit" disabled={pending || !password} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-cyan-200 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60">
        {pending ? <LoaderCircle size={16} className="animate-spin" /> : <>Enter Horizon <ArrowRight size={15} /></>}
      </button>
      <p className="pt-1 text-center text-[11px] text-slate-600">This is your private release radar.</p>
    </form>
  );
}
