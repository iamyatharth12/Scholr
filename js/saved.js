/**
 * Scholr Saved Schools Dashboard & Decision Workspace (Level 5)
 * Manages the "My Admission Dashboard" state, UI rendering, autosave, and comparisons.
 */

// ── State Management ──────────────────────────────────────────────────
let deviceId = localStorage.getItem('scholr_device_id');
if (!deviceId) {
  deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  localStorage.setItem('scholr_device_id', deviceId);
}

let savedSchoolsList = JSON.parse(localStorage.getItem('savedSchools')) || [];
let localMetadataCache = JSON.parse(localStorage.getItem('savedSchoolsMetadata')) || {};
let parentProgressCache = JSON.parse(localStorage.getItem('parentApplicationProgress')) || {};
let schoolRequirementsCache = JSON.parse(localStorage.getItem('schoolAdmissionRequirements')) || {};
let dbSchools = []; // Fetched details for saved schools
let selectedCompareList = [];
let autosaveTimeouts = {};

// Safe attribute escaper
function safeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Helper: Get parent progress for a school
function getParentProgress(schoolId) {
  if (!parentProgressCache[schoolId]) {
    parentProgressCache[schoolId] = {
      status: 'Exploring',
      checklist_progress: {},
      notes: ''
    };
  }
  return parentProgressCache[schoolId];
}

// Helper: Get metadata for a school
function getSchoolMetadata(schoolId) {
  return localMetadataCache[schoolId] || {
    decision_status: 'exploring',
    saved_school_notes: '',
    decision_tags: [],
    shortlist_rank: null
  };
}

// Helper: Save metadata locally
function saveLocalMetadata(schoolId, data) {
  localMetadataCache[schoolId] = {
    ...getSchoolMetadata(schoolId),
    ...data
  };
  localStorage.setItem('savedSchoolsMetadata', JSON.stringify(localMetadataCache));
}

// ── Database Sync ─────────────────────────────────────────────────────
async function fetchSavedSchoolsData() {
  const db = window.ScholrDB;
  if (!db) {
    console.warn('[Scholr Dashboard] Supabase client not available, using offline mode.');
    return fetchOfflineMockData();
  }

  try {
    // 1. Fetch the schools themselves
    const { data: schoolsData, error: schoolsError } = await db
      .from('schools')
      .select('*')
      .in('id', savedSchoolsList);

    if (schoolsError) throw schoolsError;
    dbSchools = schoolsData || [];

    // 2. Fetch the saved school workflow metadata
    const { data: metaData, error: metaError } = await db
      .from('saved_schools')
      .select('*')
      .eq('device_id', deviceId)
      .in('school_id', savedSchoolsList);

    if (metaError) {
      console.warn('[Scholr Dashboard] Failed to load metadata from DB:', metaError.message);
    } else if (metaData) {
      // Sync DB metadata to local cache
      metaData.forEach(row => {
        localMetadataCache[row.school_id] = {
          decision_status: row.decision_status || 'exploring',
          saved_school_notes: row.saved_school_notes || '',
          decision_tags: row.decision_tags || [],
          shortlist_rank: row.shortlist_rank
        };
      });
      localStorage.setItem('savedSchoolsMetadata', JSON.stringify(localMetadataCache));
    }

    // 3. Fetch school-specific requirements from school_admission_requirements
    const { data: reqsData, error: reqsError } = await db
      .from('school_admission_requirements')
      .select('*')
      .in('school_id', savedSchoolsList);

    if (!reqsError && reqsData) {
      schoolRequirementsCache = {};
      reqsData.forEach(row => {
        if (!schoolRequirementsCache[row.school_id]) {
          schoolRequirementsCache[row.school_id] = [];
        }
        schoolRequirementsCache[row.school_id].push({
          name: row.requirement_name,
          required: row.required
        });
      });
      localStorage.setItem('schoolAdmissionRequirements', JSON.stringify(schoolRequirementsCache));
    }

    // 4. Fetch parent application progress from parent_application_progress
    const { data: progressData, error: progressError } = await db
      .from('parent_application_progress')
      .select('*')
      .eq('user_identifier', deviceId)
      .in('school_id', savedSchoolsList);

    if (!progressError && progressData) {
      progressData.forEach(row => {
        parentProgressCache[row.school_id] = {
          status: row.status || 'Exploring',
          checklist_progress: row.checklist_progress || {},
          notes: row.notes || '',
          updated_at: row.updated_at
        };
      });
      localStorage.setItem('parentApplicationProgress', JSON.stringify(parentProgressCache));
    }
  } catch (err) {
    console.error('[Scholr Dashboard] Database fetch error, falling back to local data:', err);
    await fetchOfflineMockData();
  }
}

