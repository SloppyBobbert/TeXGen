<script lang="ts">
  import { IconChevronDown, IconGripVertical } from "@tabler/icons-svelte"
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

  let { classItem }: { classItem: BuilderClass } = $props()
  let open = $state(true)
</script>

<Collapsible bind:open class="rounded-lg border border-border bg-background">
  <div class="flex items-center gap-2 px-2 py-2">
    <IconGripVertical class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
      {#each classItem.sections as section (section.id)}
        <BuilderSectionRow {section} />
      {/each}
    </div>
  </CollapsibleContent>
</Collapsible>
