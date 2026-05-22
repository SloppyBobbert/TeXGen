<script lang="ts">
  import { Label } from "$lib/components/ui/label"
  import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group"
  import { builderState, type Orientation } from "$lib/builder/builder-state.svelte"
</script>

<section class="space-y-3">
  <Label>Orientation</Label>
  <RadioGroup
    value={builderState.design.orientation}
    onValueChange={(value) => (builderState.design.orientation = value as Orientation)}
    class="grid grid-cols-2 gap-2"
  >
    <label
      class="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
    >
      <RadioGroupItem value="portrait" class="cursor-pointer" />
      Portrait
    </label>
    <label
      class="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
    >
      <RadioGroupItem value="landscape" class="cursor-pointer" />
      Landscape
    </label>
  </RadioGroup>
</section>
