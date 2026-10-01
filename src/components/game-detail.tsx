import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Gamepad2, Star } from "lucide-react";
import { AddToTimelineButton } from "@/components/add-to-timeline-button";
import { AddToMyListMenu } from "@/components/add-to-my-list-menu";
import { NewsPanel } from "@/components/news-panel";
import { GameMediaGallery, type GameGalleryMedia } from "./game-media-gallery";
import type { RadarItem, RawgGameDetails, SteamGameDetails } from "@/lib/radar";
import { discoverShelves } from "@/lib/discover-shelves";
import { returnLabel } from "@/lib/return-to";
import styles from "./game-detail.module.css";

type DescriptionBlock = { kind: "heading" | "paragraph" | "bullet" | "image"; content: string };

function plainText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\[(?:\/)?(?:h[1-6]|p|b|i|u|list|\*|quote|url)[^\]]*\]/gi, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/[ \t]+/g, " ").trim();
}

function descriptionBlocks(value: string): DescriptionBlock[] {
  // Render provider text as React content; never insert provider HTML into the page.
  const marked = value.replace(/<(script|style|iframe)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]\s*>/gi, (_, text: string) => `\n\n@@heading:${plainText(text)}\n\n`)
    .replace(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, (_, url: string) => {
      try {
        const imageUrl = new URL(url);
        return imageUrl.protocol === "https:" && /(^|\.)steamstatic\.com$/.test(imageUrl.hostname) ? `\n\n@@image:${imageUrl.href}\n\n` : "";
      } catch { return ""; }
    })
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi, (_, text: string) => `\n\n@@bullet:${plainText(text)}\n\n`)
    .replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/(?:p|div|ul|ol)\s*>/gi, "\n\n");
  return marked.split(/\n\s*\n/).map((entry): DescriptionBlock => {
    const text = entry.trim();
    const marker = /^@@(heading|bullet|image):([\s\S]*)$/.exec(text);
    return marker ? { kind: marker[1] as DescriptionBlock["kind"], content: marker[1] === "image" ? marker[2].trim() : plainText(marker[2]) } : { kind: "paragraph", content: plainText(text) };
  }).filter((block) => Boolean(block.content)).slice(0, 100);
}

