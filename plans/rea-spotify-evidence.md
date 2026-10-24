# REA Spotify xpui Reverse Engineering Evidence Ledger

**Target Artifact:** `./target_reference/spotify_xpui`  
**Root SHA-256:** `7b94674be8b7402b2c04c8662974eb6e7da5434ac042388f5ad81d66eda96f81`  
**Exported Evidence Bundle:** `plans/rea-evidence-bundle.json` (86,225,810 bytes, 4 records)  
**Analysis Engine:** REA (`morluto/rea`) via MCP

---

## 1. REA Evidence Record Ledger

| Evidence ID | Operation | Provider | Authority / Confidence | Role & Subject |
| :--- | :--- | :--- | :--- | :--- |
| `ev_4282e43a0abd59f9cd337fb6a3478bfe4738952c86c72d1209a2b9cf6056726b` | `analyze_javascript_application` | `rea-javascript-application` v1 | `shipped-artifact` / `derived` | Parent application graph covering `./target_reference/spotify_xpui`. Parsed 4 selected core bundles (`xpui-snapshot.js`, `dwp-now-playing-bar.js`, `dwp-panel-section.js`, `xpui-routes-your-library-x.js`), 230,845 AST nodes, 2,265 findings, 81 modules, 765KB text. |
| `ev_ae1da102074f7fb72a6b11fc43100729a8bda3d59f7a1d9ec56f66cb4ad827e3` | `inspect_analysis_view` | `rea-analysis-view` v1 | `shipped-artifact` / `derived` | Normalized summary projection of `ev_4282e43a0abd...`. Retains telemetry limits, AST parsing statistics, and module inventory. |
| `ev_2e58b0d47c33a9b823b20db14f84b6075063ad6de728c193ce92a975820f82d9` | `inspect_analysis_view` | `rea-analysis-view` v1 | `shipped-artifact` / `derived` | Module collection page (offset 0, limit 16) projecting extracted node IDs including `dwp-panel-section.js`, `xpui-routes-your-library-x.js`, and `dwp-now-playing-bar.js` (`jag_node_02ad03d2f156e6b5dbedeb4e7acebd094210ddc67d0e4e90da310730049cc41d`). |
| `ev_602b80453ec9911e8221ee87873a9025b4e99e0dc2a95eff855e27cdcf7c561c` | `trace_javascript_semantics` | `rea-javascript-application-workflows` v1 | `analyst-inference` / `inferred` | Backward-provenance semantic relationship trace on now-playing-bar seed (`jag_node_02ad03d2f156...`). Output exceeded standard stdio buffer (10.5MB+) and was retained in the session ledger and exported bundle. |

---

## 2. Extracted Spotify `xpui` 3-Pane Layout Geometry

Extracted directly from `xpui-snapshot.css`, `dwp-now-playing-bar.css`, and `dwp-panel-section.css`:

### 2.1 Root Grid Specification (`.PbMBx95owTmQYYdfnp3j`)
```css
.PbMBx95owTmQYYdfnp3j {
  --panel-gap: 8px;
  --left-sidebar-width: 280px; /* collapsible to 72px, expandable to 420px */
  --right-sidebar-width: 340px; /* collapsible to 0px, expandable to 420px */
  --top-bar-height: 64px;
  --now-playing-bar-height: 90px;
  --left-sidebar-grid-area-z-index: 4;
  --above-everything-except-now-playing-bar-z-index: 5;
  --now-playing-bar-grid-area-z-index: 6;
  --above-everything-grid-area-z-index: 7;

  display: grid;
  width: 100vw;
  height: 100vh;
  min-height: 100%;
  padding: var(--panel-gap);
  gap: var(--panel-gap);
  background-color: #000000; /* Pitch black outer frame */
  grid-template:
    "top-banner top-banner top-banner" auto
    "global-nav global-nav global-nav" auto
    "left-sidebar main-view right-sidebar" 1fr
    "now-playing-bar now-playing-bar now-playing-bar" auto / auto 1fr auto;
  position: relative;
  overflow: hidden;
}
```

### 2.2 Left Sidebar ("Your Library" Rail — `.nWqHVdNL4CdxyvxYNFI8`)
- **Grid Area:** `left-sidebar`
- **Collapsed Mode (Compact / Icon-only):** Width `72px`. Shows icon buttons, collapsed tooltips on hover (`tippy-box`).
- **Expanded Mode (Default):** Width `280px` - `420px` (resizable via draggable splitter bar `.LayoutResizer__resize-bar`).
- **Background & Shape:** `background-color: #121212`, `border-radius: 8px`.
- **Top Section:** Fixed header with "Your Library" icon + title, action buttons (`+` create playlist/smart playlist, collapse `<-` button).
- **Filter Chips Row (`dwp-home-chips-row.css`):** Horizontal scrollable pills: "Playlists", "Artists", "Albums" with `#282828` background, `#ffffff` text on active.
- **Library List:** Scrollable virtualized item list with active item highlight (`#ffffff1a`).

