# Ralph Loop: RLBot Improvement Framework
> **Philosophy**: Iteration > Perfection | Failures Are Data | Operator Skill Matters | Persistence Wins

The **Ralph Loop** is a deterministic, iterative process for maintaining and improving REALTylRCarmody bot. It bridges the gap between biological intent and machine execution by capturing data from every failure and codifying it into improvements.

---

## 🔁 The Loop Framework

### 1. Requirements & Success Criteria
- **Goal**: Maintain 100% "Human-Equivalent" stealth profile while achieving target engagement frequency.
- **Success Criteria**:
    - All requirements in @[README.md](file:///Users/coreyoneal/Programming/PiTweeter/REALTylRCarmody/README.md) implemented.
    - Zero `IndentationError` or `UnboundLocalError` in production.
    - Stealth Engine success rate > 80% per attempt.
    - Documentation updated with every architectural change.
    - 500 error resolved and site functional.

### 2. Standard Operating Procedure (SOP)
#### For Bugs
1. **Reproduce**: Run specific command on Pi (e.g., `--reply-to` or `--force`).
2. **Identify**: Isolate if it's an **Auth** (cookies), **Logic** (code), or **Environment** (network/Mac) failure.
3. **Implement**: Apply minimal fix required.
4. **Verify**: Run a `--dry-run` followed by a `--force` or manual reply.
5. **Codify**: Update this document with learning.

#### For Feature Iteration
1. Write failing test or documentation for next requirement.
2. Implement minimal code to pass.
3. Refactor until clean and no new issues are introduced.

---

## 📊 Current Status (2026-01-21 3:30 PM)

### ✅ What's Working
- **Core Orchestration**: The Gaussian jitter and scheduling logic are functioning correctly.
- **Database Tracking**: Successes, skips, and dry runs are logged accurately.
- **Persona Generation**: Gemini 2.0 Flash is generating high-quality, millennial KU/Chiefs sports-themed content.
- **Status Dashboard**: Real-time monitoring via resident status page is active.
- **Build Process**: Local builds complete successfully.

### ❌ Failures & Active Bugs
| Issue | Symptom | Frequency | Root Cause | Status |
| :--- | :--- | :--- | :--- |
| **PDF-Nabu 500 Error** | Server returns HTTP 500 on all requests | CSS import issue in layout file | **In Progress** |
| **Stealth Engine Skip** | `🛡️ Stealth engine skipped (User Active)` | Resolved | Fixed via `--ignore-user-check` bypass for manual runs and 10m threshold for automatic. |
| **Cookie Refresh Failure** | `⚠️ extraction failed (Return Code: 255)` | Resolved | Fixed via `-o IdentitiesOnly=yes` and explicit identity targeting. Replaces SSH auth failures. |
| **Harvester Runtime** | `[Error: An unknown error occurred.]` | Resolved | Fixed by switching to "Mac-Push" via LaunchAgent (`com.pitweeter.harvester`) running in GUI context. |
| **Twikit Fetch Error** | `itemContent` / `Tweet not found` | Resolved | Fixed via **Playwright Fallback**: Bot seamlessly pivots to headless browser fetch when Twikit parser fails. |
| **Cloudflare Block** | `404 Check failed` / `403 Forbidden` | Resolved | Fixed via `curl_cffi` monkey-patch (Chrome 120 TLS fingerprint) and header injection. |

### 🛠️ Current Iteration Focus
1. **PDF-Nabu 500 Error**: Systematic debugging of SvelteKit deployment failure.
2. **Stealth Sensitivity**: Differentiate between "Intentional User Usage" and "Background Noise" on Mac to reduce false-positive skips during manual runs.
3. **Resilient Extraction**: Add better retry logic or health checks to SSH cookie harvester.
4. **Manual Run Reliability**: Ensure `--reply-to` handles diverse URL formats and fetch failures gracefully.

---

## 📓 Lessons Learned & Codified Rules
- **Rule 1**: Always initialize variables (like `eligible_tweets`) outside conditional blocks to avoid `UnboundLocalError`.
- **Rule 2**: `IndentationError` in `replace_file_content` usually happens when a multi-line `if` block is replaced with an ambiguous snippet; always provide full context.
- **Rule 3**: `USER_ACTIVE` skips are the "Safe Default", but they should be bypassable for debugging or manual intervention.
- **Rule 4**: SSH `Return Code: 255` with "Too many authentication failures" requires `-o IdentitiesOnly=yes -i ~/.ssh/id_pi_to_mac` in BOTH `bot.py` and any shell scripts (like `post_stealth.py`) to prevent agent key overflow.
- **Rule 5**: Twikit v2+ uses standard Python TLS (httpx) which is blocked by Cloudflare (403/404). Always monkey-patch `httpx.AsyncClient` with `curl_cffi`'s `AsyncSession(impersonate="chrome120")` BEFORE importing Twikit.
- **Rule 6**: API Schema changes (e.g. `itemContent` missing) are inevitable. Do not rely solely on reverse-engineered clients. Implement a **Headless Browser Fallback** (Playwright) that scrapes the web frontend when the API client fails.
- **Rule 7**: **SvelteKit CSS Import Issues**: Duplicate CSS imports in layout files can cause missing stylesheets in server manifest, leading to 500 errors. Always ensure only one CSS import per layout file.

---

## 🔄 Debugging Session: PDF-Nabu 500 Error

### **Iteration 1: Reproduction**
- ✅ **Confirmed**: `curl -s https://pdf-nabu.netlify.app` returns 500
- ✅ **Not User-Agent related**: Same error with different User-Agent
- ✅ **Not path-specific**: Root and subpaths both return 500

### **Iteration 2: Build Analysis**
- ✅ **Build completes locally**: `npm run build` successful
- ✅ **CSS files generated**: Assets created in `.svelte-kit/output/`
- ❌ **Missing stylesheets**: Server manifest shows empty `stylesheets:[]`
- ❌ **Duplicate CSS imports**: Layout importing both `layout.css` and `app.css`

### **Iteration 3: Root Cause Identification**
- ✅ **Identified**: `+layout.svelte` importing `./layout.css` (only contains `@import 'tailwindcss'`)
- ✅ **Problem**: `app.css` contains all actual styles but not being processed
- ✅ **Solution**: Remove duplicate import, keep only `app.css`

### **Iteration 4: Fix Implementation**
- ✅ **Applied**: Removed `import './layout.css'` from `+layout.svelte`
- ✅ **Result**: Build successful, CSS files properly generated
- ❌ **Still 500 error**: Issue persists after deployment

### **Next Steps Required**
1. **Wait for Netlify deployment** (2-3 minutes)
2. **Test production site** again
3. **If still 500**: Check Netlify deployment logs
4. **Alternative approaches**: Examine server-side rendering, check for runtime errors
