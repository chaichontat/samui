# Samui Frontend – How It Works

## Architecture Snapshot

- **SvelteKit app**: `src/routes` hosts top-level routes; `MainPage.svelte` is the entry point for both `/` and `/from`.
- **Shared state**: A single module (`src/lib/store.ts`) exports all writable stores that coordinate samples, overlays, annotations, events, and UI toggles.
- **Map engine**: `src/lib/ui/mapp.ts` wraps OpenLayers with “persistent layers” (background imagery, active spot highlight, ROI tools). A `Mapp` instance is created in `src/pages/mapp.svelte` for each visible map tile.
- **Lazy loading**: Heavy components such as the map, sidebar panels, plots, and colorbar are imported with `await import()` so the initial load stays light.
- **Bits UI**: Selects, checkboxes, popovers, and tooltips come from Bits UI. Always consult Context7 docs before using or altering these components.

## Core Stores and Reactive Model

`src/lib/store.ts` defines the unified data model. The stores most agents interact with are:

- `samples`, `mapIdSample`, `sSample`: Track the list of loaded `Sample` objects, the chosen sample per map tile, and the currently focused sample. `src/lib/store.svelte` recomputes `sSample` whenever either the active map ID or the sample list changes.
- `overlays`, `sOverlay`, `overlaysFeature`: Manage the collection of `WebGLSpots` overlays, the active overlay ID, and the active feature metadata for each overlay.
- `sFeatureData`: Holds the processed payload returned by `Sample.getFeature` (data array, coords, metadata) for the active overlay; it is the canonical source for sidebar plots, tooltips, and annotations.
- `hoverSelect`: A `HoverSelect<FeatureAndGroup>` helper that stores both hovered and selected feature. `setHoverSelect` wraps updates with `oneLRU` to prevent redundant state churn and guards against accidental feature switches during annotation.
- `annoROI`, `annoFeat`, `mask`, `sPixel`, `sId`: Provide annotation state, mask filters, and cursor context that map and sidebar components react to.
- `sEvent`: A single event bus (documented later in this file) that coordinates cross-component side effects such as render completion, overlay refreshes, and mask updates.

Because these are Svelte stores, components usually import what they need and reference them via `$storeName`. When mutating arrays or objects in place, note the pattern of reassigning (`$samples = $samples;`) to trigger subscribers.

## Sample Lifecycle

1. **Bootstrapping defaults**: `/visiumif` runs `preload` (`src/lib/data/preload.ts`), which fetches default sample manifests, rewrites relative URLs, and populates `samples`.
2. **URL-driven loading**: `MainPage.svelte` parses `?url` and `&s=` query parameters via `getSampleListFromQuery`, fetches each `Sample`, and appends them to `samples` when the route mounts.
3. **Bring your own data (BYOD)**:
   - Drag-and-drop in `MainPage` calls `processHandle` (`src/lib/data/byod.ts`), which either ingests a folder (`processFolder`) or recognises annotation CSV/JSON payloads.
   - `processFolder` instantiates a `Sample`, checks for duplicates, pushes it into `samples`, and rewrites every `mapIdSample` entry so all map tiles switch to the new dataset.
4. **Sample selection in the UI**: `SampleList` (`src/lib/components/sampleList.svelte`) renders a Bits UI select. Its `change` event mutates `mapIdSample[hieN]`, which flows through `src/lib/store.svelte` to update `sSample`.

## Map Rendering Pipeline

- Each map tile is described by `Hierarchy` objects. `src/pages/mapTile.svelte` keeps track of the active tile ID (`sMapId`), binds a `SampleList` to change datasets, and lazily instantiates `mapp.svelte`.
- `src/pages/mapp.svelte` creates a new `Mapp` instance, mounts it onto the DOM when the component mounts, and hydrates the selected sample (`sample?.hydrate().then(updateSample)`).
- `Mapp.updateSample` handles three responsibilities:
  1. Hydrate imagery and overlays via their `hydrate`/`update` methods.
  2. Ensure at least one overlay is present; if not, it creates a `WebGLSpots` layer and sets `sOverlay`.
  3. Choose or restore a default feature, pushing it through `setHoverSelect({ selected })` so downstream consumers load the data.
- `WebGLSpots.update` fetches feature data (`Sample.getFeature`), rebuilds vector features if coordinates changed, updates WebGL style variables, and writes the result to both `sFeatureData` and `sEvent`.
- Map interactions (`pointermove`, `click`) are throttled and delegated through the `Mapp.listeners` array. `mapp.svelte` listens for hover ID updates via `changeHover`, displays a tooltip using the current `sFeatureData`, and highlights the active point layer.

## Feature Selection & Overlay Management

