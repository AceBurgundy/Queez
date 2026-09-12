import { Component, html, signal, css, route, Redirect, getCurrentBrowserPath } from "../../../../Component.js";
import { MiniSidebar } from "../../../sections/mini-sidebar/templates/mini-sidebar.js";
import { Dashboard } from "../../dashboard/templates/dashboard.js";
import { Banner } from "../../../sections/banner/templates/banner.js";
import { Tabs } from "../../../widgets/tabs/templates/tabs.js";
import { Toast } from "../../../widgets/toast/templates/toast.js";
import { LoadingScreen } from "../../../widgets/loading-screen/templates/loading-screen.js";
import { fetchNavigationItemData } from "../../../../common/scripts/data-loader.js";
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

css(import.meta, ["../styles/app.css"]);

/**
 * Main Single Page Application Component for Queez!
 * Orchestrates navigation state, persistent mini-sidebar icon rail,
 * and dynamic viewport mounting (Dashboard vs Quiz view).
 */
export class App extends Component {
  /**
   * @param {Object} [configuration]
   * @param {Object|Array<Object>} [configuration.documentationData={}] - Master quiz registry from data.js.
   * @param {Array<Object>} [configuration.categoryGroups=[]] - Category groups list.
   */
  constructor({
    documentationData = {},
    categoryGroups = []
  } = {}) {
    super();

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

    this.dashboardPath = masterData.dashboard_path || "data/dashboard.js";
    this.quizzesPath = masterData.quizzes_path || "data/quizzes.js";
    this.categoryGroups = Array.isArray(masterData.category_groups)
      ? masterData.category_groups
      : [];

    window.DOCUMENTATION_DATA = masterData;
    window.DOCUMENTATION_ITEMS = window.DOCUMENTATION_ITEMS || {};

    this.activePathSignal = signal(this.dashboardPath);
    this.loadingScreenComponent = new LoadingScreen();
    const toastComponent = new Toast();

    this.miniSidebarComponent = new MiniSidebar({
      activePathSignal: this.activePathSignal,
      onNavigate: (selectedPath) => {
        this.navigateTo(selectedPath);
      }
    });

    this.template = html`
      <div class="app-root" id="appRoot">
        ${this.loadingScreenComponent}
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
        const activeRoute = this.parseCurrentRoute(normalizedPath);
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
    };

    this.beforeUnmount = () => {
      if (typeof this.routeUnsubscribe === "function") {
        this.routeUnsubscribe();
        this.routeUnsubscribe = null;
      }
    };
  }

  /**
   * Resolves the canonical quiz ID from a navigation path or item data.
   * @param {string} navigationPath
   * @param {Object} [itemData]
   * @returns {string}
   */
  resolveQuizId(navigationPath, itemData = null) {
    if (itemData) {
      if (itemData.id) return itemData.id;
      if (itemData.quiz_id) return itemData.quiz_id;
      if (itemData.data && itemData.data.id) return itemData.data.id;
    }
    const cached = window.DOCUMENTATION_ITEMS?.[navigationPath];
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
   * @param {string} quizId
   * @returns {string|null}
   */
  findNavigationPathForQuizId(quizId) {
    if (!quizId) return null;
    const cleanId = quizId.toLowerCase().trim();

    for (const group of this.categoryGroups) {
      for (const navPath of (group.navigation_item_paths || [])) {
        const item = window.DOCUMENTATION_ITEMS?.[navPath];
        const itemId = item?.id || item?.quiz_id || item?.data?.id;
        if (itemId && itemId.toLowerCase() === cleanId) {
          return navPath;
        }
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
   * @param {string} [customPath]
   * @returns {{ type: "dashboard"|"quiz"|"quizzes", quizId?: string, rawPath: string }}
   */
  parseCurrentRoute(customPath = null) {
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
   * @param {string} targetUrlPath
   * @param {Object} [options]
   * @param {boolean} [options.replace=false]
   */
  pushRouteState(targetUrlPath, { replace = false } = {}) {
    Redirect.navigate(targetUrlPath, { replace });
  }

  /**
   * Performs initial page load with loading screen dismissal.
   * @param {string} initialPath
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
   * @param {string} targetNavigationPath
   * @param {Object} [options]
   * @param {boolean} [options.updateHistory=true]
   * @param {boolean} [options.replace=false]
   * @returns {void}
   */
  navigateTo(targetNavigationPath, { updateHistory = true, replace = false } = {}) {
    if (!targetNavigationPath) return;

    let navPath = targetNavigationPath;
    let routePath = "/";

    if (targetNavigationPath === "/quizzes" || targetNavigationPath === "quizzes" || targetNavigationPath === this.quizzesPath) {
      navPath = this.quizzesPath;
      routePath = "/quizzes";
    } else if (targetNavigationPath.startsWith("/quizzes/") || targetNavigationPath.startsWith("quizzes/")) {
      const quizId = targetNavigationPath.replace(/^\/?quizzes\//, "");
      navPath = this.findNavigationPathForQuizId(quizId) || "data/navigation-items/napolcom-mock-exam.js";
      routePath = `/quizzes/${quizId}`;
    } else if (targetNavigationPath === this.dashboardPath || targetNavigationPath === "/") {
      navPath = this.dashboardPath;
      routePath = "/";
    } else {
      const quizId = this.resolveQuizId(targetNavigationPath);
      routePath = `/quizzes/${quizId}`;
      navPath = targetNavigationPath;
    }

    if (updateHistory && typeof window !== "undefined") {
      const targetHash = `#${routePath}`;
      const currentHash = window.location.hash || "#/";
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
      const itemPaths = group.navigation_item_paths || [];
      itemPaths.forEach((path) => {
        fetchNavigationItemData(path).catch(() => {});
      });
    });
  }

  /**
   * Loads navigation item data using the common data loader.
   * @param {string} navigationPath
   * @returns {Promise<Object>}
   */
  async fetchNavigationItemData(navigationPath) {
    return fetchNavigationItemData(navigationPath);
  }

  /**
   * Dynamically mounts either the Dashboard or a Quiz into the main viewport.
   * @param {string} navigationPath
   * @returns {Promise<void>}
   */
  async loadNavigationItem(navigationPath) {
    const viewportElement = document.getElementById("mainViewport");
    if (!viewportElement || !navigationPath) {
      return;
    }

    this.activePathSignal.value = navigationPath;


    try {
      const itemData = await this.fetchNavigationItemData(navigationPath);
      const headerContainer = itemData.header_container || {};

      // 1. If Dashboard
      if (navigationPath === this.dashboardPath) {
        const startNowButton = new StartNowButton({
          label: "Start Now",
          onStart: () => {
            this.navigateTo("/quizzes");
          }
        });

        const bannerComponent = new Banner({
          title: headerContainer.title || "Queez!",
          description: headerContainer.description || "",
          badges: [],
          isCompact: false,
          isDashboard: true,
          bannerImage: headerContainer.banner_image || headerContainer.mockup_card || {},
          actionComponent: startNowButton
        });

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
        // 3. If Quiz Page (Banner + 4-column Tabs + Subject Overview / Quiz Engine / Results)
        const quizId = this.resolveQuizId(navigationPath, itemData);

        const dataJsonPath = itemData.data_path || "data/napolcom-quiz/data.json";
        let rawQuestions = [];
        try {
          const rawQuizData = await this.fetchNavigationItemData(dataJsonPath);
          rawQuestions = (rawQuizData && rawQuizData.data && rawQuizData.data.questions) ||
                         (rawQuizData && rawQuizData.questions) ||
                         (itemData.data && itemData.data.questions) || [];
        } catch (fetchErr) {
          console.warn("Could not fetch quiz data JSON, falling back to embedded data:", fetchErr);
          rawQuestions = (itemData.data && itemData.data.questions) || [];
        }

        // Security: Register answers strictly in memory closure and sanitize questions
        const sanitizedQuestions = registerQuestionsAndSanitize(quizId, rawQuestions);

        const quizTitle = headerContainer.title || itemData.item_title || (itemData.data && itemData.data.title) || "Mock Exam";
        const quizDescription = headerContainer.description || (itemData.data && itemData.data.subtitle) || "";
        const quizBadges = (headerContainer.badge_list && headerContainer.badge_list.length > 0)
          ? headerContainer.badge_list
          : [
              { icon_name: "format_list_numbered", badge_label: `${sanitizedQuestions.length || 150} Questions` },
              { icon_name: "school", badge_label: (itemData.data && itemData.data.publisher) || "Exam Mastery" },
              { icon_name: "verified", badge_label: "Multiple Choice" }
            ];
        const quizBannerImage = headerContainer.banner_image || headerContainer.mockup_card || {
          shrink: false
        };

        const tabList = (itemData.tab_list && itemData.tab_list.length > 0)
          ? itemData.tab_list
          : [
              { tab_title: "Verbal Reasoning", icon_name: "spellcheck", section_blocks: [] },
              { tab_title: "Quantitative", icon_name: "calculate", section_blocks: [] },
              { tab_title: "Logical Reasoning", icon_name: "psychology", section_blocks: [] },
              { tab_title: "General Info", icon_name: "public", section_blocks: [] }
            ];

        const { session } = loadActiveSession(quizId);
        let currentActiveQuizEngine = null;
        let initialBannerActionBar = null;
        let initialSectionBar = null;
        let completedResultsComponent = null;

        // Factory: Create Full Exam Action Bar (All Questions) for Banner
        const createFullExamActionBar = () => {
          const totalQuestions = sanitizedQuestions.length || 1;
          return new QuizActionBar({
            questionsCount: totalQuestions,
            buttonLabel: "Start Mock Exam",
            tooltipText: "Start Full Mock Exam",
            isBanner: true,
            onStartQuiz: ({ isTimed, durationSeconds }) => {
              mountQuizEngine({
                examScope: "full",
                isTimed,
                totalTimeSeconds: durationSeconds,
                startTime: Date.now()
              });
            }
          });
        };

        // Factory: Create Section Exam Action Bar (Category-Scoped Questions) for Tabs Action Bar
        const createSectionActionBar = (tabIdx = 0) => {
          const bounds = getCategoryBounds(tabIdx, sanitizedQuestions.length, tabList.length);
          const sectionQuestions = sanitizedQuestions.filter(
            (q) => q.number >= bounds.startNum && q.number <= bounds.endNum
          );
          const sectionCount = Math.max(1, sectionQuestions.length);
          const catDef = tabList[tabIdx] || {};
          const sectionTitle = catDef.tab_title || catDef.tabTitle || `Part ${tabIdx + 1}`;

          return new QuizActionBar({
            questionsCount: sectionCount,
            buttonLabel: sectionTitle,
            tooltipText: `Start ${sectionTitle} Section Exam`,
            isBanner: false,
            onStartQuiz: ({ isTimed, durationSeconds }) => {
              mountQuizEngine({
                examScope: "section",
                sectionCategoryIndex: tabIdx,
                isTimed,
                totalTimeSeconds: durationSeconds,
                startTime: Date.now()
              });
            }
          });
        };

        // Tabs navigation with reactive section button update
        const tabsComponent = new Tabs({
          tabList,
          initialIndex: 0,
          onTabChange: (selectedIdx) => {
            if (currentActiveQuizEngine) {
              currentActiveQuizEngine.jumpToCategory(selectedIdx);
            } else {
              const sectionBarContainer = document.getElementById("quizActionBarContainer");
              if (sectionBarContainer) {
                const sectionBar = createSectionActionBar(selectedIdx);
                sectionBarContainer.innerHTML = sectionBar.toString();
                sectionBar.__mount?.();
              }
            }
          }
        });

        // Handler: Finish exam and show results (Full or Section-limited)
        const handleFinishExam = (userAnswers, examMeta = {}) => {
          const contentArea = document.getElementById("quizTabContentArea");
          if (!contentArea) return;

          currentActiveQuizEngine = null;

          const bannerBadges = document.getElementById("bannerBadgesContainer");
          if (bannerBadges) {
            bannerBadges.innerHTML = "";
          }
          const actionBarContainer = document.getElementById("quizActionBarContainer");
          if (actionBarContainer) {
            actionBarContainer.innerHTML = "";
          }

          const examScope = examMeta.examScope || "full";
          const sectionCategoryIndex = examMeta.sectionCategoryIndex ?? 0;

          const scoreTally = evaluateScoreTally(
            quizId,
            sanitizedQuestions,
            userAnswers,
            tabList,
            examScope,
            sectionCategoryIndex
          );

          const catDef = tabList[sectionCategoryIndex] || {};
          const sectionTitle = catDef.tab_title || catDef.tabTitle || `Part ${sectionCategoryIndex + 1}`;

          const quizResults = new QuizResults({
            scoreTally,
            examMetadata: {
              quizTitle,
              publisher: (itemData.data && itemData.data.publisher) || "Exam Mastery",
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

        // Handler: Mount QuizEngine (Full or Section)
        const mountQuizEngine = (engineConfig = {}) => {
          const contentArea = document.getElementById("quizTabContentArea");
          const actionBarContainer = document.getElementById("quizActionBarContainer");
          const bannerBadges = document.getElementById("bannerBadgesContainer");

          if (bannerBadges) {
            bannerBadges.innerHTML = "";
          }
          if (actionBarContainer) {
            actionBarContainer.innerHTML = "";
          }
          if (!contentArea) return;

          const examScope = engineConfig.examScope || "full";
          const sectionCategoryIndex = engineConfig.sectionCategoryIndex ?? 0;

          const quizEngine = new QuizEngine({
            quizId,
            questions: sanitizedQuestions,
            categories: tabList,
            savedSession: engineConfig.savedSession || null,
            isTimed: engineConfig.isTimed || false,
            totalTimeSeconds: engineConfig.totalTimeSeconds || 0,
            startTime: engineConfig.startTime || Date.now(),
            examScope,
            sectionCategoryIndex,
            onCategoryChange: (catIdx) => {
              tabsComponent.activateTab(catIdx, false);
            },
            onFinishExam: (userAnswers, finishMeta) => {
              handleFinishExam(userAnswers, {
                examScope: finishMeta?.examScope || examScope,
                sectionCategoryIndex: finishMeta?.sectionCategoryIndex ?? sectionCategoryIndex,
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

        // Handler: Reset to Initial Start View with both Banner and Tab play buttons restored
        const renderInitialQuizView = () => {
          currentActiveQuizEngine = null;
          tabsComponent.activateTab(0, false);
          const contentArea = document.getElementById("quizTabContentArea");
          if (contentArea) {
            contentArea.innerHTML = "";
          }

          // Restore Banner Full Exam Play Button
          const bannerBadges = document.getElementById("bannerBadgesContainer");
          if (bannerBadges) {
            const bannerBar = createFullExamActionBar();
            bannerBadges.innerHTML = bannerBar.toString();
            bannerBar.__mount?.();
          }

          // Restore Tab Section Exam Play Button for Tab 0
          const actionBarContainer = document.getElementById("quizActionBarContainer");
          if (actionBarContainer) {
            const sectionBar = createSectionActionBar(0);
            actionBarContainer.innerHTML = sectionBar.toString();
            sectionBar.__mount?.();
          }
        };

        let initialContentHtml = "";
        let initialActionBarHtml = "";

        if (session && session.status === "completed") {
          // Render results directly
          const examScope = session.examScope || "full";
          const sectionCategoryIndex = session.sectionCategoryIndex ?? 0;
          const scoreTally = evaluateScoreTally(
            quizId,
            sanitizedQuestions,
            session.answers || {},
            tabList,
            examScope,
            sectionCategoryIndex
          );

          const catDef = tabList[sectionCategoryIndex] || {};
          const sectionTitle = catDef.tab_title || catDef.tabTitle || `Part ${sectionCategoryIndex + 1}`;

          completedResultsComponent = new QuizResults({
            scoreTally,
            examMetadata: {
              quizTitle,
              publisher: (itemData.data && itemData.data.publisher) || "Exam Mastery",
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
          // Restore in-progress or transition engine
          const examScope = session.examScope || "full";
          const sectionCategoryIndex = session.sectionCategoryIndex ?? 0;

          const quizEngine = new QuizEngine({
            quizId,
            questions: sanitizedQuestions,
            categories: tabList,
            savedSession: session,
            examScope,
            sectionCategoryIndex,
            onCategoryChange: (catIdx) => {
              tabsComponent.activateTab(catIdx, false);
            },
            onFinishExam: (userAnswers, finishMeta) => {
              handleFinishExam(userAnswers, {
                examScope: finishMeta?.examScope || examScope,
                sectionCategoryIndex: finishMeta?.sectionCategoryIndex ?? sectionCategoryIndex,
                isTimed: quizEngine.isTimed,
                totalTimeSeconds: quizEngine.totalTimeSeconds,
                startTime: quizEngine.startTime
              });
            }
          });
          currentActiveQuizEngine = quizEngine;
          initialContentHtml = quizEngine.toString();
        } else {
          // Initial overview mode: empty contentArea, full exam bar on banner, section bar on tabs
          initialBannerActionBar = createFullExamActionBar();
          initialContentHtml = "";
          initialSectionBar = createSectionActionBar(0);
          initialActionBarHtml = initialSectionBar.toString();
        }

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
          const activeCategoryIdx = (currentActiveQuizEngine.examScope === "section")
            ? currentActiveQuizEngine.sectionCategoryIndex
            : (session?.activeCategoryIndex || 0);
          tabsComponent.activateTab(activeCategoryIdx, false);
        } else if (completedResultsComponent) {
          completedResultsComponent.__mount?.();
        } else {
          // Initial state: mount banner Full Exam bar & tab Section Exam bar
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
