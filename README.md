# Queez

Queez is a Material Design 3 single-page examination and review web application built with vanilla JavaScript and `Component.js`.

---

## Key Features

- **Interactive Examination Engine**:
  - 10-questions-per-page pagination with clean progress tracking.
  - Category transition checkpoints between exam sections.
  - Real-time countdown timer with configurable time budgets.
  - Immediate score tally and category breakdown analysis.
- **Rotating 1-Hour Mock Exam**:
  - Full mock examinations sample ~60 questions balanced across all topic sections for a focused 1-hour session.
  - Full-bank rotation history stored in `localStorage` guarantees no question is repeated across retakes until the entire question bank has been covered.
  - Section exams remain available in full for focused single-topic drill down.
- **Responsive Shell & Navigation**:
  - Desktop: persistent left mini-sidebar icon rail.
  - Mobile & Narrow screens (≤768px): fixed top bar with burger button, off-canvas navigation drawer with backdrop, and full swipe gestures.
  - Desktop Overflow Tab Carousel: automatically toggles carousel navigation when a quiz contains numerous sections (e.g. 12 modules) so tabs never overflow horizontally.
- **Pure Portable Quiz Data (`quiz-data.v1`)**:
  - Quizzes use pure, UI-agnostic JSON schemas (`data/<quiz-id>/data.json`) with nested sections and question assets.
  - Frontend adapter (`common/scripts/quiz-data-adapter.js`) maps portable data into presentation structures dynamically.

---

## Directory Structure

```
Queez/
├── common/             # Shared scripts (theme, data-loader, quiz-data-adapter)
├── components/
│   ├── pages/          # Full page views (app, dashboard)
│   ├── sections/       # Layout sections (banner, mini-sidebar, quiz-engine, quiz-results)
│   └── widgets/        # Reusable UI widgets (tabs, top-bar, question-card, quiz-action-bar)
├── data/               # Navigation definitions and portable quiz data
│   ├── napolcom-quiz/  # NAPOLCOM entrance examination data (150 questions, 4 sections)
│   ├── milk-operation-quiz/ # Milk operations examination data (464 questions, 12 sections)
│   └── navigation-items/ # Presentation metadata and icon mappings
└── index.html          # Application entry point
```

---

## Launching Queez

Start a local HTTP server:

```pwsh
python -m http.server 8000
```

Navigate to `http://localhost:8000` in any modern web browser.
