import Image from "next/image";
import Link from "next/link";
import { AddToTimelineButton } from "@/components/add-to-timeline-button";
import { AddToMyListMenu } from "@/components/add-to-my-list-menu";
import { VideoPlayer } from "@/components/video-player";
import { WatchOptions } from "@/components/watch-options";
import { ScrollRail } from "@/components/scroll-rail";
import { FilmArtwork } from "@/components/film-artwork";
import { NewsPanel } from "@/components/news-panel";
import { tmdbImage, type TmdbMovieDetails, type TmdbShowDetails } from "@/lib/tmdb";
import type { TmdbWatchOptions } from "@/lib/tmdb-watch-types";
import type { RadarItem } from "@/lib/radar";
import { returnLabel } from "@/lib/return-to";

const dateLabel = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Date to be announced";
const money = (value?: number) => value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : undefined;

export function FilmDetail({ details, watchOptions, backTo }: { details: TmdbMovieDetails | TmdbShowDetails; watchOptions: TmdbWatchOptions | null; backTo: string }) {
  const movie = "title" in details ? details : null;
  const show = "name" in details ? details : null;
  const title = movie?.title ?? show!.name;
  const kind = movie ? "movies" : "shows";
  const type = movie ? "MOVIE" : "SHOW";
  const backdrop = tmdbImage(details.backdrop_path, "original");
  const logoPath = details.images?.logos?.find((entry) => entry.iso_639_1 === "en")?.file_path ?? details.images?.logos?.find((entry) => entry.iso_639_1 === null)?.file_path;
  const logo = tmdbImage(logoPath ?? null, "w780");
  const trailer = details.videos?.results?.find((video) => video.site === "YouTube" && video.type === "Trailer" && video.official) ?? details.videos?.results?.find((video) => video.site === "YouTube" && video.type === "Trailer") ?? details.videos?.results?.find((video) => video.site === "YouTube");
  const usDates = movie?.release_dates?.results?.find((region) => region.iso_3166_1 === "US")?.release_dates ?? [];
  const date = movie ? usDates.find((release) => release.type === 3)?.release_date ?? movie.release_date : show!.first_air_date;
  const certification = usDates.find((release) => release.certification)?.certification;
  const cast = details.credits?.cast?.slice(0, 20) ?? [];
  const crew = details.credits?.crew ?? [];
  const runtime = movie?.runtime ?? show?.episode_run_time?.[0];
  const facts = [
    { label: movie ? "Release date" : "First aired", value: dateLabel(date) },
    { label: "Status", value: details.status },
    { label: movie ? "Runtime" : "Episode runtime", value: runtime ? `${Math.floor(runtime / 60) ? `${Math.floor(runtime / 60)}h ` : ""}${runtime % 60}m` : undefined },
    { label: "Content rating", value: certification },
    { label: "Director", value: movie ? crew.filter((person) => person.job === "Director").map((person) => person.name).join(", ") : undefined },
    { label: "Written by", value: movie ? [...new Set(crew.filter((person) => ["Writer", "Screenplay", "Story"].includes(person.job)).map((person) => person.name))].join(", ") : undefined },
    { label: "Created by", value: show?.created_by?.map((person) => person.name).join(", ") },
    { label: "Seasons / episodes", value: show ? `${show.number_of_seasons ?? 0} seasons · ${show.number_of_episodes ?? 0} episodes` : undefined },
    { label: "Last aired", value: show?.last_air_date ? dateLabel(show.last_air_date) : undefined },
    { label: "Network", value: show?.networks?.map((network) => network.name).join(", ") },
    { label: "Original language", value: details.original_language ? new Intl.DisplayNames(["en"], { type: "language" }).of(details.original_language) : undefined },
    { label: "Countries", value: movie?.production_countries?.map((country) => country.name).join(", ") ?? show?.origin_country?.map((country) => new Intl.DisplayNames(["en"], { type: "region" }).of(country)).join(", ") },
    { label: "Studios", value: details.production_companies?.map((company) => company.name).join(", ") },
    { label: "Budget", value: money(movie?.budget) },
    { label: "Box office", value: money(movie?.revenue) },
  ].filter((fact) => fact.value);
  const item: RadarItem = { source: "tmdb", sourceId: String(details.id), type, title, displayDate: dateLabel(date), releaseDate: date?.slice(0, 10) || null, sortTimestamp: date ? `${date.slice(0, 10)}T12:00:00.000Z` : null, isApproximate: !date, posterUrl: tmdbImage(details.poster_path), backdropUrl: backdrop, description: details.overview, externalUrl: null, tmdbId: details.id, genreIds: details.genres?.map((genre) => genre.id) ?? [], popularity: details.popularity ?? 0, voteAverage: details.vote_average, voteCount: details.vote_count, href: `/${kind}/${details.id}` };
  const related = (details.recommendations?.results ?? []).filter((entry) => entry.poster_path && entry.id !== details.id && !(type === "SHOW" && entry.genre_ids?.some((id) => id === 10763 || id === 10767))).slice(0, 16);
  const artwork = (details.images?.backdrops ?? []).slice(0, 10).map((entry) => tmdbImage(entry.file_path, "w1280")!).filter(Boolean);

  return <main className="film-detail-page">
    {backdrop && <div className="film-detail-ambient" style={{ backgroundImage: `url("${tmdbImage(details.backdrop_path, "w780")}")` }} aria-hidden="true"/>}
    <section className="film-detail-hero">
      {backdrop && <Image src={backdrop} alt="" fill quality={90} loading="eager" fetchPriority="high" sizes="100vw" className="film-detail-backdrop"/>}
      <div className="film-detail-shade" aria-hidden="true"/>
      <div className="film-detail-intro">
        <Link href={backTo} className="film-detail-back">← {returnLabel(backTo)}</Link>
        <div className="film-detail-copy">
          {details.tagline && <p className="film-tagline">{details.tagline}</p>}
          {logo ? <><h1 className="sr-only">{title}</h1><Image src={logo} alt="" width={640} height={220} sizes="(max-width: 640px) 85vw, 500px" className="film-title-logo"/></> : <h1>{title}</h1>}
          <div className="film-detail-meta">{details.vote_average > 0 && <span className="film-rating">★ {details.vote_average.toFixed(1)} <small>/ 10</small></span>}<span>{date?.slice(0, 4)}</span>{runtime ? <span>{runtime} min</span> : null}{certification && <span>{certification}</span>}</div>
          <div className="film-genres">{details.genres?.map((genre) => <Link key={genre.id} href={`/discover?type=${type}&genre=${genre.id}&all=1`}>{genre.name}</Link>)}</div>
          <div className="film-detail-actions"><AddToTimelineButton item={item}/><AddToMyListMenu item={item}/>{trailer && <a href="#trailer" className="detail-action">▶ Trailer</a>}</div>
          <p className="film-overview">{details.overview || "A synopsis has not been published yet."}</p>
          <p className="film-release-line">{dateLabel(date)}{show?.number_of_seasons ? ` · ${show.number_of_seasons} seasons · ${show.number_of_episodes ?? 0} episodes` : ""}</p>
        </div>
        {details.poster_path && <div className="film-detail-poster"><Image src={tmdbImage(details.poster_path, "w500")!} alt={`${title} poster`} fill sizes="260px" className="object-cover"/></div>}
      </div>
    </section>
    <div className="film-detail-body">
      <div className="film-main-column">
        {cast.length > 0 && <section><h2>Cast</h2><ScrollRail label="cast" trackClassName="film-cast-track">{cast.map((person) => <article key={person.id} className="film-cast-person"><div>{person.profile_path ? <Image src={tmdbImage(person.profile_path, "w185")!} alt="" fill sizes="90px" className="object-cover"/> : <span>{person.name.slice(0, 1)}</span>}</div><h3>{person.name}</h3><p>{person.character}</p></article>)}</ScrollRail></section>}
        {show?.next_episode_to_air && <section className="film-next-episode glass"><h2>Next episode</h2><p>Season {show.next_episode_to_air.season_number}, episode {show.next_episode_to_air.episode_number} · {show.next_episode_to_air.name}</p><span>{dateLabel(show.next_episode_to_air.air_date)}</span></section>}
        {!!show?.seasons?.length && <section><h2>Seasons</h2><ScrollRail label="seasons" trackClassName="film-seasons-track">{show.seasons.filter((season) => season.season_number > 0).map((season) => <article key={season.id} className="film-season"><div>{season.poster_path && <Image src={tmdbImage(season.poster_path, "w185")!} alt="" fill sizes="125px" className="object-cover"/>}</div><h3>{season.name}</h3><span>{season.episode_count} episodes · {season.air_date?.slice(0, 4) ?? "TBA"}</span>{season.overview && <p>{season.overview}</p>}</article>)}</ScrollRail></section>}
        {trailer && <section id="trailer"><h2>Trailers & clips</h2><VideoPlayer videoKey={trailer.key} title={title} posterUrl={tmdbImage(details.backdrop_path, "w780")} fallbackUrl={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`}/></section>}
        {artwork.length > 0 && <section><h2>Artwork & stills</h2><FilmArtwork title={title} images={artwork}/></section>}
        {related.length > 0 && <section><h2>More like this</h2><ScrollRail label="related titles" trackClassName="film-related-track">{related.map((entry) => <Link key={entry.id} href={`/${kind}/${entry.id}?returnTo=${encodeURIComponent(`/${kind}/${details.id}?returnTo=${encodeURIComponent(backTo)}`)}`} className="film-related-card" prefetch={false}><div><Image src={tmdbImage(entry.poster_path, "w342")!} alt="" fill sizes="145px" className="object-cover"/></div><h3>{"title" in entry ? entry.title : entry.name}</h3><p>{entry.vote_average > 0 ? `★ ${entry.vote_average.toFixed(1)}` : ""}</p></Link>)}</ScrollRail></section>}
      </div>
      <aside className="film-aside"><WatchOptions options={watchOptions}/><section className="film-facts glass"><h2>{movie ? "Movie" : "Series"} information</h2><dl>{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>{details.homepage && /^https?:\/\//.test(details.homepage) && <a href={details.homepage} target="_blank" rel="noreferrer">Official website ↗</a>}<p className="film-rating-note">TMDB rating based on {(details.vote_count ?? 0).toLocaleString()} votes.</p></section>{show && <NewsPanel title={title}/>}</aside>
    </div>
  </main>;
}
