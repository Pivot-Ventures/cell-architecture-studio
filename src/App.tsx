import {
  ArrowRight,
  BookOpen,
  Box,
  Brain,
  Camera,
  ChevronDown,
  CircleDot,
  Gauge,
  EyeOff,
  Grid3X3,
  Heart,
  Info,
  Leaf,
  MessageCircle,
  Library,
  Microscope,
  Plus,
  RotateCcw,
  Scan,
  Search,
  Settings,
  Sparkles,
  Star,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CellScene, type SceneCapture } from "./components/CellScene";
import { cells, getCellById, type CellItem, type OrganelleItem, type ViewMode } from "./data/cells";
import { assetUrl } from "./lib/assets";
import { readJson, STORAGE_KEYS, writeJson } from "./lib/storage";
import { askTutor, tutorAvailable, type TutorState } from "./lib/tutor";

type ModeOption = {
  id: ViewMode;
  label: string;
  Icon: LucideIcon;
};

type StudioView = "gallery" | "library" | "notebooks" | "settings";

type Lightbox = {
  title: string;
  caption: string;
  src: string;
  filter: string;
};

type UserImage = {
  id: string;
  cellId: string;
  label: string;
  src: string;
};

type StudioSettings = {
  autoRotate: boolean;
  quality: "high" | "low";
  reduceMotion: boolean;
  preferSchematic: boolean;
};

const modeOptions: ModeOption[] = [
  { id: "mesh", label: "Full cell", Icon: Box },
  { id: "focus", label: "Focus: dim the other organelles", Icon: CircleDot },
  { id: "isolate", label: "Isolate: hide the other organelles", Icon: EyeOff },
];

const microscopeFilters: Record<string, string> = {
  "plant-light": "saturate(0.85) brightness(1.06) contrast(0.95)",
  "plant-stain": "hue-rotate(28deg) saturate(1.5) contrast(1.08)",
  electron: "grayscale(1) contrast(1.35) brightness(0.92)",
};

function microscopeFilter(pattern: string, label: string) {
  if (microscopeFilters[pattern]) return microscopeFilters[pattern];
  if (/electron/i.test(label)) return microscopeFilters.electron;
  if (/stain/i.test(label)) return "hue-rotate(-20deg) saturate(1.45) contrast(1.1)";
  return "saturate(0.9) brightness(1.05)";
}

const defaultSettings: StudioSettings = {
  autoRotate: true,
  quality: "high",
  reduceMotion: false,
  preferSchematic: false,
};

const initialCell = getCellById("animal");

