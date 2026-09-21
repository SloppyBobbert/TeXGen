// Deliberately only parses our bounded line markers, never arbitrary LaTeX.
const MARKER = /^% @texgen-section v1 (begin|end) ([cgf]):([a-z0-9.-]+)\n/gm;
const MAX_BYTES = 256 * 1024;

export function parseSections(source) {
  if (typeof source !== 'string' || new globalThis.TextEncoder().encode(source).length > MAX_BYTES) return null;
  const matches = [...source.matchAll(MARKER)];
  if (!matches.length || matches.length > 6000 || (source.match(/@texgen-section/g) || []).length !== matches.length) return null;
  const stack = [];
  const nodes = [];
  const seen = new Set();
  for (const match of matches) {
    const [, action, kind, formulaId] = match;
    const id = `${kind}:${formulaId}`;
    if (action === 'begin') {
      if (seen.has(id) || kind !== ['c', 'g', 'f'][stack.length]) return null;
      const node = { id, formulaId, kind, start: match.index, bodyStart: match.index + match[0].length, children: [] };
      seen.add(id);
      if (stack.length) stack.at(-1).children.push(node);
      nodes.push(node);
      stack.push(node);
    } else {
      const node = stack.pop();
      if (!node || node.id !== id) return null;
      node.bodyEnd = match.index;
      node.end = match.index + match[0].length;
    }
  }
  if (stack.length || !nodes.some((node) => node.kind === 'f') || nodes.some((node) => node.kind !== 'f' && !node.children.length)) return null;
  return nodes;
}

export function validSectionMetadata(value) {
  return value === null || value === undefined || (
    typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 2 && value.version === 1
    && parseSections(value.baseline) !== null
  );
}

function gaps(source, node) {
  let start = node.bodyStart;
  const result = [];
  for (const child of node.children) {
    result.push(source.slice(start, child.start));
    start = child.end;
  }
  result.push(source.slice(start, node.bodyEnd));
  return result;
}

export function planSectionRemoval(source, metadata, removedIds, knownIds) {
  const unsafe = { safe: false, message: 'Section boundaries are missing or changed. Source and selections were kept. Edit raw source or explicitly regenerate.' };
  if (!metadata || !validSectionMetadata(metadata)) return unsafe;
  const original = parseSections(metadata.baseline);
  const current = parseSections(source);
  if (!current || original.length !== current.length || original.some((node, i) => node.id !== current[i].id || (knownIds && !knownIds.has(node.formulaId)))) return unsafe;
  const baselineRoots = original.filter((node) => node.kind === 'c');
  const currentRoots = current.filter((node) => node.kind === 'c');
  const baselineDocument = { bodyStart: 0, bodyEnd: metadata.baseline.length, children: baselineRoots };
  const currentDocument = { bodyStart: 0, bodyEnd: source.length, children: currentRoots };
  const wrappers = [[baselineDocument, currentDocument], ...original.flatMap((node, i) => node.kind === 'f' ? [] : [[node, current[i]]])];
  // Plain custom text may surround intact wrappers. Structural additions need raw editing.
  const keepsWrapper = (before, after) => {
    const index = after.indexOf(before);
    if (index < 0) return false;
    const added = after.slice(0, index) + after.slice(index + before.length);
    return !/[{}]|\\(?:begin|end|documentclass|usepackage)\b/.test(added);
  };
  if (wrappers.some(([before, after]) => gaps(metadata.baseline, before).some((gap, i) => !keepsWrapper(gap, gaps(source, after)[i])))) return unsafe;
  const removed = new Set(removedIds);
  const targets = [];
  // ponytail: bounded O(n²) scan (256 KiB source); index descendants if this limit grows.
  const visit = (node) => {
    const leaves = current.filter((child) => child.kind === 'f' && child.start >= node.start && child.end <= node.end);
    if (leaves.length && leaves.every((leaf) => removed.has(leaf.formulaId))) targets.push(node);
    else node.children.forEach(visit);
  };
  currentRoots.forEach(visit);
  const baselineById = new Map(original.map((node) => [node.id, node]));
  const edited = targets.some((node) => {
    const before = baselineById.get(node.id);
    return source.slice(node.start, node.end) !== metadata.baseline.slice(before.start, before.end);
  });
  const remove = (text, nodes) => [...nodes].sort((a, b) => b.start - a.start).reduce((value, node) => value.slice(0, node.start) + value.slice(node.end), text);
  const baseline = remove(metadata.baseline, targets.map((node) => baselineById.get(node.id)));
  return { safe: true, edited, source: remove(source, targets), metadata: parseSections(baseline) ? { version: 1, baseline } : null };
}
