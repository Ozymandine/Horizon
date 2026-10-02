import Image from "next/image";
import type { TmdbWatchOptions } from "@/lib/tmdb-watch-types";
import { watchServices } from "@/lib/watch-services";

export function WatchOptions({ options }: { options: TmdbWatchOptions | null }) {
  const available = [...(options?.flatrate ?? []), ...(options?.free ?? []), ...(options?.ads ?? []), ...(options?.rent ?? []), ...(options?.buy ?? [])];
  const providers = watchServices.flatMap((service) => {
    const entry = available.find((provider) => service.ids.includes(provider.provider_id));
    if (!entry) return [];
    const modes = [
      ["Subscription", options?.flatrate], ["Free", options?.free], ["With ads", options?.ads], ["Rent", options?.rent], ["Buy", options?.buy],
    ] as const;
    return [{ ...entry, provider_name: service.name, modes: modes.filter(([, entries]) => entries?.some((provider) => service.ids.includes(provider.provider_id))).map(([name]) => name).join(" · ") }];
  });

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-base font-semibold text-white">Where to watch <span className="text-xs font-normal text-slate-400">· United States</span></h2>
      <div className="mt-4 space-y-2">
        {providers.map((provider) => (
          <a key={provider.provider_id} href={options!.link} target="_blank" rel="noreferrer" title={`Availability from ${provider.provider_name}`} className="flex items-center gap-3 rounded-xl bg-black/20 p-2.5 text-sm text-slate-200 hover:bg-white/10">
            {provider.logo_path && <Image src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} alt="" width={34} height={34} className="rounded-lg" />}
            <span>{provider.provider_name}<small className="mt-1 block text-[10px] text-slate-400">{provider.modes}</small></span>
          </a>
        ))}
      </div>
      {!providers.length && <p className="text-sm leading-6 text-slate-400">No availability is currently listed on your selected services.</p>}
      {options?.link && providers.length > 0 && <a href={options.link} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-cyan-200 hover:text-white">Check availability ↗</a>}
      <p className="mt-3 text-[10px] leading-4 text-slate-400">Availability from JustWatch via TMDB. Provider links open TMDB’s availability page.</p>
    </section>
  );
}
