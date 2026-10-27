/**
 * SmartServe AI - Transparent Campus NLP & Classification Engine
 * 
 * Implements:
 * 1. Category Classification (Weighted keyword vector space model)
 * 2. Urgency & Priority Scoring (Safety & Disruption heuristic analysis)
 * 3. Duplicate / Similar Complaint Detection (Jaccard & Cosine text similarity)
 * 4. Department Recommendation
 */

// Category Lexicons with TF-IDF style weights
const CATEGORY_LEXICONS = {
  'Wi-Fi & Internet Connectivity': {
    departmentId: 2,
    keywords: {
      'wifi': 3.5, 'wi-fi': 3.5, 'internet': 3.0, 'network': 2.5, 'router': 3.0,
      'lan': 2.5, 'ethernet': 2.5, 'dns': 3.0, 'portal': 2.0, 'disconnect': 2.0,
      'speed': 1.8, 'slow': 1.5, 'bandwidth': 2.5, 'offline': 2.0, 'hotspot': 2.5,
      'ip': 2.0, 'signal': 2.0, 'access point': 3.0, 'ap': 2.0, 'ping': 2.5
    }
  },
  'Classroom Projector & Audio-Visual': {
    departmentId: 2,
    keywords: {
      'projector': 4.0, 'screen': 2.5, 'smart board': 3.5, 'hdmi': 3.0, 'display': 2.5,
      'speaker': 2.5, 'audio': 2.5, 'mic': 3.0, 'microphone': 3.0, 'sound': 2.0,
      'av': 2.5, 'blinking': 2.0, 'lamp': 2.5, 'cable': 1.8, 'presentation': 2.0
    }
  },
  'Electricity & Lighting': {
    departmentId: 1,
    keywords: {
      'light': 2.5, 'tube light': 3.5, 'fan': 2.5, 'ac': 3.0, 'air conditioner': 3.5,
      'switchboard': 3.5, 'switch': 2.0, 'socket': 2.5, 'plug': 2.0, 'power': 2.5,
      'spark': 4.0, 'shock': 4.5, 'tripping': 3.5, 'mcb': 4.0, 'circuit': 3.0,
      'electricity': 3.0, 'wiring': 3.0, 'voltage': 3.0, 'blackout': 3.5
    }
  },
  'Plumbing & Water Coolers': {
    departmentId: 3,
    keywords: {
      'water': 2.5, 'cooler': 3.0, 'dispenser': 3.0, 'leak': 3.5, 'leakage': 3.5,
      'tap': 3.5, 'pipe': 3.0, 'pipeline': 3.0, 'flush': 3.5, 'washroom': 2.5,
      'toilet': 3.0, 'basin': 3.0, 'sink': 3.0, 'drain': 3.5, 'overflow': 3.0,
      'drinking water': 3.5, 'filter': 2.5, 'purifier': 2.5
    }
  },
  'Lab Equipment & PCs': {
    departmentId: 4,
    keywords: {
      'computer': 3.0, 'pc': 3.0, 'desktop': 3.0, 'mouse': 2.5, 'keyboard': 2.5,
      'monitor': 2.5, 'boot': 3.0, 'os': 2.5, 'software': 2.0, 'cpu': 2.5,
      'oscilloscope': 4.0, 'multimeter': 3.5, 'breadboard': 3.0, 'microcontroller': 3.5,
      'lab': 2.0, 'trainer kit': 3.5, 'component': 2.0, 'soldering': 3.0
    }
  },
  'Cleanliness & Waste Disposal': {
    departmentId: 5,
    keywords: {
      'clean': 2.5, 'cleanliness': 3.5, 'dirty': 3.0, 'dust': 2.0, 'garbage': 3.5,
      'trash': 3.5, 'bin': 3.0, 'waste': 3.0, 'smell': 3.0, 'odor': 3.0,
      'stain': 2.5, 'sweeping': 3.0, 'mopping': 3.0, 'hygiene': 3.5, 'unhygienic': 3.5
    }
  },
  'Benches, Doors & Furniture': {
    departmentId: 6,
    keywords: {
      'bench': 3.5, 'desk': 3.0, 'chair': 3.0, 'table': 2.5, 'door': 3.5,
      'window': 3.0, 'latch': 3.5, 'lock': 3.0, 'handle': 2.5, 'whiteboard': 3.0,
      'board': 2.0, 'broken': 2.0, 'hinge': 3.5, 'furniture': 3.0
    }
  }
};

// Urgency scoring indicators
const URGENCY_TRIGGERS = {
  critical: [
    'spark', 'shock', 'smoke', 'fire', 'burning', 'blast', 'flame',
    'electric shock', 'hazard', 'falling', 'flood', 'collapse', 'short circuit'
  ],
  high: [
    'exam', 'test', 'presentation', 'seminar', 'viva', 'immediate', 'urgent',
    'leakage', 'overflow', 'blackout', 'slippery', 'dangerous', 'cannot work', 'broken'
  ],
  medium: [
    'slow', 'noise', 'blinking', 'flickering', 'low', 'dusty', 'uncomfortable'
  ]
};

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

/**
 * 1. Categorization Model
 */
