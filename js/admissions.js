/**
 * Scholr Admissions Module
 * Handles logic for admission status, countdowns, and timeline rendering.
 */

window.ScholrAdmissions = {
  /**
   * Helper to format a YYYY-MM-DD date string to a readable format (e.g., "15 Oct 2026")
   */
  formatAdmissionDate: function (dateStr) {
    if (!dateStr) return 'TBA';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'TBA';
    
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  },

  /**
   * Returns a boolean indicating if admissions are currently active
   */
  isAdmissionActive: function (school) {
    return school.admissions_open === true;
  },

  /**
   * Calculates the admission status based on dates and the admissions_open flag
   * Returns: 'Admissions Open', 'Opening Soon', 'Closing Soon', 'Applications Closed', or 'Status Unknown'
   */
  getAdmissionStatus: function (school) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (school.admissions_open) {
      if (school.application_deadline) {
        const deadline = new Date(school.application_deadline);
        const diffTime = deadline - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays <= 7) {
          return 'Closing Soon';
        } else if (diffDays < 0) {
          return 'Applications Closed';
        }
      }
      return 'Admissions Open';
    } else {
      if (school.application_start_date) {
        const startDate = new Date(school.application_start_date);
        const diffTime = startDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0 && diffDays <= 30) {
          return 'Opening Soon';
        }
      }
      if (school.application_deadline) {
        const deadline = new Date(school.application_deadline);
        if (deadline < today) {
           return 'Applications Closed';
        }
      }
      return 'Status Unknown';
    }
  },

  /**
   * Generates dynamic countdown or informational text based on dates
   */
  getCountdownText: function (school) {
    const status = this.getAdmissionStatus(school);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (status === 'Admissions Open' || status === 'Closing Soon') {
      if (school.application_deadline) {
        const deadline = new Date(school.application_deadline);
        const diffTime = deadline - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Closes today!';
        if (diffDays === 1) return 'Closes tomorrow!';
        if (diffDays > 0) return `Closes in ${diffDays} days`;
        return 'Deadline passed';
      }
      return 'Currently accepting applications';
    } else if (status === 'Opening Soon') {
      if (school.application_start_date) {
        const startDate = new Date(school.application_start_date);
        const diffTime = startDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) return 'Opens tomorrow!';
        return `Opens in ${diffDays} days`;
      }
      return 'Check back soon';
    } else if (status === 'Applications Closed') {
      return 'Not accepting applications';
    }
    
    return 'Check official website for dates';
  },

  /**
   * Returns a status chip HTML element based on the school's admission status
   */
  renderStatusChip: function (school) {
    const status = this.getAdmissionStatus(school);
    let chipClass = 'status-unknown';
    
    if (status === 'Admissions Open') chipClass = 'status-open';
    else if (status === 'Closing Soon') chipClass = 'status-closing-soon';
    else if (status === 'Opening Soon') chipClass = 'status-opening-soon';
    else if (status === 'Applications Closed') chipClass = 'status-closed';

    const countdownText = this.getCountdownText(school);
    
    return `
      <div class="admission-status-chip ${chipClass}">
        <span class="status-indicator"></span>
        <div class="status-content">
          <span class="status-title">${status}</span>
          <span class="status-countdown">${countdownText}</span>
        </div>
      </div>
    `;
  },

  /**
   * Generates the HTML for the detailed admission timeline component
   */
  renderTimeline: function (school) {
    // If no admission data is present at all, return a smart empty state
    if (
      school.admissions_open === null &&
      !school.application_start_date &&
      !school.application_deadline &&
      !school.interview_date &&
      !school.result_date &&
      !school.session_start_date &&
      !school.admission_notes
    ) {
      return `
        <div class="admission-timeline-container empty-state">
          <h3><i class="fas fa-calendar-alt"></i> Admission Timeline</h3>
          <div class="empty-timeline-message">
            <i class="fas fa-clock"></i>
            <p>School has not published official dates yet.</p>
            <button class="btn-secondary" onclick="document.getElementById('suggest-modal').style.display='flex'">Suggest an Update</button>
          </div>
        </div>
      `;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isPast = (dateStr) => {
      if (!dateStr) return false;
      return new Date(dateStr) < today;
    };

    const isCurrent = (startStr, endStr) => {
        if (!startStr) return false;
        const start = new Date(startStr);
        let end = endStr ? new Date(endStr) : null;
        if(end) {
            return today >= start && today <= end;
        } else {
            return today >= start; // rough check
        }
    }

    const steps = [
      {
        title: 'Applications Open',
        dateStr: school.application_start_date,
        icon: 'fa-envelope-open-text',
        completed: isPast(school.application_start_date),
        active: isCurrent(school.application_start_date, school.application_deadline) && school.admissions_open
      },
      {
        title: 'Application Deadline',
        dateStr: school.application_deadline,
        icon: 'fa-file-signature',
        completed: isPast(school.application_deadline),
        active: false // Deadline is a point in time
      },
      {
        title: 'Interviews / Interactions',
        dateStr: school.interview_date,
        icon: 'fa-comments',
        completed: isPast(school.interview_date),
        active: isCurrent(school.interview_date, school.result_date)
      },
      {
        title: 'Results Announced',
        dateStr: school.result_date,
        icon: 'fa-bullhorn',
        completed: isPast(school.result_date),
        active: isCurrent(school.result_date, school.session_start_date)
      },
      {
        title: 'Session Starts',
        dateStr: school.session_start_date,
        icon: 'fa-school',
        completed: isPast(school.session_start_date),
        active: false
      }
    ];

    let stepsHtml = steps.map(step => {
      let stepClass = 'timeline-step';
      if (step.completed) stepClass += ' completed';
      if (step.active) stepClass += ' active';
      if (!step.dateStr) stepClass += ' pending';

      return `
        <div class="${stepClass}">
          <div class="step-icon">
            <i class="fas ${step.icon}"></i>
          </div>
          <div class="step-content">
            <div class="step-title">${step.title}</div>
            <div class="step-date">${this.formatAdmissionDate(step.dateStr)}</div>
          </div>
        </div>
      `;
    }).join('');

    let notesHtml = '';
    if (school.admission_notes) {
      notesHtml = `
        <div class="admission-notes">
          <i class="fas fa-info-circle"></i>
          <p>${school.admission_notes}</p>
        </div>
      `;
    }

    return `
      <div class="admission-timeline-container" id="admission-timeline" data-school-id="${school.id}">
        <h3><i class="fas fa-calendar-check"></i> Admission Timeline</h3>
        <div class="admission-timeline">
          ${stepsHtml}
        </div>
        ${notesHtml}
      </div>
    `;
  }
};
