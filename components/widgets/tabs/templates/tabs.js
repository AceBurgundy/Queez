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

    /** @type {boolean} */
    let isTabAnimating = false;
    /** @type {number|null} */
    let animationTimer = null;

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
      if (previousIndex === targetIndex) {
        if (notifyParent && typeof this.onTabChange === "function") {
          this.onTabChange(targetIndex);
        }
        return;
      }

      if (isTabAnimating && direction !== "none") {
        return;
      }

      this.activeTabSignal.value = targetIndex;

      /** @type {string|null} */
      const effectiveDirection = direction === "none"
        ? null
        : (direction || (targetIndex > previousIndex ? "next" : (targetIndex < previousIndex ? "previous" : null)));

      if (effectiveDirection) {
        isTabAnimating = true;
        if (animationTimer !== null) {
          clearTimeout(animationTimer);
        }
        animationTimer = setTimeout(() => {
          isTabAnimating = false;
          animationTimer = null;
        }, 380);
      } else {
        isTabAnimating = false;
        if (animationTimer !== null) {
          clearTimeout(animationTimer);
          animationTimer = null;
        }
      }

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
          if (this.stopButtonCallback) {
            renderStopButtonOnActiveTab();
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

    /** @type {(() => void)|null} */
    this.stopButtonCallback = null;

    /**
     * Internal helper to remove any existing stop button from the tabs.
     * @returns {void}
     */
    const removeExistingStopButton = () => {
      if (typeof document === "undefined") {
        return;
      }
      const existingTrackButton = document.getElementById("buttonStopExamTrack");
      if (existingTrackButton && existingTrackButton.parentElement) {
        existingTrackButton.parentElement.removeChild(existingTrackButton);
      }
      const existingTabButton = document.getElementById("buttonStopExamTab");
      if (existingTabButton && existingTabButton.parentElement) {
        existingTabButton.parentElement.removeChild(existingTabButton);
      }
    };

    /**
     * Internal helper to render the stop button at the flex-end of the active tab item.
     * @returns {void}
     */
    const renderStopButtonOnActiveTab = () => {
      if (typeof document === "undefined" || !this.stopButtonCallback) {
        return;
      }
      removeExistingStopButton();

      /** @type {HTMLElement|null} */
      const activeTabElement = document.querySelector(".tabs__track .tabs__item--active");
      if (!activeTabElement) {
        return;
      }

      /** @type {HTMLElement} */
      const stopButtonElement = document.createElement("span");
      stopButtonElement.id = "buttonStopExamTab";
      stopButtonElement.setAttribute("role", "button");
      stopButtonElement.tabIndex = 0;
      stopButtonElement.className = "bright-squircle quiz-engine__stop-button quiz-engine__stop-button--tab";
      stopButtonElement.setAttribute("data-tooltip", "Stop Examination");
      stopButtonElement.setAttribute("aria-label", "Stop Examination");
      stopButtonElement.setAttribute("title", "Stop Examination");
      stopButtonElement.title = "Stop Examination";
      stopButtonElement.innerHTML = `
        <svg class="quiz-engine__stop-icon-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <rect x="5.5" y="5.5" width="13" height="13" rx="2.5" />
        </svg>
      `;

      /**
       * @param {Event} event
       * @returns {void}
       */
      const triggerStop = (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (typeof this.stopButtonCallback === "function") {
          this.stopButtonCallback();
        }
      };

      stopButtonElement.addEventListener("pointerdown", (pointerEvent) => {
        pointerEvent.stopPropagation();
      });
      stopButtonElement.addEventListener("mousedown", (mouseEvent) => {
        mouseEvent.stopPropagation();
      });
      stopButtonElement.addEventListener("touchstart", (touchEvent) => {
        touchEvent.stopPropagation();
      }, { passive: true });
      stopButtonElement.addEventListener("touchend", (touchEvent) => {
        touchEvent.stopPropagation();
      });
      stopButtonElement.addEventListener("click", triggerStop);
      stopButtonElement.addEventListener("keydown", (keyboardEvent) => {
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
          triggerStop(keyboardEvent);
        }
      });

      activeTabElement.appendChild(stopButtonElement);
    };

    /**
     * Attaches or moves the Stop Exam button into the currently active tab.
     * @param {(() => void)} onStopHandler - Callback invoked when the stop button is triggered.
     * @returns {void}
     */
    const attachStopButton = (onStopHandler) => {
      this.stopButtonCallback = onStopHandler;
      renderStopButtonOnActiveTab();
    };

    /**
     * Detaches and removes the Stop Exam button from the active tab.
     * @returns {void}
     */
    const detachStopButton = () => {
      this.stopButtonCallback = null;
      removeExistingStopButton();
    };

    this.activateTabWithAnimation = activateTabWithAnimation;
    this.activateTab = activateTab;
    this.attachStopButton = attachStopButton;
    this.detachStopButton = detachStopButton;

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
    /** @type {boolean} */
    const isCarousel = this.tabList.length >= 5;

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
      <nav class="tabs ${isCarousel ? "tabs--carousel" : ""}" aria-label="Quiz Groups Navigation">
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

          if (this.tabList.length >= 5) {
            containerElement.classList.add("tabs--carousel");
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

      if (this.stopButtonCallback) {
        renderStopButtonOnActiveTab();
      }
    };
  }
}