export function GameDetail({ item, steam, rawg, backTo }: {
  item: RadarItem;
  steam: SteamGameDetails | null;
  rawg: RawgGameDetails | null;
  backTo: string;
}) {
  const screenshots = steam?.screenshots ?? rawg?.screenshots ?? [];
  const trailers = steam?.trailers ?? rawg?.trailers ?? [];
  const cover = steam?.headerImage ?? rawg?.backgroundImage ?? item.backdropUrl ?? item.posterUrl;
  const backdrop = steam?.background ?? screenshots[0] ?? rawg?.backgroundImage ?? item.backdropUrl;
  const developers = steam?.developers ?? rawg?.developers ?? [];
  const publishers = steam?.publishers ?? rawg?.publishers ?? [];
  const genres = steam?.genres ?? rawg?.genres ?? item.tags ?? [];
  const platforms = steam?.platforms ?? rawg?.platforms ?? [];
  const description = steam?.detailedDescription || rawg?.description || item.description;
  const shortDescription = plainText(steam?.shortDescription || item.description).slice(0, 650);
  const blocks = descriptionBlocks(description);
  const media: GameGalleryMedia[] = [
    ...trailers.map((entry) => ({ kind: "video" as const, name: entry.name, image: entry.poster || cover || "", webm: entry.webm, mp4: entry.mp4 })),
    ...screenshots.map((image, index) => ({ kind: "image" as const, name: `Screenshot ${index + 1}`, image })),
  ];
  if (!media.length && cover) media.push({ kind: "image", name: "Game artwork", image: cover });
  const info = [
    { label: "Release date", value: steam?.comingSoon ? `Coming soon · ${steam.releaseDate}` : item.displayDate },
    ...(developers.length ? [{ label: "Developer", value: developers.join(", ") }] : []),
    ...(publishers.length ? [{ label: "Publisher", value: publishers.join(", ") }] : []),
    ...(platforms.length ? [{ label: "Platforms", value: platforms.join(", ") }] : []),
  ];

  return <main className={styles.page}>
    {backdrop && <div className={styles.backdrop} aria-hidden="true" style={{ backgroundImage: `url("${backdrop}")` }} />}
    <div className={styles.content}>
      <Link href={backTo} className={styles.back}><ArrowLeft size={16} aria-hidden="true" />{returnLabel(backTo)}</Link>
      <div className={styles.heading}><p className={styles.eyebrow}><Gamepad2 size={15} aria-hidden="true" />Games</p><h1>{item.title}</h1></div>
      <section className={styles.storePanel} aria-label={`${item.title} overview`}>
        <GameMediaGallery title={item.title} media={media} />
        <div className={styles.summary}>
          <div className={styles.headerArt}>{cover ? <Image src={cover} alt={`${item.title} game artwork`} fill sizes="(max-width: 900px) 100vw, 360px" className={styles.headerImage} /> : <div className={styles.artFallback}><Gamepad2 size={36} aria-hidden="true" /><span>{item.title}</span></div>}</div>
          <h2 className={styles.summaryTitle}>{item.title}</h2>
          {shortDescription && <p className={styles.summaryDescription}>{shortDescription}</p>}
          <dl className={styles.metadata}>{info.map((entry) => <div key={entry.label}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}</dl>
          {steam?.recommendations != null && <div className={styles.review}><Star size={15} aria-hidden="true" /><span><strong>{steam.recommendations.toLocaleString()}</strong> Steam recommendations</span></div>}
          {rawg?.rating != null && <div className={styles.review}><Star size={15} aria-hidden="true" /><span><strong>{rawg.rating.toFixed(1)} / 5</strong> · {rawg.ratingsCount.toLocaleString()} RAWG ratings</span></div>}
          {genres.length > 0 && <div className={styles.tags} aria-label="Game genres">{genres.map((genre) => {
            const option = discoverShelves.GAME.find((entry) => entry.label.toLowerCase() === genre.toLowerCase() || genre === "RPG" && entry.label === "Role-playing");
            return option ? <Link key={genre} href={`/discover?type=GAME&genre=${encodeURIComponent(option.value)}&all=1`} className={styles.tag}>{genre}</Link> : <span key={genre} className={styles.tag}>{genre}</span>;
          })}</div>}
          <div className={styles.actions}><AddToTimelineButton item={item} /><AddToMyListMenu item={item} />{item.externalUrl && <a href={item.externalUrl} target="_blank" rel="noreferrer" className={styles.storeLink}>{steam ? "View on Steam" : item.source === "gog" ? "View on GOG" : "Official game page"}<ArrowUpRight size={16} aria-hidden="true" /></a>}</div>
        </div>
      </section>
      <div className={styles.detailsLayout}>
        <div>
          <section className={styles.description}>
            <h2>About this game</h2>
            <div className={styles.descriptionBody}>{blocks.length ? blocks.map((block, index) => block.kind === "heading" ? <h3 key={index}>{block.content}</h3> : block.kind === "image" ? <div key={index} className={styles.descriptionImage}><Image src={block.content} alt={`${item.title} feature artwork`} width={900} height={500} sizes="(max-width: 900px) 100vw, 850px" style={{ width: "100%", height: "auto" }} /></div> : block.kind === "bullet" ? <p key={index} className={styles.bullet}>{block.content}</p> : <p key={index}>{block.content}</p>) : <p>A detailed description has not been published yet.</p>}</div>
          </section>
          {steam?.systemRequirements?.length ? <section className={styles.requirements}><h2>System requirements</h2>{steam.systemRequirements.map((entry) => <div key={entry.platform}><h3>{entry.platform}</h3><div className={styles.requirementsColumns}>{entry.minimum && <div><h4>Minimum</h4><p>{plainText(entry.minimum.replace(/<br\s*\/?\s*>|<\/li\s*>/gi, "\n"))}</p></div>}{entry.recommended && <div><h4>Recommended</h4><p>{plainText(entry.recommended.replace(/<br\s*\/?\s*>|<\/li\s*>/gi, "\n"))}</p></div>}</div></div>)}</section> : null}
          <div className={styles.news}><NewsPanel title={item.title} /></div>
        </div>
        <aside className={styles.facts} aria-label="Game information"><h2>Game information</h2><dl>{info.map((entry) => <div key={entry.label}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}{genres.length > 0 && <div><dt>Genres</dt><dd>{genres.join(", ")}</dd></div>}{rawg?.metacritic != null && <div><dt>Metacritic</dt><dd><span className={styles.score}>{rawg.metacritic}</span> / 100</dd></div>}<div><dt>Catalog</dt><dd>{steam ? "Steam" : rawg ? "RAWG" : item.source.toUpperCase()}</dd></div></dl>{steam?.website && <a href={steam.website} target="_blank" rel="noreferrer" className={styles.website}>Visit game website<ArrowUpRight size={14} aria-hidden="true" /></a>}</aside>
      </div>
    </div>
  </main>;
}
