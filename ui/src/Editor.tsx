import { type FormEvent, type ReactNode } from "react";
import { type Catalog, type Category, type Formula } from "./catalog";
import {
  changeLayout,
  insertBlock,
  moveBlock,
  removeBlock,
  replaceBlock,
} from "./blocks";
import { type Block, type Document, type Layout } from "./document";
import { type EditorSession, type EditorSnapshot } from "./editor-session";

export const COMPACT_CANDIDATE: Layout = {
  paper: "A4",
  columns: 2,
  marginsMm: 5,
  fontPt: 9,
  spacingPt: 1,
  columnGapMm: 3,
};

interface EditorProps {
  snapshot: EditorSnapshot;
  catalog: Catalog | null;
  actions: Pick<
    EditorSession,
    | "edit"
    | "replace"
    | "restore"
    | "save"
    | "start"
    | "exportJson"
    | "exportTex"
    | "importFile"
    | "editRaw"
    | "toRaw"
    | "toStructured"
  >;
  onCreate: (allowance: number) => void;
  preview?: ReactNode;
}

function removeFormulas(
  document: Document,
  matches: (block: Block) => boolean,
) {
  if (document.content.mode !== "structured") return document;
  return document.content.blocks
    .filter(matches)
    .reduce((current, block) => removeBlock(current, block.id), document);
}

function CatalogControls({
  catalog,
  document,
  onEdit,
}: {
  catalog: Catalog | null;
  document: Document;
  onEdit: EditorProps["actions"]["edit"];
}) {
  const blocks =
    document.content.mode === "structured" ? document.content.blocks : [];
  const selected = new Set(
    blocks.flatMap((block) =>
      block.kind === "formula" ? [block.catalogId] : [],
    ),
  );
  function toggle(category: Category, formula: Formula, checked: boolean) {
    onEdit((document) =>
      checked
        ? insertBlock(document, {
            kind: "formula",
            id: crypto.randomUUID(),
            catalogId: formula.id,
            topicId: category.id,
            topicLabel: category.label,
            label: formula.label,
            body: { ...formula.body },
          })
        : removeFormulas(
            document,
            (block) =>
              block.kind === "formula" && block.catalogId === formula.id,
          ),
    );
  }
  return (
    <section className="catalog-section" aria-labelledby="catalog-heading">
      <h2 id="catalog-heading">Select classes</h2>
      <p>
        {selected.size} distinct catalog formulas selected. Counts come from
        document blocks.
      </p>
      {!catalog ? (
        <p>
          Connect to the protected server to load the catalog. Saved blocks
          remain available.
        </p>
      ) : (
        catalog.subjects.map((subject) => (
          <details key={subject.id}>
            <summary>{subject.label}</summary>
            {subject.categories.map((category) => {
              const count = category.formulas.filter((formula) =>
                selected.has(formula.id),
              ).length;
              return (
                <details key={category.id}>
                  <summary>
                    {category.label} — {count} / {category.formulas.length}{" "}
                    selected
                  </summary>
                  <button
                    type="button"
                    onClick={() =>
                      onEdit((document) =>
                        removeFormulas(
                          document,
                          (block) =>
                            block.kind === "formula" &&
                            block.topicId === category.id,
                        ),
                      )
                    }
                  >
                    Remove {category.label} formulas
                  </button>
                  {category.formulas.map((formula) => (
                    <label className="formula-choice" key={formula.id}>
                      <input
                        type="checkbox"
                        checked={selected.has(formula.id)}
                        onChange={(event) =>
                          toggle(category, formula, event.target.checked)
                        }
                      />
                      {formula.label}
                    </label>
                  ))}
                </details>
              );
            })}
          </details>
        ))
      )}
    </section>
  );
}

