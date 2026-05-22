<script lang="ts">
  import "./layout.css"
  import favicon from "$lib/assets/favicon.svg"
  import TopBar from "$lib/components/TopBar.svelte"
  import { ModeWatcher } from "mode-watcher"

  let { children } = $props()
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ModeWatcher />

<div class="flex h-screen flex-col overflow-hidden bg-background">
  <TopBar />
  <div class="min-h-0 flex-1 overflow-hidden">
    {@render children()}
  </div>
</div>
