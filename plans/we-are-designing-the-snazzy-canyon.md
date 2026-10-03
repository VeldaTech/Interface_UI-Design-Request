# CIEL Home Simplification Plan (planning only, no build)

## Context
The current Home concept reads as a dashboard plus a magic circle. It has many labels, duplicated status readouts, rune-style glyph tiles, and decorative fragments. The goal is for CIEL to be the interface. Home should answer four questions only:

1. CIEL is here.
2. What state is CIEL in?
3. Is anything important?
4. How do I talk to CIEL?

Target balance: 70% computational intelligence, 30% ethereal. There is at most one glyph-oriented ring.

---

## 1. Current Home audit

| Element | Verdict | Reason |
|---|---|---|
| Central CIEL Core + rings | ESSENTIAL | The interface itself |
| Assistant composer | ESSENTIAL | The only interaction point |
| State indicator (IDLE, etc.) | ESSENTIAL, merged | One quiet state word, placed near the Core. It replaces "CIEL ONLINE", the presence message and the state label. |
| Left navigation (80px rail) | ESSENTIAL, reduced | 4-5 icons, no labels until hover |
| Warning / attention notice | ESSENTIAL, conditional | Appears only when something needs the user. Absent otherwise. |
| CIEL wordmark | OPTIONAL | Small, top-left, low contrast. Can live at the top of the rail instead. |
| Greeting | OPTIONAL | One short line, only on first open of the day. It fades after about 6s. |
| Upcoming event | OPTIONAL | At most ONE line, only if it's within about 2h or the user is preparing for it. Otherwise hidden. |
| Suggestion buttons | OPTIONAL | Max 2-3 chips above the composer. They appear only on focus or when contextually relevant. |
| CIEL label under the Core | REMOVE | Redundant with the wordmark |
| "Aware. Present. Ready." | REMOVE | Slogan. The Core communicates this itself. |
| Tagline | REMOVE | Marketing copy, not UI |
| "CIEL ONLINE" | REMOVE | Duplicates the state indicator |
| "Personal intelligence" label | REMOVE | Decorative |
| Presence message | REMOVE | Duplicates the state indicator |
| Privacy/local message | REMOVE from Home | Moves to System. Home shows it only if privacy is compromised (a warning). |
| Latency / RAM | REMOVE | Developer metrics, belongs in System |
| Recent activity | REMOVE | Belongs in Tasks or Memory |
| "Memory synced" message | REMOVE | Transient. Show only as a brief Ring 4 pulse. |
| Footer system messages | REMOVE | Noise |
| Version info | REMOVE | Move to System/About |
| Decorative particles | REDUCE | 10-15 barely visible, or none |
| Geometric fragments | REMOVE | Detached shards read as decoration |
| Free-floating glyphs/symbols | REMOVE | Rune feel. Glyphs live only inside Ring 4. |
| Ring markings | REDUCE | Only functional ticks (Ring 6) and segment marks (Ring 5) |
| Outer rays | REMOVE | Replaced by a soft ambient radial falloff. Rays return only during RESPONDING as light movement. |

## 2. Recommended Home hierarchy
1. CIEL Core and rings (about 65% of the visual weight)
2. Composer (one interaction point)
3. State word (tiny, tied to the Core)
4. Conditional context line (event, warning, greeting), one at a time
5. Minimal rail

Rule: at most 3 pieces of text are visible at rest (state word, composer placeholder, and optionally one context line).

## 3. Six-ring specification

Rings are ordered from inside to outside. Only Ring 4 is glyph-oriented.

