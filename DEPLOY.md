# CircuitBench – Deployment auf Cloudflare Pages (ohne Datenbank)

CircuitBench ist eine **reine Client-Anwendung**: Schaltplan-Editor, Connectivity-Resolver,
SPICE-artiger MNA-Solver, Instrumente und Grapher laufen komplett im Browser.
Deshalb braucht die App **keinen Server und keine Datenbank**.

Die frühere PostgreSQL-Anbindung (`/api/projects`, Drizzle, `pg`) wurde entfernt.
Persistenz passiert jetzt ausschließlich im Browser:

| Was | Wo | Wie |
|---|---|---|
| Autosave / Crash-Recovery | `localStorage` → `circuitbench.autosave.v1` | automatisch, debounced 800 ms |
| Benannte Projekte | `localStorage` → `circuitbench.project.<id>` | File ▸ Save / Save As |
| Projektliste ("Recent") | `localStorage` → `circuitbench.projects.v1` | File ▸ Liste |
| Austausch / Backup | `.json`-Datei | File ▸ Save Copy / Open File |
| SPICE-Export | `.cir`-Datei | File ▸ Export SPICE Netlist |
| Grafik-Export | `.svg` / `.png` / PDF-Druckdialog | File ▸ Export … |

---

## Option A – Statischer Export (empfohlen)

Kein Worker, kein Adapter, keine Runtime-Kosten. Cloudflare Pages liefert nur statische
Dateien vom CDN aus.

### Lokal bauen

```bash
npm ci
CB_STATIC_EXPORT=1 npx next build      # erzeugt ./out
npx wrangler pages deploy out --project-name circuitbench
```

`CB_STATIC_EXPORT=1` schaltet `output: "export"` in `next.config.ts` ein.
Ergebnis: `out/` enthält `index.html`, `_next/*` und `api/health`.

### Cloudflare Dashboard (Git-Integration)

1. Repo bei GitHub/GitLab pushen.
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Build-Einstellungen:
   - **Framework preset:** `Next.js (Static HTML Export)`
   - **Build command:** `CB_STATIC_EXPORT=1 npx next build`
   - **Build output directory:** `out`
   - **Environment variable:** keine nötig (auch kein `DATABASE_URL`)
4. **Save and Deploy.**

Jeder Push auf `main` triggert danach automatisch einen Deploy.

### GitHub Actions (optional)

Bereits enthalten: `.github/workflows/deploy-pages.yml`.
Benötigt zwei Repo-Secrets: `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID`
(Token-Template *Cloudflare Pages → Edit*).

---

## Option B – `@cloudflare/next-on-pages`

Nur nötig, wenn du später doch serverseitige Next-Features willst
(Dynamic Route Handlers, Middleware, ISR). Dann läuft die App als Worker am Edge.

```bash
npm i -D @cloudflare/next-on-pages wrangler
npx @cloudflare/next-on-pages@latest        # erzeugt .vercel/output/static
npx wrangler pages deploy .vercel/output/static
```

Build-Einstellungen im Dashboard:

- **Build command:** `npx @cloudflare/next-on-pages@latest`
- **Output directory:** `.vercel/output/static`

Einschränkungen: alle Route Handlers müssen `export const runtime = 'edge'`
setzen und dürfen keine Node-APIs nutzen. Für CircuitBench aktuell **nicht
erforderlich** – Option A ist einfacher und schneller.

---

## Option C – `@opennextjs/cloudflare`

Vollständiges Node-Verhalten (Node-Runtime, `next start`-Äquivalent) über
Cloudflare Workers mit Static Assets. Gewichteteste und aufwändigste Variante;
für eine clientseitige App ohne Backend unternötig.

```bash
npm i -D @opennextjs/cloudflare wrangler
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

---

## Was sich ohne Datenbank geändert hat

| Vorher | Jetzt |
|---|---|
| `POST/GET /api/projects` + Drizzle | `src/persistence/local.ts` (localStorage) |
| `GET /api/health` mit `select 1` | statisches `{"ok":true}` (`force-static`) |
| Speichern = Download | Speichern = localStorage **und** Download weiterhin möglich |
| Kein Autosave | Autosave + Crash-Recovery beim Reload |
| Kein SPICE-Export | echter `.cir`-Export inkl. Analyse-Direktive |
| SVG/PNG/PDF-Export als Stub | funktionierende Client-Exporter |

`src/db/*` und die `drizzle`/`pg`-Pakete liegen weiterhin im Repository, werden aber
**nicht mehr importiert** und sind für den Build irrelevant. Du kannst sie optional mit
`npm uninstall drizzle-orm pg @types/pg drizzle-kit dotenv` entfernen.

## Hinweise

- **Kein `next start` mit `output: "export"`** – im Static-Modus gibt es keinen
  Node-Server mehr. Die Sandbox-Preview nutzt deshalb den Standard-Build,
  Cloudflare Pages den Static-Build.
- **localStorage-Quota** (~5 MB pro Origin): Projektdateien speichern bewusst keine
  Simulations-Traces (`Float64Array`), nur Messwerte und Parameter.
- **Multi-Device-Sync** gibt es nicht – Austausch über `.json`-Dateien.
  Falls du später doch Cloud-Speicher willst, passt z. B. Cloudflare KV/D1 über
  Option B, ohne die UI ändern zu müssen.
- **Custom Domain:** Pages → Projekt → *Custom domains*.
- **SPfA/Headers:** nicht erforderlich; die App setzt keine Cookies und keine CSP.
