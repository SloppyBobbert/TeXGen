<script lang="ts">
  import { IconGripVertical } from "@tabler/icons-svelte"
  import { Checkbox } from "$lib/components/ui/checkbox"
  import type { BuilderSection } from "$lib/builder/builder-state.svelte"

  let { section }: { section: BuilderSection } = $props()
</script>

<label
  class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
>
  <IconGripVertical class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
  <Checkbox
    class="cursor-pointer"
    checked={section.selected}
    onCheckedChange={(value) => (section.selected = Boolean(value))}
  />
  <span class="truncate">{section.title}</span>
</label>
