/* ─────────────────────────────────────────────────────────
   supabase.js  —  Scholr × Supabase integration
   ─────────────────────────────────────────────────────────
   Includes School Intelligence Layer:
     • best_for tags
     • fee_category badge
     • smart_summary excerpt on cards
───────────────────────────────────────────────────────── */

const SUPABASE_URL  = "https://lztyxkarclzixfijrtgg.supabase.co";
const SUPABASE_ANON = 'sb_publishable_DKOQknUlDD8tH-NhGPXKCg_gqIO7Tlu';

/* ── Client init ─────────────────────────────────────── */
if (!window.supabase) {
  console.error('[Scholr] Fatal: Supabase CDN not loaded.');
}
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ── Expose db globally for trust.js suggestion submits ── */
window.ScholrDB = db;

/* ── DOM refs ────────────────────────────────────────── */
const cardsGrid  = document.getElementById('cards-grid');
const emptyState = document.getElementById('empty-state');
const countBadge = document.getElementById('listings-count');

/* ── Saved Schools State ─────────────────────────────── */
let savedSchools = JSON.parse(localStorage.getItem('savedSchools')) || [];

function isSaved(id) { return savedSchools.includes(String(id)); }

function toggleSave(id) {
  const strId = String(id);
  if (isSaved(strId)) {
    savedSchools = savedSchools.filter(s => s !== strId);
  } else {
    savedSchools.push(strId);
    if (window.ScholrAnalytics) window.ScholrAnalytics.trackSavedSchool(strId);
  }
  localStorage.setItem('savedSchools', JSON.stringify(savedSchools));
  return isSaved(strId);
}

/* ── Compare State ───────────────────────────────────── */
let selectedSchools = [];
const compareBar = document.getElementById('compare-bar');
const compareBtn = document.getElementById('compare-btn');

function updateCompareBar() {
  const bar       = document.getElementById('compare-bar');
  const countText = document.getElementById('selected-count');

  if (selectedSchools.length > 0) {
    bar.style.setProperty('display', 'flex', 'important');
    if (countText) countText.textContent = `${selectedSchools.length} selected`;
    if (compareBtn) compareBtn.disabled = selectedSchools.length < 2;
  } else {
    bar.style.setProperty('display', 'none', 'important');
  }

  document.querySelectorAll('.compare-checkbox').forEach(cb => {
    cb.disabled = !cb.checked && selectedSchools.length >= 3;
  });
}

if (compareBtn) {
  compareBtn.addEventListener('click', () => {
    if (selectedSchools.length >= 2) {
      window.location.href = `compare.html?ids=${selectedSchools.join(',')}`;
    }
  });
}

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */

