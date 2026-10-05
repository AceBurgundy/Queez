import { Component, html, signal, css, Redirect } from "../../../../Component.js";
import { toggleThemeMode } from "../../../../common/scripts/theme-manager.js";
import { showToast } from "../../toast/scripts/toast__service.js";

css(import.meta, ["../styles/top-bar.css"]);

/**
 * TopBar Component.
 * Fixed header for mobile and portrait viewports hosting the drawer menu trigger, title, and theme toggle.
 */
export class TopBar extends Component {
  /**
   * @param {Object} [configuration={}]
   * @param {string} [configuration.title="Queez!"] - Title displayed in the top bar.
   * @param {function(): void} [configuration.onMenuToggle] - Callback invoked when the burger menu button is clicked.
   */
  constructor({ title = "Queez!", onMenuToggle } = {}) {
    super();

    /** @type {string} */
    this.title = title;

    /** @type {function(): void|undefined} */
    this.onMenuToggle = onMenuToggle;

    /** @type {string|null} */
    const currentThemeAttribute = typeof document !== "undefined"
      ? (document.documentElement.getAttribute("data-theme") || "dark")
      : "dark";

    /** @type {import("../../../../Component.js").Signal<string>} */
    this.themeIconSignal = signal(currentThemeAttribute === "light" ? "dark_mode" : "light_mode");

    /** @type {import("../../../../Component.js").Signal<string>} */
    this.burgerIconSignal = signal("menu");

    /**
     * Updates burger icon state.
     * @param {boolean} isOpen
     * @returns {void}
     */
    this.setMenuOpen = (isOpen) => {
      this.burgerIconSignal.value = isOpen ? "close" : "menu";
    };

    /**
     * Handles theme toggle click.
     * @returns {void}
     */
    const handleThemeToggleClick = () => {
      /** @type {"light"|"dark"} */
      const updatedThemeMode = toggleThemeMode();
      /** @type {string} */
      const nextIconName = updatedThemeMode === "light" ? "dark_mode" : "light_mode";
      this.themeIconSignal.value = nextIconName;

      /** @type {NodeListOf<HTMLElement>} */
      const iconElements = document.querySelectorAll("[data-theme-icon]");
      iconElements.forEach((iconElement) => {
        iconElement.textContent = nextIconName;
      });

      showToast(`Switched to ${updatedThemeMode} theme`);
    };

    /**
     * Handles mobile menu toggle click.
     * @returns {void}
     */
    const handleMenuClick = () => {
      if (typeof this.onMenuToggle === "function") {
        this.onMenuToggle();
      }
    };

    this.template = html`
      <header id="topBar" class="top-bar" aria-label="Mobile Navigation Header">
        <div class="top-bar__left">
          <button
            type="button"
            class="top-bar__button"
            aria-label="Toggle Navigation Drawer"
            onclick=${handleMenuClick}
          >
            <span class="google-symbols top-bar__icon" aria-hidden="true">${this.burgerIconSignal}</span>
          </button>
          <a
            class="top-bar__title"
            tabindex="0"
            href="#/"
            aria-label="Navigate to Queez Dashboard"
          >
            ${this.title}
          </a>
        </div>
        <div class="top-bar__right">
          <button
            type="button"
            class="top-bar__button"
            aria-label="Toggle Light / Dark Theme"
            onclick=${handleThemeToggleClick}
          >
            <span class="google-symbols top-bar__icon" aria-hidden="true">${this.themeIconSignal}</span>
          </button>
        </div>
      </header>
    `;
  }
}
