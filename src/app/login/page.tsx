import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="login-cinema relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div aria-hidden className="pointer-events-none absolute left-[-10rem] top-[-13rem] size-[35rem] rounded-full bg-rose-400/20 blur-[115px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-[-14rem] right-[-8rem] size-[38rem] rounded-full bg-violet-500/25 blur-[125px]" />
      <section className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/15 bg-[#15111c]/75 p-7 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-10">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-200/80 to-transparent" />
        <div className="mb-9 flex items-center gap-3">
          <span className="size-2 rounded-full bg-gradient-to-br from-fuchsia-200 to-amber-100 shadow-[0_0_18px_rgba(255,142,193,.8)]" />
          <p className="text-xs font-semibold tracking-[.24em] text-white">HORIZON</p>
          <span className="text-[10px] uppercase tracking-[.16em] text-white/40">Private access</span>
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-rose-200">The next big thing starts here</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Keep the good stuff in sight.</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">Enter your password to open your release radar.</p>
        <LoginForm nextPath={next} />
      </section>
      <p className="absolute bottom-5 text-[10px] tracking-[.1em] text-white/40">MOVIES · SERIES · GAMES · MUSIC</p>
    </main>
  );
}
