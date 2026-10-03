import { artistPortrait } from "@/lib/artist-artwork";
import { countries } from "@/lib/discovery-options";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,16}$/.test(id)) return Response.json({ error: "Invalid artist" }, { status: 400 });
  const selected = new URL(request.url).searchParams.get("country")?.toUpperCase();
  const country = countries.some((entry) => entry.value === selected) ? selected! : "US";
  const portraitUrl = await artistPortrait(id, country);
  return Response.json({ portraitUrl }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
