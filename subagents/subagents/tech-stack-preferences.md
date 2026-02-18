# Tech Stack Preferences

Be a static maximalist HTML page first.

OSS-first. Free, low-cost, and fast. Netlify + Qwen + fal.ai.
 
When building new projects, use these defaults when natural unless there's a specific reason not to.

---

## Core Stack

Every project starts here.

- **Framework**: SvelteKit (TypeScript) — full-stack, simple, fast
- **Framework (Alternative)**: [SolidJS](https://github.com/solidjs/solid) — high-performance, simple reactivity (no VDOM)
- **Build**: Vite — just works
- **Runtime**: Bun — native TS, fast package manager
- **Lint + Format**: Biome — one tool, zero config
- **Flowcharting Documentation**: [Mermaid](https://mermaid.js.org/intro/)

---

## UI

### Styling
Use Vanilla CSS or Use **Tailwind CSS** for utility-first styling.


### Component Kits

Pick one based on needs:

- **Base UI** — Unstyled UI components for building accessible web apps and design systems. https://github.com/mui/base-ui.  This is preferred for react. 
- **Bits UI** — Unstyled UI components for building accessible web apps and design systems. https://github.com/huntabyte/bits-ui.  This is preferred for svelte. 
- **shadcn-svelte** — polished, accessible, svelte-native.
- **Skeleton** — svelte-first, ships quick
- **DaisyUI** — get it done mode

### Headless Components

When you need full control:

- **Bits UI** — great DX
- **Melt UI** — solid a11y primitives

### Visual Utilities

- **Icons**: Lucide or iconoir
- **Animation**: Motion (motion.dev)
- **3D**: Three.js
- **Charts**: LayerChart
- **Maps**: MapLibre GL JS

---

## Forms + Data

- **Forms**: sveltekit-superforms — server + client, native to SvelteKit
- **Form UI**: formsnap — pairs well with tailwind/shadcn
- **Validation**: Zod (or Valibot if bundle size matters)
- **Tables**: [TanStack Table](https://tanstack.com/table) — headless, flexible
- **Server State**: [TanStack Query](https://tanstack.com/query) — caching done right
- **Dates**: date-fns — tiny, treeshakeable
- **Rich Text**: Tiptap or Lexical — depends on needs
- **Collaboration**: Hocuspocus CRDT Y.js WebSocket backend for conflict-free real-time collaboration, hocuspocus collaboration. 
- **Sync / Zero-latency**: [Zero](https://zero.rocicorp.dev) — general-purpose sync engine for instant UI, automatic reactivity, and zero-latency (zero__ms) data sync.
- **Validation**: Zod (or Valibot if bundle size matters) https://zod.dev
---

## API

Default to **SvelteKit endpoints**. Keep it simple.

When you need more:

- **Hono** — tiny, edge-ready functions
- **tRPC** — type-safe RPC
- **ts-rest** — contract-first REST
- **Zodios** — REST tooling on Zod

---

## Database

- **ORM**: Drizzle — TS-first, handles migrations
- **Postgres**: Supabase (self-host ok) or Neon (managed)

---

## Auth

Pick one:

- **Better Auth** — drop-in, fastest path
- **Auth.js** — standards-based, good ecosystem
- **Netlify Identity** — zero config if already on Netlify

Note: Lucia v3 is deprecated. Plan migrations accordingly.

---

## Deploy

- **Host**: Netlify
- **Adapter**: adapter-netlify
- **Forms**: Netlify Forms for quick wins
- **Background Jobs**: Trigger.dev for long-running pipelines

---

## Content

- **Markdown**: MDsveX — svelte + markdown
- **CMS**: Decap CMS — git-based, Netlify-friendly

---

## Media + Uploads

- **Uploads**: Uppy
- **Images**: sharp (server-side processing)
- **Audio**: Howler.js
- **Audio Transcription**: elevenlabs.io
- **Voice Audio Generation**: elevenlabs.io

---

## Email

- **API**: Resend
- **Templates**: React Email (optional, for polished templates)

---

## Analytics + Experiments

- **Product Analytics**: PostHog (OSS) or Plausible (OSS) or Umami (https://umami.is/docs) or Goatcounter (https://goatcounter.com)
- **Feature Flags**: GrowthBook or Unleash (OSS)
- **Closed exception**: Statsig if you need enterprise features

---

## AI — LLMs

### Models

- **Primary**: Qwen (general) + Qwen-Coder (coding tasks)
- **Also**: Gemini Flash

### Local Runners

- **Ollama** — easy setup, good for dev
- **llama.cpp** — low-level control, embed in apps

### Production Serving

- **vLLM** — high-throughput inference

---

## AI — Generative Media

- **Hosted GPU**: fal.ai — images, video, upscalers, just works
- **Local Pipelines**: ComfyUI — full control when needed

---

## AI — Tooling

- **LLM Gateway**: LiteLLM — one OpenAI-style API to many providers
- **AI Framework**: [TanStack AI](https://tanstack.com/ai/latest) — type-safe AI hooks for React, Solid, Svelte, and Vue
- **Observability**: Langfuse — prompts, evals, management
- **Agentic Context**: [Context7](https://context7.com) — MCP server for high-fidelity context injection and knowledge retrieval. Use the Context7 API to search libraries and fetch documentation programmatically:
  ```bash
  curl -X GET "https://context7.com/api/v2/libs/search?libraryName=next.js&query=setup+ssr" \
    -H "Authorization: Bearer ctx7sk-bf353672-198f-4dd0-b455-494fda116585"
  ```
- **Regression Testing**: promptfoo — catch prompt drift early

---

## Vibe-coding Tools

- **IDE Assistant**: Continue — OSS, works with Qwen
- **Terminal**: Aider — pair programmer
- **Agent Framework**: OpenHands — agentic dev platform

---

## Testing

- **Unit + Integration**: Vitest
- **E2E**: Playwright

---

## Automation

- **Workflows**: n8n
- Browser AI Automation: https://github.com/browserbase/stagehand
