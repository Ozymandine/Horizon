import Image from "next/image";
import type { TmdbWatchOptions } from "@/lib/tmdb-watch-types";
import { watchServices } from "@/lib/watch-services";

export function WatchOptions({ options }: { options: TmdbWatchOptions | null }) {
  const available = [...(options?.flatrate ?? []), ...(options?.free ?? []), ...(options?.ads ?? []), ...(options?.rent ?? []), ...(options?.buy ?? [])];
  const providers = watchServices.flatMap((service) => {
    const entry = available.find((provider) => service.ids.includes(provider.provider_id));
    if (!entry) return [];
    return [{ ...entry, provider_name: service.name }];
  });

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-base font-semibold text-white">Where to watch</h2>
      <div className="mt-4 space-y-2">
        {providers.map((provider) => (
          <a key={provider.provider_id} href={options!.link} target="_blank" rel="noreferrer" title={provider.provider_name} className="flex items-center gap-3 rounded-xl bg-black/20 p-2.5 text-sm text-slate-200 hover:bg-white/10">
            {provider.logo_path && <Image src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} alt="" width={34} height={34} className="rounded-lg" />}
            <span>{provider.provider_name}</span>
          </a>
        ))}
      </div>
      {!providers.length && <p className="text-sm leading-6 text-slate-400">No availability is currently listed on your selected services.</p>}
    </section>
  );
}
