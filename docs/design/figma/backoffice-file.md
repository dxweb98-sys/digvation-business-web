# Figma file 2: Digvation Backoffice

Backoffice means **manage the business**. This file enables the **Digvation Design System**
library (see `design-system-library.md`) and contains only screens built from library instances.

## Setup

1. Create the file in the same Figma team/project as the library.
2. Assets panel → Libraries → enable **Digvation Design System**.
3. Set the variable modes on the page: `color = light`, `radius = soft`. Add a dark-mode copy of
   a screen only when a screen needs dark-mode review.
4. Start every screen from a library template (`Template/Backoffice/*`).

## Pages and sections

One Figma page per sidebar group, one **section** per route. Inside each section, place the
frames left to right: `Mobile`, `Tablet`, `Desktop`, then states and dialogs below.

```text
Section: Catalog  (/catalog)
├── Catalog / List / Mobile        Catalog / List / Tablet        Catalog / List / Desktop
├── Catalog / List / Empty         Catalog / List / Loading       Catalog / List / Error
└── Catalog / Item dialog / Mobile Catalog / Item dialog / Desktop Catalog / Category dialog / Desktop
```

Frame names follow `<Module> / <Screen or dialog> / <Breakpoint or state>`. Claude Code uses the
frame name to find the code location, so keep it identical to the table below.

| Figma page                    | Section (route)                                              | Code location                                                   | Dialogs and panels to design                                                               |
| ----------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `00 Cover & Flows`            | Navigation map, user flows                                   | `apps/backoffice/src/app/router/backoffice-router.tsx`          | n/a                                                                                        |
| `01 Auth`                     | Login (`/login`), password recovery, reset, activation       | `apps/backoffice/src/auth`                                      | n/a                                                                                        |
| `02 Shell`                    | Sidebar, header, branch selector, mobile navigation          | `apps/backoffice/src/app/shell`                                 | Profile dialog (`modules/identity/ui/profile-dialog.tsx`), notification panel              |
| `03 Dashboard`                | Dashboard (`/`)                                              | `apps/backoffice/src/modules/dashboard`, `components/analytics` | n/a                                                                                        |
| `04 Data Master`              | Catalog (`/catalog`)                                         | `apps/backoffice/src/features/catalog`                          | Item dialog, item detail dialog, category dialog                                           |
|                               | Promotions (`/promotions`)                                   | `apps/backoffice/src/modules/promotions`                        | Promotion dialog                                                                           |
|                               | Employees (`/employees`)                                     | `apps/backoffice/src/modules/workforce`                         | Employee editor, employee detail, positions panel, attendance panel                        |
|                               | Customers (`/customers`)                                     | `apps/backoffice/src/features/customers`                        | Customer detail                                                                            |
|                               | Membership (`/memberships`)                                  | `apps/backoffice/src/modules/membership`                        | Member detail, member import, points adjustment                                            |
| `05 Finance`                  | Financial accounts (`/financial-accounts`)                   | `apps/backoffice/src/features/financial-accounts`               | Account dialog, account detail, payment route dialog                                       |
|                               | Expenses (`/expenses`)                                       | `apps/backoffice/src/features/expenses`                         | Expense dialog, expense detail, reject dialog                                              |
| `06 Reporting`                | Transaction history (`/transactions`)                        | `apps/backoffice/src/features/transaction-history`              | Transaction detail, refund, reverse, payment correction (`packages/payment-correction-ui`) |
|                               | Reports (`/reports`)                                         | `apps/backoffice/src/features/reporting`                        | Report detail dialogs, employee performance dialog                                         |
| `07 Configuration`            | Business settings (`/business`)                              | `apps/backoffice/src/modules/organization`                      | Tabs: profile, locations, tax, numbering, loyalty, product rules                           |
|                               | Access control (`/access-control`)                           | `apps/backoffice/src/modules/identity`                          | Role editor, user editor, invitation dialog, security activity panel                       |
| `08 Activity & Notifications` | Activity (`/activity`), notifications (`/notifications`)     | `apps/backoffice/src/modules/activity`, `modules/notifications` | n/a                                                                                        |
| `09 System states`            | Unauthorized, not found, application error, connection error | `packages/system-states`                                        | n/a                                                                                        |

Reference screenshots of the current UI are in `screens/backoffice-*--{mobile,tablet,desktop}.png`.
Import them with **html.to.design** for editable layers, or place the PNG next to the new frame
as a "before" reference.

## Entitlement-aware design

Menu items and modules appear only when the account is entitled (see the root `AGENTS.md`). In
Figma:

- Design the sidebar as a component with a boolean property per module, never as a single fixed
  list.
- Show at least two shell variants: **full entitlement** and **minimal** (Dashboard, Catalog,
  Transactions only), so the layout does not depend on every menu being present.
- Optional add-ons (Promotions, Membership, Loyalty points) must have a layout that still works
  when they are absent from a screen (for example, the customer detail without a membership card).

## Responsive notes from the current UI

Found in the captured screenshots; use them as redesign input:

- **Tablet portrait (834px)** shows the full 232px sidebar, leaving about 600px for tables with
  7 or more columns. Consider a collapsible icon-only sidebar between `md` and `lg`, and table →
  card switching below `lg` for wide tables (Catalog, Transactions, Expenses).
- **Mobile lists** already wrap the filter bar, but tables still render as tables. Use the
  `List/MobileCard` pattern.
- **Dashboard** KPI labels wrap to two lines at 1440px ("Pengeluaran hari ini"); give KPI cards a
  minimum width or shorten labels.
- **Page header** (eyebrow + title + description + action) is repeated inline in every page;
  design it once as `Page/Header` so the code can converge on one component.
