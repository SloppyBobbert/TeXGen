<script lang="ts">
  import { IconGripVertical } from "@tabler/icons-svelte"
  import { createSortable } from "@dnd-kit/svelte/sortable"
  import { Checkbox } from "$lib/components/ui/checkbox"
  import type { BuilderSection } from "$lib/builder/builder-state.svelte"
  import { cn } from "$lib/utils"

  let {
    section,
    index,
    classId,
    isOverlay = false,
    disabled = false,
  }: {
    section: BuilderSection
    index: number
    classId: string
    isOverlay?: boolean
    disabled?: boolean
  } = $props()

  const sortable = createSortable({
    get id() {
      return section.id
    },
    get index() {
      return index
    },
    get group() {
      return classId
    },
    type: "section",
    accept: "section",
    get data() {
      return { classId }
    },
    get disabled() {
      return disabled || isOverlay
    },
  })
</script>

<div class="relative" {@attach sortable.attach}>
  <label
    for={`section-${section.id}`}
    class={cn(
      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/60",
      sortable.isDropTarget && !isOverlay && "bg-primary/5",
      sortable.isDragging && !isOverlay && "invisible",
      isOverlay && "border border-border bg-background shadow-lg",
    )}
  >
    <button
      type="button"
      class="cursor-grab rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:cursor-grabbing"
      aria-label={`Reorder ${section.title}`}
      {@attach sortable.attachHandle}
    >
      <IconGripVertical class="size-4 shrink-0" aria-hidden="true" />
    </button>
    <Checkbox
      id={`section-${section.id}`}
      class="cursor-pointer"
      checked={section.selected}
      onCheckedChange={(value) => (section.selected = Boolean(value))}
    />
    <span class="truncate">{section.title}</span>
  </label>

  {#if sortable.isDragging && !isOverlay}
    <div
      class="absolute inset-0 rounded-md border border-dashed border-muted-foreground/40 bg-muted/50"
      aria-hidden="true"
    ></div>
  {/if}
</div>
