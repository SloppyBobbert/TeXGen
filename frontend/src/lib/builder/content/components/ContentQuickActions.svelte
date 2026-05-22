<script lang="ts">
  import { Button } from "$lib/components/ui/button"
  import { builderState } from "$lib/builder/builder-state.svelte"

  function selectAll() {
    for (const classItem of builderState.content.classes) {
      classItem.checked = true
    }
  }

  function deselectAll() {
    for (const classItem of builderState.content.classes) {
      classItem.checked = false
    }
  }
</script>

<div class="flex gap-2">
  <Button type="button" size="sm" class="flex-1 cursor-pointer" onclick={selectAll}
    >Select All</Button
  >
  <Button
    type="button"
    size="sm"
    variant="outline"
    class="flex-1 cursor-pointer bg-card hover:bg-muted/70 dark:bg-card dark:hover:bg-muted/50"
    onclick={deselectAll}>Deselect All</Button
  >
</div>
