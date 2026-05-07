/* ─────────────────────────────────────────────────────────
   school.js  —  Scholr Detail Page logic (Enhanced)
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

  // Hamburger nav
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('open');
      navLinks.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
    });
  }

  // Navbar scroll shadow
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });
  }
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

/* ─── Helpers ─────────────────────────────────────────── */
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

function inferFeeCategory(feesStr) {
  if (!feesStr) return null;

  // Format 1: shorthand  (₹40k, ₹1.5L)
  const short = feesStr.match(/₹?([\d.]+)(k|L)/i);
  if (short) {
    const v = parseFloat(short[1]) * (short[2].toLowerCase() === 'l' ? 100 : 1);
    if (v < 40)   return 'Budget Friendly';
    if (v <= 120) return 'Mid Range';
    return 'Premium';
  }

  // Format 2: full Indian number  (₹1,00,000 - ₹1,50,000)
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
  if (t.includes('academic'))   return 'bf--academic';
  if (t.includes('budget'))     return 'bf--budget';
  if (t.includes('sport'))      return 'bf--sport';
  if (t.includes('campus'))     return 'bf--campus';
  if (t.includes('discipline')) return 'bf--discipline';
  if (t.includes('infra') || t.includes('modern')) return 'bf--infra';
  if (t.includes('transport'))  return 'bf--transport';
  return 'bf--default';
}