### 2.3 Center Viewport ("Main View" — `.BPRPH_jrStQIw2m2qfDl`)
- **Grid Area:** `main-view`
- **Background & Shape:** `background-color: #121212`, `border-radius: 8px`, `overflow: hidden`, `position: relative`.
- **Top Global Navigation Bar (`U8I4CSr5IjY1c7hIbTW1`):** Height `64px`, sticky over the scroll container. Contains:
  - Circular Back (`<`) and Forward (`>`) history buttons (32px circular buttons, `#000000b3`).
  - Search Input pill (`border-radius: 500px`, `#242424` background, hover `#2a2a2a`, active focus `#fff` outline).
  - User Profile pill / Settings button with avatar thumbnail.
- **Dynamic Ambient Gradient Header:**
  - Header dynamic gradient: `background: linear-gradient(to bottom, var(--hero-gradient-color, #535353) 0%, rgba(18, 18, 18, 0.8) 70%, #121212 100%)`.
  - On scroll down, the top bar smoothly transitions from transparent to solid `rgba(18, 18, 18, 0.95)` with backdrop blur.
- **Action Bar (`.gBlDqLsMJoywo1PBChSx`):**
  - Giant green circular Play button (56px, `#1DB954` background, `#000000` play triangle icon, hover scale 1.05).
  - Shuffle toggle button, Like heart button, More options `•••` dropdown.
- **Track List Table (`xpui-routes-collection-songs.css`):**
  - Header row: `#`, Title, Album, Date Added, Duration icon (`clock`).
  - Row hover background: `#ffffff1a` (or `rgba(255, 255, 255, 0.08)`).
  - Active track row text color: `#1DB954` / `#1ed760` with animated equalizer waves.

### 2.4 Right Context Panel ("Panel Section" — `.dMf_PkfPVTEuSmc11MZp` / `SwoI_U_X4O3wXD7db3su`)
- **Grid Area:** `right-sidebar`
- **Width:** `340px` (min 280px, max 420px, collapsible to 0px).
- **Background & Shape:** `background-color: #121212`, `border-radius: 8px`, `overflow: hidden`.
- **Header:** Height `64px`, tab title ("Now Playing View" / "Queue" / "Lyrics" / "10-Band EQ") with Close button (`X`).
- **Tab Content Views:**
  1. **Now Playing View:** Large cover art (`aspect-ratio: 1/1`), track title, artist credits, release date, and next-up card.
  2. **Dual Queue View:** "Now Playing" row, followed by "Next In Queue" (Priority user queue with drag handles), followed by "Next From: [Context]" (Context playlist queue), with "Clear Queue" and "Save Snapshot" buttons.
  3. **10-Band EQ View:** Interactive vertical gain sliders (31Hz, 62Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz) with real-time 60fps canvas frequency visualizer.
  4. **Synced Lyrics View:** Auto-scrolling lyrics with current line highlighted in bold white (`#FFFFFF`) with glowing ambient background, past/upcoming lines dimmed in `#ffffff80`.

### 2.5 Bottom Transport Bar (`.G0r21Xb5HbCgpzJwqiev` / `dhrE1Mg11rVzWEJ5Xy84`)
- **Grid Area:** `now-playing-bar`
- **Dimensions:** Container height `90px` (inner bar `72px`), spans all 3 columns.
- **Background:** `#000000` (pitch black, seamlessly docking underneath the rounded 8px panels).
- **3-Segment Flex Geometry:**
  - **Left Segment (30%, min 180px — `.GT3btISbKLXrhHILRLON`):**
    - 56x56 cover art with hover zoom / PiP button.
    - Title (`#FFFFFF`, 14px bold, truncate) + Artist byline (`#A7A7A7`, 12px, hover underline).
    - Heart / Favorite button (`#1DB954` when liked).
  - **Center Segment (40%, max 722px — `.Fv_NJY1uLWlqyJ8IKpAP`):**
    - Top Controls:
      - Shuffle Button (`IUYGQ1ar_HJsjBhthonA`): Active dot beneath icon (`.skPy8s8VBL2W3a3lo8zz:after`).
      - Previous Button: 32px icon.
      - Play/Pause Button: 32px solid white circle (`#FFFFFF`) with pitch black icon (`#000000`), hover scale 1.06.
      - Next Button: 32px icon.
      - Repeat Button: Off -> Repeat All -> Repeat 1 (with active dot indicator).
      - A-B Loop Button (Pulse Custom): Looping indicator with start/end bounds.
    - Bottom Scrubber Bar (`.sFPdqIr8t2xI75iScCuj` / `.uI8JyD_faatLr66nS5Cb`):
      - Elapsed time (e.g. `1:24`) on left, duration (e.g. `3:45`) on right in 11px `#A7A7A7`.
      - Bar height: `4px` resting (expands to `6px` on hover).
      - Track background: `#4d4d4d` / `rgba(255, 255, 255, 0.3)`.
      - Progress fill: `#ffffff` default, turns `#1DB954` on hover/active scrub.
      - Thumb: 12px white circle (`.qinWev06d0dPqPkQfCov`), hidden until hover or drag.
  - **Right Segment (30%, min 180px — `._rXd41iaM5t1x5IDLxCJ`):**
    - Now Playing View toggle icon button.
    - Lyrics toggle icon button (`t_` icon, active highlight green `#1DB954`).
    - Queue toggle icon button (`tM.j` icon, active highlight green `#1DB954`).
    - 10-Band EQ visualizer toggle button.
    - Volume control: Speaker icon (Mute/Unmute) + 96px slider bar.

