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
  }
};
