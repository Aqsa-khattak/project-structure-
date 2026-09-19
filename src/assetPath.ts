export function assetUrl(path: string): string {
  if (!path.startsWith("/")) return path; 
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return base + path;
}
