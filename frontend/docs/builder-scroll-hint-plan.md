# Builder Scroll Hint Implementation Plan

## Goal

Add a passive visual indicator to the Builder Content tab showing that more class/section content exists below the visible area. The indicator should be a translucent down-chevron pill. It must appear only when the class list can scroll further down, and it must disappear when the user reaches the bottom.

## Current Context

- The app is a Svelte 5 + SvelteKit project using Tailwind CSS and shadcn-svelte components.
- The Builder panel lives under `src/lib/builder/`.
- The page shell is already viewport-locked with `h-screen overflow-hidden`.
- The Builder panel itself should not scroll as a whole.
- The `Content` / `Design` tabs stay visible at the top of the Builder.
- In the Content tab, `Select All` / `Deselect All` are fixed above the scrollable class list.
- The scrollbar currently belongs only to the class list below the quick actions.

## Desired Behavior

- Show a small down-chevron pill at the bottom center of the scrollable class-list area when more content is below.
- Hide the chevron when the class list is scrolled to the bottom.
- Show the chevron again if the user scrolls upward and there is content below.
- Keep the chevron passive and non-interactive.
- Do not move the quick actions back into the scroll container.
- Do not make the whole page scrollable.
- Do not make the whole Builder panel scrollable.

## Chosen State Management Approach

Use local Svelte `$state` in `BuilderContentTab.svelte`.

Add local UI-only state:

```ts
let scrollContainer: HTMLDivElement | null = $state(null)
let showScrollHint = $state(false)
```

Rationale:

- The scroll hint is transient local UI state.
- It does not belong in centralized `builderState`.
- The implementation is explicit and easy to inspect.
- It avoids introducing a reusable helper before there is reuse.

## Files To Touch

Primary file:

- `src/lib/builder/content/BuilderContentTab.svelte`

No other files should be required unless verification reveals a layout issue.

## Do Not Touch

- Do not modify `builderState`.
- Do not add global CSS.
- Do not alter checkbox, select, radio, or tab behavior.
- Do not introduce a reusable scroll helper or component for this pass.
- Do not implement drag/drop.
- Do not change the mock class/section data.

## Implementation Details

### Imports

Update `BuilderContentTab.svelte` imports:

- Import `tick` from `svelte`.
- Import `IconChevronDown` from `@tabler/icons-svelte`.
- Keep existing imports for `builderState`, `ContentQuickActions`, and `BuilderClassGroup`.
- Remove `Separator` if it is no longer used.

Expected imports shape:

```svelte
<script lang="ts">
  import { tick } from "svelte"
  import { IconChevronDown } from "@tabler/icons-svelte"
  import { builderState } from "$lib/builder/builder-state.svelte"
  import ContentQuickActions from "$lib/builder/content/components/ContentQuickActions.svelte"
  import BuilderClassGroup from "$lib/builder/content/components/BuilderClassGroup.svelte"
```

### Local State

Add local UI-only state:

```ts
let scrollContainer: HTMLDivElement | null = $state(null)
let showScrollHint = $state(false)
```

### Scroll Measurement Function

Add a local function:

```ts
function updateScrollHint() {
  if (!scrollContainer) {
    showScrollHint = false
    return
  }

  const scrollBottom = scrollContainer.scrollTop + scrollContainer.clientHeight
  showScrollHint = scrollBottom < scrollContainer.scrollHeight - 1
}
```

Notes:

- The `- 1` tolerance prevents off-by-fraction issues from subpixel layout.
- Keep this function local to the component.
- Do not export it.

### Recalculate After Render

Add a minimal `$effect` to recalculate after initial render and after reactive content changes:

```ts
$effect(() => {
  builderState.content.classes.map((classItem) => [
    classItem.id,
    classItem.selectedCount,
    classItem.sections.length,
  ])

  tick().then(updateScrollHint)
})
```

Purpose:

- Initial render needs measurement after DOM exists.
- Selection changes do not usually affect height, but this keeps the hint fresh with current content state.
- Collapsing/expanding class groups is local state inside `BuilderClassGroup`, so this effect may not catch every height change. The scroll event will still update the hint when the user scrolls.

