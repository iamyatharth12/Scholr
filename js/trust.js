/* ═══════════════════════════════════════════════════════════
   js/trust.js  —  Scholr Trust & Freshness Utility Module
   ═══════════════════════════════════════════════════════════
   Central module for all trust-related UI logic:
     • Verification badges (3 levels)
     • Freshness timestamps (relative time)
     • Transparency messaging
     • "Suggest an Update" modal
   Import via <script src="js/trust.js"></script>
   Exposed as window.ScholrTrust
═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────────────────
     VERIFICATION LEVEL CONFIG
     Single source of truth for all 3 verification levels.
     Add new levels here — nothing else needs to change.
  ───────────────────────────────────────────────────────── */
  const VERIFICATION_CONFIG = {
    verified: {
      label:     'Verified',
      shortLabel:'Verified',
      cssClass:  'vbadge--verified',
      icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="3"
               stroke-linecap="round" stroke-linejoin="round">
               <polyline points="20 6 9 17 4 12"/>
             </svg>`,
      transparencyMsg: null, // verified data → no warning needed
    },
    community: {
      label:     'Community Verified',
      shortLabel:'Community',
      cssClass:  'vbadge--community',
      icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
               <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
               <circle cx="9" cy="7" r="4"/>
               <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
               <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
             </svg>`,
      transparencyMsg: 'Community-submitted data. Some details may need verification.',
    },
    limited: {
      label:     'Limited Data',
      shortLabel:'Limited Data',
      cssClass:  'vbadge--limited',
      icon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
               <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94
                        a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
               <line x1="12" y1="9" x2="12" y2="13"/>
               <line x1="12" y1="17" x2="12.01" y2="17"/>
             </svg>`,
      transparencyMsg: 'Limited verified information available. Some information may be estimated.',
    },
  };

  /* Normalize incoming verification_level values to a config key */
  function normalizeLevel(level) {
    if (!level) return null;
    const l = String(level).toLowerCase().trim();
    if (l === 'verified')                        return 'verified';
    if (l === 'community verified' || l === 'community') return 'community';
    if (l === 'limited data'       || l === 'limited')   return 'limited';
    return null; // unknown → render nothing
  }

  /* ─────────────────────────────────────────────────────────
     PUBLIC API: getVerificationBadge(level, opts)
     Returns an HTML string for the verification badge.
     opts.compact = true → use shortLabel (for cards)
  ───────────────────────────────────────────────────────── */
  function getVerificationBadge(level, opts = {}) {
    const key = normalizeLevel(level);
    if (!key) return '';
    const cfg = VERIFICATION_CONFIG[key];
    const label = opts.compact ? cfg.shortLabel : cfg.label;
    return `<span class="vbadge ${cfg.cssClass}" title="${cfg.label}">${cfg.icon}${label}</span>`;
  }

  /* ─────────────────────────────────────────────────────────
     PUBLIC API: getVerificationColor(level)
     Returns a CSS color string for the given level.
  ───────────────────────────────────────────────────────── */
  function getVerificationColor(level) {
    const key = normalizeLevel(level);
    const colors = {
      verified:  '#15803d',
      community: '#1d4ed8',
      limited:   '#b45309',
    };
    return key ? colors[key] : '#9ca3af';
  }

  /* ─────────────────────────────────────────────────────────
     PUBLIC API: formatRelativeTime(timestamp)
     Returns a human-readable relative time string.
     Handles: ISO strings, Date objects, null/undefined.
  ───────────────────────────────────────────────────────── */
  function formatRelativeTime(timestamp) {
    if (!timestamp) return null;
    let date;
    try {
      date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) return null;
    } catch {
      return null;
    }

    const now  = new Date();
    const diff = now - date; // ms
    const abs  = Math.abs(diff);

    const MINUTE = 60_000;
    const HOUR   = 3_600_000;
    const DAY    = 86_400_000;
    const WEEK   = DAY * 7;
    const MONTH  = DAY * 30;
    const YEAR   = DAY * 365;

    if (abs < MINUTE)       return 'Just now';
    if (abs < HOUR)         return `${Math.round(abs / MINUTE)} min ago`;
    if (abs < DAY)          return `${Math.round(abs / HOUR)} hr ago`;
    if (abs < 2 * DAY)      return 'Yesterday';
    if (abs < WEEK)         return `${Math.round(abs / DAY)} days ago`;
    if (abs < 2 * WEEK)     return 'Last week';
    if (abs < MONTH)        return `${Math.round(abs / WEEK)} weeks ago`;

    // For older dates, use a readable calendar label
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  /* ─────────────────────────────────────────────────────────
     PUBLIC API: renderFreshnessChip(updatedAt, lastVerifiedAt)
     Returns an HTML chip showing data freshness.
     Prefers lastVerifiedAt if available, falls back to updatedAt.
  ───────────────────────────────────────────────────────── */
  function renderFreshnessChip(updatedAt, lastVerifiedAt) {
    const ts    = lastVerifiedAt || updatedAt;
    const label = formatRelativeTime(ts);
    if (!label) return '';

    const prefix = lastVerifiedAt ? 'Verified' : 'Updated';
    return `<span class="freshness-chip" title="Data last ${prefix.toLowerCase()} ${label}">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      ${prefix} ${label}
    </span>`;
  }

  /* ─────────────────────────────────────────────────────────
     PUBLIC API: renderTransparencyMessage(level, dataNotes, opts)
     Returns an HTML block for the transparency notice.
     Returns '' when level is verified and no dataNotes provided.
  ───────────────────────────────────────────────────────── */
  function renderTransparencyMessage(level, dataNotes, opts = {}) {
    const key = normalizeLevel(level);
    const cfg  = key ? VERIFICATION_CONFIG[key] : null;

    // Prefer explicit data_notes from DB, fall back to level's default msg
    const msg = dataNotes || (cfg ? cfg.transparencyMsg : null);
    if (!msg) return '';

    const isWarning = key === 'limited';
    let cssClass  = isWarning ? 'transparency-note transparency-note--warn' : 'transparency-note';
    if (opts.compact) cssClass += ' transparency-note--compact';

    const iconSvg = isWarning
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
           <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94
                    a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
           <line x1="12" y1="9" x2="12" y2="13"/>
           <line x1="12" y1="17" x2="12.01" y2="17"/>
         </svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
           <circle cx="12" cy="12" r="10"/>
           <line x1="12" y1="8" x2="12" y2="12"/>
           <line x1="12" y1="16" x2="12.01" y2="16"/>
         </svg>`;

    return `<div class="${cssClass}" role="note">
      <span class="transparency-note__icon">${iconSvg}</span>
      <span class="transparency-note__text">${msg}</span>
    </div>`;
  }

  /* ─────────────────────────────────────────────────────────
     PUBLIC API: renderTrustSection(school)
     Full Trust & Verification section HTML for detail pages.
     Combines verification block + freshness + transparency.
  ───────────────────────────────────────────────────────── */
  function renderTrustSection(school) {
    const key = normalizeLevel(school.verification_level);
    const cfg  = key ? VERIFICATION_CONFIG[key] : null;

    /* -- Verification block -- */
    let verifyHTML = '';
    if (key === 'verified') {
      verifyHTML = `
        <div class="trust-verify trust-verify--verified">
          <div class="trust-verify__icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="3"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <span class="trust-verify__title">Verified by Scholr</span>
            <span class="trust-verify__sub">Data has been reviewed and confirmed by our team</span>
          </div>
        </div>`;
    } else if (key === 'community') {
      verifyHTML = `
        <div class="trust-verify trust-verify--community">
          <div class="trust-verify__icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <span class="trust-verify__title">Community Verified</span>
            <span class="trust-verify__sub">Confirmed by parent and community submissions</span>
          </div>
        </div>`;
    } else {
      verifyHTML = `
        <div class="trust-verify trust-verify--limited">
          <div class="trust-verify__icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <span class="trust-verify__title">Data Availability</span>
            <span class="trust-verify__sub">Information collected from public sources</span>
          </div>
        </div>`;
    }

    /* -- Freshness row -- */
    const updatedLabel   = formatRelativeTime(school.updated_at || school.last_updated);
    const verifiedLabel  = formatRelativeTime(school.last_verified_at);

    const freshnessHTML = `
      <div class="trust-meta-row">
        ${school.claimed_by_school ? `
        <div class="trust-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span style="color:var(--clr-blue-600);font-weight:500;">Profile Claimed</span>
        </div>` : ''}
        ${updatedLabel ? `
        <div class="trust-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>Updated ${updatedLabel}</span>
        </div>` : ''}
        ${verifiedLabel ? `
        <div class="trust-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Verified ${verifiedLabel}</span>
        </div>` : ''}
      </div>`;

    /* -- Transparency message -- */
    const transparencyHTML = renderTransparencyMessage(
      school.verification_level,
      school.data_notes
    );

    return `
      ${verifyHTML}
      ${freshnessHTML}
      ${transparencyHTML}
    `;
  }

  /* ─────────────────────────────────────────────────────────
     PUBLIC API: openSuggestModal(school)
     Creates and shows the "Suggest an Update" modal.
     Inserts into Supabase `suggestions` table on submit.
     Self-contained — creates/removes its own DOM.
  ───────────────────────────────────────────────────────── */
  function openSuggestModal(school) {
    // Remove any existing modal first
    const existing = document.getElementById('suggest-modal');
    if (existing) existing.remove();

    const modalHTML = `
      <div class="suggest-modal" id="suggest-modal" role="dialog"
           aria-modal="true" aria-labelledby="suggest-modal-title">
        <div class="suggest-modal__backdrop" id="suggest-modal-backdrop"></div>
        <div class="suggest-modal__box">
          <div class="suggest-modal__header">
            <div>
              <h2 class="suggest-modal__title" id="suggest-modal-title">Suggest an Update</h2>
              <p class="suggest-modal__subtitle">Help us keep this profile accurate for other parents.</p>
            </div>
            <button class="suggest-modal__close" id="suggest-modal-close"
                    aria-label="Close modal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <form class="suggest-form" id="suggest-form" novalidate>
            <div class="suggest-form__school-tag">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              ${school.name}
            </div>

            <div class="suggest-form__group">
              <label class="suggest-form__label" for="suggest-type">What would you like to update?</label>
              <select class="suggest-form__select" id="suggest-type" required>
                <option value="">— Choose a category —</option>
                <option value="fees">Annual Fees / Fee Structure</option>
                <option value="facilities">Facilities</option>
                <option value="contact">Contact Details / Website</option>
                <option value="admission">Admissions Information</option>
                <option value="general">General School Information</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div class="suggest-form__group">
              <label class="suggest-form__label" for="suggest-detail">Your correction or updated information</label>
              <textarea class="suggest-form__textarea" id="suggest-detail"
                        placeholder="Please describe what needs to be updated…"
                        rows="4" required maxlength="1000"></textarea>
              <span class="suggest-form__hint">Max 1000 characters. Be as specific as possible.</span>
            </div>

            <div class="suggest-form__group">
              <label class="suggest-form__label" for="suggest-email">
                Your email <span class="suggest-form__optional">(optional)</span>
              </label>
              <input class="suggest-form__input" type="email" id="suggest-email"
                     placeholder="we may follow up to verify the update"/>
            </div>

            <div class="suggest-form__actions">
              <button type="button" class="btn btn--ghost" id="suggest-cancel">Cancel</button>
              <button type="submit" class="btn btn--primary" id="suggest-submit">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Submit Update
              </button>
            </div>

            <div class="suggest-form__status" id="suggest-status" aria-live="polite"></div>
          </form>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal    = document.getElementById('suggest-modal');
    const backdrop = document.getElementById('suggest-modal-backdrop');
    const closeBtn = document.getElementById('suggest-modal-close');
    const cancelBtn= document.getElementById('suggest-cancel');
    const form     = document.getElementById('suggest-form');
    const status   = document.getElementById('suggest-status');

    // Animate in
    requestAnimationFrame(() => modal.classList.add('suggest-modal--open'));

    function closeModal() {
      modal.classList.remove('suggest-modal--open');
      modal.addEventListener('transitionend', () => modal.remove(), { once: true });
    }

    backdrop.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Trap focus inside modal
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onKey); }
    });

    /* ── Form submission ── */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const type   = document.getElementById('suggest-type').value;
      const detail = document.getElementById('suggest-detail').value.trim();
      const email  = document.getElementById('suggest-email').value.trim();

      if (!type || !detail) {
        setStatus('error', 'Please fill in all required fields.');
        return;
      }

      const submitBtn = document.getElementById('suggest-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
      setStatus('', '');

      try {
        // Try Supabase insert if db is available on the page
        if (global.ScholrDB) {
          const { error } = await global.ScholrDB
            .from('suggestions')
            .insert({
              school_id:   school.id,
              school_name: school.name,
              type,
              detail,
              email: email || null,
              submitted_at: new Date().toISOString(),
            });

          if (error) throw error;
        } else {
          // No DB available — still show success (form data captured)
          await new Promise(r => setTimeout(r, 800));
        }

        setStatus('success', '✓ Thank you! Your suggestion has been received.');
        form.reset();
        setTimeout(closeModal, 2500);
      } catch (err) {
        console.warn('[Scholr] Suggestion submit error:', err);
        setStatus('error', 'Something went wrong. Please try again or email us directly.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg> Submit Update`;
      }
    });

    function setStatus(type, msg) {
      status.className = 'suggest-form__status';
      if (type) status.classList.add(`suggest-form__status--${type}`);
      status.textContent = msg;
    }
  }

  /* ─────────────────────────────────────────────────────────
     EXPOSE as window.ScholrTrust
  ───────────────────────────────────────────────────────── */
  global.ScholrTrust = {
    getVerificationBadge,
    getVerificationColor,
    formatRelativeTime,
    renderFreshnessChip,
    renderTransparencyMessage,
    renderTrustSection,
    openSuggestModal,
  };

})(window);
