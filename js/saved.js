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
let dbSchools = []; // Fetched details for saved schools
let selectedCompareList = [];
let autosaveTimeouts = {};

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
  } catch (err) {
    console.error('[Scholr Dashboard] Database fetch error, falling back to local data:', err);
    await fetchOfflineMockData();
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

// Build beautiful, calm dashboard card
function buildDashboardCardHTML(school, index) {
  const meta = getSchoolMetadata(school.id);
  const status = meta.decision_status || 'exploring';
  const notes = meta.saved_school_notes || '';
  
  // Custom board badge styling
  const boardKey = window.Scholr.boardClass ? window.Scholr.boardClass(school.board) : 'cbse';
  
  // Fee Category badge
  const feeCategory = school.fee_category || (window.Scholr.inferFeeCategory ? window.Scholr.inferFeeCategory(school.fees) : 'Mid Range');
  const feeClass = window.Scholr.feeCategoryClass ? window.Scholr.feeCategoryClass(feeCategory) : 'fee--mid';

  // Admission status calculations
  let statusChipHTML = '';
  let deadlineHTML = '';
  if (window.ScholrAdmissions) {
    statusChipHTML = window.ScholrAdmissions.renderStatusChip(school);
    const countdown = window.ScholrAdmissions.getCountdownText(school);
    const admStatus = window.ScholrAdmissions.getAdmissionStatus(school);
    
    let deadlineClass = 'deadline--info';
    if (admStatus === 'Closing Soon') deadlineClass = 'deadline--danger';
    else if (admStatus === 'Opening Soon') deadlineClass = 'deadline--warning';
    else if (admStatus === 'Applications Closed') deadlineClass = 'deadline--muted';

    deadlineHTML = `
      <div class="dashboard-card__deadline ${deadlineClass}" data-school-id="${school.id}">
        <span class="deadline-icon">📅</span>
        <span class="deadline-text">${window.ScholrAdmissions.formatAdmissionDate(school.application_deadline) !== 'TBA' ? 'Deadline: ' + window.ScholrAdmissions.formatAdmissionDate(school.application_deadline) : 'Admissions details TBA'}</span>
      </div>
    `;
  }

  // Trust indicators
  let trustSignalsHTML = '';
  if (window.ScholrTrust) {
    const badge = window.ScholrTrust.getVerificationBadge(school.verification_level, { compact: true });
    const fresh = window.ScholrTrust.renderFreshnessChip(school.updated_at, school.last_verified_at);
    if (badge || fresh) {
      trustSignalsHTML = `<div class="dashboard-card__trust">${badge}${fresh}</div>`;
    }
  }

  // Selected for compare check
  const isChecked = selectedCompareList.includes(String(school.id)) ? 'checked' : '';

  return `
    <article class="dashboard-card card-enter" style="animation-delay: ${index * 0.05}s;" id="dash-card-${school.id}" data-id="${school.id}">
      <!-- Header Actions -->
      <div class="dashboard-card__header">
        <label class="dashboard-card__compare-checkbox" title="Select to Quick Compare">
          <input type="checkbox" class="dash-compare-cb" data-id="${school.id}" ${isChecked}>
          <span class="cb-custom"></span>
          <span class="cb-label">Compare</span>
        </label>
        
        <button class="dashboard-card__remove-btn" data-id="${school.id}" aria-label="Remove School from shortlist" title="Remove School">
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

      <!-- Admission Status Indicator -->
      <div class="dashboard-card__admissions">
        ${statusChipHTML}
        ${deadlineHTML}
      </div>

      <!-- Workspace Division Line -->
      <hr class="dashboard-card__divider">

      <!-- Decision Workspace Area -->
      <div class="dashboard-card__workspace">
        <div class="workspace__status-row">
          <label class="workspace__label">Decision Status</label>
          <div class="workspace__status-dropdown-container">
            <select class="workspace__status-select status-select--${status}" data-id="${school.id}">
              <option value="exploring" ${status === 'exploring' ? 'selected' : ''}>🔍 Exploring</option>
              <option value="preferred" ${status === 'preferred' ? 'selected' : ''}>🎯 Preferred</option>
              <option value="backup" ${status === 'backup' ? 'selected' : ''}>🛡️ Backup Option</option>
              <option value="rejected" ${status === 'rejected' ? 'selected' : ''}>❌ Muted / Rejected</option>
            </select>
          </div>
        </div>

        <!-- Notes System -->
        <div class="workspace__notes-container">
          <div class="notes__header">
            <span class="notes__title-icon">📝</span>
            <label class="workspace__label">Personal Admission Notes</label>
            <span class="notes__autosave-status" id="autosave-status-${school.id}">Saved</span>
          </div>
          <textarea 
            class="workspace__notes-textarea" 
            placeholder="Pros: Strong academics, close by&#10;Cons: High sports fee&#10;Next Action: Schedule campus visit..." 
            data-id="${school.id}">${window.Scholr.safe(notes)}</textarea>
        </div>
      </div>
    </article>
  `;
}

// Onboarding template for empty shortlists
function renderSmartOnboarding(container) {
  container.innerHTML = `
    <div class="onboarding-card">
      <div class="onboarding-card__hero">🏫</div>
      <h3 class="onboarding-card__title">Create Your Admission Workspace</h3>
      <p class="onboarding-card__desc">
        Shortlist your ideal schools, track official deadline countdowns, compare options side-by-side, and record your private pros & cons in one calm, reliable workspace.
      </p>
      <div class="onboarding-card__actions">
        <a href="index.html#listings" class="btn btn--primary">Find Schools to Shortlist</a>
        <button class="btn btn--ghost suggest-school-trigger">+ Suggest a Missing School</button>
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

  // 1. Remove Saved School
  const removeBtn = cardEl.querySelector('.dashboard-card__remove-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Smooth fade-out animation before removal
      cardEl.style.transform = 'scale(0.95)';
      cardEl.style.opacity = '0';
      
      setTimeout(() => {
        // Remove from saved schools array
        savedSchoolsList = savedSchoolsList.filter(id => id !== strId);
        localStorage.setItem('savedSchools', JSON.stringify(savedSchoolsList));
        
        // Remove from compare list if selected
        selectedCompareList = selectedCompareList.filter(id => id !== strId);
        
        // Clean up metadata
        delete localMetadataCache[strId];
        localStorage.setItem('savedSchoolsMetadata', JSON.stringify(localMetadataCache));

        // Sync delete to Supabase if connected
        const db = window.ScholrDB;
        if (db) {
          db.from('saved_schools').delete().eq('device_id', deviceId).eq('school_id', strId)
            .then(({ error }) => {
              if (error) console.warn('[Scholr Dashboard] Failed to delete remote metadata:', error.message);
            });
        }

        // Re-fetch and re-render dashboard
        dbSchools = dbSchools.filter(s => s.id !== schoolId);
        renderDashboard();
      }, 250);
    });
  }

  // 2. Compare Checkbox
  const compareCb = cardEl.querySelector('.dash-compare-cb');
  if (compareCb) {
    compareCb.addEventListener('change', (e) => {
      if (e.target.checked) {
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
    });
  }

  // 3. Decision Status Change
  const statusSelect = cardEl.querySelector('.workspace__status-select');
  if (statusSelect) {
    statusSelect.addEventListener('change', async (e) => {
      const oldStatus = getSchoolMetadata(schoolId).decision_status;
      const newStatus = e.target.value;

      // Update color modifier class on select wrapper
      statusSelect.className = `workspace__status-select status-select--${newStatus}`;

      // Update state and DB
      await syncMetadataToDB(schoolId, { decision_status: newStatus });

      if (window.ScholrAnalytics) {
        window.ScholrAnalytics.trackDecisionStatusChanged(schoolId, oldStatus, newStatus);
      }
    });
  }

  // 4. Personal Notes Autosave with Debounce
  const textarea = cardEl.querySelector('.workspace__notes-textarea');
  const autosaveStatus = cardEl.querySelector(`#autosave-status-${schoolId}`);
  if (textarea && autosaveStatus) {
    textarea.addEventListener('input', (e) => {
      const text = e.target.value;
      autosaveStatus.textContent = 'Saving...';
      autosaveStatus.classList.add('saving');

      // Clear existing timeout
      if (autosaveTimeouts[schoolId]) {
        clearTimeout(autosaveTimeouts[schoolId]);
      }

      // Set debounce timeout (400ms)
      autosaveTimeouts[schoolId] = setTimeout(async () => {
        await syncMetadataToDB(schoolId, { saved_school_notes: text });
        autosaveStatus.textContent = 'All changes saved';
        autosaveStatus.classList.remove('saving');
        
        if (window.ScholrAnalytics) {
          window.ScholrAnalytics.trackNotesUpdated(schoolId);
        }
      }, 400);
    });
  }

  // 5. Track deadline clicked
  const deadlineBanner = cardEl.querySelector(`.dashboard-card__deadline`);
  if (deadlineBanner) {
    deadlineBanner.addEventListener('click', () => {
      if (window.ScholrAnalytics) {
        window.ScholrAnalytics.trackDeadlineClicked(schoolId, 'application_deadline');
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
    window.ScholrAnalytics.trackDashboardOpened(savedSchoolsList.length);
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
