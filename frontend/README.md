# Frontend

Next.js 16 (App Router) + TypeScript + Tailwind 4. See the [root README](../README.md) for the full overview, architecture and deployment steps.

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL if the API is not on 127.0.0.1:8000
npm run dev                  # http://localhost:3000
npm run lint && npm run build
```

Deploy on Vercel with the project root set to `frontend/`.
