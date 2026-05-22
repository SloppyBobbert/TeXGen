<script lang="ts">
  import { tick } from "svelte"
  import { IconChevronDown } from "@tabler/icons-svelte"
  import type { DragOverEvent, DragStartEvent } from "@dnd-kit/abstract"
  import { arrayMove } from "@dnd-kit/helpers"
  import { DragDropProvider, DragOverlay, KeyboardSensor, PointerSensor } from "@dnd-kit/svelte"
  import { builderState } from "$lib/builder/builder-state.svelte"
  import ContentQuickActions from "$lib/builder/content/components/ContentQuickActions.svelte"
  import BuilderClassGroup from "$lib/builder/content/components/BuilderClassGroup.svelte"
  import BuilderSectionRow from "$lib/builder/content/components/BuilderSectionRow.svelte"

  type DragData = {
    classId?: string
  }

  type ActiveDrag =
    | { type: "class"; id: string }
    | { type: "section"; id: string; classId: string }
    | null

  const sensors = [KeyboardSensor, PointerSensor]

  let scrollContainer: HTMLDivElement | null = $state(null)
  let showScrollHint = $state(false)
  let activeDrag: ActiveDrag = $state(null)

  function updateScrollHint() {
    if (!scrollContainer) {
      showScrollHint = false
      return
    }

    const scrollBottom = scrollContainer.scrollTop + scrollContainer.clientHeight
    showScrollHint = scrollBottom < scrollContainer.scrollHeight - 1
  }

  $effect(() => {
    builderState.content.classes.map((classItem) => [
      classItem.id,
      builderState.content.classes.indexOf(classItem),
      classItem.selectedCount,
      classItem.sections.length,
      classItem.sections.map((section) => section.id).join(","),
    ])

    tick().then(updateScrollHint)
  })

  function getDragData(value: unknown) {
    return (value ?? {}) as DragData
  }

  function findClass(classId: string) {
    return builderState.content.classes.find((classItem) => classItem.id === classId)
  }

  function findClassBySection(sectionId: string) {
    return builderState.content.classes.find((classItem) =>
      classItem.sections.some((section) => section.id === sectionId),
    )
  }

  function handleDragStart(event: DragStartEvent) {
    const { source } = event.operation

    if (!source) {
      activeDrag = null
      return
    }

    if (source.type === "class") {
      activeDrag = { type: "class", id: String(source.id) }
      return
    }

    if (source.type === "section") {
      const data = getDragData(source.data)
      const classId = data.classId ?? findClassBySection(String(source.id))?.id

      activeDrag = classId ? { type: "section", id: String(source.id), classId } : null
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { source, target } = event.operation

    if (!source || !target) {
      return
    }

    if (source.type === "class" && target.type === "class") {
      const fromIndex = builderState.content.classes.findIndex(
        (classItem) => classItem.id === source.id,
      )
      const toIndex = builderState.content.classes.findIndex(
        (classItem) => classItem.id === target.id,
      )

      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        builderState.content.classes = arrayMove(builderState.content.classes, fromIndex, toIndex)
      }

      return
    }

    if (source.type === "section" && target.type === "section") {
      const sourceClassId = getDragData(source.data).classId
      const targetClassId = getDragData(target.data).classId

      if (!sourceClassId || sourceClassId !== targetClassId) {
        return
      }

      const classItem = findClass(sourceClassId)

      if (!classItem) {
        return
      }

      const fromIndex = classItem.sections.findIndex((section) => section.id === source.id)
      const toIndex = classItem.sections.findIndex((section) => section.id === target.id)

      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        classItem.sections = arrayMove(classItem.sections, fromIndex, toIndex)
      }
    }
  }

  function handleDragEnd() {
    activeDrag = null
  }

  function getOverlayClass(source: { id: string | number }) {
    return builderState.content.classes.find((classItem) => classItem.id === source.id)
  }

  function getOverlaySection(source: { id: string | number; data?: unknown }) {
    const data = getDragData(source.data)
    const classItem = data.classId ? findClass(data.classId) : findClassBySection(String(source.id))

    return classItem?.sections.find((section) => section.id === source.id)
  }
</script>

<DragDropProvider
  {sensors}
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
>
  <div class="flex h-full min-h-0 flex-col">
    <div class="shrink-0 border-b border-border bg-card py-3">
      <ContentQuickActions />
    </div>

    <div class="relative min-h-0 flex-1">
      <div
        bind:this={scrollContainer}
        onscroll={updateScrollHint}
        class="flex h-full min-h-0 [scrollbar-gutter:stable] flex-col gap-3 overflow-y-scroll py-4 pb-12"
      >
        {#each builderState.content.classes as classItem, index (classItem.id)}
          <BuilderClassGroup
            {classItem}
            {index}
            activeSectionClassId={activeDrag?.type === "section" ? activeDrag.classId : undefined}
          />
        {/each}
      </div>

      {#if showScrollHint}
        <div
          class="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-card/85 px-2 py-1 text-muted-foreground shadow-sm backdrop-blur"
          aria-hidden="true"
        >
          <IconChevronDown class="size-4" />
        </div>
      {/if}
    </div>
  </div>

  <DragOverlay>
    {#snippet children(source)}
      {#if source.type === "class"}
        {@const classItem = getOverlayClass(source)}
        {#if classItem}
          <BuilderClassGroup {classItem} index={0} isOverlay />
        {/if}
      {:else if source.type === "section"}
        {@const section = getOverlaySection(source)}
        {#if section}
          <BuilderSectionRow {section} index={0} classId="overlay" isOverlay />
        {/if}
      {/if}
    {/snippet}
  </DragOverlay>
</DragDropProvider>
