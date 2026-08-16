# @just-do-it/ui

Focused React primitives and semantic tokens shared by Just Do It applications.

## Design direction

The package translates the supplied color-system reference into an accessible
product palette:

- **Light:** Botanical Noir surfaces: linen, charcoal, moss, and lilac.
- **Dark:** Midnight Orchid surfaces: void black, graphite, emerald, and orchid.
- **Typography:** Sora for headings and Manrope for interface/body text.
- **Meaning:** green is primary/success, purple is an accent action, and yellow
  is reserved for warnings and time-sensitive attention.

## Current primitives

- `Button`: `primary`, `secondary`, `accent`, `warning`, `ghost`
- `Card`: `default`, `elevated`, `accent`, `subtle`
- `Badge`: `neutral`, `accent`, `success`, `warning`
- `Input`

Layout and domain components remain local to each application until a stable
cross-application need emerges.
