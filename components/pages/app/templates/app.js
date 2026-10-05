import { Component, html, signal, css, route, Redirect, getCurrentBrowserPath } from "../../../../Component.js";
import { MiniSidebar } from "../../../sections/mini-sidebar/templates/mini-sidebar.js";
import { TopBar } from "../../../widgets/top-bar/templates/top-bar.js";
import { Dashboard } from "../../dashboard/templates/dashboard.js";
import { Banner } from "../../../sections/banner/templates/banner.js";
import { Tabs } from "../../../widgets/tabs/templates/tabs.js";
import { Toast } from "../../../widgets/toast/templates/toast.js";
import { LoadingScreen } from "../../../widgets/loading-screen/templates/loading-screen.js";
import { fetchNavigationItemData } from "../../../../common/scripts/data-loader.js";
import { adaptQuizData } from "../../../../common/scripts/quiz-data-adapter.js";
import { QuizActionBar } from "../../../widgets/quiz-action-bar/templates/quiz-action-bar.js";
import { StartNowButton } from "../../../widgets/start-now-button/templates/start-now-button.js";
import { QuizEngine } from "../../../sections/quiz-engine/templates/quiz-engine.js";
import { QuizResults } from "../../../sections/quiz-results/templates/quiz-results.js";
import {
  registerQuestionsAndSanitize,
  loadActiveSession,
  clearActiveSession,
  evaluateScoreTally,
  getCategoryBounds
} from "../../../sections/quiz-engine/scripts/quiz-state-manager.js";
import {
  buildMockExamDeck,
  restoreMockExamDeck,
  DEFAULT_MOCK_EXAM_QUESTION_COUNT
} from "../../../sections/quiz-engine/scripts/mock-exam-sampler.js";

css(import.meta, ["../styles/app.css"]);

/**
 * Main Single Page Application Component for Queez!
 * Orchestrates navigation state, top bar for mobile, persistent mini-sidebar / drawer,
 * and dynamic viewport mounting (Dashboard vs Quiz view).
 */
