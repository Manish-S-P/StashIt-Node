# StashIt: frontend design spec

This file describes the new look of the StashIt frontend (`frontend/`). It replaces the old
"locker ticket" design (steel blue, yellow buttons, Archivo font). The reference screenshots
`home-desktop.png`, `home-mobile.png`, `home-create-error.png`, `stash-desktop.png`, `stash-burn.png`,
`stash-burned-mobile.png` and `stash-empty.png` show the target result. In those screenshots the font is a
system fallback; the real font is Geist.

**Scope: visual design and layout only.** Do not change any logic, API calls, state handling,
`lib/api.ts`, `lib/session.ts`, `lib/upload.ts`, `lib/format.ts`, `hooks/useNow.ts` or the backend.

---

## 1. Direction

Clean and minimal, in the style of Linear or Vercel:

- Lots of white space, soft zinc greys, **one** indigo accent.
- Red is used **only** for burn after read and for deleting.
- Centered layouts. Content width is narrow and calm.
- Hairline borders instead of heavy shadows. Exactly one element gets a real shadow: the open/create card on
  the home page (and the "gone" card).
- One motion moment: the home page card rises in gently on load. No other entrance animations.
  Hover and focus transitions are fine.

## 2. Design tokens (Tailwind CSS v4)

Replace `frontend/src/index.css` with these tokens (Tailwind v4 `@theme`):

```css
@import "tailwindcss";

@theme {
  --font-sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;

  --color-canvas: #fafafa;       /* page background */
  --color-soft: #f4f4f5;         /* subtle fills: segmented controls, icon tiles, progress tracks */
  --color-line: #e4e4e7;         /* hairline borders, dividers */
  --color-line-strong: #d4d4d8;  /* input borders, dashed drop zone */
  --color-muted: #71717a;        /* secondary text */
  --color-ink-2: #3f3f46;        /* body text */
  --color-ink: #18181b;          /* headings, primary text */
  --color-accent: #4f46e5;       /* indigo: primary buttons, links, progress */
  --color-accent-hover: #4338ca;
  --color-accent-soft: #eef2ff;  /* tinted backgrounds for accent icons, drag-over state */
  --color-danger: #dc2626;       /* burn + delete only */
  --color-danger-soft: #fef2f2;
  --color-ok: #16a34a;           /* "Uploaded", "Updated" */

  --shadow-card: 0 1px 2px rgb(24 24 27 / 0.04), 0 12px 32px -16px rgb(24 24 27 / 0.18);

  --animate-rise: rise 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  @keyframes rise {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: none; }
  }
}
```

Also in `index.css`:

- `html`: background `--color-canvas`, color `--color-ink`, `-webkit-font-smoothing: antialiased`.
- `:focus-visible`: `outline: 2px solid var(--color-accent); outline-offset: 2px`.
- `.tabular { font-variant-numeric: tabular-nums; }` for all numbers that change (countdown, sizes).
- `.field` (text inputs): height 44px, radius 8px, 1px `line-strong` border, white background,
  14px horizontal padding, 16px text, placeholder `#a1a1aa`. On focus: border `accent` plus a
  `0 0 0 4px rgb(79 70 229 / 0.12)` ring, no outline.
