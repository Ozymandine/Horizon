export function safeReturnTo(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  try {
    const url = new URL(value, "https://horizon.invalid");
    if (url.origin !== "https://horizon.invalid") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function returnLabel(path: string) {
  if (path.startsWith("/discover")) return "Discover";
  if (path.startsWith("/timeline")) return "Timeline";
  if (path.startsWith("/my-list")) return "My List";
  return "Upcoming";
}