function downloadDataUrl(name: string, href: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function Header({ cell, onOpenView, tutorReady, onResetProgress }: { cell: CellItem; onOpenView: (view: StudioView) => void; tutorReady: boolean; onResetProgress: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-orb" aria-hidden="true">
          <Sparkles size={26} />
        </div>
        <div>
          <h1>Cell Architecture Studio</h1>
          <p>Explore life at the microscopic level</p>
        </div>
      </div>

      <nav className="top-nav" aria-label="Primary">
        <button type="button" onClick={() => onOpenView("gallery")}>
          <Grid3X3 size={24} />
          <span>Gallery</span>
        </button>
        <button type="button" onClick={() => onOpenView("library")}>
          <Library size={24} />
          <span>Library</span>
        </button>
        <button type="button" onClick={() => onOpenView("notebooks")}>
          <BookOpen size={24} />
          <span>Notebooks</span>
        </button>
        <button type="button" onClick={() => onOpenView("settings")}>
          <Settings size={24} />
          <span>Settings</span>
        </button>
        <div className="avatar-wrap">
          <button className="avatar-button" type="button" aria-label="Learner menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <span className="avatar-core" style={{ background: cell.accentSoft }}>
              <span style={{ background: cell.accent }} />
            </span>
            <ChevronDown size={20} />
          </button>
          {menuOpen && (
            <div className="avatar-menu" role="menu">
              <p>{tutorReady ? "Signed in to EASI. The AI tutor is available." : "Not signed in to EASI. Open the studio from the EASI Human Atlas desk to use the AI tutor."}</p>
              <button type="button" role="menuitem" onClick={() => { onOpenView("notebooks"); setMenuOpen(false); }}>My notebooks</button>
              <button type="button" role="menuitem" onClick={() => { onResetProgress(); setMenuOpen(false); }}>Reset progress</button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

function MiniCell({ cell }: { cell: CellItem }) {
  const src = cell.renderImage?.url ?? cell.modelAsset?.previewUrl;
  if (src) {
    return (
      <span className="mini-cell has-preview" style={{ "--thumb": cell.accent } as CSSProperties}>
        <img src={assetUrl(src)} alt="" aria-hidden="true" loading="lazy" />
      </span>
    );
  }
  return (
    <span className={`mini-cell mini-cell-${cell.modelKind}`} style={{ "--thumb": cell.accent } as CSSProperties}>
      <span />
      <i />
      <b />
    </span>
  );
}

type SidebarProps = {
  selectedCell: CellItem;
  activeOrganelle: string;
  favorites: Set<string>;
  onSelectCell: (id: string) => void;
  onSelectOrganelle: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

function Sidebar({ selectedCell, activeOrganelle, favorites, onSelectCell, onSelectOrganelle, onToggleFavorite }: SidebarProps) {
  return (
    <aside className="left-rail">
      <section className="panel cell-type-panel">
        <div className="panel-heading">
          <span>
            <Leaf size={18} />
            Cell Types
          </span>
          <ChevronDown size={18} />
        </div>

        <div className="cell-list">
          {cells.map((cell) => {
            const selected = selectedCell.id === cell.id;
            return (
              <button className={`cell-row ${selected ? "is-active" : ""}`} type="button" key={cell.id} onClick={() => onSelectCell(cell.id)}>
                <MiniCell cell={cell} />
                <span className="cell-row-copy">
                  <strong>{cell.name}</strong>
                  <span>{cell.type}</span>
                </span>
                <span
                  className={`favorite-dot ${favorites.has(cell.id) ? "is-on" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleFavorite(cell.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleFavorite(cell.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Favorite ${cell.name}`}
                >
                  <Star size={18} fill="currentColor" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel organelle-panel">
        <div className="panel-heading">
          <span>
            <Sparkles size={16} />
            Organelles
          </span>
          <ChevronDown size={18} />
        </div>

        <div className="organelle-list">
          {selectedCell.organelles.map((organelle) => (
            <button className={`organelle-row ${activeOrganelle === organelle.id ? "is-active" : ""}`} type="button" key={organelle.id} onClick={() => onSelectOrganelle(organelle.id)}>
              <span className="color-dot" style={{ background: organelle.color }} />
              <span>{organelle.name}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

type StageProps = {
  cell: CellItem;
  activeOrganelle: string;
  viewMode: ViewMode;
  crossSection: boolean;
  sectionDepth: number;
  autoRotate: boolean;
  schematic: boolean;
  showLegend: boolean;
  settings: StudioSettings;
  resetKey: number;
  captureRef: React.MutableRefObject<SceneCapture | null>;
  onModeChange: (mode: ViewMode) => void;
  onCrossSectionChange: (value: boolean) => void;
  onSectionDepthChange: (value: number) => void;
  onAutoRotateChange: (value: boolean) => void;
  onSchematicChange: (value: boolean) => void;
  onSelectOrganelle: (id: string) => void;
  onReset: () => void;
  onToast: (message: string) => void;
  onAssetError: (message: string) => void;
};

function Stage({
  cell,
  activeOrganelle,
  viewMode,
  crossSection,
  sectionDepth,
  autoRotate,
  schematic,
  showLegend,
  settings,
  resetKey,
  captureRef,
  onModeChange,
  onCrossSectionChange,
  onSectionDepthChange,
  onAutoRotateChange,
  onSchematicChange,
  onSelectOrganelle,
  onReset,
  onToast,
  onAssetError,
}: StageProps) {
  const hasScan = Boolean(cell.modelAsset);
  const organelleModes = schematic || !hasScan;

  const chooseMode = (mode: ViewMode) => {
    if (mode !== "mesh" && !organelleModes) {
      onSchematicChange(true);
      onToast("Switched to the schematic cell, where organelles can be focused or isolated.");
    }
    onModeChange(mode);
  };

  const screenshot = () => {
    const data = captureRef.current?.screenshot();
    if (!data) {
      onToast("The stage is still loading. Try again in a moment.");
      return;
    }
    downloadDataUrl(`${cell.id}-cell-studio.png`, data);
    onToast("Screenshot saved.");
  };

  const exportGlb = async () => {
    onToast("Preparing the GLB file.");
    const blob = await captureRef.current?.exportGlb();
    if (!blob) {
      onToast("The specimen could not be exported yet.");
      return;
    }
    const url = URL.createObjectURL(blob);
    downloadDataUrl(`${cell.id}-cell-studio.glb`, url);
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    onToast(`GLB exported (${Math.max(1, Math.round(blob.size / 1024))} KB).`);
  };

  return (
    <main className="stage-column">
      <section className="stage-panel">
        <div className="stage-title">
          <div>
            <h2>{cell.name}</h2>
            <p>{cell.type}</p>
          </div>

          <div className="view-card">
            <span>View Mode</span>
            <div className="mode-switcher">
              {modeOptions.map(({ id, label, Icon }) => (
                <button key={id} type="button" className={viewMode === id ? "is-active" : ""} onClick={() => chooseMode(id)} title={label} aria-label={label}>
                  <Icon size={22} />
                </button>
              ))}
            </div>
            {hasScan && (
              <label className="toggle-line">
                <span>{schematic ? "Schematic cell" : "3D scan"}</span>
                <input type="checkbox" checked={!schematic} onChange={(event) => onSchematicChange(!event.target.checked)} />
                <i />
              </label>
            )}
            <label className="toggle-line">
              <span>Cross Section</span>
              <input type="checkbox" checked={crossSection} onChange={(event) => onCrossSectionChange(event.target.checked)} />
              <i />
            </label>
            {crossSection && (
              <label className="depth-line">
                <span>Cut depth</span>
                <input type="range" min="-1" max="1" step="0.02" value={sectionDepth} onChange={(event) => onSectionDepthChange(Number(event.target.value))} aria-label="Cut depth" />
                <output>{sectionDepth.toFixed(2)}</output>
              </label>
            )}
          </div>
        </div>

        <div className="canvas-wrap">
          <CellScene
            cell={cell}
            activeOrganelle={activeOrganelle}
            viewMode={viewMode}
            crossSection={crossSection}
            sectionDepth={sectionDepth}
            autoRotate={autoRotate}
            reduceMotion={settings.reduceMotion}
            quality={settings.quality}
            schematic={schematic}
            resetKey={resetKey}
            captureRef={captureRef}
            onAssetError={onAssetError}
          />
          {showLegend && (
            <div className="stage-legend" aria-label="Organelle legend">
              {cell.organelles.map((organelle) => (
                <button type="button" key={organelle.id} className={organelle.id === activeOrganelle ? "is-active" : ""} onClick={() => onSelectOrganelle(organelle.id)}>
                  <span style={{ background: organelle.color }} />
                  {organelle.name}
                </button>
              ))}
              {!organelleModes && <small>Organelle highlighting applies to the schematic cell.</small>}
            </div>
          )}
        </div>

        <div className="stage-toolbar">
          <button type="button" className={autoRotate ? "is-active" : ""} onClick={() => onAutoRotateChange(!autoRotate)}>
            <RotateCcw size={20} />
            Rotate
          </button>
          <button type="button" className={viewMode === "focus" ? "is-active" : ""} onClick={() => chooseMode(viewMode === "focus" ? "mesh" : "focus")}>
            <CircleDot size={20} />
            Isolate
          </button>
          <button type="button" className={viewMode === "isolate" ? "is-active" : ""} onClick={() => chooseMode(viewMode === "isolate" ? "mesh" : "isolate")}>
            <EyeOff size={20} />
            Hide Others
          </button>
          <button type="button" onClick={onReset}>
            <RotateCcw size={20} />
            Reset View
          </button>
        </div>

        <div className="export-toolbar">
          <button type="button" onClick={screenshot}>
            <Camera size={20} />
            Screenshot
          </button>
          <button type="button" onClick={() => void exportGlb()}>
            <Box size={20} />
            GLB Export
          </button>
        </div>
      </section>
    </main>
  );
}

type RightPanelProps = {
  cell: CellItem;
  activeOrganelle: string;
  favorites: Set<string>;
  mastery: number;
  viewedCellCount: number;
  viewedOrganelleCount: number;
  totalOrganelleCount: number;
  showLegend: boolean;
  tutor: TutorState;
  tutorPrompt: string;
  onToggleFavorite: (id: string) => void;
  onToggleLegend: () => void;
  onTutorPrompt: (prompt: string) => void;
};

function buildTutorPrompts(cell: CellItem, organelle: OrganelleItem) {
  return [
    `Explain how ${organelle.name} helps a ${cell.name} stay alive.`,
    `Quiz me on the visual differences between ${cell.name} and ${getCellById(cell.comparison).name}.`,
    `Guide me through finding ${organelle.name} inside the 3D model.`,
    `Connect ${cell.name} structure to one clinical observation without giving medical advice.`,
  ];
}

function RightPanel({
  cell,
  activeOrganelle,
  favorites,
  mastery,
  viewedCellCount,
  viewedOrganelleCount,
  totalOrganelleCount,
  showLegend,
  tutor,
  tutorPrompt,
  onToggleFavorite,
  onToggleLegend,
  onTutorPrompt,
}: RightPanelProps) {
  const organelle = cell.organelles.find((item) => item.id === activeOrganelle) ?? cell.organelles[0];
  const tutorPrompts = buildTutorPrompts(cell, organelle);

  return (
    <aside className="right-rail">
      <section className="panel details-panel">
        <div className="panel-heading detail-heading">
          <span>Organelle Details</span>
          <button type="button" onClick={() => onToggleFavorite(cell.id)} aria-label="Toggle favorite">
            <Heart size={22} fill={favorites.has(cell.id) ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="detail-hero">
          <span className="organelle-orb" style={{ background: organelle.color }} />
          <div>
            <h3>{organelle.name}</h3>
            <p>{organelle.subtitle}</p>
          </div>
        </div>

        <dl className="attribute-list">
          {organelle.attributes.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
          <div>
            <dt>Legend</dt>
            <dd>
              <button type="button" className={`mini-toggle ${showLegend ? "is-on" : ""}`} onClick={onToggleLegend} aria-pressed={showLegend} aria-label="Show the organelle legend on the stage" />
              <span className="detail-dot" style={{ background: organelle.color }} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel notes-panel">
        <div className="panel-heading">
          <span>Biological Notes</span>
        </div>
        <p>{organelle.note}</p>
        <div className="clinical-context">
          <span>Clinical Context</span>
          <p>{cell.clinicalContext}</p>
        </div>
        <div className="fun-fact">
          <span>Fun Fact: {organelle.fact}</span>
          <Sparkles size={18} />
        </div>
      </section>

      <section className="panel learning-panel">
        <div className="panel-heading">
          <span>
            <Brain size={17} />
            AI Tutor
          </span>
        </div>

        <div className="mastery-meter" style={{ "--progress": `${mastery}%` } as CSSProperties}>
          <div>
            <Gauge size={18} />
            <span>Mastery</span>
            <strong>{mastery}%</strong>
          </div>
          <i>
            <b />
          </i>
          <small>
            {viewedCellCount}/{cells.length} cells explored · {viewedOrganelleCount}/{totalOrganelleCount} organelles inspected
          </small>
        </div>

        <div className="lesson-focus">
          <span>
            <Target size={17} />
            Current lesson focus
          </span>
          <p>
            Locate <strong>{organelle.name}</strong>, explain its role, then compare it with the matching structure in {getCellById(cell.comparison).name}.
          </p>
        </div>

        <div className="tutor-prompt">
          <span>
            <MessageCircle size={17} />
            {tutor.status === "streaming" ? "EASI tutor is answering" : tutor.status === "done" ? "EASI tutor" : "Ask the EASI tutor"}
          </span>
          <p>{tutorPrompt}</p>
          {tutor.status === "streaming" && <div className="tutor-answer streaming">{tutor.text || "Thinking"}</div>}
          {tutor.status === "done" && (
            <div className="tutor-answer">
              {tutor.text.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              {tutor.sources && tutor.sources.length > 0 && <small>Grounded in: {tutor.sources.join(" · ")}</small>}
            </div>
          )}
          {tutor.status === "signin" && <div className="tutor-answer notice">Sign in to EASI and open the studio from the Human Atlas desk to ask the gpt-oss tutor.</div>}
          {tutor.status === "error" && <div className="tutor-answer notice">{tutor.message}</div>}
        </div>

        <div className="prompt-list">
          {tutorPrompts.map((prompt) => (
            <button type="button" key={prompt} onClick={() => onTutorPrompt(prompt)} disabled={tutor.status === "streaming"}>
              {prompt}
            </button>
          ))}
        </div>
      </section>

      <section className="panel occurrence-panel">
        <div className="panel-heading">
          <span>Where It Occurs</span>
        </div>
        <div className={`occurrence-art occurrence-${cell.occurrence.motif}`}>
          <span />
          <i />
          <b />
        </div>
        <h4>{cell.occurrence.title}</h4>
        <p>{cell.occurrence.body}</p>
      </section>
    </aside>
  );
}

type BottomPanelsProps = {
  cell: CellItem;
  userImages: UserImage[];
  onCompare: () => void;
  onOpenLightbox: (box: Lightbox) => void;
  onAddImage: (file: File) => void;
  onRemoveImage: (id: string) => void;
};

function BottomPanels({ cell, userImages, onCompare, onOpenLightbox, onAddImage, onRemoveImage }: BottomPanelsProps) {
  const comparedCell = getCellById(cell.comparison);
  const fileInput = useRef<HTMLInputElement>(null);
  const reference = assetUrl(`cell-renders/${cell.id === "whiteBlood" ? "white-blood" : cell.id}.png`);

  return (
    <section className="bottom-grid">
      <div className="panel microscope-panel">
        <div className="panel-heading">
          <span>
            Microscope View
            <Info size={16} />
          </span>
        </div>
        <div className="micro-card-row">
          {cell.microscope.map((image) => (
            <button
              type="button"
              key={image.label}
              className={`micro-card pattern-${image.pattern}`}
              style={{ "--micro": image.tone } as CSSProperties}
              onClick={() => onOpenLightbox({
                title: `${cell.name}: ${image.label}`,
                caption: `Reference render of the ${cell.name.toLowerCase()} shown as a ${image.label.toLowerCase()} view. Filters simulate the appearance of that microscope; the sample is an illustration, not a micrograph.`,
                src: reference,
                filter: microscopeFilter(image.pattern, image.label),
              })}
            >
              <span />
              <strong>{image.label}</strong>
            </button>
          ))}
          {userImages.map((image) => (
            <button
              type="button"
              key={image.id}
              className="micro-card user-card"
              onClick={() => onOpenLightbox({ title: `${cell.name}: ${image.label}`, caption: "Your uploaded image. It stays in this browser only.", src: image.src, filter: "none" })}
            >
              <img src={image.src} alt="" />
              <strong>{image.label}</strong>
              <i
                role="button"
                tabIndex={0}
                aria-label={`Remove ${image.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveImage(image.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemoveImage(image.id);
                  }
                }}
              >
                <X size={14} />
              </i>
            </button>
          ))}
          <button type="button" className="micro-card add-card" onClick={() => fileInput.current?.click()}>
            <Plus size={28} />
            <strong>Add Image</strong>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onAddImage(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="panel compare-panel">
        <div className="panel-heading">
          <span>
            Compare Cells
            <Info size={16} />
          </span>
        </div>
        <div className="compare-row">
          <div>
            <MiniCell cell={cell} />
            <span>
              <strong>{cell.name}</strong>
              <em>You are here</em>
            </span>
          </div>
          <b>VS</b>
          <div>
            <span>
              <strong>{comparedCell.name}</strong>
              <em>{comparedCell.type}</em>
            </span>
            <MiniCell cell={comparedCell} />
          </div>
        </div>
        <button type="button" className="comparison-button" onClick={onCompare}>
          Open Comparison View
          <ArrowRight size={20} />
        </button>
      </div>
    </section>
  );
}

function ModalShell({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div className={`comparison-modal ${wide ? "is-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose}>
          Close
        </button>
        <div className="comparison-modal-head">
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function ComparisonModal({ cell, onClose }: { cell: CellItem; onClose: () => void }) {
  const comparedCell = getCellById(cell.comparison);
  const currentOrganelle = cell.organelles.find((item) => item.id === cell.defaultOrganelle) ?? cell.organelles[0];
  const comparedOrganelle = comparedCell.organelles.find((item) => item.id === comparedCell.defaultOrganelle) ?? comparedCell.organelles[0];

  return (
    <ModalShell title="Comparison View" subtitle={`${cell.name} compared with ${comparedCell.name}`} onClose={onClose}>
      <div className="comparison-columns">
        {[cell, comparedCell].map((item) => {
          const organelle = item.id === cell.id ? currentOrganelle : comparedOrganelle;
          return (
            <section key={item.id}>
              <MiniCell cell={item} />
              <h4>{item.name}</h4>
              <p>{item.type}</p>
              <dl>
                <div>
                  <dt>Default focus</dt>
                  <dd>{organelle.name}</dd>
                </div>
                <div>
                  <dt>Main note</dt>
                  <dd>{organelle.subtitle}</dd>
                </div>
                <div>
                  <dt>Occurs in</dt>
                  <dd>{item.occurrence.title}</dd>
                </div>
                <div>
                  <dt>Organelles</dt>
                  <dd>{item.organelles.map((o) => o.name).join(", ")}</dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>
    </ModalShell>
  );
}

function GalleryView({ favorites, onSelect, onClose }: { favorites: Set<string>; onSelect: (id: string) => void; onClose: () => void }) {
  return (
    <ModalShell title="Gallery" subtitle="Every specimen in the studio. Choose one to open it on the stage." onClose={onClose} wide>
      <div className="gallery-grid">
        {cells.map((cell) => (
          <button type="button" key={cell.id} onClick={() => { onSelect(cell.id); onClose(); }} style={{ "--accent": cell.accent, "--accent-soft": cell.accentSoft } as CSSProperties}>
            <img src={assetUrl(`cell-renders/${cell.id === "whiteBlood" ? "white-blood" : cell.id}.png`)} alt="" loading="lazy" />
            <strong>{cell.name}</strong>
            <span>{cell.type} · {cell.organelles.length} organelles{cell.modelAsset ? " · 3D scan" : ""}</span>
            {favorites.has(cell.id) && <Star size={16} fill="currentColor" />}
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

function LibraryView({ onSelect, onClose }: { onSelect: (cellId: string, organelleId: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const entries = useMemo(() => {
    const list: Array<{ cell: CellItem; organelle: OrganelleItem }> = [];
    cells.forEach((cell) => cell.organelles.forEach((organelle) => list.push({ cell, organelle })));
    const q = query.trim().toLowerCase();
    return list
      .filter(({ cell, organelle }) => !q || `${organelle.name} ${organelle.subtitle} ${organelle.note} ${cell.name}`.toLowerCase().includes(q))
      .sort((a, b) => a.organelle.name.localeCompare(b.organelle.name) || a.cell.name.localeCompare(b.cell.name));
  }, [query]);

  return (
    <ModalShell title="Library" subtitle="Every organelle across the seven cells, with its role, size, and a fact to remember." onClose={onClose} wide>
      <label className="library-search">
        <Search size={16} />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search organelles, roles, or cells" />
      </label>
      <div className="library-list">
        {entries.map(({ cell, organelle }) => (
          <button type="button" key={`${cell.id}-${organelle.id}`} onClick={() => { onSelect(cell.id, organelle.id); onClose(); }}>
            <span className="color-dot" style={{ background: organelle.color }} />
            <span className="library-copy">
              <strong>{organelle.name} <em>in {cell.name}</em></strong>
              <span>{organelle.subtitle}. {organelle.attributes.map((a) => `${a.label}: ${a.value}`).join(" · ")}</span>
              <small>{organelle.fact}</small>
            </span>
            <ArrowRight size={16} />
          </button>
        ))}
        {!entries.length && <p className="empty-note">No organelle matches that search.</p>}
      </div>
    </ModalShell>
  );
}

function NotebooksView({ notes, activeCellId, onChange, onClose }: { notes: Record<string, string>; activeCellId: string; onChange: (cellId: string, text: string) => void; onClose: () => void }) {
  const [cellId, setCellId] = useState(activeCellId);
  const cell = getCellById(cellId);
  return (
    <ModalShell title="Notebooks" subtitle="Your notes per cell. Saved in this browser." onClose={onClose} wide>
      <div className="notebook-layout">
        <div className="notebook-tabs">
          {cells.map((item) => (
            <button type="button" key={item.id} className={item.id === cellId ? "is-active" : ""} onClick={() => setCellId(item.id)}>
              <MiniCell cell={item} />
              <span>{item.name}</span>
              {notes[item.id]?.trim() && <i aria-label="Has notes" />}
            </button>
          ))}
        </div>
        <div className="notebook-editor">
          <h4>{cell.name}</h4>
          <textarea value={notes[cellId] ?? ""} onChange={(event) => onChange(cellId, event.target.value)} placeholder={`Write what you noticed about the ${cell.name.toLowerCase()}: its organelles, what the microscope views showed, and what you still want to check.`} rows={12} />
          <small>{(notes[cellId] ?? "").length} characters</small>
        </div>
      </div>
    </ModalShell>
  );
}

function SettingsView({ settings, onChange, onResetProgress, onClose }: { settings: StudioSettings; onChange: (next: StudioSettings) => void; onResetProgress: () => void; onClose: () => void }) {
  const toggle = (key: keyof StudioSettings) => (
    <label className="toggle-line settings-line" key={key}>
      <span>
        {key === "autoRotate" && "Auto rotate specimens"}
        {key === "quality" && "High resolution rendering"}
        {key === "reduceMotion" && "Reduce motion"}
        {key === "preferSchematic" && "Open cells as schematic models"}
      </span>
      <input
        type="checkbox"
        checked={key === "quality" ? settings.quality === "high" : Boolean(settings[key])}
        onChange={(event) => onChange({ ...settings, [key]: key === "quality" ? (event.target.checked ? "high" : "low") : event.target.checked })}
      />
      <i />
    </label>
  );
  return (
    <ModalShell title="Settings" subtitle="Stage and learning preferences. Saved in this browser." onClose={onClose}>
      <div className="settings-list">
        {toggle("autoRotate")}
        {toggle("quality")}
        {toggle("reduceMotion")}
        {toggle("preferSchematic")}
        <p className="settings-help">Lower resolution and schematic models help on older laptops and phones. Reduce motion also stops the gentle float of the specimen.</p>
        <button type="button" className="danger-button" onClick={onResetProgress}>Reset mastery, favourites, and notes</button>
        <p className="settings-help">Cell Architecture Studio is MIT licensed. Specimen models come from NIH 3D and user-provided scans; see the project's ASSETS note for provenance.</p>
      </div>
    </ModalShell>
  );
}

function LightboxModal({ box, onClose }: { box: Lightbox; onClose: () => void }) {
  return (
    <ModalShell title={box.title} subtitle={box.caption} onClose={onClose} wide>
      <div className="lightbox-frame">
        <img src={box.src} alt={box.title} style={{ filter: box.filter }} />
      </div>
      <div className="lightbox-actions">
        <a href={box.src} download target="_blank" rel="noreferrer">Open full size</a>
      </div>
    </ModalShell>
  );
}

function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}

export default function App() {
  const [selectedCellId, setSelectedCellId] = useState(initialCell.id);
  const [activeOrganelle, setActiveOrganelle] = useState(initialCell.defaultOrganelle);
  const [viewMode, setViewMode] = useState<ViewMode>("mesh");
  const [crossSection, setCrossSection] = useState(false);
  const [sectionDepth, setSectionDepth] = useState(0.2);
  const [settings, setSettings] = useState<StudioSettings>(() => ({ ...defaultSettings, ...readJson<Partial<StudioSettings>>(STORAGE_KEYS.settings, {}) }));
  const [autoRotate, setAutoRotate] = useState(settings.autoRotate);
  const [schematic, setSchematic] = useState(settings.preferSchematic);
  const [showLegend, setShowLegend] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(readJson<string[]>(STORAGE_KEYS.favorites, [initialCell.id])));
  const [viewedCells, setViewedCells] = useState<Set<string>>(() => new Set(readJson<string[]>(STORAGE_KEYS.viewedCells, [initialCell.id])));
  const [viewedOrganelleKeys, setViewedOrganelleKeys] = useState<Set<string>>(() => new Set(readJson<string[]>(STORAGE_KEYS.viewedOrganelles, [`${initialCell.id}:${initialCell.defaultOrganelle}`])));
  const [notes, setNotes] = useState<Record<string, string>>(() => readJson<Record<string, string>>(STORAGE_KEYS.notes, {}));
  const [userImages, setUserImages] = useState<UserImage[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [view, setView] = useState<StudioView | null>(null);
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);
  const [tutor, setTutor] = useState<TutorState>({ status: "idle" });
  const [tutorPrompt, setTutorPrompt] = useState(`Guide me through finding ${initialCell.organelles[0].name} inside the 3D model.`);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const captureRef = useRef<SceneCapture | null>(null);

  const selectedCell = useMemo(() => getCellById(selectedCellId), [selectedCellId]);
  const totalOrganelleCount = useMemo(() => cells.reduce((total, cell) => total + cell.organelles.length, 0), []);
  const mastery = useMemo(() => {
    const cellCoverage = viewedCells.size / cells.length;
    const organelleCoverage = viewedOrganelleKeys.size / totalOrganelleCount;
    return Math.round((cellCoverage * 0.42 + organelleCoverage * 0.58) * 100);
  }, [totalOrganelleCount, viewedCells, viewedOrganelleKeys]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const selectCell = useCallback((id: string) => {
    const cell = getCellById(id);
    setSelectedCellId(id);
    setActiveOrganelle(cell.defaultOrganelle);
    setComparisonOpen(false);
    setTutor({ status: "idle" });
    setViewMode("mesh");
    setSchematic(settings.preferSchematic);
  }, [settings.preferSchematic]);

  useEffect(() => {
    setViewedCells((current) => {
      if (current.has(selectedCell.id)) return current;
      const next = new Set(current);
      next.add(selectedCell.id);
      writeJson(STORAGE_KEYS.viewedCells, [...next]);
      return next;
    });
    setViewedOrganelleKeys((current) => {
      const key = `${selectedCell.id}:${activeOrganelle}`;
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      writeJson(STORAGE_KEYS.viewedOrganelles, [...next]);
      return next;
    });
  }, [activeOrganelle, selectedCell.id]);

  useEffect(() => {
    writeJson(STORAGE_KEYS.settings, settings);
  }, [settings]);

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeJson(STORAGE_KEYS.favorites, [...next]);
      return next;
    });
  };

  const updateNote = (cellId: string, text: string) => {
    setNotes((current) => {
      const next = { ...current, [cellId]: text };
      writeJson(STORAGE_KEYS.notes, next);
      return next;
    });
  };

  const resetProgress = () => {
    setFavorites(new Set());
    setViewedCells(new Set([selectedCell.id]));
    setViewedOrganelleKeys(new Set([`${selectedCell.id}:${activeOrganelle}`]));
    setNotes({});
    writeJson(STORAGE_KEYS.favorites, []);
    writeJson(STORAGE_KEYS.viewedCells, [selectedCell.id]);
    writeJson(STORAGE_KEYS.viewedOrganelles, [`${selectedCell.id}:${activeOrganelle}`]);
    writeJson(STORAGE_KEYS.notes, {});
    showToast("Progress, favourites, and notes cleared.");
  };

  const addImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast("Images up to 8 MB are supported.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUserImages((current) => [...current, { id: `${Date.now()}`, cellId: selectedCell.id, label: file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 40) || "My image", src: String(reader.result) }]);
      showToast(`${file.name} added to the microscope view.`);
    };
    reader.readAsDataURL(file);
  };

  const runTutor = async (prompt: string) => {
    setTutorPrompt(prompt);
    if (!tutorAvailable()) {
      setTutor({ status: "signin" });
      return;
    }
    setTutor({ status: "streaming", text: "" });
    const organelle = selectedCell.organelles.find((item) => item.id === activeOrganelle) ?? selectedCell.organelles[0];
    const question = `${prompt}\n\nContext: the learner is looking at the ${selectedCell.name} (${selectedCell.type}) in the Cell Architecture Studio with the ${organelle.name} selected (${organelle.subtitle}). Answer for a secondary school biology student in under 160 words. Do not give medical advice.`;
    const result = await askTutor(question, `Cells: ${selectedCell.name}`, {
      onDelta: (text) => setTutor({ status: "streaming", text }),
    });
    setTutor(result);
  };

  const shellStyle = {
    "--accent": selectedCell.accent,
    "--accent-soft": selectedCell.accentSoft,
    "--cell-color": selectedCell.color,
  } as CSSProperties;

  return (
    <div className="app-shell" style={shellStyle}>
      <Header cell={selectedCell} onOpenView={setView} tutorReady={tutorAvailable()} onResetProgress={resetProgress} />

      <div className="app-grid">
        <Sidebar
          selectedCell={selectedCell}
          activeOrganelle={activeOrganelle}
          favorites={favorites}
          onSelectCell={selectCell}
          onSelectOrganelle={setActiveOrganelle}
          onToggleFavorite={toggleFavorite}
        />

        <div className="center-stack">
          <Stage
            cell={selectedCell}
            activeOrganelle={activeOrganelle}
            viewMode={viewMode}
            crossSection={crossSection}
            sectionDepth={sectionDepth}
            autoRotate={autoRotate}
            schematic={schematic}
            showLegend={showLegend}
            settings={settings}
            resetKey={resetKey}
            captureRef={captureRef}
            onModeChange={setViewMode}
            onCrossSectionChange={setCrossSection}
            onSectionDepthChange={setSectionDepth}
            onAutoRotateChange={setAutoRotate}
            onSchematicChange={setSchematic}
            onSelectOrganelle={setActiveOrganelle}
            onReset={() => {
              setResetKey((key) => key + 1);
              setCrossSection(false);
              setViewMode("mesh");
              showToast("View reset.");
            }}
            onToast={showToast}
            onAssetError={showToast}
          />
          <BottomPanels
            cell={selectedCell}
            userImages={userImages.filter((image) => image.cellId === selectedCell.id)}
            onCompare={() => setComparisonOpen(true)}
            onOpenLightbox={setLightbox}
            onAddImage={addImage}
            onRemoveImage={(id) => setUserImages((current) => current.filter((image) => image.id !== id))}
          />
        </div>

        <RightPanel
          cell={selectedCell}
          activeOrganelle={activeOrganelle}
          favorites={favorites}
          mastery={mastery}
          viewedCellCount={viewedCells.size}
          viewedOrganelleCount={viewedOrganelleKeys.size}
          totalOrganelleCount={totalOrganelleCount}
          showLegend={showLegend}
          tutor={tutor}
          tutorPrompt={tutorPrompt}
          onToggleFavorite={toggleFavorite}
          onToggleLegend={() => setShowLegend((value) => !value)}
          onTutorPrompt={(prompt) => void runTutor(prompt)}
        />
      </div>

      <footer className="studio-footer">
        <span>Cell Architecture Studio (MIT). Specimen models: NIH 3D and user-provided scans, see ASSETS.md. Reference renders are illustrations, not micrographs.</span>
        <span>Part of the EASI Human Atlas.</span>
      </footer>

      {comparisonOpen && <ComparisonModal cell={selectedCell} onClose={() => setComparisonOpen(false)} />}
      {view === "gallery" && <GalleryView favorites={favorites} onSelect={selectCell} onClose={() => setView(null)} />}
      {view === "library" && (
        <LibraryView
          onSelect={(cellId, organelleId) => {
            selectCell(cellId);
            setActiveOrganelle(organelleId);
          }}
          onClose={() => setView(null)}
        />
      )}
      {view === "notebooks" && <NotebooksView notes={notes} activeCellId={selectedCell.id} onChange={updateNote} onClose={() => setView(null)} />}
      {view === "settings" && (
        <SettingsView
          settings={settings}
          onChange={(next) => {
            setSettings(next);
            setAutoRotate(next.autoRotate);
            if (next.preferSchematic !== settings.preferSchematic) setSchematic(next.preferSchematic);
          }}
          onResetProgress={resetProgress}
          onClose={() => setView(null)}
        />
      )}
      {lightbox && <LightboxModal box={lightbox} onClose={() => setLightbox(null)} />}
      <Toast message={toast} />
    </div>
  );
}
