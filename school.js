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
    const { data: schoolData, error: schoolError } = await db
      .from('schools')
      .select('*')
      .eq('id', id)
      .single();

    if (schoolError || !schoolData) {
      console.error('[Scholr] Supabase fetch error:', schoolError);
      showError(schoolError ? schoolError.message : "School not found.");
      return;
    }
    
    // Fetch all schools for recommendations
    const { data: allSchools } = await db
      .from('schools')
      .select('*');

    showSchool();
    renderSchool(schoolData, allSchools || []);
    if (window.ScholrAnalytics) window.ScholrAnalytics.trackSchoolView(id, schoolData.name);
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

/* ─── Mini Card for Recommendations ─────────────── */
function buildMiniCardHTML(school) {
  const boardKey = boardClass(school.board);
  const feeCategory = school.fee_category || inferFeeCategory(school.fees);
  const feeCatHTML  = feeCategory
    ? `<span class="fee-category-badge ${feeCategoryClass(feeCategory)}" style="font-size:0.7rem; padding: 2px 6px;">${safe(feeCategory)}</span>`
    : '';

  return `
    <article class="school-card" tabindex="0" onclick="
      if(window.ScholrAnalytics) window.ScholrAnalytics.trackSimilarSchoolOpened('${safe(window.currentSchoolId)}', '${school.id}');
      window.location.href='school.html?id=${school.id}'" 
      style="cursor: pointer; padding: 16px; min-height: auto; margin-bottom: 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <span class="card__board board--${boardKey}" style="font-size:0.7rem; padding: 2px 6px;">${safe(school.board)}</span>
        <span class="rating__stars" style="font-size:0.8rem; font-weight: 600;">⭐ ${Number(school.rating).toFixed(1)}</span>
      </div>
      <h4 class="card__name" style="font-size: 1rem; margin-bottom: 4px;">${safe(school.name)}</h4>
      <p class="card__location" style="font-size: 0.8rem; margin-bottom: 12px; color: var(--clr-text-sec);">
        ${safe(school.location)}, ${safe(school.city)}
      </p>
      <div class="card__meta" style="margin-bottom: 0; display:flex; gap: 8px;">
        <span class="meta-chip" style="font-size:0.8rem;">${safe(school.fees ?? '—')}</span>
        ${feeCatHTML}
      </div>
    </article>
  `;
}

