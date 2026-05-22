<script lang="ts">
  import { Label } from "$lib/components/ui/label"
  import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group"
  import { builderState, type ColumnCount } from "$lib/builder/builder-state.svelte"

  const columnOptions: ColumnCount[] = [1, 2, 3, 4]
</script>

<section class="space-y-3">
  <Label>Columns</Label>
  <RadioGroup
    value={String(builderState.design.columns)}
    onValueChange={(value) => (builderState.design.columns = Number(value) as ColumnCount)}
    class="grid grid-cols-4 gap-2"
  >
    {#each columnOptions as columns (columns)}
      <label
        class="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-2 py-2 text-sm"
      >
        <RadioGroupItem value={String(columns)} class="cursor-pointer" />
        {columns}
      </label>
    {/each}
  </RadioGroup>
</section>
