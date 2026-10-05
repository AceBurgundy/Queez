/**
 * @file Navigation item specification: NAPOLCOM Mock Examination.
 * Maps section identifiers to presentation icons and configures mock exam parameters.
 */
window.DOCUMENTATION_ITEMS = window.DOCUMENTATION_ITEMS || {};
window.DOCUMENTATION_ITEMS["data/navigation-items/napolcom-mock-exam.js"] = {
  "id": "napolcom-mock-exam-7a8f",
  "quiz_id": "napolcom-mock-exam-7a8f",
  "item_title": "NAPOLCOM Mock Exam",
  "icon_name": "assignment",
  "data_path": "data/napolcom-quiz/data.json",
  "mock_exam_question_count": 60,
  "header_container": {
    "title": "NAPOLCOM Entrance Mock Exam",
    "description": "Complete practice mock examination prepared for review purposes. Covers Verbal Reasoning, Quantitative Math, Logical Deduction, and Philippine Constitution & Police Laws.",
    "badge_list": [
      { "icon_name": "school", "badge_label": "Exam Mastery" },
      { "icon_name": "verified", "badge_label": "Multiple Choice" }
    ],
    "banner_image": { "shrink": false },
    "mockup_card": { "shrink": false }
  },
  "tab_list": [
    {
      "section_id": "verbal-reasoning",
      "icon_name": "spellcheck"
    },
    {
      "section_id": "quantitative",
      "icon_name": "calculate"
    },
    {
      "section_id": "logical-reasoning",
      "icon_name": "psychology"
    },
    {
      "section_id": "general-info",
      "icon_name": "public"
    }
  ]
};