// Sync parent application progress updates to Supabase (with elegant debounced state)
async function syncParentProgressToDB(schoolId) {
  const db = window.ScholrDB;
  if (!db) return; // Silent local-only if DB unavailable

  const progress = getParentProgress(schoolId);
  try {
    const { error } = await db
      .from('parent_application_progress')
      .upsert({
        user_identifier: deviceId,
        school_id: schoolId,
        status: progress.status,
        checklist_progress: progress.checklist_progress,
        notes: progress.notes || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_identifier,school_id' });

    if (error) throw error;
  } catch (err) {
    console.warn('[Scholr Dashboard] Supabase parent progress sync failed:', err.message);
  }
}

// Offline backup data fetcher (resolves from local storage list if Supabase is offline)
async function fetchOfflineMockData() {
  // If we had a previously fetched set of all schools in memory, try to find them
  if (window.Scholr && window.Scholr.allSchools) {
    dbSchools = window.Scholr.allSchools.filter(s => savedSchoolsList.includes(String(s.id)));
  } else {
    // Attempt global select
    const db = window.ScholrDB;
    if (db) {
      const { data } = await db.from('schools').select('*');
      if (data) {
        window.Scholr.allSchools = data;
        dbSchools = data.filter(s => savedSchoolsList.includes(String(s.id)));
        return;
      }
    }
    dbSchools = [];
  }
}

// Sync single metadata updates to Supabase (with elegant debounced state)
async function syncMetadataToDB(schoolId, data) {
  saveLocalMetadata(schoolId, data);
  
  const db = window.ScholrDB;
  if (!db) return; // Silent local-only if DB unavailable

  const metadata = getSchoolMetadata(schoolId);
  try {
    const { error } = await db
      .from('saved_schools')
      .upsert({
        device_id: deviceId,
        school_id: schoolId,
        decision_status: metadata.decision_status,
        saved_school_notes: metadata.saved_school_notes,
        decision_tags: metadata.decision_tags,
        shortlist_rank: metadata.shortlist_rank,
        updated_at: new Date().toISOString()
      }, { onConflict: 'device_id,school_id' });

    if (error) throw error;
  } catch (err) {
    console.warn('[Scholr Dashboard] Supabase metadata sync failed, cached locally:', err.message);
  }
}

// ── Rendering Engine ──────────────────────────────────────────────────
function renderDashboard() {
  const cardsGrid = document.getElementById('cards-grid');
  const emptyState = document.getElementById('empty-state');
  const countBadge = document.getElementById('listings-count');
  const loadingState = document.getElementById('loading-state');
  const recommendationSection = document.getElementById('recommendations-container');

  if (loadingState) loadingState.style.display = 'none';

  if (savedSchoolsList.length === 0) {
    if (cardsGrid) cardsGrid.style.display = 'none';
    if (recommendationSection) recommendationSection.style.display = 'none';
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.style.display = 'flex';
      renderSmartOnboarding(emptyState);
    }
    if (countBadge) countBadge.textContent = '0 schools saved';
    return;
  }

  if (emptyState) {
    emptyState.hidden = true;
    emptyState.style.display = 'none';
  }
  if (cardsGrid) {
    cardsGrid.style.display = 'grid';
    cardsGrid.innerHTML = '';
  }
  if (countBadge) {
    countBadge.textContent = `${dbSchools.length} school${dbSchools.length !== 1 ? 's' : ''} in your workspace`;
  }

  dbSchools.forEach((school, index) => {
    const cardHTML = buildDashboardCardHTML(school, index);
    if (cardsGrid) {
      const cardWrapper = document.createElement('div');
      cardWrapper.innerHTML = cardHTML;
      const cardElement = cardWrapper.firstElementChild;
      cardsGrid.appendChild(cardElement);
      wireDashboardCardEvents(cardElement, school.id);
    }
  });

  // Render smart contextual recommendations
  renderRecommendations();
  updateDashboardCompareBar();
}

// Calculate upcoming admission milestones countdown (trust-focused dates check)
function getUpcomingMilestones(school) {
  const milestones = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysDiff = (dateStr) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 1. Applications Start Date
  if (school.application_start_date) {
    const diff = getDaysDiff(school.application_start_date);
    if (diff === 0) {
      milestones.push({ text: "Applications open today!", label: "application_start", icon: "🟢", status: "open_today" });
    } else if (diff === 1) {
      milestones.push({ text: "Applications open tomorrow", label: "application_start", icon: "📅", status: "open_tomorrow" });
    } else if (diff > 1 && diff <= 30) {
      milestones.push({ text: `Applications open in ${diff} days`, label: "application_start", icon: "📅", status: "open_future" });
    }
  }

  // 2. Application Deadline
  if (school.application_deadline) {
    const diff = getDaysDiff(school.application_deadline);
    if (diff === 0) {
      milestones.push({ text: "Applications close today!", label: "application_deadline", icon: "⏳", status: "deadline_today", urgent: true });
    } else if (diff === 1) {
      milestones.push({ text: "Applications close tomorrow!", label: "application_deadline", icon: "⏳", status: "deadline_tomorrow", urgent: true });
    } else if (diff > 1 && diff <= 10) {
      milestones.push({ text: `Applications close in ${diff} days`, label: "application_deadline", icon: "⏳", status: "deadline_soon", urgent: true });
    } else if (diff > 10) {
      milestones.push({ text: `Applications close in ${diff} days`, label: "application_deadline", icon: "📅", status: "deadline_future" });
    }
  }

  // 3. Interview Date
  if (school.interview_date) {
    const diff = getDaysDiff(school.interview_date);
    if (diff === 0) {
      milestones.push({ text: "Interview scheduled today", label: "interview", icon: "🤝", status: "interview_today", highlight: true });
    } else if (diff === 1) {
      milestones.push({ text: "Interview scheduled tomorrow", label: "interview", icon: "🤝", status: "interview_tomorrow", highlight: true });
    } else if (diff > 1) {
      milestones.push({ text: `Interview in ${diff} days`, label: "interview", icon: "📅", status: "interview_future" });
    }
  }

  // 4. Result Date
  if (school.result_date) {
    const diff = getDaysDiff(school.result_date);
    if (diff === 0) {
      milestones.push({ text: "Results expected today", label: "result", icon: "📢", status: "result_today", highlight: true });
    } else if (diff === 1) {
      milestones.push({ text: "Results expected tomorrow", label: "result", icon: "📢", status: "result_tomorrow", highlight: true });
    } else if (diff > 1) {
      milestones.push({ text: `Results expected in ${diff} days`, label: "result", icon: "📅", status: "result_future" });
    }
  }

  return milestones;
}

// Build beautiful, calm dashboard card
function buildDashboardCardHTML(school, index) {
  const meta = getSchoolMetadata(school.id);
  
  // Get parent application progress from cache
  const progress = getParentProgress(school.id);
  const appStatus = progress.status || 'Exploring';
  const progressChecklist = progress.checklist_progress || {};
  const notes = progress.notes || ''; // Target notes in parent_application_progress

  const boardKey = window.Scholr.boardClass ? window.Scholr.boardClass(school.board) : 'cbse';
  const feeCategory = school.fee_category || (window.Scholr.inferFeeCategory ? window.Scholr.inferFeeCategory(school.fees) : 'Mid Range');
  const feeClass = window.Scholr.feeCategoryClass ? window.Scholr.feeCategoryClass(feeCategory) : 'fee--mid';

  // Core Trust & Freshness Indicators
  let trustSignalsHTML = '';
  if (window.ScholrTrust) {
    const badge = window.ScholrTrust.getVerificationBadge(school.verification_level, { compact: true });
    const fresh = window.ScholrTrust.renderFreshnessChip(school.updated_at, school.last_verified_at);
    if (badge || fresh) {
      trustSignalsHTML = `<div class="dashboard-card__trust">${badge}${fresh}</div>`;
    }
  }

  // Dynamic Deadline Integration with low-panic UX
  let actionCenterHTML = '';
  const milestones = getUpcomingMilestones(school);
  
  if (milestones.length > 0) {
    const itemsHTML = milestones.map(m => {
      let alertClass = 'action-center-alert';
      if (m.urgent) alertClass += ' action-center-alert--urgent';
      else if (m.highlight || m.status === 'open_today') alertClass += ' action-center-alert--success';
      
      return `
        <div class="${alertClass} deadline-tracker-item" data-school-id="${school.id}" data-event-type="${safeAttr(m.label)}" style="cursor:pointer; margin-bottom: 8px;">
          <span>${m.icon}</span>
          <div style="text-align: left; flex: 1;">
            <span class="action-center-alert__title">${m.text}</span>
            <span class="action-center-alert__sub">Admission Phase: ${m.label.replace('_', ' ')}</span>
          </div>
        </div>
      `;
    }).join('');
    
    actionCenterHTML = `
      <div class="workspace__section-header" style="margin-top: 4px;">
        <span class="workspace__section-title">⏱️ Upcoming Milestones</span>
      </div>
      <div class="milestones-alert-container" style="display: flex; flex-direction: column;">
        ${itemsHTML}
      </div>
    `;
  } else {
    // Graceful missing data handling
    actionCenterHTML = `
      <div class="workspace__section-header" style="margin-top: 4px;">
        <span class="workspace__section-title">⏱️ Upcoming Milestones</span>
      </div>
      <div class="missing-requirements-box" style="padding: 12px; width: 100%;">
        <p class="missing-requirements-text">No upcoming deadlines published yet.</p>
      </div>
    `;
  }

  // Preparation Checklist steps tracker
  const steps = [
    { key: 'documents_prepared', label: 'Documents Prepared' },
    { key: 'application_started', label: 'Application Started' },
    { key: 'form_submitted', label: 'Form Submitted' },
    { key: 'admission_fee_paid', label: 'Admission Fee Paid' },
    { key: 'interview_completed', label: 'Interview Completed' },
    { key: 'awaiting_result', label: 'Awaiting Result' }
  ];

  let checkedCount = 0;
  const stepsHTML = steps.map(step => {
    const isChecked = progressChecklist[step.key] === true;
    if (isChecked) checkedCount++;
    return `
      <label class="checklist-item ${isChecked ? 'checked' : ''}">
        <input type="checkbox" class="step-checklist-cb" data-school-id="${school.id}" data-step-key="${step.key}" ${isChecked ? 'checked' : ''}>
        <span class="checklist-label">${step.label}</span>
      </label>
    `;
  }).join('');

  const allPrepared = checkedCount === steps.length;
  const readinessBadge = allPrepared 
    ? `<span class="readiness-completion-badge">✓ Complete</span>`
    : `<span class="readiness-completion-badge incomplete">Progress (${checkedCount}/${steps.length})</span>`;

  // HSL visual status chips classes mapping for compact Application Status Selector
  let appStatusClass = 'status-chip--exploring';
  const statusLower = appStatus.toLowerCase();
  if (statusLower.includes('exploring')) appStatusClass = 'status-chip--exploring';
  else if (statusLower.includes('preparing')) appStatusClass = 'status-chip--preparing';
  else if (statusLower.includes('started')) appStatusClass = 'status-chip--started';
  else if (statusLower.includes('submitted')) appStatusClass = 'status-chip--submitted';
  else if (statusLower.includes('pending')) appStatusClass = 'status-chip--pending';
  else if (statusLower.includes('awaiting')) appStatusClass = 'status-chip--awaiting';
  else if (statusLower.includes('admitted') || statusLower.includes('confirm')) appStatusClass = 'status-chip--admitted';
  else if (statusLower.includes('reject')) appStatusClass = 'status-chip--rejected';

  // Compact Quick Actions Panel
  const isCheckedCompare = selectedCompareList.includes(String(school.id)) ? 'checked' : '';

  return `
    <article class="dashboard-card card-enter" style="animation-delay: ${index * 0.05}s;" id="dash-card-${school.id}" data-id="${school.id}">
      <!-- Header Actions -->
      <div class="dashboard-card__header">
        <label class="dashboard-card__compare-checkbox" title="Select to Quick Compare">
          <input type="checkbox" class="dash-compare-cb" data-id="${school.id}" ${isCheckedCompare}>
          <span class="cb-custom"></span>
          <span class="cb-label">Compare</span>
        </label>
        
        <button class="dashboard-card__remove-btn" data-id="${school.id}" aria-label="Remove School from tracker" title="Remove School">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <!-- Main Info -->
      <div class="dashboard-card__main-info">
        <div class="dashboard-card__title-row">
          <h3 class="dashboard-card__name"><a href="school.html?id=${school.id}">${window.Scholr.safe(school.name)}</a></h3>
          <span class="card__board board--${boardKey}">${window.Scholr.safe(school.board)}</span>
        </div>
        
        <p class="dashboard-card__location">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${window.Scholr.safe(school.location)}, ${window.Scholr.safe(school.city)}
        </p>

        <div class="dashboard-card__meta">
          <span class="dashboard-card__fees">${window.Scholr.safe(school.fees ?? '—')}</span>
          <span class="fee-category-badge ${feeClass}">${window.Scholr.safe(feeCategory)}</span>
          ${school.rating ? `<span class="dashboard-card__rating">⭐ ${school.rating.toFixed(1)}</span>` : ''}
        </div>

        ${trustSignalsHTML}
      </div>

      <!-- Upcoming Milestones Countdown Section -->
      ${actionCenterHTML}

      <!-- Division Line -->
      <hr class="dashboard-card__divider">

      <!-- Premium Admission Tracker Area -->
      <div class="dashboard-card__workspace">
        
        <!-- Application State HSL Chip Selector -->
        <div class="workspace__status-row">
          <label class="workspace__label">Admission Status</label>
          <div class="status-select-wrapper">
            <select class="workspace__app-status-select status-chip ${appStatusClass}" data-school-id="${school.id}" style="padding: 4px 24px 4px 10px; font-size:0.75rem; border-radius:100px; border:1px solid #cbd5e1; cursor:pointer; outline:none; font-weight: 700;">
              <option value="Exploring" ${appStatus === 'Exploring' ? 'selected' : ''}>🔍 Exploring</option>
              <option value="Preparing Documents" ${appStatus === 'Preparing Documents' ? 'selected' : ''}>🟡 Preparing Documents</option>
              <option value="Application Started" ${appStatus === 'Application Started' ? 'selected' : ''}>🔵 Application Started</option>
              <option value="Submitted" ${appStatus === 'Submitted' ? 'selected' : ''}>✉️ Submitted</option>
              <option value="Interview Pending" ${appStatus === 'Interview Pending' ? 'selected' : ''}>🤝 Interview Pending</option>
              <option value="Awaiting Result" ${appStatus === 'Awaiting Result' ? 'selected' : ''}>📢 Awaiting Result</option>
              <option value="Admitted" ${appStatus === 'Admitted' ? 'selected' : ''}>🟢 Admitted</option>
              <option value="Rejected" ${appStatus === 'Rejected' ? 'selected' : ''}>🔴 Rejected</option>
            </select>
          </div>
        </div>

        <!-- Preparation Checklist Tracker -->
        <div class="workspace__section-header">
          <span class="workspace__section-title">📂 Preparation Checklist</span>
          ${readinessBadge}
        </div>
        <div class="workspace__checklist">
          ${stepsHTML}
        </div>

        <!-- Inline Notes Field with autosave -->
        <div class="workspace__notes-container">
          <div class="notes__header">
            <span class="notes__title-icon">📝</span>
            <label class="workspace__label">Personal Admission Notes</label>
            <span class="notes__autosave-status" id="autosave-status-${school.id}">Saved</span>
          </div>
          <textarea 
            class="workspace__notes-textarea" 
            placeholder="e.g. Need transport confirmation. Ask about hostel. Prepare transfer certificate..." 
            data-id="${school.id}">${window.Scholr.safe(notes)}</textarea>
        </div>

        <!-- Quick Actions Panel -->
        <div class="workspace__section-header" style="margin-bottom: 2px;">
          <span class="workspace__section-title">⚡ Quick Actions</span>
        </div>
        <div class="quick-actions-panel">
          <a href="school.html?id=${school.id}" class="quick-action-btn quick-action-btn-view" data-school-id="${school.id}">
            👁️ View School
          </a>
          <button class="quick-action-btn quick-action-btn-compare" data-school-id="${school.id}">
            📊 Compare
          </button>
          <button class="quick-action-btn quick-action-btn-contact" data-school-id="${school.id}">
            📞 Contact
          </button>
          ${school.apply_url ? `
            <a href="${encodeURI(school.apply_url)}" target="_blank" class="quick-action-btn quick-action-btn--apply" data-school-id="${school.id}">
              🚀 Apply
            </a>
          ` : ''}
        </div>
      </div>
    </article>
  `;
}

// Onboarding template for empty admission trackers
function renderSmartOnboarding(container) {
  container.innerHTML = `
    <div class="onboarding-card" style="box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05); border: 1px solid var(--clr-border);">
      <div class="onboarding-card__hero" style="font-size: 3rem;">📋</div>
      <h3 class="onboarding-card__title" style="margin-top: 16px;">No schools in your admission tracker yet.</h3>
      <p class="onboarding-card__desc" style="color: var(--clr-text-secondary); max-width: 420px; margin-bottom: 24px;">
        Save schools to start managing your admission journey. Track statuses, document preparation checklists, and deadline countdowns in one central place.
      </p>
      <div class="onboarding-card__actions">
        <a href="index.html#schools-section" class="btn btn--primary" style="padding: 12px 24px; font-weight:600; border-radius:100px;">Explore Schools</a>
      </div>
    </div>
  `;
}

// Contextual recommendations
async function renderRecommendations() {
  const container = document.getElementById('recommendations-container');
  if (!container) return;

  if (savedSchoolsList.length === 0 || dbSchools.length === 0) {
    container.style.display = 'none';
    return;
  }

  // Load all schools if not loaded
  if (!window.Scholr.allSchools) {
    const db = window.ScholrDB;
    if (db) {
      const { data } = await db.from('schools').select('*').order('rating', { ascending: false });
      if (data) window.Scholr.allSchools = data;
    }
  }

  const allSchools = window.Scholr.allSchools || [];
  if (allSchools.length === 0) {
    container.style.display = 'none';
    return;
  }

  // Recommendation builder: Deterministically find matching schools
  // Look at what boards and fee categories the user saved
  const savedBoards = [...new Set(dbSchools.map(s => s.board).filter(Boolean))];
  const savedCities = [...new Set(dbSchools.map(s => s.city).filter(Boolean))];

  // We want to suggest up to 3 schools that match these boards and locations, but are NOT already saved
  const matches = allSchools
    .filter(s => !savedSchoolsList.includes(String(s.id)))
    .map(school => {
      let score = 0;
      let reasons = [];

      if (savedBoards.includes(school.board)) {
        score += 5;
        reasons.push(`${school.board} board`);
      }

      const schoolFeeCat = school.fee_category || (window.Scholr.inferFeeCategory ? window.Scholr.inferFeeCategory(school.fees) : 'Mid Range');
      const savedFeeCats = dbSchools.map(ds => ds.fee_category || (window.Scholr.inferFeeCategory ? window.Scholr.inferFeeCategory(ds.fees) : 'Mid Range'));
      if (savedFeeCats.includes(schoolFeeCat)) {
        score += 3;
        reasons.push(`${schoolFeeCat} fee tier`);
      }

      if (savedCities.includes(school.city)) {
        score += 2;
        reasons.push(`${school.city} location`);
      }

      return { school, score, reasons };
    })
    .filter(item => item.score >= 5)
    .sort((a, b) => b.score - a.score || (b.school.rating || 0) - (a.school.rating || 0))
    .slice(0, 3);

  if (matches.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  const recsGrid = document.getElementById('recommendations-grid');
  if (!recsGrid) return;

  recsGrid.innerHTML = matches.map(match => {
    const school = match.school;
    const boardKey = window.Scholr.boardClass ? window.Scholr.boardClass(school.board) : 'cbse';
    const reasonText = `Recommended because of matching ${match.reasons.slice(0, 2).join(' and ')}.`;
    
    return `
      <article class="rec-card" data-id="${school.id}">
        <div class="rec-card__top">
          <span class="card__board board--${boardKey}">${window.Scholr.safe(school.board)}</span>
          <span class="rec-card__reason-badge">Match</span>
        </div>
        <h4 class="rec-card__name">${window.Scholr.safe(school.name)}</h4>
        <p class="rec-card__meta">${window.Scholr.safe(school.location)} · ${window.Scholr.safe(school.fees)}</p>
        <p class="rec-card__explanation">${reasonText}</p>
        <button class="btn btn--outline rec-card__cta" data-id="${school.id}">View School</button>
      </article>
    `;
  }).join('');

  // Wire recommendation clicks
  recsGrid.querySelectorAll('.rec-card__cta').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (window.ScholrAnalytics) {
        window.ScholrAnalytics.trackDashboardRecommendationClicked(id);
      }
      window.location.href = `school.html?id=${id}`;
    });
  });
}

