# Deploy BlueysCast → rslgp.github.io/bluey

## Prerequisites
- Git installed
- GitHub account: rslgp
- Repository named **bluey** on GitHub (github.com/rslgp/bluey)

---

## Step 1 — Create the GitHub repo

1. Go to https://github.com/new
2. Repository name: `bluey`
3. Set to **Public**
4. Click **Create repository**

---

## Step 2 — Push the code

In this folder (`streamcast/`), run:

```bash
git init                         # skip if already a git repo
git remote add origin https://github.com/rslgp/bluey.git
git add .
git commit -m "initial commit"
git branch -M main
git push -u origin main
```

---

## Step 3 — Enable GitHub Pages

1. Go to **github.com/rslgp/bluey → Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Click **Save**

The workflow at `.github/workflows/deploy-pages.yml` will run automatically on every push.
It deploys the `public/` folder to GitHub Pages.

---

## Step 4 — Add Firebase authorized domain

1. Go to **Firebase Console → Authentication → Settings → Authorized domains**
2. Click **Add domain**
3. Enter: `rslgp.github.io`
4. Save

Without this, Google login and email login will be blocked.

---

## Step 5 — Verify the deploy

1. Go to **github.com/rslgp/bluey → Actions**
2. Watch the **Deploy to GitHub Pages** workflow run
3. When it finishes (green checkmark), open: **https://rslgp.github.io/bluey**

---

## Step 6 — (Optional) Update PIX microservice URL

The payment backend is already running at `http://164.152.250.62:3004` (set in `public/js/app.js`).
If you move it, update `PIX_API_BASE` in `public/js/app.js` and push again.

Make sure the PIX server allows CORS from `https://rslgp.github.io`.
In `streamcast-pix/server.js`, set `ALLOWED_ORIGIN=https://rslgp.github.io` (or `*` for testing).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Page shows 404 | Wait 1-2 min after first deploy, then hard-refresh |
| Login fails "auth/unauthorized-domain" | Add `rslgp.github.io` to Firebase authorized domains (Step 4) |
| CSS/JS not loading | Check browser console — `<base href="/bluey/">` must be in index.html |
| Videos don't play | archive.org URLs are public — check network tab for the actual error |
| PIX QR not showing | Check `PIX_API_BASE` in app.js points to a running server with CORS allowed |
