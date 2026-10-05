import { Component, css, html } from "../../../../Component.js";

css(import.meta, ["../styles/tabs__item.css"]);

/**
 * TabItem Component
 * Renders an individual tab button with an icon and label.
 */
export class TabItem extends Component {
  /**
   * @param {Object} configuration
   * @param {string} configuration.tabTitle - Label displayed on the tab.
   * @param {string} configuration.iconName - Material Symbols icon identifier.
   * @param {number} configuration.tabIndex - Index of this tab.
   * @param {import("../../../../Component.js").Signal<number>} configuration.activeTabSignal - Reactive signal.
   * @param {function(number): void} configuration.onSelect - Callback on tab click.
   */
  constructor({ tabTitle, iconName, tabIndex, activeTabSignal, onSelect }) {
    super();

    /** @type {string} */
    this.tabTitle = tabTitle;

    /** @type {string} */
    this.iconName = iconName || "category";

    /** @type {number} */
    this.tabIndex = tabIndex;

    /** @type {import("../../../../Component.js").Signal<number>} */
    this.activeTabSignal = activeTabSignal;

    /** @type {function(number): void} */
    this.onSelect = onSelect;

    /**
     * @param {MouseEvent} [clickEvent]
     * @returns {void}
     */
    const handleTabClick = (clickEvent) => {
      /** @type {Object} */
      const windowObject = /** @type {*} */ (window);
      if (windowObject && windowObject.__tabJustDragged) {
        clickEvent?.preventDefault?.();
        clickEvent?.stopPropagation?.();
        return;
      }
      if (this.activeTabSignal && this.activeTabSignal.value === this.tabIndex) {
        return;
      }
      if (typeof this.onSelect === "function") {
        this.onSelect(this.tabIndex);
      }
    };

    /** @type {boolean} */
    const isSelected = this.activeTabSignal.value === this.tabIndex;
    /** @type {string} */
    const buttonClassName = isSelected
      ? "tabs__item tabs__item--active"
      : "tabs__item";

    this.template = html`
      <button
        type="button"
        role="tab"
        class="${buttonClassName}"
        aria-selected="${isSelected ? "true" : "false"}"
        data-tab-index="${String(this.tabIndex)}"
        onclick=${handleTabClick}
      >
        <span class="google-symbols notranslate tabs__item-icon">${this.iconName}</span>
        <span class="tabs__item-label">${this.tabTitle}</span>
      </button>
    `;
  }
}
