# Tidewell website

A one-page, mobile-first static website for Tidewell, a remote Airbnb/VRBO co-hosting business for beach and coastal rentals.
It's plain HTML, CSS and JavaScript with no build step, so it loads fast and hosts free.

```
tidewell/
├── index.html        ← all page content (text, sections, SEO tags)
├── styles.css        ← colors, fonts, layout (palette is at the very top)
├── script.js         ← mobile menu + contact form sending
├── logo.svg          ← Tidewell wordmark (for email signatures, social profiles, etc.)
├── favicon.svg       ← browser-tab icon
├── images/
│   ├── hero-1800.jpg ← top photo, desktop (wide)
│   ├── hero-900.jpg  ← top photo, phones (tall crop)
│   ├── coast.jpg     ← "How it works" photo (tall)
│   └── og-image.jpg  ← preview image shown when the link is shared in texts/social
├── robots.txt, sitemap.xml   ← help Google find the site
└── vercel.json       ← tells Vercel "this is a plain static site"
```

---

## Before you launch: 4 things to fill in

| What | Where | How |
|---|---|---|
| **Contact form ID** | `index.html` (search for `YOUR_FORM_ID`) | Step 1 below |
| **Your domain** | `index.html`, `robots.txt`, `sitemap.xml` (search for `YOUR-DOMAIN.com`) | Step 5 below |
| **Photos** | `images/` folder | See "Swapping images" |
| **Testimonials & plan prices** | `index.html` (look for comments that say *Replace* / *Add your price*) | Edit the text in place |

Until the form ID is filled in, the form tells visitors to email you instead, so nothing breaks.

---

## Step 1: Connect the contact form (Formspree, free)