const safe = str => String(str ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function boardClass(board) {
  const map = { CBSE: 'cbse', ICSE: 'icse', State: 'state', IB: 'ib' };
  return map[board] ?? 'cbse';
}

function tagClass(tag) {
  const t = tag.toLowerCase();
  if (t.includes('top rated')) return 'tag--top';
  if (t.includes('popular'))   return 'tag--popular';
  if (t.includes('budget'))    return 'tag--budget';
  if (t.includes('closest') || t.includes('multi') || t.includes('branch')) return 'tag--nearby';
  return 'tag--legacy';
}

/**
 * Derive a fee category from the fees string if not stored in DB.
 * Handles both formats:
 *   Shorthand:  ₹40k–₹70k/yr  or  ₹1.5L–₹2.5L/yr
 *   Full nums:  ₹1,00,000 - ₹1,50,000
 * Returns: 'Budget Friendly' | 'Mid Range' | 'Premium'
 */
function inferFeeCategory(feesStr) {
  if (!feesStr) return null;

  // Format 1: shorthand  (₹40k, ₹1.5L)
  const short = feesStr.match(/₹?([\d.]+)(k|L)/i);
  if (short) {
    const v = parseFloat(short[1]) * (short[2].toLowerCase() === 'l' ? 100 : 1); // in thousands
    if (v < 40)  return 'Budget Friendly';
    if (v <= 120) return 'Mid Range';
    return 'Premium';
  }

  // Format 2: full Indian number  (₹1,00,000)
  const full = feesStr.match(/₹?(\d[\d,]+)/);
  if (full) {
    const v = parseInt(full[1].replace(/,/g, ''), 10); // in rupees
    if (v < 40000)   return 'Budget Friendly';
    if (v <= 120000) return 'Mid Range';
    return 'Premium';
  }

  return null;
}

/** Classify a fee string into low / medium / high (for filter logic) */
function feeTierOf(feesStr) {
  if (!feesStr) return 'medium';

  const short = feesStr.match(/₹?([\d.]+)(k|L)/i);
  if (short) {
    const v = parseFloat(short[1]) * (short[2].toLowerCase() === 'l' ? 100 : 1);
    if (v < 30)  return 'low';
    if (v <= 80) return 'medium';
    return 'high';
  }

  const full = feesStr.match(/₹?(\d[\d,]+)/);
  if (full) {
    const v = parseInt(full[1].replace(/,/g, ''), 10);
    if (v < 30000)  return 'low';
    if (v <= 80000) return 'medium';
    return 'high';
  }

  return 'medium';
}

/** CSS modifier for fee category */
function feeCategoryClass(cat) {
  if (!cat) return '';
  const c = cat.toLowerCase();
  if (c.includes('budget')) return 'fee--budget';
  if (c.includes('mid'))    return 'fee--mid';
  if (c.includes('premium')) return 'fee--premium';
  return '';
}

/** CSS modifier + label for Best For tags */
function bestForClass(tag) {
  const t = tag.toLowerCase();
  if (t.includes('academic'))   return 'bf--academic';
  if (t.includes('budget'))     return 'bf--budget';
  if (t.includes('sport'))      return 'bf--sport';
  if (t.includes('campus'))     return 'bf--campus';
  if (t.includes('discipline')) return 'bf--discipline';
  if (t.includes('infra') || t.includes('modern')) return 'bf--infra';
  if (t.includes('transport'))  return 'bf--transport';
  return 'bf--default';
}

/** Build "Best For" pills HTML */
function buildBestForHTML(bestFor) {
  if (!bestFor || bestFor.length === 0) return '';
  return bestFor
    .map(t => `<span class="best-for-tag ${bestForClass(t)}">${safe(t)}</span>`)
    .join('');
}

/* ─────────────────────────────────────────────────────────
   BUILD CARD
───────────────────────────────────────────────────────── */

function buildCardHTML(school, index = 0) {
  const boardKey = boardClass(school.board);

  const tagsHTML = (school.tags ?? [])
    .map(tag => `<span class="card__tag ${tagClass(tag)}">${tag}</span>`)
    .join('');

  const hasRating = school.rating != null;

  /* Fee category — prefer DB value, fall back to inference */
  const feeCategory = school.fee_category || inferFeeCategory(school.fees);
  const feeCatHTML  = feeCategory
    ? `<span class="fee-category-badge ${feeCategoryClass(feeCategory)}">${safe(feeCategory)}</span>`
    : '';

  /* Best For tags */
  const bestForHTML = buildBestForHTML(school.best_for);

  /* Smart Summary — show a short excerpt (first 100 chars) */
  const summaryExcerpt = school.smart_summary
    ? `<p class="card__summary">${safe(school.smart_summary.slice(0, 105))}${school.smart_summary.length > 105 ? '…' : ''}</p>`
    : '';

  /* Trust Signals — Verification Badge & Freshness Chip */
  const verificationHTML = window.ScholrTrust ? window.ScholrTrust.getVerificationBadge(school.verification_level, { compact: true }) : '';
  const freshnessHTML    = window.ScholrTrust ? window.ScholrTrust.renderFreshnessChip(school.updated_at, school.last_verified_at) : '';
  const transparencyNoticeHTML = window.ScholrTrust ? window.ScholrTrust.renderTransparencyMessage(school.verification_level, school.data_notes, { compact: true }) : '';
  
  const trustRowHTML = (verificationHTML || freshnessHTML || transparencyNoticeHTML) 
    ? `<div class="card__trust-row">${verificationHTML}${freshnessHTML}${transparencyNoticeHTML}</div>` 
    : '';

  return `
    <article class="school-card card-enter" style="animation-delay: ${index * 0.05}s;" tabindex="0" aria-label="${safe(school.name)}">
      <div class="card__top">
        <div class="card__avatar" style="background:var(--clr-blue-50)">🏫</div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button class="btn btn--ghost save-btn" data-id="${school.id}" style="padding: 6px 10px; font-size: 0.75rem;" aria-label="${isSaved(school.id) ? 'Saved' : 'Save'}">
            ${isSaved(school.id) ? '★ Saved' : '☆ Save'}
          </button>
          <span class="card__board board--${boardKey}">${safe(school.board)}</span>
          <label class="compare-label" aria-label="Compare ${safe(school.name)}" title="Compare this school">
            <input type="checkbox" class="compare-checkbox" data-id="${school.id}" ${selectedSchools.includes(String(school.id)) ? 'checked' : ''}>
            <span>Compare</span>
          </label>
        </div>
      </div>

      ${tagsHTML ? `<div class="card__tags">${tagsHTML}</div>` : ''}

      <h3 class="card__name">${safe(school.name)}</h3>
      ${trustRowHTML}

      <p class="card__location">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13"
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        ${safe(school.location)}, ${safe(school.city)}
        ${school.distance ? ` · ${safe(school.distance)}` : ''}
      </p>

      ${hasRating ? `
        <div class="card__rating">
          <span class="rating__stars">⭐ ${school.rating.toFixed(1)}</span>
          <span class="rating__count">User rating</span>
        </div>` : ''}

      ${summaryExcerpt}

      <div class="card__meta">
        <span class="meta-chip">${safe(school.fees ?? '—')}</span>
        ${feeCatHTML}
      </div>

      ${bestForHTML ? `<div class="card__best-for">${bestForHTML}</div>` : ''}

      <button class="btn btn--outline card__cta"
              data-id="${school.id}"
              data-school="${safe(school.name)}">
        Explore School
      </button>
    </article>`;
}

/* ─────────────────────────────────────────────────────────
   RENDER
───────────────────────────────────────────────────────── */

function renderSchools(data) {
  const loadingDiv = document.getElementById('loading-state');
  if (loadingDiv) loadingDiv.style.display = 'none';

  cardsGrid.innerHTML = '';

  if (!data || data.length === 0) {
    cardsGrid.style.display = 'none';
    emptyState.hidden = false;
    countBadge.textContent = '0 schools found';

    // Contextual empty state — don't clobber "Saved Schools" or loading text
    const titleEl = emptyState.querySelector('.empty-state__title');
    const subEl   = emptyState.querySelector('.empty-state__sub');
    const iconEl  = emptyState.querySelector('.empty-state__icon');

    const isSavedPage = titleEl && titleEl.textContent.toLowerCase().includes('saved');

    if (!isSavedPage && titleEl) {
      iconEl.textContent   = '🔍';
      titleEl.textContent  = 'No schools matched your criteria';
      subEl.innerHTML =
        'Try adjusting your board or fee filter — or help us grow!' +
        '<br><button class="btn btn--ghost suggest-school-trigger" ' +
        'style="margin-top:14px;font-size:0.85rem;padding:8px 16px;" ' +
        'id="empty-state-suggest-btn">+ Suggest a missing school</button>';
    }
    return;
  }

  emptyState.hidden = true;
  cardsGrid.style.display = '';
  countBadge.textContent = `${data.length} school${data.length !== 1 ? 's' : ''} found`;

  cardsGrid.innerHTML = data.map((school, i) => buildCardHTML(school, i)).join('');

  /* Wire CTA buttons */
  cardsGrid.querySelectorAll('.card__cta').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.ScholrAnalytics) window.ScholrAnalytics.trackEvent('school_card_clicked', { school_id: btn.dataset.id });
      window.location.href = `school.html?id=${btn.dataset.id}`;
    });
  });

  /* Wire Save buttons */
  cardsGrid.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const isNowSaved = toggleSave(id);
      btn.innerHTML = isNowSaved ? '★ Saved' : '☆ Save';
      btn.setAttribute('aria-label', isNowSaved ? 'Saved' : 'Save');
    });
  });

  function selectSchool(id) {
    if (!selectedSchools.includes(id) && selectedSchools.length < 3) {
      selectedSchools.push(id);
    }
    updateCompareBar();
  }

  function deselectSchool(id) {
    selectedSchools = selectedSchools.filter(s => s !== id);
    updateCompareBar();
  }

  /* Wire compare checkboxes */
  cardsGrid.querySelectorAll('.compare-checkbox').forEach(cb => {
    cb.addEventListener('change', e => {
      const id = String(e.target.dataset.id);
      if (e.target.checked) {
        if (selectedSchools.length < 3) {
          selectSchool(id);
        } else {
          e.target.checked = false;
        }
      } else {
        deselectSchool(id);
      }
    });
  });

  updateCompareBar();
}

