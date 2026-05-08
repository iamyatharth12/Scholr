/* ─────────────────────────────────────────────────────────
   compare.js  —  Scholr Compare Page (Enhanced)
   School Intelligence Layer: best_for, fee_category,
   smart_summary, academic style, facilities summary
───────────────────────────────────────────────────────── */

const SUPABASE_URL  = "https://lztyxkarclzixfijrtgg.supabase.co";
const SUPABASE_ANON = 'sb_publishable_DKOQknUlDD8tH-NhGPXKCg_gqIO7Tlu';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const idsParam  = urlParams.get('ids');

  if (!idsParam) { showError('No schools selected for comparison.'); return; }

  const ids = idsParam.split(',').filter(id => id.trim() !== '');
  if (ids.length < 2) { showError('Please select at least 2 schools to compare.'); return; }

  loadComparison(ids);
});

function showError(msg) {
  document.getElementById('compare-error-state').style.display = 'block';
  document.getElementById('compare-container').style.display   = 'none';
  const el = document.getElementById('compare-error-msg');
  if (el && msg) el.textContent = msg;
}

function showComparison() {
  document.getElementById('compare-error-state').style.display = 'none';
  document.getElementById('compare-container').style.display   = 'grid';
}

async function loadComparison(ids) {
  try {
    const { data, error } = await db.from('schools').select('*').in('id', ids);
    if (error || !data || data.length === 0) {
      showError(error ? error.message : 'No schools found.');
      return;
    }
    showComparison();
    renderCompare(data);
  } catch (err) {
    showError(err.message);
  }
}

