/**
 * Compiles a completely standalone, self-contained offline HTML document
 * containing exam results, score analytics, all 150 question cards with verified answers,
 * and client-side 10-item pagination.
 *
 * @param {Object} exportData
 * @returns {string} Raw HTML document content.
 */
export function generateOfflineResultsHtml(exportData) {
  const {
    quizTitle = "Queez Examination Results",
    quizSubtitle = "Official Practice & Verification Report",
    publisher = "Queez! Examination Engine",
    isTimed = false,
    durationLabel = "Untimed Practice",
    completionDate = new Date().toLocaleString(),
    totalScore = 0,
    totalQuestions = 150,
    percentage = 0,
    isPassed = false,
    categoryBreakdown = [],
    questionReviewList = []
  } = exportData;

  const serializedQuestionsJson = JSON.stringify(questionReviewList);
  const serializedCategoriesJson = JSON.stringify(categoryBreakdown);

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${quizTitle} - Exam Results</title>
  <style>
    :root {
      --bg: #121316;
      --surface: #1e1f23;
      --surface-high: #2a2b30;
      --surface-highest: #35363c;
      --on-surface: #e2e2e6;
      --on-surface-variant: #c4c6d0;
      --primary: #80deea;
      --on-primary: #00363a;
      --primary-container: #004f55;
      --success: #4caf50;
      --success-bg: rgba(76, 175, 80, 0.15);
      --error: #f44336;
      --error-bg: rgba(244, 67, 54, 0.15);
      --outline: #44474e;
      --font-display: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--on-surface);
      font-family: var(--font-display);
      line-height: 1.5;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    .header-card {
      background: linear-gradient(135deg, #1e1f23 0%, #262a30 100%);
      border: 1px solid var(--outline);
      border-radius: 1.5rem;
      padding: 2.5rem 2rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.25rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    .score-circle {
      width: 9rem;
      height: 9rem;
      border-radius: 50%;
      border: 4px solid var(--primary);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--surface-high);
    }
    .score-num { font-size: 2.5rem; font-weight: 700; color: var(--on-surface); line-height: 1; }
    .score-total { font-size: 0.875rem; color: var(--on-surface-variant); }
    .score-percent { font-size: 1.5rem; font-weight: 600; color: var(--primary); }
    .status-badge {
      display: inline-block;
      padding: 0.4rem 1.25rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.95rem;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .status-badge.passed { background: var(--success-bg); color: var(--success); border: 1px solid var(--success); }
    .status-badge.failed { background: var(--error-bg); color: var(--error); border: 1px solid var(--error); }
    .meta-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
    }
    .meta-pill {
      background: var(--surface-highest);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      color: var(--on-surface-variant);
    }
    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }
    .category-card {
      background: var(--surface);
      border: 1px solid var(--outline);
      border-radius: 1rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .category-header { display: flex; justify-content: space-between; font-weight: 600; }
    .bar-bg { height: 6px; background: var(--surface-highest); border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--primary); }
    .questions-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .q-card {
      background: var(--surface);
      border: 1px solid var(--outline);
      border-radius: 1rem;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .q-card.correct { border-left: 6px solid var(--success); }
    .q-card.incorrect { border-left: 6px solid var(--error); }
    .q-header { display: flex; align-items: flex-start; gap: 0.875rem; }
    .q-badge {
      background: var(--surface-highest);
      color: var(--primary);
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      font-size: 0.85rem;
    }
    .q-title { font-weight: 600; font-size: 1.05rem; flex: 1; }
    .q-status { font-weight: 700; font-size: 0.85rem; text-transform: uppercase; }
    .q-status.correct { color: var(--success); }
    .q-status.incorrect { color: var(--error); }
    .options-list { display: flex; flex-direction: column; gap: 0.5rem; padding-left: 2rem; }
    .opt-item {
      padding: 0.6rem 0.85rem;
      border-radius: 0.5rem;
      background: var(--surface-high);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.95rem;
    }
    .opt-item.user-selected { border: 1px solid var(--error); background: var(--error-bg); }
    .opt-item.is-correct { border: 1px solid var(--success); background: var(--success-bg); font-weight: 600; }
    .opt-key {
      background: var(--surface-highest);
      font-weight: 700;
      width: 1.5rem;
      height: 1.5rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 0.8rem;
    }
    .opt-tag { margin-left: auto; font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; }
    .opt-tag.your-choice { background: var(--error); color: #fff; }
    .opt-tag.correct-choice { background: var(--success); color: #fff; }
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 0;
    }
    .page-button {
      background: var(--surface-high);
      border: 1px solid var(--outline);
      color: var(--on-surface);
      font-weight: 600;
      padding: 0.6rem 1.25rem;
      border-radius: 999px;
      cursor: pointer;
      font-size: 0.95rem;
    }
    .page-button:hover:not(:disabled) { background: var(--surface-highest); }
    .page-button:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-info { font-size: 0.95rem; color: var(--on-surface-variant); font-weight: 500; }
    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .header-card, .q-card, .category-card { border: 1px solid #ddd; background: #fff; color: #000; box-shadow: none; }
      .pagination { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-card">
      <div class="score-circle">
        <div class="score-num">${totalScore}</div>
        <div class="score-total">out of ${totalQuestions}</div>
      </div>
      <div class="score-percent">${percentage}% Score</div>
      <div class="status-badge ${isPassed ? 'passed' : 'failed'}">
        ${isPassed ? 'PASSED' : 'NEEDS IMPROVEMENT'}
      </div>
      <h1>${quizTitle}</h1>
      <p style="color: var(--on-surface-variant); max-width: 600px;">${quizSubtitle}</p>
      <div class="meta-pills">
        <span class="meta-pill">Mode: ${durationLabel}</span>
        <span class="meta-pill">Date: ${completionDate}</span>
        <span class="meta-pill">Publisher: ${publisher}</span>
      </div>
    </div>

    <!-- Category Breakdown -->
    <div class="categories-grid" id="catGrid"></div>

    <!-- Paginated Questions Viewer -->
    <div class="questions-wrapper" id="questionsContainer"></div>

    <!-- Pagination Controls -->
    <div class="pagination">
      <button type="button" class="page-button" id="buttonPrev">Previous 10</button>
      <span class="page-info" id="pageIndicator">Page 1 of 15</span>
      <button type="button" class="page-button" id="buttonNext">Next 10</button>
    </div>
  </div>

  <script>
    const questions = ${serializedQuestionsJson};
    const categories = ${serializedCategoriesJson};
    const itemsPerPage = 10;
    let currentPage = 1;
    const totalPages = Math.ceil(questions.length / itemsPerPage);

    // Render category summary cards
    const catGrid = document.getElementById('catGrid');
    if (catGrid && Array.isArray(categories)) {
      catGrid.innerHTML = categories.map(cat => \`
        <div class="category-card">
          <div class="category-header">
            <span>\${cat.title}</span>
            <span>\${cat.correct}/\${cat.total} (\${cat.percentage}%)</span>
          </div>
          <div class="bar-bg">
            <div class="bar-fill" style="width: \${cat.percentage}%;"></div>
          </div>
        </div>
      \`).join('');
    }

    function renderPage(page) {
      currentPage = page;
      const start = (page - 1) * itemsPerPage;
      const end = Math.min(questions.length, start + itemsPerPage);
      const pageItems = questions.slice(start, end);

      const container = document.getElementById('questionsContainer');
      container.innerHTML = pageItems.map(q => {
        const optionKeys = Object.keys(q.options || {});
        let optionsHtml = '';
        if (optionKeys.length > 0) {
          optionsHtml = '<div class="options-list">' + optionKeys.map(k => {
            const isUser = q.userAnswer === k;
            const isCorrect = q.correctAnswer === k;
            let cls = 'opt-item';
            let tag = '';
            if (isCorrect) {
              cls += ' is-correct';
              tag = '<span class="opt-tag correct-choice">Correct Answer</span>';
            } else if (isUser) {
              cls += ' user-selected';
              tag = '<span class="opt-tag your-choice">Your Answer</span>';
            }
            return \`
              <div class="\${cls}">
                <span class="opt-key">\${k}</span>
                <span>\${q.options[k]}</span>
                \${tag}
              </div>
            \`;
          }).join('') + '</div>';
        } else {
          optionsHtml = \`
            <div style="padding-left: 2rem; font-size: 0.95rem;">
              <p>Your Answer: <strong>\${q.userAnswer}</strong></p>
              <p style="color: var(--success);">Correct Answer: <strong>\${q.correctAnswer}</strong></p>
            </div>
          \`;
        }

        return \`
          <div class="q-card \${q.isCorrect ? 'correct' : 'incorrect'}">
            <div class="q-header">
              <span class="q-badge">Q\${q.number}</span>
              <div class="q-title">\${q.question}</div>
              <span class="q-status \${q.isCorrect ? 'correct' : 'incorrect'}">
                \${q.isCorrect ? 'Correct' : 'Incorrect'}
              </span>
            </div>
            \${optionsHtml}
          </div>
        \`;
      }).join('');

      document.getElementById('pageIndicator').textContent = \`Page \${currentPage} of \${totalPages} (Questions \${start + 1}–\${end})\`;
      document.getElementById('buttonPrev').disabled = currentPage === 1;
      document.getElementById('buttonNext').disabled = currentPage === totalPages;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.getElementById('buttonPrev').onclick = () => {
      if (currentPage > 1) renderPage(currentPage - 1);
    };
    document.getElementById('buttonNext').onclick = () => {
      if (currentPage < totalPages) renderPage(currentPage + 1);
    };

    renderPage(1);
  </script>
</body>
</html>`;
}

/**
 * Triggers a browser download of the standalone offline HTML report.
 * @param {Object} exportData
 * @param {string} [filename="queez-exam-results.html"]
 */
export function downloadOfflineResultsHtml(exportData, filename = "queez-exam-results.html") {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const htmlContent = generateOfflineResultsHtml(exportData);
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}