- `hoverSelect` keeps hovered/selected feature pairs. `setHoverSelect` debounces hover updates (_setHover) and flushes once selections happen so the map state is authoritative.
- `src/lib/store.svelte` watches `$hoverSelect.active` and copies that into `overlaysFeature[$sOverlay]`. This tiny component forms the bridge between sidebar selection widgets and the map engine.
- The sidebar search area combines group selection (`Select.Root`) and fuzzy matching (`fzf`). The result of a click is always routed through `setHoverSelect`, maintaining a single path for selection state.
- `overlayTool.svelte` renders each overlay row with Bits UI checkboxes for fill/outline visibility, a popover for color-map adjustments, and an input range for opacity. It mutates `$overlays`, `$sOverlay`, and notifies the event bus when necessary.
- When overlays are added or removed (`Add Layer` button, delete icon), the component edits `$overlays` and ensures `sOverlay` points to a valid layer before triggering `featureUpdated`.

## Image & Display Controls

- `ImgControl.svelte` manages channel selection and RGB adjustments using Svelte 5 runes. It clones controller state via `$derived.by` and `cloneController`, applies it to `Background.updateStyle`, and auto-collapses the UI after inactivity.
- `Background` encapsulates the OpenLayers WebGL tile layer. It disposes and rebuilds sources, updates shader variables with throttled calls, and stores controller snapshots in `localStorage` for channel persistence across sessions.
- `MapTools` toggles the visibility of the image control (`userState.showImgControl`) and implements screenshot capture by temporarily hiding hover highlights (`sId`) and saving the rendered DOM via `html-to-image`.

## Annotation & Masking Flows

- `SharedAnnotate.svelte` binds either `annoROI` or `annoFeat` to the map’s drawing interactions, sets up keyboard handlers, and clears drawn features whenever a new sample loads (`sEvent.type === 'sampleUpdated'`).
- `AnnFeat.svelte` ensures the feature being annotated matches `sFeatureData.coords`, triggers drawing of points when labels exist, and provides exporters (`toCSV`, `toJSON`).
- `MutableSpots` mirrors polygon annotations onto individual spot points, applying colour cues and back-filling counts for the UI. Every change raises `sEvent` with `pointsAdded` so plots and counts recompute.
- Histogram components in `src/lib/sidebar/plot` write boolean arrays into `mask` and dispatch `maskUpdated`. `mapp.svelte` reacts by calling `updateMask` on the active overlay, dimming masked-out points.

## BYOD Inputs and External Files

- CSV detection (`processCSV`) can add new coordinate sets to the current sample or inject annotated points into existing overlays.
- JSON payloads validated with `valROIData` / `valAnnFeatData` repopulate ROI or feature annotations using the map’s persistent layers.
- All BYOD pathways require an active `Sample` and `Mapp`; user prompts guard the UX when prerequisites are missing.

## sEvent Contract

`sEvent` is the lightweight event bus the UI uses for cross-component side effects. The store (`src/lib/store.ts:115-129`) holds an object with a `type` field. Producers set the value, and consumers typically react inside `$:` blocks or subscriptions.

| Type              | Producer(s)                                                                                                                                            | Primary Consumers                                                                                                                                                                                   | Purpose / Notes |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `sampleUpdated`   | `Mapp.updateSample` (`src/lib/ui/mapp.ts:150-162`), annotation loaders                                                                                 | `SharedAnnotate` clears drawings; `PlotMini` and other sidebar components refresh counts; layout subscriber updates `data-render-complete`. Signals that a new sample (and its overlays) are ready. |                 |
| `featureUpdated`  | `WebGLSpots.update` (`src/lib/ui/overlays/points.ts:200-205`), overlay removal (`overlayTool.svelte:194-207`)                                          | Colorbar refreshes (`src/lib/components/colorbar.svelte`); plots recompute histograms; selection UIs align with the new feature. Indicates the active overlay’s data changed.                       |                 |
| `overlayAdjusted` | Style setters (`WebGLSpots.setColorMap`, `.updateStyleVariables`) and opacity sliders                                                                  | Colorbar scales; map tooling can snapshot state; downstream consumers know visual presentation (min/max, colourmap) changed without fetching new data.                                              |                 |
| `maskUpdated`     | Histogram brush callbacks (`src/lib/sidebar/plot/plot.svelte:122-167`, `src/lib/sidebar/plot/histogram.ts`)                                            | `mapp.svelte` applies mask to active overlay (`src/pages/mapp.svelte:99-101`); plots keep brush UI consistent. Represents a change in the active data mask.                                         |                 |
| `pointsAdded`     | Annotation systems (`AnnFeat.draw`, `MutableSpots.add/remove`, `Draww` operations)                                                                     | Annotation counters recompute; ROI previews refresh; mask/plot components may update counts. Fired whenever annotation geometry or labels change.                                                   |                 |
| `viewAdjusted`    | (Reserved) Planned for viewport sync—commented references remain in `store.svelte`. Currently unused but keep in mind for potential multi-map linkage. |                                                                                                                                                                                                     |                 |
| `renderComplete`  | OpenLayers `rendercomplete` handler in `Mapp.updateSample` (`src/lib/ui/mapp.ts:150-162`)                                                              | Layout sets `document.body.dataset.renderComplete`; `mapTile.svelte` stops sample loading spinners. Signals the map finished rendering after a sample/feature change.                               |                 |

