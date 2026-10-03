import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="login-cinema relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div aria-hidden className="pointer-events-none absolute left-[-10rem] top-[-13rem] size-[35rem] rounded-full bg-rose-400/20 blur-[115px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-[-14rem] right-[-8rem] size-[38rem] rounded-full bg-violet-500/25 blur-[125px]" />
      <section className="login-card relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/15 bg-[#15111c]/75 p-7 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-9">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-200/80 to-transparent" />
        <h1 className="login-title">Horizon</h1>
        <LoginForm nextPath={next} />
      </section>
    </main>
  );
}
