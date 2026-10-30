import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import type { Product } from "./types";

const ID_RE = /^[a-z0-9][a-z0-9-]{2,59}$/;
export const isValidId = (s: string) => ID_RE.test(s);

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const FILE_DIR =
  process.env.SHOWCASE_DATA_DIR || (process.env.VERCEL ? "/tmp/showcase" : path.join(process.cwd(), ".data"));

export const storageMode = (): "redis" | "file" => (REDIS_URL && REDIS_TOKEN ? "redis" : "file");

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(REDIS_URL as string, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Storage error (${res.status})`);
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(data.error);
  return data.result;
}

export function newProductId(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "product";
  return `${base}-${randomBytes(2).toString("hex")}`;
}

export const newToken = () => randomBytes(18).toString("hex");

export async function getProduct(id: string): Promise<Product | null> {
  if (!isValidId(id)) return null;
  try {
    if (storageMode() === "redis") {
      const raw = await redis(["GET", `showcase:product:${id}`]);
      return typeof raw === "string" ? (JSON.parse(raw) as Product) : null;
    }
    return JSON.parse(await fs.readFile(path.join(FILE_DIR, `${id}.json`), "utf8")) as Product;
  } catch {
    return null;
  }
}

export async function saveProduct(p: Product): Promise<void> {
  const body = JSON.stringify(p);
  if (storageMode() === "redis") {
    await redis(["SET", `showcase:product:${p.id}`, body]);
    await redis(["SADD", "showcase:index", p.id]);
    return;
  }
  await fs.mkdir(FILE_DIR, { recursive: true });
  await fs.writeFile(path.join(FILE_DIR, `${p.id}.json`), body, "utf8");
}

export async function listProducts(): Promise<Product[]> {
  try {
    if (storageMode() === "redis") {
      const ids = ((await redis(["SMEMBERS", "showcase:index"])) as string[]) || [];
      if (!ids.length) return [];
      const raws = (await redis(["MGET", ...ids.slice(0, 500).map((i) => `showcase:product:${i}`)])) as (string | null)[];
      return raws.filter((r): r is string => typeof r === "string").map((r) => JSON.parse(r) as Product);
    }
    const files = (await fs.readdir(FILE_DIR)).filter((f) => f.endsWith(".json"));
    const all = await Promise.all(
      files.map(async (f) => {
        try {
          return JSON.parse(await fs.readFile(path.join(FILE_DIR, f), "utf8")) as Product;
        } catch {
          return null;
        }
      })
    );
    return all.filter((p): p is Product => !!p);
  } catch {
    return [];
  }
}

export async function listPublished(): Promise<Product[]> {
  const all = await listProducts();
  return all
    .filter((p) => p.status === "published")
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
}
