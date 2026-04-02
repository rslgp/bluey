# Deploy BlueysCast → rslgp.github.io/bluey

Uses the `gh-pages` npm package — pushes the `public/` folder to a `gh-pages` branch.

## Prerequisites
- Git installed and configured
- GitHub account: rslgp
- Repository named **bluey** on GitHub (github.com/rslgp/bluey)

---

## Step 1 — Create the GitHub repo

1. Go to https://github.com/new
2. Repository name: `bluey`
3. Set to **Public**
4. Click **Create repository**

---

## Step 2 — Connect local repo to GitHub

```bash
git init                          # skip if already a git repo
git remote add origin https://github.com/rslgp/bluey.git
git add .
git commit -m "initial commit"
git branch -M main
git push -u origin main
```

---

## Step 3 — Install gh-pages and deploy

```bash
npm install
npm run deploy
```

This pushes the `public/` folder to the `gh-pages` branch on GitHub.

---

## Step 4 — Enable GitHub Pages from gh-pages branch

1. Go to **github.com/rslgp/bluey → Settings → Pages**
2. Under **Source**, select **Deploy from a branch**
3. Branch: `gh-pages` / folder: `/ (root)`
4. Click **Save**

After ~1 minute, the site is live at **https://rslgp.github.io/bluey**

---

## Step 5 — Add Firebase authorized domain

1. Go to **Firebase Console → Authentication → Settings → Authorized domains**
2. Click **Add domain** → enter `rslgp.github.io`
3. Save

Without this, login (email and Google) will be blocked.

---

## Deploying updates

Every time you change files in `public/`, just run:

```bash
npm run deploy
```

No need to commit first — `gh-pages` pushes directly to the `gh-pages` branch.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Page shows 404 | Wait 1-2 min after first deploy, then hard-refresh |
| Login fails "auth/unauthorized-domain" | Add `rslgp.github.io` to Firebase authorized domains (Step 5) |
| CSS/JS not loading | Check browser console — `<base href="/bluey/">` must be in index.html |
| Videos don't play | archive.org URLs are public — check network tab for the error |
| PIX QR not showing | Check `PIX_API_BASE` in `public/js/app.js` points to a running server with CORS allowed |