// Wire events for a single card
function wireDashboardCardEvents(cardEl, schoolId) {
  const strId = String(schoolId);

  // 1. Remove School from Tracker
  const removeBtn = cardEl.querySelector('.dashboard-card__remove-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Smooth scale/fade before removal
      cardEl.style.transform = 'scale(0.95)';
      cardEl.style.opacity = '0';
      
      setTimeout(() => {
        savedSchoolsList = savedSchoolsList.filter(id => id !== strId);
        localStorage.setItem('savedSchools', JSON.stringify(savedSchoolsList));
        selectedCompareList = selectedCompareList.filter(id => id !== strId);
        
        delete localMetadataCache[strId];
        localStorage.setItem('savedSchoolsMetadata', JSON.stringify(localMetadataCache));
        delete parentProgressCache[strId];
        localStorage.setItem('parentApplicationProgress', JSON.stringify(parentProgressCache));

        // Sync deletion to Supabase
        const db = window.ScholrDB;
        if (db) {
          db.from('saved_schools').delete().eq('device_id', deviceId).eq('school_id', strId).then();
          db.from('parent_application_progress').delete().eq('user_identifier', deviceId).eq('school_id', strId).then();
        }

        dbSchools = dbSchools.filter(s => s.id !== schoolId);
        renderDashboard();
      }, 250);
    });
  }

  // 2. Compare Checkbox
  const compareCb = cardEl.querySelector('.dash-compare-cb');
  if (compareCb) {
    compareCb.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (isChecked) {
        if (!selectedCompareList.includes(strId)) {
          if (selectedCompareList.length < 3) {
            selectedCompareList.push(strId);
          } else {
            e.target.checked = false;
            alert('You can select up to 3 schools for a side-by-side comparison.');
          }
        }
      } else {
        selectedCompareList = selectedCompareList.filter(id => id !== strId);
      }
      updateDashboardCompareBar();
      
      // Sync text on quick action compare button
      const quickCompareBtn = cardEl.querySelector('.quick-action-btn-compare');
      if (quickCompareBtn) {
        quickCompareBtn.textContent = selectedCompareList.includes(strId) ? '📊 Selected' : '📊 Compare';
      }
    });
  }

  // 3. Application Status Dropdown Change
  const appStatusSelect = cardEl.querySelector('.workspace__app-status-select');
  if (appStatusSelect) {
    appStatusSelect.addEventListener('change', async (e) => {
      const progress = getParentProgress(schoolId);
      const oldStatus = progress.status || 'Exploring';
      const newStatus = e.target.value;

      // Update HSL chip colors
      let appStatusClass = 'status-chip--exploring';
      const statusLower = newStatus.toLowerCase();
      if (statusLower.includes('exploring')) appStatusClass = 'status-chip--exploring';
      else if (statusLower.includes('preparing')) appStatusClass = 'status-chip--preparing';
      else if (statusLower.includes('started')) appStatusClass = 'status-chip--started';
      else if (statusLower.includes('submitted')) appStatusClass = 'status-chip--submitted';
      else if (statusLower.includes('pending')) appStatusClass = 'status-chip--pending';
      else if (statusLower.includes('awaiting')) appStatusClass = 'status-chip--awaiting';
      else if (statusLower.includes('admitted') || statusLower.includes('confirm')) appStatusClass = 'status-chip--admitted';
      else if (statusLower.includes('reject')) appStatusClass = 'status-chip--rejected';

      appStatusSelect.className = `workspace__app-status-select status-chip ${appStatusClass}`;

      // Cache & Sync to DB
      parentProgressCache[schoolId].status = newStatus;
      localStorage.setItem('parentApplicationProgress', JSON.stringify(parentProgressCache));
      await syncParentProgressToDB(schoolId);

      if (window.ScholrAnalytics) {
        window.ScholrAnalytics.trackStatusChanged(schoolId, oldStatus, newStatus);
      }
    });
  }

  // 4. Custom Milestone Checklist Checkboxes
  cardEl.querySelectorAll('.step-checklist-cb').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const stepKey = e.target.dataset.stepKey;
      const isChecked = e.target.checked;

      const itemLabel = cb.closest('.checklist-item');
      if (itemLabel) {
        itemLabel.classList.toggle('checked', isChecked);
      }

      // Update Cache
      const progress = getParentProgress(schoolId);
      progress.checklist_progress[stepKey] = isChecked;
      parentProgressCache[schoolId] = progress;
      localStorage.setItem('parentApplicationProgress', JSON.stringify(parentProgressCache));

      // Debounce and Sync
      const key = 'progress_' + schoolId;
      if (autosaveTimeouts[key]) clearTimeout(autosaveTimeouts[key]);
      autosaveTimeouts[key] = setTimeout(async () => {
        await syncParentProgressToDB(schoolId);
        
        // Live updates for progress completion badge
        const steps = [
          'documents_prepared',
          'application_started',
          'form_submitted',
          'admission_fee_paid',
          'interview_completed',
          'awaiting_result'
        ];
        let checkedCount = 0;
        steps.forEach(k => {
          if (progress.checklist_progress[k] === true) checkedCount++;
        });
        const badge = cardEl.querySelector('.readiness-completion-badge');
        if (badge) {
          if (checkedCount === steps.length) {
            badge.className = 'readiness-completion-badge';
            badge.innerHTML = '✓ Complete';
          } else {
            badge.className = 'readiness-completion-badge incomplete';
            badge.innerHTML = `Progress (${checkedCount}/${steps.length})`;
          }
        }

        if (window.ScholrAnalytics) {
          window.ScholrAnalytics.trackChecklistUpdated(schoolId, stepKey, isChecked);
        }
      }, 400);
    });
  });

  // 5. Timeline Milestones Click Tracker
  cardEl.querySelectorAll('.deadline-tracker-item').forEach(alertBox => {
    alertBox.addEventListener('click', () => {
      const eventType = alertBox.dataset.eventType;
      if (window.ScholrAnalytics) {
        window.ScholrAnalytics.trackDeadlineViewed(schoolId, eventType);
      }
    });
  });

  // 6. Personal Notes Autosave with Debounce
  const textarea = cardEl.querySelector('.workspace__notes-textarea');
  const autosaveStatus = cardEl.querySelector(`#autosave-status-${schoolId}`);
  if (textarea && autosaveStatus) {
    textarea.addEventListener('input', (e) => {
      const text = e.target.value;
      autosaveStatus.textContent = 'Saving...';
      autosaveStatus.classList.add('saving');

      if (autosaveTimeouts[schoolId]) clearTimeout(autosaveTimeouts[schoolId]);
      
      autosaveTimeouts[schoolId] = setTimeout(async () => {
        // Cache & save in parent progress table
        const progress = getParentProgress(schoolId);
        progress.notes = text;
        parentProgressCache[schoolId] = progress;
        localStorage.setItem('parentApplicationProgress', JSON.stringify(parentProgressCache));
        
        await syncParentProgressToDB(schoolId);
        
        autosaveStatus.textContent = 'Saved';
        autosaveStatus.classList.remove('saving');

        if (window.ScholrAnalytics) {
          window.ScholrAnalytics.trackNotesUpdated(schoolId);
        }
      }, 400);
    });
  }

  // 7. Quick Actions Panel events
  // 7a. View School Button
  const qvBtn = cardEl.querySelector('.quick-action-btn-view');
  if (qvBtn) {
    qvBtn.addEventListener('click', () => {
      if (window.ScholrAnalytics) {
        window.ScholrAnalytics.trackQuickActionClicked(schoolId, 'view_school');
      }
    });
  }

  // 7b. Compare Toggle Button
  const qcBtn = cardEl.querySelector('.quick-action-btn-compare');
  if (qcBtn) {
    qcBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (compareCb) {
        compareCb.click(); // programmatically triggers compareCb change handler
        if (window.ScholrAnalytics) {
          window.ScholrAnalytics.trackQuickActionClicked(schoolId, 'compare_toggle');
        }
      }
    });
  }

  // 7c. Contact School Action Button
  const qcontactBtn = cardEl.querySelector('.quick-action-btn-contact');
  if (qcontactBtn) {
    qcontactBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.ScholrAnalytics) {
        window.ScholrAnalytics.trackQuickActionClicked(schoolId, 'contact_school');
      }
      
      // Try WhatsApp first, then office phone, email, website or details page fallback
      const school = dbSchools.find(s => s.id === schoolId) || {};
      if (school.whatsapp_contact) {
        const waClean = school.whatsapp_contact.replace(/\D/g, '');
        window.open(`https://wa.me/${waClean || school.whatsapp_contact}`, '_blank');
      } else if (school.admission_office_phone || school.phone) {
        window.location.href = `tel:${school.admission_office_phone || school.phone}`;
      } else if (school.email) {
        window.location.href = `mailto:${school.email}`;
      } else {
        window.location.href = `school.html?id=${schoolId}#action-buttons`;
      }
    });
  }

  // 7d. Outbound Apply Button
  const qapplyBtn = cardEl.querySelector('.quick-action-btn--apply');
  if (qapplyBtn) {
    qapplyBtn.addEventListener('click', () => {
      if (window.ScholrAnalytics) {
        window.ScholrAnalytics.trackQuickActionClicked(schoolId, 'apply_link');
      }
    });
  }
}

