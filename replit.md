# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Personal Finance App — a full-stack web application for tracking transactions, accounts, budgets, and financial reports.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, Shadcn UI, Recharts, Wouter, React Query

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── finance-app/        # React + Vite frontend (Personal Finance App)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Features

- **Dashboard**: Total income/expenses/net cash flow, monthly line chart, spending pie chart, budget vs actual bar chart
- **Transactions**: Add, edit, delete, filter by month/category/account, CSV import
- **Accounts**: Bank and credit card accounts with calculated balances
- **Budgets**: Set monthly budgets per category, see variance vs actual spending
- **Auth**: Session-based login (demo: admin/admin)

## Database Schema

- `accounts` — id, name, type (bank|credit_card), person
- `categories` — id, name, type (income|expense)
- `subcategories` — id, name, category_id, type
- `transactions` — id, date, description, account_id, category_id, subcategory_id, amount, person, type
- `budgets` — id, category_id, subcategory_id, month (YYYY-MM), budget_amount

## Key API Routes

- `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- `/api/accounts` CRUD
- `/api/categories` CRUD
- `/api/subcategories` CRUD (filter by `category_id`)
- `/api/transactions` CRUD (filter by `month`, `category_id`, `account_id`, `type`)
- `/api/transactions/import` POST CSV
- `/api/budgets` CRUD (filter by `month`)
- `/api/dashboard/summary`, `/api/dashboard/monthly-chart`, `/api/dashboard/category-chart`, `/api/dashboard/budget-vs-actual`

## Auth

Session-based auth using `express-session`. Demo credentials: `admin` / `admin`.

## Development

- DB push: `pnpm --filter @workspace/db run push`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
- API server dev: `pnpm --filter @workspace/api-server run dev`
- Frontend dev: `pnpm --filter @workspace/finance-app run dev`
