# Fresh Face Studio — Website

Astro static site for Fresh Face Studio, a boutique skincare studio in North Myrtle Beach, SC.

**Stack:** Astro (SSG) · Netlify · Zero JavaScript frameworks  
**Hosting:** Netlify (free tier)  
**Booking:** GlossGenius (embedded via link, kept as booking/payment backend)

---

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
fresh-face-studio/
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── assets/              # Images (add studio photos here)
│   ├── components/
│   │   ├── Header.astro     # Sticky nav with mobile menu
│   │   ├── Footer.astro     # Footer with local SEO links
│   │   └── ServiceCard.astro
│   ├── content/
│   │   └── blog/            # Markdown blog posts (Skin School)
│   ├── data/
│   │   └── site.ts          # ⭐ SINGLE SOURCE OF TRUTH for all business data
│   ├── layouts/
│   │   ├── BaseLayout.astro  # SEO infrastructure, structured data, meta
│   │   └── BlogPost.astro    # Blog post template with article schema
│   ├── pages/
│   │   ├── index.astro       # Homepage
│   │   ├── services.astro    # Full service listing
│   │   ├── about.astro       # Brand story / bungalow
│   │   ├── contact.astro     # Location, hours, map
│   │   ├── 404.astro         # Custom 404
│   │   └── blog/
│   │       └── index.astro   # Blog listing page
│   └── styles/
│       └── global.css        # Design system & brand tokens
├── astro.config.mjs
├── netlify.toml              # Netlify build + redirect config
├── package.json
└── tsconfig.json
```

## Key Architecture Decisions

### `src/data/site.ts` — The One File That Matters
All business info lives here: name, address, phone, hours, services, pricing, categories.
When Maria changes her hours or adds a service, update this one file. The entire site rebuilds from it.

### SEO Infrastructure (built into BaseLayout.astro)
- JSON-LD `BeautySalon` structured data on every page
- JSON-LD `Article` schema on blog posts
- Open Graph + Twitter Card meta on every page
- Geo meta tags for local search
- Canonical URLs
- Proper heading hierarchy throughout

### GlossGenius Integration
GlossGenius stays as the booking/payment backend. Every "Book Now" button links to the GlossGenius booking page. The `netlify.toml` includes a `/book` redirect for clean URLs. When/if they switch booking platforms, update `business.booking.url` in `site.ts`.

### Blog (Skin School)
Markdown files in `src/content/blog/`. Each post uses the `BlogPost.astro` layout which auto-generates article structured data, renders prose with styled typography, and includes a booking CTA at the bottom.

## Deployment (Netlify)

1. Push repo to GitHub
2. Connect repo to Netlify
3. Netlify auto-detects Astro — build command and publish dir are in `netlify.toml`
4. Set custom domain: `freshfacestudio.com`
5. Netlify handles SSL automatically

Every push to `main` triggers a new deploy. Branch deploys work for previewing changes.

## TODO Before Launch

- [ ] Add real studio/bungalow photos (replace all placeholder divs)
- [ ] Add Maria's headshot for About page
- [ ] Fill in social media URLs in `src/data/site.ts`
- [ ] Add business email in `src/data/site.ts`
- [ ] Purchase domain: `freshfacestudio.com`
- [ ] Set up Google Business Profile and link to new site
- [ ] Add Google Analytics 4 snippet to BaseLayout.astro `<head>`
- [ ] Install `@astrojs/sitemap` integration (`npx astro add sitemap`)
- [ ] Write first 5 blog posts targeting local search terms
- [ ] Replace favicon with actual brand mark if one exists
- [ ] Add Google Maps embed to contact page (replace placeholder)
- [ ] Set up email capture (Klaviyo or similar) — add form to homepage/blog

## Adding a Blog Post

Create a new `.md` file in `src/content/blog/`:

```markdown
---
title: "Your Post Title"
description: "Meta description for search engines (keep under 160 chars)"
pubDate: 2026-04-15
author: "Fresh Face Studio"
tags: ["skincare", "facials"]
---

Your content here. Use standard markdown.
```

Then add a link to it from the blog index page (`src/pages/blog/index.astro`).

## Adding a New Service

Add an entry to the `services` array in `src/data/site.ts`. It will automatically appear on the services page. Set `featured: true` to show it on the homepage.

## Design Tokens

All brand colors, fonts, spacing, and component styles live in `src/styles/global.css` as CSS custom properties. The palette:

- **Cream/Sand/Warm White** — backgrounds
- **Sage green** — brand accent, trust, nature
- **Terracotta** — CTA color, warmth, action
- **Charcoal** — text, footer
- **Lora** — serif headings (editorial, warm)
- **Nunito Sans** — body text (clean, friendly)
