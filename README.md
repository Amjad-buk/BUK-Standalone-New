# BUK — Independent Edition

A standalone React/Vite + Express + PostgreSQL edition prepared from the uploaded Base44 source export. The browser application no longer imports the Base44 SDK or Base44 Vite plugin. The `src/api/base44Client.js` module keeps the existing page code working through a first-party BUK REST compatibility API.

## Requirements

- Node.js 20.19 or newer (Node 22/24 recommended)
- npm 10 or newer
- PostgreSQL 14 or newer
- A persistent writable directory for uploaded files in production

## Local setup (Windows)

1. Create a PostgreSQL database dedicated to this BUK edition. Do not point it at a production Base44 database or another BUK environment.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL` to the new PostgreSQL connection string and set `JWT_SECRET` to a random value of at least 32 characters.
4. Open PowerShell in this folder and run `npm install`, then `npm run check`, `npm run audit`, and `npm run build`.
5. Start the API server with `npm start` and leave that terminal open.
6. For local development, open a second PowerShell window and run `npm run dev`; the Vite proxy forwards `/api` requests to port 10000. Open the URL Vite prints. For a production-style local test, open `http://localhost:10000`.

The Windows helper `START-BUK-WINDOWS.bat` installs packages (when missing), builds the frontend if necessary, and starts the production server. It expects `.env` to exist first.

## Environment variables

Required:

- `DATABASE_URL`: a dedicated PostgreSQL connection string
- `JWT_SECRET`: random secret, minimum 32 characters

Recommended in production:

- `DATABASE_SSL=true`
- `PUBLIC_APP_URL=https://your-buk-host.example`
- `FRONTEND_ORIGINS=https://your-buk-host.example`
- `STORAGE_DIR=/var/data/buk-uploads` (attach a persistent Render disk at this path)
- `MAX_UPLOAD_MB=80`

Optional integrations:

- `OPENAI_API_KEY` and `OPENAI_MODEL`: BUK AI, translation, and voice transcription. My Buki can create a scheduled reminder from a clearly timed request when the AI key is configured.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SENDER_ID`: SMS invitations.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`: password-reset emails.

The browser uses same-origin `/api` paths by default. For a separately hosted frontend, set `VITE_API_BASE_URL` at build time and configure `FRONTEND_ORIGINS` on the API server.

## Render deployment (new resources only)

Create a new Render Web Service for this project and a new PostgreSQL database in the same or nearby region. Do not change the existing `buk-new-app-live` service or its database for this edition.

- Runtime: Node
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Attach a persistent disk and set `STORAGE_DIR` to its mount path.
- Configure `DATABASE_URL`, `DATABASE_SSL`, `JWT_SECRET`, `PUBLIC_APP_URL`, and `FRONTEND_ORIGINS`.
- Add optional provider credentials only when those features are to be enabled.

The backend creates its own `buk_standalone_*` tables on first connection. Use an empty, dedicated database. Do not reuse a database containing unrelated or production BUK data.

## Included independent services

- Email/password and phone/password account registration and login using independent accounts and JWT sessions.
- PostgreSQL JSON entity compatibility for profiles, conversations, messages, calls, contacts, stories, notifications, reminders, notes, live channels, and meeting records.
- File uploads, public file URLs, and owner-bound signed private file URLs.
- Meeting room state, participant synchronization, chat, and WebRTC signaling API.
- BUK AI chat, translation and transcription through OpenAI when configured.
- My Buki reminder extraction when the request contains a clear future time and OpenAI is configured.
- SMS invitations through Twilio and password recovery through SMTP when configured.

The existing direct-call WebRTC client code is retained. Reliable calls across restrictive mobile networks still depend on working STUN/TURN configuration. Browser speech synthesis is used for spoken output when a suitable device voice is installed.

## Important migration notes

- The uploaded ZIP contains application source and entity definitions, not Base44 live database rows. No existing user accounts, conversations, message history, uploaded media, or secrets were migrated.
- New users must register in this standalone database. Importing live Base44 records requires a separate authorized export/import with ID mapping and validation.
- Google OAuth is not enabled in this edition; the UI displays a clear configuration message rather than sending users to Base44.
- Browser-based reminder alerts work while the BUK app is open. Background/push reminder delivery requires VAPID push subscription configuration before production use.
- The Base44 entity definitions are retained under `migration-reference/` for mapping only; they are not runtime dependencies.

## Validation status

- `npm run check`: Node syntax checks for the independent API and browser API adapter.
- `npm run audit`: local import resolution and Base44 SDK dependency audit.
- `npm run build`: must be run in an internet-connected environment after `npm install`. In the isolated build environment used to prepare this package, the npm registry could not be resolved, so a full Vite build and browser smoke test were not completed here.
- No new production Render service was published by this package-preparation run. The old Render URL is not a deployment of this source edition.

## Security

Never upload or commit `.env`, `.env.local`, API keys, database passwords, Twilio tokens, SMTP passwords, or JWT secrets. `.env.example` is a placeholder template only.
