/* ─────────────────────────────────────────────────────────
   analytics.js — Scholr Analytics & Event Tracking Module
   ───────────────────────────────────────────────────────── */

window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) };

window.ScholrAnalytics = {
  /**
   * Base event tracker with graceful fallback
   */
  trackEvent: function(eventName, props = {}) {
    try {
      if (window.plausible) {
        window.plausible(eventName, { props: props });
      }
    } catch (e) {
      // Fail silently if blocked by ad-blocker
    }
  },

  trackSchoolView: function(schoolId, schoolName) {
    this.trackEvent('school_page_view', { school_id: schoolId, school_name: schoolName });
  },

  trackCompareUsage: function(schoolIds) {
    this.trackEvent('compare_started', { school_ids: schoolIds.join(',') });
  },

  trackSavedSchool: function(schoolId) {
    this.trackEvent('school_saved', { school_id: schoolId });
  },

  trackFilterUsage: function(board, fee) {
    this.trackEvent('filter_applied', { board: board || 'any', fee: fee || 'any' });
  },

  trackContactClick: function(type, schoolId) {
    this.trackEvent('school_contact_clicked', { contact_type: type, school_id: schoolId });
  },

  trackSearch: function(query) {
    this.trackEvent('search_performed', { query: query });
  },

  trackSuggestUpdateClick: function(schoolId) {
    this.trackEvent('suggest_update_clicked', { school_id: schoolId });
  },

  trackSuggestSchool: function() {
    this.trackEvent('suggest_school_submitted');
  },

  trackSuggestSchoolOpened: function() {
    this.trackEvent('suggest_school_opened');
  },

  // ── Level 2: Claim School ────────────────────────────────
  trackClaimButtonClick: function(schoolId, schoolName) {
    this.trackEvent('claim_button_clicked', { school_id: schoolId, school_name: schoolName });
  },

  trackClaimSubmitted: function(schoolId) {
    this.trackEvent('claim_submitted', { school_id: schoolId });
  },

  // ── Level 3: Admissions ────────────────────────────────
  trackAdmissionTimelineViewed: function(schoolId) {
    this.trackEvent('admission_timeline_viewed', { school_id: schoolId });
  },

  trackAdmissionStatusClicked: function(schoolId, status) {
    this.trackEvent('admission_status_clicked', { school_id: schoolId, status: status });
  },

  // ── Level 4: Discovery & Recommendations ────────────────
  trackRecommendationClicked: function(source, schoolId) {
    this.trackEvent('recommendation_clicked', { source: source, school_id: schoolId });
  },

  trackAdvancedFilterUsed: function(filterType, value) {
    this.trackEvent('advanced_filter_used', { filter_type: filterType, value: value });
  },

  trackSimilarSchoolOpened: function(sourceSchoolId, targetSchoolId) {
    this.trackEvent('similar_school_opened', { source_id: sourceSchoolId, target_id: targetSchoolId });
  },

  trackSmartSearchUsed: function(query, resultCount) {
    this.trackEvent('smart_search_used', { query: query, result_count: resultCount });
  },

  trackRecommendationGroupViewed: function(groupName) {
    this.trackEvent('recommendation_group_viewed', { group_name: groupName });
  }
};

