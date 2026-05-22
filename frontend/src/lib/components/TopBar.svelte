<script lang="ts">
  import { Button } from "$lib/components/ui/button"
  import logo from "$lib/assets/logo.svg"
  import IconMoon from "@tabler/icons-svelte/icons/moon"
  import IconSun from "@tabler/icons-svelte/icons/sun"
  import { toggleMode } from "mode-watcher"
</script>

<header class="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
  <div class="flex items-center gap-2">
    <img src={logo} alt="" class="size-10 text-primary" />
    <span class="text-lg font-semibold tracking-tight">TeXGen</span>
  </div>

  <Button onclick={toggleMode} variant="outline" size="icon" aria-label="Toggle dark mode">
    <IconSun class="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
    <IconMoon
      class="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
    />
    <span class="sr-only">Toggle dark mode</span>
  </Button>
</header>