function LayoutControls({
  document,
  onEdit,
}: {
  document: Document;
  onEdit: EditorProps["actions"]["edit"];
}) {
  const fields = [
    ["columns", "Columns", 1, 10, 1],
    ["marginsMm", "Margins (mm)", 0, 104.999, 0.001],
    ["fontPt", "Body font (pt)", 0.001, 72, 0.001],
    ["spacingPt", "Spacing (pt)", 0, 72, 0.001],
    ["columnGapMm", "Column gap (mm)", 0, 210, 0.001],
  ] as const;
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onEdit((current) =>
      changeLayout(
        { ...current, pageAllowance: Number(form.get("pageAllowance")) },
        {
          paper: "A4",
          columns: Number(form.get("columns")),
          marginsMm: Number(form.get("marginsMm")),
          fontPt: Number(form.get("fontPt")),
          spacingPt: Number(form.get("spacingPt")),
          columnGapMm: Number(form.get("columnGapMm")),
        },
      ),
    );
  }
  return (
    <section className="layout-section" aria-labelledby="layout-heading">
      <h2 id="layout-heading">Layout options</h2>
      <p>Paper: A4. The compact candidate is not an approved print preset.</p>
      <p>
        Minimum readable font size and printer margins require actual-size
        printed samples. No automatic fitting or shrinking occurs.
      </p>
      <form
        onSubmit={apply}
        key={JSON.stringify([document.layout, document.pageAllowance])}
      >
        <div className="settings">
          <label>
            Page allowance
            <input
              name="pageAllowance"
              type="number"
              min="1"
              max="65535"
              step="1"
              required
              defaultValue={document.pageAllowance}
            />
          </label>
          {fields.map(([name, label, min, max, step]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                type="number"
                min={min}
                max={max}
                step={step}
                required
                defaultValue={document.layout[name]}
              />
            </label>
          ))}
        </div>
        <button type="submit">Apply layout</button>{" "}
        <button
          type="button"
          onClick={() =>
            onEdit((current) => changeLayout(current, COMPACT_CANDIDATE))
          }
        >
          Apply compact candidate
        </button>
      </form>
      <p>
        The page allowance is a warning target. It never permits content
        removal. Page count requires the verified PDF compiler.
      </p>
    </section>
  );
}

function BlockControls({
  block,
  index,
  count,
  onEdit,
}: {
  block: Block;
  index: number;
  count: number;
  onEdit: EditorProps["actions"]["edit"];
}) {
  const number = index + 1;
  function replace(update: Block) {
    onEdit((document) => replaceBlock(document, update));
  }
  return (
    <li data-block-id={block.id}>
      <h3>
        Block {number}:{" "}
        {block.kind === "formula"
          ? block.label
          : block.kind === "text"
            ? "Text"
            : "Mathematics"}
      </h3>
      {block.kind === "formula" ? (
        <>
          <label>
            Block {number} formula label
            <input
              value={block.label}
              onChange={(event) =>
                replace({ ...block, label: event.target.value })
              }
            />
          </label>
          <label>
            Block {number} topic label
            <input
              value={block.topicLabel}
              onChange={(event) =>
                replace({ ...block, topicLabel: event.target.value })
              }
            />
          </label>
          <label>
            Block {number} LaTeX
            <textarea
              spellCheck={false}
              value={block.body.latex}
              onChange={(event) =>
                replace({
                  ...block,
                  body: { ...block.body, latex: event.target.value },
                })
              }
            />
          </label>
          <p>
            These edits affect this document only. Body type: {block.body.type}.
          </p>
        </>
      ) : block.kind === "text" ? (
        <label>
          Block {number} text
          <textarea
            value={block.text}
            onChange={(event) =>
              replace({ ...block, text: event.target.value })
            }
          />
        </label>
      ) : (
        <label>
          Block {number} LaTeX
          <textarea
            spellCheck={false}
            value={block.latex}
            onChange={(event) =>
              replace({ ...block, latex: event.target.value })
            }
          />
        </label>
      )}
      <div className="actions">
        <button
          type="button"
          disabled={index === 0}
          onClick={() =>
            onEdit((document) => moveBlock(document, block.id, -1))
          }
        >
          Move block {number} up
        </button>
        <button
          type="button"
          disabled={index === count - 1}
          onClick={() => onEdit((document) => moveBlock(document, block.id, 1))}
        >
          Move block {number} down
        </button>
        <button
          type="button"
          onClick={() => onEdit((document) => removeBlock(document, block.id))}
        >
          Remove block {number}
        </button>
      </div>
    </li>
  );
}

