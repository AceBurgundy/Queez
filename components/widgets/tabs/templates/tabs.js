import { Component, css, html, signal } from "../../../../Component.js";
import { TabItem } from "./tabs__item.js";

css(import.meta, ["../styles/tabs.css"]);

/**
 * Tabs Navigation Component
 * Arranges quiz groups/categories in a 4-column responsive grid.
 * When there are more than 4 tabs, rows wrap cleanly with equal gap spacing.
 */
export class Tabs extends Component {
  /**
   * @param {Object} configuration
   * @param {Array<Object>} [configuration.tabList=[]] - List of tab definitions.
   * @param {number} [configuration.initialIndex=0] - Initial active tab index.
   * @param {function(number): void} [configuration.onTabChange] - Tab change callback.
   */
  constructor({ tabList = [], initialIndex = 0, onTabChange = () => {} } = {}) {
    super();

    this.tabList = tabList;
    this.activeTabSignal = signal(initialIndex);
    this.onTabChange = onTabChange;

    const activateTab = (targetIndex, triggerCallback = true) => {
      const previousIndex = this.activeTabSignal.value;
      if (previousIndex === targetIndex && !triggerCallback) {
        return;
      }

      this.activeTabSignal.value = targetIndex;

      // Update active states in DOM
      const rootTabs = document.querySelector(".tabs");
      if (rootTabs) {
        rootTabs.querySelectorAll(".tabs__item").forEach((button, idx) => {
          if (idx === targetIndex) {
            button.classList.add("tabs__item--active");
            button.setAttribute("aria-selected", "true");
          } else {
            button.classList.remove("tabs__item--active");
            button.setAttribute("aria-selected", "false");
          }
        });
      }

      if (triggerCallback && typeof this.onTabChange === "function") {
        this.onTabChange(targetIndex);
      }
    };

    this.activateTab = activateTab;

    const tabComponents = this.tabList.map((tabDef, index) => {
      return new TabItem({
        tabTitle: tabDef.tab_title || tabDef.tabTitle || `Section ${index + 1}`,
        iconName: tabDef.icon_name || tabDef.iconName || "category",
        tabIndex: index,
        activeTabSignal: this.activeTabSignal,
        onSelect: (selectedIdx) => activateTab(selectedIdx)
      });
    });

    this.template = html`
      <nav class="tabs" aria-label="Quiz Groups Navigation">
        <div class="tabs__track" role="tablist">
          ${tabComponents}
        </div>
      </nav>
    `;
  }
}
