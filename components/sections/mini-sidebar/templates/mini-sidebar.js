import { Component, css, html, signal, route, Redirect, getCurrentBrowserPath } from "../../../../Component.js";
import { toggleThemeMode } from "../../../../common/scripts/theme-manager.js";
import { showToast } from "../../../widgets/toast/scripts/toast__service.js";
import { ImageButton } from "../../../widgets/image-button/templates/image-button.js";

css(import.meta, ["../styles/mini-sidebar.css"]);

/**
 * MiniSidebar Component
 * Persistent vertical icon rail on desktop, and off-canvas mobile drawer on small screens.
 */
export class MiniSidebar extends Component {
  /**
   * @param {Object} [configuration={}]
   * @param {import("../../../../Component.js").Signal<string>} [configuration.activePathSignal] - Reactive active path signal.
   * @param {function(string): void} [configuration.onNavigate] - Page navigation callback.
   * @param {function(): void} [configuration.onCloseDrawer] - Callback when drawer requests close.
   */
  constructor({ activePathSignal, onNavigate, onCloseDrawer } = {}) {
    super();

    /** @type {import("../../../../Component.js").Signal<string>|undefined} */
    this.activePathSignal = activePathSignal;

    /** @type {function(string): void|undefined} */
    this.onNavigate = onNavigate;

    /** @type {function(): void|undefined} */
    this.onCloseDrawer = onCloseDrawer;

    /** @type {string} */
    const currentTheme = typeof document !== "undefined"
      ? (document.documentElement.getAttribute("data-theme") || "dark")
      : "dark";
    /** @type {import("../../../../Component.js").Signal<string>} */
    this.themeSignal = signal(currentTheme);

    /** @type {import("../../../../Component.js").Signal<boolean>} */
    this.isOpenSignal = signal(false);

    /**
     * Opens the mobile drawer.
     * @returns {void}
     */
    this.open = () => {
      this.isOpenSignal.value = true;
      /** @type {HTMLElement|null} */
      const sidebarElement = document.getElementById("miniSidebar");
      if (sidebarElement) {
        sidebarElement.classList.add("mini-sidebar--open");
      }
    };

    /**
     * Closes the mobile drawer.
     * @returns {void}
     */
    this.close = () => {
      this.isOpenSignal.value = false;
      /** @type {HTMLElement|null} */
      const sidebarElement = document.getElementById("miniSidebar");
      if (sidebarElement) {
        sidebarElement.classList.remove("mini-sidebar--open");
      }
      if (typeof this.onCloseDrawer === "function") {
        this.onCloseDrawer();
      }
    };

    /**
     * Toggles the mobile drawer.
     * @returns {void}
     */
    this.toggle = () => {
      if (this.isOpenSignal.value) {
        this.close();
      } else {
        this.open();
      }
    };

    /**
     * @param {string} [pathArgument]
     * @returns {void}
     */
    const updateActiveIndicator = (pathArgument) => {
      /** @type {string} */
      const resolvedPath = (typeof pathArgument === "string" && pathArgument)
        ? pathArgument
        : (this.activePathSignal ? this.activePathSignal.value : (route.value || getCurrentBrowserPath()));

      /** @type {boolean} */
      const isQuizzes = resolvedPath === "data/quizzes.js" ||
                        resolvedPath === "/quizzes" ||
                        resolvedPath.includes("quizzes");
      /** @type {boolean} */
      const isDashboard = !isQuizzes;

      /** @type {HTMLElement|null} */
      const appItem = document.getElementById("miniSidebarAppItem");
      /** @type {HTMLElement|null} */
      const appButton = document.querySelector(".mini-sidebar__app-image-button");
      /** @type {HTMLElement|null} */
      const appPill = document.getElementById("miniSidebarAppPill");

      /** @type {HTMLElement|null} */
      const quizzesItem = document.getElementById("miniSidebarQuizzesItem");
      /** @type {HTMLElement|null} */
      const quizzesButton = document.getElementById("miniSidebarQuizzesbutton");
      /** @type {HTMLElement|null} */
      const quizzesPill = document.getElementById("miniSidebarQuizzesPill");

      if (isDashboard) {
        appItem?.classList.add("mini-sidebar__nav-item--active");
        appButton?.classList.add("mini-sidebar__app-image-button--active");
        appPill?.classList.add("mini-sidebar__active-pill--visible");

        quizzesItem?.classList.remove("mini-sidebar__nav-item--active");
        quizzesButton?.classList.remove("mini-sidebar__button--active");
        quizzesPill?.classList.remove("mini-sidebar__active-pill--visible");
      } else {
        appItem?.classList.remove("mini-sidebar__nav-item--active");
        appButton?.classList.remove("mini-sidebar__app-image-button--active");
        appPill?.classList.remove("mini-sidebar__active-pill--visible");

        quizzesItem?.classList.add("mini-sidebar__nav-item--active");
        quizzesButton?.classList.add("mini-sidebar__button--active");
        quizzesPill?.classList.add("mini-sidebar__active-pill--visible");
      }
    };

    /**
     * @param {MouseEvent} [clickEvent]
     * @returns {void}
     */
    const handleThemeToggle = (clickEvent) => {
      clickEvent?.stopPropagation?.();
      /** @type {"light"|"dark"} */
      const updatedTheme = toggleThemeMode();
      this.themeSignal.value = updatedTheme;
      showToast(`Switched to ${updatedTheme} theme`);
    };

    /**
     * @param {string} destinationPath
     * @returns {void}
     */
    const handleNavigate = (destinationPath) => {
      updateActiveIndicator(destinationPath);
      this.close();
      if (typeof this.onNavigate === "function") {
        this.onNavigate(destinationPath);
      } else {
        window.location.hash = destinationPath.includes("quizzes") ? "#/quizzes" : "#/";
      }
    };

    /**
     * @param {MouseEvent} [clickEvent]
     * @returns {void}
     */
    const handleDashboardClick = (clickEvent) => {
      clickEvent?.stopPropagation?.();
      handleNavigate("data/dashboard.js");
    };

    /**
     * @param {MouseEvent} [clickEvent]
     * @returns {void}
     */
    const handleQueezesClick = (clickEvent) => {
      clickEvent?.stopPropagation?.();
      handleNavigate("data/quizzes.js");
    };

    /** @type {string} */
    const initialThemeIcon = this.themeSignal.value === "light" ? "dark_mode" : "light_mode";

    /** @type {ImageButton} */
    const appIconButton = new ImageButton({
      src: "assets/icon.png",
      alt: "Dashboard",
      tooltip: "Dashboard",
      ariaLabel: "Go to Dashboard",
      size: "2.75rem",
      navigationPath: "data/dashboard.js",
      className: "mini-sidebar__app-image-button",
      onClick: () => handleNavigate("data/dashboard.js")
    });

    this.appIconButton = appIconButton;

    this.template = html`
      <aside
        id="miniSidebar"
        class="mini-sidebar"
        aria-label="Quick Navigation Sidebar"
      >
        <!-- Top navigation group -->
        <div class="mini-sidebar__group">
          <div class="mini-sidebar__nav-item" id="miniSidebarAppItem">
            <div class="mini-sidebar__item-row" onclick=${handleDashboardClick}>
              ${appIconButton}
              <span class="mini-sidebar__drawer-label" onclick=${handleDashboardClick}>Dashboard</span>
            </div>
            <div
              id="miniSidebarAppPill"
              class="mini-sidebar__active-pill"
              aria-hidden="true"
            ></div>
          </div>

          <div class="mini-sidebar__nav-item" id="miniSidebarQuizzesItem">
            <div class="mini-sidebar__item-row" onclick=${handleQueezesClick}>
              <button
                type="button"
                id="miniSidebarQuizzesbutton"
                class="mini-sidebar__button"
                data-tooltip="Queezes"
                aria-label="View all Queezes"
                onclick=${handleQueezesClick}
              >
                <span class="mini-sidebar__emoji-icon" role="img" aria-label="brain">🧠</span>
              </button>
              <span class="mini-sidebar__drawer-label" onclick=${handleQueezesClick}>Queezes</span>
            </div>
            <div
              id="miniSidebarQuizzesPill"
              class="mini-sidebar__active-pill"
              aria-hidden="true"
            ></div>
          </div>
        </div>

        <!-- Bottom utility group -->
        <div class="mini-sidebar__group">
          <div class="mini-sidebar__item-row" onclick=${handleThemeToggle}>
            <button
              type="button"
              class="mini-sidebar__button"
              data-tooltip="Toggle Theme"
              aria-label="Toggle Light / Dark Theme"
              onclick=${handleThemeToggle}
            >
              <span class="google-symbols notranslate" data-theme-icon aria-hidden="true">${initialThemeIcon}</span>
            </button>
            <span class="mini-sidebar__drawer-label" onclick=${handleThemeToggle}>Toggle Theme</span>
          </div>
        </div>
      </aside>
    `;

    this.mounted = () => {
      this.appIconButton?.__mount?.();

      if (this.activePathSignal && typeof this.activePathSignal.subscribe === "function") {
        this.activePathUnsubscribe = this.activePathSignal.subscribe(() => {
          updateActiveIndicator(this.activePathSignal?.value);
        });
      }

      this.routeUnsubscribe = Redirect.onRouteChange((newRoute) => {
        /** @type {string} */
        const currentRoute = newRoute || (typeof window !== "undefined" ? (window.location.hash || window.location.pathname) : "");
        if (currentRoute && (currentRoute.includes("quizzes") || currentRoute.startsWith("/quizzes"))) {
          updateActiveIndicator("data/quizzes.js");
        } else {
          updateActiveIndicator("data/dashboard.js");
        }
        this.close();
      });

      /** @type {string} */
      const initialPath = this.activePathSignal?.value || "data/dashboard.js";
      updateActiveIndicator(initialPath);
    };

    this.beforeUnmount = () => {
      if (typeof this.activePathUnsubscribe === "function") {
        this.activePathUnsubscribe();
        this.activePathUnsubscribe = null;
      }
      if (typeof this.routeUnsubscribe === "function") {
        this.routeUnsubscribe();
        this.routeUnsubscribe = null;
      }
    };
  }
}
