import React, { useState, useEffect, useRef, useMemo, useCallback, useId } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFormulas } from '../hooks/formulas';
import { useLatex } from '../hooks/latex';
import { useYouTubeResources } from '../hooks/youtubeResources';
import { getCuratedVideosForTopics } from '../data/subjectVideos';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PANEL_LAYOUT_STORAGE_KEY = 'editorPanelLayout';
const DEFAULT_PANEL_LAYOUT = {
  leftWidth: 280,
  rightWidth: 300,
  latexWidth: 430,
};

const LEFT_PANEL_MIN_WIDTH = 220;
const LEFT_PANEL_MAX_WIDTH = 420;
const RIGHT_PANEL_MIN_WIDTH = 240;
const RIGHT_PANEL_MAX_WIDTH = 420;
const LATEX_PANEL_MIN_WIDTH = 320;
const LATEX_PANEL_MAX_WIDTH = 760;
const RESIZER_WIDTH = 10;
const MIN_CENTER_WIDTH = 360;
const MIN_PREVIEW_WIDTH = 260;
const DEFAULT_PDF_ZOOM = 0.85;
const MIN_SPLIT_CENTER_WIDTH = LATEX_PANEL_MIN_WIDTH + RESIZER_WIDTH + MIN_PREVIEW_WIDTH;

function loadPanelLayout() {
  try {
    const saved = localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY);
    if (!saved) return DEFAULT_PANEL_LAYOUT;

    const parsed = JSON.parse(saved);
    return {
      leftWidth: Number.isFinite(parsed.leftWidth) ? parsed.leftWidth : DEFAULT_PANEL_LAYOUT.leftWidth,
      rightWidth: Number.isFinite(parsed.rightWidth) ? parsed.rightWidth : DEFAULT_PANEL_LAYOUT.rightWidth,
      latexWidth: Number.isFinite(parsed.latexWidth) ? parsed.latexWidth : DEFAULT_PANEL_LAYOUT.latexWidth,
    };
  } catch {
    return DEFAULT_PANEL_LAYOUT;
  }
}

const clampPanelWidth = (value, min, max) => Math.min(max, Math.max(min, value));

function constrainPanelLayout(layout, { bodyWidth, leftPanelVisible, rightPanelVisible, showLatex }) {
  const minimumCenterWidth = showLatex ? MIN_SPLIT_CENTER_WIDTH : MIN_CENTER_WIDTH;
  const leftReserve = leftPanelVisible ? RESIZER_WIDTH : 0;
  const rightReserve = rightPanelVisible ? RESIZER_WIDTH : 0;
  const next = {
    leftWidth: clampPanelWidth(layout.leftWidth, LEFT_PANEL_MIN_WIDTH, LEFT_PANEL_MAX_WIDTH),
    rightWidth: clampPanelWidth(layout.rightWidth, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH),
    latexWidth: clampPanelWidth(layout.latexWidth, LATEX_PANEL_MIN_WIDTH, LATEX_PANEL_MAX_WIDTH),
  };

  if (!Number.isFinite(bodyWidth) || bodyWidth <= 0) {
    return next;
  }

  const maxLeftWidth = Math.max(
    LEFT_PANEL_MIN_WIDTH,
    Math.min(
      LEFT_PANEL_MAX_WIDTH,
      bodyWidth - (rightPanelVisible ? next.rightWidth + rightReserve : 0) - leftReserve - minimumCenterWidth,
    ),
  );
  next.leftWidth = clampPanelWidth(next.leftWidth, LEFT_PANEL_MIN_WIDTH, maxLeftWidth);

  const maxRightWidth = Math.max(
    RIGHT_PANEL_MIN_WIDTH,
    Math.min(
      RIGHT_PANEL_MAX_WIDTH,
      bodyWidth - (leftPanelVisible ? next.leftWidth + leftReserve : 0) - rightReserve - minimumCenterWidth,
    ),
  );
  next.rightWidth = clampPanelWidth(next.rightWidth, RIGHT_PANEL_MIN_WIDTH, maxRightWidth);

  const estimatedCenterWidth = bodyWidth
    - (leftPanelVisible ? next.leftWidth + leftReserve : 0)
    - (rightPanelVisible ? next.rightWidth + rightReserve : 0);
  const maxLatexWidth = Math.max(
    LATEX_PANEL_MIN_WIDTH,
    Math.min(LATEX_PANEL_MAX_WIDTH, estimatedCenterWidth - RESIZER_WIDTH - MIN_PREVIEW_WIDTH),
  );
  next.latexWidth = clampPanelWidth(next.latexWidth, LATEX_PANEL_MIN_WIDTH, maxLatexWidth);

  return next;
}

const samePanelLayout = (a, b) => (
  a.leftWidth === b.leftWidth && a.rightWidth === b.rightWidth && a.latexWidth === b.latexWidth
);


function SortableFormulaItem({ id, formula, onRemove, className }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ 
    id,
    data: { type: 'formula', class: formula.class }
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    position: 'relative',
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
  };

  return (
    <div ref={setNodeRef} style={style} className={`sortable-formula-item ${className || ''}`}>
      <span className="drag-handle" {...attributes} {...listeners}>⋮⋮</span>
      <span className="formula-name" style={{ fontStyle: 'italic' }}>{formula.name}</span>
      <span className="formula-class" style={{ fontStyle: 'italic' }}>{formula.class}</span>
      <button 
        type="button" 
        className="remove-formula" 
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>
    </div>
  );
}

