/**
 * @file Navigation item specification: Civil Service Examination.
 * Maps section identifiers to presentation icons and configures mock exam parameters.
 */
window.DOCUMENTATION_ITEMS = window.DOCUMENTATION_ITEMS || {};
window.DOCUMENTATION_ITEMS["data/navigation-items/civil-service-exam.js"] = {
  "id": "civil-service-exam",
  "quiz_id": "civil-service-exam",
  "item_title": "Civil Service Exam",
  "icon_name": "school",
  "data_path": "data/civil-service-quiz/data.json",
  "header_container": {
    "title": "Civil Service Examination",
    "description": "Comprehensive Career Service Professional & Sub-Professional Examination covering 7 domains: Verbal Ability, Reading Comprehension, Paragraph Organization, Analytical & Logic, Numerical Ability, General Information, and Clerical Operations.",
    "badge_list": [
      { "icon_name": "school", "badge_label": "Career Service" },
      { "icon_name": "verified", "badge_label": "7 Domains Covered" }
    ],
    "banner_image": { "shrink": false },
    "mockup_card": { "shrink": false }
  },
  "tab_list": [
    { "section_id": "verbal-ability", "icon_name": "spellcheck" },
    { "section_id": "reading-comprehension", "icon_name": "menu_book" },
    { "section_id": "paragraph-organization", "icon_name": "format_list_numbered" },
    { "section_id": "analytical-ability", "icon_name": "psychology" },
    { "section_id": "numerical-ability", "icon_name": "calculate" },
    { "section_id": "general-information", "icon_name": "public" },
    { "section_id": "clerical-operations", "icon_name": "inventory" }
  ]
};