export class App extends Component {
  /**
   * @param {Object} [configuration={}]
   * @param {Object|Array<Object>} [configuration.documentationData={}] - Master quiz registry from data.js.
   * @param {Array<Object>} [configuration.categoryGroups=[]] - Category groups list.
   */
  constructor({
    documentationData = {},
    categoryGroups = []
  } = {}) {
    super();

    /** @type {Object} */
    const masterData = documentationData && typeof documentationData === "object" && !Array.isArray(documentationData)
      ? documentationData
      : {
          dashboard_path: "data/dashboard.js",
          quizzes_path: "data/quizzes.js",
          category_groups: Array.isArray(categoryGroups) && categoryGroups.length > 0
            ? categoryGroups
            : Array.isArray(documentationData)
              ? documentationData
              : []
        };

    /** @type {string} */
    this.dashboardPath = masterData.dashboard_path || "data/dashboard.js";
    /** @type {string} */
    this.quizzesPath = masterData.quizzes_path || "data/quizzes.js";
    /** @type {Array<Object>} */
    this.categoryGroups = Array.isArray(masterData.category_groups)
      ? masterData.category_groups
      : [];

    /** @type {Object} */
    const windowObject = /** @type {*} */ (window);
    windowObject.DOCUMENTATION_DATA = masterData;
    windowObject.DOCUMENTATION_ITEMS = windowObject.DOCUMENTATION_ITEMS || {};

    /** @type {import("../../../../Component.js").Signal<string>} */
    this.activePathSignal = signal(this.dashboardPath);
    /** @type {LoadingScreen} */
    this.loadingScreenComponent = new LoadingScreen();
    /** @type {Toast} */
    const toastComponent = new Toast();

    /** @type {MiniSidebar} */
    this.miniSidebarComponent = new MiniSidebar({
      activePathSignal: this.activePathSignal,
      onNavigate: (selectedPath) => {
        this.closeMobileDrawer();
        this.navigateTo(selectedPath);
      },
      onCloseDrawer: () => {
        this.closeMobileDrawer();
      }
    });

    /** @type {TopBar} */
    this.topBarComponent = new TopBar({
      title: "Queez!",
      onMenuToggle: () => {
        this.toggleMobileDrawer();
      }
    });

    /**
     * Toggles mobile drawer visibility.
     * @returns {void}
     */
    this.toggleMobileDrawer = () => {
      /** @type {HTMLElement|null} */
      const backdropElement = document.getElementById("appBackdrop");
      /** @type {HTMLElement|null} */
      const sidebarElement = document.getElementById("miniSidebar");
      if (sidebarElement && sidebarElement.classList.contains("mini-sidebar--open")) {
        sidebarElement.classList.remove("mini-sidebar--open");
        backdropElement?.classList.remove("app-root__backdrop--visible");
        this.topBarComponent.setMenuOpen(false);
      } else {
        sidebarElement?.classList.add("mini-sidebar--open");
        backdropElement?.classList.add("app-root__backdrop--visible");
        this.topBarComponent.setMenuOpen(true);
      }
    };

    /**
     * Closes mobile drawer.
     * @returns {void}
     */
    this.closeMobileDrawer = () => {
      /** @type {HTMLElement|null} */
      const backdropElement = document.getElementById("appBackdrop");
      /** @type {HTMLElement|null} */
      const sidebarElement = document.getElementById("miniSidebar");
      sidebarElement?.classList.remove("mini-sidebar--open");
      backdropElement?.classList.remove("app-root__backdrop--visible");
      this.topBarComponent.setMenuOpen(false);
    };

    this.template = html`
      <div class="app-root" id="appRoot">
        ${this.loadingScreenComponent}
        ${this.topBarComponent}
        <div
          id="appBackdrop"
          class="app-root__backdrop"
          aria-hidden="true"
          onclick=${() => this.closeMobileDrawer()}
        ></div>
        ${this.miniSidebarComponent}
        <main
          id="mainViewport"
          class="app-root__viewport"
          data-main-viewport
          tabindex="-1"
          aria-label="Queez Viewport"
        >
          <!-- Dynamic Dashboard, Quizzes catalog, or Quiz content mounted here -->
        </main>
        ${toastComponent}
      </div>
    `;

    this.mounted = () => {
      // 1. Resolve current active route on initial mount
      const currentRoute = this.parseCurrentRoute();
      /** @type {string} */
      let expectedNavPath = this.dashboardPath;
      if (currentRoute.type === "quiz") {
        expectedNavPath = this.findNavigationPathForQuizId(currentRoute.quizId) || "data/navigation-items/napolcom-mock-exam.js";
      } else if (currentRoute.type === "quizzes") {
        expectedNavPath = this.quizzesPath;
      }

      this.activePathSignal.value = expectedNavPath;
      this.loadInitialPage(expectedNavPath);

      // 2. Component-safe route change subscription via Redirect.onRouteChange
      this.routeUnsubscribe = Redirect.onRouteChange((normalizedPath) => {
        this.closeMobileDrawer();
        const activeRoute = this.parseCurrentRoute(normalizedPath);
        /** @type {string} */
        let targetNavPath = this.dashboardPath;
        if (activeRoute.type === "quiz") {
          targetNavPath = this.findNavigationPathForQuizId(activeRoute.quizId) || "data/navigation-items/napolcom-mock-exam.js";
        } else if (activeRoute.type === "quizzes") {
          targetNavPath = this.quizzesPath;
        }

        if (this.activePathSignal.value !== targetNavPath) {
          this.activePathSignal.value = targetNavPath;
          this.loadNavigationItem(targetNavPath);
        }
      });

      // 3. Escape key listener to close drawer
      /** @param {KeyboardEvent} keyboardEvent */
      const handleKeyDown = (keyboardEvent) => {
        if (keyboardEvent.key === "Escape") {
          this.closeMobileDrawer();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      this.cleanupKeyDown = () => {
        window.removeEventListener("keydown", handleKeyDown);
      };

      // 4. Close drawer if viewport resizes back to desktop width
      if (typeof window.matchMedia === "function") {
        /** @type {MediaQueryList} */
        const mediaQuery = window.matchMedia("(min-width: 769px) and (orientation: landscape)");
        /** @param {MediaQueryListEvent} event */
        const handleMediaChange = (event) => {
          if (event.matches) {
            this.closeMobileDrawer();
          }
        };
        mediaQuery.addEventListener("change", handleMediaChange);
        this.cleanupMedia = () => {
          mediaQuery.removeEventListener("change", handleMediaChange);
        };
      }
    };

    this.beforeUnmount = () => {
      if (typeof this.routeUnsubscribe === "function") {
        this.routeUnsubscribe();
        this.routeUnsubscribe = null;
      }
      if (typeof this.cleanupKeyDown === "function") {
        this.cleanupKeyDown();
      }
      if (typeof this.cleanupMedia === "function") {
        this.cleanupMedia();
      }
    };
  }

  /**
   * Resolves the canonical quiz ID from a navigation path or item data.
   * @param {string} navigationPath - Target navigation path.
   * @param {Object} [itemData=null] - Loaded item metadata.
   * @returns {string} Canonical quiz identifier.
   */
  resolveQuizId(navigationPath, itemData = null) {
    if (itemData) {
      if (itemData.id) return itemData.id;
      if (itemData.quiz_id) return itemData.quiz_id;
      if (itemData.data && itemData.data.id) return itemData.data.id;
    }
    /** @type {Object} */
    const windowObject = /** @type {*} */ (window);
    /** @type {Object|undefined} */
    const cached = windowObject.DOCUMENTATION_ITEMS?.[navigationPath];
    if (cached) {
      if (cached.id) return cached.id;
      if (cached.quiz_id) return cached.quiz_id;
      if (cached.data && cached.data.id) return cached.data.id;
    }
    if (navigationPath.includes("napolcom")) {
      return "napolcom-mock-exam-7a8f";
    }
    return navigationPath.replace(/^.*[\\\/]/, "").replace(/\.[^/.]+$/, "");
  }

  /**
   * Finds the navigation item script path matching a given quiz ID.
   * @param {string} quizId - Unique quiz identifier.
   * @returns {string|null} Navigation item path or null if not found.
   */
  findNavigationPathForQuizId(quizId) {
    if (!quizId) return null;
    /** @type {string} */
    const cleanId = quizId.toLowerCase().trim();
    /** @type {Object} */
    const windowObject = /** @type {*} */ (window);

    for (const group of this.categoryGroups) {
      for (const navPath of (group.navigation_item_paths || [])) {
        /** @type {Object|undefined} */
        const item = windowObject.DOCUMENTATION_ITEMS?.[navPath];
        /** @type {string|undefined} */
        const itemId = item?.id || item?.quiz_id || item?.data?.id;
        if (itemId && itemId.toLowerCase() === cleanId) {
          return navPath;
        }
        /** @type {string} */
        const navBaseName = navPath.replace(/^.*[\\\/]/, "").replace(/\.[^/.]+$/, "").toLowerCase();
        if (
          cleanId === navBaseName ||
          cleanId.startsWith(navBaseName) ||
          navBaseName.startsWith(cleanId) ||
          navPath.toLowerCase().includes(cleanId)
        ) {
          return navPath;
        }
      }
    }

    if (cleanId.includes("napolcom")) {
      return "data/navigation-items/napolcom-mock-exam.js";
    }
    return null;
  }

  /**
   * Parses active route from window.location or passed path.
   * @param {string|null} [customPath=null] - Optional override path.
   * @returns {{ type: ("dashboard"|"quiz"|"quizzes"), quizId?: string, rawPath: string }} Route descriptor.
   */
  parseCurrentRoute(customPath = null) {
    /** @type {string} */
    let path = (typeof customPath === "string" && customPath)
      ? customPath
      : (typeof window !== "undefined" ? (window.location.hash || window.location.pathname || "/") : "/");

    if (path.includes("#")) {
      path = path.replace(/^.*#\/?/, "/");
    }
    path = path.split("?")[0];

    if (!path.startsWith("/")) {
      path = "/" + path;
    }
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    /** @type {RegExpMatchArray|null} */
    const quizMatch = path.match(/^\/quizzes\/([a-zA-Z0-9_-]+)/);
    if (quizMatch) {
      return { type: "quiz", quizId: quizMatch[1], rawPath: path };
    }

    if (path === "/quizzes") {
      return { type: "quizzes", rawPath: path };
    }

    return { type: "dashboard", rawPath: path };
  }

  /**
   * Synchronizes browser URL history and Component.js route signal.
   * @param {string} targetUrlPath - Destination URL.
   * @param {Object} [options={}] - Options object.
   * @param {boolean} [options.replace=false] - Whether to replace state.
   * @returns {void}
   */
  pushRouteState(targetUrlPath, { replace = false } = {}) {
    Redirect.navigate(targetUrlPath, { replace });
  }

  /**
   * Performs initial page load with loading screen dismissal.
   * @param {string} initialPath - Initial path to mount.
   * @returns {Promise<void>}
   */
  async loadInitialPage(initialPath) {
    try {
      await this.loadNavigationItem(initialPath);
      setTimeout(() => {
        this.loadingScreenComponent.dismiss(() => {
          this.preloadAllNavigationItems();
        });
      }, 600);
    } catch (initialLoadError) {
      console.error("Initial quiz load error:", initialLoadError);
      setTimeout(() => {
        this.loadingScreenComponent.dismiss(() => {
          this.preloadAllNavigationItems();
        });
      }, 600);
    }
  }

  /**
   * Navigates to a specific quiz or dashboard path.
   * Updates URL route to /quizzes/<quiz-id> or / and browser history.
   * @param {string} targetNavigationPath - Navigation destination.
   * @param {Object} [options={}] - Navigation options.
   * @param {boolean} [options.updateHistory=true] - Update browser URL.
   * @param {boolean} [options.replace=false] - Replace history entry.
   * @returns {void}
   */
  navigateTo(targetNavigationPath, { updateHistory = true, replace = false } = {}) {
    if (!targetNavigationPath) return;

    /** @type {string} */
    let navPath = targetNavigationPath;
    /** @type {string} */
    let routePath = "/";

    if (targetNavigationPath === "/quizzes" || targetNavigationPath === "quizzes" || targetNavigationPath === this.quizzesPath) {
      navPath = this.quizzesPath;
      routePath = "/quizzes";
    } else if (targetNavigationPath.startsWith("/quizzes/") || targetNavigationPath.startsWith("quizzes/")) {
      /** @type {string} */
      const quizId = targetNavigationPath.replace(/^\/?quizzes\//, "");
      navPath = this.findNavigationPathForQuizId(quizId) || "data/navigation-items/napolcom-mock-exam.js";
      routePath = `/quizzes/${quizId}`;
    } else if (targetNavigationPath === this.dashboardPath || targetNavigationPath === "/") {
      navPath = this.dashboardPath;
      routePath = "/";
    } else {
      /** @type {string} */
      const quizId = this.resolveQuizId(targetNavigationPath);
      routePath = `/quizzes/${quizId}`;
      navPath = targetNavigationPath;
    }

    if (updateHistory && typeof window !== "undefined") {
      /** @type {string} */
      const targetHash = `#${routePath}`;
      /** @type {string} */
      const currentHash = window.location.hash || "#/";
      /** @type {string} */
      const normalizedCurrentHash = (currentHash === "#" || currentHash === "") ? "#/" : currentHash;

      if (normalizedCurrentHash !== targetHash) {
        if (replace) {
          window.location.replace(targetHash);
        } else {
          window.location.hash = targetHash;
        }
        return;
      }
    }

    if (this.activePathSignal.value !== navPath) {
      this.activePathSignal.value = navPath;
      this.loadNavigationItem(navPath);
    }
  }

  /**
   * Preloads navigation item scripts in the background.
   * @returns {void}
   */
  preloadAllNavigationItems() {
    fetchNavigationItemData(this.dashboardPath).catch(() => {});
    fetchNavigationItemData(this.quizzesPath).catch(() => {});
    this.categoryGroups.forEach((group) => {
      /** @type {Array<string>} */
      const itemPaths = group.navigation_item_paths || [];
      itemPaths.forEach((path) => {
        fetchNavigationItemData(path).catch(() => {});
      });
    });
  }

  /**
   * Loads navigation item data using the common data loader.
   * @param {string} navigationPath - Target item path.
   * @returns {Promise<Object>} Loaded item object.
   */
  async fetchNavigationItemData(navigationPath) {
    return fetchNavigationItemData(navigationPath);
  }

  /**
   * Dynamically mounts either the Dashboard or a Quiz into the main viewport.
   * @param {string} navigationPath - Destination path.
   * @returns {Promise<void>}
   */
  async loadNavigationItem(navigationPath) {
    /** @type {HTMLElement|null} */
    const viewportElement = document.getElementById("mainViewport");
    if (!viewportElement || !navigationPath) {
      return;
    }

    this.activePathSignal.value = navigationPath;

    try {
      /** @type {Object} */
      const itemData = await this.fetchNavigationItemData(navigationPath);
      /** @type {Object} */
      const headerContainer = itemData.header_container || {};

      // 1. If Dashboard
      if (navigationPath === this.dashboardPath) {
        /** @type {StartNowButton} */
        const startNowButton = new StartNowButton({
          label: "Start Now",
          onStart: () => {
            this.navigateTo("/quizzes");
          }
        });

        /** @type {Banner} */
        const bannerComponent = new Banner({
          title: headerContainer.title || "Queez!",
          description: headerContainer.description || "",
          badges: [],
          isCompact: false,
          isDashboard: true,
          bannerImage: headerContainer.banner_image || headerContainer.mockup_card || {},
          actionComponent: startNowButton
        });

        /** @type {Dashboard} */
        const dashboardComponent = new Dashboard({
          tabList: itemData.tab_list || [],
          onNavigatePage: (destinationPath) => {
            this.navigateTo(destinationPath);
          }
        });

        viewportElement.innerHTML = bannerComponent.toString() + dashboardComponent.toString();
        bannerComponent.__mount?.();
        dashboardComponent.__mount?.();
      } else if (navigationPath === this.quizzesPath) {
        // 2. If Quizzes Catalog Page
        /** @type {Banner} */
        const bannerComponent = new Banner({
          title: headerContainer.title || "Queezes",
          description: headerContainer.description || "Explore available mock examinations and review questionnaires.",
          badges: headerContainer.badge_list || [
            { icon_name: "quiz", badge_label: "Mock Exams" },
            { icon_name: "school", badge_label: "Exam Prep" },
            { icon_name: "verified", badge_label: "Instant Scoring" }
          ],
          isCompact: false,
          isDashboard: false,
          bannerImage: headerContainer.banner_image || headerContainer.mockup_card
        });

        /** @type {Dashboard} */
        const quizzesPageComponent = new Dashboard({
          tabList: itemData.tab_list || [],
          onNavigatePage: (destinationPath) => {
            this.navigateTo(destinationPath);
          }
        });

        viewportElement.innerHTML = bannerComponent.toString() + quizzesPageComponent.toString();
        bannerComponent.__mount?.();
        quizzesPageComponent.__mount?.();
      } else {
        // 3. If Quiz Page (Banner + Tabs + Subject Overview / Quiz Engine / Results)
        /** @type {string} */
        const quizId = this.resolveQuizId(navigationPath, itemData);
        /** @type {string} */
        const dataJsonPath = itemData.data_path || "data/napolcom-quiz/data.json";

        /** @type {Object} */
        const rawQuizData = await this.fetchNavigationItemData(dataJsonPath);
        /** @type {Object} */
        const adaptedData = adaptQuizData(rawQuizData, dataJsonPath, itemData.tab_list || []);

        /** @type {Array<Object>} */
        const rawQuestions = adaptedData.questions || [];
        /** @type {Array<Object>} */
        const sanitizedQuestions = registerQuestionsAndSanitize(quizId, rawQuestions);

        /** @type {Array<Object>} */
        const sectionBounds = adaptedData.sections.map((section) => ({
          startNum: section.startNumber,
          endNum: section.endNumber,
          startNumber: section.startNumber,
          endNumber: section.endNumber,
          id: section.id,
          title: section.title
        }));

        /** @type {Array<Object>} */
        const tabList = adaptedData.sections.map((section, index) => ({
          tab_title: section.title,
          tabTitle: section.title,
          icon_name: section.iconName || "category",
          iconName: section.iconName || "category",
          section_id: section.id,
          tabIndex: index
        }));

        /** @type {number} */
        const mockExamBudget = itemData.mock_exam_question_count || DEFAULT_MOCK_EXAM_QUESTION_COUNT;
        /** @type {string} */
        const quizTitle = headerContainer.title || itemData.item_title || adaptedData.title || "Mock Exam";
        /** @type {string} */
        const quizDescription = headerContainer.description || adaptedData.subtitle || "";
        /** @type {Array<Object>} */
        const quizBadges = (headerContainer.badge_list && headerContainer.badge_list.length > 0)
          ? headerContainer.badge_list
          : [
              { icon_name: "format_list_numbered", badge_label: `${sanitizedQuestions.length} Questions in Bank` },
              { icon_name: "timer", badge_label: `${Math.min(mockExamBudget, sanitizedQuestions.length)}m Mock Exam` },
              { icon_name: "verified", badge_label: "Multiple Choice" }
            ];

        /** @type {Object} */
        const quizBannerImage = headerContainer.banner_image || headerContainer.mockup_card || { shrink: false };

        /** @type {{ session: Object|null }} */
        const { session } = loadActiveSession(quizId);
        /** @type {QuizEngine|null} */
        let currentActiveQuizEngine = null;
        /** @type {QuizActionBar|null} */
        let initialBannerActionBar = null;
        /** @type {QuizActionBar|null} */
        let initialSectionBar = null;
        /** @type {QuizResults|null} */
        let completedResultsComponent = null;

        // Factory: Create Full Mock Exam Action Bar (~1 Hour Deck) for Banner
        const createFullExamActionBar = () => {
          /** @type {number} */
          const mockQuestionsCount = Math.min(mockExamBudget, sanitizedQuestions.length);
          return new QuizActionBar({
            questionsCount: mockQuestionsCount,
            buttonLabel: "Start Mock Exam",
            tooltipText: `Start ${mockQuestionsCount}-Item Mock Exam (~1 Hour)`,
            isBanner: true,
            onStartQuiz: ({ isTimed, durationSeconds }) => {
              /** @type {Object} */
              const mockDeck = buildMockExamDeck({
                quizId,
                questions: sanitizedQuestions,
                sectionBounds,
                questionBudget: mockExamBudget
              });

              mountQuizEngine({
                examScope: "full",
                deck: mockDeck,
                isTimed,
                totalTimeSeconds: durationSeconds,
                startTime: Date.now()
              });
            }
          });
        };

        // Factory: Create Section Exam Action Bar (Category-Scoped Questions) for Tabs Action Bar
        const createSectionActionBar = (tabIndex = 0) => {
          /** @type {{ startNum: number, endNum: number }} */
          const bounds = getCategoryBounds(tabIndex, sanitizedQuestions.length, tabList.length, sectionBounds);
          /** @type {Array<Object>} */
          const sectionQuestions = sanitizedQuestions.filter(
            (question) => question.number >= bounds.startNum && question.number <= bounds.endNum
          );
          /** @type {number} */
          const sectionCount = Math.max(1, sectionQuestions.length);
          /** @type {Object} */
          const categoryDefinition = tabList[tabIndex] || {};
          /** @type {string} */
          const sectionTitle = categoryDefinition.tab_title || categoryDefinition.tabTitle || `Part ${tabIndex + 1}`;

          return new QuizActionBar({
            questionsCount: sectionCount,
            buttonLabel: sectionTitle,
            tooltipText: `Start ${sectionTitle} Section Exam`,
            isBanner: false,
            onStartQuiz: ({ isTimed, durationSeconds }) => {
              mountQuizEngine({
                examScope: "section",
                sectionCategoryIndex: tabIndex,
                isTimed,
                totalTimeSeconds: durationSeconds,
                startTime: Date.now()
              });
            }
          });
        };

        // Tabs navigation with reactive section button update
        /** @type {Tabs} */
        const tabsComponent = new Tabs({
          tabList,
          initialIndex: 0,
          onTabChange: (selectedIndex) => {
            if (currentActiveQuizEngine) {
              currentActiveQuizEngine.jumpToCategory(selectedIndex);
            } else {
              /** @type {HTMLElement|null} */
              const sectionBarContainer = document.getElementById("quizActionBarContainer");
              if (sectionBarContainer) {
                const sectionBar = createSectionActionBar(selectedIndex);
                sectionBarContainer.innerHTML = sectionBar.toString();
                sectionBar.__mount?.();
              }
            }
          }
        });

        // Handler: Finish exam and show results
        const handleFinishExam = (userAnswers, examMeta = {}) => {
          /** @type {HTMLElement|null} */
          const contentArea = document.getElementById("quizTabContentArea");
          if (!contentArea) return;

          currentActiveQuizEngine = null;

          /** @type {HTMLElement|null} */
          const bannerBadges = document.getElementById("bannerBadgesContainer");
          if (bannerBadges) {
            bannerBadges.innerHTML = "";
          }
          /** @type {HTMLElement|null} */
          const actionBarContainer = document.getElementById("quizActionBarContainer");
          if (actionBarContainer) {
            actionBarContainer.innerHTML = "";
          }

          /** @type {string} */
          const examScope = examMeta.examScope || "full";
          /** @type {number} */
          const sectionCategoryIndex = examMeta.sectionCategoryIndex ?? 0;

          /** @type {Array<Object>} */
          const questionsForScoring = examScope === "full" && examMeta.deck
            ? examMeta.deck.questions
            : sanitizedQuestions;
          /** @type {string} */
          const scoringQuizId = examScope === "full" && examMeta.deck
            ? examMeta.deck.deckQuizId
            : quizId;
          /** @type {Array<Object>} */
          const scoringBounds = examScope === "full" && examMeta.deck
            ? examMeta.deck.sectionBounds
            : sectionBounds;

          /** @type {Object} */
          const scoreTally = evaluateScoreTally(
            scoringQuizId,
            questionsForScoring,
            userAnswers,
            tabList,
            examScope,
            sectionCategoryIndex,
            scoringBounds
          );

          /** @type {Object} */
          const categoryDefinition = tabList[sectionCategoryIndex] || {};
          /** @type {string} */
          const sectionTitle = categoryDefinition.tab_title || categoryDefinition.tabTitle || `Part ${sectionCategoryIndex + 1}`;

          /** @type {QuizResults} */
          const quizResults = new QuizResults({
            scoreTally,
            examMetadata: {
              quizTitle,
              publisher: adaptedData.publisher || "Exam Mastery",
              isTimed: examMeta.isTimed ?? false,
              totalTimeSeconds: examMeta.totalTimeSeconds ?? 0,
              startTime: examMeta.startTime ?? Date.now(),
              examScope,
              sectionTitle
            },
            onRetakeExam: () => {
              clearActiveSession();
              currentActiveQuizEngine = null;
              renderInitialQuizView();
            }
          });

          contentArea.innerHTML = quizResults.toString();
          quizResults.__mount?.();
          window.scrollTo({ top: 0, behavior: "smooth" });
        };

        // Handler: Mount QuizEngine
        const mountQuizEngine = (engineConfig = {}) => {
          /** @type {HTMLElement|null} */
          const contentArea = document.getElementById("quizTabContentArea");
          /** @type {HTMLElement|null} */
          const actionBarContainer = document.getElementById("quizActionBarContainer");
          /** @type {HTMLElement|null} */
          const bannerBadges = document.getElementById("bannerBadgesContainer");

          if (bannerBadges) {
            bannerBadges.innerHTML = "";
          }
          if (actionBarContainer) {
            actionBarContainer.innerHTML = "";
          }
          if (!contentArea) return;

          /** @type {string} */
          const examScope = engineConfig.examScope || "full";
          /** @type {number} */
          const sectionCategoryIndex = engineConfig.sectionCategoryIndex ?? 0;

          /** @type {Array<Object>} */
          const activeQuestions = (examScope === "full" && engineConfig.deck)
            ? engineConfig.deck.questions
            : sanitizedQuestions;
          /** @type {string} */
          const activeEngineQuizId = (examScope === "full" && engineConfig.deck)
            ? engineConfig.deck.deckQuizId
            : quizId;
          /** @type {Array<Object>} */
          const activeEngineBounds = (examScope === "full" && engineConfig.deck)
            ? engineConfig.deck.sectionBounds
            : sectionBounds;

          /** @type {QuizEngine} */
          const quizEngine = new QuizEngine({
            quizId: activeEngineQuizId,
            questions: activeQuestions,
            categories: tabList,
            sectionBounds: activeEngineBounds,
            savedSession: engineConfig.savedSession || null,
            isTimed: engineConfig.isTimed || false,
            totalTimeSeconds: engineConfig.totalTimeSeconds || 0,
            startTime: engineConfig.startTime || Date.now(),
            examScope,
            sectionCategoryIndex,
            onCategoryChange: (categoryIndex) => {
              tabsComponent.activateTab(categoryIndex, false);
            },
            onFinishExam: (userAnswers, finishMeta) => {
              handleFinishExam(userAnswers, {
                examScope: finishMeta?.examScope || examScope,
                sectionCategoryIndex: finishMeta?.sectionCategoryIndex ?? sectionCategoryIndex,
                deck: engineConfig.deck || null,
                isTimed: quizEngine.isTimed,
                totalTimeSeconds: quizEngine.totalTimeSeconds,
                startTime: quizEngine.startTime
              });
            }
          });

          currentActiveQuizEngine = quizEngine;
          contentArea.innerHTML = quizEngine.toString();
          quizEngine.__mount?.();

          if (examScope === "section") {
            tabsComponent.activateTab(sectionCategoryIndex, false);
          }
          window.scrollTo({ top: 0, behavior: "smooth" });
        };

        // Handler: Reset to Initial Start View
        const renderInitialQuizView = () => {
          currentActiveQuizEngine = null;
          tabsComponent.activateTab(0, false);
          /** @type {HTMLElement|null} */
          const contentArea = document.getElementById("quizTabContentArea");
          if (contentArea) {
            contentArea.innerHTML = "";
          }

          // Restore Banner Full Exam Play Button
          /** @type {HTMLElement|null} */
          const bannerBadges = document.getElementById("bannerBadgesContainer");
          if (bannerBadges) {
            const bannerBar = createFullExamActionBar();
            bannerBadges.innerHTML = bannerBar.toString();
            bannerBar.__mount?.();
          }

          // Restore Tab Section Exam Play Button for Tab 0
          /** @type {HTMLElement|null} */
          const actionBarContainer = document.getElementById("quizActionBarContainer");
          if (actionBarContainer) {
            const sectionBar = createSectionActionBar(0);
            actionBarContainer.innerHTML = sectionBar.toString();
            sectionBar.__mount?.();
          }
        };

        /** @type {string} */
        let initialContentHtml = "";
        /** @type {string} */
        let initialActionBarHtml = "";

        if (session && session.status === "completed") {
          /** @type {string} */
          const examScope = session.examScope || "full";
          /** @type {number} */
          const sectionCategoryIndex = session.sectionCategoryIndex ?? 0;
          /** @type {Object|null} */
          const restoredDeck = examScope === "full" ? restoreMockExamDeck(quizId, sanitizedQuestions, sectionBounds) : null;

          /** @type {Array<Object>} */
          const questionsForScoring = restoredDeck ? restoredDeck.questions : sanitizedQuestions;
          /** @type {string} */
          const scoringQuizId = restoredDeck ? restoredDeck.deckQuizId : quizId;
          /** @type {Array<Object>} */
          const scoringBounds = restoredDeck ? restoredDeck.sectionBounds : sectionBounds;

          /** @type {Object} */
          const scoreTally = evaluateScoreTally(
            scoringQuizId,
            questionsForScoring,
            session.answers || {},
            tabList,
            examScope,
            sectionCategoryIndex,
            scoringBounds
          );

          /** @type {Object} */
          const categoryDefinition = tabList[sectionCategoryIndex] || {};
          /** @type {string} */
          const sectionTitle = categoryDefinition.tab_title || categoryDefinition.tabTitle || `Part ${sectionCategoryIndex + 1}`;

          completedResultsComponent = new QuizResults({
            scoreTally,
            examMetadata: {
              quizTitle,
              publisher: adaptedData.publisher || "Exam Mastery",
              isTimed: session.isTimed,
              totalTimeSeconds: session.totalTimeSeconds,
              startTime: session.startTime,
              examScope,
              sectionTitle
            },
            onRetakeExam: () => {
              clearActiveSession();
              currentActiveQuizEngine = null;
              renderInitialQuizView();
            }
          });
          initialContentHtml = completedResultsComponent.toString();
        } else if (session && (session.status === "in_progress" || session.status === "transition")) {
          /** @type {string} */
          const examScope = session.examScope || "full";
          /** @type {number} */
          const sectionCategoryIndex = session.sectionCategoryIndex ?? 0;
          /** @type {Object|null} */
          const restoredDeck = examScope === "full" ? restoreMockExamDeck(quizId, sanitizedQuestions, sectionBounds) : null;

          /** @type {Array<Object>} */
          const activeQuestions = restoredDeck ? restoredDeck.questions : sanitizedQuestions;
          /** @type {string} */
          const activeEngineQuizId = restoredDeck ? restoredDeck.deckQuizId : quizId;
          /** @type {Array<Object>} */
          const activeEngineBounds = restoredDeck ? restoredDeck.sectionBounds : sectionBounds;

          /** @type {QuizEngine} */
          const quizEngine = new QuizEngine({
            quizId: activeEngineQuizId,
            questions: activeQuestions,
            categories: tabList,
            sectionBounds: activeEngineBounds,
            savedSession: session,
            examScope,
            sectionCategoryIndex,
            onCategoryChange: (categoryIndex) => {
              tabsComponent.activateTab(categoryIndex, false);
            },
            onFinishExam: (userAnswers, finishMeta) => {
              handleFinishExam(userAnswers, {
                examScope: finishMeta?.examScope || examScope,
                sectionCategoryIndex: finishMeta?.sectionCategoryIndex ?? sectionCategoryIndex,
                deck: restoredDeck,
                isTimed: quizEngine.isTimed,
                totalTimeSeconds: quizEngine.totalTimeSeconds,
                startTime: quizEngine.startTime
              });
            }
          });
          currentActiveQuizEngine = quizEngine;
          initialContentHtml = quizEngine.toString();
        } else {
          // Initial overview mode
          initialBannerActionBar = createFullExamActionBar();
          initialContentHtml = "";
          initialSectionBar = createSectionActionBar(0);
          initialActionBarHtml = initialSectionBar.toString();
        }

        /** @type {Banner} */
        const bannerComponent = new Banner({
          title: quizTitle,
          description: quizDescription,
          badges: quizBadges,
          isCompact: false,
          isDashboard: false,
          bannerImage: quizBannerImage,
          actionComponent: initialBannerActionBar
        });

        viewportElement.innerHTML = `
          ${bannerComponent.toString()}
          <div class="quiz-view-container">
            ${tabsComponent.toString()}
            <div id="quizTabContentArea" class="quiz-tab-content">
              ${initialContentHtml}
            </div>
            <div id="quizActionBarContainer" class="quiz-action-bar-container">
              ${initialActionBarHtml}
            </div>
          </div>
        `;
        bannerComponent.__mount?.();
        tabsComponent.__mount?.();

        // Mount child components if present
        if (currentActiveQuizEngine) {
          currentActiveQuizEngine.__mount?.();
          /** @type {number} */
          const activeCategoryIndex = (currentActiveQuizEngine.examScope === "section")
            ? currentActiveQuizEngine.sectionCategoryIndex
            : (session?.activeCategoryIndex || 0);
          tabsComponent.activateTab(activeCategoryIndex, false);
        } else if (completedResultsComponent) {
          completedResultsComponent.__mount?.();
        } else {
          initialBannerActionBar?.__mount?.();
          initialSectionBar?.__mount?.();
        }
      }

      viewportElement.scrollTo({ top: 0, behavior: "smooth" });
    } catch (loadingError) {
      console.error("Failed to load quiz item:", loadingError);
      viewportElement.innerHTML = `
        <div style="padding: 4rem 2rem; color: var(--md-sys-color-error); text-align: center;">
          <h2>Error Loading Page</h2>
          <p>Failed to load <code>${navigationPath}</code>.</p>
        </div>
      `;
    }
  }
}
