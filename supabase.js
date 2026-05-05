/* ─────────────────────────────────────────────────────────
   supabase.js  —  Scholr × Supabase integration
   ─────────────────────────────────────────────────────────
   IMPORTANT: Replace the two placeholder values below with
   your real project credentials from:
   Supabase Dashboard → Settings → API
───────────────────────────────────────────────────────── */

const SUPABASE_URL = "https://lztyxkarclzixfijrtgg.supabase.co";   // e.g. https://xyzxyz.supabase.co
const SUPABASE_ANON = 'sb_publishable_DKOQknUlDD8tH-NhGPXKCg_gqIO7Tlu';      // anon / public key only

/* ── Client init ─────────────────────────────────────── */
if (!window.supabase) {
  console.error('[Scholr] Fatal: Supabase CDN not loaded.');
}
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ── DOM refs (shared with app.js) ──────────────────── */
const cardsGrid = document.getElementById('cards-grid');
const emptyState = document.getElementById('empty-state');
const countBadge = document.getElementById('listings-count');

/* ── Saved Schools State ───────────────────────────────────── */
let savedSchools = JSON.parse(localStorage.getItem("savedSchools")) || [];

function isSaved(id) {
  return savedSchools.includes(String(id));
}

function toggleSave(id) {
  const strId = String(id);
  if (isSaved(strId)) {
    savedSchools = savedSchools.filter(s => s !== strId);
  } else {
    savedSchools.push(strId);
  }
  localStorage.setItem("savedSchools", JSON.stringify(savedSchools));
  return isSaved(strId);
}

/* ── Compare State ───────────────────────────────────── */
let selectedSchools = [];
const compareBar = document.getElementById('compare-bar');
const compareBtn = document.getElementById('compare-btn');