1. Go to **formspree.io** and click **Get Started**. Sign up with `rachellafave1211@gmail.com`, which is where form messages will be delivered.
2. Verify your email (check your inbox for Formspree's confirmation link).
3. Click **+ New Form**. Name it "Tidewell website" and click **Create Form**.
4. On the form page you'll see an endpoint like `https://formspree.io/f/abcdwxyz`. Copy the part after `/f/` (here `abcdwxyz`).
5. Open `tidewell/index.html`, find `YOUR_FORM_ID`, and replace it with your ID so the line reads:
   ```html
   <form class="contact-form" action="https://formspree.io/f/abcdwxyz" method="POST" novalidate>
   ```
   *Easiest way:* on GitHub, open the file, click the ✏️ pencil icon, use Ctrl/Cmd+F to find it, edit, then click **Commit changes**.
6. After the site is live, submit a test message. The first submission may ask you to confirm in Formspree, and after that messages go straight to your inbox.

> Formspree's free plan covers 50 submissions/month, which is plenty to start.

---

## Step 2: Get the code onto your `main` branch

This site was added on a branch called `claude/tidewell-website-ta0e7z` in your `app` repository on GitHub. Hosting services publish from `main`, so merge it in:

1. Go to your repository on **github.com**.
2. You'll likely see a yellow banner saying *"claude/tidewell-website-ta0e7z had recent pushes"*. Click **Compare & pull request**. If you don't see it, click **Pull requests → New pull request**, set *compare* to that branch.
3. Click **Create pull request**, then **Merge pull request → Confirm merge**.

The site lives in its own `tidewell/` folder, so your Payday app is unaffected.

---

## Step 3: Deploy for free on Vercel (recommended)

You already have a Vercel setup for Payday, so this will feel familiar. You'll create a **second, separate project** for Tidewell.

1. Go to **vercel.com** and log in (use **Continue with GitHub**).
2. Click **Add New… → Project**.
3. Find your **`app`** repository and click **Import**.
   *(If it's not listed, click "Adjust GitHub App Permissions" and give Vercel access to it.)*
4. On the configuration screen:
   - **Project Name:** `tidewell`
   - **Root Directory:** click **Edit**, choose the **`tidewell`** folder, click **Continue**. ← *This is the important one.*
   - **Framework Preset:** **Other**
   - Leave Build Command and Output Directory empty/default.
5. Click **Deploy**. In about 30 seconds you'll get a live link like `tidewell.vercel.app`. Open it on your phone and check it out!

From now on, every time you change a file on the `main` branch in GitHub, Vercel republishes the site automatically within a minute.

> **Heads-up:** your existing Payday Vercel project watches the same repo, so it will also redeploy when you edit Tidewell files. That's harmless. If you'd rather it didn't, go to Payday's project → **Settings → Git → Ignored Build Step** and enter: `git diff HEAD^ HEAD --quiet -- . ':!tidewell'`

---

## Step 4: Buy a domain (≈ $10–15/year)

Pick a name like `tidewellhosting.com` or `tidewellcohost.com`. Good places to buy:
- **Vercel itself** (Project → Settings → Domains → *Buy*): the easiest option because DNS is set up for you automatically, so you can skip most of Step 5.
- **Cloudflare Registrar**, **Porkbun**, or **Namecheap**: often cheapest. You'll add two DNS records yourself (below).

---

## Step 5: Connect your custom domain

1. In Vercel, open the **tidewell** project → **Settings → Domains**.
2. Type your domain (e.g. `tidewellhosting.com`) and click **Add**. Choose the recommended option, which adds both `tidewellhosting.com` and `www.tidewellhosting.com` and redirects one to the other.
3. If you bought the domain **through Vercel**, you're done. Skip to step 6.
4. If you bought it **elsewhere**, Vercel will show "Invalid Configuration" plus the DNS records it needs. Log in to where you bought the domain, find **DNS settings** (sometimes "Advanced DNS" or "Manage DNS"), and add exactly what Vercel shows. It's normally:

   | Type | Host / Name | Value |
   |---|---|---|
   | `A` | `@` | `76.76.21.21` |
   | `CNAME` | `www` | `cname.vercel-dns.com` |

   - Delete any existing `A` record for `@` or "parking page" records first.
   - Always copy the values **Vercel displays**, since they may differ slightly for your project.
   - On Cloudflare, set the cloud icon to **DNS only** (grey).
5. Wait. It usually takes 5–30 minutes (occasionally up to 24 hours). Vercel's Domains page turns green ✅ when it's working, and it adds the free HTTPS padlock automatically.
6. **Update the placeholder domain:** in `index.html`, `robots.txt` and `sitemap.xml`, replace every `YOUR-DOMAIN.com` with your real domain (e.g. `tidewellhosting.com`). This makes link previews show your image and helps Google. Commit the change and Vercel redeploys.
7. Test your link preview by pasting your URL into **opengraph.xyz**, or by texting it to yourself.

### Optional: tell Google about the site
Go to **search.google.com/search-console** → add your domain → verify (it gives you a TXT record to add in DNS, same place as above) → **Sitemaps** → enter `sitemap.xml` → Submit.

---

## Alternative: Netlify instead of Vercel

**Quickest possible (no GitHub):** go to **app.netlify.com/drop** and drag the `tidewell` folder onto the page. It's live instantly. (Downside: you re-drag the folder each time you make changes.)

**Connected to GitHub (auto-updates):**
1. **app.netlify.com** → **Add new site → Import an existing project → GitHub** → pick `app`.
2. Set **Base directory:** `tidewell`, **Build command:** *(leave empty)*, **Publish directory:** `tidewell` (Netlify may show it as just the folder). Click **Deploy**.
3. Custom domain: **Site configuration → Domain management → Add a domain**. At your registrar add an `A` record `@ → 75.2.60.5` and a `CNAME` `www → your-site-name.netlify.app` (again, use what Netlify displays).

---

## Swapping images

The placeholders are lightweight illustrations. To use real photos:

1. Pick a wide, bright beach photo for the top (landscape, at least 1600px wide) and a vertical one for "How it works" (portrait, ~900×1100).
   Free sources: **unsplash.com** or **pexels.com** (search "beach house", "coastal porch", "ocean shoreline"). Your own property photos are even better.
2. Shrink them first at **squoosh.app** (choose WebP or JPG, quality ~75). Aim for under 300 KB each so the site stays fast on phones.
3. Upload them to `tidewell/images/` with the **same file names** to replace the current photos: `hero-1800.jpg` (wide, ~1800px), `hero-900.jpg` (tall crop for phones, ~900×1200) and `coast.jpg` (tall, ~900×1125). On GitHub: open the folder → **Add file → Upload files**.
4. In `index.html`, update the `alt="..."` text to describe the new photos.

The current photos are free Unsplash images (Unsplash License, no credit required).

## Changing colors or fonts
All colors are at the top of `styles.css` (`--ocean-700`, `--sand-100`, etc.). Change a value once and it updates everywhere.

## Previewing locally
Just double-click `index.html` to open it in your browser. No installation needed.
