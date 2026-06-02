/* ─────────────────────────────────────────────────────────
   contact.js — Scholr Premium Contact Us Workflow System
   ───────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // Inject CSS styles for the contact modal dynamically to ensure modularity
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .contact-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .contact-modal-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }
    
    .contact-modal {
      background: var(--clr-surface, #ffffff);
      border-radius: var(--radius-xl, 22px);
      width: 100%;
      max-width: 480px;
      padding: 32px;
      box-shadow: var(--shadow-lg, 0 20px 60px rgba(0,0,0,.15));
      position: relative;
      transform: translateY(20px) scale(0.95);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      border: 1px solid var(--clr-border, #e5e7eb);
    }
    
    .contact-modal-overlay.active .contact-modal {
      transform: translateY(0) scale(1);
    }
    
    .contact-modal__close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: none;
      border: none;
      font-size: 1.5rem;
      color: var(--clr-text-muted, #9ca3af);
      cursor: pointer;
      line-height: 1;
      padding: 4px;
      border-radius: var(--radius-md, 10px);
      transition: color var(--transition, 0.25s), background var(--transition, 0.25s);
    }
    
    .contact-modal__close:hover {
      color: var(--clr-text-primary, #111827);
      background: var(--clr-bg, #f9fafb);
    }
    
    .contact-modal__title {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--clr-text-primary, #111827);
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }
    
    .contact-modal__sub {
      font-size: 0.95rem;
      color: var(--clr-text-secondary, #6b7280);
      margin-bottom: 24px;
      line-height: 1.5;
    }
    
    .contact-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .contact-form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: left;
    }
    
    .contact-form-label {
      font-size: 0.825rem;
      font-weight: 600;
      color: var(--clr-text-secondary, #6b7280);
      letter-spacing: 0.01em;
    }
    
    .contact-form-input,
    .contact-form-select,
    .contact-form-textarea {
      font-family: var(--font, inherit);
      font-size: 0.9rem;
      color: var(--clr-text-primary, #111827);
      background: var(--clr-bg, #f9fafb);
      border: 1.5px solid var(--clr-border, #e5e7eb);
      border-radius: var(--radius-md, 10px);
      padding: 10px 14px;
      outline: none;
      transition: border-color var(--transition, 0.25s), box-shadow var(--transition, 0.25s), background var(--transition, 0.25s);
      width: 100%;
      box-sizing: border-box;
    }
    
    .contact-form-select {
      appearance: none;
      -webkit-appearance: none;
      padding-right: 36px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      cursor: pointer;
    }
    
    .contact-form-input:focus,
    .contact-form-select:focus,
    .contact-form-textarea:focus {
      border-color: var(--clr-blue-500, #3b82f6);
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
    }
    
    .contact-form-error {
      color: #ef4444;
      font-size: 0.775rem;
      font-weight: 500;
      margin-top: 2px;
      display: none;
    }
    
    .contact-form-group.has-error .contact-form-error {
      display: block;
    }
    
    .contact-form-group.has-error .contact-form-input,
    .contact-form-group.has-error .contact-form-select,
    .contact-form-group.has-error .contact-form-textarea {
      border-color: #ef4444;
      background-color: #fef2f2;
    }
    
    .contact-form-btn {
      width: 100%;
      height: 46px;
      font-weight: 600;
      margin-top: 8px;
      position: relative;
    }
    
    .contact-form-btn .btn-text {
      transition: opacity var(--transition, 0.25s);
    }
    
    .contact-form-btn.loading .btn-text {
      opacity: 0;
    }
    
    .contact-spinner {
      position: absolute;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      left: calc(50% - 10px);
      top: calc(50% - 10px);
      animation: contact-spin 0.8s infinite linear;
      display: none;
    }
    
    .contact-form-btn.loading .contact-spinner {
      display: block;
    }
    
    @keyframes contact-spin {
      to { transform: rotate(360deg); }
    }
    
    .contact-success-state {
      text-align: center;
      padding: 16px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    
    .contact-success-icon-wrap {
      width: 64px;
      height: 64px;
      background: var(--clr-green-50, #f0fdf4);
      color: var(--clr-green-500, #22c55e);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }
    
    .contact-success-icon-wrap svg {
      width: 32px;
      height: 32px;
    }
    
    .contact-success-title {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--clr-text-primary, #111827);
      margin: 0;
      letter-spacing: -0.3px;
    }
    
    .contact-success-text {
      font-size: 0.95rem;
      color: var(--clr-text-secondary, #6b7280);
      margin: 0;
      line-height: 1.6;
    }
  `;
  document.head.appendChild(styleEl);

  let contactModalOverlay = null;

  /**
   * Constructs the Contact Modal overlay and inserts it into the DOM.
   */
  function initContactModal() {
    if (contactModalOverlay) return;

    contactModalOverlay = document.createElement('div');
    contactModalOverlay.className = 'contact-modal-overlay';
    contactModalOverlay.id = 'scholr-contact-modal';
    contactModalOverlay.setAttribute('aria-hidden', 'true');

    contactModalOverlay.innerHTML = `
      <div class="contact-modal" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">
        <button class="contact-modal__close" id="contact-modal-close" aria-label="Close modal">&times;</button>
        
        <div id="contact-form-pane">
          <h2 class="contact-modal__title" id="contact-modal-title">Get in Touch</h2>
          <p class="contact-modal__sub">Have questions or need help? Send us a message and we'll reply shortly.</p>
          
          <form id="scholr-contact-form" class="contact-form" novalidate>
            <div class="contact-form-group" id="group-contact-name">
              <label for="contact-name" class="contact-form-label">Full Name *</label>
              <input type="text" id="contact-name" class="contact-form-input" placeholder="Your name" required>
              <span class="contact-form-error" id="error-contact-name">Please enter your name.</span>
            </div>
            
            <div class="contact-form-group" id="group-contact-email">
              <label for="contact-email" class="contact-form-label">Email Address *</label>
              <input type="email" id="contact-email" class="contact-form-input" placeholder="you@example.com" required>
              <span class="contact-form-error" id="error-contact-email">Please enter a valid email address.</span>
            </div>

            <div class="contact-form-group" id="group-contact-category">
              <label for="contact-category" class="contact-form-label">Category *</label>
              <select id="contact-category" class="contact-form-select" required>
                <option value="" disabled selected>— Select a category —</option>
                <option value="General Question">General Question</option>
                <option value="Admissions Help">Admissions Help</option>
                <option value="School Claim Issue">School Claim Issue</option>
                <option value="Bug Report">Bug Report</option>
                <option value="Feature Suggestion">Feature Suggestion</option>
                <option value="Partnership Inquiry">Partnership Inquiry</option>
              </select>
              <span class="contact-form-error" id="error-contact-category">Please select a category.</span>
            </div>
            
            <div class="contact-form-group" id="group-contact-subject">
              <label for="contact-subject" class="contact-form-label">Subject</label>
              <input type="text" id="contact-subject" class="contact-form-input" placeholder="What is this regarding?">
            </div>
            
            <div class="contact-form-group" id="group-contact-message">
              <label for="contact-message" class="contact-form-label">Message *</label>
              <textarea id="contact-message" class="contact-form-textarea" rows="4" placeholder="How can we support you?" required></textarea>
              <span class="contact-form-error" id="error-contact-message">Please write a message.</span>
            </div>
            
            <button type="submit" class="btn btn--primary contact-form-btn" id="contact-submit-btn">
              <span class="btn-text">Send Message</span>
              <span class="contact-spinner"></span>
            </button>
            <div id="contact-form-general-error" style="color: #ef4444; font-size: 0.825rem; font-weight: 500; text-align: center; display: none; margin-top: 4px;"></div>
          </form>
        </div>
        
        <div id="contact-success-pane" class="contact-success-state" style="display: none;">
          <div class="contact-success-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="contact-success-title">Message Received</h3>
          <p class="contact-success-text">Thanks — we received your message. We'll review your query soon and respond via email.</p>
          <button type="button" class="btn btn--primary" id="contact-success-close-btn" style="width: 100%; margin-top: 8px;">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(contactModalOverlay);

    // Event listeners
    const closeBtn = document.getElementById('contact-modal-close');
    const successCloseBtn = document.getElementById('contact-success-close-btn');
    const form = document.getElementById('scholr-contact-form');

    closeBtn.addEventListener('click', closeContactModal);
    successCloseBtn.addEventListener('click', closeContactModal);
    
    // Close modal on click outside of modal box
    contactModalOverlay.addEventListener('click', function (e) {
      if (e.target === contactModalOverlay) {
        closeContactModal();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && contactModalOverlay.classList.contains('active')) {
        closeContactModal();
      }
    });

    // Form submit listener
    form.addEventListener('submit', handleContactSubmit);
  }

  /**
   * Opens the Contact Modal.
   */
  function openContactModal() {
    initContactModal();
    
    // Reset any previous views & forms
    const formPane = document.getElementById('contact-form-pane');
    const successPane = document.getElementById('contact-success-pane');
    const form = document.getElementById('scholr-contact-form');
    const generalErr = document.getElementById('contact-form-general-error');
    
    if (form) form.reset();
    if (formPane) formPane.style.display = 'block';
    if (successPane) successPane.style.display = 'none';
    if (generalErr) {
      generalErr.style.display = 'none';
      generalErr.textContent = '';
    }
    
    // Remove error classes
    document.querySelectorAll('.contact-form-group').forEach(group => {
      group.classList.remove('has-error');
    });

    // Trigger open and animation
    contactModalOverlay.classList.add('active');
    contactModalOverlay.setAttribute('aria-hidden', 'false');
    
    // Telemetry
    if (window.ScholrAnalytics && window.ScholrAnalytics.trackContactOpened) {
      window.ScholrAnalytics.trackContactOpened();
    }
  }

  /**
   * Closes the Contact Modal.
   */
  function closeContactModal() {
    if (!contactModalOverlay) return;
    contactModalOverlay.classList.remove('active');
    contactModalOverlay.setAttribute('aria-hidden', 'true');
  }

  /**
   * Form submission and database communication.
   */
  async function handleContactSubmit(e) {
    e.preventDefault();
    
    const nameEl = document.getElementById('contact-name');
    const emailEl = document.getElementById('contact-email');
    const categoryEl = document.getElementById('contact-category');
    const subjectEl = document.getElementById('contact-subject');
    const messageEl = document.getElementById('contact-message');
    const submitBtn = document.getElementById('contact-submit-btn');
    const generalErr = document.getElementById('contact-form-general-error');

    const nameVal = nameEl.value.trim();
    const emailVal = emailEl.value.trim();
    const categoryVal = categoryEl.value;
    const subjectVal = subjectEl.value.trim();
    const messageVal = messageEl.value.trim();

    // Client-side validations
    let hasError = false;

    // Validate Name
    if (!nameVal) {
      setErrorState('group-contact-name', true);
      hasError = true;
    } else {
      setErrorState('group-contact-name', false);
    }

    // Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailVal || !emailRegex.test(emailVal)) {
      setErrorState('group-contact-email', true);
      hasError = true;
    } else {
      setErrorState('group-contact-email', false);
    }

    // Validate Category
    if (!categoryVal) {
      setErrorState('group-contact-category', true);
      hasError = true;
    } else {
      setErrorState('group-contact-category', false);
    }

    // Validate Message
    if (!messageVal) {
      setErrorState('group-contact-message', true);
      hasError = true;
    } else {
      setErrorState('group-contact-message', false);
    }

    if (hasError) {
      if (window.ScholrAnalytics && window.ScholrAnalytics.trackContactFailed) {
        window.ScholrAnalytics.trackContactFailed('validation_failed');
      }
      return;
    }

    // Show loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    generalErr.style.display = 'none';
    generalErr.textContent = '';

    try {
      if (window.ScholrDB) {
        const { error } = await window.ScholrDB
          .from('contact_messages')
          .insert({
            name: nameVal,
            email: emailVal,
            category: categoryVal,
            subject: subjectVal || null,
            message: messageVal,
            status: 'open',
            created_at: new Date().toISOString()
          });

        if (error) throw error;
      } else {
        // Fallback demo delay if Supabase client not globally available
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Success sequence
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;

      const formPane = document.getElementById('contact-form-pane');
      const successPane = document.getElementById('contact-success-pane');
      
      if (formPane) formPane.style.display = 'none';
      if (successPane) successPane.style.display = 'flex';

      // Telemetry
      if (window.ScholrAnalytics && window.ScholrAnalytics.trackContactSubmitted) {
        window.ScholrAnalytics.trackContactSubmitted(categoryVal);
      }

    } catch (err) {
      console.error('[Scholr] Contact submission error:', err);
      
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      
      if (generalErr) {
        generalErr.textContent = 'Could not submit your inquiry. Please try again later.';
        generalErr.style.display = 'block';
      }

      // Telemetry
      if (window.ScholrAnalytics && window.ScholrAnalytics.trackContactFailed) {
        window.ScholrAnalytics.trackContactFailed(err.message || 'database_error');
      }
    }
  }

  /**
   * Helper to set/remove error classes.
   */
  function setErrorState(groupId, hasError) {
    const el = document.getElementById(groupId);
    if (!el) return;
    if (hasError) {
      el.classList.add('has-error');
    } else {
      el.classList.remove('has-error');
    }
  }

  // Globally wire click listener delegation on document body
  document.addEventListener('DOMContentLoaded', function () {
    document.body.addEventListener('click', function (e) {
      const trigger = e.target.closest('.contact-us-trigger');
      if (trigger) {
        e.preventDefault();
        openContactModal();
      }
    });
  });

  // Expose triggers globally for direct programmatic open
  window.ScholrContact = {
    open: openContactModal,
    close: closeContactModal
  };

})();
