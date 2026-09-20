export function assetUrl(path: string): string {
  if (!path.startsWith("/")) return path; 
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return base + path;
}

export function rawAssetPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (base && path.startsWith(base + "/")) return path.slice(base.length);
  return path;
}
