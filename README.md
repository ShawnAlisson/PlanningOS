![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## What This MVP Uses

- User-entered project details and uploaded files.
- MongoDB when `MONGODB_URI` is set, with a local JSON fallback for hackathon demo mode.
- Blob-style file storage under `data/blobs` for uploaded files.
- UK planning guidance references baked into the scoring and review copy.

## Main Endpoints

- `POST /api/applications/upload`
- `GET /api/applications/:id`
- `POST /api/applications/:id/run-agents`
- `GET /api/applications/:id/results`
- `GET /api/applications/:id/audit`
- `POST /api/agent/chat`

## Fetch.ai Bridge

See [FETCHAI.md](FETCHAI.md) for the Agentverse/ASI:One-facing bridge, payloads, and demo flow.

## How To Test It

1. Start the app with `npm run dev`.
2. Open the home page and try one of the demo scenarios.
3. Submit a new application from `/upload`.
4. Watch the processing page, then open the review page.
5. Run `npm run lint` before you hand it to judges.

For a production version, connect the app to live UK datasets such as council constraint maps, the Environment Agency flood layer, and any sponsor feeds you want to display.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This build uses a local/system font stack so it can compile offline inside the hackathon environment.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
