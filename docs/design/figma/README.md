# Figma redesign workflow

How Backoffice and Operational are redesigned in Figma and then implemented with Claude Code
CLI through the Figma MCP server.

```text
@digvation/ui (code)  ──pnpm design:tokens──▶  digvation-tokens.json  ──Tokens Studio──▶  Figma variables
                                                                                           │
Figma file 1: Digvation Design System (library, published)  ◀──────────────────────────────┘
        │ uses library
        ├── Figma file 2: Digvation Backoffice
        └── Figma file 3: Digvation Operational
                │ frame link
                ▼
Claude Code CLI + Figma MCP  ──▶  apps/backoffice, apps/operational (using @digvation/ui)
```

## Contents of this folder

| File                       | What it is                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `design-system-library.md` | Spec for the **separate** Design System library file: foundations, responsive grid, components (mapped to `D*` props), patterns, templates |
| `backoffice-file.md`       | Spec for the Backoffice file: pages, sections per route, dialogs, code locations                                                           |
| `operational-file.md`      | Spec for the Operational file: selling workspace per breakpoint, dialogs, code locations                                                   |
| `digvation-tokens.json`    | Generated design tokens (colors light/dark, radius presets, spacing, type, shadow)                                                         |
| `screens/`                 | Screenshots of the current UI at mobile, tablet, (tablet landscape), and desktop                                                           |

## Step 1: Regenerate the inputs (when the code changed)

```bash
pnpm install
pnpm design:tokens     # docs/design/figma/digvation-tokens.json from @digvation/ui
pnpm design:capture    # builds both apps and captures docs/design/figma/screens/*.png
```

`design:capture` runs both apps against a mocked API (every permission and capability granted,
empty lists, sample dashboard numbers), so it needs no backend. If Playwright's browser is not
installed, either run `pnpm exec playwright install chromium` or point
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` at an existing Chromium.

## Step 2: Build the Design System library file

1. Create a Figma file named **Digvation Design System**.
2. Install the **Tokens Studio for Figma** plugin → Load from file → `digvation-tokens.json`.
3. Enable only the `global`, `light`, and `radius-soft` sets, then **Styles & Variables →
   Export styles & variables → Token Sets → Export to Figma** (options in
   `design-system-library.md`, section 01 Foundations). This creates the color, spacing,
   radius, and font variables, the shadow effect styles, and the text styles.
4. Create grids and components as listed in `design-system-library.md`.
5. **Publish** the library (Assets → Libraries → Publish).

## Step 3: Bring the current UI into the product files

1. Create **Digvation Backoffice** and **Digvation Operational**, enable the library in both.
2. Create pages and sections as listed in `backoffice-file.md` and `operational-file.md`.
3. For each screen, either place the screenshot from `screens/` as a "before" reference, or run
   the apps locally (`pnpm dev`) and import the live page with the **html.to.design** plugin for
   editable layers. Replace imported layers with library instances as you redesign.

## Step 4: Redesign

- Design every screen in the `Mobile`, `Tablet`, and `Desktop` frames (Operational also
  `Tablet Landscape`), following the responsive rules in `design-system-library.md`.
- Use only library variables, text styles, and components. Anything new goes into the library
  first (as a component or pattern), then into the product file.
- Draw the states: data, empty, loading, error, and the no-permission/no-entitlement variant.
- Mark a section **Ready for dev** in Dev Mode when it is final.

## Step 5: Connect Figma to Claude Code CLI

On the developer machine, in this repository:

```bash
claude mcp add --transport http figma https://mcp.figma.com/mcp
```

Then run `/mcp` inside Claude Code and sign in to Figma. With Figma Desktop you can instead
enable the Dev Mode MCP server in Figma's preferences and use
`claude mcp add --transport http figma-desktop http://127.0.0.1:3845/mcp`. Available tools
depend on your Figma plan and seat.

## Step 6: Generate the redesign, one section at a time

Copy the link to a frame or section (right click → Copy link to selection) and prompt Claude
Code, for example:

```text
Implement the Figma section <link> (Backoffice / Catalog / List, all breakpoints) in
apps/backoffice/src/features/catalog.
- Follow AGENTS.md and docs/design/figma/design-system-library.md.
- Use @digvation/ui components and the semantic CSS variables; no raw hex colors.
- Keep the existing data fetching, permissions, and business logic unchanged; this is a
  presentation change only.
- Implement the mobile, tablet, and desktop layouts with Tailwind breakpoints (md, lg).
- Run pnpm lint, pnpm typecheck, and the tests for this feature.
```

Work **one route or one dialog per session**, review the diff and the running app, then move to
the next. Do shared items first in this order: library patterns (shell, page header, list page),
then Backoffice routes, then Operational selling flow.
