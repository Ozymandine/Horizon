import Image from "next/image";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { TmdbWatchOptions } from "@/lib/tmdb-watch-types";

export function WatchOptions({ options }: { options: TmdbWatchOptions | null }) {
  if (!options) return null;
  const providers = [...(options.flatrate ?? []), ...(options.rent ?? []), ...(options.buy ?? [])]
    .filter((provider, index, list) => list.findIndex((candidate) => candidate.provider_id === provider.provider_id) === index);
  if (!providers.length) return null;

  return (
    <details className="glass group rounded-2xl p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-white">
        <span>Where to watch</span><ChevronDown size={16} className="text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="mt-4 flex flex-wrap gap-2">
        {providers.map((provider) => (
          <a key={provider.provider_id} href={options.link} target="_blank" rel="noreferrer" title={`Availability from ${provider.provider_name}`} className="flex items-center gap-2 rounded-full bg-black/25 py-1.5 pl-1.5 pr-3 text-xs text-slate-200 hover:bg-white/10">
            <Image src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`} alt="" width={22} height={22} className="rounded-full" />
            {provider.provider_name}
          </a>
        ))}
      </div>
      <a href={options.link} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-cyan-200 hover:text-white">Check availability <ExternalLink size={12} /></a>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">Availability from JustWatch via TMDB. Links open TMDB’s provider page.</p>
    </details>
  );
}
