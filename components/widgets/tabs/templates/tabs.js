import { Component, css, html, signal } from "../../../../Component.js";
import { TabItem } from "./tabs__item.js";
import { attachDragToScroll } from "../scripts/tabs__drag-scroll.js";
import { attachTabsSwipeGesture } from "../scripts/tabs__swipe-gesture.js";

css(import.meta, ["../styles/tabs.css"]);

/**
 * @typedef {Object} TabDescriptor
 * @property {string} [tab_title] - Title label of the tab.
 * @property {string} [tabTitle] - Title label of the tab.
 * @property {string} [icon_name] - Icon identifier from Material Symbols.
 * @property {string} [iconName] - Icon identifier from Material Symbols.
 * @property {string} [section_id] - Section identifier.
 */

/**
 * Legacy class reference: .navigation-container / .tabbed-navigation / .article-tab-list
 * Represents the Tab Navigation Bar parent widget supporting desktop horizontal scrolling,
 * desktop overflow carousel fallback, and mobile carousel navigation.
 */
export class Tabs extends Component {
  /**
   * @param {Object} configuration
   * @param {Array<TabDescriptor>} [configuration.tabList=[]] - List of tab definitions.
   * @param {number} [configuration.initialIndex=0] - Initial active tab index.
   * @param {function(number): void} [configuration.onTabChange] - Tab change callback.
   */
  constructor({ tabList = [], initialIndex = 0, onTabChange = () => {} } = {}) {
    super();

    /** @type {Array<TabDescriptor>} */
    this.tabList = tabList;

    /** @type {import("../../../../Component.js").Signal<number>} */
    this.activeTabSignal = signal(initialIndex);

    /** @type {function(number): void} */
    this.onTabChange = onTabChange;

    /**
     * Activates a tab index with optional sliding transition animation on mobile or carousel mode.
     * @param {number} targetIndex - Target tab index.
     * @param {("previous"|"next"|"none"|null)} [direction=null] - Direction of slide.
     * @param {boolean} [notifyParent=true] - Whether to invoke onTabChange callback.
     * @returns {void}
     */
    const activateTabWithAnimation = (targetIndex, direction = null, notifyParent = true) => {
      /** @type {number} */
      const previousIndex = this.activeTabSignal.value;
      if (previousIndex === targetIndex && !notifyParent) {
        return;
      }

      this.activeTabSignal.value = targetIndex;

      /** @type {string|null} */
      const effectiveDirection = direction === "none"
        ? null
        : (direction || (targetIndex > previousIndex ? "next" : (targetIndex < previousIndex ? "previous" : null)));

      /** @type {HTMLElement|null} */
      const rootTabsElement = document.querySelector(".tabs");
      if (rootTabsElement) {
        /** @type {NodeListOf<HTMLElement>} */
        const allTabButtons = rootTabsElement.querySelectorAll(".tabs__item");

        allTabButtons.forEach((tabButton, index) => {
          tabButton.classList.remove(
            "tabs__item--slide-in-right",
            "tabs__item--slide-in-left",
            "tabs__item--slide-out-right",
            "tabs__item--slide-out-left"
          );
          if (index !== targetIndex && index !== previousIndex) {
            tabButton.classList.remove("tabs__item--active");
            tabButton.setAttribute("aria-selected", "false");
          }
        });

        /** @type {HTMLElement|null} */
        const outgoingTabButton = allTabButtons[previousIndex] || null;
        /** @type {HTMLElement|null} */
        const incomingTabButton = rootTabsElement.querySelector(`.tabs__item[data-tab-index="${targetIndex}"]`) || allTabButtons[targetIndex] || null;

        if (outgoingTabButton && outgoingTabButton !== incomingTabButton) {
          if (effectiveDirection) {
            void outgoingTabButton.offsetWidth;
            if (effectiveDirection === "next") {
              outgoingTabButton.classList.add("tabs__item--slide-out-left");
            } else if (effectiveDirection === "previous") {
              outgoingTabButton.classList.add("tabs__item--slide-out-right");
            }
            setTimeout(() => {
              outgoingTabButton.classList.remove(
                "tabs__item--active",
                "tabs__item--slide-out-left",
                "tabs__item--slide-out-right"
              );
              outgoingTabButton.setAttribute("aria-selected", "false");
            }, 360);
          } else {
            outgoingTabButton.classList.remove(
              "tabs__item--active",
              "tabs__item--slide-out-left",
              "tabs__item--slide-out-right"
            );
            outgoingTabButton.setAttribute("aria-selected", "false");
          }
        }

        if (incomingTabButton) {
          incomingTabButton.classList.add("tabs__item--active");
          incomingTabButton.setAttribute("aria-selected", "true");
          if (effectiveDirection) {
            void incomingTabButton.offsetWidth;
            if (effectiveDirection === "next") {
              incomingTabButton.classList.add("tabs__item--slide-in-right");
            } else if (effectiveDirection === "previous") {
              incomingTabButton.classList.add("tabs__item--slide-in-left");
            }
          }
        }
      }

      if (notifyParent && typeof this.onTabChange === "function") {
        this.onTabChange(targetIndex);
      }
    };

    /**
     * Backward-compatible programmatic activation method.
     * @param {number} targetIndex - Target tab index.
     * @param {boolean} [triggerCallback=true] - Whether to invoke callback.
     * @returns {void}
     */
    const activateTab = (targetIndex, triggerCallback = true) => {
      activateTabWithAnimation(targetIndex, null, triggerCallback);
    };

    this.activateTabWithAnimation = activateTabWithAnimation;
    this.activateTab = activateTab;

    /**
     * Navigates to next tab in carousel (wrapping around).
     * @returns {void}
     */
    const goToNextTab = () => {
      if (this.tabList.length <= 1) {
        return;
      }
      /** @type {number} */
      const nextIndex = (this.activeTabSignal.value + 1) % this.tabList.length;
      activateTabWithAnimation(nextIndex, "next");
    };

    /**
     * Navigates to previous tab in carousel (wrapping around).
     * @returns {void}
     */
    const goToPreviousTab = () => {
      if (this.tabList.length <= 1) {
        return;
      }
      /** @type {number} */
      const previousIndex = (this.activeTabSignal.value - 1 + this.tabList.length) % this.tabList.length;
      activateTabWithAnimation(previousIndex, "previous");
    };

    /** @type {boolean} */
    const hasMultipleTabs = this.tabList.length > 1;

    /** @type {Array<TabItem>} */
    const tabItemComponents = this.tabList.map((tabDefinition, index) => {
      return new TabItem({
        tabTitle: tabDefinition.tab_title || tabDefinition.tabTitle || `Section ${index + 1}`,
        iconName: tabDefinition.icon_name || tabDefinition.iconName || "category",
        tabIndex: index,
        activeTabSignal: this.activeTabSignal,
        onSelect: (selectedIndex) => {
          activateTabWithAnimation(selectedIndex);
        }
      });
    });

    this.template = html`
      <nav class="tabs" aria-label="Quiz Groups Navigation">
        <button
          type="button"
          class="tabs__carousel-button tabs__carousel-button--previous"
          aria-label="Previous tab"
          style="${hasMultipleTabs ? "visibility: visible;" : "visibility: hidden;"}"
          onclick=${goToPreviousTab}
        >
          <span class="google-symbols notranslate">chevron_left</span>
        </button>

        <div class="tabs__track" role="tablist">
          ${tabItemComponents}
        </div>

        <button
          type="button"
          class="tabs__carousel-button tabs__carousel-button--next"
          aria-label="Next tab"
          style="${hasMultipleTabs ? "visibility: visible;" : "visibility: hidden;"}"
          onclick=${goToNextTab}
        >
          <span class="google-symbols notranslate">chevron_right</span>
        </button>
      </nav>
    `;

    this.mounted = () => {
      /** @type {HTMLElement|null} */
      const containerElement = document.querySelector(".tabs");
      /** @type {HTMLElement|null} */
      const trackElement = containerElement?.querySelector(".tabs__track") || null;

      if (containerElement) {
        attachDragToScroll(containerElement);

        /**
         * Detects overflow on big screens and toggles carousel mode.
         * @returns {void}
         */
        const evaluateOverflow = () => {
          /** @type {boolean} */
          const isMobileWidth = window.innerWidth <= 768;
          if (isMobileWidth) {
            containerElement.classList.remove("tabs--carousel");
            return;
          }

          if (trackElement) {
            /** @type {boolean} */
            const isOverflowing = trackElement.scrollWidth > trackElement.clientWidth + 4;
            if (isOverflowing) {
              containerElement.classList.add("tabs--carousel");
            } else if (!containerElement.classList.contains("tabs--carousel")) {
              // Stay in normal row mode if not overflowing
            }
          }
        };

        if (typeof ResizeObserver !== "undefined") {
          /** @type {ResizeObserver} */
          const resizeObserver = new ResizeObserver(() => {
            evaluateOverflow();
          });
          resizeObserver.observe(containerElement);
        }

        evaluateOverflow();
      }

      if (trackElement) {
        attachTabsSwipeGesture({
          trackElement,
          getActiveIndex: () => this.activeTabSignal.value,
          onActivateIndex: (newIndex, direction) => {
            activateTabWithAnimation(newIndex, direction);
          }
        });
      }
    };
  }
}
