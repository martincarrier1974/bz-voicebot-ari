# BZ Telecom Admin

Panneau d’administration web pour gérer la logique conversationnelle d’un agent vocal BZ Telecom connecté à Deepgram.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Prisma
- SQLite

## Pages

- `/login`
- `/dashboard`
- `/prompts`
- `/contexts`
- `/flows`
- `/routes`
- `/simulator`
- `/settings`

## Fonctionnalités incluses

- Authentification admin simple par cookie
- Dashboard avec statistiques
- Gestion CRUD des prompts
- Historique simple des versions de prompts
- Gestion CRUD des contextes
- Gestion CRUD des routes d’appel
- Gestion CRUD des flows et de leurs intentions
- Simulateur de flow avec détection par mots-clés
- Paramètres globaux simples
- Données initiales BZ Telecom

## Installation

```bash
npm install
npx prisma generate
npx prisma db push
node prisma/seed.mjs
npm run dev
```

## Connexion par défaut

Les valeurs de développement se trouvent dans `.env` :

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_SESSION_SECRET=bz-admin-session-dev
```

## Scripts utiles

```bash
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:push
npm run db:seed
npm run db:reset
```

## Structure du projet

```text
bz-telecom-admin/
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.mjs
├─ src/
│  ├─ app/
│  │  ├─ actions.ts
│  │  ├─ login/page.tsx
│  │  ├─ dashboard/page.tsx
│  │  ├─ prompts/page.tsx
│  │  ├─ contexts/page.tsx
│  │  ├─ flows/page.tsx
│  │  ├─ routes/page.tsx
│  │  ├─ simulator/page.tsx
│  │  └─ settings/page.tsx
│  ├─ components/
│  │  ├─ admin-shell.tsx
│  │  └─ forms.tsx
│  ├─ lib/
│  │  ├─ auth.ts
│  │  ├─ prisma.ts
│  │  └─ simulator.ts
│  └─ proxy.ts
└─ README.md
```

## Où modifier les éléments importants

- Prompts par défaut : `prisma/seed.mjs`
- Modèles de données : `prisma/schema.prisma`
- Auth admin simple : `.env` et `src/lib/auth.ts`
- Logique de simulation : `src/lib/simulator.ts`
- Actions CRUD : `src/app/actions.ts`

## Connexion future avec le système Deepgram

Cette base est prête pour une future intégration réelle :

- chargement des prompts depuis la base
- association flow/context/prompts à un agent Deepgram
- édition dynamique sans retoucher le code source du voicebot
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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
