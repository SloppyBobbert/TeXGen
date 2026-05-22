<script lang="ts">
  import { IconChevronDown, IconGripVertical } from "@tabler/icons-svelte"
  import { CollisionPriority } from "@dnd-kit/abstract"
  import { createSortable } from "@dnd-kit/svelte/sortable"
  import { Badge } from "$lib/components/ui/badge"
  import { Checkbox } from "$lib/components/ui/checkbox"
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "$lib/components/ui/collapsible"
  import { cn } from "$lib/utils"
  import type { BuilderClass } from "$lib/builder/builder-state.svelte"
  import BuilderSectionRow from "$lib/builder/content/components/BuilderSectionRow.svelte"

  let {
    classItem,
    index,
    activeSectionClassId,
    isOverlay = false,
  }: {
    classItem: BuilderClass
    index: number
    activeSectionClassId?: string
    isOverlay?: boolean
  } = $props()
  let open = $state(true)

  const sortable = createSortable({
    get id() {
      return classItem.id
    },
    get index() {
      return index
    },
    type: "class",
    accept: "class",
    get disabled() {
      return isOverlay
    },
    collisionPriority: CollisionPriority.Low,
  })

  let isSourceSectionClass = $derived(activeSectionClassId === classItem.id)
</script>

<div class="relative" {@attach sortable.attach}>
  <Collapsible
    bind:open
    class={cn(
      "rounded-lg border border-border bg-background transition-colors",
      isSourceSectionClass && "border-dashed border-primary/60 bg-primary/5",
      sortable.isDragging && !isOverlay && "invisible",
      isOverlay && "shadow-lg",
    )}
  >
    <div class="flex items-center gap-2 px-2 py-2">
      <button
        type="button"
        class="cursor-grab rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:cursor-grabbing"
        aria-label={`Reorder ${classItem.title}`}
        {@attach sortable.attachHandle}
      >
        <IconGripVertical class="size-4 shrink-0" aria-hidden="true" />
      </button>
      <Checkbox
        aria-label={`Select all ${classItem.title} sections`}
        class="cursor-pointer"
        checked={classItem.checked}
        indeterminate={classItem.indeterminate}
        onCheckedChange={(value) => (classItem.checked = Boolean(value))}
      />
      <CollapsibleTrigger
        class="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        <span class="truncate text-sm font-medium">{classItem.title}</span>
        <span class="flex items-center gap-2">
          <Badge variant="ghost">{classItem.selectedCount}/{classItem.sections.length}</Badge>
          <IconChevronDown
            class={cn("size-4 text-muted-foreground transition-transform", !open && "-rotate-90")}
            aria-hidden="true"
          />
        </span>
      </CollapsibleTrigger>
    </div>

    <CollapsibleContent>
      <div class="border-t border-border px-2 py-2">
        {#each classItem.sections as section, sectionIndex (section.id)}
          <BuilderSectionRow
            {section}
            index={sectionIndex}
            classId={classItem.id}
            disabled={isOverlay}
          />
        {/each}
      </div>
    </CollapsibleContent>
  </Collapsible>

  {#if sortable.isDragging && !isOverlay}
    <div
      class="absolute inset-0 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/50"
      aria-hidden="true"
    ></div>
  {/if}
</div>
