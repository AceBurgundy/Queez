import { Component, css, html, raw } from "../../../../Component.js";

css(import.meta, ["../styles/context-drawer.css"]);

/**
 * ContextDrawer Component
 * Accessible slide-out modal drawer for shared reference passages, diagrams, flowcharts, and maps.
 */
export class ContextDrawer extends Component {
  /**
   * @param {Object} [configuration={}]
   * @param {function(): void} [configuration.onClose=() => {}] - Callback when drawer closes.
   */
  constructor({
    onClose = () => {}
  } = {}) {
    super();

    /** @type {function(): void} */
    this.onClose = onClose;
    /** @type {boolean} */
    this.isOpenState = false;
    /** @type {Object|null} */
    this.activeContextData = null;
    /** @type {((keyboardEvent: KeyboardEvent) => void)|null} */
    this.escapeKeyHandler = null;

    /**
     * Opens the drawer with context data.
     * @param {Object} contextData
     * @returns {void}
     */
    this.open = (contextData) => {
      this.activeContextData = contextData;
      this.isOpenState = true;
      this.renderDrawer();
    };

    /**
     * Closes the drawer.
     * @returns {void}
     */
    this.close = () => {
      this.isOpenState = false;
      this.renderDrawer();
      if (typeof this.onClose === "function") {
        this.onClose();
      }
    };

    /**
     * Checks if drawer is open.
     * @returns {boolean}
     */
    this.isOpen = () => {
      return this.isOpenState;
    };

    /**
     * Builds HTML markup for drawer.
     * @returns {string}
     */
    this.buildContent = () => {
      if (!this.isOpenState || !this.activeContextData) {
        return `
          <div class="context-drawer-wrapper context-drawer-wrapper--hidden" aria-hidden="true"></div>
        `;
      }

      /** @type {string} */
      const title = this.activeContextData.title || "Reference Context";
      /** @type {string} */
      const content = this.activeContextData.content || "";
      /** @type {string|null} */
      let contextImage = this.activeContextData.image || null;
      if (contextImage && contextImage.startsWith("quizzes/")) {
        contextImage = "data/" + contextImage.slice("quizzes/".length);
      }
      /** @type {string} */
      const caption = this.activeContextData.caption || "";

      /** @type {string} */
      let bodyHtml = "";

      if (content) {
        /** @type {Array<string>} */
        const paragraphs = content.split(/\n\s*\n/).filter(Boolean);
        bodyHtml += `
          <div class="context-drawer__text-content">
            ${paragraphs.map((paragraphText) => `<p>${paragraphText.trim()}</p>`).join("")}
          </div>
        `;
      }

      if (contextImage) {
        bodyHtml += `
          <div class="context-drawer__image-wrapper">
            <img
              src="${contextImage}"
              class="context-drawer__image"
              alt="${title}"
              loading="lazy"
            />
            ${caption ? `<p class="context-drawer__image-caption">${caption}</p>` : ""}
          </div>
        `;
      }

      return `
        <div class="context-drawer-wrapper" role="dialog" aria-modal="true" aria-labelledby="contextDrawerTitle">
          <div class="context-drawer__scrim" id="contextDrawerScrim"></div>
          <aside class="context-drawer__panel">
            <div class="context-drawer__header">
              <div class="context-drawer__title-group">
                <span class="google-symbols notranslate context-drawer__header-icon">menu_book</span>
                <h3 class="context-drawer__title" id="contextDrawerTitle">${title}</h3>
              </div>
              <button
                type="button"
                id="contextDrawerCloseButton"
                class="bright-squircle context-drawer__close-button"
                data-tooltip="Close Reference"
                aria-label="Close Reference Context"
              >
                <span class="google-symbols notranslate">close</span>
              </button>
            </div>
            <div class="context-drawer__body">
              ${bodyHtml}
            </div>
          </aside>
        </div>
      `;
    };

    /**
     * Renders drawer into host element.
     * @returns {void}
     */
    this.renderDrawer = () => {
      if (typeof document === "undefined") {
        return;
      }
      /** @type {HTMLElement|null} */
      const hostElement = document.getElementById("contextDrawerHost");
      if (!hostElement) {
        return;
      }

      hostElement.innerHTML = this.buildContent();
      this.attachListeners();
    };

    /**
     * Attaches DOM and keyboard event listeners.
     * @returns {void}
     */
    this.attachListeners = () => {
      if (typeof document === "undefined") {
        return;
      }

      if (this.escapeKeyHandler) {
        document.removeEventListener("keydown", this.escapeKeyHandler);
        this.escapeKeyHandler = null;
      }

      if (!this.isOpenState) {
        return;
      }

      /** @type {HTMLElement|null} */
      const scrim = document.getElementById("contextDrawerScrim");
      if (scrim) {
        scrim.onclick = () => {
          this.close();
        };
      }

      /** @type {HTMLElement|null} */
      const closeButton = document.getElementById("contextDrawerCloseButton");
      if (closeButton) {
        closeButton.onclick = () => {
          this.close();
        };
      }

      /** @param {KeyboardEvent} keyboardEvent */
      this.escapeKeyHandler = (keyboardEvent) => {
        if (keyboardEvent.key === "Escape" && this.isOpenState) {
          this.close();
        }
      };
      document.addEventListener("keydown", this.escapeKeyHandler);
    };

    this.template = html`
      <div id="contextDrawerHost">
        ${raw(this.buildContent())}
      </div>
    `;

    this.unmounted = () => {
      if (typeof document !== "undefined" && this.escapeKeyHandler) {
        document.removeEventListener("keydown", this.escapeKeyHandler);
        this.escapeKeyHandler = null;
      }
    };
  }
}
