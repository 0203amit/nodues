# NoDues — Design System (MASTER.md)

> **Global Source of Truth.** Every component, page, and UI element in NoDues follows the rules in this file. Per-page overrides (if any) live in `design-system/nodues/pages/<page>.md` and only deviate where explicitly noted. When in doubt, follow MASTER.md.

---

## 1. Design Philosophy

NoDues is a **calm, trustworthy utility app** for tracking household bills and property tax. Not a marketing site, not a flashy startup landing page, not a crypto exchange.

The design follows three principles:

1. **Functional over decorative.** Every pixel earns its place by helping the user find, add, or verify a payment. No hero sections, no parallax, no animations that distract from the task.
2. **Trustworthy and calm.** This app holds proof of years of payments. Users will return to it during stressful disputes ("the society says I didn't pay"). The UI must feel reliable, never playful.
3. **Mobile-first, family-shared.** Most use happens on phones with one hand while the user is paying via GPay. Layouts must work at 375px wide. Multiple family members will use the same data — UI must be neutral, not personalized.

**Reference apps for visual tone:** Notion, Linear, Cred (Indian finance), Splitwise. **Not** TikTok, not Robinhood, not Instagram.

---

## 2. Color Palette

### Primary

| Token | Hex | Tailwind class | Use |
|---|---|---|---|
| Primary | `#4338CA` | `indigo-700` | Main brand color, primary buttons, active nav, links |
| Primary hover | `#3730A3` | `indigo-800` | Hover state for primary actions |
| Primary subtle | `#EEF2FF` | `indigo-50` | Backgrounds for selected rows, hover highlights |

### Semantic (status colors)

| Token | Hex | Tailwind class | Use |
|---|---|---|---|
| Success / Paid | `#059669` | `emerald-600` | Paid bill status badge, done to-do, confirmation toasts |
| Success subtle | `#ECFDF5` | `emerald-50` | Background of "Paid" status cells |
| Warning / Pending | `#D97706` | `amber-600` | Pending bill status, "due soon" indicator |
| Warning subtle | `#FFFBEB` | `amber-50` | Background of pending status cells |
| Danger / Overdue | `#DC2626` | `red-600` | Overdue bills, destructive actions (Delete confirmation) |
| Danger subtle | `#FEF2F2` | `red-50` | Background of overdue rows |
| Info / Not yet generated | `#0891B2` | `cyan-600` | "Bill not received yet" status |
| Info subtle | `#ECFEFF` | `cyan-50` | Background of not-yet-generated cells |

### Neutrals (the backbone — used 80% of the time)

| Token | Hex | Tailwind class | Use |
|---|---|---|---|
| Background | `#FFFFFF` | `white` | Main app background |
| Surface | `#F8FAFC` | `slate-50` | Card backgrounds, section dividers |
| Border light | `#E2E8F0` | `slate-200` | Default borders, dividers |
| Border default | `#CBD5E1` | `slate-300` | Input borders, table cell borders |
| Text muted | `#64748B` | `slate-500` | Secondary text, captions, helper text |
| Text default | `#334155` | `slate-700` | Body text |
| Text strong | `#0F172A` | `slate-900` | Headings, important values (amounts, dates) |

### Dark mode (future, not v1)

Dark mode is **out of scope for v1**. Design components with semantic tokens (e.g. `text-default`) rather than hard-coded colors so a future dark theme is a one-pass change.

---

## 3. Typography

### Font family

**IBM Plex Sans** for everything. One font. No mixing.

- Used by real banks, fintech apps, and enterprise tools — instantly conveys "this is serious software"
- Excellent readability at small sizes (important for table-dense bill lists)
- Hindi/Devanagari support if ever needed
- Open source, free, on Google Fonts

