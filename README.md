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

| Layer          | Technology                                 |
| -------------- | ------------------------------------------ |
| Framework      | Next.js 15 (App Router, Turbopack)         |
| Language       | TypeScript                                 |
| Backend        | Convex (database, functions, file storage) |
| Authentication | Convex Auth + Google OAuth                 |
| Styling        | Tailwind CSS + shadcn/ui + Radix UI        |
| Icons          | Lucide React                               |
| Notifications  | Sonner                                     |

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

- Node.js 20+
- Access to the team's Convex project, **QuizBuilder P16** (ask Amaar for an invite to the Convex team)
- Access to the `QUIZ-TEAM-2/QuizBuilder-Team2` GitHub repository

### 1. Clone and install

```bash
git clone https://github.com/QUIZ-TEAM-2/QuizBuilder-Team2.git
cd QuizBuilder-Team2
npm install
```

### 2. Connect to Convex

```bash
npx convex dev
```

Log in, then choose the **existing** project **QuizBuilder P16**. Do not create a new project. Convex gives you your own personal dev deployment, so your test data never clashes with anyone else's, and it writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` into `.env.local` for you.

The login keys (`JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`) are set as **default environment variables** on the Convex project, so new dev deployments get them automatically and sign-in works straight away. See `.env.example` for what belongs in `.env.local`.

### 3. Run the app

```bash
# Terminal 1: Convex backend (leave running)
npx convex dev

# Terminal 2: Next.js frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional: Google sign-in and email codes

- **Google sign-in:** set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` on your Convex dev deployment, and make sure its `https://<deployment>.convex.site/api/auth/callback/google` URL is listed in the Google Cloud OAuth client.
- **Email OTP (SendGrid):** password sign-up sends a verification code through SendGrid. Set `AUTH_SENDGRID_API_KEY` (Mail Send permission) and `AUTH_SENDGRID_FROM` (a verified sender, e.g. `Display Name <verified@example.com>`) on the Convex deployment you are using.

### Generated Convex code

`convex/_generated/` is committed to git. `npx convex dev` keeps it up to date while it runs, so whenever you change files in `convex/`, commit the changes in `convex/_generated/` along with them.

## Contributing

1. Start from an up to date `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feature/short-description
   ```
   Branch types: `feature`, `fix`, `docs`, `refactor`, `test`, `others`.
2. Make your change and test it on localhost.
3. Run the checks locally: `npm run check` and `npm test`.
4. Push and open a pull request into `main` using the PR template.
5. **Wait for all checks to go green before merging.** Every PR gets:
   - **CI** (GitHub Actions): typecheck, lint and unit tests
   - **Vercel preview**: a test link with its own fresh Convex backend (sign up with a new account there; it does not share data with dev or production)
6. Get a review, then merge. Vercel deploys `main` to production automatically, including the Convex backend.

## Database Schema

| Table           | Purpose                                             |
| --------------- | --------------------------------------------------- |
| `quiz`          | Quiz metadata, ordered page/result ID arrays        |
| `pages`         | Quiz pages and onboarding pages                     |
| `results`       | Result pages                                        |
| `components`    | Individual components with position, props, actions |
| `images`        | User-uploaded image metadata + storage references   |
| `templates`     | Reusable page templates                             |
| `quizSessions`  | Play session tracking (supports anonymous users)    |
| `quizResponses` | Individual answer recordings with result mapping    |
| `quizResults`   | Calculated final results per session                |

## Deployment

Deployment is automatic; there is nothing to run by hand.

- **Production:** every merge to `main` triggers a Vercel build with the build command `npx convex deploy --cmd 'npm run build' --typecheck disable`. That pushes the Convex backend to the production deployment first, then builds and deploys the frontend.
- **Previews:** every pull request gets a Vercel preview build. It uses a Convex **preview deploy key**, so each preview runs against its own fresh Convex backend.

### Configuration

| Where                            | Variable                                                                                                                                               | Scope                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| Vercel                           | `CONVEX_DEPLOY_KEY` (production deploy key)                                                                                                            | Production only         |
| Vercel                           | `CONVEX_DEPLOY_KEY` (preview deploy key)                                                                                                               | Preview only            |
| Convex project, default env vars | `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`                                                                                                                  | Development and Preview |
| Convex production deployment     | `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SENDGRID_API_KEY`, `AUTH_SENDGRID_FROM`, `ADMIN_BOOTSTRAP_SECRET` | Production              |

Never use the production deploy key for Preview builds: Convex refuses it on purpose so a pull request can't overwrite the live backend.

## License
