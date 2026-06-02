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
  },

  // ── Level 5: Saved Schools Dashboard + Decision Workspace ──
  trackDashboardOpened: function(savedCount) {
    this.trackEvent('dashboard_opened', { saved_count: savedCount });
  },

  trackDecisionStatusChanged: function(schoolId, oldStatus, newStatus) {
    this.trackEvent('decision_status_changed', { school_id: schoolId, old_status: oldStatus, new_status: newStatus });
  },

  trackNotesUpdated: function(schoolId) {
    this.trackEvent('notes_updated', { school_id: schoolId });
  },

  trackDashboardCompareStarted: function(schoolIds) {
    this.trackEvent('dashboard_compare_started', { school_ids: schoolIds.join(',') });
  },

  trackDeadlineClicked: function(schoolId, deadlineType) {
    this.trackEvent('deadline_clicked', { school_id: schoolId, deadline_type: deadlineType });
  },

  trackDashboardRecommendationClicked: function(recommendedSchoolId) {
    this.trackEvent('dashboard_recommendation_clicked', { recommended_school_id: recommendedSchoolId });
  },

  // ── Level 6: School Dashboard & Moderation ──
  trackProfileUpdate: function(schoolId) {
    this.trackEvent('school_profile_updated', { school_id: schoolId });
  },
  trackGalleryUpload: function(schoolId, imageUrl) {
    this.trackEvent('gallery_uploaded', { school_id: schoolId, image_url: imageUrl });
  },
  trackAdmissionUpdate: function(schoolId) {
    this.trackEvent('admission_updated', { school_id: schoolId });
  },
  trackPendingUpdateSubmitted: function(schoolId, updateType) {
    this.trackEvent('pending_update_submitted', { school_id: schoolId, update_type: updateType });
  },

  // ── Level 7: Admission Workflow System & Tracker MVP ──
  trackApplicationTrackerOpened: function(savedCount) {
    this.trackEvent('application_tracker_opened', { saved_count: savedCount });
  },
  trackStatusChanged: function(schoolId, oldStatus, newStatus) {
    this.trackEvent('status_changed', { school_id: schoolId, old_status: oldStatus, new_status: newStatus });
  },
  trackChecklistUpdated: function(schoolId, itemKey, isChecked) {
    this.trackEvent('checklist_updated', { school_id: schoolId, item_key: itemKey, is_checked: isChecked });
  },
  trackDeadlineViewed: function(schoolId, eventName) {
    this.trackEvent('deadline_viewed', { school_id: schoolId, event_name: eventName });
  },
  trackQuickActionClicked: function(schoolId, actionType) {
    this.trackEvent('quick_action_clicked', { school_id: schoolId, action_type: actionType });
  },
  trackNotesUpdated: function(schoolId) {
    this.trackEvent('notes_updated', { school_id: schoolId });
  }
};