/* ─── Helpers ─────────────────────────────────────────── */
const safe = str => String(str ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function boardClass(board) {
  return ({ CBSE: 'cbse', ICSE: 'icse', State: 'state', IB: 'ib' })[board] ?? 'cbse';
}

function tagClass(tag) {
  const t = tag.toLowerCase();
  if (t.includes('top rated')) return 'tag--top';
  if (t.includes('popular'))   return 'tag--popular';
  if (t.includes('budget'))    return 'tag--budget';
  if (t.includes('closest') || t.includes('multi') || t.includes('branch')) return 'tag--nearby';
  return 'tag--legacy';
}

function inferFeeCategory(feesStr) {
  if (!feesStr) return null;

  const short = feesStr.match(/₹?([\d.]+)(k|L)/i);
  if (short) {
    const v = parseFloat(short[1]) * (short[2].toLowerCase() === 'l' ? 100 : 1);
    if (v < 40)   return 'Budget Friendly';
    if (v <= 120) return 'Mid Range';
    return 'Premium';
  }

  const full = feesStr.match(/₹?(\d[\d,]+)/);
  if (full) {
    const v = parseInt(full[1].replace(/,/g, ''), 10);
    if (v < 40000)   return 'Budget Friendly';
    if (v <= 120000) return 'Mid Range';
    return 'Premium';
  }

  return null;
}

function feeCategoryClass(cat) {
  if (!cat) return '';
  const c = cat.toLowerCase();
  if (c.includes('budget'))  return 'fee--budget';
  if (c.includes('mid'))     return 'fee--mid';
  if (c.includes('premium')) return 'fee--premium';
  return '';
}

function bestForClass(tag) {
  const t = tag.toLowerCase();
  if (t.includes('academic'))  return 'bf--academic';
  if (t.includes('budget'))    return 'bf--budget';
  if (t.includes('sport'))     return 'bf--sport';
  if (t.includes('campus'))    return 'bf--campus';
  if (t.includes('discipline'))return 'bf--discipline';
  if (t.includes('infra') || t.includes('modern')) return 'bf--infra';
  if (t.includes('transport')) return 'bf--transport';
  return 'bf--default';
}

/** Guess "academic style" from board + tags */
function academicStyle(school) {
  if (school.academic_style) return school.academic_style;
  const tags = (school.tags ?? []).map(t => t.toLowerCase());
  if (school.board === 'IB')    return 'Inquiry-Based';
  if (school.board === 'ICSE')  return 'Analytical / Literature';
  if (tags.some(t => t.includes('discipline'))) return 'Structured / Strict';
  if (tags.some(t => t.includes('sport') || t.includes('art'))) return 'Activity-Based';
  return 'Standard Curriculum';
}

/** Summarise facilities as a short phrase */
function facilitiesSummary(school) {
  const f = school.facilities;
  if (!f || f.length === 0) return '—';
  if (f.length <= 3) return f.map(safe).join(', ');
  return `${f.slice(0, 3).map(safe).join(', ')} +${f.length - 3} more`;
}

/* ─── Render ──────────────────────────────────────────── */
function renderCompare(schools) {
  const container  = document.getElementById('compare-container');

  const columnsHtml = schools.map(school => {
    const boardKey    = boardClass(school.board);
    const tagsHTML    = (school.tags ?? [])
      .map(tag => `<span class="card__tag ${tagClass(tag)}">${tag}</span>`)
      .join('');
    const hasRating   = school.rating != null;
    const feeCategory = school.fee_category || inferFeeCategory(school.fees);
    const feeCatHTML  = feeCategory
      ? `<span class="fee-category-badge ${feeCategoryClass(feeCategory)}">${safe(feeCategory)}</span>`
      : '';
    const bestForHTML = (school.best_for ?? [])
      .map(t => `<span class="best-for-tag ${bestForClass(t)}">${safe(t)}</span>`)
      .join('');

    const smartSummary = school.smart_summary
      ? `<p class="compare__summary">${safe(school.smart_summary)}</p>`
      : '';
      
    const verificationHTML = window.ScholrTrust ? window.ScholrTrust.getVerificationBadge(school.verification_level) : '';
    const freshnessHTML    = window.ScholrTrust ? window.ScholrTrust.renderFreshnessChip(school.updated_at, school.last_verified_at) : '';
    const trustRowHTML     = (verificationHTML || freshnessHTML)
      ? `<div class="compare__trust-row">${verificationHTML}${freshnessHTML}</div>`
      : '';

    return `
      <div class="compare-col fade-in">
        <div class="compare__avatar">🏫</div>
        <h2 class="compare__name">${safe(school.name)}</h2>
        <p class="compare__location">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          ${safe(school.location)}, ${safe(school.city)}
        </p>
        
        ${trustRowHTML}
        
        <div class="compare__badges">
          <span class="card__board board--${boardKey}">${safe(school.board)}</span>
          ${feeCatHTML}
        </div>

        ${smartSummary}

        ${bestForHTML ? `<div class="compare__best-for">${bestForHTML}</div>` : ''}

        <div class="compare__features">
          <div class="compare__feature">
            <span class="feature-label">Annual Fees</span>
            <span class="feature-value">${safe(school.fees ?? '—')}</span>
          </div>
          <div class="compare__feature">
            <span class="feature-label">Fee Category</span>
            <span class="feature-value">${safe(feeCategory ?? '—')}</span>
          </div>
          <div class="compare__feature">
            <span class="feature-label">Rating</span>
            <span class="feature-value rating-value">${hasRating ? '⭐ ' + school.rating.toFixed(1) : '—'}</span>
          </div>
          <div class="compare__feature">
            <span class="feature-label">Academic Style</span>
            <span class="feature-value">${safe(academicStyle(school))}</span>
          </div>
          <div class="compare__feature">
            <span class="feature-label">Key Facilities</span>
            <span class="feature-value" style="font-size:0.9rem;">${facilitiesSummary(school)}</span>
          </div>
          <div class="compare__feature">
            <span class="feature-label">Tags</span>
            <div class="compare__tags">${tagsHTML || '<span style="color:var(--clr-text-muted)">—</span>'}</div>
          </div>
        </div>

        <a href="school.html?id=${school.id}" class="btn btn--outline" style="width:100%;justify-content:center;margin-top:auto;">
          View Full Profile
        </a>
      </div>
    `;
  }).join('');

  container.innerHTML = columnsHtml;
}
