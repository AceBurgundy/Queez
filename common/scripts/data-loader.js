/**
 * Asynchronously fetches and parses documentation navigation item specifications.
 * Uses window.DOCUMENTATION_ITEMS cache when available.
 * @param {string} navigationPath - Target navigation item path (e.g. "data/navigation-items/overview-and-tenets.js" or "data/dashboard.js").
 * @returns {Promise<Object>} Resolved navigation item specification.
 */
export async function fetchNavigationItemData(navigationPath) {
  if (typeof window === "undefined") {
    return {};
  }

  window.DOCUMENTATION_ITEMS = window.DOCUMENTATION_ITEMS || {};

  if (window.DOCUMENTATION_ITEMS[navigationPath]) {
    return window.DOCUMENTATION_ITEMS[navigationPath];
  }

  const cleanPath = navigationPath.replace(/^\.?\//, "");

  if (navigationPath.endsWith(".json")) {
    const jsonUrl = cleanPath;
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to load quiz JSON from path: ${jsonUrl} (status: ${response.status})`);
    }
    const jsonData = await response.json();
    window.DOCUMENTATION_ITEMS[navigationPath] = jsonData;
    return jsonData;
  }

  return new Promise((resolve, reject) => {
    /** @type {HTMLScriptElement} */
    const scriptElement = document.createElement("script");
    const scriptSource = cleanPath;
    scriptElement.src = scriptSource;
    scriptElement.onload = () => {
      if (window.DOCUMENTATION_ITEMS[navigationPath]) {
        resolve(window.DOCUMENTATION_ITEMS[navigationPath]);
      } else {
        reject(
          new Error(
            `Script loaded for ${navigationPath} but window.DOCUMENTATION_ITEMS["${navigationPath}"] was undefined.`
          )
        );
      }
    };
    scriptElement.onerror = () => {
      reject(
        new Error(
          `Failed to load navigation item script from path: ${scriptSource}`
        )
      );
    };
    document.head.appendChild(scriptElement);
  });
}