/* ─── Main renderer ───────────────────────────────────── */
function renderSchool(school, allSchools = []) {
  window.currentSchoolId = school.id;
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
  let admissionBadge = '';
  if (window.ScholrAdmissions) {
    admissionBadge = window.ScholrAdmissions.renderStatusChip(school);
  } else {
    const admissionsOpen = school.admissions_open;
    if (admissionsOpen === true) {
      admissionBadge = `<span class="admission-badge admission-badge--open">
        <span class="admission-dot"></span> Admissions Open
      </span>`;
    } else if (admissionsOpen === false) {
      admissionBadge = `<span class="admission-badge admission-badge--closed">
        <span class="admission-dot"></span> Admissions Closed
      </span>`;
    }
  }

  /* --- Trust & Verification Block --- */
  const trustSectionHTML = window.ScholrTrust 
    ? window.ScholrTrust.renderTrustSection(school)
    : '';

  /* ── Final HTML ──────────────────────────────────────── */
  container.innerHTML = `
    <div class="school-detail-card">

      <!-- ── HERO / HEADER ─────────────────────── -->
      <div class="detail__hero">
        <div class="detail__avatar" style="overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--clr-blue-50);">
          ${school.logo_url ? `<img src="${school.logo_url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;" alt="${safe(school.name)} Logo">` : '🏫'}
        </div>
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

      <!-- ── ADMISSION TIMELINE ─────────────────── -->
      ${window.ScholrAdmissions ? window.ScholrAdmissions.renderTimeline(school) : ''}

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

      <!-- ── CAMPUS GALLERY ──────────────────────── -->
      ${school.gallery_urls && school.gallery_urls.length > 0 ? `
      <div class="detail__section detail__gallery">
        <h2 class="section-heading">Campus Gallery</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 16px;">
          ${school.gallery_urls.map(url => `
            <div class="gallery-item-wrap" style="border-radius: 8px; overflow: hidden; height: 160px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid var(--clr-border, #e2e8f0);">
              <img src="${url}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.06)'" onmouseout="this.style.transform='scale(1)'" alt="Campus View">
            </div>
          `).join('')}
        </div>
      </div>
      <hr class="detail__divider">
      ` : ''}

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
        <div class="detail__trust-header" style="align-items: center;">
          <h2 class="section-heading" style="margin-bottom:0;">Trust &amp; Verification</h2>
          <div style="display:flex; gap: 8px; flex-wrap: wrap;">
            ${!school.is_claimed ? `
            <button class="suggest-btn claim-btn" id="claim-btn-trigger">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Claim This School
            </button>
            ` : ''}
            <button class="suggest-btn" id="suggest-btn-trigger">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Suggest an Update
            </button>
          </div>
        </div>
        ${school.is_claimed ? `
        <div class="trust-verify trust-verify--claimed">
          <div class="trust-verify__icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <span class="trust-verify__title">Profile Claimed by School</span>
            <span class="trust-verify__sub">This profile is actively managed by the school administration</span>
          </div>
        </div>
        ` : ''}
        ${trustSectionHTML}

        <!-- ── PARENT TRUST SUMMARY CARD ─────────── -->
        ${(() => {
          // Dynamic calculation on public details page
          let score = 0;
          
          // 1. Description (20%)
          const desc = school.description || '';
          if (desc.trim().length > 50) score += 20;
          else if (desc.trim().length > 0) score += 10;
          
          // 2. Media Assets (25% total): Logo (10%), Gallery images (15% - 3.75% per image)
          if (school.logo_url) score += 10;
          const gallery = school.gallery_urls || [];
          score += Math.min(4, gallery.length) * 3.75;
          
          // 3. Admissions Data (20% total): Toggle (5%), dates (10%), notes (5%)
          if (school.admissions_open !== null && school.admissions_open !== undefined) score += 5;
          const hasDates = school.application_start_date || school.application_deadline || school.session_start_date;
          if (hasDates) score += 10;
          if (school.admission_notes && school.admission_notes.trim().length > 0) score += 5;
          
          // 4. Facilities (10%) & Best For Tags (5%)
          const facilities = school.facilities || [];
          if (facilities.length >= 3) score += 10;
          else if (facilities.length > 0) score += 5;
          
          const bestFor = school.best_for || [];
          if (bestFor.length >= 2) score += 5;
          else if (bestFor.length > 0) score += 2.5;
          
          // 5. Contact Channels (10% total - 2.5% each)
          if (school.website) score += 2.5;
          if (school.email) score += 2.5;
          if (school.phone) score += 2.5;
          if (school.maps_link) score += 2.5;
          
          // 6. Verification State (10%)
          const tier = school.verification_level || 'limited';
          if (tier.toLowerCase().includes('verified')) score += 10;
          else if (tier.toLowerCase().includes('community')) score += 5;
          else score += 2;
          
          score = Math.round(score);
          if (score > 100) score = 100;

          let tierLabel = 'Limited Information';
          let tierColor = '#b45309'; // amber
          let tierIcon = '⚠️';
          if (score >= 80) {
            tierLabel = 'Excellent Profile';
            tierColor = '#10b981'; // emerald
            tierIcon = '✅';
          } else if (score >= 50) {
            tierLabel = 'Good Coverage';
            tierColor = '#4f46e5'; // brand indigo
            tierIcon = 'ℹ️';
          }

          const refreshLabel = window.ScholrTrust ? window.ScholrTrust.formatRelativeTime(school.updated_at || school.last_updated) : 'Recent';

          return `
            <div class="parent-trust-card" style="margin-top:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:24px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); box-sizing: border-box; text-align: left;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:20px;">
                <div>
                  <h3 style="font-size:1.1rem; font-weight:700; margin:0 0 4px 0; color:#0f172a;">Parent Trust Summary</h3>
                  <p style="font-size:0.85rem; color:#475569; margin:0;">Rich, verified, and school-maintained information profile.</p>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="text-align:right;">
                    <span style="display:block; font-size:0.7rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.03em;">Richness Score</span>
                    <span style="font-size:1.5rem; font-weight:800; color:${tierColor};">${score}%</span>
                  </div>
                  <div style="width:48px; height:48px; border-radius:50%; border:3px solid #e2e8f0; display:flex; align-items:center; justify-content:center; font-size:1.25rem; background:#ffffff;">
                    ${tierIcon}
                  </div>
                </div>
              </div>
              
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:16px;">
                <div style="display:flex; gap:10px; align-items:center; background:#ffffff; border:1px solid #f1f5f9; padding:12px; border-radius:8px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
                  <span style="font-size:1.25rem;">🛡️</span>
                  <div>
                    <span style="display:block; font-size:0.7rem; font-weight:600; color:#94a3b8; text-transform:uppercase;">Listing Claim</span>
                    <span style="font-size:0.85rem; font-weight:700; color:${school.is_claimed ? '#10b981' : '#64748b'};">
                      ${school.is_claimed ? 'Claimed Profile' : 'Unclaimed'}
                    </span>
                  </div>
                </div>
                <div style="display:flex; gap:10px; align-items:center; background:#ffffff; border:1px solid #f1f5f9; padding:12px; border-radius:8px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
                  <span style="font-size:1.25rem;">🏅</span>
                  <div>
                    <span style="display:block; font-size:0.7rem; font-weight:600; color:#94a3b8; text-transform:uppercase;">Verification</span>
                    <span style="font-size:0.85rem; font-weight:700; color:#3b82f6;">${school.verification_level || 'Limited Data'}</span>
                  </div>
                </div>
                <div style="display:flex; gap:10px; align-items:center; background:#ffffff; border:1px solid #f1f5f9; padding:12px; border-radius:8px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
                  <span style="font-size:1.25rem;">🕒</span>
                  <div>
                    <span style="display:block; font-size:0.7rem; font-weight:600; color:#94a3b8; text-transform:uppercase;">Freshness</span>
                    <span style="font-size:0.85rem; font-weight:700; color:#475569;">${refreshLabel || 'Recent'}</span>
                  </div>
                </div>
              </div>
            </div>
          `;
        })()}
      </div>

      <!-- ── SIMILAR SCHOOLS ──────────────────────── -->
      <div id="similar-schools-placeholder"></div>
    </div>
  `;

  /* --- Render Similar Schools --- */
  if (window.ScholrDiscovery && allSchools && allSchools.length > 0) {
    const similar = window.ScholrDiscovery.getSimilarSchools(school, allSchools, 3);
    if (similar.length > 0) {
      const cardsHtml = similar.map(s => {
        const reason = window.ScholrDiscovery.getRecommendationReason(s.reasons);
        return `
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${buildMiniCardHTML(s.school)}
            <span class="reason-badge" style="font-size: 0.75rem; color: var(--clr-blue-700); background: var(--clr-blue-50); padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; margin-top: 4px; border: 1px solid var(--clr-blue-100);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              ${safe(reason)}
            </span>
          </div>
        `;
      }).join('');

      const similarContainer = document.getElementById('similar-schools-placeholder');
      if (similarContainer) {
        similarContainer.innerHTML = `
          <hr class="detail__divider">
          <div class="detail__section detail__similar">
            <h2 class="section-heading">Similar Schools You May Like</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 16px;">
              ${cardsHtml}
            </div>
          </div>
        `;
      }
    }
  }
}