function classifyCategory(title, description) {
  const combinedText = `${title} ${description}`.toLowerCase();
  const tokens = tokenize(combinedText);
  const tokenSet = new Set(tokens);

  let bestCategory = 'Classroom & Civil Maintenance';
  let highestScore = 0;
  let categoryScores = {};

  for (const [category, data] of Object.entries(CATEGORY_LEXICONS)) {
    let score = 0;
    for (const [kw, weight] of Object.entries(data.keywords)) {
      if (kw.includes(' ')) {
        if (combinedText.includes(kw)) score += weight * 1.5;
      } else if (tokenSet.has(kw)) {
        score += weight;
      }
    }
    categoryScores[category] = score;
    if (score > highestScore) {
      highestScore = score;
      bestCategory = category;
    }
  }

  // Calculate normalized confidence score
  const totalScore = Object.values(categoryScores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.min(0.99, Math.max(0.60, Number((highestScore / totalScore * 1.5).toFixed(2)))) : 0.50;

  return {
    category: bestCategory,
    departmentId: CATEGORY_LEXICONS[bestCategory]?.departmentId || 6,
    confidence,
    scores: categoryScores
  };
}

/**
 * 2. Urgency & Priority Model
 */
function assessPriority(title, description, category) {
  const combinedText = `${title} ${description}`.toLowerCase();
  let urgencyScore = 3.0; // Baseline low-medium

  // Check critical keywords
  for (const word of URGENCY_TRIGGERS.critical) {
    if (combinedText.includes(word)) {
      urgencyScore = Math.max(urgencyScore, 9.5);
    }
  }

  // Check high urgency keywords
  for (const word of URGENCY_TRIGGERS.high) {
    if (combinedText.includes(word)) {
      urgencyScore = Math.max(urgencyScore, 7.8);
    }
  }

  // Check medium indicators
  for (const word of URGENCY_TRIGGERS.medium) {
    if (combinedText.includes(word) && urgencyScore < 6.0) {
      urgencyScore = Math.max(urgencyScore, 5.5);
    }
  }

  // Electrical or Water hazards carry intrinsic weight
  if (category === 'Electricity & Lighting' && urgencyScore >= 7.0) urgencyScore = Math.min(10.0, urgencyScore + 1.0);
  if (category === 'Plumbing & Water Coolers' && combinedText.includes('leak')) urgencyScore = Math.min(10.0, urgencyScore + 0.8);

  let priority = 'Medium';
  if (urgencyScore >= 9.0) priority = 'Critical';
  else if (urgencyScore >= 7.0) priority = 'High';
  else if (urgencyScore < 4.0) priority = 'Low';

  return {
    priority,
    urgencyScore: Number(urgencyScore.toFixed(2))
  };
}

/**
 * 3. Text Similarity / Duplicate Detection
 * Uses Jaccard + Cosine Token overlap
 */
function calculateTextSimilarity(textA, textB) {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  // Intersection & Dice/Overlap Coefficient
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  
  // Sørensen–Dice coefficient gives more representative NLP sentence overlap
  const dice = (2 * intersection) / (setA.size + setB.size);
  return Number(dice.toFixed(2));
}

function findSimilarComplaint(newTitle, newDescription, building, existingComplaints) {
  if (!existingComplaints || existingComplaints.length === 0) return null;

  const queryText = `${newTitle} ${newDescription}`;
  let mostSimilar = null;
  let highestScore = 0;

  for (const complaint of existingComplaints) {
    const targetText = `${complaint.title} ${complaint.description}`;
    let score = calculateTextSimilarity(queryText, targetText);

    // Boost score if in identical building / location
    if (complaint.building && building && complaint.building.toLowerCase().trim() === building.toLowerCase().trim()) {
      score = Math.min(1.0, score + 0.15);
    }

    if (score > highestScore && score >= 0.35) {
      highestScore = score;
      mostSimilar = {
        ticketId: complaint.ticket_id,
        title: complaint.title,
        status: complaint.status,
        similarityScore: score
      };
    }
  }

  return mostSimilar;
}

/**
 * Full Pipeline Runner
 */
function analyzeComplaint(title, description, building, existingComplaints = []) {
  const categoryResult = classifyCategory(title, description);
  const priorityResult = assessPriority(title, description, categoryResult.category);
  const duplicateResult = findSimilarComplaint(title, description, building, existingComplaints);

  return {
    suggestedCategory: categoryResult.category,
    suggestedDepartmentId: categoryResult.departmentId,
    confidence: categoryResult.confidence,
    suggestedPriority: priorityResult.priority,
    urgencyScore: priorityResult.urgencyScore,
    duplicateDetection: duplicateResult ? {
      isSimilar: true,
      ticketId: duplicateResult.ticketId,
      similarityScore: duplicateResult.similarityScore,
      message: `Potential duplicate of existing ticket ${duplicateResult.ticketId} (${Math.round(duplicateResult.similarityScore * 100)}% similarity)`
    } : {
      isSimilar: false,
      ticketId: null,
      similarityScore: 0,
      message: 'No duplicate complaints detected'
    }
  };
}

module.exports = {
  classifyCategory,
  assessPriority,
  calculateTextSimilarity,
  findSimilarComplaint,
  analyzeComplaint
};