export function Editor({
  snapshot,
  catalog,
  actions,
  onCreate,
  preview,
}: EditorProps) {
  const document = snapshot.document;
  const writer = snapshot.ownership === "writer";
  const raw = document?.content.mode === "raw";
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      document &&
      !window.confirm(
        "Replace the current document with an empty document? The latest replacement recovery copy will also be replaced.",
      )
    )
      return;
    const form = event.currentTarget;
    onCreate(Number(new FormData(form).get("newAllowance")));
  }
  const creationForm = (
    <form className="creation-form" onSubmit={create}>
      <fieldset disabled={!writer}>
        <legend id={document ? undefined : "document-heading"}>
          {document ? "Clear and create a new document" : "Create a document"}
        </legend>
        <label>
          New document page allowance
          <input
            name="newAllowance"
            type="number"
            min="1"
            max="65535"
            step="1"
            required
            placeholder="Select a page count"
          />
        </label>
        <button
          type="submit"
          className={document ? undefined : "primary-button"}
        >
          {document ? "Clear and create document" : "Create document"}
        </button>
      </fieldset>
    </form>
  );
  return (
    <>
      <section className="document-toolbar" aria-labelledby="draft-heading">
        <h2 id="draft-heading" className="sr-only">
          Document and draft recovery
        </h2>
        <p role="status">{snapshot.ownershipMessage}</p>
        {snapshot.ownership === "readonly" ? (
          <button type="button" onClick={actions.start}>
            Request editing
          </button>
        ) : null}
        <p role="status">{snapshot.status}</p>
        {snapshot.dirty ? (
          <p role="alert">
            Unsaved changes exist in this tab. Export JSON before you close it.
          </p>
        ) : null}
        {snapshot.error ? <p role="alert">{snapshot.error}</p> : null}
        {snapshot.busy ? (
          <p role="status">
            A document operation is in progress. Further edits cancel its
            result.
          </p>
        ) : null}
        <p>
          Browser autosave provides draft recovery, not a durable backup.
          Browser limits or private-session closure can remove drafts.
        </p>
        <div className="actions">
          <button
            type="button"
            disabled={!document}
            className="primary-button"
            onClick={actions.exportJson}
          >
            Export document JSON
          </button>
          <button
            type="button"
            disabled={!document}
            onClick={() => void actions.exportTex()}
          >
            Export TeX
          </button>
          <button
            type="button"
            disabled={!writer || !snapshot.dirty}
            onClick={actions.save}
          >
            Retry draft save
          </button>
          <button
            type="button"
            disabled={!writer || !snapshot.replaced}
            onClick={() => {
              if (
                window.confirm(
                  "Restore the last replaced document? The current document will become the replacement recovery copy.",
                )
              )
                actions.restore();
            }}
          >
            Restore last replaced document
          </button>
        </div>
        <label>
          Import document JSON
          <input
            type="file"
            accept="application/json,.json"
            disabled={!writer}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file)
                void actions.importFile(file, () =>
                  window.confirm(
                    "Import this validated document? The current document will replace the latest replacement recovery copy.",
                  ),
                );
            }}
          />
        </label>
      </section>
      <div className={`workspace${raw ? " workspace--raw" : ""}`}>
        {document ? (
          <div className="source-workspace" key={snapshot.replacement}>
            <aside className="library-column" aria-label="Document and classes">
              <section
                className="document-properties"
                aria-labelledby="document-heading"
              >
                <h2 id="document-heading" className="sr-only">
                  Active document
                </h2>
                <label>
                  Document title
                  <input
                    disabled={!writer}
                    value={document.title}
                    onChange={(event) =>
                      actions.edit((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <p>
                  Mode: {document.content.mode}. Session revision:{" "}
                  {snapshot.revision}.
                </p>
                {document.modeRecovery ? (
                  <p>
                    A mode-recovery copy is retained and included in document
                    JSON export.
                  </p>
                ) : null}
              </section>
              <fieldset
                disabled={!writer || raw}
                className="library-panel structured-controls"
              >
                <legend>Structured editor</legend>
                <CatalogControls
                  catalog={catalog}
                  document={document}
                  onEdit={actions.edit}
                />
                <LayoutControls document={document} onEdit={actions.edit} />
              </fieldset>
              {creationForm}
            </aside>
            <div className="document-pane">
              <section
                className="document-section"
                aria-labelledby="source-mode-heading"
              >
                <h2 id="source-mode-heading">Document editor</h2>
                {raw && document.content.mode === "raw" ? (
                  <>
                    <p>
                      Raw source is preserved. Structured controls cannot change
                      it. Edit the complete source below. Arbitrary TeX requires
                      visual review; no PDF layout check has run.
                    </p>
                    <label>
                      Raw LaTeX source
                      <textarea
                        readOnly={!writer}
                        spellCheck={false}
                        value={document.content.source}
                        onChange={(event) =>
                          actions.editRaw(event.target.value)
                        }
                      />
                    </label>
                    <button
                      type="button"
                      disabled={
                        !writer ||
                        document.modeRecovery?.content.mode !== "structured"
                      }
                      onClick={() =>
                        actions.toStructured(() =>
                          window.confirm(
                            "Restore structured content? This replaces the active raw source. The complete raw source will be saved as mode recovery. Raw edits will not be converted into blocks.",
                          ),
                        )
                      }
                    >
                      Return to structured mode
                    </button>
                    {document.modeRecovery?.content.mode !== "structured" ? (
                      <p>
                        No structured recovery copy exists. Return is disabled.
                        Keep this raw document or use Clear to create a new
                        document.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={!writer}
                    onClick={() =>
                      void actions.toRaw(() =>
                        window.confirm(
                          document.modeRecovery?.content.mode === "raw"
                            ? "Restore the saved raw source? Current structured content will be saved as mode recovery. Structured edits will not be merged into the saved raw source."
                            : "Open the advanced raw editor with generated TeX? Structured content will be saved as mode recovery. Formula and layout controls will be disabled.",
                        ),
                      )
                    }
                  >
                    {document.modeRecovery?.content.mode === "raw"
                      ? "Restore raw mode recovery"
                      : "Open advanced raw editor"}
                  </button>
                )}
              </section>
              <fieldset
                disabled={!writer || raw}
                className="block-panel structured-controls"
              >
                <legend>Content controls</legend>
                <section
                  className="blocks-section"
                  aria-labelledby="blocks-heading"
                >
                  <h2 id="blocks-heading">Ordered content blocks</h2>
                  <p>
                    Use <code>{"\\\\"}</code> for manual equation line breaks. A
                    formula remains one complete block.
                  </p>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() =>
                        actions.edit((current) =>
                          insertBlock(current, {
                            kind: "text",
                            id: crypto.randomUUID(),
                            text: "",
                          }),
                        )
                      }
                    >
                      Add text block
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        actions.edit((current) =>
                          insertBlock(current, {
                            kind: "math",
                            id: crypto.randomUUID(),
                            latex: "",
                          }),
                        )
                      }
                    >
                      Add mathematics block
                    </button>
                  </div>
                  {document.content.mode === "structured" ? (
                    <>
                      <p>
                        {document.content.blocks.length} blocks. Order and
                        custom content remain independent of catalog selection.
                      </p>
                      <ol className="blocks">
                        {document.content.blocks.map((block, index) => (
                          <BlockControls
                            key={block.id}
                            block={block}
                            index={index}
                            count={
                              document.content.mode === "structured"
                                ? document.content.blocks.length
                                : 0
                            }
                            onEdit={actions.edit}
                          />
                        ))}
                      </ol>
                    </>
                  ) : null}
                </section>
              </fieldset>
            </div>
          </div>
        ) : (
          <div className="source-workspace">
            <aside
              className="library-column library-placeholder"
              aria-labelledby="catalog-heading"
            >
              <h2 id="catalog-heading">Select classes</h2>
              <p>
                Create a document to select formulas and adjust page layout.
              </p>
              {creationForm}
            </aside>
            <section className="welcome-panel" aria-label="New document help">
              <span className="empty-sheet" aria-hidden="true">
                ∑
              </span>
              <p className="eyebrow">New document</p>
              <h2>Create your formula sheet.</h2>
              <p>
                Choose a page allowance in the sidebar to start. Add formulas,
                keep your notes, and preview every page.
              </p>
              <p className="muted">
                Your source stays editable. Nothing is fitted or removed
                automatically.
              </p>
            </section>
          </div>
        )}
        {preview}
      </div>
    </>
  );
}