```html
<!-- index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

```js
// tailwind.config.js
fontFamily: {
  sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
}
```

### Type scale

| Use | Tailwind class | Size | Weight | Example |
|---|---|---|---|---|
| Page title | `text-2xl font-semibold` | 24px | 600 | "Dashboard", "Bills" |
| Section heading | `text-lg font-semibold` | 18px | 600 | "Pending bills", "This month" |
| Card title | `text-base font-semibold` | 16px | 600 | Bill type name on a list row |
| Body | `text-sm` | 14px | 400 | Default text everywhere |
| Body strong | `text-sm font-medium` | 14px | 500 | Amounts in tables, dates |
| Caption / Helper | `text-xs` | 12px | 400 | Form helper text, timestamps, "2 hours ago" |
| Numeric amounts | `text-base font-semibold tabular-nums` | 16px | 600 | All ₹ values — `tabular-nums` keeps columns aligned |

### Numeric formatting

Amounts always use `tabular-nums` so digits stay column-aligned in tables. INR is formatted with Indian lakh/crore grouping:

- `₹1,100` (one thousand one hundred)
- `₹2,58,700` (two lakh fifty-eight thousand seven hundred — note the grouping)

Use the browser's `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` — it handles this correctly. Don't manually format strings.

---

## 4. Spacing & Layout

### Spacing scale (Tailwind defaults)

Use Tailwind's spacing scale. Common values:

- `gap-2` (8px) — tight, within a single component
- `gap-3` (12px) — default between related items
- `gap-4` (16px) — between distinct elements
- `gap-6` (24px) — between sections within a page
- `gap-8` (32px) — between major page sections

### Page layout

- Max content width: **720px** for mobile-first pages, **1280px** for dashboard/table-heavy pages
- Page horizontal padding: `px-4` on mobile, `px-6` on tablet, `px-8` on desktop
- Page vertical padding: `py-6` at the top, `pb-24` at the bottom (extra bottom padding so floating action buttons don't cover content)

### Responsive breakpoints

Phone-first. Test these widths at every step:

| Tailwind prefix | Width | Device |
|---|---|---|
| (default) | 320–639px | Phone (especially 375px) |
| `sm:` | 640–767px | Large phone landscape |
| `md:` | 768–1023px | Tablet |
| `lg:` | 1024–1279px | Small laptop |
| `xl:` | 1280px+ | Desktop |

**Most users are at 375px (iPhone width).** Always design for that first.

### Touch targets

Minimum **44×44px** for any tappable element on mobile. Tailwind `min-h-11 min-w-11` = 44px. Buttons should be at least `py-2 px-4` for comfortable thumb taps.

---

## 5. Components

### 5.1 Buttons

**Primary**: indigo background, white text. For the single most important action on a screen.
```html
<button class="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg transition-colors">
  Mark Paid
</button>
```

**Secondary**: white background, slate border, slate text. For supporting actions.
```html
<button class="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium px-4 py-2 rounded-lg transition-colors">
  Cancel
</button>
```

**Destructive**: red. Only for delete confirmations.
```html
<button class="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors">
  Delete
</button>
```

**Ghost / text button**: no background, indigo text. For tertiary actions like "Postpone" inline.
```html
<button class="text-indigo-700 hover:text-indigo-800 font-medium px-2 py-1 rounded transition-colors">
  Postpone
</button>
```

Rules:
- One **primary** button per screen, max two
- Buttons always use `cursor-pointer`
- Always include hover and focus states
- Disabled state: `disabled:opacity-50 disabled:cursor-not-allowed`

### 5.2 Status Badges

Used on bills and to-dos to show their state.

```html
<!-- Paid -->
<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
  Paid
</span>

<!-- Pending -->
<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
  Pending
</span>

<!-- Overdue -->
<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
  Overdue
</span>

<!-- Not yet generated -->
<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-50 text-cyan-700">
  Not received yet
</span>
```

### 5.3 Form Inputs

```html
<label class="block">
  <span class="text-sm font-medium text-slate-700">Amount</span>
  <input
    type="number"
    class="mt-1 block w-full rounded-lg border-slate-300 shadow-sm
           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
           text-base"
    placeholder="0"
  />
  <span class="text-xs text-slate-500 mt-1">Enter the bill amount in ₹</span>
</label>
```

Rules:
- Labels above inputs, not beside
- 16px font size on inputs (anything smaller causes iOS to zoom on focus)
- Helper text below in `text-xs text-slate-500`
- Required field marker: red asterisk `*` after the label
- Validation errors: `text-red-600 text-xs mt-1` below the input

### 5.4 Cards

For list rows (bills, to-dos, properties).

```html
<div class="bg-white border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors cursor-pointer">
  <!-- Card content -->
