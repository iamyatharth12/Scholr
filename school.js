/* ─────────────────────────────────────────────────────────
   school.js  —  Scholr Detail Page logic
───────────────────────────────────────────────────────── */

const SUPABASE_URL = "https://lztyxkarclzixfijrtgg.supabase.co";
const SUPABASE_ANON = 'sb_publishable_DKOQknUlDD8tH-NhGPXKCg_gqIO7Tlu';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  if (!id) {
    showError("No school ID provided in the URL.");
    return;
  }

  loadSchool(id);
});

function showError(msg) {
  document.getElementById("error-state").style.display = "block";
  document.getElementById("school-container").style.display = "none";
  if (msg) {
    const errorMsgEl = document.getElementById("school-error-msg");
    if (errorMsgEl) errorMsgEl.textContent = msg;
  }
}

function showSchool() {
  document.getElementById("error-state").style.display = "none";
  document.getElementById("school-container").style.display = "block";
}

async function loadSchool(id) {
  try {
    const { data, error } = await db
      .from('schools')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('[Scholr] Supabase fetch error:', error);
      showError(error ? error.message : "School not found.");
      return;
    }

    showSchool();
    renderSchool(data);
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

function renderSchool(school) {
  // Update title
  document.title = `${school.name} — Scholr`;
  const container = document.getElementById("school-container");

  const safe = str => String(str ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const boardKey = boardClass(school.board);
  
  const tagsHTML = (school.tags ?? [])
    .map(tag => `<span class="card__tag ${tagClass(tag)}">${tag}</span>`)
    .join('');

  const hasRating = school.rating != null;
  const description = school.description || "A well-known educational institution offering a comprehensive curriculum and excellent facilities for student development and holistic growth.";
  
  const facilities = school.facilities && school.facilities.length > 0 
    ? school.facilities 
    : ["Smart Classrooms", "Library", "Sports Ground", "Computer Lab", "Transport"];
    
  const facilitiesHTML = facilities.map(f => `<li class="facility-item"><span class="facility-icon">✓</span> ${safe(f)}</li>`).join('');

  const dataSource = school.data_source || "Estimated";
  const isVerified = dataSource.toLowerCase() === 'verified';
  
  const lastUpdated = school.last_updated 
    ? new Date(school.last_updated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : "Recently updated";

  container.innerHTML = `
    <div class="school-detail-card">
      <div class="detail__top">
        <div class="detail__avatar">🏫</div>
        <div class="detail__title-wrap">
          <h1 class="detail__name">${safe(school.name)}</h1>
          <p class="detail__location">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            ${safe(school.location)}, ${safe(school.city)}
          </p>
        </div>
      </div>

      <div class="detail__badges">
        <span class="card__board board--${boardKey}">${safe(school.board)}</span>
        ${tagsHTML}
      </div>

      <div class="detail__stats">
        <div class="detail__stat">
          <span class="stat-label">Board</span>
          <span class="stat-value">${safe(school.board)}</span>
        </div>
        <div class="detail__stat">
          <span class="stat-label">Annual Fees</span>
          <span class="stat-value">${safe(school.fees ?? '—')}</span>
        </div>
        ${hasRating ? `
        <div class="detail__stat">
          <span class="stat-label">Rating</span>
          <span class="stat-value rating-value">⭐ ${school.rating.toFixed(1)}</span>
        </div>` : ''}
      </div>

      <div class="detail__section detail__about">
        <h2>About the School</h2>
        <p>${safe(description)}</p>
      </div>

      <hr class="detail__divider">

      <div class="detail__section detail__facilities">
        <h2>Facilities</h2>
        <ul class="facilities-list">
          ${facilitiesHTML}
        </ul>
      </div>

      <hr class="detail__divider">

      <div class="detail__section detail__info">
        <h2>Data Information</h2>
        <div class="info-badges">
          <span class="info-badge ${isVerified ? 'info-badge--verified' : 'info-badge--estimated'}">
            ${isVerified ? '✓ Verified Data' : 'ℹ Estimated Data'}
          </span>
          <span class="info-text">Last updated: ${lastUpdated}</span>
        </div>
      </div>
    </div>
  `;
}

function boardClass(board) {
  const map = { CBSE: 'cbse', ICSE: 'icse', State: 'state', IB: 'ib' };
  return map[board] ?? 'cbse';
}

function tagClass(tag) {
  const t = tag.toLowerCase();
  if (t.includes('top rated')) return 'tag--top';
  if (t.includes('popular')) return 'tag--popular';
  if (t.includes('budget')) return 'tag--budget';
  if (t.includes('closest') || t.includes('multi') || t.includes('branch')) return 'tag--nearby';
  return 'tag--legacy';
}
