/* ═══════════════════════════════════════════════════════════
   school-dashboard.js  —  Scholr School Portal Controller
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Ensure Supabase client is available (reusing window.ScholrDB initialized in supabase.js)
  const db = window.ScholrDB;
  if (!db) {
    showToast('error', 'Database connection offline. Please reload the page.');
    console.error('[Scholr] Supabase db client not found on window.');
    return;
  }

  /* ── DOM REFS ────────────────────────────────────────── */
  const viewAuth = document.getElementById('view-auth');
  const viewPending = document.getElementById('view-pending');
  const viewDashboard = document.getElementById('view-dashboard');

  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabRegisterBtn = document.getElementById('tab-register-btn');
  const registerSchoolSelect = document.getElementById('register-school-select');
  const groupManualSchool = document.getElementById('group-manual-school');

  // Pending Screen Refs
  const pendingSchoolName = document.getElementById('pending-school-name');
  const pendingEmail = document.getElementById('pending-email');
  const pendingDesignation = document.getElementById('pending-designation');
  const btnSandboxApprove = document.getElementById('btn-sandbox-approve');
  const pendingLogoutBtn = document.getElementById('pending-logout-btn');

  // Dashboard Sidebar Refs
  const sidebarSchoolName = document.getElementById('sidebar-school-name');
  const sidebarSchoolAvatar = document.getElementById('sidebar-school-avatar');
  const dashLogoutBtn = document.getElementById('dash-logout-btn');
  const dashNavButtons = document.querySelectorAll('.dash-nav-btn');
  const tabViews = document.querySelectorAll('.dash-tab-view');

  // Dashboard Forms & Save action
  const formDashboard = document.getElementById('form-dashboard');
  const btnSaveChanges = document.getElementById('btn-save-changes');
  const saveStatusMsg = document.getElementById('save-status-msg');

  // Dashboard Fields: Profile
  const profName = document.getElementById('prof-name');
  const profBoard = document.getElementById('prof-board');
  const profFees = document.getElementById('prof-fees');
  const profLocation = document.getElementById('prof-location');
  const profCity = document.getElementById('prof-city');
  const profDesc = document.getElementById('prof-desc');
  const profWebsite = document.getElementById('prof-website');
  const profEmail = document.getElementById('prof-email');
  const profPhone = document.getElementById('prof-phone');
  const profMaps = document.getElementById('prof-maps');

  // Dashboard Fields: Facilities
  const facilitiesChipsContainer = document.getElementById('facilities-chips-container');
  const facilitiesChipInput = document.getElementById('facilities-chip-input');

  // Dashboard Fields: Gallery
  const galLogo = document.getElementById('gal-logo');
  const logoPreview = document.getElementById('logo-preview');
  const galleryInputs = document.querySelectorAll('.gallery-input');

  // Dashboard Fields: Admissions
  const admOpen = document.getElementById('adm-open');
  const admStatusLabel = document.getElementById('adm-status-label');
  const admStart = document.getElementById('adm-start');
  const admDeadline = document.getElementById('adm-deadline');
  const admInterview = document.getElementById('adm-interview');
  const admResult = document.getElementById('adm-result');
  const admSession = document.getElementById('adm-session');
  const admNotes = document.getElementById('adm-notes');

  // Dashboard Fields: Verification
  const verBadgeContainer = document.getElementById('ver-badge-container');
  const verLastUpdated = document.getElementById('ver-last-updated');
  const verReviewerNotes = document.getElementById('ver-reviewer-notes');

  /* ── GLOBAL STATE ────────────────────────────────────── */
  let currentUser = null;
  let activeSchoolId = null;
  let activeSchoolRecord = null;
  let activeAdminRecord = null;
  let facilityChipsList = [];

  /* ── INITIALIZATION ─────────────────────────────────── */
  initApp();

  async function initApp() {
    setupAuthUIListeners();
    setupDashboardNavigation();
    setupFacilitiesChipsManager();
    setupGalleryLivePreviews();
    setupAdmissionsSwitch();

    // Check existing session
    const { data: { session } } = await db.auth.getSession();
    handleSessionChanged(session);

    // Listen to Auth State Changes
    db.auth.onAuthStateChange((_event, session) => {
      handleSessionChanged(session);
    });

    // Populate Schools list in dropdown
    fetchUnclaimedSchools();
  }

  /* ── SESSION ROUTING ─────────────────────────────────── */
  async function handleSessionChanged(session) {
    if (!session) {
      currentUser = null;
      activeSchoolId = null;
      activeSchoolRecord = null;
      activeAdminRecord = null;
      switchView('auth');
      return;
    }

    currentUser = session.user;
    showGlobalLoading(true);

    try {
      // 1. Fetch school admin record
      const { data: adminRecord, error: adminErr } = await db
        .from('school_admins')
        .select('*, schools(*)')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (adminErr) throw adminErr;

      if (adminRecord && adminRecord.approved) {
        // Option A: Logged in & Approved!
        activeAdminRecord = adminRecord;
        activeSchoolRecord = adminRecord.schools;
        activeSchoolId = adminRecord.school_id;
        
        populateDashboardUI(activeSchoolRecord);
        switchView('dashboard');
      } else {
        // Option B: Registered but claim pending or no admin row created yet
        // Retrieve their claim status to display friendly pending state
        const { data: claimRecord, error: claimErr } = await db
          .from('school_claim_requests')
          .select('*')
          .eq('official_email', currentUser.email)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (claimErr) throw claimErr;

        if (claimRecord) {
          pendingSchoolName.textContent = claimRecord.school_name;
          pendingEmail.textContent = claimRecord.official_email;
          pendingDesignation.textContent = claimRecord.designation;
          switchView('pending');
        } else {
          // Signed up but haven't submitted a claim yet
          pendingSchoolName.textContent = 'Listing not linked';
          pendingEmail.textContent = currentUser.email;
          pendingDesignation.textContent = 'N/A';
          switchView('pending');
        }
      }
    } catch (err) {
      console.error('[Scholr] Auth routing error:', err);
      showToast('error', 'Error syncing portal state. Please try again.');
    } finally {
      showGlobalLoading(false);
    }
  }

  function switchView(viewName) {
    viewAuth.style.display = viewName === 'auth' ? 'grid' : 'none';
    viewPending.style.display = viewName === 'pending' ? 'flex' : 'none';
    viewDashboard.style.display = viewName === 'dashboard' ? 'grid' : 'none';
  }

  /* ── FETCH DATA HELPERS ───────────────────────────────── */
  async function fetchUnclaimedSchools() {
    try {
      const { data, error } = await db
        .from('schools')
        .select('id, name, city, is_claimed')
        .order('name', { ascending: true });

      if (error) throw error;

      registerSchoolSelect.innerHTML = '<option value="">— Select your school listing —</option>';
      (data || []).forEach(school => {
        // Let them claim even if already claimed in case of testing, but show a nice tag
        const tag = school.is_claimed ? ' [Claimed]' : '';
        const opt = document.createElement('option');
        opt.value = school.id;
        opt.textContent = `${school.name} (${school.city})${tag}`;
        registerSchoolSelect.appendChild(opt);
      });

      // Add a manual fallback
      const optManual = document.createElement('option');
      optManual.value = 'manual';
      optManual.textContent = '+ My school is not listed here';
      registerSchoolSelect.appendChild(optManual);

    } catch (err) {
      console.warn('[Scholr] Error loading schools list:', err);
    }
  }

  /* ── AUTH FORMS ──────────────────────────────────────── */
  function setupAuthUIListeners() {
    tabLoginBtn.addEventListener('click', () => {
      tabLoginBtn.classList.add('active');
      tabRegisterBtn.classList.remove('active');
      formLogin.style.display = 'block';
      formRegister.style.display = 'none';
    });

    tabRegisterBtn.addEventListener('click', () => {
      tabRegisterBtn.classList.add('active');
      tabLoginBtn.classList.remove('active');
      formRegister.style.display = 'block';
      formLogin.style.display = 'none';
    });

    registerSchoolSelect.addEventListener('change', (e) => {
      if (e.target.value === 'manual') {
        groupManualSchool.style.display = 'block';
        document.getElementById('register-school-name').required = true;
      } else {
        groupManualSchool.style.display = 'none';
        document.getElementById('register-school-name').required = false;
      }
    });

    // Login Form Submit
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const pass = document.getElementById('login-password').value;

      if (!email || !pass) {
        showToast('error', 'Please fill in all email and password fields.');
        return;
      }

      const submitBtn = document.getElementById('login-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in…';

      try {
        const { error } = await db.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        showToast('success', 'Successfully logged in!');
      } catch (err) {
        showToast('error', err.message || 'Login failed.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Portal';
      }
    });

    // Registration Form Submit
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const schoolSelectId = registerSchoolSelect.value;
      const manualName = document.getElementById('register-school-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const phone = document.getElementById('register-phone').value.trim();
      const designation = document.getElementById('register-designation').value.trim();
      const password = document.getElementById('register-password').value;

      if (!schoolSelectId || !email || !phone || !designation || !password) {
        showToast('error', 'Please fill in all registration fields.');
        return;
      }

      if (password.length < 6) {
        showToast('error', 'Password must be at least 6 characters.');
        return;
      }

      const schoolNameSelected = schoolSelectId === 'manual' 
        ? manualName 
        : registerSchoolSelect.options[registerSchoolSelect.selectedIndex].text.replace(/ \([^)]+\)/, '').replace(' [Claimed]', '');

      if (schoolSelectId === 'manual' && !manualName) {
        showToast('error', 'Please fill in your school name.');
        return;
      }

      const submitBtn = document.getElementById('register-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registering…';

      try {
        // 1. If school is manual, we'll create the school listing in the db first
        let claimedSchoolId = schoolSelectId;
        if (schoolSelectId === 'manual') {
          const { data: newSchool, error: newSchoolErr } = await db
            .from('schools')
            .insert({
              name: schoolNameSelected,
              city: 'Guwahati',
              verified: false,
              is_claimed: false
            })
            .select()
            .single();

          if (newSchoolErr) throw newSchoolErr;
          claimedSchoolId = newSchool.id;
        }

        // 2. Submit Claim Request
        const { error: claimErr } = await db
          .from('school_claim_requests')
          .insert({
            school_id: claimedSchoolId,
            school_name: schoolNameSelected,
            official_email: email,
            contact_phone: phone,
            designation: designation,
            status: 'pending',
            approved: false
          });

        if (claimErr) throw claimErr;

        // 3. Trigger Supabase Signup
        const { error: signupErr } = await db.auth.signUp({
          email,
          password
        });

        if (signupErr) throw signupErr;

        showToast('success', 'Verification initiated! Account registered.');
        
        // Local state updates instantly or triggers routing
        setTimeout(() => {
          window.location.reload();
        }, 1500);

      } catch (err) {
        showToast('error', err.message || 'Registration failed.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register & Claim Listing';
      }
    });

    // Pending Screen Logout
    pendingLogoutBtn.addEventListener('click', () => handleLogout());
    // Dashboard Logout
    dashLogoutBtn.addEventListener('click', () => handleLogout());

    // Sandbox Bypass Button
    btnSandboxApprove.addEventListener('click', async () => {
      if (!currentUser) return;
      btnSandboxApprove.disabled = true;
      btnSandboxApprove.textContent = 'Approve Bypass Running…';
      
      try {
        const { data, error } = await db.rpc('approve_claim_by_email', { p_email: currentUser.email });
        if (error) throw error;
        
        if (data) {
          showToast('success', '⚡ Sandbox Bypass: Claim approved instantly!');
          // Sync state instantly
          const { data: { session } } = await db.auth.getSession();
          handleSessionChanged(session);
        } else {
          showToast('error', 'Demo Claim request matching email could not be located.');
        }
      } catch (err) {
        console.error(err);
        showToast('error', err.message || 'Sandbox approval fail.');
      } finally {
        btnSandboxApprove.disabled = false;
        btnSandboxApprove.textContent = '⚡ Approve My Claim Instantly (Demo)';
      }
    });
  }

  async function handleLogout() {
    showGlobalLoading(true);
    try {
      await db.auth.signOut();
      showToast('success', 'Logged out successfully.');
    } catch (err) {
      showToast('error', 'Logout failed.');
    } finally {
      showGlobalLoading(false);
    }
  }

  /* ── DASHBOARD NAVIGATION ───────────────────────────── */
  function setupDashboardNavigation() {
    dashNavButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Sidebar active status switch
        dashNavButtons.forEach(b => b.classList.toggle('active', b === btn));

        // Tab Views switch
        tabViews.forEach(v => {
          v.style.display = v.id === targetTab ? 'block' : 'none';
        });
      });
    });
  }

  /* ── DYNAMIC CHIPS MANAGER (FACILITIES) ───────────────── */
  function setupFacilitiesChipsManager() {
    facilitiesChipInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = facilitiesChipInput.value.replace(/,/g, '').trim();
        if (val) {
          addFacilityChip(val);
          facilitiesChipInput.value = '';
        }
      }
    });

    facilitiesChipsContainer.addEventListener('click', (e) => {
      if (e.target.closest('.chip-delete')) {
        const chipEl = e.target.closest('.chip-tag');
        const text = chipEl.querySelector('.chip-text').textContent;
        facilityChipsList = facilityChipsList.filter(c => c !== text);
        chipEl.remove();
      }
    });
  }

  function addFacilityChip(text) {
    const trimmed = text.trim();
    if (!trimmed || facilityChipsList.includes(trimmed)) return;

    facilityChipsList.push(trimmed);
    const chipHtml = `
      <span class="chip-tag">
        <span class="chip-text">${safe(trimmed)}</span>
        <button type="button" class="chip-delete" aria-label="Delete chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </span>
    `;
    facilitiesChipInput.insertAdjacentHTML('beforebegin', chipHtml);
  }

  function clearFacilityChips() {
    facilityChipsList = [];
    facilitiesChipsContainer.querySelectorAll('.chip-tag').forEach(c => c.remove());
  }

  /* ── GALLERY & LOGO LIVE PREVIEWS ────────────────────── */
  function setupGalleryLivePreviews() {
    // Logo change preview
    galLogo.addEventListener('input', () => {
      const url = galLogo.value.trim();
      if (isValidUrl(url)) {
        logoPreview.innerHTML = `<img src="${url}" alt="School Logo">`;
      } else {
        logoPreview.innerHTML = '🏫';
      }
    });

    // Gallery changes preview
    galleryInputs.forEach(input => {
      input.addEventListener('input', () => {
        const idx = input.dataset.index;
        const url = input.value.trim();
        const prevBox = document.getElementById(`gal-prev-${idx}`);
        
        if (isValidUrl(url)) {
          prevBox.innerHTML = `<img src="${url}" alt="Campus Image ${parseInt(idx, 10)+1}">`;
        } else {
          prevBox.innerHTML = '📸';
        }
      });
    });
  }

  function triggerLivePreviewsRefresh() {
    galLogo.dispatchEvent(new Event('input'));
    galleryInputs.forEach(input => input.dispatchEvent(new Event('input')));
  }

  function isValidUrl(str) {
    if (!str) return false;
    return str.startsWith('http://') || str.startsWith('https://');
  }

  /* ── ADMISSIONS TOGGLE SWITCH ───────────────────────── */
  function setupAdmissionsSwitch() {
    admOpen.addEventListener('change', () => {
      admStatusLabel.textContent = admOpen.checked ? 'Admissions Open' : 'Admissions Closed';
      admStatusLabel.style.color = admOpen.checked ? 'var(--clr-dash-brand)' : 'var(--clr-dash-text-pri)';
    });
  }

  /* ── POPULATE FORM FIELD ENTRIES ─────────────────────── */
  function populateDashboardUI(school) {
    sidebarSchoolName.textContent = school.name;
    
    // Profile Fields
    profName.value = school.name || '';
    profBoard.value = school.board || 'CBSE';
    profFees.value = school.fees || '';
    profLocation.value = school.location || '';
    profCity.value = school.city || 'Guwahati';
    profDesc.value = school.description || '';
    profWebsite.value = school.website || '';
    profEmail.value = school.email || '';
    profPhone.value = school.phone || '';
    profMaps.value = school.maps_link || '';

    // Facilities Chips
    clearFacilityChips();
    const facilities = school.facilities || [];
    facilities.forEach(addFacilityChip);

    // Gallery Fields
    galLogo.value = school.logo_url || '';
    const gallery = school.gallery_urls || [];
    for (let i = 0; i < 4; i++) {
      const input = document.getElementById(`gal-url-${i}`);
      if (input) input.value = gallery[i] || '';
    }
    triggerLivePreviewsRefresh();

    if (school.logo_url) {
      sidebarSchoolAvatar.innerHTML = `<img src="${school.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" alt="Logo">`;
    } else {
      sidebarSchoolAvatar.innerHTML = '🏫';
    }

    // Admissions Fields
    admOpen.checked = school.admissions_open === true;
    admOpen.dispatchEvent(new Event('change'));

    admStart.value = school.application_start_date || '';
    admDeadline.value = school.application_deadline || '';
    admInterview.value = school.interview_date || '';
    admResult.value = school.result_date || '';
    admSession.value = school.session_start_date || '';
    admNotes.value = school.admission_notes || '';

    // Verification Fields
    if (window.ScholrTrust) {
      const badgeHtml = window.ScholrTrust.getVerificationBadge(school.verification_level);
      verBadgeContainer.innerHTML = badgeHtml;
      
      const refreshLabel = window.ScholrTrust.formatRelativeTime(school.updated_at || school.last_updated);
      verLastUpdated.textContent = refreshLabel ? `${refreshLabel}` : 'Just now';
    } else {
      verBadgeContainer.innerHTML = `<span class="status-badge status-badge--verified">${school.verification_level || 'Verified'}</span>`;
      verLastUpdated.textContent = 'Just now';
    }

    if (school.data_notes) {
      verReviewerNotes.textContent = school.data_notes;
    } else {
      verReviewerNotes.textContent = 'Listing validated by Scholr Moderation Team. Profile is active.';
    }
  }

  /* ── SUBMIT UPDATE SAVE PROCESS ──────────────────────── */
  formDashboard.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!activeSchoolId) {
      showToast('error', 'Profile context unlinked. Please reload portal.');
      return;
    }

    btnSaveChanges.disabled = true;
    btnSaveChanges.textContent = 'Saving Changes…';
    setSaveMsg('Processing update...', 'var(--clr-dash-brand)');

    // Gather Gallery Inputs
    const galleryUrls = [];
    for (let i = 0; i < 4; i++) {
      const inputVal = document.getElementById(`gal-url-${i}`).value.trim();
      if (inputVal) galleryUrls.push(inputVal);
    }

    // Prepare Updates Payload
    const updates = {
      name: profName.value.trim(),
      board: profBoard.value,
      fees: profFees.value.trim(),
      location: profLocation.value.trim(),
      description: profDesc.value.trim(),
      facilities: facilityChipsList,
      website: profWebsite.value.trim() || null,
      email: profEmail.value.trim() || null,
      phone: profPhone.value.trim() || null,
      maps_link: profMaps.value.trim() || null,
      logo_url: galLogo.value.trim() || null,
      gallery_urls: galleryUrls,
      admissions_open: admOpen.checked,
      application_start_date: admStart.value || null,
      application_deadline: admDeadline.value || null,
      interview_date: admInterview.value || null,
      result_date: admResult.value || null,
      session_start_date: admSession.value || null,
      admission_notes: admNotes.value.trim() || null,
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await db
        .from('schools')
        .update(updates)
        .eq('id', activeSchoolId);

      if (error) throw error;

      showToast('success', '✓ Listing edits published successfully!');
      setSaveMsg('All changes saved and live!', 'var(--clr-dash-success)');
      
      // Update local cache records
      activeSchoolRecord = Object.assign(activeSchoolRecord, updates);
      populateDashboardUI(activeSchoolRecord);

    } catch (err) {
      console.error('[Scholr] Save failed:', err);
      showToast('error', err.message || 'Row Level Security blocked the update.');
      setSaveMsg('Failed to sync. RLS unauthorized.', 'var(--clr-dash-danger)');
    } finally {
      btnSaveChanges.disabled = false;
      btnSaveChanges.textContent = 'Save Dashboard Edits';
      setTimeout(() => {
        setSaveMsg('', '');
      }, 5000);
    }
  });

  function setSaveMsg(text, clr) {
    saveStatusMsg.textContent = text;
    saveStatusMsg.style.color = clr || 'inherit';
  }

  /* ── TOAST NOTIFICATION ──────────────────────────────── */
  function showToast(type, message) {
    const toastBox = document.getElementById('toast-container');
    if (!toastBox) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    
    const icon = type === 'success' 
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    toast.innerHTML = `
      <span>${icon}</span>
      <span>${message}</span>
    `;

    toastBox.appendChild(toast);

    // Fade and delete
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
  }

  function showGlobalLoading(show) {
    const saveBtn = document.getElementById('btn-save-changes');
    if (saveBtn) {
      if (show) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Syncing...';
      } else {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Dashboard Edits';
      }
    }
  }

  function safe(str) {
    return String(str ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

});
