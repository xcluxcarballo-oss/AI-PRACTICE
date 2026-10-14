# Personal Portfolio Website: Plan

## Goal

A single-page personal site that shows:

1. **Name** (and a one-line tagline, e.g. "Software developer in Madrid")
2. **Short bio** (2–4 sentences)
3. **Social media links** (GitHub, LinkedIn, X/Twitter, Instagram, email, etc.)

It should load fast, look good on phones and desktops, and cost nothing to host.

## Tech choices

| Decision | Choice | Why |
|---|---|---|
| Stack | Plain HTML + CSS, no framework or build step | Three pieces of content don't need React, a bundler, or `npm install`. Anyone can edit it. |
| JavaScript | None (or a few lines at most) | Nothing on the page is interactive. |
| Icons | Inline SVG | No icon-font or CDN dependency, sharp at any size, and color follows the text. |
| Fonts | System font stack | No network request, and it looks native on every device. |
| Hosting | GitHub Pages from this repo | Free, deploys on every push, custom domain is optional. |

## File layout

```
/
├── index.html      # all content: name, bio, links
├── styles.css      # layout, colors, light/dark theme
├── assets/
│   ├── avatar.jpg  # optional profile photo
│   └── favicon.svg
├── README.md       # how to edit and deploy
└── PLAN.md         # this file
```

## Page structure

```
┌──────────────────────────────┐
│         [ avatar ]           │  optional round photo
│         Your Name            │  <h1>
│   Tagline / what you do      │
│                              │
│  Short bio paragraph that    │  <p>
│  says who you are and what   │
│  you're working on.          │
│                              │
│  [GH] [in] [X] [IG] [✉]      │  icon links with labels
│                              │
│  © 2026 Your Name            │  footer
└──────────────────────────────┘
```

A centered card, narrow enough to stay readable on wide screens and stacked on mobile.

## Design and quality

- **Responsive:** one fluid layout with a 16px side gutter on phones and a max width of about 640px on desktop.
- **Light and dark mode:** colors are CSS custom properties, switched automatically with `prefers-color-scheme`.
- **Accessibility:**
  - Semantic elements (`<main>`, `<h1>`, `<nav>`, `<footer>`).
  - Each icon link gets an `aria-label` (e.g. "GitHub profile").
  - Visible keyboard focus styles.
  - WCAG AA color contrast.
- **Safe external links:** `target="_blank"` with `rel="noopener noreferrer"`.
- **SEO and sharing:**
  - `<title>` and meta description.
  - Open Graph and Twitter card tags, so links shared in chat apps show a preview.
- **Performance:** no external requests except the optional avatar, which is compressed and served at the right size.

## Implementation steps

1. **Scaffold:** create `index.html` with the semantic structure and placeholder content.
2. **Style:** write `styles.css` with color tokens, the card layout, link/icon styles, hover and focus states, and dark mode.
3. **Content:** fill in your real name, tagline, bio, and social URLs, and add your photo if you want one.
4. **Icons and favicon:** add inline SVGs for each chosen platform, plus a simple favicon (for example, your initials).
5. **Meta tags:** add title, description, and Open Graph tags.
6. **Check it:** test at phone, tablet, and desktop widths, in light and dark mode, and with keyboard-only navigation. Run Lighthouse and aim for about 100 on accessibility and performance.
7. **Deploy:** turn on GitHub Pages (Settings → Pages → deploy from branch) and confirm the live URL works.
8. **README:** write short instructions for editing content and redeploying.

## What I need from you before building

- **Name** as you want it displayed
- **Tagline** (one line), or I can draft one
- **Bio** (2–4 sentences), or a few facts about you and I'll draft it
- **Social links:** which platforms, and the URL for each
- **Photo:** yes or no (if yes, add the image to the repo or send it)
- **Style preference:** minimal black and white, or an accent color you like
- **Domain:** the default `username.github.io/repo` URL, or a custom domain you own

If you'd like to start sooner, I can build it with clearly marked placeholder content that you swap in later.
