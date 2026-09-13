import { Component, css, html, signal, route, Redirect, getCurrentBrowserPath } from "../../../../Component.js";
import { toggleThemeMode } from "../../../../common/scripts/theme-manager.js";
import { showToast } from "../../../widgets/toast/scripts/toast__service.js";
import { ImageButton } from "../../../widgets/image-button/templates/image-button.js";

css(import.meta, ["../styles/mini-sidebar.css"]);

/**
 * MiniSidebar Component
 * Persistent, vertical icon rail on the left side with:
 * - App icon ImageButton (Dashboard / Home) with bottom mini pill active indicator
 * - Queezes catalog icon button (All Quizzes) with bottom mini pill active indicator
 * - Light/Dark Theme toggle icon button
 * - Always visible and persistent
 */
export class MiniSidebar extends Component {
  /**
   * @param {Object} [configuration]
   * @param {import("../../../../Component.js").Signal<string>} [configuration.activePathSignal] - Reactive active path signal.
   * @param {function(string): void} [configuration.onNavigate] - Page navigation callback.
   */
  constructor({ activePathSignal, onNavigate } = {}) {
    super();

    this.activePathSignal = activePathSignal;
    this.onNavigate = onNavigate;

    const currentTheme = typeof document !== "undefined"
      ? (document.documentElement.getAttribute("data-theme") || "dark")
      : "dark";
    this.themeSignal = signal(currentTheme);

    const updateActiveIndicator = (pathArg) => {
      const resolvedPath = (typeof pathArg === "string" && pathArg)
        ? pathArg
        : (this.activePathSignal ? this.activePathSignal.value : (route.value || getCurrentBrowserPath()));

      const isQuizzes = resolvedPath === "data/quizzes.js" ||
                        resolvedPath === "/quizzes" ||
                        resolvedPath.includes("quizzes");
      const isDashboard = !isQuizzes;

      const appItem = document.getElementById("miniSidebarAppItem");
      const appbutton = document.querySelector(".mini-sidebar__app-image-button");
      const appPill = document.getElementById("miniSidebarAppPill");

      const quizzesItem = document.getElementById("miniSidebarQuizzesItem");
      const quizzesbutton = document.getElementById("miniSidebarQuizzesbutton");
      const quizzesPill = document.getElementById("miniSidebarQuizzesPill");

      if (isDashboard) {
        appItem?.classList.add("mini-sidebar__nav-item--active");
        appbutton?.classList.add("mini-sidebar__app-image-button--active");
        appPill?.classList.add("mini-sidebar__active-pill--visible");

        quizzesItem?.classList.remove("mini-sidebar__nav-item--active");
        quizzesbutton?.classList.remove("mini-sidebar__button--active");
        quizzesPill?.classList.remove("mini-sidebar__active-pill--visible");
      } else {
        appItem?.classList.remove("mini-sidebar__nav-item--active");
        appbutton?.classList.remove("mini-sidebar__app-image-button--active");
        appPill?.classList.remove("mini-sidebar__active-pill--visible");

        quizzesItem?.classList.add("mini-sidebar__nav-item--active");
        quizzesbutton?.classList.add("mini-sidebar__button--active");
        quizzesPill?.classList.add("mini-sidebar__active-pill--visible");
      }
    };

    const handleThemeToggle = () => {
      const updatedTheme = toggleThemeMode();
      this.themeSignal.value = updatedTheme;

      const nextIcon = updatedTheme === "light" ? "dark_mode" : "light_mode";
      document.querySelectorAll("[data-theme-icon]").forEach((el) => {
        el.textContent = nextIcon;
      });
      showToast(`Switched to ${updatedTheme} theme`);
    };

    const handleNavigate = (path) => {
      updateActiveIndicator(path);
      if (typeof this.onNavigate === "function") {
        this.onNavigate(path);
      } else {
        window.location.hash = path.includes("quizzes") ? "#/quizzes" : "#/";
      }
    };

    const handleQueezesClick = () => {
      handleNavigate("data/quizzes.js");
    };

    const initialThemeIcon = this.themeSignal.value === "light" ? "dark_mode" : "light_mode";

    // App icon ImageButton: Dashboard / Home
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
            ${appIconButton}
            <div
              id="miniSidebarAppPill"
              class="mini-sidebar__active-pill"
              aria-hidden="true"
            ></div>
          </div>
          <div class="mini-sidebar__nav-item" id="miniSidebarQuizzesItem">
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
            <div
              id="miniSidebarQuizzesPill"
              class="mini-sidebar__active-pill"
              aria-hidden="true"
            ></div>
          </div>
        </div>

        <!-- Bottom utility group -->
        <div class="mini-sidebar__group">
          <button
            type="button"
            class="mini-sidebar__button"
            data-tooltip="Toggle Theme"
            aria-label="Toggle Light / Dark Theme"
            onclick=${handleThemeToggle}
          >
            <span class="google-symbols notranslate" data-theme-icon>${initialThemeIcon}</span>
          </button>
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
        const currentRoute = newRoute || (typeof window !== "undefined" ? (window.location.hash || window.location.pathname) : "");
        if (currentRoute && (currentRoute.includes("quizzes") || currentRoute.startsWith("/quizzes"))) {
          updateActiveIndicator("data/quizzes.js");
        } else {
          updateActiveIndicator("data/dashboard.js");
        }
      });

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
