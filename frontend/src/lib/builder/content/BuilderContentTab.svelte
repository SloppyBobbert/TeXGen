<script lang="ts">
  import { tick } from "svelte"
  import { IconChevronDown } from "@tabler/icons-svelte"
  import { builderState } from "$lib/builder/builder-state.svelte"
  import ContentQuickActions from "$lib/builder/content/components/ContentQuickActions.svelte"
  import BuilderClassGroup from "$lib/builder/content/components/BuilderClassGroup.svelte"

  let scrollContainer: HTMLDivElement | null = $state(null)
  let showScrollHint = $state(false)

  function updateScrollHint() {
    if (!scrollContainer) {
      showScrollHint = false
      return
    }

    const scrollBottom = scrollContainer.scrollTop + scrollContainer.clientHeight
    showScrollHint = scrollBottom < scrollContainer.scrollHeight - 1
  }

  $effect(() => {
    builderState.content.classes.map((classItem) => [
      classItem.id,
      classItem.selectedCount,
      classItem.sections.length,
    ])

    tick().then(updateScrollHint)
  })
</script>

<div class="flex h-full min-h-0 flex-col">
  <div class="shrink-0 border-b border-border bg-card py-3">
    <ContentQuickActions />
  </div>

  <div class="relative min-h-0 flex-1">
    <div
      bind:this={scrollContainer}
      onscroll={updateScrollHint}
      class="flex h-full min-h-0 [scrollbar-gutter:stable] flex-col gap-3 overflow-y-scroll py-4 pb-12"
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
