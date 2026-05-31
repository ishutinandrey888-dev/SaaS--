# ДОЖИМ-АЙ DESIGN.md

Design rules for landing pages and product surfaces in this repo. Use this file before changing `frontend/app/page.tsx`, `frontend/app/direct-3d-concept/*`, marketing routes, dashboards, onboarding, or any visually driven UI.

## Sources

- `openai-frontend-design` skill: concept-first frontend design, agency-quality restraint, browser verification, desktop/mobile QA.
- `awesome-design-md`: use `DESIGN.md` as the agent-readable visual system document.
- Relevant design directions from `awesome-design-md` collection:
  - VoltAgent: void-black canvas, emerald accent, terminal/native-agent feel.
  - Linear: ultra-minimal precision, calm hierarchy, restrained surfaces.
  - PostHog: product analytics density, developer-friendly dark UI.
  - Sentry: dark dashboard, dense monitoring surfaces, alert/status semantics.
- Ship-page idea: build experimental concepts as separate routes first, then promote only what works.

## Product Mood

ДОЖИМ-АЙ is not a generic AI SaaS. It is an AI command center for Яндекс Директ: campaign tables, ad groups, search phrases, bids, minus phrases, budgets, Метрика goals, UTM, CPA/CPC/ROMI and live alerts.

The UI should feel like:

- a premium dark command center for performance marketers;
- calm, sharp, precise, and data-literate;
- operational rather than decorative;
- AI-assisted, but grounded in concrete advertising mechanics;
- confident enough to show dense tables and real metrics without becoming noisy.

Avoid: generic AI blobs, decorative orbs, abstract gradient-only heroes, fake dashboards that do not resemble ad work, cute mascots, neon overload, crypto/trading vibes, and “cards everywhere”.

## Color System

Base:

- `void`: `#070A0D` - page background and cinematic negative space.
- `ink`: `#0A0D10` - current main landing background.
- `panel`: `#111418` - product surfaces, cards, dashboards.
- `panel-2`: `#161B22` - nested surfaces and controls.
- `paper`: `#EEF3FB` - Direct-inspired light UI mockups.
- `text`: `#F0F4F8` - primary text.
- `muted`: `#94A3B8` - body copy.
- `quiet`: `#475569` - tertiary labels.

Accents:

- `brand-green`: `#219C46` - primary CTA and positive action.
- `signal-green`: `#4ADE80` - AI scan, savings, success, live status.
- `direct-blue`: `#2B60FF` - Яндекс.Директ-inspired UI signal, tabs, buttons, selected states.
- `danger-red`: `#F87171` - budget leaks, waste, invalid traffic.
- `warning-yellow`: `#FBBF24` - attention, medium risk, benchmark labels.
- `ai-violet`: `#A78BFA` - optional secondary AI accent, use sparingly.

Rules:

- Green is the main product action color.
- Blue is reserved for Direct-like UI surfaces and selected states.
- Red only appears where money is leaking or risk is real.
- Do not make the whole page green. Use green as signal, not wallpaper.
- Avoid purple gradients as the dominant palette.

## Typography

Current brand stack:

- Display: `Unbounded`
- UI/body: `Onest`

Rules:

- Use display type only for hero, major section headlines, and a few metric numbers.
- Do not use negative letter-spacing on mobile.
- Keep labels small, uppercase, and technical only when they represent system states.
- Dashboard tables should prioritize readability over drama.
- Long Russian copy must be line-broken intentionally and tested on 390px width.

Scale guidance:

- Desktop hero: large but not wider than its column. Do not let H1 collide with 3D or overflow viewport.
- Mobile hero: max width around `320px`; prefer 30-36px display type depending on phrase length.
- Body copy: 16-18px, line-height 1.6-1.75.
- Dashboard labels: 10-13px, uppercase only for tabs, statuses, and telemetry.

## Layout Principles

