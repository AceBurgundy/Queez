/**
 * @file Navigation item specification: Milk Operation and Farm Management Examination.
 * Maps section identifiers to presentation icons and configures mock exam parameters.
 */
window.DOCUMENTATION_ITEMS = window.DOCUMENTATION_ITEMS || {};
window.DOCUMENTATION_ITEMS["data/navigation-items/milk-operation-farm-management.js"] = {
  "id": "milk-operation-farm-management",
  "quiz_id": "milk-operation-farm-management",
  "item_title": "Milk Operation & Farm Management",
  "icon_name": "agriculture",
  "data_path": "data/milk-operation-quiz/data.json",
  "header_container": {
    "title": "Milk Operation and Farm Management",
    "description": "Comprehensive Dairy Farming Examination & Technical Review covering 12 domains: History, Breeds, Reproduction, Anatomy, Nutrition, Silage, Facilities, Health, and Equipment.",
    "badge_list": [
      { "icon_name": "school", "badge_label": "Dairysquare" },
      { "icon_name": "verified", "badge_label": "12 Modules Covered" }
    ],
    "banner_image": { "shrink": false },
    "mockup_card": { "shrink": false }
  },
  "tab_list": [
    { "section_id": "overview-history", "icon_name": "history" },
    { "section_id": "breeds-bcs", "icon_name": "pets" },
    { "section_id": "breeding-reproduction", "icon_name": "favorite" },
    { "section_id": "body-parts-hoof", "icon_name": "accessibility_new" },
    { "section_id": "digestion-compartments", "icon_name": "restaurant" },
    { "section_id": "nutrition-feeds", "icon_name": "grass" },
    { "section_id": "forage-pasture", "icon_name": "nature" },
    { "section_id": "silage-making", "icon_name": "inventory" },
    { "section_id": "housing-cow-comfort", "icon_name": "home" },
    { "section_id": "calving-calf-care", "icon_name": "child_care" },
    { "section_id": "herd-health-diseases", "icon_name": "medical_services" },
    { "section_id": "tools-milking-equipment", "icon_name": "build" }
  ]
};
