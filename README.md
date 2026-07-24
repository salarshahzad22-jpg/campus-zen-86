# Campus Helper AI

Your all-in-one student command center — manage assignments, attendance, exams, resources, and get AI-generated study plans.

## Problem it solves

University students juggle deadlines, classes, and exam prep across scattered apps and notebooks. Campus Helper AI brings everything into one clean dashboard with an AI helper that turns any task into a concrete plan.

## Features

- 📊 **Dashboard** — upcoming deadlines, exam countdown, attendance %, and quick stats
- 📝 **Assignments** — CRUD with title, subject, due date, priority, status, description, and search
- ✅ **Attendance tracker** — log classes, monitor per-subject attendance percentage
- 🎓 **Exam planner** — schedule exams, track prep status, see days-remaining
- 📚 **Resources** — save notes, links, and file references by subject
- 🧠 **AI Study Assistant** — see below
- ⚙️ **Settings** — update profile, sign out
- 🔒 **Authentication** — email/password + Google sign-in
- 📱 **Responsive** — mobile-friendly sidebar navigation

## AI feature

The AI Study Assistant takes:
- Subject
- Deadline
- Task type (assignment / exam / project / reading / revision)
- Current progress

…and returns a concise, student-friendly plan:
- A short **goal** statement
- A **3-step action plan**
- A **daily checklist**
- Practical **revision tips**

All prompts and plans are persisted per-user so you can revisit past plans.

## Tools used

- **TanStack Start** (React 19, Vite) — full-stack framework
- **TanStack Router / Query** — routing and data fetching
- **Lovable Cloud** (Supabase under the hood) — database, auth, RLS
- **Lovable AI Gateway** (Google Gemini) — study plan generation
- **Tailwind CSS v4** + **shadcn/ui** — design system
- **Zod** — input validation

## Data model

- `profiles` — user profile
- `assignments` — title, subject, due_date, priority, status, description
- `attendance` — subject, date, status, note
- `exams` — title, subject, exam_date, prep_status, notes
- `resources` — title, type, subject, url, content
- `ai_requests` — history of AI plans

All tables are secured with Row-Level Security so each user only sees their own data.

## Setup

This app runs on **Lovable Cloud** — no separate backend setup is required. Simply:

1. Open the project in Lovable
2. The database schema, auth, and AI gateway are already provisioned
3. Click **Publish** to deploy

For local development:
```bash
bun install
bun run dev
```

## Screenshots

- Landing page: `docs/screenshot-landing.png` _(add screenshot)_
- Dashboard: `docs/screenshot-dashboard.png` _(add screenshot)_
- AI Assistant: `docs/screenshot-ai.png` _(add screenshot)_

## Live URL

🌐 _Coming soon — publish this project from the Lovable editor to generate a live URL._
