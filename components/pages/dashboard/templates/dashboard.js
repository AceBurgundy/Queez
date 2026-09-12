import { Component, html, css } from "../../../../Component.js";
import { Cards } from "../../../widgets/section-blocks/cards/templates/cards.js";

css(import.meta, ["../styles/dashboard.css"]);

/**
 * Renders an individual section block component for the dashboard context.
 * Strictly renders Material Design 3 Cards components.
 * @param {Object} sectionBlock - Section block data specification.
 * @param {number} blockIndex - Block index.
 * @param {function(string): void} [onNavigatePage] - Page navigation handler.
 * @returns {Cards|null}
 */
function renderDashboardSectionBlock(sectionBlock, blockIndex, onNavigatePage) {
  if (!sectionBlock || !Array.isArray(sectionBlock.cards) || sectionBlock.cards.length === 0) {
    return null;
  }

  return new Cards({
    headingTitle: sectionBlock.heading_title || sectionBlock.title || "",
    headingLevel: sectionBlock.heading_level || 2,
    layoutType: sectionBlock.layout_type || "three_cards",
    cards: sectionBlock.cards,
    forDashboard: true,
    onNavigatePage
  });
}

/**
 * Dashboard Page Component for Queez!
 * Self-contained landing page matching the reference/ design.
 * Strictly renders only Material Design 3 Card section blocks.
 */
export class Dashboard extends Component {
  /**
   * @param {Object} configuration
   * @param {Array<Object>} [configuration.tabList=[]] - Tab list from dashboard data.
   * @param {function(string): void} [configuration.onNavigatePage] - Navigation handler.
   */
  constructor({
    tabList = [],
    onNavigatePage
  } = {}) {
    super();

    this.tabList = tabList;
    this.onNavigatePage = onNavigatePage;

    const firstTab = this.tabList[0] || null;
    const blockComponents = firstTab
      ? (firstTab.section_blocks || [])
          .map((block, blockIndex) => renderDashboardSectionBlock(block, blockIndex, this.onNavigatePage))
          .filter(Boolean)
      : [];

    this.template = html`
      <section class="dashboard" aria-label="Queez Dashboard">
        <div class="dashboard__body">
          <div class="dashboard__content-pane">
            <div class="dashboard__panel">
              <div class="dashboard__section-blocks">
                ${blockComponents}
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }
}
