/**
 * Scholr Discovery & Recommendation Module
 * Handles smart search, deterministic recommendations, and advanced filtering.
 */

window.ScholrDiscovery = {
  // ── Smart Search ─────────────────────────────────────────────────────────

  normalizeSearchText(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[^\w\s]/g, '').trim();
  },

  matchSchoolKeywords(school, query) {
    const q = this.normalizeSearchText(query);
    if (!q) return 1;

    let score = 0;
    const name = this.normalizeSearchText(school.name);
    const loc = this.normalizeSearchText(school.location);
    const city = this.normalizeSearchText(school.city);
    const board = this.normalizeSearchText(school.board);

    // Exact or starts-with matches get highest score
    if (name.includes(q)) {
      score += 10;
      if (name.startsWith(q)) score += 5;
    }
    if (loc.includes(q) || city.includes(q)) score += 5;
    if (board === q) score += 5;

    // Partial matches across arrays
    const searchTerms = q.split(' ');
    
    const checkArray = (arr, weight) => {
      if (!arr || !Array.isArray(arr)) return;
      arr.forEach(item => {
        const normalizedItem = this.normalizeSearchText(item);
        searchTerms.forEach(term => {
          if (term.length > 2 && normalizedItem.includes(term)) {
            score += weight;
          }
        });
      });
    };

    checkArray(school.tags, 3);
    checkArray(school.best_for, 4);
    checkArray(school.facilities, 2);

    return score;
  },

  smartSearch(schools, query) {
    if (!query || query.trim() === '') return schools;

    const scored = schools.map(school => {
      return {
        school,
        score: this.matchSchoolKeywords(school, query)
      };
    }).filter(item => item.score > 0);

    // Sort by score descending, then by rating
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.school.rating || 0) - (a.school.rating || 0);
    });

    return scored.map(item => item.school);
  },

  // ── Filtering ──────────────────────────────────────────────────────────

  filterSchools(schools, filters) {
    return schools.filter(school => {
      // Board
      if (filters.board && school.board && school.board.toLowerCase() !== filters.board.toLowerCase()) {
        return false;
      }
      
      // Fee Tier
      if (filters.fee) {
        let feeTier = 'medium';
        if (window.Scholr && window.Scholr.feeTierOf) {
           feeTier = window.Scholr.feeTierOf(school.fees);
        } else {
           // Fallback logic
           const short = (school.fees||'').match(/₹?([\d.]+)(k|L)/i);
           if (short) {
             const v = parseFloat(short[1]) * (short[2].toLowerCase() === 'l' ? 100 : 1);
             feeTier = v < 30 ? 'low' : (v <= 80 ? 'medium' : 'high');
           }
        }
        if (feeTier !== filters.fee) return false;
      }

      // Facilities
      if (filters.facilities && filters.facilities.length > 0) {
        const schoolFacilities = (school.facilities || []).map(f => this.normalizeSearchText(f));
        const hasAll = filters.facilities.every(f => {
          const nf = this.normalizeSearchText(f);
          return schoolFacilities.some(sf => sf.includes(nf));
        });
        if (!hasAll) return false;
      }

      // Minimum Rating
      if (filters.minRating) {
        if (!school.rating || school.rating < parseFloat(filters.minRating)) {
          return false;
        }
      }

      // Admission Status
      if (filters.admissionsOpen) {
        if (school.admissions_open !== true) {
          return false;
        }
      }

      return true;
    });
  },

  // ── Recommendations (Similar Schools) ──────────────────────────────────

  getSimilarSchools(currentSchool, allSchools, limit = 3) {
    if (!currentSchool || !allSchools) return [];

    const scored = allSchools
      .filter(s => s.id !== currentSchool.id)
      .map(school => {
        let score = 0;
        let reasons = [];

        // Same board
        if (school.board === currentSchool.board) {
          score += 5;
          reasons.push('Same board');
        }

        // Similar fee category
        const currentFeeCat = currentSchool.fee_category || (window.Scholr ? window.Scholr.inferFeeCategory(currentSchool.fees) : null);
        const schoolFeeCat = school.fee_category || (window.Scholr ? window.Scholr.inferFeeCategory(school.fees) : null);
        
        if (currentFeeCat && schoolFeeCat && currentFeeCat === schoolFeeCat) {
          score += 4;
          reasons.push('Similar fee range');
        }

        // Nearby location / Same city area
        if (school.city === currentSchool.city) {
          score += 2;
          if (school.location === currentSchool.location) {
             score += 3;
             reasons.push('Nearby location');
          }
        }

        // Overlapping tags / best for
        let sharedFocus = 0;
        const currentBestFor = (currentSchool.best_for || []).map(t => this.normalizeSearchText(t));
        const schoolBestFor = (school.best_for || []).map(t => this.normalizeSearchText(t));
        
        currentBestFor.forEach(t => {
          if (schoolBestFor.includes(t)) sharedFocus++;
        });

        if (sharedFocus > 0) {
          score += (sharedFocus * 2);
          reasons.push('Similar focus');
        }

        return { school, score, reasons };
      });

    // Filter out low scores and sort
    const validMatches = scored.filter(item => item.score > 3);
    validMatches.sort((a, b) => b.score - a.score);

    return validMatches.slice(0, limit);
  },

  getRecommendationReason(reasonsArray) {
    if (!reasonsArray || reasonsArray.length === 0) return 'Recommended for you';
    // Return top 2 reasons max
    return reasonsArray.slice(0, 2).join(' & ');
  },

  // ── Recommendation Groups ──────────────────────────────────────────────

  buildRecommendationGroups(schools) {
    if (!schools || schools.length === 0) return [];

    const groups = [];

    // Group 1: Best Budget-Friendly CBSE
    const budgetCbse = schools.filter(s => {
      const feeCat = s.fee_category || (window.Scholr ? window.Scholr.inferFeeCategory(s.fees) : null);
      return s.board === 'CBSE' && feeCat === 'Budget Friendly' && s.rating >= 4.0;
    }).sort((a, b) => b.rating - a.rating).slice(0, 4);

    if (budgetCbse.length >= 2) {
      groups.push({
        id: 'budget-cbse',
        title: 'Best Budget-Friendly CBSE Schools',
        icon: 'fa-wallet',
        schools: budgetCbse
      });
    }

    // Group 2: Strong Sports Focus
    const sportsSchools = schools.filter(s => {
      const bf = (s.best_for || []).map(t => this.normalizeSearchText(t));
      return bf.some(t => t.includes('sport')) && s.rating >= 4.0;
    }).sort((a, b) => b.rating - a.rating).slice(0, 4);

    if (sportsSchools.length >= 2) {
      groups.push({
        id: 'sports-focus',
        title: 'Strong Sports & Co-curriculars',
        icon: 'fa-basketball-ball',
        schools: sportsSchools
      });
    }

    // Group 3: Highly Rated Academics
    const academicSchools = schools.filter(s => {
      const bf = (s.best_for || []).map(t => this.normalizeSearchText(t));
      return bf.some(t => t.includes('academic') || t.includes('discipline')) && s.rating >= 4.5;
    }).sort((a, b) => b.rating - a.rating).slice(0, 4);

    if (academicSchools.length >= 2) {
      groups.push({
        id: 'top-academics',
        title: 'Recommended for Academics',
        icon: 'fa-book-open',
        schools: academicSchools
      });
    }

    return groups;
  }
};
