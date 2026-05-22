<script lang="ts">
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs"
  import BuilderContentTab from "$lib/builder/content/BuilderContentTab.svelte"
  import BuilderDesignTab from "$lib/builder/design/BuilderDesignTab.svelte"
</script>

<aside
  class="flex h-full min-h-0 w-full flex-col overflow-hidden border-border bg-card text-card-foreground md:w-96 md:border-r"
>
  <Tabs value="content" class="flex min-h-0 flex-1 flex-col px-4 py-4">
    <TabsList class="sticky top-0 z-20 grid w-full grid-cols-2 bg-card">
      <TabsTrigger value="content" class="cursor-pointer">Content</TabsTrigger>
      <TabsTrigger value="design" class="cursor-pointer">Design</TabsTrigger>
    </TabsList>
    <TabsContent value="content" class="min-h-0 flex-1 overflow-hidden">
      <BuilderContentTab />
    </TabsContent>
    <TabsContent value="design" class="min-h-0 flex-1 overflow-y-auto">
      <BuilderDesignTab />
    </TabsContent>
  </Tabs>
</aside>
