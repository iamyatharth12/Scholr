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
  const profTransport = document.getElementById('prof-transport');
  const profHostel = document.getElementById('prof-hostel');

  // Dashboard Fields: Facilities
  const facilitiesChipsContainer = document.getElementById('facilities-chips-container');
  const facilitiesChipInput = document.getElementById('facilities-chip-input');

  // Dashboard Fields: Best For (Tags)
  const bestForChipsContainer = document.getElementById('bestfor-chips-container');
  const bestForChipInput = document.getElementById('bestfor-chip-input');

  // Dashboard Fields: Gallery
  const galLogo = document.getElementById('gal-logo');
  const logoPreview = document.getElementById('logo-preview');
  const logoFileInput = document.getElementById('logo-file-input');
  const btnUploadLogo = document.getElementById('btn-upload-logo');
  const btnDeleteLogo = document.getElementById('btn-delete-logo');

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
  let bestForChipsList = [];

  /* ── INITIALIZATION ─────────────────────────────────── */
  initApp();

  async function initApp() {
    setupAuthUIListeners();
    setupDashboardNavigation();
    setupFacilitiesChipsManager();
    setupBestForChipsManager();
    setupAdmissionsSwitch();
    setupGalleryUploads();
    setupCompletenessWatchers();

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
      // Fetch school admin record
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
        const tag = school.is_claimed ? ' [Claimed]' : '';
        const opt = document.createElement('option');
        opt.value = school.id;
        opt.textContent = `${school.name} (${school.city})${tag}`;
        registerSchoolSelect.appendChild(opt);
      });

      // Add manual fallback
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
          // Sync session instantly
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
          calculateCompletenessScore(); // Update score on edit
        }
      }
    });

    facilitiesChipsContainer.addEventListener('click', (e) => {
      if (e.target.closest('.chip-delete')) {
        const chipEl = e.target.closest('.chip-tag');
        const text = chipEl.querySelector('.chip-text').textContent;
        facilityChipsList = facilityChipsList.filter(c => c !== text);
        chipEl.remove();
        calculateCompletenessScore(); // Update score on edit
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

  /* ── DYNAMIC CHIPS MANAGER (BEST FOR) ─────────────────── */
  function setupBestForChipsManager() {
    bestForChipInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = bestForChipInput.value.replace(/,/g, '').trim();
        if (val) {
          addBestForChip(val);
          bestForChipInput.value = '';
          calculateCompletenessScore(); // Update score on edit
        }
      }
    });

    bestForChipsContainer.addEventListener('click', (e) => {
      if (e.target.closest('.chip-delete')) {
        const chipEl = e.target.closest('.chip-tag');
        const text = chipEl.querySelector('.chip-text').textContent;
        bestForChipsList = bestForChipsList.filter(c => c !== text);
        chipEl.remove();
        calculateCompletenessScore(); // Update score on edit
      }
    });
  }

  function addBestForChip(text) {
    const trimmed = text.trim();
    if (!trimmed || bestForChipsList.includes(trimmed)) return;

    bestForChipsList.push(trimmed);
    const chipHtml = `
      <span class="chip-tag bf--default">
        <span class="chip-text">${safe(trimmed)}</span>
        <button type="button" class="chip-delete" aria-label="Delete chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </span>
    `;
    bestForChipsContainer.insertAdjacentHTML('beforebegin', chipHtml);
  }

  function clearBestForChips() {
    bestForChipsList = [];
    bestForChipsContainer.querySelectorAll('.chip-tag').forEach(c => c.remove());
  }

  /* ── ADMISSIONS TOGGLE SWITCH ───────────────────────── */
  function setupAdmissionsSwitch() {
    admOpen.addEventListener('change', () => {
      admStatusLabel.textContent = admOpen.checked ? 'Admissions Open' : 'Admissions Closed';
      admStatusLabel.style.color = admOpen.checked ? 'var(--clr-dash-brand)' : 'var(--clr-dash-text-pri)';
    });
  }

  /* ── REAL-TIME COMPLETENESS WATCHERS ────────────────── */
  function setupCompletenessWatchers() {
    const inputsToWatch = [
      profDesc, profWebsite, profEmail, profPhone, profMaps,
      admStart, admDeadline, admSession, admNotes, admOpen
    ];

    inputsToWatch.forEach(input => {
      if (input) {
        input.addEventListener('input', calculateCompletenessScore);
        input.addEventListener('change', calculateCompletenessScore);
      }
    });
  }

  /* ── PROFILE COMPLETENESS CALCULATION ───────────────── */
  function calculateCompletenessScore() {
    let score = 0;

    // 1. Description (20%)
    const descText = profDesc.value.trim();
    if (descText.length > 50) score += 20;
    else if (descText.length > 0) score += 10;

    // 2. Media Assets (25% total): Logo (10%), Gallery images (15% - 3.75% per image)
    const logoUrlVal = document.getElementById('gal-logo').value.trim();
    if (logoUrlVal) score += 10;

    let galleryCount = 0;
    for (let i = 0; i < 4; i++) {
      const urlInput = document.getElementById(`gal-url-${i}`);
      if (urlInput && urlInput.value.trim()) {
        galleryCount++;
      }
    }
    score += galleryCount * 3.75;

    // 3. Admissions Data (20% total): Toggle (5%), key dates set (10%), notes (5%)
    // Since toggle is active on form load, we add 5%
    score += 5;
    const hasDates = admStart.value || admDeadline.value || admSession.value;
    if (hasDates) score += 10;
    if (admNotes.value.trim().length > 0) score += 5;

    // 4. Facilities (10%) & Best For Tags (5%)
    if (facilityChipsList.length >= 3) score += 10;
    else if (facilityChipsList.length > 0) score += 5;

    if (bestForChipsList.length >= 2) score += 5;
    else if (bestForChipsList.length > 0) score += 2.5;

    // 5. Contact Channels (10% total - 2.5% each)
    if (profWebsite.value.trim()) score += 2.5;
    if (profEmail.value.trim()) score += 2.5;
    if (profPhone.value.trim()) score += 2.5;
    if (profMaps.value.trim()) score += 2.5;

    // 6. Verification Status (10%)
    if (activeSchoolRecord) {
      const tier = activeSchoolRecord.verification_level || 'limited';
      if (tier.toLowerCase().includes('verified')) score += 10;
      else if (tier.toLowerCase().includes('community')) score += 5;
      else score += 2;
    } else {
      score += 2;
    }

    score = Math.round(score);
    if (score > 100) score = 100;

    // Update UI elements
    const completenessScoreEl = document.getElementById('completeness-score');
    const completenessBarEl = document.getElementById('completeness-bar');
    const completenessTierEl = document.getElementById('completeness-tier');
    const completenessTierIconEl = document.getElementById('completeness-tier-icon');

    if (completenessScoreEl) completenessScoreEl.textContent = `${score}%`;
    if (completenessBarEl) {
      completenessBarEl.style.width = `${score}%`;
      
      if (score >= 80) {
        completenessBarEl.style.backgroundColor = 'var(--clr-dash-success)';
        completenessTierEl.textContent = 'Excellent Profile';
        completenessTierEl.style.color = 'var(--clr-dash-success)';
        completenessTierIconEl.textContent = '✅';
      } else if (score >= 50) {
        completenessBarEl.style.backgroundColor = 'var(--clr-dash-brand)';
        completenessTierEl.textContent = 'Good Coverage';
        completenessTierEl.style.color = 'var(--clr-dash-brand)';
        completenessTierIconEl.textContent = 'ℹ️';
      } else {
        completenessBarEl.style.backgroundColor = 'var(--clr-dash-warning)';
        completenessTierEl.textContent = 'Limited Info';
        completenessTierEl.style.color = 'var(--clr-dash-warning)';
        completenessTierIconEl.textContent = '⚠️';
      }
    }

    return score;
  }

  /* ── INTERACTIVE GALLERY UPLOADS (SUPABASE STORAGE) ──── */
  function setupGalleryUploads() {
    // 1. Logo brand upload
    logoPreview.addEventListener('click', () => logoFileInput.click());
    btnUploadLogo.addEventListener('click', () => logoFileInput.click());

    logoFileInput.addEventListener('change', async () => {
      const file = logoFileInput.files[0];
      if (!file) return;

      // Basic size validation (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        showToast('error', 'File size exceeds 5MB limit.');
        return;
      }

      // Show loader
      logoPreview.innerHTML = `
        <div class="upload-loading-overlay">
          <div class="upload-spinner"></div>
          <span class="upload-loading-text">Uploading...</span>
        </div>
      `;
      btnUploadLogo.disabled = true;

      try {
        const ext = file.name.split('.').pop();
        const path = `logos/${activeSchoolId}/logo_${Date.now()}.${ext}`;

        // Upload to bucket
        const { error } = await db.storage
          .from('school-media')
          .upload(path, file, { cacheControl: '3600', upsert: true });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = db.storage
          .from('school-media')
          .getPublicUrl(path);

        // Update hidden inputs and previews
        document.getElementById('gal-logo').value = publicUrl;
        logoPreview.innerHTML = `<img src="${publicUrl}" style="width:100%;height:100%;object-fit:cover;" alt="Logo Preview">`;
        btnDeleteLogo.style.display = 'inline-block';
        
        showToast('success', 'Brand Logo uploaded to storage!');
        calculateCompletenessScore(); // recalculate score

      } catch (err) {
        console.error('[Scholr] Logo upload failed:', err);
        showToast('error', err.message || 'Storage upload blocked.');
        logoPreview.innerHTML = '🏫';
      } finally {
        btnUploadLogo.disabled = false;
      }
    });

    btnDeleteLogo.addEventListener('click', () => {
      document.getElementById('gal-logo').value = '';
      logoPreview.innerHTML = '🏫';
      btnDeleteLogo.style.display = 'none';
      showToast('success', 'Logo unlinked.');
      calculateCompletenessScore(); // recalculate score
    });


    // 2. Gallery 4 images dropzones
    const dropzones = document.querySelectorAll('.upload-dropzone');
    dropzones.forEach(zone => {
      zone.addEventListener('click', (e) => {
        // Prevent click bubbling if delete overlay clicked
        if (e.target.closest('.btn-delete-overlay')) return;
        
        const card = zone.closest('.gallery-card');
        const idx = card.dataset.index;
        document.getElementById(`file-input-${idx}`).click();
      });
    });

    const fileInputs = document.querySelectorAll('.file-input');
    fileInputs.forEach(input => {
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;

        const card = input.closest('.gallery-card');
        const idx = card.dataset.index;
        const prevBox = document.getElementById(`gal-prev-${idx}`);

        if (file.size > 5 * 1024 * 1024) {
          showToast('error', 'File size exceeds 5MB limit.');
          return;
        }

        // Show spinner
        const oldContent = prevBox.innerHTML;
        prevBox.innerHTML = `
          <div class="upload-loading-overlay">
            <div class="upload-spinner"></div>
            <span class="upload-loading-text">Uploading...</span>
          </div>
        `;

        try {
          const ext = file.name.split('.').pop();
          const path = `gallery/${activeSchoolId}/img_${idx}_${Date.now()}.${ext}`;

          // Upload to storage
          const { error } = await db.storage
            .from('school-media')
            .upload(path, file, { cacheControl: '3600', upsert: true });

          if (error) throw error;

          // Fetch public URL
          const { data: { publicUrl } } = db.storage
            .from('school-media')
            .getPublicUrl(path);

          // Update inputs & previews
          document.getElementById(`gal-url-${idx}`).value = publicUrl;
          prevBox.innerHTML = `
            <div class="gallery-image-wrapper">
              <img src="${publicUrl}" style="width:100%;height:100%;object-fit:cover;" alt="Campus Image Preview">
              <button type="button" class="btn-delete-overlay" data-index="${idx}">&times;</button>
            </div>
          `;

          document.getElementById(`btn-del-${idx}`).style.display = 'block';
          showToast('success', `Gallery image #${parseInt(idx,10)+1} uploaded!`);
          calculateCompletenessScore(); // recalculate score

        } catch (err) {
          console.error('[Scholr] Gallery upload failed:', err);
          showToast('error', err.message || 'Gallery upload failed.');
          prevBox.innerHTML = oldContent;
        }
      });
    });

    // Delete handlers on the cards & overlays
    document.body.addEventListener('click', (e) => {
      const delOverlayBtn = e.target.closest('.btn-delete-overlay');
      const delCardBtn = e.target.closest('.btn-delete-gallery-img');

      if (delOverlayBtn || delCardBtn) {
        e.stopPropagation();
        
        const idx = delOverlayBtn ? delOverlayBtn.dataset.index : delCardBtn.id.replace('btn-del-', '');
        const card = document.querySelector(`.gallery-card[data-index="${idx}"]`);
        const prevBox = document.getElementById(`gal-prev-${idx}`);
        const urlInput = document.getElementById(`gal-url-${idx}`);
        const delBtn = document.getElementById(`btn-del-${idx}`);

        // Reset
        urlInput.value = '';
        delBtn.style.display = 'none';

        // Re-render dropzone
        const categorySelect = document.getElementById(`gal-category-${idx}`);
        const categoryLabel = categorySelect.options[categorySelect.selectedIndex].text;
        prevBox.innerHTML = `
          <div class="upload-dropzone" id="dropzone-${idx}">
            <span class="dropzone-icon">📸</span>
            <span class="dropzone-text">Upload ${categoryLabel}</span>
            <span class="dropzone-help">PNG/JPG up to 5MB</span>
          </div>
        `;

        showToast('success', 'Gallery image unlinked.');
        calculateCompletenessScore(); // recalculate score
      }
    });

    // Re-bind dropzone category labels when select option changes
    const categorySelects = document.querySelectorAll('.gallery-category-select');
    categorySelects.forEach(select => {
      select.addEventListener('change', () => {
        const card = select.closest('.gallery-card');
        const idx = card.dataset.index;
        const prevBox = document.getElementById(`gal-prev-${idx}`);
        
        // Only update if there is NO image currently loaded
        if (prevBox.querySelector('.upload-dropzone')) {
          const label = select.options[select.selectedIndex].text;
          prevBox.querySelector('.dropzone-text').textContent = `Upload ${label}`;
        }
      });
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

    // Transport & Hostel checkboxes mapping
    profTransport.checked = school.has_transport === true;
    profHostel.checked = school.has_hostel === true;

    // Facilities Chips
    clearFacilityChips();
    const facilities = school.facilities || [];
    // Ensure Transport/Hostel don't double render as standalone chips if we manage them via checkboxes,
    // but we let them exist and just filter them to render cleanly in chips input
    facilities.forEach(f => {
      if (f.toLowerCase() !== 'transport' && f.toLowerCase() !== 'hostel') {
        addFacilityChip(f);
      }
    });

    // Best For Chips
    clearBestForChips();
    const bestFor = school.best_for || [];
    bestFor.forEach(addBestForChip);

    // Gallery Fields
    document.getElementById('gal-logo').value = school.logo_url || '';
    if (school.logo_url) {
      logoPreview.innerHTML = `<img src="${school.logo_url}" style="width:100%;height:100%;object-fit:cover;" alt="Logo Preview">`;
      btnDeleteLogo.style.display = 'inline-block';
      sidebarSchoolAvatar.innerHTML = `<img src="${school.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" alt="Logo">`;
    } else {
      logoPreview.innerHTML = '🏫';
      btnDeleteLogo.style.display = 'none';
      sidebarSchoolAvatar.innerHTML = '🏫';
    }

    const gallery = school.gallery_urls || [];
    for (let i = 0; i < 4; i++) {
      const urlInput = document.getElementById(`gal-url-${i}`);
      const prevBox = document.getElementById(`gal-prev-${i}`);
      const delBtn = document.getElementById(`btn-del-${i}`);
      const categorySelect = document.getElementById(`gal-category-${i}`);
      
      const currentUrl = gallery[i] || '';
      urlInput.value = currentUrl;

      if (currentUrl) {
        prevBox.innerHTML = `
          <div class="gallery-image-wrapper">
            <img src="${currentUrl}" style="width:100%;height:100%;object-fit:cover;" alt="Campus Image Preview">
            <button type="button" class="btn-delete-overlay" data-index="${i}">&times;</button>
          </div>
        `;
        delBtn.style.display = 'block';
      } else {
        const categoryLabel = categorySelect.options[categorySelect.selectedIndex].text;
        prevBox.innerHTML = `
          <div class="upload-dropzone" id="dropzone-${i}">
            <span class="dropzone-icon">📸</span>
            <span class="dropzone-text">Upload ${categoryLabel}</span>
            <span class="dropzone-help">PNG/JPG up to 5MB</span>
          </div>
        `;
        delBtn.style.display = 'none';
      }
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

    // Calculate dynamic completeness score on load
    calculateCompletenessScore();
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

    // Sync transport & hostel checkbox values to facilities list to keep discoverability intact!
    const synchronizedFacilities = [...facilityChipsList];
    if (profTransport.checked && !synchronizedFacilities.includes('Transport')) {
      synchronizedFacilities.push('Transport');
    }
    if (profHostel.checked && !synchronizedFacilities.includes('Hostel')) {
      synchronizedFacilities.push('Hostel');
    }

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
      facilities: synchronizedFacilities,
      best_for: bestForChipsList,
      has_transport: profTransport.checked,
      has_hostel: profHostel.checked,
      website: profWebsite.value.trim() || null,
      email: profEmail.value.trim() || null,
      phone: profPhone.value.trim() || null,
      maps_link: profMaps.value.trim() || null,
      logo_url: document.getElementById('gal-logo').value.trim() || null,
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

      showToast('success', '✓ Profile updates published successfully!');
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