// Hook up Suggest an Update button right after render
const oldRenderSchool = renderSchool;
renderSchool = function(school, allSchools = []) {
  oldRenderSchool(school, allSchools);
  
  const suggestBtn = document.getElementById('suggest-btn-trigger');
  if (suggestBtn && window.ScholrTrust) {
    suggestBtn.addEventListener('click', () => {
      if (window.ScholrAnalytics) window.ScholrAnalytics.trackSuggestUpdateClick(school.id);
      window.ScholrTrust.openSuggestModal(school);
    });
  }
  
  // Claim School Logic
  const claimBtn = document.getElementById('claim-btn-trigger');
  if (claimBtn) {
    claimBtn.addEventListener('click', () => {
      if (window.ScholrAnalytics) window.ScholrAnalytics.trackClaimButtonClick(school.id, school.name);
      openClaimModal(school);
    });
  }
  
  // Hook up contact analytics
  const trackContact = (id, type) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => {
      if (window.ScholrAnalytics) window.ScholrAnalytics.trackContactClick(type, school.id);
    });
  };
  trackContact('btn-website', 'website');
  trackContact('btn-call', 'phone');
  trackContact('btn-maps', 'maps');
  trackContact('btn-email', 'email');

  // Hook up admissions analytics
  if (window.ScholrAdmissions && window.ScholrAnalytics) {
    const timeline = document.getElementById('admission-timeline');
    if (timeline) {
      window.ScholrAnalytics.trackAdmissionTimelineViewed(school.id);
      const statusChips = document.querySelectorAll('.admission-status-chip');
      statusChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const statusText = window.ScholrAdmissions.getAdmissionStatus(school);
          window.ScholrAnalytics.trackAdmissionStatusClicked(school.id, statusText);
        });
      });
    }
  }
};