/* Map each facility name to an SVG icon */
const FACILITY_ICONS = {
  'smart class':   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  'library':       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  'lab':           `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4"/><path d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3H9V3z"/><path d="M9 14l2 2 4-4"/></svg>`,
  'sport':         `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
  'hostel':        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  'transport':     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  'cafeteria':     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,
  'auditorium':    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
  'infirmary':     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  'computer':      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  'default':       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
};

function facilityIcon(name) {
  const lower = name.toLowerCase();
  for (const [key, svg] of Object.entries(FACILITY_ICONS)) {
    if (key !== 'default' && lower.includes(key)) return svg;
  }
  return FACILITY_ICONS['default'];
}

/* ─── Main renderer ───────────────────────────────────── */
function renderSchool(school) {
  document.title = `${school.name} — Scholr`;
  const container = document.getElementById("school-container");

  const boardKey   = boardClass(school.board);
  const tagsHTML   = (school.tags ?? [])
    .map(tag => `<span class="card__tag ${tagClass(tag)}">${tag}</span>`)
    .join('');

  const hasRating  = school.rating != null;
  const description = school.description || "A well-known educational institution offering a comprehensive curriculum and excellent facilities for student development and holistic growth.";

  /* --- Facilities --- */
  const facilities = (school.facilities && school.facilities.length > 0)
    ? school.facilities
    : ["Smart Classrooms", "Library", "Sports Ground", "Computer Lab", "Transport"];

  const facilitiesHTML = facilities.map(f => `
    <li class="facility-badge">
      <span class="facility-badge__icon">${facilityIcon(f)}</span>
      <span class="facility-badge__name">${safe(f)}</span>
    </li>`).join('');

  /* --- Contact actions --- */
  const websiteBtn = school.website
    ? `<a href="${encodeURI(school.website)}" target="_blank" rel="noopener noreferrer" class="action-btn action-btn--primary" id="btn-website">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        Official Website
       </a>`
    : '';

  const phoneBtn = school.phone
    ? `<a href="tel:${safe(school.phone)}" class="action-btn action-btn--outline" id="btn-call">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.46 2 2 0 0 1 3.59 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16.92z"/></svg>
        Call School
       </a>`
    : '';

  const mapsBtn = school.maps_link || (school.location && school.city)
    ? (() => {
        const href = school.maps_link
          ? encodeURI(school.maps_link)
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${school.name} ${school.location} ${school.city}`)}`;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="action-btn action-btn--outline" id="btn-maps">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Open in Maps
         </a>`;
      })()
    : '';

  const emailBtn = school.email
    ? `<a href="mailto:${safe(school.email)}" class="action-btn action-btn--outline" id="btn-email">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Email
       </a>`
    : '';

  const hasContactActions = websiteBtn || phoneBtn || mapsBtn || emailBtn;

  /* --- Fee category --- */
  const feeCategory = school.fee_category || inferFeeCategory(school.fees);
  const feeCatHTML  = feeCategory
    ? `<span class="fee-category-badge ${feeCategoryClass(feeCategory)}">${safe(feeCategory)}</span>`
    : '';

  /* --- Best For --- */
  const bestForTags = school.best_for && school.best_for.length > 0 ? school.best_for : [];
  const bestForHTML = bestForTags.length
    ? `<div class="detail__best-for">
        ${bestForTags.map(t => `<span class="best-for-tag ${bestForClass(t)}">${safe(t)}</span>`).join('')}
       </div>`
    : '';

  /* --- Smart summary (used in About section) --- */
  const aboutText = school.smart_summary || description;

  /* --- Admission status --- */
  const admissionsOpen = school.admissions_open;
  let admissionBadge = '';
  if (admissionsOpen === true) {
    admissionBadge = `<span class="admission-badge admission-badge--open">
      <span class="admission-dot"></span> Admissions Open
    </span>`;
  } else if (admissionsOpen === false) {
    admissionBadge = `<span class="admission-badge admission-badge--closed">
      <span class="admission-dot"></span> Admissions Closed
    </span>`;
  }

  /* --- Verification block --- */
  const isVerified   = school.verified === true || (school.data_source && school.data_source.toLowerCase() === 'verified');
  const updatedAt    = school.updated_at || school.last_updated;
  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
    : null;

  const verificationHTML = isVerified
    ? `<div class="verify-block verify-block--verified">
        <svg class="verify-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <div>
          <span class="verify-title">Verified by Scholr</span>
          ${updatedLabel ? `<span class="verify-sub">Updated ${updatedLabel}</span>` : ''}
        </div>
       </div>`
    : `<div class="verify-block verify-block--estimated">
        <svg class="verify-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>
          <span class="verify-title">Estimated Data</span>
          ${updatedLabel ? `<span class="verify-sub">Last updated ${updatedLabel}</span>` : ''}
        </div>
       </div>`;

  /* ── Final HTML ──────────────────────────────────────── */
  container.innerHTML = `
    <div class="school-detail-card">

      <!-- ── HERO / HEADER ─────────────────────── -->
      <div class="detail__hero">
        <div class="detail__avatar">🏫</div>
        <div class="detail__title-wrap">
          <div class="detail__title-row">
            <h1 class="detail__name">${safe(school.name)}</h1>
            ${admissionBadge}
          </div>
          <p class="detail__location">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${safe(school.location)}${school.city ? `, ${safe(school.city)}` : ''}
          </p>
        </div>
      </div>

      <!-- ── BADGES ────────────────────────────── -->
      <div class="detail__badges">
        <span class="card__board board--${boardKey}">${safe(school.board)}</span>
        ${tagsHTML}
      </div>

      <!-- ── STATS BAR ──────────────────────────── -->
      <div class="detail__stats">
        <div class="detail__stat">
          <span class="stat-label">Board</span>
          <span class="stat-value">${safe(school.board)}</span>
        </div>
        <div class="detail__stat">
          <span class="stat-label">Annual Fees</span>
          <span class="stat-value">${safe(school.fees ?? '—')}</span>
        </div>
        ${feeCategory ? `
        <div class="detail__stat">
          <span class="stat-label">Fee Category</span>
          <span class="stat-value">${feeCatHTML}</span>
        </div>` : ''}
        ${hasRating ? `
        <div class="detail__stat">
          <span class="stat-label">Rating</span>
          <span class="stat-value rating-value">⭐ ${Number(school.rating).toFixed(1)}</span>
        </div>` : ''}
        ${school.type ? `
        <div class="detail__stat">
          <span class="stat-label">Type</span>
          <span class="stat-value">${safe(school.type)}</span>
        </div>` : ''}
      </div>

      <!-- ── CONTACT & ACTIONS ──────────────────── -->
      ${hasContactActions ? `
      <div class="detail__section">
        <h2 class="section-heading">Contact &amp; Actions</h2>
        <div class="action-buttons" id="action-buttons">
          ${websiteBtn}
          ${phoneBtn}
          ${mapsBtn}
          ${emailBtn}
        </div>
      </div>
      <hr class="detail__divider">` : ''}

      <!-- ── BEST FOR ─────────────────────────────── -->
      ${bestForHTML ? `
      <div class="detail__section">
        <h2 class="section-heading">Best For</h2>
        ${bestForHTML}
      </div>
      <hr class="detail__divider">` : ''}

      <!-- ── ABOUT ──────────────────────────────── -->
      <div class="detail__section detail__about">
        <h2 class="section-heading">About the School</h2>
        <p>${safe(aboutText)}</p>
      </div>

      <hr class="detail__divider">

      <!-- ── FACILITIES ─────────────────────────── -->
      <div class="detail__section detail__facilities">
        <h2 class="section-heading">Facilities</h2>
        <ul class="facilities-grid" id="facilities-grid">
          ${facilitiesHTML}
        </ul>
      </div>

      <hr class="detail__divider">

      <!-- ── VERIFICATION ───────────────────────── -->
      <div class="detail__section detail__trust">
        <h2 class="section-heading">Trust &amp; Verification</h2>
        ${verificationHTML}
      </div>

    </div>
  `;
}
