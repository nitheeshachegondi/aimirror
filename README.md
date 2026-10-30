# Showcase (working name)

**Your product is more than a tagline. Show everything it can do.**

Founders upload the documents that describe their product. The platform organises everything those documents say into a detailed showcase, the founder approves it, and people discover products by describing what they actually need.

> The document is the input. The showcase is the output. The marketplace is where people discover it.
> AI is the organising and discovery engine inside it, not the thing being sold.

Stack: Next.js 14 (App Router) · TypeScript · Groq (`openai/gpt-oss-120b`) · Vercel.

## Run it

```bash
npm install
cp .env.example .env.local      # add GROQ_API_KEY
npm run dev                     # http://localhost:3000
```

To try discovery before any real founder signs up, load three fictional sample products (dev mode only):

```bash
curl -X POST http://localhost:3000/api/dev/seed
```

The working name lives in one place: `lib/brand.ts` (also holds the homepage headline and supporting line).

## Founder flow: add product → upload documents → review → approve → publish

1. **Add product** (`/founder/new`): name, website, and documents (PDF, Word `.docx`, `.txt`, `.md`, `.html`) or pasted text.
2. **Extraction** (`lib/extract.ts`): Groq reads each document and returns every feature it states, each with a **verbatim quote**. The server locates that quote in the document (`lib/text.ts`), so every feature links back to its original passage. Long documents are processed in windows so nothing is silently skipped.
3. **Review** (`/founder/<id>`):
   - **Completeness check**: "We found 18 features in your documents. 16 are included in your showcase. 2 need your clarification."
   - Each feature shows its **source passage highlighted in context**. The founder can inspect, edit, **restore the original wording**, mark *Include / Unsure / Leave out*, or delete it.
   - **Not yet covered**: passages in the documents that no feature points at, with *Add as feature* / *Not a feature*. This is the "don't miss my details" safety net.
   - The showcase fields (tagline, what it is, problem, differentiators, who it is / isn't for, pricing, limitations, demo link, screenshots, founder's note) are pre-filled **only** from what the documents explicitly say and never overwrite the founder's edits.
   - The founder chooses which documents are shown publicly as supporting material.
4. **Approve & publish**: publishing approves the included features. Only approved, included features are ever public.

Features the AI cannot back with an exact passage are never trusted silently: they are set to *needs your clarification*.

## Visitor flow: describe a need → explore matches → read showcase → visit product

- `/discover`: describe a need in plain words. Results show a match %, a short "why", and **the specific features behind each match**.
- Search uses the founder-approved features only. With a Groq key it ranks with the model (it can only cite feature ids that exist); without a key, or if the model fails, it falls back to keyword matching, so discovery never breaks.
- `/products/<slug>`: the full showcase, with an expandable source passage under every feature, and a "Visit website" button. No purchases in this version.

## Where things are

| Piece | File |
|---|---|
| Extraction prompt + search prompt | `lib/prompts.ts` |
| Doc → features with source links | `lib/extract.ts`, `lib/text.ts` |
| Completeness sentence + counts | `lib/completeness.ts` |
| Discovery ranking | `lib/search.ts` |
| Public vs. private data views | `lib/views.ts` |
| Storage (Upstash Redis or local disk) | `lib/store.ts` |
| Founder review UI | `components/Editor.tsx` |

## Deploy to Vercel

1. Push to GitHub, import in Vercel.
2. Set `GROQ_API_KEY`, `GROQ_MODEL=openai/gpt-oss-120b`, and **`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`** (free Upstash Redis; the Vercel Marketplace variables `KV_REST_API_URL`/`KV_REST_API_TOKEN` also work). Without Redis, products are saved to ephemeral disk and will disappear on Vercel.
3. Deploy. Leave `ALLOW_SEED` unset in production.

## Known limits of this first version

- **No accounts yet.** Founders get a private edit token kept in their browser, and can copy an "edit link" (`/founder/<id>#k=…`) from *My products*. Anyone with that link can edit, so treat it like a password. Add real login (Clerk / NextAuth / Supabase) next.
- **No moderation or rate limiting.** Anyone can publish and every analysis uses your Groq quota. Add a review queue and rate limits (e.g. Upstash Ratelimit) before opening it up publicly.
- **Scanned PDFs** (images of text) are not supported; they need OCR first.
- Documents longer than ~60,000 characters are analysed only in part. The editor flags this and the *Not yet covered* list shows what was missed.
- Screenshots are image URLs (https) pasted in; there is no image upload yet.
- Search scans all published products, which is fine for hundreds of products. Move to embeddings / a vector DB when the catalogue grows.