/* ─────────────────────────────────────────────────────────
   FETCH — all schools
───────────────────────────────────────────────────────── */

async function fetchSchools() {
  showLoadingState();

  const { data, error } = await db
    .from('schools')
    .select('*')
    .order('rating', { ascending: false });

  if (error) {
    console.error('[Scholr] Supabase fetch error:', error);
    showErrorState(error.message);
    return;
  }

  renderSchools(data);
}

/* ─────────────────────────────────────────────────────────
   FETCH — filtered by board + fee tier
───────────────────────────────────────────────────────── */

async function filterByBoard(board) {
  showLoadingState();
  let query = db.from('schools').select('*').order('rating', { ascending: false });
  if (board) query = query.ilike('board', board);
  const { data, error } = await query;
  if (error) { showErrorState(error.message); return; }
  renderSchools(data);
}

async function filterSchools({ board = '', fee = '' } = {}) {
  showLoadingState();

  let query = db.from('schools').select('*').order('rating', { ascending: false });
  if (board) query = query.ilike('board', board);

  const { data, error } = await query;
  if (error) { showErrorState(error.message); return; }

  const feeTierMap = {
    low:    s => feeTierOf(s.fees) === 'low',
    medium: s => feeTierOf(s.fees) === 'medium',
    high:   s => feeTierOf(s.fees) === 'high',
  };
  const filtered = fee && feeTierMap[fee] ? data.filter(feeTierMap[fee]) : data;
  renderSchools(filtered);
}

