<script lang="ts">
  import { Label } from "$lib/components/ui/label"
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select"
  import { builderState, type TypographyPreset } from "$lib/builder/builder-state.svelte"

  const typographyOptions: { value: TypographyPreset; label: string }[] = [
    { value: "compact", label: "Compact" },
    { value: "standard", label: "Standard" },
    { value: "large", label: "Large" },
  ]

  let selectedLabel = $derived(
    typographyOptions.find((option) => option.value === builderState.design.typography)?.label ??
      "Standard",
  )
</script>

<section class="space-y-2">
  <Label>Typography</Label>
  <Select
    type="single"
    value={builderState.design.typography as never}
    onValueChange={(value: string) => (builderState.design.typography = value as TypographyPreset)}
  >
    <SelectTrigger class="w-full cursor-pointer">{selectedLabel}</SelectTrigger>
    <SelectContent>
      {#each typographyOptions as option (option.value)}
        <SelectItem value={option.value} class="cursor-pointer">{option.label}</SelectItem>
      {/each}
    </SelectContent>
  </Select>
</section>
