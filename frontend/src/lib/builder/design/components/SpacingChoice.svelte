<script lang="ts">
  import { Label } from "$lib/components/ui/label"
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select"
  import { builderState, type SpacingPreset } from "$lib/builder/builder-state.svelte"

  const spacingOptions: { value: SpacingPreset; label: string }[] = [
    { value: "tight", label: "Tight" },
    { value: "balanced", label: "Balanced" },
    { value: "roomy", label: "Roomy" },
  ]

  let selectedLabel = $derived(
    spacingOptions.find((option) => option.value === builderState.design.spacing)?.label ??
      "Balanced",
  )
</script>

<section class="space-y-2">
  <Label>Spacing</Label>
  <Select
    type="single"
    value={builderState.design.spacing as never}
    onValueChange={(value: string) => (builderState.design.spacing = value as SpacingPreset)}
  >
    <SelectTrigger class="w-full cursor-pointer">{selectedLabel}</SelectTrigger>
    <SelectContent>
      {#each spacingOptions as option (option.value)}
        <SelectItem value={option.value} class="cursor-pointer">{option.label}</SelectItem>
      {/each}
    </SelectContent>
  </Select>
</section>
