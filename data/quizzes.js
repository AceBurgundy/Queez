/**
 * Navigation item specification: Queezes Catalog Page (/quizzes).
 * Central catalog listing all available mock examinations and questionnaires.
 */
window.DOCUMENTATION_ITEMS = window.DOCUMENTATION_ITEMS || {};
window.DOCUMENTATION_ITEMS["data/quizzes.js"] = {
  "id": "quizzes",
  "item_title": "Queezes",
  "icon_name": "quiz",
  "header_container": {
    "title": "Queezes",
    "description": "Interactive Questionnaire and Mock Examination Catalog. Select an examination to view subject domains and begin practice.",
    "badge_list": [
      { "icon_name": "quiz", "badge_label": "Mock Exams" },
      { "icon_name": "school", "badge_label": "Exam Prep" },
      { "icon_name": "timer", "badge_label": "Timed Tests" },
      { "icon_name": "verified", "badge_label": "Instant Scoring" }
    ],
    "banner_image": {},
    "mockup_card": {}
  },
  "tab_list": [
    {
      "tab_title": "All Queezes",
      "icon_name": "dashboard",
      "section_blocks": [
        {
          "heading_title": "Available Queezes",
          "block_type": "cards_container",
          "layout_type": "two_cards",
          "cards": [
            {
              "title": "Milk Operation and Farm Management",
              "label": "Dairy Agriculture",
              "quiz_id": "milk-operation-farm-management",
              "link": "queezes/milk-operation-farm-management",
              "image_source": "data/milk-operation-quiz/assets/card-image.png",
              "shrink": false,
              "description": "Comprehensive 464-item dairy farming certification examination covering 12 domains: History, Breeds, Reproduction, Anatomy, Nutrition, Silage, Facilities, Health, and Equipment."
            },
            {
              "title": "NAPOLCOM Entrance Examination",
              "label": "Featured Exam",
              "quiz_id": "napolcom-mock-exam-7a8f",
              "link": "queezes/napolcom-mock-exam-7a8f",
              "image_source": "",
              "shrink": false,
              "description": "Complete 150-item practice mock examination prepared for review purposes. Covers Verbal Reasoning, Quantitative Math, Logical Deduction, and Philippine Constitution & Police Laws."
            }
          ]
        }
      ]
    }
  ]
};
