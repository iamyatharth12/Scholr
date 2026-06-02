/**
 * Scholr Premium Location Selector & Geolocation Engine
 * Upgraded with deliberate selection, radio checkmarks, modal footers,
 * search filters, geocoding Nominatim, and proximity fallbacks.
 */

(function () {
  'use strict';

  // ── Supported Cities & Metadata ──────────────────────────────────────────
  const SUPPORTED_CITIES = [
    { name: 'Guwahati', count: 9, lat: 26.1445, lon: 91.7362, aliases: ['kamrup', 'guwahati metro', 'noonmati', 'narangi', 'khanapara'] },
    { name: 'Nagaon', count: 7, lat: 26.3475, lon: 92.6841, aliases: ['nowgong', 'nagaon district'] },
    { name: 'Tezpur', count: 4, lat: 26.6338, lon: 92.7926, aliases: ['tezpur district', 'army camp tezpur'] },
    { name: 'Dibrugarh', count: 3, lat: 27.4728, lon: 94.9120, aliases: ['dibrugarh district', 'dibru'] },
    { name: 'Jorhat', count: 4, lat: 26.7509, lon: 94.2037, aliases: ['jorhat district', 'afs jorhat'] },
    { name: 'Silchar', count: 3, lat: 24.8333, lon: 92.7789, aliases: ['cachar', 'silchar district', 'barak valley'] },
    { name: 'Sonitpur', count: 1, lat: 26.6800, lon: 92.8500, aliases: ['balipara', 'sonitpur district'] }
  ];

  // Temporary selected city within the modal session
  let tempSelectedCity = null;

  // ── Core Location Algorithms ──────────────────────────────────────────────

  /**
   * Normalizes any input city string to match one of our supported cities.
   * Resolves aliases and returns the canonical city name or null if unsupported.
   */
  function normalizeCity(cityStr) {
    if (!cityStr) return null;
    const clean = cityStr.toLowerCase().trim();

    for (const city of SUPPORTED_CITIES) {
      if (clean === city.name.toLowerCase()) return city.name;
      // Match aliases
      for (const alias of city.aliases) {
        if (clean.includes(alias) || alias.includes(clean)) return city.name;
      }
      // Match substring
      if (clean.includes(city.name.toLowerCase())) return city.name;
    }
    return null;
  }

  /**
   * Calculates proximity and returns the closest supported city name
   */
  function getNearestCity(lat, lon) {
    let nearest = 'Guwahati';
    let minDistance = Infinity;

    for (const city of SUPPORTED_CITIES) {
      const dx = lat - city.lat;
      const dy = lon - city.lon;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDistance) {
        minDistance = dist;
        nearest = city.name;
      }
    }
    return nearest;
  }

  // ── Geolocation Reverse Lookup Nominatim ──────────────────────────────────

  /**
   * reverse-geocodes coordinate pair using OpenStreetMap Nominatim
   */
  async function reverseGeocode(lat, lon) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
        headers: { 'Accept-Language': 'en' }
      });
      if (!response.ok) throw new Error('OSM Reverse Geocoding failed');
      const data = await response.json();
      
      if (data && data.address) {
        const address = data.address;
        return address.city || address.town || address.village || address.county || address.state_district || null;
      }
      return null;
    } catch (e) {
      console.warn('[Scholr Geolocation] Reverse geocoder fetch failed:', e);
      return null;
    }
  }

  // ── Modal UI Lazy Builder ───────────────────────────────────────────────

  function injectModalHTML() {
    if (document.getElementById('location-modal')) return;

    const overlay = document.createElement('div');
    overlay.className = 'location-modal-overlay';
    overlay.id = 'location-modal';
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = `
      <div class="location-modal" role="dialog" aria-modal="true" aria-labelledby="location-modal-title">
        <button class="location-modal__close" id="location-modal-close" aria-label="Close modal">&times;</button>
        <h2 class="location-modal__title" id="location-modal-title">Select your city</h2>
        <p class="location-modal__sub">Find schools and compare local admission choices near you.</p>
        
        <button class="btn btn--ghost location-modal__detect-btn" id="location-modal-detect">
          <svg class="detect-btn__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
          </svg>
          <span>Use My Location</span>
        </button>
        
        <div class="location-modal__search-wrap">
          <svg class="location-modal__search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" id="location-modal-search" class="location-modal__search" placeholder="Search cities in Assam...">
        </div>
        
        <div class="location-modal__city-list" id="location-modal-city-list">
          <!-- Generated dynamically -->
        </div>
        
        <div class="location-modal__alert" id="location-modal-alert" hidden>
          <span class="location-alert__icon">📍</span>
          <div class="location-alert__text">
            <span class="location-alert__title" id="location-alert-title">Outside our exact coverage?</span>
            <span class="location-alert__sub" id="location-alert-sub">Automatically showing nearest supported city.</span>
          </div>
        </div>

        <div class="location-modal__footer">
          <button class="btn btn--ghost" id="location-modal-cancel">Cancel</button>
          <button class="btn btn--primary" id="location-modal-apply">Apply City</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    wireModalEvents();
  }

  function openLocationModal() {
    injectModalHTML();
    const modal = document.getElementById('location-modal');
    if (!modal) return;
    
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Set temp selected city to the currently active city
    tempSelectedCity = localStorage.getItem('scholr_selected_city') || 'Guwahati';

    // Clear search
    const searchInput = document.getElementById('location-modal-search');
    if (searchInput) searchInput.value = '';
    
    renderCityGrid('');
    updateApplyButtonState();
    
    // Hide any previous alert toasts
    const alertBanner = document.getElementById('location-modal-alert');
    if (alertBanner) alertBanner.hidden = true;
  }

  function closeLocationModal() {
    const modal = document.getElementById('location-modal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function updateApplyButtonState() {
    const applyBtn = document.getElementById('location-modal-apply');
    if (!applyBtn) return;
    applyBtn.disabled = !tempSelectedCity;
  }

  function renderCityGrid(query = '') {
    const cityList = document.getElementById('location-modal-city-list');
    if (!cityList) return;

    const cleanQuery = query.toLowerCase().trim();

    const filtered = SUPPORTED_CITIES.filter(city => {
      return city.name.toLowerCase().includes(cleanQuery) || 
             city.aliases.some(alias => alias.includes(cleanQuery));
    });

    if (filtered.length === 0) {
      cityList.innerHTML = `<p class="location-modal__empty">No supported cities found matching "${query}"</p>`;
      return;
    }

    cityList.innerHTML = filtered.map(city => {
      const isActive = tempSelectedCity && city.name.toLowerCase() === tempSelectedCity.toLowerCase();
      
      // Premium selected indicator design (✓ checked circle vs ○ empty circle)
      const indicatorHTML = isActive 
        ? `<span class="city-card__radio active">✓</span>`
        : `<span class="city-card__radio"></span>`;

      return `
        <div class="location-modal__city-card ${isActive ? 'active' : ''}" data-city="${city.name}" tabindex="0" role="button">
          <div style="display: flex; align-items: center; gap: 14px; flex: 1;">
            ${indicatorHTML}
            <div class="city-card__details">
              <span class="city-card__name">${city.name}</span>
              <span class="city-card__count">${city.count} verified school${city.count !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach card action triggers
    cityList.querySelectorAll('.location-modal__city-card').forEach(card => {
      // 1. Single click: just highlights selection visually
      card.addEventListener('click', () => {
        tempSelectedCity = card.dataset.city;
        renderCityGrid(query);
        updateApplyButtonState();
      });

      // 2. Double click: instantly applies and closes
      card.addEventListener('dblclick', () => {
        tempSelectedCity = card.dataset.city;
        changeGlobalCity(tempSelectedCity);
        closeLocationModal();
      });

      // Keyboard focus selection controls
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          // Enter: instantly apply
          e.preventDefault();
          tempSelectedCity = card.dataset.city;
          changeGlobalCity(tempSelectedCity);
          closeLocationModal();
        } else if (e.key === ' ') {
          // Space: just select inside list
          e.preventDefault();
          tempSelectedCity = card.dataset.city;
          renderCityGrid(query);
          updateApplyButtonState();
        }
      });
    });
  }

  // ── Event Handlers & Geolocation Coordination ────────────────────────────

  function wireModalEvents() {
    const modal = document.getElementById('location-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('location-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeLocationModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeLocationModal();
    });

    // Modal footer Cancel button click dismisses
    const cancelBtn = document.getElementById('location-modal-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeLocationModal);

    // Modal footer Apply button click commits changes
    const applyBtn = document.getElementById('location-modal-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (tempSelectedCity) {
          changeGlobalCity(tempSelectedCity);
          closeLocationModal();
        }
      });
    }

    // Search filter typing listener
    const searchInput = document.getElementById('location-modal-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        renderCityGrid(e.target.value);
      });
    }

    // Geolocation detection trigger
    const detectBtn = document.getElementById('location-modal-detect');
    if (detectBtn) {
      detectBtn.addEventListener('click', () => triggerLocationLookup(detectBtn));
    }
  }

  /**
   * Reusable geolocator resolver with Nominatim geocoding and closest proximity coordinates checks
   */
  function triggerLocationLookup(triggerButton) {
    if (!navigator.geolocation) {
      showModalAlert('Geolocation unsupported', 'Your browser does not support coordinate tracking.');
      return;
    }

    const originalHTML = triggerButton.innerHTML;
    triggerButton.disabled = true;
    triggerButton.innerHTML = `
      <span class="location-spinner"></span>
      <span>Detecting location...</span>
    `;

    // Hide previous alerts
    const alertBanner = document.getElementById('location-modal-alert');
    if (alertBanner) alertBanner.hidden = true;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        if (window.ScholrAnalytics) {
          window.ScholrAnalytics.trackEvent('geolocation_used', { status: 'success' });
        }

        // 1. Attempt OSM reverse geocoding lookup
        const detectedName = await reverseGeocode(lat, lon);
        const normalized = normalizeCity(detectedName);

        if (normalized) {
          // Success: highlights the normalized city inside the modal
          tempSelectedCity = normalized;
          renderCityGrid('');
          updateApplyButtonState();
          
          triggerButton.innerHTML = originalHTML;
          triggerButton.disabled = false;
          
          // Instantly highlight and allow them to review/Apply, or auto-apply! 
          // Let's instantly commit geocoded location since they actively clicked "Detect"
          changeGlobalCity(normalized);
          closeLocationModal();
          return;
        }

        // 2. Proximity Fallback: outside boundaries, identify closest supported city
        const nearestCity = getNearestCity(lat, lon);
        tempSelectedCity = nearestCity;

        // Display proximity fallback warning banner inside the modal
        const alertTitle = document.getElementById('location-alert-title');
        const alertSub = document.getElementById('location-alert-sub');
        if (alertTitle && alertSub) {
          alertTitle.textContent = `Showing nearest city: ${nearestCity}`;
          alertSub.textContent = detectedName 
            ? `We detected "${detectedName}" which is outside our coverage area.` 
            : `Detected coordinates outside our coverage area.`;
        }

        if (alertBanner) {
          alertBanner.hidden = false;
          alertBanner.style.animation = 'slideInAlert 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        }

        if (window.ScholrAnalytics) {
          window.ScholrAnalytics.trackEvent('fallback_city_shown', { 
            detected_city: detectedName || 'unknown_coordinates', 
            showing_fallback: nearestCity 
          });
        }

        // Re-render city list and enable Apply
        renderCityGrid('');
        updateApplyButtonState();

        triggerButton.innerHTML = originalHTML;
        triggerButton.disabled = false;
      },
      (err) => {
        console.warn('[Scholr Geolocation] Geolocation error:', err.message);
        showModalAlert('Could not detect location', 'Please select your city manually from the list below.');
        triggerButton.innerHTML = originalHTML;
        triggerButton.disabled = false;

        if (window.ScholrAnalytics) {
          window.ScholrAnalytics.trackEvent('geolocation_used', { status: 'denied_or_failed' });
        }
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  }

  function showModalAlert(title, sub) {
    const alertBanner = document.getElementById('location-modal-alert');
    const alertTitle = document.getElementById('location-alert-title');
    const alertSub = document.getElementById('location-alert-sub');
    
    if (alertBanner && alertTitle && alertSub) {
      alertTitle.textContent = title;
      alertSub.textContent = sub;
      alertBanner.hidden = false;
    }
  }

  // ── Global Synchronization & Page Redirection ─────────────────────────────

  function changeGlobalCity(cityName) {
    const oldCity = localStorage.getItem('scholr_selected_city') || 'Guwahati';
    if (cityName === oldCity) return;

    localStorage.setItem('scholr_selected_city', cityName);
    syncLocationUI(cityName);

    // Track analytics
    if (window.ScholrAnalytics) {
      window.ScholrAnalytics.trackEvent('city_changed', { old_city: oldCity, new_city: cityName });
    }

    // 1. Check if we are on explore page
    const cityFilter = document.getElementById('city-filter');
    if (cityFilter) {
      cityFilter.value = cityName.toLowerCase();
      // Dispatch change event to trigger app.js re-filtering and auto-scroll
      cityFilter.dispatchEvent(new Event('change'));
    } else {
      // 2. Redirect to explore listings from detail/dashboard pages for visual feedback
      const currentPath = window.location.pathname;
      if (!currentPath.includes('index.html') && currentPath !== '/' && !currentPath.endsWith('/Scholr/')) {
        window.location.href = 'index.html#schools-section';
      }
    }
  }

  function syncLocationUI(cityName) {
    const textEl = document.getElementById('navbar-current-city');
    if (textEl) textEl.textContent = cityName;

    const locInput = document.getElementById('location-input');
    if (locInput) locInput.placeholder = `Search schools in ${cityName}...`;
    
    const hiddenSelect = document.getElementById('navbar-city-select');
    if (hiddenSelect) hiddenSelect.value = cityName;
  }

  // ── Document Initialization ──────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Sync active chip text from localStorage on DOM Paint
    const currentCity = localStorage.getItem('scholr_selected_city') || 'Guwahati';
    syncLocationUI(currentCity);

    // 2. Wire navbar chip click
    const locationChip = document.getElementById('navbar-location-chip');
    if (locationChip) {
      locationChip.addEventListener('click', openLocationModal);
      locationChip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLocationModal();
        }
      });
    }

    // 3. Connect the hero geolocator ("Use My Location" in explore bar)
    const heroDetectBtn = document.getElementById('use-location-btn');
    if (heroDetectBtn) {
      // Intercept and bind
      heroDetectBtn.replaceWith(heroDetectBtn.cloneNode(true));
      const newHeroBtn = document.getElementById('use-location-btn');
      newHeroBtn.addEventListener('click', () => {
        triggerHeroLocationLookup(newHeroBtn);
      });
    }

    // 4. Delegate click on empty state triggers
    document.body.addEventListener('click', (e) => {
      if (e.target.closest('.change-city-empty-trigger')) {
        e.preventDefault();
        openLocationModal();
      }
    });
  });

  function triggerHeroLocationLookup(buttonEl) {
    if (!navigator.geolocation) {
      const locInput = document.getElementById('location-input');
      if (locInput) locInput.value = 'Geolocation not supported';
      return;
    }

    const originalHTML = buttonEl.innerHTML;
    buttonEl.disabled = true;
    buttonEl.innerHTML = `
      <span class="location-spinner"></span>
      Detecting…
    `;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        if (window.ScholrAnalytics) {
          window.ScholrAnalytics.trackEvent('geolocation_used', { status: 'success' });
        }

        const detectedName = await reverseGeocode(lat, lon);
        const normalized = normalizeCity(detectedName);
        const finalCity = normalized || getNearestCity(lat, lon);

        // Save city preference
        changeGlobalCity(finalCity);
        
        // Show success in search input
        const locInput = document.getElementById('location-input');
        if (locInput) {
          locInput.value = normalized 
            ? `${detectedName} (detected)` 
            : `${finalCity} (nearest detected)`;
        }

        buttonEl.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Location set`;
        buttonEl.disabled = false;

        // If fallback coordinates proximity check happened, popup modal selector to show toast warnings clearly
        if (!normalized) {
          openLocationModal();
          
          const alertBanner = document.getElementById('location-modal-alert');
          const alertTitle = document.getElementById('location-alert-title');
          const alertSub = document.getElementById('location-alert-sub');
          if (alertBanner && alertTitle && alertSub) {
            alertTitle.textContent = `Showing nearest city: ${finalCity}`;
            alertSub.textContent = detectedName 
              ? `We detected "${detectedName}" which is outside our coverage area.` 
              : `Detected coordinates outside our coverage area.`;
            alertBanner.hidden = false;
            alertBanner.style.animation = 'slideInAlert 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
          }
        }
      },
      () => {
        buttonEl.innerHTML = originalHTML;
        buttonEl.disabled = false;
        const locInput = document.getElementById('location-input');
        if (locInput) locInput.placeholder = 'Could not detect location. Select manually.';
      },
      { timeout: 7000 }
    );
  }

  // ── Public API Exports ────────────────────────────────────────────────────
  window.ScholrLocation = {
    open: openLocationModal,
    close: closeLocationModal,
    normalize: normalizeCity,
    getNearest: getNearestCity,
    changeCity: changeGlobalCity
  };

})();
