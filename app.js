/* ─────────────────────────────────────────────
   app.js — Scholr UI interactions
   All data now comes from Supabase via supabase.js.
   No mock data. No backend.
───────────────────────────────────────────── */

(function () {
  'use strict';

  /* ══════════════════════════════════
     Navbar: scroll shadow + mobile menu
  ══════════════════════════════════ */
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 8);
  }, { passive: true });

  hamburger.addEventListener('click', () => {
    const open = !navLinks.classList.contains('open');
    navLinks.classList.toggle('open', open);
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
  });

  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });

  /* ══════════════════════════════════
     Hero: "Use my location" button
  ══════════════════════════════════ */
  const locationInput  = document.getElementById('location-input');
  const useLocationBtn = document.getElementById('use-location-btn');
  const searchBtn      = document.getElementById('search-btn');

  useLocationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      locationInput.value = 'Geolocation not supported by your browser.';
      return;
    }
    useLocationBtn.textContent = 'Detecting…';
    useLocationBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      () => {
        locationInput.value = 'Current Location (detected)';
        useLocationBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Location set`;
        useLocationBtn.disabled = false;
      },
      () => {
        locationInput.placeholder = 'Could not detect location. Enter manually.';
        useLocationBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2" x2="12" y2="5"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="5" y2="12"/>
            <line x1="19" y1="12" x2="22" y2="12"/>
          </svg>
          Use my location`;
        useLocationBtn.disabled = false;
      }
    );
  });

  /* Hero "Search Schools" → real-time search */
  let searchTimeout;
  
  function handleSearch() {
    const query = locationInput.value.trim();
    if (searchTimeout) clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(async () => {
      if (query === '') {
        await window.Scholr.fetchSchools();
      } else {
        await window.Scholr.searchSchools(query);
      }
    }, 300);
  }

  locationInput.addEventListener('input', handleSearch);

  searchBtn.addEventListener('click', async () => {
    const query = locationInput.value.trim();
    if (query === '') {
      await window.Scholr.fetchSchools();
    } else {
      if (window.ScholrAnalytics) window.ScholrAnalytics.trackSearch(query);
      await window.Scholr.searchSchools(query);
    }
    document.getElementById('listings').scrollIntoView({ behavior: 'smooth' });
  });

  /* ══════════════════════════════════
     Distance slider: live label update
  ══════════════════════════════════ */
  const slider        = document.getElementById('distance-slider');
  const distanceValue = document.getElementById('distance-value');

  function updateSlider() {
    const val = slider.value;
    const pct = ((val - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.background =
      `linear-gradient(to right, var(--clr-blue-500) ${pct}%, var(--clr-border) ${pct}%)`;
    distanceValue.textContent = `${val} km`;
  }
  slider.addEventListener('input', updateSlider);
  updateSlider();

  /* ══════════════════════════════════
     Filters → Supabase query
  ══════════════════════════════════ */
  const applyBtn  = document.getElementById('apply-filters-btn');
  const resetBtn  = document.getElementById('reset-btn');
  const boardSel  = document.getElementById('board-filter');
  const feeSel    = document.getElementById('fee-filter');

  async function applyFilters() {
    const board = boardSel.value;
    const fee   = feeSel.value;
    
    if (window.ScholrAnalytics) window.ScholrAnalytics.trackFilterUsage(board, fee);

    boardSel.disabled = true;
    feeSel.disabled = true;
    applyBtn.disabled = true;
    resetBtn.disabled = true;
    const originalText = applyBtn.textContent;
    applyBtn.textContent = 'Applying...';

    await window.Scholr.filterSchools({ board, fee });

    boardSel.disabled = false;
    feeSel.disabled = false;
    applyBtn.disabled = false;
    resetBtn.disabled = false;
    applyBtn.textContent = originalText;
  }

  boardSel.addEventListener('change', applyFilters);
  feeSel.addEventListener('change', applyFilters);

  applyBtn.addEventListener('click', async () => {
    await applyFilters();
    document.getElementById('listings').scrollIntoView({ behavior: 'smooth' });
  });

  resetBtn.addEventListener('click', async () => {
    boardSel.value = '';
    feeSel.value   = '';
    slider.value   = 5;
    updateSlider();
    
    resetBtn.disabled = true;
    await window.Scholr.fetchSchools();
    resetBtn.disabled = false;
  });

  /* ══════════════════════════════════
     Initial load — fetch all schools
  ══════════════════════════════════ */
  window.Scholr.fetchSchools();

  /* ══════════════════════════════════
     FAQ Accordion
  ══════════════════════════════════ */
  const faqItems = document.querySelectorAll('.faq-item');
  
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all
      faqItems.forEach(faq => {
        faq.classList.remove('active');
        faq.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      
      // Open clicked if it was not active
      if (!isActive) {
        item.classList.add('active');
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ══════════════════════════════════
     Suggest a School Modal
  ══════════════════════════════════ */
  const suggestModal = document.getElementById('suggest-school-modal');
  const suggestForm = document.getElementById('suggest-school-form');
  const suggestSuccess = document.getElementById('suggest-school-success');

  function openSuggestModal() {
    if (!suggestModal) return;
    suggestModal.hidden = false;
    if (suggestForm) suggestForm.style.display = 'block';
    if (suggestSuccess) suggestSuccess.hidden = true;
  }

  function closeSuggestModal() {
    if (!suggestModal) return;
    suggestModal.hidden = true;
    if (suggestForm) suggestForm.reset();
  }

  // Bind footer link
  const footerSuggestLink = document.getElementById('footer-suggest-link');
  if (footerSuggestLink) {
    footerSuggestLink.addEventListener('click', (e) => {
      e.preventDefault();
      openSuggestModal();
    });
  }

  // Bind dynamic triggers (e.g. from empty states)
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.suggest-school-trigger')) {
      e.preventDefault();
      openSuggestModal();
    }
  });

  // Bind close buttons
  const suggestCloseBtn = document.getElementById('suggest-school-close');
  if (suggestCloseBtn) suggestCloseBtn.addEventListener('click', closeSuggestModal);
  
  const suggestDoneBtn = document.getElementById('suggest-school-done');
  if (suggestDoneBtn) suggestDoneBtn.addEventListener('click', closeSuggestModal);

  // Close on outside click
  if (suggestModal) {
    suggestModal.addEventListener('click', (e) => {
      if (e.target === suggestModal) closeSuggestModal();
    });
  }

  // Form submit
  if (suggestForm) {
    suggestForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('suggest-school-submit');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Submitting...';
      submitBtn.disabled = true;

      // Simulate API call
      setTimeout(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        suggestForm.style.display = 'none';
        if (suggestSuccess) suggestSuccess.hidden = false;
        
        if (window.ScholrAnalytics) window.ScholrAnalytics.trackSuggestSchool();
      }, 600);
    });
  }

})();