function updateCompareBar() {
  const bar = document.getElementById("compare-bar");
  const countText = document.getElementById("selected-count");

  console.log("Selected:", selectedSchools); // debug

  if (selectedSchools.length > 0) {
    bar.style.setProperty('display', 'flex', 'important');
    if (countText) countText.textContent = `${selectedSchools.length} selected`;
    if (compareBtn) compareBtn.disabled = selectedSchools.length < 2;
  } else {
    bar.style.setProperty('display', 'none', 'important');
  }

  const allCheckboxes = document.querySelectorAll('.compare-checkbox');
  allCheckboxes.forEach(cb => {
    if (!cb.checked && selectedSchools.length >= 3) {
      cb.disabled = true;
    } else {
      cb.disabled = false;
    }
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

/** Map board string → CSS modifier class */
function boardClass(board) {
  const map = { CBSE: 'cbse', ICSE: 'icse', State: 'state', IB: 'ib' };
  return map[board] ?? 'cbse';
}

/** Map tag string → CSS modifier class */
function tagClass(tag) {
  const t = tag.toLowerCase();
  if (t.includes('top rated')) return 'tag--top';
  if (t.includes('popular')) return 'tag--popular';
  if (t.includes('budget')) return 'tag--budget';
  if (t.includes('closest') ||
    t.includes('multi') ||
    t.includes('branch')) return 'tag--nearby';
  return 'tag--legacy';   // fallback: purple pill for anything else
}

/** Build a single card's HTML string from a Supabase row */
function buildCardHTML(school, index = 0) {
  const boardKey = boardClass(school.board);

  const tagsHTML = (school.tags ?? [])
    .map(tag => `<span class="card__tag ${tagClass(tag)}">${tag}</span>`)
    .join('');

  const hasRating = school.rating != null;

  // Sanitise text to avoid XSS in template literals
  const safe = str => String(str ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `
    <article class="school-card card-enter" style="animation-delay: ${index * 0.05}s;" tabindex="0" aria-label="${safe(school.name)}">
      <div class="card__top">
        <div class="card__avatar" style="background:var(--clr-blue-50)">🏫</div>
        <div style="display: flex; gap: 8px; align-items: center;">
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

      <div class="card__meta">
        <span class="meta-chip">${safe(school.fees ?? '—')}</span>
        <span class="meta-chip">${safe(school.board)} Board</span>
      </div>

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

/**
 * renderSchools(data)
 * Clears the grid, builds cards from Supabase rows, appends them,
 * and wires up CTA buttons.
 */
function renderSchools(data) {
  const loadingDiv = document.getElementById('loading-state');
  if (loadingDiv) loadingDiv.style.display = 'none';

  cardsGrid.innerHTML = ''; // clear container before re-render

  if (!data || data.length === 0) {
    cardsGrid.style.display = 'none';
    emptyState.hidden = false;
    countBadge.textContent = '0 schools found';
    return;
  }

  emptyState.hidden = true;
  cardsGrid.style.display = '';
  countBadge.textContent = `${data.length} school${data.length !== 1 ? 's' : ''} found`;

  const html = data.map((school, i) => buildCardHTML(school, i)).join('');
  cardsGrid.innerHTML = html;

  // Wire CTA buttons
  cardsGrid.querySelectorAll('.card__cta').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      window.location.href = `school.html?id=${id}`;
    });
  });

  // Wire Save buttons
  cardsGrid.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // prevent opening compare or school detail if overlapping
      e.stopPropagation(); 
      const id = btn.dataset.id;
      const isNowSaved = toggleSave(id);
      btn.innerHTML = isNowSaved ? '★ Saved' : '☆ Save';
      btn.setAttribute('aria-label', isNowSaved ? 'Saved' : 'Save');
    });
  });

function selectSchool(id) {
  if (!selectedSchools.includes(id)) {
    if (selectedSchools.length < 3) {
      selectedSchools.push(id);
    }
  }
  updateCompareBar();
}

function deselectSchool(id) {
  selectedSchools = selectedSchools.filter(s => s !== id);
  updateCompareBar();
}

  // Wire compare checkboxes
  cardsGrid.querySelectorAll('.compare-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
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

/**
 * fetchSchools()
 * Retrieves every row from the schools table, ordered by rating desc.
 */
async function fetchSchools() {
  showLoadingState();

  const { data, error } = await db
    .from('schools')
    .select('*')
    .order('rating', { ascending: false });

  console.log('[Scholr] fetchSchools data:', data);

  if (error) {
    console.error('[Scholr] Supabase fetch error:', error);
    showErrorState(error.message);
    return;
  }

  renderSchools(data);
}

/* ─────────────────────────────────────────────────────────
   FETCH — filtered by board
───────────────────────────────────────────────────────── */

/**
 * filterByBoard(board)
 * Pass an empty string / null to fetch all boards.
 */
async function filterByBoard(board) {
  showLoadingState();

  let query = db.from('schools').select('*').order('rating', { ascending: false });
  if (board) query = query.ilike('board', board);

  const { data, error } = await query;

  if (error) {
    console.error('[Scholr] Supabase filter error:', error.message);
    showErrorState(error.message);
    return;
  }

  renderSchools(data);
}

/* ─────────────────────────────────────────────────────────
   FETCH — filtered by board + fee tier
───────────────────────────────────────────────────────── */

/**
 * filterSchools({ board, fee })
 * Combines board and fee filters in a single Supabase call.
 * fee should match the stored 'fees' column value prefix or pass '' for any.
 * Because fees are stored as display strings (e.g. "₹30k–₹80k/yr"), we
 * filter client-side for fee tier after fetching board-filtered rows.
 */
async function filterSchools({ board = '', fee = '' } = {}) {
  showLoadingState();

  let query = db.from('schools').select('*').order('rating', { ascending: false });
  if (board) query = query.ilike('board', board);

  const { data, error } = await query;

  if (error) {
    console.error('[Scholr] Supabase filter error:', error.message);
    showErrorState(error.message);
    return;
  }

  // Client-side fee tier filter
  const feeTierMap = {
    low: s => feeTierOf(s.fees) === 'low',
    medium: s => feeTierOf(s.fees) === 'medium',
    high: s => feeTierOf(s.fees) === 'high',
  };
  const filtered = fee && feeTierMap[fee] ? data.filter(feeTierMap[fee]) : data;

  renderSchools(filtered);
}

/** Classify a fee string into low / medium / high */
function feeTierOf(feesStr) {
  if (!feesStr) return 'medium';
  // Extract the lower bound number (digits before first 'k' or 'L')
  const match = feesStr.match(/₹?([\d.]+)(k|L)/i);
  if (!match) return 'medium';
  const value = parseFloat(match[1]) * (match[2].toLowerCase() === 'l' ? 100 : 1); // in thousands
  if (value < 30) return 'low';
  if (value <= 80) return 'medium';
  return 'high';
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
    `Oops, something went wrong fetching the data. Please try again later.`;
  countBadge.textContent = 'Error';
}

/* ─────────────────────────────────────────────────────────
   FETCH — search schools
───────────────────────────────────────────────────────── */

/**
 * searchSchools(queryStr)
 * Performs a case-insensitive search across name and location.
 */
async function searchSchools(queryStr) {
  // Sanitize input: remove commas and percentages which break the Supabase .or() string parser
  const safeQuery = queryStr.replace(/[,%]/g, '').trim();

  if (!safeQuery) {
    renderSchools([]);
    return;
  }

  showLoadingState();

  const { data, error } = await db
    .from('schools')
    .select('*')
    .or(`name.ilike.%${safeQuery}%,location.ilike.%${safeQuery}%`)
    .order('rating', { ascending: false });

  if (error) {
    console.error('[Scholr] Supabase search error:', error.message);
    showErrorState(error.message);
    return;
  }

  renderSchools(data);
}

/* ─────────────────────────────────────────────────────────
   FETCH — saved schools
───────────────────────────────────────────────────────── */

/**
 * loadSavedSchools()
 * Fetches only the schools matching saved IDs.
 */
async function loadSavedSchools() {
  if (savedSchools.length === 0) {
    renderSchools([]);
    return;
  }

  showLoadingState();

  const { data, error } = await db
    .from('schools')
    .select('*')
    .in('id', savedSchools)
    .order('rating', { ascending: false });

  if (error) {
    console.error('[Scholr] Supabase fetch error:', error);
    showErrorState(error.message);
    return;
  }

  renderSchools(data);
}

/* ─────────────────────────────────────────────────────────
   EXPORTS (global, for use by app.js)
───────────────────────────────────────────────────────── */
window.Scholr = { fetchSchools, renderSchools, filterByBoard, filterSchools, searchSchools, loadSavedSchools, toggleSave, isSaved };