- First viewport must show the actual product category: AI + Яндекс Директ + budget control.
- Hero should have one focal 3D idea, not five separate floating dashboards competing for attention.
- Keep next-section preview visible on desktop where possible.
- Use full-width sections with constrained inner content. Do not make page sections into giant floating cards.
- Tables, tabs, ad previews, UTM fields, and sidebars are product assets. Use them when explaining the product.
- Keep dashboard density intentional: enough columns/rows to feel real, not so many that it becomes illegible.

## Яндекс.Директ Attributes To Use

Use these as visual vocabulary:

- Top tabs: `Кампании`, `Группы`, `Объявления`, `Ставки и фразы`, `Сегменты аудитории`, `Профили пользователей`.
- Controls: `Добавить кампанию`, `Поиск`, `Последние 30 дней`, `Все типы кампаний`, `Все кампании`.
- Table columns: `Статус`, `Бюджет и стратегия`, `Места`, `Показы`, `Клики`, `Конверсии`, `CPA`, `CPC`, `Расход`.
- Entities: `РСЯ`, `Поиск`, `Мастер кампаний`, `Группа объявлений`, `Минус-фразы`, `UTM`, `Цели Метрики`.
- Ad preview: vertical card, image/video tabs, site domain, headline, text, button.
- Negative phrase examples: `работа инструктором`, `купить права без обучения`, `скачать бесплатно`, `вакансии`, `как сделать самому`.

Do not use Яндекс logos or copyrighted UI assets unless provided/approved. Use stylized, generic UI that evokes Direct through structure and terminology.

## 3D Direction

3D should explain the product:

- 3D campaign table plane with selected rows.
- AI chip/scanner hovering over campaigns.
- Query stream passing through an AI filter.
- Red budget leak cards turning into green actions.
- Ad preview card as a vertical object.
- Orbit/ring motion around AI only if it clarifies “monitoring 24/7”.
- Floating metric disks for CPA, savings, precision, and alerts.

Avoid:

- random cubes, spheres, gradient blobs, bokeh, or sci-fi panels unrelated to Direct;
- animation that hides copy or pushes CTA below the fold;
- 3D elements wider than viewport on mobile;
- placing the primary message inside a card.

Motion:

- Calm loops: 7-16s, ease-in-out or linear for rings.
- Scan beams should be purposeful and slow enough to read.
- Respect `prefers-reduced-motion` when adding heavier animation.
- No layout shift from animation.

## Components

Buttons:

- Primary: green or blue/green gradient, 12-15px radius, high contrast.
- Secondary: dark transparent surface with subtle border.
- Buttons must not overflow on 390px mobile.

Cards and panels:

- Use 14-24px radius for marketing panels and 10-14px for operational controls.
- Avoid nested cards unless representing actual product UI inside a mockup.
- Use thin borders, subtle shadows, and restrained glow.

Tables:

- Tables may be dense. Keep row height stable and columns readable.
- On mobile, either scale the mockup as a visual artifact or convert real data tables to a vertical stack. Do not let production text clip.

Navigation:

- Desktop nav can include product anchors and one CTA.
- Mobile nav should prioritize logo and avoid cramped CTA clusters.

Cookie/live widgets:

- Floating widgets should not cover core hero copy or primary CTA in screenshots.
- If a widget is required, account for it in mobile first-viewport QA.

## Responsive Rules

- Test at least `1440x1100`, `1280x720`, and `390x844`.
- No horizontal overflow.
- H1, brand name, CTA, and hero visual must fit on mobile.
- 3D can be simplified, hidden, or scaled on mobile if the copy remains clear.
- Cookie banner may cover lower content, but not the entire primary CTA.

## Quality Bar

Before calling a landing/design pass complete:

- The offer is legible in the first viewport.
- The visual clearly relates to Яндекс Директ and рекламная аналитика.
- There is one dominant hero idea.
- The 3D scene does not obscure copy or controls.
- Desktop and mobile screenshots have no text clipping.
- Browser console has no relevant errors.
- `npm run typecheck` passes.

## Current Experimental Route

Use `/direct-3d-concept` for experiments. It is intentionally separate from `/` so we can test bolder directions without breaking the current production landing.

