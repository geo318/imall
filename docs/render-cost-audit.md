# Render cost audit — 2026-10-16

Keep checkout always available, as requested. Retain the existing paid web, API,
and Postgres services.

## Monthly recurring cost

| Resource | Before | After |
| --- | ---: | ---: |
| Production web, Starter 512 MB | $7.00 | $7.00 |
| Production API, Starter 512 MB | $7.00 | $7.00 |
| Unused duplicate API compute | $7.00 | $0.00 |
| Postgres Basic 256 MB + 1 GB storage | $6.30 | $6.30 |
| Duplicate API's retained 1 GB disk | $0.25 | $0.25 |
| **Approximate total** | **$27.55** | **$20.55** |

Savings: approximately **$7/month, $84/year (25%)**, excluding taxes and usage
overages. This is a full-month recurring estimate; October includes charges
already accrued before suspension. The disk is retained rather than deleted.
After suspension, Render's October projection updated from $27.55 to $23.94.

## Applied in Render

- Suspended `imall-api-8k41` (`srv-d93mmnkvikkc73akdjm0`). All five listed
  deployments had failed; its endpoint returned `502` with `x-render-routing:
  no-deploy`, and its metrics contained no runtime data. Render now shows
  "Suspended by you" and "You are not billed for suspended services."
- Verified production web uses `https://imall-api-8k41.onrender.com`, which belongs
  to the separate, working `imall-api` service (`srv-d6643dmsb7us73aru4q0`). The
  suspended service's hostname ends in `-lkmk.onrender.com`.
- Enabled **Common static files** edge caching for production web. Verified a
  repeated request for an existing hashed font changes from `MISS` to `HIT`.
  HTML and JSON are excluded from this cache profile.
- Saved build filters on both production services. Application-specific changes
  build only the relevant service; shared packages, manifests, Docker inputs,
  scripts, and configuration still trigger builds. Legal Markdown content is
  included; README/AGENTS documentation and test files are ignored.
- Disabled auto-sync on Blueprint `exs-d5v72d1r0fns73enro70`: its Resources view
  currently lists only the unused duplicate. Production service auto-deploys
  remain enabled. Reconcile Blueprint resource ownership before a manual sync
  or re-enabling auto-sync; do not create another copy of the production services.
- Confirmed the workspace already has a **$0 pipeline spend limit** on the
  Starter build tier, with 500 included minutes. At the limit, new builds stop;
  existing deployments continue serving.

## Prepared in the repository; requires deployment

- `render.yaml` records the production build filters. Blueprint auto-sync remains
  off, so these settings were also saved directly on the live production services.
- `apps/web/next.config.js` preserves the public catalog, category, shop-product,
  and image handlers' existing cache headers instead of overriding them with the
  page-level `no-cache` rule. Account, admin, checkout, and product-detail policies
  remain unchanged.
- Public fonts, invoice templates, and payment/brand logos receive one day of
  browser caching and seven days of CDN caching. These stable filenames use
  bounded caching rather than `immutable` so replacements can propagate.
- Browser FiraGO fonts use full-character-set WOFF2 instead of TTF. All three
  weights retain their original 2,519 mapped characters and glyph order. Combined
  font bytes fall from **2,418,428 to 748,128**, a **69.1% reduction**. Original TTF
  files remain available to jsPDF invoice generation.

The caching/font changes reduce transfer and origin work as traffic grows. They
do not reduce fixed instance prices. At inspection, bandwidth was 721 MB of the
included 5 GB and pipeline usage was 2 of 500 minutes, with no overage charges.
Product photos already load directly from Cloudinary, avoiding Render transfer.

## Validation

- `bun run build:web` passes, including TypeScript and all 132 generated pages.
- Production-mode local HTTP checks confirm public catalog caching at 30 seconds,
  category caching at 300 seconds, WOFF2 delivery and static cache headers, and
  unchanged account-order authentication (`401` while signed out).
- Header matcher checks preserve page/private-API revalidation and Next's hashed
  static asset policy.
- Live homepage and public product API remain available after suspension.
- YAML parses successfully; `git diff --check` passes.

To regenerate WOFF2 assets without adding an application dependency:

```sh
uv run --no-project --with 'fonttools[woff]' python - <<'PY'
from pathlib import Path
from fontTools.ttLib import TTFont

for source in Path("apps/web/public/fonts").glob("Firago-*.ttf"):
    font = TTFont(source)
    font.flavor = "woff2"
    font.save(source.with_suffix(".woff2"))
PY
```

Further fixed-cost reductions would require consolidating services or migrating
hosting/database infrastructure. Both need a separate capacity and migration
assessment. The existing services are already on their smallest paid tiers.
The retained duplicate disk is the remaining $0.25/month cleanup opportunity
after its contents are verified disposable.

References: [Render billing](https://dashboard.render.com/w/tea-d5t6stv18n1s73fb4kv0/billing),
[edge caching](https://render.com/docs/web-service-caching),
[free-service limits](https://render.com/docs/free),
[Blueprint build filters](https://render.com/docs/blueprint-spec#buildfilter).