</div>
```

Rules:
- White background by default
- Subtle border, not heavy shadow (shadows feel "marketing-y")
- Hover state lightens background
- Rounded `rounded-lg` (8px) — never sharp corners
- Card padding: `p-4` mobile, `p-6` desktop

### 5.5 Tables (Bills list, To-Dos list)

Mobile: cards stacked vertically (no actual `<table>`).
Desktop: real table with sticky header.

```html
<!-- Desktop -->
<table class="w-full text-sm">
  <thead class="bg-slate-50 border-b border-slate-200 sticky top-0">
    <tr>
      <th class="text-left font-medium text-slate-700 px-4 py-3">Property</th>
      <th class="text-left font-medium text-slate-700 px-4 py-3">Bill Type</th>
      <th class="text-right font-medium text-slate-700 px-4 py-3">Amount</th>
      <th class="text-left font-medium text-slate-700 px-4 py-3">Due</th>
      <th class="text-left font-medium text-slate-700 px-4 py-3">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr class="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
      <td class="px-4 py-3 text-slate-700">Mira Flat</td>
      <td class="px-4 py-3 text-slate-700">Maintenance</td>
      <td class="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">₹1,100</td>
      <td class="px-4 py-3 text-slate-700">15 Feb 2026</td>
      <td class="px-4 py-3"><!-- status badge --></td>
    </tr>
  </tbody>
</table>
```

Rules:
- Amounts right-aligned with `tabular-nums`
- Headers in slate-50 with slightly stronger text
- Row hover: slate-50 background
- No alternating row colors (zebra stripes feel dated)
- Row click opens detail page

### 5.6 Modals & Dialogs

For Postpone, Mark Paid, Delete confirmations.

```html
<div class="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
  <div class="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
    <h2 class="text-lg font-semibold text-slate-900 mb-2">Postpone bill</h2>
    <p class="text-sm text-slate-600 mb-4">Choose how long to postpone Mira Flat Maintenance</p>
    <!-- options -->
    <div class="flex justify-end gap-2 mt-6">
      <button class="<!-- secondary -->">Cancel</button>
      <button class="<!-- primary -->">Confirm</button>
    </div>
  </div>
</div>
```

Rules:
- Backdrop: `bg-slate-900/50` (50% opacity dark slate, not pure black)
- Modal max-width: `max-w-md` (28rem / 448px)
- Title at top, actions at bottom-right
- Cancel always on the left, primary action on the right

### 5.7 Toasts (success/error notifications)

```html
<!-- Success -->
<div class="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80
            bg-emerald-50 border border-emerald-200 rounded-lg p-3 shadow-sm">
  <p class="text-sm font-medium text-emerald-900">Bill marked as paid</p>
</div>
```

Rules:
- Auto-dismiss after 4 seconds
- Position: bottom-right on desktop, bottom-full-width on mobile
- Subtle colors, not loud
- Include an undo button for destructive actions (delete, postpone) — 10-second window per the spec

### 5.8 Empty States

When a list has no items.

```html
<div class="text-center py-12 px-4">
  <div class="text-slate-400 mb-3"><!-- Lucide icon, w-12 h-12 --></div>
  <h3 class="text-base font-semibold text-slate-900 mb-1">No bills yet</h3>
  <p class="text-sm text-slate-600 mb-4">Add your first bill to start tracking</p>
  <button class="<!-- primary --> mx-auto">Add a bill</button>