**Usage guidelines**:

- Only emit an event once per user-visible action; rely on throttling (`oneLRU`, `throttle`) to avoid storms.
- When adding a new event type, document it here and audit every subscriber to prevent dangling assumptions.
- Consumers should treat `sEvent` as edge-triggered: read its current value, act, and then ignore until the next change.

## Practical Tips for Agents

1. **Start from the stores**: Before adding new UI, map your feature onto an existing store or extend the store module. Random local component state rarely survives because most panels need synchronized data.
2. **Reuse `setHoverSelect`**: Whether you build a button, menu, or plot interaction, funnel feature changes through this helper to avoid breaking annotation guards or duplicate fetches.
3. **Throttle IO-heavy flows**: Follow existing patterns (`oneLRU`, `throttle`, `debounce`) when reacting to pointer movement or range sliders to keep the map responsive.
4. **Consult Bits UI docs**: Any change to `Select`, `Checkbox`, `Popover`, or `Tooltip` components should cross-check the Context7 references linked in the repo instructions.
5. **Watch the event bus**: If your feature depends on render completion or sample hydration, hook into `sEvent` instead of adding bespoke callbacks. It is already exposed in `window.__SAMUI__.stores` for debugging.

With these reference points you should be able to trace data from ingestion, through reactive stores, to the rendered map and sidebar components. Extend or amend the sections above whenever new flows are introduced.

## Annotation Workflows

Samui exposes two complementary annotation systems that share UI scaffolding but operate on different layers of the map.

### Shared Infrastructure

- `SharedAnnotate.svelte` binds either `annoROI` or `annoFeat` to the corresponding OpenLayers controller (`Draww` for ROIs, `DrawFeature`/`MutableSpots` for feature labels). It manages draw-mode toggles, label prompts, keyboard listeners, and automatically clears annotations when the sample changes (`sEvent.type === 'sampleUpdated'`).
- `Mapp` instantiates persistent layers (`persistentLayers.rois`, `persistentLayers.annotations`) so drawn features remain across component rerenders. Colors derive from `d3.schemeTableau10`, indexed per label.
- Every change emits `sEvent = { type: 'pointsAdded' }`, giving sidebar counters and plots a single hook for refresh events.

### ROI Annotation (`annoROI` + `Draww`)

1. Labels and draw tools are rendered by `AnnROI.svelte`, which reuses `SharedAnnotate` for label creation (Point, Polygon, Circle options).
2. `Draww.changeDrawType` swaps the active OpenLayers `Draw` interaction; polygons and circles share the same stroke/fill styling. Committing a shape assigns the current label and raises `pointsAdded`.
3. Selection + keyboard controls (Escape, Delete, Backspace) are wired through `SharedAnnotate`. Editing a label updates all shapes with that label (`relabel`).
4. Export `toJSON` uses `Draww.dump()` to write a GeoJSON-style FeatureCollection with coordinates, label, and optional radius. Import (`Draww.loadFeatures`) validates sample name and `mPerPx`, appends missing labels to `annoROI.keys`, reconstructs geometries, and restyles them.

### Feature Annotation (`annoFeat` + `DrawFeature` + `MutableSpots`)

1. `AnnFeat.svelte` adds a “Select” tool on top of `SharedAnnotate`. Annotation is only allowed once a feature is selected and `annoFeat.annotating` is set, safeguarding against coord mismatches.
2. `DrawFeature.startDraw` receives the active `CoordsData` and connects `MutableSpots` to the overlay’s vector source so point annotations mirror overlay data.
3. Polygons add or remove labels from all enclosed points via `MutableSpots.addFromPolygon` / `modifyFromPolygon`. Individual points can be toggled in “Select” mode.
4. `MutableSpots` stores labels as comma-separated stacks, allowing multiple assignments per point while highlighting only the most recent. All mutations restyle the OpenLayers feature and emit `pointsAdded`.
5. CSV export (`toCSV`) leverages `MutableSpots.dump()`; imports (`MutableSpots.load`) validate IDs against the current coordinate set, add any new labels to `annoFeat.keys`, and reapply label assignments. BYOD CSV ingestion (in `processCSV`) funnels into the same pathway.

### Caveats & Unknowns

- Imports do not reconcile overlapping polygons or label conflicts beyond spatial membership checks; merging datasets may produce duplicates.
- Label prompts rely on `window.prompt` with a simple alphanumeric regex; UX around cancellation or international characters is limited.
- `MutableSpots.clear()` asks for confirmation via `prompt`, and any non-empty response proceeds, so a stray keystroke can lose work.
- ROI import validates sample name and `mPerPx` but not coordinate identifiers, so multiple coord sets with identical scale might slip through.
- Annotations live entirely in-memory until exported; there is no auto-save, undo/redo, or backend persistence.

Keep these constraints in mind if you extend annotations—especially around persistence, conflict resolution, or collaborative features.