// ── Quick Compare State Sync ──────────────────────────────────────────
function updateDashboardCompareBar() {
  const bar = document.getElementById('dash-compare-bar');
  const countText = document.getElementById('dash-selected-count');
  const launchBtn = document.getElementById('dash-compare-launch-btn');

  if (!bar) return;

  if (selectedCompareList.length > 0) {
    bar.style.display = 'flex';
    bar.classList.add('slide-up');
    if (countText) countText.textContent = `${selectedCompareList.length} school${selectedCompareList.length !== 1 ? 's' : ''} selected`;
    if (launchBtn) launchBtn.disabled = selectedCompareList.length < 2;
  } else {
    bar.style.display = 'none';
    bar.classList.remove('slide-up');
  }

  // Constrain select options on cards grid
  document.querySelectorAll('.dash-compare-cb').forEach(cb => {
    const id = String(cb.dataset.id);
    cb.disabled = !cb.checked && selectedCompareList.length >= 3;
    
    // Maintain checked visual state in case of multiple renders
    cb.checked = selectedCompareList.includes(id);
    
    // Update matching quick action button styling
    const cardEl = document.getElementById(`dash-card-${id}`);
    if (cardEl) {
      const qBtn = cardEl.querySelector('.quick-action-btn-compare');
      if (qBtn) {
        if (selectedCompareList.includes(id)) {
          qBtn.textContent = '📊 Selected';
          qBtn.style.background = 'var(--clr-blue-600)';
          qBtn.style.color = '#ffffff';
          qBtn.style.borderColor = 'var(--clr-blue-600)';
        } else {
          qBtn.textContent = '📊 Compare';
          qBtn.style.background = '';
          qBtn.style.color = '';
          qBtn.style.borderColor = '';
        }
      }
    }
  });
}

// ── Initialization Sequence ──────────────────────────────────────────
async function initDashboard() {
  const loadingState = document.getElementById('loading-state');
  if (loadingState) loadingState.style.display = 'block';

  // 1. Fetch data
  await fetchSavedSchoolsData();

  // 2. Render UI
  renderDashboard();

  // 3. Track dashboard opened
  if (window.ScholrAnalytics) {
    window.ScholrAnalytics.trackApplicationTrackerOpened(savedSchoolsList.length);
  }

  // 4. Wire Compare Action Button
  const compareBtn = document.getElementById('dash-compare-launch-btn');
  if (compareBtn) {
    compareBtn.addEventListener('click', () => {
      if (selectedCompareList.length >= 2) {
        if (window.ScholrAnalytics) {
          window.ScholrAnalytics.trackDashboardCompareStarted(selectedCompareList);
        }
        window.location.href = `compare.html?ids=${selectedCompareList.join(',')}`;
      }
    });
  }
}

// Run init on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});
