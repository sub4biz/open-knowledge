export async function copySvgToClipboard(url: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  await navigator.clipboard.writeText(await res.text());
}