| # | Ring | Purpose | Geometry | Thickness | Density | Markings | Elements | Rotation | Speed |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Cognition | Immediate thought | Fine crystalline polygon lattice hugging the Core (hexagonal/triangulated) | Hairline (0.5-1px) | High, tight | Vertices as tiny dots | Data lines + nodes | None. It breathes with scale and opacity instead. | Very slow pulse (~6-8s cycle) |
| 2 | Context | Current conversation and situation | Constellation: 8-12 nodes joined by thin paths, irregular but balanced | Hairline, nodes 2-3px | Low-medium, airy | None | Nodes + data paths | Slow drift, clockwise | ~240s per revolution |
| 3 | Reasoning | Analysis and planning | 3-5 broken arcs of differing radii and lengths, plus a few radial traces | Medium (2-3px) | Sparse | Small end-caps | Arcs + radial traces | Independent, counter-clockwise, arcs at different speeds | ~90-150s (fastest ring at idle) |
| 4 | Knowledge | Memory and accumulated information | Main glyph band, the only glyph ring. It uses a restrained set of 12-16 geometric, non-arcane glyphs (abstract data marks, not zodiac or runes). | Band about 14-18px, thin frame lines | Medium, evenly spaced | Glyphs plus subtle separators | Glyphs | Almost stationary, clockwise | ~600s (near-imperceptible) |
| 5 | Capability | Skills, tools, agents | 8-10 segmented blocks with gaps. Each block is one capability. | Chunky (6-8px) | Medium, regular | None. A small notch marks an active block. | Segments | Fixed or extremely slow clockwise | ~400s |
| 6 | Boundary | External connections and system health | Thin technical outer ring with precision ticks (major and minor) and a few data-mark dashes. Connection points are small nodes at fixed angles. | Hairline plus ticks (4-8px) | High tick density | Ticks, data-mark dashes | Ticks + nodes | Counter-clockwise | ~500s |

Ring behavior by state:

| Ring | IDLE | LISTENING | THINKING | RESPONDING | WARNING | OFFLINE |
|---|---|---|---|---|---|---|
| 1 Cognition | Slow breathing | Inward ripple, brighter | Fast shimmer, sparks travel the lattice | Pulses outward in sync with speech rhythm | No change unless it is the source | Static, about 15% opacity |
| 2 Context | Gentle drift | Nodes brighten as input arrives | Nodes dim slightly. Paths to Ring 3 light up. | Relevant nodes glow in sequence | No change unless it is the source | Static, about 15% opacity |
| 3 Reasoning | Slow independent arcs | Slightly slower, attentive | PRIMARY ACTIVE. Arcs speed up, radial traces sweep, brightest ring. | Arcs settle and align, then release | No change unless it is the source | Stopped, faint |
| 4 Knowledge | Almost still, occasional glyph twinkle | Glyphs near the "listening" side brighten | Individual glyphs flicker as memory is retrieved | Retrieved glyphs stay lit | No change unless it is the source | Static, about 15% opacity |
| 5 Capability | Rare single-block glow | Blocks stay neutral | The block for the tool in use lights (if any) | Active block pulses steadily | The failing block turns amber/red. Others are unchanged. | Blocks empty outlines |
| 6 Boundary | Slow counter-drift | Most sensitive. Ticks brighten in a receptive sweep, a soft inward flow. | Quieter, ticks dim | Light travels outward along the ticks | The affected connection node turns amber/red. Ticks near it tint amber. | Ticks barely visible, nodes hollow |

