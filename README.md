# ThaiDoru Core (`thaidoru-core`)

> Central, canonical, schema-validated data platform and distribution engine for Thai Underground Idols.

[![Validation](https://github.com/pavinss2/thaidoru-core/actions/workflows/deploy.yml/badge.svg)](https://github.com/pavinss2/thaidoru-core/actions)

---

## 🌟 Key Features

1. **Normalized Domain Model**: Completely separates Companies, Groups, Members, and Memberships.
2. **Contextual Member Colors**: Solves the "color per group" problem via a junction entity (`memberships`), preventing historical transaction corruption when idols move groups.
3. **Immutable Identity Tracking**: Tracks social accounts with stable platform IDs (`profile_id` like Facebook numeric page ID, X `rest_id`) to maintain identity even when handles change.
4. **Zero-Cost High-Speed Distribution**: Builds static JSON endpoints deployed to global edge CDNs (GitHub Pages / Cloudflare Pages) for $0/mo hosting and <15ms response latency.
5. **Cheki Tracker Ready**: Automatically compiles `/v1/export/cheki-tracker.json` matching `cheki-tracker-v2` Back Office schema.

---

## 📁 Repository Structure

```text
thaidoru-core/
├── src/
│   ├── schemas/              # TypeScript & Zod schema definitions
│   │   ├── company.ts        # Company schema
│   │   ├── group.ts          # Group schema
│   │   ├── member.ts         # Member schema (stage name, real name, birthday)
│   │   ├── membership.ts     # Group-Member junction schema (color, status, dates)
│   │   ├── sns.ts            # SNS channel schema (profile_id, handles, URLs)
│   │   └── index.ts
│   ├── data/                 # Source of Truth (Normalized Canonical JSON)
│   │   ├── companies.json    # Catsolute, A lot of Tone, IC45...
│   │   ├── groups.json       # Sora! Sora!, Nox:0ff, Angevil, TGG...
│   │   ├── members.json      # Ame, Yiwha, Nadear, Pim...
│   │   └── memberships.json  # Membership roles, colors & status
│   └── scripts/
│       ├── migrate.ts        # Data migration from legacy flat idols.json
│       ├── test.ts           # Automated test suite (schemas & referential integrity)
│       └── build.ts          # Compiles dist/v1 distribution artifacts
├── dist/                     # Generated API distribution (deployed to CDN)
│   └── v1/
│       ├── companies.json
│       ├── groups.json
│       ├── members.json
│       ├── memberships.json
│       ├── all.json          # Consolidated single-fetch bundle
│       └── export/
│           └── cheki-tracker.json # Drop-in adapter for Cheki Tracker Back Office
└── package.json
```

---

## 🚀 Quick Start

### Installation
```bash
npm install
```

### Validate Data
Run schema validation and referential integrity tests:
```bash
npm test
```

### Build API Endpoints
Compiles normalized data into CDN-ready endpoints inside `dist/v1/`:
```bash
npm run build
```

---

## 🖼️ Weekly X Avatar Refresh

`.github/workflows/refresh-x-avatars.yml` runs every Monday 01:00 Bangkok time (or by hand from the Actions tab).

1. For each member with an **active** membership, it checks their X `avatar_url`.
2. If the URL still loads **and** the webp was built from that exact URL (`avatar_source_url`), the member is skipped. A URL you typed in by hand doesn't match, so its webp gets rebuilt from it (no X lookup).
3. If it is dead or empty, the account is looked up again by `current_handle` using the free FxTwitter API. The result must match the stored X `profile_id`, so a recycled handle is never accepted.
4. The new `avatar_url` is saved, and `assets/avatars/{id}.webp` is regenerated.
5. The old WebP is moved to `assets/avatars/history/{id}/{date}.webp` and listed in the member's `avatar_history`. The site lets you swipe through these.
6. Idols it can't fix (usually because they changed their @handle) are listed in an open issue, **"X avatars need a manual check"**. Update their handle and the next run picks up the new avatar.

It's fully free: no X API key or secret needed.

**Build webps only (no X lookups):** the manual workflow **"Build Avatar WebPs from X URL"** makes `assets/avatars/{id}.webp` straight from each member's saved X avatar URL, for members with no webp yet. Tick `rebuild_all` to remake every webp (old ones go to history).

Run locally:
```bash
npm run refresh:avatars -- --dry-run          # report only
npm run refresh:avatars -- --only=ame,yiwha   # just these members
npm run refresh:avatars -- --webp-only        # only build missing webps from saved URLs
```

---

## ✏️ Manual Editing Workflow (Phase 1)

1. **Add or Edit a Member**:
   - Open `src/data/members.json` and add/edit the member profile.
2. **Assign Member to a Group with Color**:
   - Open `src/data/memberships.json` and create the junction record linking `group_id` and `member_id` with their `color` and `status`. Leave `color.shade` out and run `npm run fill:shades` to fill the main shade (e.g. "Cream" -> Yellow), then fix any wrong guess by hand.
3. **Verify and Build**:
   ```bash
   npm test
   npm run build
   ```
4. **Commit & Push**:
   ```bash
   git add .
   git commit -m "feat: update member info"
   git push origin main
   ```
   GitHub Actions will automatically validate, compile, and publish to the live CDN!

### 🔗 X link check (admin)

Signed in as admin, the site shows an **X link check** panel listing active idols whose X link is missing, whose X profile can't be reached (changed handle, suspended, or the handle now belongs to someone else), or whose X avatar URL is missing or broken. Each row has a **Fix** button that opens the edit form.

Browsers can't check x.com links themselves, so the **Weekly X Link Check** workflow (`.github/workflows/check-x-links.yml`, every Monday 02:00 Bangkok time) runs `npm run check:x-links`. It looks each handle up on the free FxTwitter API (no key needed), saves the result to `src/data/x-link-status.json`, and redeploys the site. Run it by hand from the Actions tab any time. The panel's **Check avatars now** button tests avatar URLs live in your browser.

---

## 🔌 API Endpoints (Edge CDN)

Once deployed to GitHub Pages or Cloudflare:

* `GET /v1/companies.json`: List of all entertainment companies / agencies
* `GET /v1/groups.json`: List of all idol groups
* `GET /v1/members.json`: List of canonical idol member entities
* `GET /v1/memberships.json`: Group-member memberships with colors and statuses
* `GET /v1/all.json`: Denormalized single bundle with nested relations
* `GET /v1/export/cheki-tracker.json`: Direct drop-in format for Cheki Tracker Back Office (`dim_company`, `dim_group`, `dim_member`)
