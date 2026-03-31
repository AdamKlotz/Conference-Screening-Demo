# Conference Demo

Standalone Vite/React frontend for conference and booth demos of the Clinical Trial Screening product.

## What It Does

- Uses fully local fake data
- Simulates cohort loading and screening progress
- Works without backend credentials or API access
- Is designed for phone portrait and landscape, but still presents well on desktop

## Local Development

```bash
cd conference-demo
npm install
npm run dev
```

## Production Build

```bash
cd conference-demo
npm install
npm run build
```

## Vercel Deployment

Create a separate Vercel project and set:

- Root Directory: `conference-demo`
- Build Command: `npm run build`
- Output Directory: `dist`

No environment variables are required for v1.
