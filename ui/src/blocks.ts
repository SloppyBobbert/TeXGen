import {
  decodeDocument,
  decodeLayout,
  type Block,
  type Document,
  type Layout,
} from "./document";

function structuredBlocks(document: Document): Block[] {
  if (document.content.mode !== "structured") {
    throw new Error("Structured controls cannot change raw source.");
  }
  return document.content.blocks;
}

function withBlocks(document: Document, blocks: Block[]): Document {
  return decodeDocument({
    ...document,
    content: { mode: "structured", blocks },
  });
}

export function insertBlock(document: Document, block: Block): Document {
  return withBlocks(document, [...structuredBlocks(document), block]);
}

export function removeBlock(document: Document, id: string): Document {
  const blocks = structuredBlocks(document);
  if (!blocks.some((block) => block.id === id))
    throw new Error("The block no longer exists.");
  return withBlocks(
    document,
    blocks.filter((block) => block.id !== id),
  );
}

export function replaceBlock(document: Document, replacement: Block): Document {
  const blocks = structuredBlocks(document);
  if (!blocks.some((block) => block.id === replacement.id))
    throw new Error("The block no longer exists.");
  return withBlocks(
    document,
    blocks.map((block) => (block.id === replacement.id ? replacement : block)),
  );
}

export function moveBlock(
  document: Document,
  id: string,
  direction: -1 | 1,
): Document {
  const blocks = structuredBlocks(document).slice();
  const index = blocks.findIndex((block) => block.id === id);
  if (index < 0) throw new Error("The block no longer exists.");
  const destination = index + direction;
  if (destination < 0 || destination >= blocks.length) return document;
  const [block] = blocks.splice(index, 1);
  blocks.splice(destination, 0, block);
  return withBlocks(document, blocks);
}

export function changeLayout(document: Document, layout: Layout): Document {
  structuredBlocks(document);
  return decodeDocument({ ...document, layout: decodeLayout(layout) });
}
