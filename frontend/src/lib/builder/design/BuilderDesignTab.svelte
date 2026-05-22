<script lang="ts">
  import { Separator } from "$lib/components/ui/separator"
  import OrientationChoice from "$lib/builder/design/components/OrientationChoice.svelte"
  import ColumnChoice from "$lib/builder/design/components/ColumnChoice.svelte"
  import TypographyChoice from "$lib/builder/design/components/TypographyChoice.svelte"
  import SpacingChoice from "$lib/builder/design/components/SpacingChoice.svelte"
</script>

<div class="flex flex-col gap-5 pt-2">
  <OrientationChoice />
  <Separator />
  <ColumnChoice />
  <Separator />
  <TypographyChoice />
  <SpacingChoice />
</div>