---

## 3. Extracted CSS Tokens & Design System

```css
:root {
  /* Canvas & Containers */
  --spotify-black: #000000;
  --background-base: #121212;
  --background-highlight: #1a1a1a;
  --background-press: #000000;
  --background-elevated-base: #181818;
  --background-elevated-highlight: #282828;
  --background-elevated-press: #242424;
  --background-tinted-base: rgba(255, 255, 255, 0.07);
  --background-tinted-highlight: rgba(255, 255, 255, 0.1);

  /* Primary Accent & Brand */
  --essential-positive: #1db954;
  --essential-bright-accent: #1ed760;
  --spotify-green: #1db954;
  --spotify-green-hover: #1ed760;

  /* Text & Foreground */
  --text-base: #ffffff;
  --text-subdued: #a7a7a7;
  --text-subdued-dim: #b3b3b3;
  --text-bright-accent: #1ed760;

  /* Borders & Spacing */
  --panel-gap: 8px;
  --panel-radius: 8px;
  --pill-radius: 500px;
  --button-radius: 500px;
  --card-radius: 6px;

  /* Typography */
  --font-family: CircularSp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
```

---

## 4. Extracted Player State Transitions & Queue Reducer

Extracted from `dwp-now-playing-bar.js` and `dwp-watch-feed-view-container.js`:

### 4.1 Player State Model
```typescript
interface SpotifyPlayerState {
  item: {
    uri: string;
    uid: string | null;
    name: string;
    artists: { name: string; uri: string }[];
    album: { name: string; uri: string; coverArtUrl: string };
    durationSeconds: number;
    isLocal: boolean;
  } | null;
  playbackState: {
    isPlaying: boolean;
    isPaused: boolean;
    isBuffering: boolean;
    positionSeconds: number;
    volume: number;
    isMuted: boolean;
    playbackRate: number;
  };
  options: {
    shuffle: boolean;
    repeatMode: 'off' | 'context' | 'track';
  };
  queue: {
    priority: Array<{ uri: string; uid: string }>; // "Next Up" user queue
    context: Array<{ uri: string; uid: string }>;  // "Next From: Playlist"
    history: Array<{ uri: string; uid: string }>;
  };
}
```

### 4.2 Queue Reducer Actions & Transitions
- `addToQueue(items: Array<{ uri: string; uid: string }>)`: Appends tracks to the **priority user queue** (plays before remaining context tracks).
- `removeFromQueue(items: Array<{ uri: string; uid: string }>, byUid: boolean)`: Removes matching track instances from the priority queue.
- `reorderQueue(fromIndex: number, toIndex: number, queueType: 'priority' | 'context')`: Instant drag-and-drop reordering.
- `skipToNext()`:
  1. If `repeatMode === 'track'`, resets current position to `0`.
  2. If `priorityQueue.length > 0`, pops `priorityQueue[0]` as the new active track.
  3. Else if `contextQueue.length > 0`, advances to the next track in `contextQueue`.
  4. If end of `contextQueue` is reached and `repeatMode === 'context'`, loops back to the start of `contextQueue`.
- `skipToPrevious()`:
  - If `currentTime > 3.0s`, seeks back to `0.0s`.
  - Otherwise, pops the last item from `history` or moves to the previous track in `contextQueue`.

---

## 5. Verification & Audit Trail
- Bundle files analyzed statically without runtime side-effects using REA's JavaScript application analyzer.
- Complete canonical evidence bundle serialized and saved to `plans/rea-evidence-bundle.json`.
- All CSS variables and class names extracted verbatim from production Spotify `xpui` bundle files.
