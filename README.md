# X++ (XPlusPlus) — Official Website

The website for **X++**, the intent-driven programming language by Aagastya Verma / Atom Software
([github.com/aagastyaverma6-sys/XPP](https://github.com/aagastyaverma6-sys/XPP)).

| Page | What's on it |
|---|---|
| `index.html` | Home — hero, features, engines, benchmarks, install |
| `docs.html` | Learn — full language introduction (every snippet runs in the playground) |
| `examples.html` | Examples — copy-paste programs, outputs verified against the native VM |
| `playground.html` | Playground — a faithful JavaScript port of the ZITR VM, 100% in-browser |
| `feedback.html` | Feedback — form that emails messages straight to `aagastyaverma6@gmail.com` |

Zero build step: plain HTML/CSS/JS + one Vercel serverless function. No frameworks, no trackers,
no external fonts.

---

## Step 1 — Push this folder to GitHub

> You can rename the folder to anything (e.g. `xpp-website`) — the folder name doesn't matter,
> the repo name will.

**Option A — with git (recommended):**

```bash
cd xpp-website-deploy            # (or whatever you renamed it to)
git init
git add .
git commit -m "X++ website — initial release"
git branch -M main
git remote add origin https://github.com/<your-username>/xpp-website.git
git push -u origin main
```

(Create the empty repo first at [github.com/new](https://github.com/new) — name it `xpp-website`,
no README/license needed since both are included here.)

**Option B — no terminal:** create the empty repo on GitHub, then on the repo page use
**"uploading an existing file"** and drag in *everything inside this folder* (including the
hidden `.gitignore` — enable hidden files in your file manager), then commit.

## Step 2 — Deploy to Vercel

**Option A — dashboard (easiest):**

1. Go to [vercel.com/new](https://vercel.com/new) and import the `xpp-website` repo.
2. Framework preset: **Other** · Build command: *(none)* · Output directory: *(none)*.
   Vercel auto-detects the static site + the `api/` serverless function.
3. Click **Deploy**. Your site is live at `https://xpp-website.vercel.app` in ~30 seconds.

**Option B — CLI:**

```bash
npm i -g vercel
cd xpp-website-deploy
vercel          # preview deployment
vercel --prod   # production
```

## Step 3 — Turn on the feedback email (required for the form)

The feedback form POSTs to `/api/feedback`, which emails the message to
`aagastyaverma6@gmail.com`. Until one provider below is configured, the form gracefully
falls back to a `mailto:` link. Pick **one**:

### Provider 1 — Resend (recommended, ~3 minutes, free 100 emails/day)

1. Sign up at [resend.com](https://resend.com) **using aagastyaverma6@gmail.com**
   (the free tier can only deliver to your own account's address until you verify a domain).
2. **API Keys → Create API Key** → copy the `re_…` key.
3. In Vercel: **Project → Settings → Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | `re_…` (your key) |
   | `CONTACT_EMAIL` | `aagastyaverma6@gmail.com` *(optional — this is the default)* |
   | `FEEDBACK_FROM_EMAIL` | *(optional)* a verified sender, e.g. `feedback@yourdomain.com` |

4. **Redeploy** (Deployments → ⋯ → Redeploy) — env vars only apply to new deployments.

### Provider 2 — Gmail SMTP (no third-party service)

1. On the Google account, enable **2-Step Verification** (required for app passwords).
2. Google Account → Security → 2-Step Verification → **App passwords** → generate one for "Mail".
3. Add these in Vercel → Environment Variables:

   | Name | Value |
   |---|---|
   | `GMAIL_USER` | `aagastyaverma6@gmail.com` |
   | `GMAIL_APP_PASSWORD` | the 16-character app password (no spaces) |
   | `CONTACT_EMAIL` | `aagastyaverma6@gmail.com` |

4. **Redeploy.** (`nodemailer`, the only dependency, installs automatically from `package.json`.)

> To send feedback to a different inbox later, just change `CONTACT_EMAIL` — no code changes.

## Step 4 — Test it

```bash
curl https://your-site.vercel.app/api/feedback
# → {"ok":true,"endpoint":"feedback","configured":true,"contact":"aagastyaverma6@gmail.com",...}
```

Then submit the form once and check the inbox (and the spam folder the first time — mark it
"not spam").

---

## Run locally

Any static server works:

```bash
cd xpp-website-deploy
python3 -m http.server 8080      # → http://localhost:8080
```

To exercise the feedback API locally with env vars set:

```bash
npm install
RESEND_API_KEY=re_xxx CONTACT_EMAIL=you@example.com npx vercel dev
```

---

## The web playground

`assets/js/xpp-interpreter.js` is a dependency-free JavaScript port of the native ZITR VM
semantics (v0.4.1), including the full strict-pseudocode grammar (`fn`, `if/elif/else`,
`while`, `loop from/to/step`, `loop in`, `safe/fail`, `out`, `push … to`, `in`, `read`, …),
Python-like scoping, function hoisting, int/float distinction, `nil` propagation, the native
display format for lists/dicts, and native error messages. It is differential-tested against
the real native VM (`xppvm`): 40+ programs must produce byte-identical stdout/stderr/exit
codes on both.

Sandbox limits: 8 s runtime, ~1,500 recursion frames, in-memory `read`/`write` disk —
all stated honestly on the playground page.

## Structure

```
├── index.html            home
├── docs.html             learn / language introduction
├── examples.html         copy-paste examples
├── playground.html       in-browser X++ runner
├── feedback.html         feedback form
├── 404.html              not-found page
├── api/feedback.js       serverless email relay (Resend or Gmail SMTP)
├── assets/
│   ├── css/style.css     design system (dark + light)
│   ├── js/xpp-interpreter.js   the X++ → JS interpreter
│   ├── js/highlight.js   X++ syntax highlighter
│   ├── js/main.js        nav / theme / tabs / copy buttons
│   ├── js/playground.js  editor + runner UI
│   ├── js/feedback.js    form logic
│   └── img/              logo + favicons (from the XPP repo)
├── package.json          one dependency: nodemailer (Gmail path)
├── vercel.json           caching + security headers
├── LICENSE               GPL-3.0 (matches the X++ project)
└── README.md             this file
```

License: GPL-3.0-or-later · X++ © Aagastya Verma / Atom Software.