If collapse/expand changes must update immediately, use one of these minimal options:

- Add `onintroend`/`onoutroend` only if the collapsible component animates and exposes useful events.
- Add a local `ResizeObserver` in a later pass if needed.
- Do not add a `ResizeObserver` in this pass unless manual testing proves the hint gets stuck after collapsing groups.

## Markup/Layout Changes

Current shape is expected to be close to:

```svelte
<div class="flex h-full min-h-0 flex-col">
  <div class="shrink-0 border-b border-border bg-card py-3">
    <ContentQuickActions />
  </div>
  <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-4">
    {#each builderState.content.classes as classItem (classItem.id)}
      <BuilderClassGroup {classItem} />
    {/each}
  </div>
</div>
```

Change it to a fixed quick-action region plus a relative scroll-frame:

```svelte
<div class="flex h-full min-h-0 flex-col">
  <div class="shrink-0 border-b border-border bg-card py-3">
    <ContentQuickActions />
  </div>

  <div class="relative min-h-0 flex-1">
    <div
      bind:this={scrollContainer}
      onscroll={updateScrollHint}
      class="flex h-full min-h-0 flex-col gap-3 overflow-y-auto py-4 pb-12"
    >
      {#each builderState.content.classes as classItem (classItem.id)}
        <BuilderClassGroup {classItem} />
      {/each}
    </div>

    {#if showScrollHint}
      <div
        class="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-card/85 px-2 py-1 text-muted-foreground shadow-sm backdrop-blur"
        aria-hidden="true"
      >
        <IconChevronDown class="size-4" />
      </div>
    {/if}
  </div>
</div>
```

Important layout notes:

- The `relative min-h-0 flex-1` wrapper owns the overlay positioning.
- The inner div remains the actual scroll container.
- The chevron pill is outside the scroll container so it does not scroll with the list.
- Use `pb-12` on the scroll container so the final row is not covered by the pill.
- Keep `pointer-events-none` so the pill does not imply clickability.
- Use `aria-hidden="true"` because the pill is decorative.

## Svelte 5 Requirements

- Use `$state` for local reactive state.
- Use `$effect` only for DOM measurement after render.
- Use `onscroll`, not `on:scroll`.
- Keep keyed `{#each}` blocks.
- Do not use stores for this local UI state.
- Do not add selector/action helpers to `builder-state.svelte.ts`.

## Edge Cases To Check

- No overflow: chevron should not appear.
- Overflow at top: chevron should appear.
- Scroll halfway: chevron should remain visible if more content is below.
- Scroll to bottom: chevron should disappear.
- Scroll upward from bottom: chevron should reappear.
- Switch to Design tab and back: Content scroll state may remain; chevron should match the current scroll position after render.
- Use `Select All` / `Deselect All`: chevron behavior should not break.
- Collapse a large class near the bottom: if the hint becomes stale, note it as a follow-up rather than adding complex observer logic immediately.

## Verification

Run Svelte autofixer on the edited file:

```bash
bunx @sveltejs/mcp svelte-autofixer ./src/lib/builder/content/BuilderContentTab.svelte --svelte-version 5
```

Then run:

```bash
bun run check
```

Expected result:

- `svelte-check found 0 errors and 0 warnings`

Manual browser checks:

- Open the Builder Content tab.
- Confirm the browser page itself does not scroll.
- Confirm the quick actions do not scroll.
- Confirm the scrollbar starts below the quick actions.
- Confirm the translucent chevron pill appears when more content is below.
- Confirm the chevron pill disappears at the bottom of the class list.
- Confirm the chevron pill reappears after scrolling upward.

## Acceptance Criteria

- Only the class list scrolls in the Content tab.
- `Select All` / `Deselect All` remain fixed above the scrollable list.
- The chevron pill is visible only when additional content exists below the current scroll position.
- The chevron pill is hidden at the bottom.
- The chevron pill is passive and does not capture pointer events.
- No centralized state changes are introduced.
- `bun run check` passes with no errors or warnings.
