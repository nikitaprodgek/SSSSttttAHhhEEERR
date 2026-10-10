// VERDICTA — Netlify Function: redirect visitors straight to the newest installer
// hosted in a public Yandex Disk folder. Finds the latest .exe automatically,
// so it keeps working no matter how the installer file is named.
const PUBLIC_KEY = "https://disk.yandex.ru/d/Z_33ZzJHGel3Vw";
const FALLBACK_NAME = "/RO-Pomoshnik-Setup.exe"; // на случай, если список недоступен
const API = "https://cloud-api.yandex.net/v1/disk/public";

async function newestExeHref() {
  // 1) перечисляем публичную папку и берём самый свежий .exe
  const listUrl = new URL(API + "/resources");
  listUrl.searchParams.set("public_key", PUBLIC_KEY);
  listUrl.searchParams.set("limit", "200");
  const r = await fetch(listUrl, { headers: { Accept: "application/json" } });
  if (r.ok) {
    const meta = await r.json();
    const items = (meta && meta._embedded && meta._embedded.items) || [];
    let best = null;
    for (const it of items) {
      if (it && it.type === "file" && /\.exe$/i.test(it.name || "")) {
        const m = it.modified || it.created || "";
        if (!best || m > best.m) best = { m, file: it.file || "" };
      }
    }
    if (best && best.file) return best.file;
  }
  // 2) запасной путь: прямое имя
  const dl = new URL(API + "/resources/download");
  dl.searchParams.set("public_key", PUBLIC_KEY);
  dl.searchParams.set("path", FALLBACK_NAME);
  const d = await fetch(dl, { headers: { Accept: "application/json" } });
  if (d.ok) {
    const j = await d.json();
    if (typeof j.href === "string" && j.href.startsWith("https://")) return j.href;
  }
  return null;
}

export default async (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" },
    });
  }
  try {
    const href = await newestExeHref();
    if (href) {
      return new Response(null, {
        status: 302,
        headers: { Location: href, "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
      });
    }
  } catch (e) {
    console.error("Download redirect failed:", e);
  }
  // 3) последний резерв — открыть саму публичную папку Яндекс.Диска
  return new Response(null, {
    status: 302,
    headers: { Location: PUBLIC_KEY, "Cache-Control": "no-store" },
  });
};
