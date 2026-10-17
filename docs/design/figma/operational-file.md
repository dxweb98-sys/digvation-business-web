# Figma file 3: Digvation Operational

Operational means **run the business now**: cashier selling, the service queue, expenses at the
counter, and customer lookup. It is used mostly on **tablets at the counter** and on phones, so
design tablet landscape first, then tablet portrait and mobile, then desktop.

This file enables the **Digvation Design System** library (see `design-system-library.md`) and
contains only screens built from library instances.

## Setup

1. Create the file in the same Figma team/project as the library.
2. Assets panel → Libraries → enable **Digvation Design System**.
3. Set the variable modes: `color = light`, `radius = soft`.
4. Start every screen from `Template/Operational/Workspace` or `Template/Operational/List`.

## Frames

| Frame              | Size       | Priority |
| ------------------ | ---------- | -------- |
| `Tablet Landscape` | 1194 × 834 | 1        |
| `Tablet`           | 834 × 1194 | 2        |
| `Mobile`           | 390 × 844  | 3        |
| `Desktop`          | 1440 × 900 | 4        |

## Pages and sections

Frame names follow `<Module> / <Screen or dialog> / <Breakpoint or state>`, the same convention
as the Backoffice file.

| Figma page             | Section (route)                                   | Code location                                                             | Dialogs, panels, and states to design                                                                                                                            |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `00 Cover & Flows`     | Selling flow, navigation map                      | `apps/operational/src/app/router/operational-router.tsx`                  | Flow: pick items → cart → customer → payment → completion → receipt                                                                                              |
| `01 Auth`              | Login                                             | `apps/operational/src/app/auth`                                           | Password change (`app/shell/operational-password-change.ts`)                                                                                                     |
| `02 Shell`             | Sidebar, header, active branch, mobile navigation | `apps/operational/src/app/shell/operational-shell.tsx`                    | Branch switcher, notifications (`features/notifications`)                                                                                                        |
| `03 Sell / Workspace`  | Sell (`/sell`)                                    | `apps/operational/src/features/sell/workspace`, `routes/sell`             | Queue bar (`queue`), catalog grid with product/service tabs and search (`catalog`), cart panel (`cart/reference-cart-panel.tsx`), floating cart button on mobile |
| `04 Sell / Customer`   | Customer on the sale                              | `apps/operational/src/features/sell/customer`                             | Customer/member dialog, walk-in customer edit dialog                                                                                                             |
| `05 Sell / Services`   | Service performers and tasks                      | `apps/operational/src/features/sell/performer`, `queue`                   | Service performers dialog, sale line task dialog                                                                                                                 |
| `06 Sell / Payment`    | Payment                                           | `apps/operational/src/features/sell/payment`                              | Payment dialog, method panel, summary panel, balance payment, payment correction, completion dialog                                                              |
| `07 Sell / After sale` | Transaction (`/sell/:saleId`)                     | `apps/operational/src/features/sell/transaction`, `adjustment`, `receipt` | Sale detail, cancel dialog, item correction, order adjustment, transaction item dialog, receipt delivery dialog                                                  |
| `08 Customers`         | Customers (`/customers`)                          | `apps/operational/src/features/customers`                                 | Customer detail, membership detail with loyalty points                                                                                                           |
| `09 Expenses`          | Expenses (`/expenses`)                            | `apps/operational/src/features/expenses`                                  | New expense form                                                                                                                                                 |
| `10 System states`     | Offline, unauthorized, not found, error           | `packages/system-states`, `operational-router.tsx`                        | Online/offline badge states in the header                                                                                                                        |

Reference screenshots of the current UI are in
`screens/operational-*--{mobile,tablet,tablet-landscape,desktop}.png`.

## Selling workspace layout per breakpoint

The workspace is the most-used screen. Design all four frames explicitly:

| Area       | Mobile                                     | Tablet portrait                              | Tablet landscape / desktop                     |
| ---------- | ------------------------------------------ | -------------------------------------------- | ---------------------------------------------- |
| Navigation | Hamburger + bottom area free for cart      | Hamburger or icon-only rail                  | Sidebar (232px md, 280px lg) or icon-only rail |
| Queue bar  | Collapsed: title + count, expands as sheet | Title + count + status chips on a second row | One row: title, count, status chips            |
| Catalog    | 2-column grid, search full width           | 3-column grid                                | 4 to 5 column grid                             |
| Cart       | Floating cart button → full-screen sheet   | Floating cart button → side sheet            | Persistent right cart panel (360 to 400px)     |
| Payment    | Full-screen sheet, sticky pay button       | Dialog `lg`                                  | Dialog `lg` or `xl`                            |

Operational rules:

- Minimum touch target 44 × 44; product/service tiles at least 120px tall.
- Money is always right-aligned with tabular numbers; never wrap an amount.
- The primary action (add to cart, pay, complete) is always visible without scrolling.
- Show the online/offline state and the active branch on every screen.

## Responsive notes from the current UI

Found in the captured screenshots; use them as redesign input:

- **Tablet portrait (834px)**: the queue bar puts the title, description, and four status
  chips in one row, so "Antrian transaksi" wraps and the description is cut off. Move the
  chips to a second row or a horizontal scroll row below `lg`.
- **Tablet portrait** still shows the full sidebar, so the catalog area is narrow. An icon-only
  rail between `md` and `lg` gives the catalog grid about 180px more.
- **Tablet landscape / desktop**: the cart is only a floating button. With this much width a
  persistent cart panel lets the cashier see the total while adding items.
- **Expenses table** header shows an untranslated "Description" column label in Indonesian
  locale.