/* ── CLAIM SCHOOL MODAL LOGIC ──────────────────────────── */
function openClaimModal(school) {
  const modal = document.getElementById('claim-school-modal');
  const form = document.getElementById('claim-school-form');
  const success = document.getElementById('claim-school-success');
  const nameInput = document.getElementById('claim-school-name');
  
  if (!modal) return;
  
  modal.hidden = false;
  form.style.display = 'block';
  success.hidden = true;
  
  // Reset and populate form
  form.reset();
  nameInput.value = school.name;
  
  // Close handlers
  const closeModal = () => modal.hidden = true;
  document.getElementById('claim-school-close').onclick = closeModal;
  document.getElementById('claim-school-done').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  
  // Form submission
  // Remove existing listener to prevent duplicates if opened multiple times
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  
  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const emailVal = document.getElementById('claim-official-email').value.trim();
    const phoneVal = document.getElementById('claim-contact-number').value.trim();
    const desigVal = document.getElementById('claim-designation').value.trim();
    
    // Basic spam prevention: check local storage for recent submission
    const lastSub = localStorage.getItem('last_claim_sub');
    if (lastSub && Date.now() - parseInt(lastSub, 10) < 60000) {
      alert("Please wait a moment before submitting another request.");
      return;
    }
    
    const submitBtn = document.getElementById('claim-school-submit');
    submitBtn.textContent = 'Submitting…';
    submitBtn.disabled = true;
    
    try {
      const { error } = await db
        .from('school_claim_requests')
        .insert({
          school_id: school.id,
          school_name: school.name,
          official_email: emailVal,
          contact_phone: phoneVal,
          designation: desigVal
        });
        
      if (error) throw error;
      
      localStorage.setItem('last_claim_sub', Date.now());
      
      submitBtn.textContent = 'Submit Request';
      submitBtn.disabled = false;
      
      newForm.style.display = 'none';
      document.getElementById('claim-school-success').hidden = false;
      
      if (window.ScholrAnalytics) window.ScholrAnalytics.trackClaimSubmitted(school.id);
      
    } catch (err) {
      console.warn('[Scholr] Claim submission error:', err);
      submitBtn.textContent = 'Submit Request';
      submitBtn.disabled = false;
      
      let errEl = document.getElementById('claim-error-msg');
      if (!errEl) {
        errEl = document.createElement('p');
        errEl.id = 'claim-error-msg';
        errEl.style.cssText = 'color:#b91c1c;font-size:0.85rem;margin-top:8px;';
        newForm.querySelector('.form-actions').after(errEl);
      }
      errEl.textContent = 'Something went wrong. Please try again.';
    }
  });
}

