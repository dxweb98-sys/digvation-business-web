# Frontend Runtime Branding and App Topology

## Purpose

Define how the Digvation POS frontend supports shared SaaS deployments, isolated or dedicated deployments, white-label branding, multiple applications, and client-specific presentation without source forks.

## Repository topology

This repository is a **multi-app monorepo**.

```text
apps/
  cashier/
  backoffice/

packages/
  api/
  auth/
  runtime/
  money/
  ui/
  testing/
```

Cashier and Backoffice are independently deployable applications. They may share deliberate packages, but they must never import each other's application internals.

A future application is added as a new `apps/<application-name>` workspace only after its product scope is approved. Adding an application must not require restructuring existing applications.

This architecture is not a single monolithic frontend application and is not a microfrontend architecture.

## Deployment and branding are independent

Deployment topology describes where the product runs:

```text
SHARED
BUSINESS_ISOLATED
DEDICATED
```

`SHARED` represents the shared/SaaS infrastructure model.

Branding mode describes whose identity is presented:

```text
DIGVATION_DEFAULT
WHITE_LABEL
```

Valid combinations include:

- SHARED + DIGVATION_DEFAULT;
- SHARED + WHITE_LABEL;
- BUSINESS_ISOLATED + WHITE_LABEL;
- DEDICATED + DIGVATION_DEFAULT;
- DEDICATED + WHITE_LABEL.

Never encode white-labeling as a deployment profile.

## Application availability

Runtime configuration contains explicit application availability.

An application may be disabled for a workspace even though its source remains in the product repository. Disabled applications must refuse to bootstrap.

For production, the stronger deployment rule is to not publish or route an application artifact that the customer is not entitled to use. Runtime disabling is defense in depth, not a substitute for deployment and authorization controls.

CI continues to build and test all product applications so disabled client deployments cannot allow unused application code to decay.

## Branding configuration

Runtime branding may configure:

- product name;
- company name;
- business name;
- logo URL;
- branding mode.

No client name, salon name, business type, or white-label identity may be hardcoded in application source.

## Theme configuration

The default Digvation presentation is light-first.

Default surfaces use white/off-white with dark navy text. Digvation identity is expressed through a controlled multi-color accent palette:

- Yellow `#F8E85D`;
- Mint `#BFE4D2`;
- Sky `#B9D8EF`;
- Lavender `#CEC4F5`;
- Coral `#F3A08B`.

Dark `#0B0D10`, Navy `#0F172A`, and Indigo `#121A2F` are anchors, not the default page background.

The accent colors are used individually and intentionally. Standard Digvation UI must not combine the palette into rainbow, spectrum, or multi-color gradients for identity bars, logo tiles, buttons, navigation, or other persistent chrome.

The runtime theme can override semantic tokens such as background, surface, text, border, brand, focus, and the five accent colors. Shape can be varied through the approved radius profile.

Theme customization changes presentation tokens without changing domain behavior, security, application ownership, or API contracts.

Arbitrary client CSS injection is prohibited. A customer that requires a genuinely different layout or workflow must use an explicitly approved presentation/experience profile rather than a client-specific source fork.

## Branch terminology

The backend/domain concept remains **Selling Location** where that term is required by the POS contract.

The operator-facing product label is **Branch** / **Cabang**.

Expected Cashier behavior when the selling-location query is integrated:

- exactly one permitted branch: select it automatically;
- more than one permitted branch: show a Branch selector/dropdown;
- changing branch clears the active navigation context after confirmation when an Active Sale exists;
- changing branch never moves an existing Sale to another branch.

The frontend must not invent branch data before the backend query is connected.