</div>
```

---

## 6. Icons

Use **Lucide React** (`lucide-react`). Free, MIT-licensed, consistent stroke, comprehensive set.

```bash
npm install lucide-react
```

```jsx
import { Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
```

Rules:
- Default size: `w-4 h-4` (16px) inline with text, `w-5 h-5` (20px) for buttons
- Stroke width: default (2)
- Color: inherit from parent text color (don't hard-code)
- **Never use emoji as icons.** Always SVG via Lucide.

Common icon meanings in NoDues:
- `CheckCircle2` — paid, done
- `Clock` — pending, due soon
- `AlertCircle` — overdue
- `Calendar` — due date
- `Building2` — property
- `Receipt` — bill
- `ListTodo` — to-do
- `Bell` — reminders
- `Settings` — settings
- `Trash2` — delete
- `Undo2` — undo / restore

---

## 7. Motion & Animation

**Minimal motion.** This is a utility app, not a portfolio site.

| Element | Transition |
|---|---|
| Buttons | `transition-colors duration-150` |
| Modals fade in | `transition-opacity duration-200` |
| Sidebar slide | `transition-transform duration-200` |
| Toasts slide in | `transition-all duration-200` |

Rules:
- All transitions between **150ms and 200ms**. Faster = jarring. Slower = sluggish.
- Easing: default Tailwind ease (`ease-in-out` is fine)
- **No parallax, no entrance animations on page load, no scroll-triggered animations.**
- Respect `prefers-reduced-motion` — disable all non-essential transitions for users with motion sensitivity:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Accessibility (Non-Negotiable)

- **Contrast**: All text meets WCAG AA (4.5:1 for body, 3:1 for large text). The slate-700 / white combination is 9.3:1 — well above the floor.
- **Focus states**: Every interactive element must have a visible focus ring. Tailwind's `focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`.
- **Keyboard nav**: Every action achievable by mouse must be achievable by keyboard. Use `<button>` and `<a>` elements properly — never `<div onClick>`.
- **Screen readers**: Status badges include `aria-label` (e.g., `aria-label="Status: Paid"`) since color alone isn't enough.
- **Touch targets**: Minimum 44×44px (Tailwind `min-h-11 min-w-11`).
- **Labels**: Every input has a proper `<label>` element, never just a placeholder.

---

## 9. Anti-Patterns (Things to NEVER Do)

These are explicit DON'Ts. If a generated component does any of these, reject it.

1. **No emoji as icons** — always Lucide SVG
2. **No gradient backgrounds** — flat colors only (no purple-pink-orange "AI fades")
3. **No heavy shadows** — `shadow-sm` max, ever
4. **No marketing-page patterns** — no hero sections, no "Trusted by" rows, no testimonials, no QR codes for app downloads (the app IS the destination)
5. **No dark mode by default** — light mode v1, dark mode is a future enhancement
6. **No animations on page load** — content appears, doesn't fade in
7. **No font weights below 400** — thin text fails contrast on mobile
8. **No `<div onClick>`** — semantic elements always (`<button>`, `<a>`)
9. **No fixed pixel widths** — use Tailwind responsive utilities
10. **No hardcoded ₹ symbol** — use `Intl.NumberFormat('en-IN', ...)` so currency is configurable per the spec

---

## 10. Pre-Delivery Checklist

Before any UI component is considered done, verify:

- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] All text contrast ≥ 4.5:1
- [ ] All interactive elements ≥ 44×44px touch target
- [ ] Visible focus ring on keyboard tab through
- [ ] `prefers-reduced-motion` respected
- [ ] Hover states with 150–200ms transition
- [ ] `cursor-pointer` on all clickable elements
- [ ] Icons are Lucide SVG, not emoji
- [ ] Amounts use `tabular-nums` and `Intl.NumberFormat('en-IN', ...)`
- [ ] No `console.log` left in code
- [ ] Works offline if it should (per the PWA spec)
- [ ] Form inputs are 16px+ to prevent iOS zoom on focus

---

## 11. Reference Implementation: Bill List Row (Mobile)

When in doubt about how to combine all of the above, this is the canonical example.

```jsx
import { Receipt, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

function BillRow({ bill }) {
  const statusStyles = {
    paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', Icon: CheckCircle2, label: 'Paid' },
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', Icon: Clock, label: 'Pending' },
    overdue: { bg: 'bg-red-50', text: 'text-red-700', Icon: AlertCircle, label: 'Overdue' },
  };
  const status = statusStyles[bill.status];
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(bill.amount);

  return (
    <button
      type="button"
      onClick={() => navigate(`/bills/${bill.id}`)}
      className="w-full bg-white border border-slate-200 rounded-lg p-4
                 hover:bg-slate-50 active:bg-slate-100
                 transition-colors cursor-pointer
                 text-left focus:outline-none focus:ring-2
                 focus:ring-indigo-500 focus:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Receipt className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{bill.billType}</p>
            <p className="text-sm text-slate-600 truncate">{bill.property} · {bill.month}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-semibold text-slate-900 tabular-nums">{formattedAmount}</p>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded text-xs font-medium ${status.bg} ${status.text}`}
            aria-label={`Status: ${status.label}`}
          >
            <status.Icon className="w-3 h-3" />
            {status.label}
          </span>
        </div>
      </div>
    </button>
  );
}
```

This single component demonstrates: semantic HTML, indigo focus ring, slate neutrals, tabular-nums, Indian currency formatting, Lucide icons, status badges, hover states, accessibility, and mobile-first layout. **Use this as the template for new components.**

---

## 12. How Claude Code Should Use This File

When asked to build any UI component, page, or feature:

1. **Always read this MASTER.md before generating code.**
2. Check if `design-system/nodues/pages/<page>.md` exists. If yes, its rules override MASTER.md for that page.
3. Use Tailwind classes from this file's palette and components. Don't invent new colors.
4. Run through the Pre-Delivery Checklist (section 10) mentally before declaring a component done.
5. If a design question isn't covered here, default to the rules used by Notion, Linear, or Splitwise (calm, functional, no marketing flair) — not Cred or Stripe (those are more brand-heavy).
