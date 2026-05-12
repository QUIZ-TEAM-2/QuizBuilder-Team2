# VisionVerse

Create, share, and explore personality quizzes with a visual drag-and-drop editor and real-time mobile preview.

## Features

- **Visual Quiz Editor** — drag-and-drop components (text, images, shapes) onto a live mobile phone preview with percentage-based positioning, resizing, grouping, and z-index control
- **Multi-Page Quizzes** — onboarding screen, multiple question pages, and result pages with reorderable navigation
- **Result Mapping** — map answer choices to result pages with weighted scoring; highest score determines the outcome
- **Public Quiz Player** — shareable `/play/:id` links that work without login, with session tracking and result calculation
- **Template System** — save and apply reusable page templates across quizzes
- **Image Management** — upload and manage images via Convex file storage
- **Real-Time Sync** — all data synced instantly across clients via Convex
- **Google OAuth** — sign in with Google; quiz creation is authenticated, quiz playing is public

## Tech Stack

| Layer          | Technology                              |
| -------------- | --------------------------------------- |
| Framework      | Next.js 15 (App Router, Turbopack)      |
| Language       | TypeScript                              |
| Backend        | Convex (database, functions, file storage) |
| Authentication | Convex Auth + Google OAuth              |
| Styling        | Tailwind CSS + shadcn/ui + Radix UI     |
| Icons          | Lucide React                            |
| Notifications  | Sonner                                  |

## Project Structure

```
quizbuilder/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Login / redirect
│   │   ├── layout.tsx                  # Root layout, Convex provider
│   │   ├── quiz/
│   │   │   ├── page.tsx                # Quiz dashboard (list, create, delete)
│   │   │   ├── [uuid]/
│   │   │   │   ├── page.tsx            # Quiz editor (tabs: onboarding, pages, results, mapping)
│   │   │   │   ├── QuizPagesTab.tsx
│   │   │   │   ├── ResultPagesTab.tsx
│   │   │   │   ├── ResultMappingTab.tsx
│   │   │   │   └── components/         # OnboardingTab, PreviewPanel, TemplatePickerDialog
│   │   │   └── layout.tsx              # Auth guard
│   │   ├── play/[uuid]/page.tsx        # Public quiz player
│   │   └── template/
│   │       ├── page.tsx                # Template list
│   │       └── [id]/page.tsx           # Template editor
│   ├── components/
│   │   ├── auth/                       # ConvexSignIn, ConvexUserButton
│   │   ├── editor/                     # PhonePreview, ComponentToolbar, ComponentDock, etc.
│   │   ├── quiz/                       # ImagePickerDialog, quiz-specific UI
│   │   ├── providers/                  # Convex client provider
│   │   └── ui/                         # shadcn/ui components
│   ├── hooks/
│   │   ├── useEditingComponent.ts      # Local component editing state with optimistic updates
│   │   └── usePageEditor.ts            # Full page editor logic (clipboard, z-index, keyboard shortcuts)
│   ├── types/index.ts                  # Shared TypeScript types
│   └── lib/                            # Utilities
├── convex/
│   ├── schema.ts                       # Database schema
│   ├── schemas.ts                      # Convex value validators
│   ├── quiz.ts                         # Quiz/page/result/component CRUD + merge/unmerge
│   ├── quizPlay.ts                     # Public quiz session, responses, result calculation
│   ├── templates.ts                    # Template CRUD
│   ├── images.ts                       # Image upload and management
│   ├── auth.ts                         # Auth configuration
│   └── http.ts                         # HTTP routes for auth callbacks
└── public/                             # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Google OAuth client (from [Google Cloud Console](https://console.cloud.google.com))

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Convex

```bash
npx convex dev
```

This creates a Convex project, generates your deployment URL, and starts the dev backend.

### 3. Configure Environment Variables

Create `.env.local`:

```bash
CONVEX_DEPLOYMENT=dev:<your-deployment-slug>
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment-slug>.convex.cloud

AUTH_GOOGLE_ID=<your-google-client-id>
AUTH_GOOGLE_SECRET=<your-google-client-secret>
```

Also add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in the [Convex Dashboard](https://dashboard.convex.dev) under your project's environment variables.

### Email OTP (SendGrid) configuration

Password sign-up / sign-in uses SendGrid to send a one-time verification code.

In the Convex Dashboard (per deployment), set:

- `AUTH_SENDGRID_API_KEY`: SendGrid API key with Mail Send permission.
- `AUTH_SENDGRID_FROM`: Verified sender identity in SendGrid, e.g. `Display Name <verified@example.com>`.

SendGrid setup (dev):

1. In SendGrid, complete **Single Sender Verification** (or authenticate a domain).
2. Create an **API Key** (Mail Send access).
3. Add the env vars above to the Convex deployment you're using for dev.

### 4. Run the Dev Server

```bash
# Terminal 1 — Convex backend
npm run convex:dev

# Terminal 2 — Next.js frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev              # Start Next.js dev server (Turbopack)
npm run build            # Production build
npm run start            # Start production server
npm run preview          # Build + start
npm run convex:dev       # Start Convex dev backend
npm run convex:deploy    # Deploy Convex to production
npm run lint             # ESLint
npm run lint:fix         # ESLint with auto-fix
npm run typecheck        # TypeScript type check
npm run check            # Lint + typecheck
npm run format:write     # Prettier format
npm run format:check     # Prettier check
```

## Database Schema

| Table            | Purpose                                          |
| ---------------- | ------------------------------------------------ |
| `quiz`           | Quiz metadata, ordered page/result ID arrays     |
| `pages`          | Quiz pages and onboarding pages                  |
| `results`        | Result pages                                     |
| `components`     | Individual components with position, props, actions |
| `images`         | User-uploaded image metadata + storage references |
| `templates`      | Reusable page templates                          |
| `quizSessions`   | Play session tracking (supports anonymous users) |
| `quizResponses`  | Individual answer recordings with result mapping |
| `quizResults`    | Calculated final results per session             |

## Deployment

### Backend

```bash
npm run convex:deploy
```

### Frontend (Vercel)

```bash
npx vercel
```

Set these environment variables in Vercel:

```
NEXT_PUBLIC_CONVEX_URL=https://<your-prod-deployment>.convex.cloud
CONVEX_DEPLOYMENT=prod:<your-prod-deployment>
```

Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in the Convex production environment.

## License