## 4. CIEL Core specification
- Role: CIEL's central presence. It is separate from the six rings.
- Form: a small faceted or crystalline nucleus (a dimensional gem or lattice-sphere), not a flat glowing ball. Its diameter is about 14-18% of the ring diameter.
- Color: blue-white (approx. #EAF6FF center to #7FB8FF edge). Gold appears only as a rare accent, for example a single facet glint.
- Light: a tight inner glow and a wide, very soft halo (max about 2x the Core diameter). No bloom that washes out Ring 1.
- Idle: slow breath (about 5s), 4-6% scale and brightness variance, internal facets shift slowly.
- Listening: subtle contraction and slightly cooler tone, as if leaning in.
- Thinking: brightens about 20-30%, internal facets rotate faster, but the outer rings quiet down.
- Responding: rhythmic pulses that emit light outward through the rings.
- Warning: the Core stays blue-white. Only the affected ring or node changes color.
- Offline: dims to about 20%, no breath, faint wireframe remains.

## 5. State behavior matrix (global)

| State | Core | Overall motion | Primary active layer | Color | Text shown |
|---|---|---|---|---|---|
| IDLE | Calm, low breath | Low, independent | None | Blue-white, dim | State word only |
| LISTENING | Slight contraction, brighter | Receptive, inward | Ring 6 (outer sensitivity) + Ring 2 | Cooler blue | "Listening" |
| THINKING | Brightens | Quieter overall, Ring 3 dominant | Ring 3 | Blue-white, higher contrast | "Thinking" |
| RESPONDING | Rhythmic pulse | Coordinated, outward flow | All rings, controlled | Blue-white with a hint of gold | "Responding" |
| WARNING | Unchanged | Unchanged | The affected ring only | Amber (attention) or red (failure) on that element only | One short line naming the issue |
| OFFLINE | Dim | Near-stopped | None | Desaturated | "Offline" |

## 6. What moves off Home

| Content | Destination |
|---|---|
| Latency, RAM, version, diagnostics | System (developer/debug tools) |
| Privacy/local processing detail | System (surfaced on Home only when compromised) |
| Recent activity | Tasks or Memory |
| Memory sync status | Memory |
| Full calendar / upcoming events | Tasks or School |
| Full suggestion library | Composer palette or Tasks |
| Ring meaning, legends, tick labels | System or a hidden "explain the Core" overlay |
| Personal intelligence / branding copy | Onboarding or About |

## 7. Decorative elements: removed or reduced
- REMOVE: floating geometric fragments, free-floating glyphs, alternating symbol tiles, outer rays at rest, taglines/slogans, ring labels, mock data text, the CIEL label under the Core.
- REDUCE: particles (10-15, very low opacity), ring ticks (functional only), glow (single soft halo), background texture (subtle vignette and faint grain only).
- KEEP: the selective illumination, which carries meaning. Glow is a signal, not decoration.

## 8. Final Home composition

Canvas: 1440x900, deep navy/near-black with a soft vignette.

**Left to right:**
- Left rail, 80px: a small CIEL mark at the top, then 4-5 icons (Home, Tasks, Memory, School, System), with the active item marked by a thin pale-gold indicator. No labels except on hover. Settings sits at the bottom.
- Center: the Core and six rings, about 640-700px in diameter, centered slightly above the vertical middle (about 42-45% down). The rings may be partly cropped behind the composer.
- The rest of the screen is empty.

**Top to bottom:**
1. Top area: nothing, except an optional one-line greeting that fades after a few seconds, centered or left-aligned.
2. Middle: the Core and rings. The state word sits directly below the rings in small, spaced, low-contrast type.
3. Just below the state word: the conditional context line. At most one of upcoming event, warning, or greeting appears, with a quiet gold accent if important.
4. Bottom: the composer, a single slim, translucent, wide field (about 560-640px) with mic and send. It sits on the environment, not in a card. Above it are 0-3 suggestion chips, shown only on focus.

**Type:** one restrained sans for UI and a light-weight display face for the state word and greeting. This is a small amount of text overall.

## 9. Decisions needing your approval
1. **Glyph ring:** confirm Ring 4 is the only glyph ring. Also confirm the glyph style: abstract geometric data marks (recommended) versus any letterform-like marks.
2. **Ring order:** keep Cognition innermost through Boundary outermost as specified? Or should Reasoning sit closest to the Core?
3. **Greeting:** keep it as a fading line on first open only (recommended), or remove it entirely?
4. **Upcoming event:** show one conditional line on Home (recommended), or move it fully to Tasks/School?
5. **Suggestion chips:** show on focus only (recommended), always visible, or never on Home?
6. **Navigation:** icon-only rail with hover labels (recommended), or a text-labeled rail?
7. **Ring crop:** may the rings be partly hidden behind the composer for a more cinematic frame, or should the full ring stay visible?
8. **Gold usage:** only the active-nav indicator, important context accents and the rare Core glint (recommended). Is that enough gold, or do you want more?
9. **Ring 3 intensity:** in THINKING, Reasoning becomes the brightest ring. Is that acceptable, or should Cognition stay equally bright?
10. **WARNING colors:** amber for attention and red for failure, on the affected node only. Confirm.
11. **State switcher:** keep the live state-preview switcher as a hidden dev-only control (recommended, toggled by a key) rather than a visible element?

## Implementation note (for later, not now)
When approved, the work would be in `src/app/App.tsx`. The six-ring layers are separate SVG groups driven by a shared state object. It also needs a small update to `src/index.css` for font wiring. Nothing has been built yet.

## Verification (for later)
Run the dev server and check each of the 6 states at 1440x900. Confirm that at most 3 text items are visible at rest, that only Ring 4 uses glyphs, and that WARNING colors only the affected element.
