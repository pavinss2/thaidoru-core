---
name: import-from-wiki
description: Import a Thai idol agency, its groups and members from tpop.fandom.com wiki pages into src/data (companies, groups, members, memberships). Use when asked to add an agency, group or idols from a T-Pop fandom wiki link.
---

# Import an agency / group / members from tpop.fandom.com

Goal: turn wiki pages into records in `src/data/*.json` that pass `npm test`,
then open a PR. The data is git-as-database, so every change is a PR.

## 0. Network check (do this first)

Some sandboxes block `tpop.fandom.com`, `api.fxtwitter.com` and `pbs.twimg.com`.
Test with `curl -sS -o /dev/null -w "%{http_code}" https://tpop.fandom.com/api.php`.
If it is blocked, do the fetching (steps 1-2) and the avatar build (step 6) from a
machine that can reach them, e.g. a Remote Control session on the user's computer.
Never invent data because a fetch failed.

## 1. Read the wiki

Use the MediaWiki API, it returns clean wikitext:

```
curl -s -A "thaidoru-research/1.0" \
  "https://tpop.fandom.com/api.php?action=parse&page=PAGE&prop=wikitext&format=json&redirects=1"
```

- Agency page: name, Thai/Japanese name, founded, website, SNS, list of groups.
- Group page: native name, debut date, status, official SNS, Spotify, and the
  members table (current + former, colors, join/leave dates).
- Every member page linked from the table: Thai name, birthday, personal SNS.
  Page titles often carry a group in brackets, e.g. `Punch (SUMOMO)`.

## 2. Resolve X accounts (free, no X API)

For every X handle: `curl -s -A thaidoru-core-avatar-bot https://api.fxtwitter.com/HANDLE`
and keep `user.id` (-> `profile_id`), `user.screen_name` (-> `current_handle`) and
`user.avatar_url` with `_normal` replaced by `_400x400` (-> `avatar_url`).
A 404 means the handle is dead or renamed. Search for the new handle and only use
it if its bio or name clearly matches; otherwise leave the X entry out and report it.

## 3. Map to the schema (`src/schemas/*.ts`)

- **ids**: lowercase letters, digits and `-` only. Company/group ids are slugs of
  the name (`ikinari-tell-me`, `silver-lining`). Member id = stage name slug.
- **One person = one member id.** Before creating a member, search `members.json`
  by X `profile_id` first, then handle, then stage name. Same X id = same person:
  reuse the id and only add a membership. A different person with a taken name
  gets a suffix (`punch-sumomo`, `minnie-ikinari`, `asia-castella`).
- **Membership** id is `{group_id}_{member_id}`. Role is `member` unless the wiki
  says leader. Colors need `name` + 6-char hex: convert CSS names
  (LightBlue `#add8e6`, Pink `#ffc0cb`, Red `#ff0000`, White `#ffffff`,
  Purple `#800080`, Yellow `#ffff00`, Blue `#0000ff`). No color on the wiki:
  use `{"name": "N/A", "hex": "#7f8c8d", "shade": null}`.
- **Main shade**: every color also needs `shade`, one of Red, Orange, Yellow,
  Green, Blue, Purple, Pink, Brown, White, Gray, Black (keep the wiki's fancy
  name in `name`). Easiest: leave `shade` out, run `npm run fill:shades`, and
  check its guesses (e.g. "Cream" -> Yellow, "Luce Sky Blue" -> Blue). List any
  guess you were unsure of in the PR.
- **Dates** must be `YYYY-MM-DD`. Year-only or month-only dates become `null`;
  list them in the PR as unverified.
- **Former members**: status `graduated` with `end_date` (or `withdrawn` when
  removed by the company). Add former memberships for people who are already in
  core or are being added now, so their history links up. Ask before adding
  people who are former-only.
- **Birthday**: fill `month` + `day` (+ `year` when known). Unknown birthday ->
  `"birthday": {}` (test only warns). Never fill only month or only day.
  For minors (under 18) leave `year` null.
- **Real names**: leave `real_name` as `{}`. Fan-wiki real names are often marked
  uncertain and are personal data.
- Groups need X **and** Instagram, plus `avatar_cached_path`
  `assets/avatars/group_{id}.webp`. Companies need
  `assets/avatars/company_{id}.webp`. Group `status`: `active`, `pre-debut`,
  `hiatus` or `disbanded`.
- Facebook numeric ids: `profile_id` = id, handle `profile.php?id=ID`.
  Instagram/TikTok: `profile_id: null`.
- Keep JSON formatting: 2-space indent, real Thai characters (no `\u` escapes),
  trailing newline. Append to the end of each file.

## 4. Watch for a stale wiki

Fan wikis lag. Cross-check recent news (thaich.net is reliable for Thai idols)
and the group's X. Ask the user about anything that looks out of date, such as
a graduation or a new member, and let their word override the wiki. Note
conflicts between the group page and member pages (they happen often).

## 5. Test

`npm ci` once, then `npm run fill:shades` and `npm test`. It must end with `0 failed`. Missing avatar files
for new groups/companies fail the test until step 6 runs.

## 6. Avatars

From a machine that can reach `pbs.twimg.com`:

```
npm run refresh:avatars -- --webp-only --only=<new member ids, comma separated>
npm run cache:avatars    # companies + groups; existing files are skipped
npm test
```

## 7. PR

Commit data + `assets/avatars`, push the branch, open a draft PR. In the body,
list: what was added, ids that reused an existing person, dead X handles,
null dates, missing birthdays/colors, wiki conflicts, and any minors.
