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
      saveSessionState();
    }, 300);
  }

  locationInput.addEventListener('input', handleSearch);

  // Submit search and scroll smoothly to listings
  async function submitSearch() {
    const query = locationInput.value.trim();
    if (query === '') {
      await window.Scholr.fetchSchools();
    } else {
      if (window.ScholrAnalytics) {
        window.ScholrAnalytics.trackSearch(query);
        window.ScholrAnalytics.trackEvent('local_search_performed', { query: query, city: localStorage.getItem('scholr_selected_city') || 'Guwahati' });
      }
      await window.Scholr.searchSchools(query);
    }
    saveSessionState();
    scrollToResultsSmooth();
  }

  searchBtn.addEventListener('click', submitSearch);
  
  locationInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitSearch();
    }
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
     Discovery State Persistence & Scroll Restoration Engine
     ══════════════════════════════════ */
  const STATE_KEY = 'scholr_discovery_state';
  let isRestoring = false;

  function getSessionState() {
    try {
      const stored = sessionStorage.getItem(STATE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSessionState(scrollPosition = null) {
    if (isRestoring) return;
    if (!document.getElementById('schools-section')) return;

    try {
      const activeCity = localStorage.getItem('scholr_selected_city') || 'Guwahati';
      const currentState = getSessionState() || {};

      const facilities = [];
      if (hostelCb && hostelCb.checked) facilities.push('hostel');
      if (transCb && transCb.checked) facilities.push('transport');
      if (sportsCb && sportsCb.checked) facilities.push('sports');

      currentState.selected_city = activeCity;
      currentState.search_query = locationInput ? locationInput.value.trim() : '';
      currentState.board_filter = boardSel ? boardSel.value : '';
      currentState.fee_filter = feeSel ? feeSel.value : '';
      currentState.rating_filter = ratingSel ? ratingSel.value : '';
      currentState.facilities = facilities;
      currentState.admissions_open = adminCb ? adminCb.checked : false;
      currentState.distance_slider = slider ? slider.value : 5;

      if (scrollPosition !== null) {
        currentState.scroll_position = scrollPosition;
      }

      sessionStorage.setItem(STATE_KEY, JSON.stringify(currentState));
    } catch (e) {
      console.warn('[Scholr] State save error:', e);
    }
  }

  function scrollToResultsSmooth() {
    if (isRestoring) return;
    const target = document.getElementById('schools-section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Scroll listener (debounced)
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (document.getElementById('schools-section')) {
        saveSessionState(window.scrollY);
      }
    }, 150);
  }, { passive: true });

  const applyBtn  = document.getElementById('apply-filters-btn');
  const resetBtn  = document.getElementById('reset-btn');
  const boardSel  = document.getElementById('board-filter');
  const feeSel    = document.getElementById('fee-filter');
  const ratingSel = document.getElementById('rating-filter');
  const hostelCb  = document.getElementById('filter-hostel');
  const transCb   = document.getElementById('filter-transport');
  const sportsCb  = document.getElementById('filter-sports');
  const adminCb   = document.getElementById('filter-admissions');

  const citySel   = document.getElementById('city-filter');

  async function applyFilters() {
    const city  = citySel ? citySel.value : '';
    const board = boardSel.value;
    const fee   = feeSel.value;
    const minRating = ratingSel ? ratingSel.value : '';
    
    const facilities = [];
    if (hostelCb && hostelCb.checked) facilities.push('hostel');
    if (transCb && transCb.checked) facilities.push('transport');
    if (sportsCb && sportsCb.checked) facilities.push('sports');
    
    const admissionsOpen = adminCb ? adminCb.checked : false;
    
    if (window.ScholrAnalytics) {
      window.ScholrAnalytics.trackFilterUsage(board, fee);
      if (facilities.length > 0) window.ScholrAnalytics.trackAdvancedFilterUsed('facilities', facilities.join(','));
      if (minRating) window.ScholrAnalytics.trackAdvancedFilterUsed('rating', minRating);
      if (admissionsOpen) window.ScholrAnalytics.trackAdvancedFilterUsed('admissions_open', true);
      if (city) window.ScholrAnalytics.trackAdvancedFilterUsed('city', city);
    }

    boardSel.disabled = true;
    feeSel.disabled = true;
    if (citySel) citySel.disabled = true;
    applyBtn.disabled = true;
    resetBtn.disabled = true;
    const originalText = applyBtn.textContent;
    applyBtn.textContent = 'Applying...';

    await window.Scholr.filterSchools({ city, board, fee, minRating, facilities, admissionsOpen });

    boardSel.disabled = false;
    feeSel.disabled = false;
    if (citySel) citySel.disabled = false;
    applyBtn.disabled = false;
    resetBtn.disabled = false;
    applyBtn.textContent = originalText;

    saveSessionState();
  }

  // Bind change and checked handlers to execute immediate filter + scroll smoothly
  boardSel.addEventListener('change', () => { applyFilters(); scrollToResultsSmooth(); });
  feeSel.addEventListener('change', () => { applyFilters(); scrollToResultsSmooth(); });
  if (ratingSel) ratingSel.addEventListener('change', () => { applyFilters(); scrollToResultsSmooth(); });
  
  if (hostelCb) hostelCb.addEventListener('change', () => { applyFilters(); scrollToResultsSmooth(); });
  if (transCb) transCb.addEventListener('change', () => { applyFilters(); scrollToResultsSmooth(); });
  if (sportsCb) sportsCb.addEventListener('change', () => { applyFilters(); scrollToResultsSmooth(); });
  if (adminCb) adminCb.addEventListener('change', () => { applyFilters(); scrollToResultsSmooth(); });

  if (slider) slider.addEventListener('change', () => { saveSessionState(); });

  if (citySel) {
    citySel.addEventListener('change', (e) => {
      const val = e.target.value;
      const cityMap = {
        guwahati: 'Guwahati',
        nagaon: 'Nagaon',
        tezpur: 'Tezpur',
        dibrugarh: 'Dibrugarh',
        jorhat: 'Jorhat',
        silchar: 'Silchar',
        sonitpur: 'Sonitpur'
      };

      const newCity = cityMap[val] || 'Guwahati';
      const oldCity = localStorage.getItem('scholr_selected_city') || 'Guwahati';

      if (newCity !== oldCity) {
        localStorage.setItem('scholr_selected_city', newCity);
        const navSelect = document.getElementById('navbar-city-select');
        if (navSelect) navSelect.value = newCity;

        if (window.ScholrAnalytics) {
          window.ScholrAnalytics.trackEvent('city_changed', { old_city: oldCity, new_city: newCity });
        }

        if (locationInput) {
          locationInput.placeholder = `Search schools in ${newCity}...`;
        }
      }

      applyFilters();
      scrollToResultsSmooth();
    });
  }

  applyBtn.addEventListener('click', async () => {
    await applyFilters();
    scrollToResultsSmooth();
  });

  resetBtn.addEventListener('click', async () => {
    boardSel.value = '';
    feeSel.value   = '';
    if (ratingSel) ratingSel.value = '';
    if (hostelCb) hostelCb.checked = false;
    if (transCb) transCb.checked = false;
    if (sportsCb) sportsCb.checked = false;
    if (adminCb) adminCb.checked = false;
    
    if (citySel) {
      const persistedCity = localStorage.getItem('scholr_selected_city') || 'Guwahati';
      citySel.value = persistedCity.toLowerCase();
    }
    
    slider.value   = 5;
    updateSlider();
    
    // Clear exploration states on reset
    sessionStorage.removeItem(STATE_KEY);
    
    resetBtn.disabled = true;
    await window.Scholr.filterSchools({ city: citySel ? citySel.value : '' }); // Reset to active city
    resetBtn.disabled = false;
  });

  /* ══════════════════════════════════
     Recommendations Group Rendering & State Restoration Hook
     ══════════════════════════════════ */
  let stateRestored = false;

  window.addEventListener('scholr:schools_loaded', async (e) => {
    if (window.ScholrDiscovery) {
      const groups = window.ScholrDiscovery.buildRecommendationGroups(e.detail);
      renderRecommendationGroups(groups);
    }

    const state = getSessionState();
    if (state && !stateRestored) {
      stateRestored = true;
      isRestoring = true;

      // 1. Sync city and navbar selections
      const activeCity = state.selected_city || localStorage.getItem('scholr_selected_city') || 'Guwahati';
      localStorage.setItem('scholr_selected_city', activeCity);
      const navSelect = document.getElementById('navbar-city-select');
      if (navSelect) navSelect.value = activeCity;

      if (locationInput) {
        locationInput.value = state.search_query || '';
        locationInput.placeholder = `Search schools in ${activeCity}...`;
      }

      // 2. Sync selects
      if (citySel) citySel.value = activeCity.toLowerCase();
      if (boardSel) boardSel.value = state.board_filter || '';
      if (feeSel) feeSel.value = state.fee_filter || '';
      if (ratingSel) ratingSel.value = state.rating_filter || '';

      // 3. Sync checkboxes
      if (hostelCb) hostelCb.checked = (state.facilities || []).includes('hostel');
      if (transCb) transCb.checked = (state.facilities || []).includes('transport');
      if (sportsCb) sportsCb.checked = (state.facilities || []).includes('sports');
      if (adminCb) adminCb.checked = state.admissions_open === true;

      // 4. Sync Slider
      if (slider) {
        slider.value = state.distance_slider || 5;
        updateSlider();
      }

      // 5. Query compile
      let filteredData = e.detail; // e.detail is allSchools
      
      if (state.search_query) {
        if (window.ScholrDiscovery) {
          filteredData = window.ScholrDiscovery.smartSearch(filteredData, state.search_query.replace(/[,%]/g, '').trim(), activeCity);
        }
      }

      const facilitiesArr = [];
      if (hostelCb && hostelCb.checked) facilitiesArr.push('hostel');
      if (transCb && transCb.checked) facilitiesArr.push('transport');
      if (sportsCb && sportsCb.checked) facilitiesArr.push('sports');

      const filterParams = {
        city: activeCity,
        board: boardSel.value,
        fee: feeSel.value,
        minRating: ratingSel.value,
        facilities: facilitiesArr,
        admissionsOpen: adminCb ? adminCb.checked : false
      };

      if (window.ScholrDiscovery) {
        filteredData = window.ScholrDiscovery.filterSchools(filteredData, filterParams);
      }

      // 6. Force render restored data
      window.Scholr.renderSchools(filteredData);

      // 7. Track telemetry dispatch
      if (window.ScholrAnalytics) {
        window.ScholrAnalytics.trackResultsRestored(filteredData.length, activeCity);
      }

      // 8. Restore scroll coordinate coordinate without glitches
      if (state.scroll_position > 0) {
        setTimeout(() => {
          window.scrollTo({ top: state.scroll_position, behavior: 'instant' });
          if (window.ScholrAnalytics) {
            window.ScholrAnalytics.trackScrollRestored(state.scroll_position);
          }
          isRestoring = false;
        }, 80);
      } else {
        isRestoring = false;
      }
    }
  });

  function renderRecommendationGroups(groups) {
    const section = document.getElementById('recommendations');
    const container = document.getElementById('recommendation-groups');
    if (!section || !container) return;

    if (!groups || groups.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    let html = '<div class="recommendations__header"><h2 class="recommendations__title">Scholr Recommendations</h2><p class="recommendations__sub">Curated lists based on verified data and focus areas.</p></div>';
    
    groups.forEach(group => {
      const cardsHtml = group.schools.map((school, i) => window.Scholr.buildCardHTML(school, i)).join('');
      
      html += `
        <div class="recommendation-group">
          <h3 class="recommendation-group__title"><i class="fas ${group.icon}"></i> ${group.title}</h3>
          <div class="cards-grid">
            ${cardsHtml}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Wire up events for the newly rendered cards
    container.querySelectorAll('.card__cta').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.ScholrAnalytics) {
          window.ScholrAnalytics.trackRecommendationClicked('group_cta', btn.dataset.id);
        }
        window.location.href = `school.html?id=${btn.dataset.id}`;
      });
    });

    // Save buttons in recommendation area
    container.querySelectorAll('.save-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const isNowSaved = window.Scholr.toggleSave(id);
        btn.innerHTML = isNowSaved ? '★ Saved' : '☆ Save';
        btn.setAttribute('aria-label', isNowSaved ? 'Saved' : 'Save');
      });
    });
  }

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
    if (window.ScholrAnalytics) window.ScholrAnalytics.trackSuggestSchoolOpened();
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
    suggestForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameVal    = document.getElementById('suggest-school-name').value.trim();
      const cityVal    = document.getElementById('suggest-school-city').value.trim();
      const websiteVal = document.getElementById('suggest-school-website').value.trim();

      if (!nameVal || !cityVal) return; // HTML5 required handles UI

      const submitBtn = document.getElementById('suggest-school-submit');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Submitting…';
      submitBtn.disabled = true;

      try {
        if (window.ScholrDB) {
          const { error } = await window.ScholrDB
            .from('school_suggestions')
            .insert({
              school_name: nameVal,
              city:        cityVal,
              website:     websiteVal || null,
              submitted_at: new Date().toISOString(),
            });
          if (error) throw error;
        } else {
          // No DB available — gracefully degrade with a short delay
          await new Promise(r => setTimeout(r, 600));
        }

        submitBtn.textContent = originalText;
        submitBtn.disabled = false;

        suggestForm.style.display = 'none';
        if (suggestSuccess) suggestSuccess.hidden = false;

        if (window.ScholrAnalytics) window.ScholrAnalytics.trackSuggestSchool();
      } catch (err) {
        console.warn('[Scholr] Suggest school error:', err);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        // Show a basic error message inside the form
        let errEl = document.getElementById('suggest-school-error');
        if (!errEl) {
          errEl = document.createElement('p');
          errEl.id = 'suggest-school-error';
          errEl.style.cssText = 'color:#b91c1c;font-size:0.85rem;margin-top:8px;';
          suggestForm.querySelector('.form-actions').after(errEl);
        }
        errEl.textContent = 'Something went wrong. Please try again.';
      }
    });
  }

})();