/* ─────────────────────────────────────────────────────────
   UI STATES
───────────────────────────────────────────────────────── */

function showLoadingState() {
  cardsGrid.style.display = 'none';
  emptyState.hidden = true;
  countBadge.textContent = 'Loading...';
  const loadingDiv = document.getElementById('loading-state');
  if (loadingDiv) loadingDiv.style.display = 'block';
}

function showErrorState(msg) {
  const loadingDiv = document.getElementById('loading-state');
  if (loadingDiv) loadingDiv.style.display = 'none';
  cardsGrid.style.display = 'none';
  emptyState.hidden = false;
  emptyState.querySelector('.empty-state__title').textContent = 'Could not load schools';
  emptyState.querySelector('.empty-state__sub').textContent =
    'Oops, something went wrong fetching the data. Please try again later.';
  countBadge.textContent = 'Error';
}

/* ─────────────────────────────────────────────────────────
   FETCH — search
───────────────────────────────────────────────────────── */

async function searchSchools(queryStr) {
  const safeQuery = queryStr.replace(/[,%]/g, '').trim();
  if (!safeQuery) { renderSchools([]); return; }

  showLoadingState();

  const { data, error } = await db
    .from('schools')
    .select('*')
    .or(`name.ilike.%${safeQuery}%,location.ilike.%${safeQuery}%`)
    .order('rating', { ascending: false });

  if (error) { showErrorState(error.message); return; }
  renderSchools(data);
}

/* ─────────────────────────────────────────────────────────
   FETCH — saved schools
───────────────────────────────────────────────────────── */

async function loadSavedSchools() {
  if (savedSchools.length === 0) { renderSchools([]); return; }
  showLoadingState();

  const { data, error } = await db
    .from('schools')
    .select('*')
    .in('id', savedSchools)
    .order('rating', { ascending: false });

  if (error) { showErrorState(error.message); return; }
  renderSchools(data);
}

/* ─────────────────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────────────────── */
window.Scholr = {
  fetchSchools,
  renderSchools,
  filterByBoard,
  filterSchools,
  searchSchools,
  loadSavedSchools,
  toggleSave,
  isSaved,
  /* expose helpers for compare.js re-use */
  inferFeeCategory,
  feeCategoryClass,
  buildBestForHTML,
  bestForClass,
  safe,
};
