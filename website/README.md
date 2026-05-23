# Build Profit Solutions Website

Dedicated marketing website for Build Profit Solutions.

## Development

From the repo root:

```bash
npm run website:dev
```

Or from this folder:

```bash
npm run dev
```

Open http://localhost:3000

## Environment

Copy `.env.example` to `.env.local` and update:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Public marketing domain |
| `NEXT_PUBLIC_WEB_APP_URL` | Expo web app / sign-in URL |
| `NEXT_PUBLIC_IOS_APP_URL` | App Store link |
| `NEXT_PUBLIC_ANDROID_APP_URL` | Google Play link |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Support email |
| `NEXT_PUBLIC_FOUNDER_NAME` | About page founder name |

CTAs across the site use `siteLinks` in `lib/site.ts`, which reads these values.

## Deploy to Vercel + Namecheap

### 1. Push the repo to GitHub

Make sure the `website/` folder is committed.

### 2. Create a Vercel project

1. Go to [vercel.com](https://vercel.com) and import your GitHub repo
2. Set **Root Directory** to `website`
3. Framework preset: **Next.js**
4. Add environment variables from `.env.example`
5. Deploy

### 3. Add your custom domain in Vercel

In Vercel → Project → Settings → Domains:

- `buildprofitsolutions.com`
- `www.buildprofitsolutions.com`

Vercel will show the DNS records you need.

### 4. Update Namecheap DNS

In Namecheap → Domain List → Manage → Advanced DNS:

**For root domain (`buildprofitsolutions.com`):**

- Type: `A Record`
- Host: `@`
- Value: Vercel IP shown in the Vercel domain settings (commonly `76.76.21.21`)

**For www:**

- Type: `CNAME`
- Host: `www`
- Value: `cname.vercel-dns.com`

**For the web app subdomain (`app.buildprofitsolutions.com`):**

Deploy your Expo web app separately (another Vercel project or hosting provider), then add:

- Type: `CNAME`
- Host: `app`
- Value: your web app host (for example another Vercel project URL)

### 5. Set production env values

Example production values:

```env
NEXT_PUBLIC_SITE_URL=https://buildprofitsolutions.com
NEXT_PUBLIC_WEB_APP_URL=https://app.buildprofitsolutions.com
NEXT_PUBLIC_IOS_APP_URL=https://apps.apple.com/...
NEXT_PUBLIC_ANDROID_APP_URL=https://play.google.com/store/apps/...
```

Redeploy after changing env vars.

### 6. Verify after DNS propagates

- Marketing site loads at your domain
- **Home** scrolls to top on the landing page
- **Sign Up** opens the web app auth flow
- **Open Web App** opens the app subdomain
- `/privacy` and `/terms` load correctly

DNS propagation can take a few minutes to 48 hours, but often completes within an hour.

## Recommended domain setup

| Domain | Purpose |
|---|---|
| `buildprofitsolutions.com` | Marketing website |
| `www.buildprofitsolutions.com` | Redirect or alias to marketing site |
| `app.buildprofitsolutions.com` | Web app / sign-in |
