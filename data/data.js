/**
 * Queez! Master Data Registry.
 * Central grouping point for the dashboard landing page, quizzes catalog, and all quiz categories.
 * @type {Object}
 */
const documentationData = {
  dashboard_path: "data/dashboard.js",
  quizzes_path: "data/quizzes.js",
  category_groups: [
    {
      category_name: "Queezes",
      navigation_item_paths: [
        "data/navigation-items/napolcom-mock-exam.js",
        "data/navigation-items/milk-operation-farm-management.js"
      ]
    }
  ]
};

export default documentationData;
