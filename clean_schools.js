const fs = require('fs');

/**
 * Cleans and transforms raw school data into a production-ready format for Scholr.
 * 
 * @param {Array} rawData - Array of raw school objects
 * @returns {Array} - Array of cleaned school objects
 */
function cleanSchoolData(rawData) {
  return rawData.map(school => {
    // 1. Normalize Fields
    // Remove extra commas or weird trailing characters
    const cleanName = school.name ? school.name.replace(/,+$/, '').trim() : "Unknown School";
    
    // Shorten location to "Area, City" format
    let rawLocation = school.location || "";
    const locationParts = rawLocation.split(',').map(s => s.trim());
    // Take the first part of the address as the Area
    const area = locationParts[0] || "Unknown Area";
    const shortLocation = `${area}, Guwahati`;

    // 2. Board Standardization
    let board = school.board || "";
    const boardUpper = board.toUpperCase();
    if (boardUpper.includes("CBSE")) {
      board = "CBSE";
    } else if (boardUpper.includes("ICSE") || boardUpper.includes("ISC")) {
      board = "ICSE";
    } else if (boardUpper.includes("IB") || boardUpper.includes("INTERNATIONAL")) {
      board = "IB";
    } else {
      board = "State"; // Unclear falls back to State
    }

    // 3. Fees Conversion
    // Extract numbers after removing commas
    let fees_min = 0;
    let fees_max = 0;
    if (school.approximate_fees) {
      const feeString = school.approximate_fees.replace(/,/g, '');
      const numbers = feeString.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        fees_min = parseInt(numbers[0], 10);
        fees_max = parseInt(numbers[1], 10);
      } else if (numbers && numbers.length === 1) {
        fees_min = parseInt(numbers[0], 10);
        fees_max = parseInt(numbers[0], 10);
      }
    }

    // 4. Tags Cleanup
    let tags = Array.isArray(school.tags) ? school.tags : [];
    tags = tags.map(tag => {
      const lowerTag = tag.toLowerCase().trim();
      if (lowerTag.includes("high academic pressure")) return "academic focus";
      if (lowerTag.includes("fee heavy") || lowerTag.includes("expensive")) return "premium";
      if (lowerTag.includes("cheap")) return "affordable";
      return tag.trim(); // Keep other tags unchanged
    });
    // Remove duplicates
    tags = [...new Set(tags)];

    // 5. Add Required Fields
    // Generate a reasonable rating between 4.0 and 4.7
    const rating = parseFloat((Math.random() * (4.7 - 4.0) + 4.0).toFixed(1));
    const verified = true;
    const description = `${cleanName} is a reputable educational institution located in ${area}, providing quality ${board} board curriculum and focusing on holistic student development.`;

    // 6. Output Format
    return {
      name: cleanName,
      location: shortLocation,
      city: "Guwahati",
      board: board,
      fees_min: fees_min,
      fees_max: fees_max,
      rating: rating,
      tags: tags,
      verified: verified,
      description: description
    };
  });
}

// ------------------------------------------------------------------
// Example Usage
// ------------------------------------------------------------------
if (require.main === module) {
  // Mock input based on the prompt's description
  const exampleInput = [
    {
      "name": "Delhi Public School,,",
      "location": "Ahom Gaon, NH-37, Guwahati, Assam 781035",
      "board": "CBSE",
      "approximate_fees": "₹1,00,000 - ₹1,50,000 per year",
      "tags": ["high academic pressure", "sports", "fee heavy"]
    },
    {
      "name": "Assam Jatiya Bidyalay",
      "location": "Noonmati, Guwahati, Assam",
      "board": "State / NEP aligned",
      "approximate_fees": "₹20,000 to ₹30,000 per year",
      "tags": ["affordable", "cultural"]
    }
  ];

  const cleanedData = cleanSchoolData(exampleInput);
  
  // Output clean JSON
  console.log(JSON.stringify(cleanedData, null, 2));

  // Optionally, to write to a file:
  // fs.writeFileSync('cleaned_schools.json', JSON.stringify(cleanedData, null, 2));
}

module.exports = { cleanSchoolData };