- `.switch`: a checkbox drawn as a toggle with `appearance: none`. Track 40×24px, fully rounded,
  `line-strong` when off and **`danger` red when on** (it's the burn toggle). The knob is a 20px white circle
  with a small shadow, sliding 16px when checked.
- Respect `prefers-reduced-motion`: set animation and transition durations to near zero.

### Typography

- Font: **Geist** from Google Fonts. In `index.html`:
  `https://fonts.googleapis.com/css2?family=Geist:wght@400..700&display=swap`
- Weights: 400 for body, 500 for labels and buttons, 600 for headings. Never 700+.
- Headings use `tracking-tight`.
- Scale:
  - Home hero H1: 40px on mobile, 60px from `sm`, line-height 1.1, `text-balance`.
  - Stash title H1: 30px on mobile, 36px from `sm`.
  - Section H2 ("Files"): 18px.
  - Stat numbers: 24px semibold, tabular.
  - Body: 16px. Secondary text: 14px in `muted`.
- Sentence case everywhere. No all-caps labels, and no eyebrow labels above headings.

### Shape and spacing

- Radius: 8px for inputs and buttons, 12px for panels and lists, 16px for the main card.
- Page side padding: 20px on mobile, 32px from `sm`.
- Icons: simple 24×24 line icons, stroke 1.75, round caps, color `currentColor`, sized with
  font-size (`1em`). Put them in `components/icons.tsx` as small components: Lock, Upload, Download,
  Trash, Clock, File, Flame, Shield, Box. No icon library needed.

### Buttons (`components/ui.tsx`)

`Button` with `variant` and `size` props:

| Variant | Style |
| --- | --- |
| `primary` | `accent` background, white text, `accent-hover` on hover |
| `secondary` | white background, 1px `line-strong` border, ink text, `soft` on hover |
| `ghost` | no background, `ink-2` text; `soft` background and ink text on hover |
| `danger` | `danger` background, white text |

| Size | Style |
| --- | --- |
| `sm` | height 32px, 12px horizontal padding, 14px text |
| `md` | height 40px, 16px horizontal padding, 14px text |

All buttons: radius 8px, weight 500, 6px gap between icon and text, 50% opacity when disabled.

`Alert`: `danger-soft` background, `danger` text, 14px, radius 8px, `role="alert"`.

### Favicon and wordmark

- Favicon (`public/favicon.svg`): an indigo (#4F46E5) rounded square (radius 8 on 32px) with a white
  outlined padlock.
- Wordmark: a 28px indigo rounded square with a white Lock icon, then "StashIt" in 17px semibold,
  tight tracking. It links to `/`.
- `<meta name="theme-color" content="#ffffff">`.

## 3. Home page (`pages/HomePage.tsx`)

```
┌──────────────────────────────────────────────────────────────┐
│ [■] StashIt                                          GitHub  │  h-16, max-w-5xl
│                                                              │
│          Share files with just a title and a password.       │  centered H1
│     No sign-up. Drop your files in, tell someone the title   │  centered, max 46ch
│     and password, and everything deletes itself when time    │
│                        runs out.                             │
│                                                              │
│               ┌──────────────────────────────┐               │  max-w-md, rises in
│               │ [ Open a stash | Create a stash ]│           │  segmented control
│               │ Stash title                  │               │
│               │ [__________________________] │               │
│               │ Password                     │               │
│               │ [______________________Show] │               │
│               │ [        Open stash         ]│  indigo       │
│               └──────────────────────────────┘               │
│                                                              │
│     (shield)            (box)              (clock)           │  3 facts, centered
│  No account needed   Up to 100 MB      Deletes itself        │
├──────────────────────────────────────────────────────────────┤
│ Built by Manish S P. Files are deleted for good when a ...   │  footer, border-top
└──────────────────────────────────────────────────────────────┘
```

- **Header:** Wordmark on the left. On the right, a "GitHub" text link (14px, `muted`, ink on hover)
  pointing to `https://github.com/Manish-S-P/StashIt-Node`.
- **Hero** (centered, `max-w-2xl`):
  - H1: "Share files with just a title and a password."
  - Paragraph (18px, `ink-2`, max 46ch): "No sign-up. Drop your files in, tell someone the title and password,
    and everything deletes itself when time runs out."
- **Card** (`max-w-md`, centered, 40px below the hero): white background, 1px `line` border, 16px radius,
  `shadow-card`, 24–28px padding, `animate-rise`.
  - **Segmented control** at the top: a `soft` track with 4px padding and two equal buttons, 36px tall.
    The active one has a white background, ink text and a tiny shadow; the inactive one has `muted` text.
    Keep `role="tablist"` / `role="tab"`, with the visible labels **"Open a stash"** and **"Create a stash"**.
  - Fields: label (14px, weight 500, 6px above), then a `.field` input.
    - "Stash title" has placeholder "e.g. lab-report-friday".
    - "Password" has a "Show"/"Hide" text button inside the input on the right, and the placeholder
      "At least 6 characters" in create mode.
  - **Create mode only:**
    - "Delete after": the same segmented style with three options, "1 hour", "1 day", "7 days"
      (radio inputs, visually hidden). The default is 1 day.
    - **Burn toggle row:** a bordered box (1px `line`, radius 8px, 14px padding). Left: "Burn after first
      download" (14px, weight 500) and below it, in `muted`: "The first person to download gets 10 minutes
      with the files. Then the stash is deleted." Right: the `.switch`, with `role="switch"`. The whole row is
      a `<label>` that contains the checkbox.
  - **Error:** an `Alert` above the submit button. When the title is taken, also show an underlined
    "Open that stash instead" button that switches to Open mode.
  - **Submit:** full width, 44px tall, `accent`, white text, 15px, weight 500. The text is "Open stash" or
    "Create stash", and "Opening stash…" or "Creating stash…" while busy.
- **Facts** (`max-w-3xl`, 64px below the card, 3 columns from `sm`, centered text; on mobile each fact is a
  row with the icon on the left):
  - Icon tile: 36px, white background, 1px `line` border, radius 8px, accent-colored icon.
  - "No account needed": "A title and a password are all it takes."
  - "Up to 100 MB": "Drop in up to 20 files per stash."
  - "Deletes itself": "After 1 hour, 1 day or 7 days. Or right after the first download."
- **Footer:** a top border (`line`) with the 14px `muted` text "Built by Manish S P. Files are deleted for
  good when a stash expires."
- **Order on mobile:** hero, then card, then facts.

## 4. Stash page (`pages/StashPage.tsx`)

```
┌──────────────────────────────────────────────────────────────┐
│ [■] StashIt / lab-report-friday                 Close stash  │  sticky, white/85 + blur
├──────────────────────────────────────────────────────────────┤
│  lab-report-friday                                           │  H1
│  Anyone with the title and password can see, add and ...     │  muted
│ ┌──────────────┬──────────────┬──────────────┐               │
│ │ Deletes in   │ Storage      │ Files        │               │  stats strip
│ │ 23:40:58     │ 42.7 MB      │ 3 / 20       │               │
│ │ [Reset timer▾]│ of 100.0 MB │              │               │
│ │              │ ▬▬▬▬───────  │              │               │
│ └──────────────┴──────────────┴──────────────┘               │
│ [🔥 Burn after read is on. The first download ...]           │  only if burn is on
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐            │
│           (↑)                                                │  dashed drop zone
│    Drag files here, or choose files                          │
│         57.3 MB left in this stash                           │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘            │
│  Files                                                       │
│ ┌────────────────────────────────────────────────┐           │
│ │ [▢] report.pdf            [↓ Download] [🗑]     │           │  file rows
│ │     2.4 MB, added 4 min ago                    │           │
│ └────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────┘
```

Content width: `max-w-3xl`, centered, 40px top padding, 24px between sections.

- **Top bar:** `sticky top-0`, `bg-white/85` with `backdrop-blur`, 1px bottom border (`line`), 56px tall.
  - Left: Wordmark, then a `/` divider in `line-strong`, then the stash title (14px, `muted`, truncated).
  - Right: a ghost `sm` button, "Close stash".
- **Title block:** H1 is the stash title (must stay a level-1 heading whose text is the title). Below it,
  in `muted`: "Anyone with the title and password can see, add and delete these files."
- **Stats strip** (new component `components/StashStats.tsx`, replacing `StashHeader.tsx`): a white panel
  with a 1px `line` border and 12px radius, split into 3 equal columns from `sm`, with 1px `line` dividers
  between them and 20px padding per cell.
  - **Deletes in:** 14px `muted` label, then the countdown (24px semibold, tabular).
    - When burned, the label becomes "Burned, deleted in" and the countdown turns `danger` red and counts
      to `burnDeletesAt`.
    - Under the countdown (hidden when burned): a small select, 32px tall, with a disabled placeholder
      "Reset timer…" and the options "1 hour from now", "1 day from now", "7 days from now". Choosing an
      option calls `onChangeExpiry` immediately; show "Saving…" (`muted`) and then "Updated" (`ok` green)
      for 2 seconds.
  - **Storage:** the label, then the used size (24px semibold, tabular, no wrap), then "of 100.0 MB" (14px
    `muted`), then a 6px progress track (`soft`) with an `accent` fill that turns `danger` above 90%.
    Use `role="meter"`.
  - **Files:** the label, then "3" (24px semibold) and " / 20" (16px `muted`).
  - **On mobile:** 2 columns. "Deletes in" spans the full first row with a bottom divider; Storage and Files
    sit side by side with a divider between them.
- **Burn notice** (only when `burnAfterRead`): a row with a 1px `danger`/20 border, `danger-soft` background
  and 12px radius. A red Flame icon on the left, then the text.
  - Not burned: **"Burn after read is on."** (bold) "The first download locks this stash for everyone else
    and deletes it 10 minutes later."
  - Burned: **"You downloaded first, so this stash is yours alone now."** "Everyone else is locked out.
    Download everything you need before the countdown ends."
- **Drop zone** (hidden when burned): a white panel with a 2px dashed `line-strong` border, 12px radius,
  40px vertical padding, everything centered.
  - A 44px circle in `accent-soft` with an accent Upload icon.
  - Text: "Drag files here, or **choose files**", where "choose files" is an accent text button that opens
    the hidden `<input type="file" multiple data-testid="file-input">`.
  - Below: "{free} left in this stash" (14px `muted`).
  - While dragging over: `accent` border, `accent-soft` background, and the text "Drop to upload".
  - When the stash is full: 60% opacity and the text "This stash is full".
- **Upload list** (below the drop zone): one white row per upload with a 1px `line` border and 8px radius.
  - File name (weight 500, truncated) on the left; status on the right ("Waiting…", "42% of 3.1 MB",
    "Uploaded", "Failed").
  - Below: a 4px progress bar, `accent` (green `ok` when done).
  - Errors: `danger` text plus a "Dismiss" button.
- **Files:** H2 "Files", then the list.
  - The list is a white panel with a 1px `line` border, 12px radius, rows separated by 1px `line`
    dividers, and `aria-label="Files in this stash"`. Rows get a `canvas` background on hover.
  - Each row:
    - Left: a 36px `soft` tile with a `muted` File icon.
    - Middle: the name (15px, weight 500, truncated, full name in `title`) and "2.4 MB, added 4 min ago"
      (14px `muted`, tabular).
    - Right: a secondary `sm` button with a Download icon and the text "Download" (on mobile the text is
      visually hidden but stays readable for screen readers), then a ghost `sm` icon-only button with a
      Trash icon, `aria-label="Delete"`, that turns `danger` on hover.
  - **Burn confirmation** (clicking Download on an unburned burn stash): an inline `danger-soft` panel
    under the row with the text "Downloading burns this stash. Everyone else loses access, and it is deleted
    10 minutes from now." and the buttons **"Download and burn"** (danger) and "Cancel" (ghost).
  - **Delete confirmation:** an inline `soft` panel with "Delete this file for everyone?", **"Delete file"**
    (danger) and "Keep it" (ghost).
  - **Empty state:** the same panel with centered text: **"No files yet"** (weight 500) and, in `muted`,
    "Files you upload will show up here for everyone with the password."

## 5. "Gone" screen (`components/GoneState.tsx`)

A centered card (`max-w-md`, white, 1px `line` border, 16px radius, `shadow-card`, 32px padding,
centered text):

- A 48px circle with an icon: Clock (expired), Flame (burned, `danger-soft` circle and `danger` icon) or
  Lock (session ended, `soft` circle and `muted` icon).
- An H1 (20px semibold):
  - "This stash is gone": "It expired or was deleted, and its files are no longer stored."
  - "This stash was burned": "Someone downloaded from it first, so it is closed to everyone else and will
    be deleted shortly."
  - "Your session ended": "For safety, access lasts 2 hours. Open the stash again with its title and
    password."
- A primary button-styled link, "Back to start", pointing to `/`.

## 6. Must not break (Playwright tests in `e2e/` depend on these)

Keep these exact accessible names, roles and texts:

- Tabs: "Open a stash", "Create a stash" (`role="tab"`).
- Labels: "Stash title", "Password", and the burn switch's label containing "Burn after first download".
- Buttons: "Open stash", "Create stash", "Close stash", "Download", "Delete", "Delete file",
  "Download and burn".
- `data-testid="file-input"` on the file input.
- `aria-label="Files in this stash"` on the file list.
- The stash title as a level-1 heading on the stash page.
- Texts: "No files yet", "Burn after read is on.", "You downloaded first", "This stash was burned",
  plus the server messages "A stash with this title already exists…" and "Wrong title or password".

## 7. Quality bar

- Responsive down to 360px wide; no horizontal scrolling.
- Visible keyboard focus everywhere (2px indigo outline).
- All interactive elements reachable by keyboard; icon-only buttons have `aria-label`.
- Text contrast at least 4.5:1 (`muted` #71717a on white passes for 14px+).
- Delete the old `StashHeader.tsx`, the `tear()` helper and all `steel-*`, `signal`, `burn-*`,
  `type-label` and `.ticket` styles.
- Finish with `npm run build` passing in `frontend/`.
