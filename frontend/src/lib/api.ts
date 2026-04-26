const fetchOpts: Pick<RequestInit, "credentials"> = { credentials: "include" };

/** Пусто = тот же хост, префикс /api (Docker + dev-rewrite). Иначе полный URL бэкенда. */
function apiOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
}

/** Запросы к Nest: в проде `/api/products`, локально `http://localhost:4001/products`. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = apiOrigin();
  if (base) return `${base}${p}`;
  return `/api${p}`;
}

/** Картинки товаров: `/uploads/...` с того же хоста или с dev-сервера. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = apiOrigin();
  if (base) return `${base}${p}`;
  return p;
}

async function parseError(res: Response): Promise<string> {
  const t = await res.text();
  try {
    const j = JSON.parse(t) as { message?: string | string[] };
    if (Array.isArray(j.message)) return j.message.join(", ");
    if (j.message) return j.message;
  } catch {
    /* ignore */
  }
  return t || res.statusText;
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(apiUrl(path), { cache: "no-store", ...fetchOpts });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<T>;
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...fetchOpts,
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<T>;
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const r = await fetch(apiUrl(path), {
    method: "POST",
    body: form,
    ...fetchOpts,
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<T>;
}

export async function apiPatchForm<T>(
  path: string,
  form: FormData,
): Promise<T> {
  const r = await fetch(apiUrl(path), {
    method: "PATCH",
    body: form,
    ...fetchOpts,
  });
  if (!r.ok) throw new Error(await parseError(r));
  return r.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const r = await fetch(apiUrl(path), { method: "DELETE", ...fetchOpts });
  if (!r.ok) throw new Error(await parseError(r));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Скачать файл (Excel и т.п.) с API */
export async function apiDownloadFile(
  path: string,
  filename: string,
): Promise<void> {
  const r = await fetch(apiUrl(path), { ...fetchOpts });
  if (!r.ok) throw new Error(await parseError(r));
  const blob = await r.blob();
  downloadBlob(blob, filename);
}
