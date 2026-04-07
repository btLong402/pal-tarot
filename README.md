# Pal Tarot

Ung dung trai bai Tarot viet bang Next.js App Router, co API doc bai bang Gemini.

## Chay local

1. Cai dependencies:

```bash
npm install
```

2. Tao file env tu mau:

```bash
cp .env.example .env.local
```

3. Dien gia tri that cho bien sau trong .env.local:

```env
GEMINI_API_KEY=your_real_api_key
```

4. Chay app:

```bash
npm run dev
```

## Kiem tra truoc khi deploy

```bash
npm run lint
npm run build
```

## Deploy len Vercel

1. Push code len GitHub, GitLab hoac Bitbucket.
2. Vao Vercel va Import project repository.
3. Framework Preset: Next.js.
4. Build Command: npm run build.
5. Output Directory: de mac dinh cua Next.js.
6. Them Environment Variables:
   - GEMINI_API_KEY: API key Gemini cua ban.
7. Deploy.

Sau deploy, neu doi API key thi vao Project Settings > Environment Variables tren Vercel de cap nhat va Redeploy.
