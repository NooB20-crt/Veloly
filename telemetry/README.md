# Veloly first-launch counter

The counter is opt-in in the app. When enabled, one random installation UUID is sent once; the Worker stores only its SHA-256 hash and first-seen date. It does not receive account names, song data, listening history, or an IP field. Turning the setting off asks the Worker to remove that installation's count. The total is installations that opted in, not people or all downloads.

The feedback form is separate from the counter consent: nothing is sent until the user submits a message. The Worker forwards only the selected category, message and app version to the Veloly Discord webhook. It never sends songs or listening history. A hash of a random local client ID is kept in D1 for at most 24 hours to enforce a one-minute cooldown.

The GitHub Pages site is static, so it cannot safely store an admin password or write protected statistics by itself. This Cloudflare Worker + D1 service provides the write endpoint and password-protected admin API. The admin page is `https://noob20-crt.github.io/Veloly/admin.html`; the page asks for the Worker URL and the admin token each time and does not save either.

## One-time Cloudflare setup

Run these commands from this folder in PowerShell or a terminal with Node.js installed:

```powershell
npx wrangler login
npx wrangler d1 create veloly-first-launch
```

Copy the `database_id` returned by Cloudflare into `wrangler.toml`, replacing `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID`. Then apply the table schema and create a strong admin secret:

```powershell
npx wrangler d1 migrations apply veloly-first-launch --remote
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put DISCORD_FEEDBACK_WEBHOOK_URL
npx wrangler deploy
```

When prompted for `ADMIN_TOKEN`, enter a long random password and keep it private. `wrangler deploy` prints the Worker URL (ending in `.workers.dev`).

Create the Discord webhook in a private channel for Veloly feedback, then paste its URL only into the `DISCORD_FEEDBACK_WEBHOOK_URL` prompt. Do not put the webhook URL in the app, a GitHub variable, or a committed file. The app sends feedback through the Worker, which keeps the webhook secret server-side. Run the D1 migrations again after updating this project so the feedback cooldown table exists.

## Connect app builds

In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables → New repository variable**. Create `VELOLY_TELEMETRY_URL` with the Worker URL, without a trailing slash. The release workflow passes it to macOS, Windows, Android, and iOS builds. Until this variable is set, the app hides the opt-in setting and sends nothing.

For a local build, create `app/.env.local` with:

```text
VITE_VELOLY_TELEMETRY_URL=https://YOUR-WORKER-URL.workers.dev
```

Then rebuild the app. `.env.local` is ignored by Git.

## View the count

Open `site/admin.html` on the published site, enter the Worker URL and `ADMIN_TOKEN`, then select **Voir le compteur**. The API requires the bearer token; the browser page is only a viewer and contains no admin secret.

The counter cannot prove that a client is an authentic Veloly build: any public endpoint can be scripted. Treat it as an approximate count of installations that opted in. Cloudflare provides and operates the Worker/D1 infrastructure; review its current service and data-retention terms before enabling the endpoint.

## Cloud accounts and email recovery

Registration requires a username, an email address, and a password. Users must confirm their email before signing in; they can then log in with either their username or email. The email is private and is never included in public profile responses. Existing accounts from before email support keep working with their username; after signing in, they can add and confirm an email in the Profile panel to enable email login and password recovery.

Password recovery sends a single-use link that expires after 30 minutes. Only its SHA-256 hash is stored in D1; using it replaces the password hash and revokes all existing sessions. Reset requests use a generic response and are rate-limited. Veloly never emails or stores a plaintext password.

The Worker uses Cloudflare Email Service. Before deploying, onboard a sending domain in the Cloudflare dashboard (Compute → Email Service → Email Sending), then create a sender address on that domain. Set the Worker sender address as a secret:

```powershell
npx wrangler secret put EMAIL_FROM
```

Enter the sender, for example `no-reply@your-domain.example`, replacing it with an address on your configured domain. The Worker binding is declared in `wrangler.toml`. On Workers Free, outbound mail is limited to verified destination addresses in your Cloudflare account; sending password reset links to arbitrary users requires Workers Paid. See [Cloudflare Email Service](https://developers.cloudflare.com/email-service/) for current plan details.

Apply all outstanding D1 migrations and deploy the Worker:

```powershell
npx wrangler d1 migrations apply veloly-first-launch --remote
npx wrangler deploy
```

Usernames are normalized to lowercase and restricted to 3–24 ASCII letters, digits, or underscores. Emails are trimmed and normalized to lowercase. Passwords are 12–128 characters. Veloly derives a salted PBKDF2-HMAC-SHA-256 hash (100,000 iterations); the password is never stored or returned. Session tokens are random, kept in app memory, hashed before storage, and expire after 30 days. Email confirmation and reset tokens are random, single-use, expire, and are only stored as hashes. Login, registration, verification, and reset requests are rate-limited. All SQL values use D1 prepared statements and `.bind()` parameters.

The app does not persist the session token between app restarts. Signed-in users can create public playlist snapshots; each share stores the playlist name and track metadata (never local file paths or audio), and anyone with the unguessable link can view the list. Apply migration `0005_shared_playlists.sql` before deploying the Worker with playlist sharing. Migration `0006_email_accounts_and_recovery.sql` adds email and recovery tables while leaving pre-existing accounts without an email until users add and verify one.
