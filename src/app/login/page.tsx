import { Sparkles } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-44 size-[34rem] rounded-full bg-cyan-400/[.09] blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -right-32 size-[34rem] rounded-full bg-violet-500/[.08] blur-[120px]" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[.04] p-7 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl border border-cyan-200/15 bg-cyan-200/[.08] text-cyan-100"><Sparkles size={20} /></span>
          <div><p className="text-xs font-semibold tracking-[.22em] text-white">HORIZON</p><p className="mt-1 text-[10px] uppercase tracking-[.16em] text-slate-500">Private release radar</p></div>
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-cyan-200">A little further ahead</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Your next favorite is out there.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Enter your password to open your personal horizon.</p>
        <LoginForm nextPath={next} />
      </section>
      <p className="absolute bottom-5 text-[10px] text-slate-600">Movies · shows · games · music</p>
    </main>
  );
}
