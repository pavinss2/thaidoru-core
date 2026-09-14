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

## ✏️ Manual Editing Workflow (Phase 1)

1. **Add or Edit a Member**:
   - Open `src/data/members.json` and add/edit the member profile.
2. **Assign Member to a Group with Color**:
   - Open `src/data/memberships.json` and create the junction record linking `group_id` and `member_id` with their `color` and `status`.
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

---

## 🔌 API Endpoints (Edge CDN)

Once deployed to GitHub Pages or Cloudflare:

* `GET /v1/companies.json`: List of all entertainment companies / agencies
* `GET /v1/groups.json`: List of all idol groups
* `GET /v1/members.json`: List of canonical idol member entities
* `GET /v1/memberships.json`: Group-member memberships with colors and statuses
* `GET /v1/all.json`: Denormalized single bundle with nested relations
* `GET /v1/export/cheki-tracker.json`: Direct drop-in format for Cheki Tracker Back Office (`dim_company`, `dim_group`, `dim_member`)
