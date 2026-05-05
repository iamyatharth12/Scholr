/* ─────────────────────────────────────────────────────────
   compare.js  —  Scholr Compare Page logic
───────────────────────────────────────────────────────── */

const SUPABASE_URL = "https://lztyxkarclzixfijrtgg.supabase.co";
const SUPABASE_ANON = 'sb_publishable_DKOQknUlDD8tH-NhGPXKCg_gqIO7Tlu';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const idsParam = urlParams.get('ids');

  if (!idsParam) {
    showError("No schools selected for comparison.");
    return;
  }

  const ids = idsParam.split(',').filter(id => id.trim() !== '');

  if (ids.length < 2) {
    showError("Please select at least 2 schools to compare.");
    return;
  }

  loadComparison(ids);
});

function showError(msg) {
  document.getElementById("compare-error-state").style.display = "block";
  document.getElementById("compare-container").style.display = "none";
  if (msg) {
    const errorMsgEl = document.getElementById("compare-error-msg");
    if (errorMsgEl) errorMsgEl.textContent = msg;
  }
}

function showComparison() {
  document.getElementById("compare-error-state").style.display = "none";
  document.getElementById("compare-container").style.display = "grid";
}

async function loadComparison(ids) {
  try {
    const { data, error } = await db
      .from('schools')
      .select('*')
      .in('id', ids);

    if (error || !data || data.length === 0) {
      console.error('[Scholr] Supabase fetch error:', error);
      showError(error ? error.message : "No schools found.");
      return;
    }

    showComparison();
    renderCompare(data);
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

function renderCompare(schools) {
  const container = document.getElementById("compare-container");
  const safe = str => String(str ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  const columnsHtml = schools.map(school => {
    const boardKey = boardClass(school.board);
    const tagsHTML = (school.tags ?? [])
      .map(tag => `<span class="card__tag ${tagClass(tag)}">${tag}</span>`)
      .join('');
    const hasRating = school.rating != null;

    return `
      <div class="compare-col fade-in">
        <div class="compare__avatar">🏫</div>
        <h2 class="compare__name">${safe(school.name)}</h2>
        <p class="compare__location">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          ${safe(school.location)}, ${safe(school.city)}
        </p>
        <div class="compare__badges">
          <span class="card__board board--${boardKey}">${safe(school.board)}</span>
        </div>
        
        <div class="compare__features">
          <div class="compare__feature">
            <span class="feature-label">Board</span>
            <span class="feature-value">${safe(school.board)}</span>
          </div>
          <div class="compare__feature">
            <span class="feature-label">Annual Fees</span>
            <span class="feature-value">${safe(school.fees ?? '—')}</span>
          </div>
          <div class="compare__feature">
            <span class="feature-label">Rating</span>
            <span class="feature-value rating-value">${hasRating ? '⭐ ' + school.rating.toFixed(1) : '—'}</span>
          </div>
          <div class="compare__feature">
            <span class="feature-label">Tags</span>
            <div class="compare__tags">${tagsHTML || '—'}</div>
          </div>
        </div>

        <a href="school.html?id=${school.id}" class="btn btn--outline" style="width: 100%; justify-content: center; margin-top: auto;">Explore School</a>
      </div>
    `;
  }).join('');

  container.innerHTML = columnsHtml;
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
