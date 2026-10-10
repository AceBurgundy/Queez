/**
 * @file Navigation item specification: PAFOCS Qualifying Examination.
 * Maps section identifiers to presentation icons and configures mock exam parameters.
 */
window.DOCUMENTATION_ITEMS = window.DOCUMENTATION_ITEMS || {};
window.DOCUMENTATION_ITEMS["data/navigation-items/pafocs-exam.js"] = {
  "id": "pafocs-exam",
  "quiz_id": "pafocs-exam",
  "item_title": "PAFOCS Exam",
  "icon_name": "military_tech",
  "data_path": "data/pafocs-quiz/data.json",
  "header_container": {
    "title": "PAFOCS Qualifying Examination",
    "description": "Philippine Air Force Officer Candidate School Qualifying Exam (PAFOCS) covering 6 comprehensive subtests: English, Science, Mathematics, Abstract Reasoning, Diagrammatic Reasoning, and Spatial Ability.",
    "badge_list": [
      { "icon_name": "military_tech", "badge_label": "PAFOCS Officer Candidate" },
      { "icon_name": "verified", "badge_label": "400 Items • 6 Subtests" }
    ],
    "banner_image": { "shrink": false },
    "mockup_card": { "shrink": false }
  },
  "tab_list": [
    { "section_id": "english", "icon_name": "menu_book" },
    { "section_id": "science", "icon_name": "science" },
    { "section_id": "mathematics", "icon_name": "calculate" },
    { "section_id": "abstract-reasoning", "icon_name": "psychology" },
    { "section_id": "diagrammatic-reasoning", "icon_name": "account_tree" },
    { "section_id": "spatial-ability", "icon_name": "view_in_ar" }
  ]
};