function CollapsiblePanelSection({ title, isOpen, onToggle, children, countBadge = null, className = '' }) {
  const sectionId = useId();
  const toggleId = `${sectionId}-toggle`;
  const panelId = `${sectionId}-panel`;

  return (
    <section className={`left-panel-section ${className}`.trim()}>
      <button
        id={toggleId}
        type="button"
        className={`left-panel-section-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="left-panel-section-title-row">
          <span className="left-panel-section-title">{title}</span>
          {countBadge ? <span className="left-panel-section-badge">{countBadge}</span> : null}
        </span>
        <span className="left-panel-section-icon" aria-hidden="true">▸</span>
      </button>
      {isOpen ? (
        <div id={panelId} className="left-panel-section-body" role="region" aria-labelledby={toggleId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function SortableClassGroup({ group, isCollapsed, onToggleCollapse, onRemoveClass, onRemoveFormula }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ 
    id: `class-${group.class}`,
    data: { type: 'class' }
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    position: 'relative',
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
  };

  return (
    <div ref={setNodeRef} style={style} className={`formula-class-group ${isCollapsed ? 'collapsed' : ''}`}>
      <div 
        className="class-group-header" 
        onClick={onToggleCollapse}
        {...attributes} 
        {...listeners}
      >
        <div className="class-group-main">
          <span className="drag-handle">⋮⋮</span>
          <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
          <span 
            className="class-group-title" 
          >
            {group.class} ({group.formulas.length})
          </span>
        </div>
        <div className="class-group-actions">
          <button 
            type="button" 
            className="class-group-btn remove" 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemoveClass(group.class);
            }} 
            title="Remove all"
          >
            ×
          </button>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="class-group-formulas">
          <SortableContext items={group.formulas.map(f => `formula-${group.class}-${f.category}-${f.name}`)} strategy={verticalListSortingStrategy}>
            {group.formulas.map(f => (
              <SortableFormulaItem 
                key={`${f.category}-${f.name}`}
                id={`formula-${group.class}-${f.category}-${f.name}`}
                formula={f}
                className="nested"
                onRemove={() => onRemoveFormula(f.category, f.name)}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

function FormulaReorderPanel({ groupedFormulas, onReorderClass, onReorderFormula, onRemoveClass, onRemoveFormula }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [expandedGroups, setExpandedGroups] = useState({});

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    
    if (activeType === 'class' && overType === 'class') {
      const oldIndex = groupedFormulas.findIndex(g => `class-${g.class}` === active.id);
      const newIndex = groupedFormulas.findIndex(g => `class-${g.class}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderClass(oldIndex, newIndex);
      }
    } else if (activeType === 'formula' && overType === 'formula') {
      const activeClass = active.data.current?.class;
      const overClass = over.data.current?.class;
      
      if (activeClass === overClass) {
        const group = groupedFormulas.find(g => g.class === activeClass);
        if (group) {
          const oldIndex = group.formulas.findIndex(f => `formula-${activeClass}-${f.category}-${f.name}` === active.id);
          const newIndex = group.formulas.findIndex(f => `formula-${overClass}-${f.category}-${f.name}` === over.id);
          if (oldIndex !== -1 && newIndex !== -1) {
            onReorderFormula(activeClass, oldIndex, newIndex);
          }
        }
      }
    }
  };


  const toggleGroup = (className) => {
    setExpandedGroups(prev => ({ ...prev, [className]: !prev[className] }));
  };

  if (groupedFormulas.length === 0) return null;

  return (
    <div className="formula-reorder-panel">
      <div className="reorder-instructions subtle-copy">
        <span>Click the bar to collapse. Click and hold to move.</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={groupedFormulas.map(g => `class-${g.class}`)} strategy={verticalListSortingStrategy}>
          {groupedFormulas.map(group => (
            <SortableClassGroup 
              key={group.class}
              group={group}
              isCollapsed={!expandedGroups[group.class]}
              onToggleCollapse={() => toggleGroup(group.class)}
              onRemoveClass={onRemoveClass}
              onRemoveFormula={(categoryName, formulaName) => onRemoveFormula(group.class, categoryName, formulaName)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

const UNTITLED_TITLE_REGEX = /^Untitled Sheet \(\d+\)$/;

const formatViewCount = (viewCount) => {
  const count = Number(viewCount || 0);
  if (!count) return '';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1)}K views`;
  return `${count} views`;
};

const VideoCard = ({ video, onOpen, className = '', compact = false }) => (
  <button
    type="button"
    className={`video-card-sm ${compact ? 'compact' : ''} ${className}`.trim()}
    onClick={(event) => onOpen(video, event.currentTarget)}
    aria-label={`Open ${video.title}`}
  >
    <div className="video-thumb-sm">
      <img src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`} alt={video.title} loading="lazy" />
      <div className="play-icon">▶</div>
    </div>
    {compact ? null : (
      <div className="video-info-sm">
        <div className="video-topic-chip">{video.category}</div>
        <div className="v-title">{video.title}</div>
        <div className="v-channel">
          {video.channel}{formatViewCount(video.viewCount) ? ` · ${formatViewCount(video.viewCount)}` : ''}
        </div>
      </div>
    )}
  </button>
);

const CURATED_VIDEO_PREVIEW_COUNT = 1;

const getVideoTopicKey = ({ className, category }) => `${className}:${category}`;

const getVideoResourceKey = (video) => `${video.className}:${video.category}:${video.videoId || video.title}`;

const groupVideosByTopic = (resources) => resources.reduce((groups, resource) => {
  const topicKey = getVideoTopicKey(resource);
  if (!groups[topicKey]) {
    groups[topicKey] = [];
  }
  groups[topicKey].push(resource);
  return groups;
}, {});

const SectionVideoPicks = ({
  className,
  category,
  curatedVideos = [],
  searchedVideos = [],
  onOpen,
  onSearchMore,
  onClearSearch,
  isSearching = false,
  searchError = '',
  hasSearched = false,
  allowSearch = false,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const sectionVideoListId = useId();
  const hiddenCuratedCount = Math.max(curatedVideos.length - CURATED_VIDEO_PREVIEW_COUNT, 0);
  const visibleCuratedVideos = isExpanded
    ? curatedVideos
    : curatedVideos.slice(0, CURATED_VIDEO_PREVIEW_COUNT);

  return (
    <div className={`section-video-picks ${compact ? 'compact' : ''}`.trim()} aria-label={`${className} ${category} video picks`}>
      {curatedVideos.length > 0 ? (
        <div id={sectionVideoListId} className="section-video-list">
          {visibleCuratedVideos.map((video) => (
            <VideoCard key={`${video.className}:${video.category}:${video.videoId}`} video={video} onOpen={onOpen} compact={compact} />
          ))}
        </div>
      ) : (
        <p className="inline-video-status">No videos yet.</p>
      )}

      {hiddenCuratedCount > 0 && (
        <button
          type="button"
          className="video-more-toggle"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          aria-controls={sectionVideoListId}
          aria-label={isExpanded ? 'Hide extra videos' : `Show ${hiddenCuratedCount} more videos`}
          title={isExpanded ? 'Hide extra videos' : `Show ${hiddenCuratedCount} more videos`}
        >
          {isExpanded ? '−' : `+${hiddenCuratedCount}`}
        </button>
      )}

      {allowSearch && (
  <div className="section-video-search-row">
    <button
      type="button"
      className="btn-toggle-panel section-video-search"
      onClick={() => onSearchMore({ className, category })}
      disabled={isSearching}
      aria-label={`Search YouTube for more in ${category}`}
      title={`Search YouTube for more in ${category}`}
    >
      {isSearching ? '↻' : '⌕'}
    </button>
    {hasSearched && !isSearching && searchedVideos.length > 0 && (
      <button
        type="button"
        className="btn-clear-search"
        onClick={onClearSearch}
        aria-label={`Clear search results for ${category}`}
        title="Clear search results"
      >
        ✕
      </button>
    )}
  </div>
)}

      {isSearching && !searchedVideos.length && !searchError && (
        <p className="inline-video-status">Searching…</p>
      )}

      {hasSearched && searchError && !isSearching && (
        <p className="inline-video-status inline-video-status-error">{searchError}</p>
      )}

      {!!searchedVideos.length && (
        <div className="section-video-results">
          {searchedVideos.map((video) => (
            <VideoCard key={`${video.className}:${video.category}:${video.videoId}`} video={video} onOpen={onOpen} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
};

const FormulaSelection = ({ 
  classesData, 
  selectedClasses, 
  selectedCategories, 
  groupedFormulas,
  toggleClass, 
  selectAllClasses,
  deselectAllClasses,
  toggleCategory, 
  selectedCount, 
  hasSelectedClasses,
  onReorderClass,
  onReorderFormula,
  onRemoveClass,
  onRemoveFormula,
  collapseClassesSignal = 0,
}) => {
  const [classesOpen, setClassesOpen] = useState(true);
  const [sectionsOpen, setSectionsOpen] = useState(true);
  const [reorderOpen, setReorderOpen] = useState(true);

  useEffect(() => {
    if (collapseClassesSignal > 0) {
      setClassesOpen(false);
    }
  }, [collapseClassesSignal]);

  return (
    <div className="formula-selection">
      <CollapsiblePanelSection
  title="Select classes"
  isOpen={classesOpen}
  onToggle={() => setClassesOpen((current) => !current)}
  countBadge={selectedCount > 0 ? `${selectedCount}` : null}
>
  <div className="class-select-all-row">
    <button
      type="button"
      className="btn-select-all"
      onClick={selectAllClasses}
    >
      Select All
    </button>
    <button
      type="button"
      className="btn-select-all btn-deselect-all"
      onClick={deselectAllClasses}
    >
      Deselect All
    </button>
      </div>
        <div className="class-checkboxes">
          {classesData.map((cls) => {
            const isChecked = !!selectedClasses[cls.name];
            return (
              <label key={cls.name} className={`class-checkbox-label ${isChecked ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleClass(cls.name)}
                />
                {cls.name}
              </label>
            );
          })}
        </div>

        {selectedCount > 0 && (
          <p className="subtle-copy selection-count-copy">
            {selectedCount} formula(s) will be included
          </p>
        )}
      </CollapsiblePanelSection>

      {hasSelectedClasses && (
        <CollapsiblePanelSection
          title="Select sections"
          isOpen={sectionsOpen}
          onToggle={() => setSectionsOpen((current) => !current)}
          className="category-dropdowns"
        >
          {classesData.map((cls) => {
            if (!selectedClasses[cls.name]) return null;

            const isSpecialClass = cls.is_special || (cls.categories.length === 1 && cls.categories[0].name === cls.name);

            if (isSpecialClass) {
              return (
                <div key={cls.name} className="class-category-section">
                  <p className="inline-note">
                    ✓ {cls.name} selected - all formulas included
                  </p>
                </div>
              );
            }

            return (
              <div key={cls.name} className="class-category-section">
                <label className="class-category-label">{cls.name}:</label>
                <label className="select-all-label">
                  <input
                    type="checkbox"
                    checked={cls.categories.every(cat => selectedCategories[`${cls.name}:${cat.name}`])}
                    onChange={() => {
                      const allSelected = cls.categories.every(cat => selectedCategories[`${cls.name}:${cat.name}`]);
                      cls.categories.forEach(cat => {
                        if (allSelected) {
                          toggleCategory(cls.name, cat.name);
                        } else if (!selectedCategories[`${cls.name}:${cat.name}`]) {
                          toggleCategory(cls.name, cat.name);
                        }
                      });
                    }}
                  />
                  Include all sections
                </label>
                <div className="category-checkboxes">
                  {cls.categories.map((cat) => {
                    const key = `${cls.name}:${cat.name}`;
                    const isChecked = !!selectedCategories[key];
                    return (
                      <label key={cat.name} className={`category-checkbox-label ${isChecked ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCategory(cls.name, cat.name)}
                        />
                        {cat.name} ({cat.formulas.length} formulas)
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CollapsiblePanelSection>
      )}

      {groupedFormulas.length > 0 && (
        <CollapsiblePanelSection
          title="Drag to reorder formulas"
          isOpen={reorderOpen}
          onToggle={() => setReorderOpen((current) => !current)}
        >
          <FormulaReorderPanel 
            groupedFormulas={groupedFormulas} 
            onReorderClass={onReorderClass}
            onReorderFormula={onReorderFormula}
            onRemoveClass={onRemoveClass}
            onRemoveFormula={onRemoveFormula}
          />
        </CollapsiblePanelSection>
      )}
    </div>
  );
};

const COMPILE_ERROR_LINE_REGEX = /document\.tex:(\d+):/g;
const APP_LAYOUT_COMMENT_PREFIX = '% @cheatsheet-layout';

const escapeHtml = (value = '') => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const highlightLatexLine = (line = '') => {
  if (line.trimStart().startsWith(APP_LAYOUT_COMMENT_PREFIX)) {
    return `<span class="latex-token app-comment">${escapeHtml(line)}</span>`;
  }

  const placeholders = [];
  const stashToken = (html) => {
    const placeholder = `LATEXTOKEN${placeholders.length}PLACEHOLDER`;
    placeholders.push(html);
    return placeholder;
  };

  let html = escapeHtml(line);

  html = html.replace(/%.*$/g, (match) => stashToken(`<span class="latex-token comment">${match}</span>`));
  html = html.replace(/\\[a-zA-Z@]+|\\./g, (match) => stashToken(`<span class="latex-token command">${match}</span>`));
  html = html.replace(/[{}[\]]/g, (match) => `<span class="latex-token brace">${match}</span>`);
  html = html.replace(/[$&#_^]/g, (match) => `<span class="latex-token symbol">${match}</span>`);

  html = html.replace(/LATEXTOKEN(\d+)PLACEHOLDER/g, (_, index) => placeholders[Number(index)] ?? '');

  return html || '&nbsp;';
};

const extractCompileErrorLines = (compileError = '') => {
  const normalizedError = compileError || '';
  const lineNumbers = new Set();

  for (const match of normalizedError.matchAll(COMPILE_ERROR_LINE_REGEX)) {
    lineNumbers.add(Number(match[1]));
  }

  return lineNumbers;
};

const getCompileErrorSummary = (compileError = '') => {
  const normalizedError = compileError || '';

  if (!normalizedError) {
    return '';
  }

  const lineMatch = normalizedError.match(/document\.tex:(\d+):\s*([^\n]+)/);
  if (lineMatch) {
    return `Line ${lineMatch[1]}: ${lineMatch[2].replace(/^error:\s*/i, '').trim()}`;
  }

  return (normalizedError.split('\n').find((line) => line.trim()) || '').replace(/^error:\s*/i, '').trim();
};

const LatexEditor = ({ content, onChange, isModified, compileError }) => {
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const highlightLayerRef = useRef(null);

  const errorLines = useMemo(() => extractCompileErrorLines(compileError), [compileError]);
  const compileErrorSummary = useMemo(() => getCompileErrorSummary(compileError), [compileError]);
  const highlightedLines = useMemo(() => {
    const lines = content ? content.split('\n') : [''];

    return lines.map((line, index) => ({
      lineNumber: index + 1,
      highlightedHtml: highlightLatexLine(line),
      hasError: errorLines.has(index + 1),
    }));
  }, [content, errorLines]);

  const lineCount = highlightedLines.length;

  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }

    if (highlightLayerRef.current && textareaRef.current) {
      highlightLayerRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightLayerRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div className="input-section">
      <label htmlFor="content">Generated LaTeX Code:</label>
      {compileErrorSummary ? (
        <div className="editor-status error">{compileErrorSummary}</div>
      ) : isModified ? (
        <div className="editor-status modified">Manual edits ready to recompile</div>
      ) : null}
      <div className={`editor-wrapper ${compileErrorSummary ? 'has-error' : ''}`}>
        <div className="line-numbers" ref={lineNumbersRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className={`line-number ${errorLines.has(i + 1) ? 'error' : ''}`}>{i + 1}</div>
          ))}
        </div>
        <div className="editor-surface">
          <div className={`editor-highlight-layer ${isModified ? 'modified' : ''}`} ref={highlightLayerRef} aria-hidden="true">
            {highlightedLines.map(({ lineNumber, highlightedHtml, hasError }) => (
              <div
                key={lineNumber}
                className={`editor-highlight-line ${hasError ? 'error' : ''}`}
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            ))}
          </div>
          <textarea
            ref={textareaRef}
            id="content"
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            placeholder='Select classes and categories above, then click "GET CHEAT SHEET" to see the LaTeX code here.'
            className={`textarea-field ${isModified ? 'modified' : ''}`}
            rows={15}
            spellCheck="false"
            wrap="off"
          />
        </div>
      </div>
    </div>
  );
};

const PdfPreview = ({ pdfBlob, compileError, isCompiling, layoutSignature }) => {
  const [numPages, setNumPages] = useState(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(null);
  const [containerHeight, setContainerHeight] = useState(null);
  const [zoom, setZoom] = useState(DEFAULT_PDF_ZOOM);
  const [viewMode, setViewMode] = useState('custom');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const scrollRef = useRef(null);
  const scrollFrameRef = useRef(null);

  const updateScrollState = useCallback(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) {
      return;
    }

    setShowScrollTop(scrollContainer.scrollTop > 300);

    const pages = scrollContainer.querySelectorAll('.pdf-page');
    if (pages?.length) {
      const containerTop = scrollContainer.getBoundingClientRect().top;
      let current = 1;
      pages.forEach((page, index) => {
        const pageTop = page.getBoundingClientRect().top - containerTop;
        if (pageTop <= 100) current = index + 1;
      });
      setCurrentPage(current);
    }
  }, []);

  const handlePdfScroll = useCallback(() => {
    if (scrollFrameRef.current) {
      return;
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      updateScrollState();
    });
  }, [updateScrollState]);

  useEffect(() => () => {
    if (scrollFrameRef.current) {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [numPages, updateScrollState, pdfBlob, compileError]);

  useEffect(() => {
    setCurrentPage(1);
    setShowScrollTop(false);
  }, [pdfBlob, compileError]);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clampZoom = (value) => Math.min(2, Math.max(0.5, value));
  const handleZoomOut = () => {
    setViewMode('custom');
    setZoom((z) => clampZoom(z - 0.15));
  };
  const handleZoomIn = () => {
    setViewMode('custom');
    setZoom((z) => clampZoom(z + 0.15));
  };
  const handleResetZoom = () => {
    setViewMode('custom');
    setZoom(DEFAULT_PDF_ZOOM);
  };
  const handleFitToWidth = () => {
    setViewMode('width');
    setZoom(1);
  };
  const handleFitToHeight = () => {
    setViewMode('height');
    setZoom(1);
  };

  const pageWidth = containerWidth && viewMode !== 'height'
    ? Math.max(240, Math.round(containerWidth * (viewMode === 'width' ? 1 : zoom)))
    : undefined;
  const pageHeight = containerHeight && viewMode === 'height'
    ? Math.max(320, Math.round((containerHeight - 24) * zoom))
    : undefined;

  const updatePreviewSize = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setContainerWidth(rect.width);
      setContainerHeight(rect.height);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    updatePreviewSize();
    if (!window.ResizeObserver) {
      window.addEventListener('resize', updatePreviewSize);
      return () => window.removeEventListener('resize', updatePreviewSize);
    }
    const resizeObserver = new window.ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [updatePreviewSize]);

  useEffect(() => {
    updatePreviewSize();
  }, [layoutSignature, updatePreviewSize]);

  return (
    <div className="pdf-preview-shell">
      <div className="pdf-preview-toolbar">
        <span className="pdf-toolbar-note">
          {numPages ? `Page ${currentPage} of ${numPages}` : 'Use the controls to adjust the preview.'}
        </span>
        <div className="pdf-zoom-controls" role="toolbar" aria-label="PDF zoom controls">
          <button
            type="button"
            className={`pdf-zoom-btn pdf-zoom-fit ${viewMode === 'width' ? 'active' : ''}`}
            onClick={handleFitToWidth}
            aria-pressed={viewMode === 'width'}
          >
            Fit width
          </button>
          <button
            type="button"
            className={`pdf-zoom-btn pdf-zoom-fit ${viewMode === 'height' ? 'active' : ''}`}
            onClick={handleFitToHeight}
            aria-pressed={viewMode === 'height'}
          >
            Fit height
          </button>
          <div className="pdf-zoom-group">
            <button type="button" className="pdf-zoom-btn" onClick={handleZoomOut} aria-label="Zoom out">
              −
            </button>
            <button
              type="button"
              className={`pdf-zoom-btn pdf-zoom-readout ${viewMode === 'custom' ? 'active' : ''}`}
              onClick={handleResetZoom}
              aria-pressed={viewMode === 'custom'}
            >
              {viewMode === 'width'
                ? 'Fit width'
                : viewMode === 'height'
                ? 'Fit height'
                : `${Math.round(zoom * 100)}%`}
            </button>
            <button type="button" className="pdf-zoom-btn" onClick={handleZoomIn} aria-label="Zoom in">
              +
            </button>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="pdf-preview-stage">
        <div className="pdf-preview-scroll" ref={scrollRef} onScroll={handlePdfScroll}>
          {compileError ? (
            <div className="compile-error-box">
              <strong>Compilation Error:</strong>
              <br />
              <br />
              {compileError}
            </div>
          ) : pdfBlob ? (
            <>
              <Document
                file={pdfBlob}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<div className="pdf-state-message">Loading PDF…</div>}
                error={<div className="pdf-state-message pdf-state-error">Failed to load PDF.</div>}
              >
                {Array.from({ length: numPages }, (_, index) => (
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="pdf-page"
                    width={pageWidth}
                    height={pageHeight}
                  />
                ))}
              </Document>
              {showScrollTop && (
                <button
                  type="button"
                  className="pdf-scroll-top-btn"
                  onClick={scrollToTop}
                  aria-label="Scroll to top"
                >
                  ↑
                </button>
              )}
            </>
          ) : (
            <div className="pdf-state-message">Compile the PDF to see your preview.</div>
          )}
        </div>

        {isCompiling && (
          <div className="pdf-recompile-overlay" aria-live="polite" aria-busy="true">
            <div className="pdf-recompile-spinner" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <strong>Recompiling PDF…</strong>
            <p>Hang tight — the preview is being refreshed.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const SnapshotTray = ({ snapshots, onRestore }) => {
  if (!snapshots.length) {
    return null;
  }

  return (
    <section className="snapshot-tray" aria-label="Compile snapshots">
      <div className="snapshot-tray-header">
        <h3>Compile snapshots</h3>
        <p>Restore an earlier compiled draft, then the preview will rebuild automatically.</p>
      </div>
      <div className="snapshot-list">
        {snapshots.map((snapshot, index) => {
          const formulaCount = snapshot.selectedFormulas?.length || 0;

          return (
            <article className="snapshot-card" key={`${snapshot.compiledAt || 'snapshot'}-${index}`}>
              <div className="snapshot-card-copy">
                <div className="snapshot-card-title">{snapshot.title || 'Untitled snapshot'}</div>
                <div className="snapshot-card-meta">
                  <span>{snapshot.compiledAt ? new Date(snapshot.compiledAt).toLocaleString() : 'Saved compile'}</span>
                  <span>{formulaCount} formula{formulaCount === 1 ? '' : 's'}</span>
                  <span>{snapshot.columns || 2} col</span>
                </div>
              </div>
              <button type="button" className="snapshot-restore-btn" onClick={() => onRestore(snapshot)}>
                Restore
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
};

const FONT_SIZE_PRESETS = ['8pt', '9pt', '10pt', '11pt', '12pt'];
const SPACING_PRESETS = ['tiny', 'small', 'medium', 'large'];

const LayoutOptions = ({ columns, setColumns, fontSize, setFontSize, spacing, setSpacing, margins, setMargins, orientation, setOrientation }) => {
  const fontSizeMode = FONT_SIZE_PRESETS.includes(fontSize) ? fontSize : 'custom';
  const spacingMode = SPACING_PRESETS.includes(spacing) ? spacing : 'custom';

  return (
  <div className="layout-options">
    <label className="panel-label">
      Layout Options
    </label>
    <div className="layout-controls">
      <div className="layout-control">
        <label htmlFor="columns">Columns:</label>
        <select 
          id="columns" 
          value={columns} 
          onChange={(e) => setColumns(Number(e.target.value))}
          className="layout-select"
        >
          <option value={1}>1 Column</option>
          <option value={2}>2 Columns</option>
          <option value={3}>3 Columns</option>
          <option value={4}>4 Columns</option>
          <option value={5}>5 Columns</option>
        </select>
      </div>
      <div className="layout-control">
        <label htmlFor="fontSize">Text Size:</label>
        <select 
          id="fontSize" 
          value={fontSizeMode} 
          onChange={(e) => setFontSize(e.target.value === 'custom' ? '10.5pt' : e.target.value)}
          className="layout-select"
        >
          <option value="8pt">Compact (8pt)</option>
          <option value="9pt">Small (9pt)</option>
          <option value="10pt">Normal (10pt)</option>
          <option value="11pt">Medium (11pt)</option>
          <option value="12pt">Large (12pt)</option>
          <option value="custom">Custom</option>
        </select>
        {fontSizeMode === 'custom' && (
          <input
            type="text"
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="layout-select"
            placeholder="e.g. 10.5pt"
          />
        )}
      </div>
      <div className="layout-control">
        <label htmlFor="spacing">Spacing:</label>
        <select 
          id="spacing" 
          value={spacingMode} 
          onChange={(e) => setSpacing(e.target.value === 'custom' ? '0.8pt' : e.target.value)}
          className="layout-select"
        >
          <option value="tiny">Tiny</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
          <option value="custom">Custom</option>
        </select>
        {spacingMode === 'custom' && (
          <input
            type="text"
            value={spacing}
            onChange={(e) => setSpacing(e.target.value)}
            className="layout-select"
            placeholder="e.g. 0.8pt"
          />
        )}
      </div>
      <div className="layout-control">
        <label htmlFor="margins">Margins:</label>
        <select 
          id="margins" 
          value={margins} 
          onChange={(e) => setMargins(e.target.value)}
          className="layout-select"
        >
          <option value="0.15in">Narrow (0.15in)</option>
          <option value="0.25in">Normal (0.25in)</option>
          <option value="0.5in">Wide (0.5in)</option>
          <option value="0.75in">Extra Wide (0.75in)</option>
        </select>
      </div>
      {/* NEW ORIENTATION CONTROL */}
      <div className="layout-control">
        <label htmlFor="orientation">Orientation:</label>
        <select 
          id="orientation" 
          value={orientation} 
          onChange={(e) => setOrientation(e.target.value)}
          className="layout-select"
        >
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </div>
      {/* END NEW CONTROL */}
    </div>
  </div>
  );
};

const CreateCheatSheet = ({ onSave, onReset, onRestoreSnapshot, initialData, isSaving = false }) => {
  const {
    classesData,
    selectedClasses,
    selectedCategories,
    groupedFormulas,
    toggleClass,
    selectAllClasses,
    deselectAllClasses,
    toggleCategory,
    getSelectedFormulasList,
    clearSelections,
    reorderClass,
    reorderFormula,
    removeClassFromOrder,
    removeSingleFormula,
    selectedCount,
    hasSelectedClasses
  } = useFormulas(initialData);

  const {
    title,
    setTitle,
    content,
    contentModified,
    contentSource,
    canRegenerateFromSelections,
    hasLayoutChanges,
    handleContentChange,
    columns,
    setColumns,
    fontSize,
    setFontSize,
    spacing,
    setSpacing,
    margins,
    setMargins,
    orientation,
    setOrientation,
    pdfBlob,
    isCompiling,
    compileError,
    goBack,
    goForward,
    handlePreview,
    handleCompileOnly,
    handleDownloadPDF,
    handleDownloadTex,
    handlePrintPDF,
    clearLatex
  } = useLatex(initialData);

  const [showLatex, setShowLatex] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [modalVideo, setModalVideo] = useState(null);
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [panelLayout, setPanelLayout] = useState(() => loadPanelLayout());
  const [videoSearchRequest, setVideoSearchRequest] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [toast, setToast] = useState(null);
  const [classesCollapseSignal, setClassesCollapseSignal] = useState(0);
  const pendingPanelLayoutRef = useRef(panelLayout);
  const hasCollapsedLeftPanelOnceRef = useRef(false);
  const lastAutoSavedPdfRef = useRef(null);
  const lastVideoOpenerRef = useRef(null);
  const modalDialogRef = useRef(null);
  const appBodyRef = useRef(null);
  const centerPanelRef = useRef(null);
  const compileBtnRef = useRef(null);
  const snapshots = useMemo(() => [...(initialData?.compileHistory || [])].reverse(), [initialData?.compileHistory]);
  const selectedClassNames = useMemo(
    () => classesData.filter((cls) => selectedClasses[cls.name]).map((cls) => cls.name),
    [classesData, selectedClasses],
  );
  const selectedVideoTopics = useMemo(() => (
    classesData.flatMap((cls) => (
      (cls.categories || [])
        .filter((category) => selectedCategories[`${cls.name}:${category.name}`])
        .map((category) => ({ className: cls.name, category: category.name }))
    ))
  ), [classesData, selectedCategories]);
  const selectedVideoTopicKey = useMemo(
    () => selectedVideoTopics.map((topic) => `${topic.className}:${topic.category}`).join('|'),
    [selectedVideoTopics],
  );
  const curatedVideoResources = useMemo(
    () => getCuratedVideosForTopics(selectedVideoTopics),
    [selectedVideoTopics],
  );
  const { resources: searchedVideoResources, isLoading: isLoadingVideos, error: videoError } = useYouTubeResources(videoSearchRequest);
  const curatedVideoKeys = useMemo(
    () => new Set(curatedVideoResources.map((video) => getVideoResourceKey(video))),
    [curatedVideoResources],
  );
  const visibleSearchedVideoResources = useMemo(
    () => searchedVideoResources.filter((video) => !curatedVideoKeys.has(getVideoResourceKey(video))),
    [curatedVideoKeys, searchedVideoResources],
  );
  const handleClearVideoSearch = () => {
    setVideoSearchRequest(null);
  };
  const toastTimeoutRef = useRef(null);
  const showToast = useCallback((message, type = 'success') => {
    if (toastTimeoutRef.current){
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
       setToast(null);
       toastTimeoutRef.current = null;
     }, 3000);
    }, []);
    useEffect(() => () => {
     if (toastTimeoutRef.current) {
       clearTimeout(toastTimeoutRef.current);
       toastTimeoutRef.current = null;
     }
  }, []);
  const curatedVideosByTopic = useMemo(() => groupVideosByTopic(curatedVideoResources), [curatedVideoResources]);
  const searchedVideosByTopic = useMemo(() => groupVideosByTopic(visibleSearchedVideoResources), [visibleSearchedVideoResources]);
  const getEmbedUrl  = (id) => `https://www.youtube.com/embed/${id}?autoplay=1`;
  const getWatchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
  const hasSearchedVideos = Boolean(videoSearchRequest?.key);
  const searchedTopicKey = videoSearchRequest?.topicKey || '';

  const handleOpenVideo = useCallback((video, opener) => {
    lastVideoOpenerRef.current = opener || null;
    setModalVideo(video);
  }, []);

  const handleCloseVideo = useCallback(() => {
    setModalVideo(null);
    const refocusOpener = () => lastVideoOpenerRef.current?.focus();
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(refocusOpener);
    } else {
      refocusOpener();
    }
  }, []);


  const getSaveStatusText = () => {
    if (saveStatus === 'saving') return 'Saving...';
    if (saveStatus === 'offline') return 'Offline changes pending'
    if (saveStatus === 'saved' && lastSavedAt) {
      const diff = Date.now() - lastSavedAt;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Saved just now';
      if (minutes === 1) return 'Saved 1 min ago';
      return `Saved ${minutes} min ago`;
    }
    return '';
  };

  useEffect(() => {
    if (!initialData) return;
    if (initialData.title) setTitle(initialData.title);
    if (initialData.content) {
      handleContentChange(initialData.content);
    }
    if (initialData.columns) setColumns(initialData.columns);
    if (initialData.fontSize) setFontSize(initialData.fontSize);
    if (initialData.spacing) setSpacing(initialData.spacing);
    if (initialData.margins) setMargins(initialData.margins);
    if (initialData.orientation) setOrientation(initialData.orientation);
  }, [handleContentChange, initialData, setColumns, setFontSize, setMargins, setOrientation, setSpacing, setTitle]);

  useEffect(() => {
    const hasCompiledBefore = Boolean(initialData?.compileHistory?.length || pdfBlob || content.trim());
    if (hasCompiledBefore) return;
    if (!(UNTITLED_TITLE_REGEX.test(title) || !title.trim())) return;
    if (!selectedClassNames.length) return;

    const nextTitle = selectedClassNames.length === 1
      ? `${selectedClassNames[0]} Cheat Sheet`
      : `${selectedClassNames[0]} + ${selectedClassNames.length - 1} more Cheat Sheet`;

    if (title !== nextTitle) {
      setTitle(nextTitle);
    }
  }, [content, initialData?.compileHistory?.length, pdfBlob, selectedClassNames, setTitle, title]);

  useEffect(() => {
    setVideoSearchRequest(null);
  }, [selectedVideoTopicKey]);

  const handleSearchMoreVideos = (topic) => {
    if (!topic) return;

    setVideoSearchRequest({
      key: Date.now(),
      topicKey: getVideoTopicKey(topic),
      topics: [topic],
    });
  };

  useEffect(() => {
    const baseTitle = 'Cheat Sheet Generator';
    document.title = title?.trim()
      ? `${title.trim()} — ${baseTitle}`
      : baseTitle;
    return () => {
      document.title = baseTitle;
    };
  }, [title]);

  useEffect(() => {
    if (!modalVideo) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleCloseVideo();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = Array.from(
        modalDialogRef.current?.querySelectorAll('a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])') || [],
      );

      if (!focusableElements.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCloseVideo, modalVideo]);

  useEffect(() => {
    const clampToViewport = () => {
      const bodyWidth = appBodyRef.current?.clientWidth || window.innerWidth;

      setPanelLayout((current) => {
        const nextLayout = constrainPanelLayout(current, {
          bodyWidth,
          leftPanelVisible,
          rightPanelVisible,
          showLatex,
        });

        if (samePanelLayout(current, nextLayout)) {
          return current;
        }

        pendingPanelLayoutRef.current = nextLayout;
        localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(nextLayout));
        return nextLayout;
      });
    };

    clampToViewport();
    window.addEventListener('resize', clampToViewport);

    return () => window.removeEventListener('resize', clampToViewport);
  }, [leftPanelVisible, rightPanelVisible, showLatex]);

  useEffect(() => {
    if (!pdfBlob || compileError || lastAutoSavedPdfRef.current === pdfBlob) {
      return;
    }

    lastAutoSavedPdfRef.current = pdfBlob;
    setSaveStatus('saving');
    setLastSavedAt(Date.now());
    onSave({
      title,
      content,
      contentSource,
      columns,
      fontSize,
      spacing,
      margins,
      orientation,
      selectedFormulas: getSelectedFormulasList(),
      compileSnapshot: {
        title,
        content,
        contentSource,
        columns,
        fontSize,
        spacing,
        margins,
        orientation,
        selectedFormulas: getSelectedFormulasList(),
        compiledAt: new Date().toISOString(),
      },
    }, false)
      .then(() => {
        setSaveStatus('saved');
        setLastSavedAt(Date.now());
      }).catch((error) => {
      console.error('Failed to autosave compiled sheet', error);
      setSaveStatus('offline');
    });
  }, [columns, compileError, content, contentSource, fontSize, getSelectedFormulasList, margins, onSave, orientation, pdfBlob, spacing, title]);

  const startResize = useCallback((panel) => (event) => {
    event.preventDefault();

    const startX = event.clientX;
    const startLayout = panelLayout;
    pendingPanelLayoutRef.current = startLayout;
    const bodyWidth = appBodyRef.current?.clientWidth || window.innerWidth;
    const centerWidth = centerPanelRef.current?.clientWidth || 0;
    const minimumCenterWidth = showLatex ? MIN_SPLIT_CENTER_WIDTH : MIN_CENTER_WIDTH;
    const leftReserve = leftPanelVisible ? RESIZER_WIDTH : 0;
    const rightReserve = rightPanelVisible ? RESIZER_WIDTH : 0;
    const maxLeftWidth = Math.max(
      LEFT_PANEL_MIN_WIDTH,
      Math.min(
        LEFT_PANEL_MAX_WIDTH,
        bodyWidth - (rightPanelVisible ? startLayout.rightWidth + rightReserve : 0) - leftReserve - minimumCenterWidth,
      ),
    );
    const maxRightWidth = Math.max(
      RIGHT_PANEL_MIN_WIDTH,
      Math.min(
        RIGHT_PANEL_MAX_WIDTH,
        bodyWidth - (leftPanelVisible ? startLayout.leftWidth + leftReserve : 0) - rightReserve - minimumCenterWidth,
      ),
    );
    const maxLatexWidth = Math.max(
      LATEX_PANEL_MIN_WIDTH,
      Math.min(LATEX_PANEL_MAX_WIDTH, centerWidth - RESIZER_WIDTH - MIN_PREVIEW_WIDTH),
    );

    const handlePointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;

      setPanelLayout(() => {
        let nextLayout;

        if (panel === 'left') {
          nextLayout = {
            ...startLayout,
            leftWidth: clampPanelWidth(startLayout.leftWidth + deltaX, LEFT_PANEL_MIN_WIDTH, maxLeftWidth),
          };
        } else if (panel === 'right') {
          nextLayout = {
            ...startLayout,
            rightWidth: clampPanelWidth(startLayout.rightWidth - deltaX, RIGHT_PANEL_MIN_WIDTH, maxRightWidth),
          };
        } else {
          nextLayout = {
            ...startLayout,
            latexWidth: clampPanelWidth(startLayout.latexWidth + deltaX, LATEX_PANEL_MIN_WIDTH, maxLatexWidth),
          };
        }

        pendingPanelLayoutRef.current = nextLayout;
        return nextLayout;
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.classList.remove('is-resizing-panels');
      localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(pendingPanelLayoutRef.current));
    };

    document.body.classList.add('is-resizing-panels');
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [leftPanelVisible, panelLayout, rightPanelVisible, showLatex]);

  const appBodyGridTemplate = [
    leftPanelVisible ? `${panelLayout.leftWidth}px` : '0px',
    leftPanelVisible ? '10px' : '0px',
    'minmax(0, 1fr)',
    rightPanelVisible ? '10px' : '0px',
    rightPanelVisible ? `${panelLayout.rightWidth}px` : '0px',
  ].join(' ');

  const workspaceSplitTemplate = `minmax(${LATEX_PANEL_MIN_WIDTH}px, ${panelLayout.latexWidth}px) 10px minmax(${MIN_PREVIEW_WIDTH}px, 1fr)`;
  const previewLayoutSignature = `${appBodyGridTemplate}|${workspaceSplitTemplate}|${leftPanelVisible}|${rightPanelVisible}|${showLatex}`;
    useEffect(() => {
      if (!pdfBlob || isCompiling) return;
      const btn = compileBtnRef.current;
      if (!btn) return;
      btn.classList.add('compile-success');
      const timer = setTimeout(() => {
        btn.classList.remove('compile-success');
      }, 600);
      return () => clearTimeout(timer);
    }, [pdfBlob, isCompiling]);
  const handleCompileClick = useCallback(() => {
    if (!hasCollapsedLeftPanelOnceRef.current) {
      // First compile: keep controls reachable while reclaiming preview space.
      hasCollapsedLeftPanelOnceRef.current = true;
      setClassesCollapseSignal((current) => current + 1);
      setPanelLayout((current) => {
        const nextLayout = {
          ...current,
          leftWidth: LEFT_PANEL_MIN_WIDTH,
        };

        pendingPanelLayoutRef.current = nextLayout;
        localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(nextLayout));
        return nextLayout;
      });
    }

    const selectedFormulas = getSelectedFormulasList();
    if (!contentModified && canRegenerateFromSelections && selectedFormulas.length > 0) {
      handlePreview(null, { formulas: selectedFormulas, columns, fontSize, spacing });
      return;
    }

    handleCompileOnly(selectedFormulas);
  }, [canRegenerateFromSelections, columns, contentModified, fontSize, getSelectedFormulasList, handleCompileOnly, handlePreview, spacing]);

  const handleSave = useCallback(async (e) => {
    e?.preventDefault?.();
    setSaveStatus('saving');
    try {
      await onSave({
        title,
        content,
        contentSource,
        columns,
        fontSize,
        spacing,
        margins,
        orientation,
        selectedFormulas: getSelectedFormulasList(),
      });
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
      showToast('Cheat sheet saved successfully!');
    } catch {
      setSaveStatus('offline');
      showToast('Failed to save. Please try again.', 'error');
    }
  }, [columns, content, contentSource, fontSize, getSelectedFormulasList, margins, onSave, orientation, showToast, spacing, title]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat) {
        return;
      }

      const isModifierPressed = event.ctrlKey || event.metaKey;
      const normalizedKey = typeof event.key === 'string' ? event.key.toLowerCase() : '';

      if (!isModifierPressed) {
        return;
      }

      if (normalizedKey === 'enter') {
        event.preventDefault();
        if (!isCompiling) handleCompileClick();
        return;
      }

      if (normalizedKey === 's') {
        event.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCompileClick, handleSave, isCompiling]);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear everything? This cannot be undone.')) {
      clearLatex();
      clearSelections();
      onReset?.();
    }
  };

  return (
    <>
      <div className="app-shell">

       <div className="app-body" ref={appBodyRef} style={{ '--app-body-columns': appBodyGridTemplate }}>

          {/* ══ LEFT PANEL ══ */}
          {leftPanelVisible && (
          <aside className="left-panel">
            <div className="left-panel-scroll">
             <div className="form-group left-panel-title-group">
              <div className="title-header-row">
              <label htmlFor="title">Title:</label>
              <div className="title-char-counter">
                <span className={title.length > 70 ? 'title-char-counter-warn' : ''}>
                {title.length}/80
                </span>
              </div>
            </div>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Cheat Sheet"
            required
            className="input-field"
            maxLength={80}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
              <FormulaSelection
                classesData={classesData}
                selectedClasses={selectedClasses}
                selectedCategories={selectedCategories}
                groupedFormulas={groupedFormulas}
                toggleClass={toggleClass}
                selectAllClasses={selectAllClasses}
                deselectAllClasses={deselectAllClasses}
                toggleCategory={toggleCategory}
                selectedCount={selectedCount}
                hasSelectedClasses={hasSelectedClasses}
                onReorderClass={reorderClass}
                onReorderFormula={reorderFormula}
                onRemoveClass={removeClassFromOrder}
                onRemoveFormula={removeSingleFormula}
                collapseClassesSignal={classesCollapseSignal}
              />

              <LayoutOptions
                columns={columns}
                setColumns={setColumns}
                fontSize={fontSize}
                setFontSize={setFontSize}
                spacing={spacing}
                setSpacing={setSpacing}
                margins={margins}
                setMargins={setMargins}
                orientation={orientation}
                setOrientation={setOrientation}
              />

            </div>

            {/* Footer buttons */}
            <div className="left-panel-footer">
              <button
                ref={compileBtnRef}
                type="button"
                onClick={handleCompileClick}
                className={`btn-compile ${isCompiling ? 'is-compiling' : ''}`}
                disabled={isCompiling}
                aria-label="Compile PDF"
                title="Generate LaTeX and compile to PDF. First compile will auto-generate from your current selected subjects."
              >
                <span className="btn-compile-icon">{isCompiling ? '↻' : ''}</span>
                <span className="btn-compile-text">
                {isCompiling ? 'Compiling…' :  (
                  <>
                  GET CHEAT SHEET 
                  <span className="btn-compile-hint"> Ctrl + ↵</span>
                  </>

                )}
                </span>
              </button>

              <div className="button-row">
                <button
                  type="button"
                  onClick={goBack}
                  className="btn history-btn"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={goForward}
                  className="btn history-btn"
                >
                  Forward
                </button>
              </div>

              {pdfBlob && (
                <div className="btn-download-row">
                  <button type="button" onClick={handlePrintPDF} className="btn-dl">Print</button>
                  <button type="button" onClick={handleDownloadPDF} className="btn-dl">Download PDF</button>
                  <button type="button" onClick={handleDownloadTex} className="btn-dl">.tex</button>
                </div>
              )}

              <div className="button-row">
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn history-btn"
                  disabled={isSaving}
                  title="Save (Ctrl + S)"
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="btn clear"
                >
                  Clear
                </button>
              </div>
            </div>
          </aside>
)}
          {leftPanelVisible ? (
            <button
              type="button"
              className="panel-resizer panel-resizer-vertical panel-resizer-left"
              onPointerDown={startResize('left')}
              aria-label="Resize subject panel"
            />
          ) : (
            <div className="panel-resizer-slot panel-resizer-left" aria-hidden="true" />
          )}
          {/* ══ CENTER PANEL — PDF main focus ══ */}
          <main className="center-panel" ref={centerPanelRef}>
            <div className="workspace-topbar">
              <div className="workspace-topbar-group">
                <button
                  type="button"
                  className="btn-toggle-panel"
                  onClick={() => setLeftPanelVisible(v => !v)}
                  title={leftPanelVisible ? 'Hide subjects' : 'Show subjects'}
                >
                  {leftPanelVisible ? 'Hide subjects' : 'Show subjects'}
                </button>
                <button
                  type="button"
                  className="btn-toggle-panel"
                  onClick={() => setShowSnapshots((value) => !value)}
                  disabled={!snapshots.length}
                >
                  Snapshots {snapshots.length ? `(${snapshots.length})` : ''}
                </button>
                {content && (
                  <button
                    type="button"
                    className="btn-toggle-latex btn-toggle-latex-prominent"
                    onClick={() => setShowLatex(v => !v)}
                  >
                    {showLatex ? 'Hide LaTeX editor' : 'Show LaTeX editor'}
                  </button>
                )}
              </div>

              <div className="workspace-topbar-group workspace-topbar-group-end">
                <span className="save-status">
                  {getSaveStatusText()}
                </span>
                <button
                  type="button"
                  className="btn-toggle-panel"
                  onClick={handlePrintPDF}
                  disabled={!pdfBlob}
                >
                  Print
                </button>
                <button
                  type="button"
                  className="btn-toggle-panel"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn-toggle-panel btn-toggle-videos"
                  onClick={() => setRightPanelVisible((value) => !value)}
                  title={rightPanelVisible ? 'Hide videos' : 'Show videos'}
                >
                  {rightPanelVisible ? 'Hide videos' : 'Show videos'}
                </button>
              </div>
            </div>

            {showSnapshots && snapshots.length > 0 && (
              <SnapshotTray
                snapshots={snapshots}
                onRestore={(snapshot) => {
                  setShowSnapshots(false);
                  onRestoreSnapshot?.(snapshot);
                }}
              />
            )}

             <div className="pdf-container">
               {showLatex ? (
                 <div className="workspace-split" style={{ '--workspace-split-columns': workspaceSplitTemplate }}>
                   <div className="workspace-split-pane workspace-split-pane-latex">
                     <LatexEditor
                       content={content}
                       onChange={handleContentChange}
                       isModified={contentModified || hasLayoutChanges}
                       compileError={compileError}
                     />
                   </div>
                   <button
                     type="button"
                     className="panel-resizer panel-resizer-vertical panel-resizer-inner"
                     onPointerDown={startResize('latex')}
                     aria-label="Resize LaTeX panel"
                   />
                   <div className="workspace-split-pane workspace-split-pane-preview">
                     {pdfBlob || compileError || isCompiling ? (
                       <PdfPreview
                          pdfBlob={pdfBlob}
                          compileError={compileError}
                          isCompiling={isCompiling}
                          layoutSignature={previewLayoutSignature}
                        />
                     ) : (
                       <div className="pdf-placeholder">
                         <span>📄</span>
                         <p>Select a subject, pick categories, then compile</p>
                         <p>Your PDF will appear here</p>
                         <p>Compile will generate the first draft if the editor is still empty.</p>
                       </div>
                     )}
                   </div>
                 </div>
               ) : (
                 <>
                   {pdfBlob || compileError || isCompiling ? (
                     <PdfPreview
                        pdfBlob={pdfBlob}
                        compileError={compileError}
                        isCompiling={isCompiling}
                        layoutSignature={previewLayoutSignature}
                      />
                   ) : (
                     <div className="pdf-placeholder">
                       <span>📄</span>
                       <p>Select a subject, pick categories, then compile</p>
                       <p>Your PDF will appear here</p>
                       <p>Compile will generate the first draft if the editor is still empty.</p>
                     </div>
                   )}
                 </>
               )}
             </div>
          </main>

          {rightPanelVisible ? (
            <button
              type="button"
              className="panel-resizer panel-resizer-vertical panel-resizer-right"
              onPointerDown={startResize('right')}
              aria-label="Resize video panel"
            />
          ) : (
            <div className="panel-resizer-slot panel-resizer-right" aria-hidden="true" />
          )}

          {rightPanelVisible && (
            <aside className="right-panel">
              <div className="right-panel-header">
                Videos
                {selectedVideoTopics.length > 0 && (
                 <span className="right-panel-count-badge">
                    {selectedVideoTopics.length}
                 </span>
                )}
              </div>
              <div className="right-panel-scroll">
                {!selectedVideoTopics.length && (
                  <div className="right-panel-empty-state">
                    <span className="right-panel-empty-icon">🎬</span>
                    <p className="right-panel-empty-title">No sections selected</p>
                    <p className="right-panel-empty-hint">
                    Select a subject and check some sections on the left to see related videos here.
                      </p>
                  </div>
                )}
                {selectedVideoTopics.map((topic) => {
                  const topicKey = getVideoTopicKey(topic);
                  const curatedVideos = curatedVideosByTopic[topicKey] || [];
                  const searchedVideos = searchedVideosByTopic[topicKey] || [];
                  const isSearchingTopic = isLoadingVideos && searchedTopicKey === topicKey;
                  const hasSearchedTopic = hasSearchedVideos && searchedTopicKey === topicKey;

                  return (
                    <div key={topicKey} className="subject-video-group">
                      <div className="subject-video-label" title={`${topic.className} · ${topic.category}`}>
                        {topic.category}
                      </div>
                      <SectionVideoPicks
                        className={topic.className}
                        category={topic.category}
                        curatedVideos={curatedVideos}
                        searchedVideos={searchedVideos}
                        onOpen={handleOpenVideo}
                        onSearchMore={handleSearchMoreVideos}
                        onClearSearch={handleClearVideoSearch}
                        isSearching={isSearchingTopic}
                        searchError={hasSearchedTopic ? videoError : ''}
                        hasSearched={hasSearchedTopic}
                        allowSearch
                        compact
                      />
                    </div>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ══ VIDEO MODAL ══ */}
      {modalVideo && (
        <div className="modal-overlay" onClick={handleCloseVideo}>
          <div
            className="modal-box"
            ref={modalDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={handleCloseVideo} autoFocus>✕</button>
            <h4 id="video-modal-title">{modalVideo.title}</h4>
            <iframe
              width="100%"
              height="400"
              src={getEmbedUrl(modalVideo.videoId)}
              title={modalVideo.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <div className="modal-meta">{modalVideo.channel} · {modalVideo.category || modalVideo.topic || 'General review'}</div>
            <a
              className="modal-link"
              href={getWatchUrl(modalVideo.videoId)}
              target="_blank"
              rel="noreferrer"
            >
              Open on YouTube
            </a>
          </div>
        </div>
      )}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="alert" aria-live="polite">
          <span className="toast-icon">
            {toast.type === 'success' ? '✓' : '✕'}
          </span>
          <span className="toast-message">{toast.message}</span>
        </div>
      )}
    </>
  );
};

export default CreateCheatSheet;
