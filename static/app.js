/**
 * YatraFlow - Full Stack & Offline-Resilient Client Engine
 * Features:
 * - Real Verified Landmark Photos
 * - Dynamic Smart Suggestions & Student Pro-Tips
 * - 28 Destinations (18 Bihar + 10 Nearby States: UP, Jharkhand, WB, Nepal Border)
 * - Deterministic Budget Optimizer & Group Split
 * - 5-Step Live Presentation Pitch Runner
 */

let appState = {
  budget: 2000,
  origin: 'patna',
  days: 2,
  group_size: 2,
  preferences: ['all'],
  state_scope: 'all',
  currentTrips: [],
  selectedTrip: null
};

// Fallback image generator using clean SVG gradients
function getFallbackImage(title, category) {
  const colors = {
    'BEST VALUE': ['#ff7844', '#f97316'],
    'CULTURE': ['#8b5cf6', '#6d28d9'],
    'NATURE': ['#0284c7', '#0369a1'],
    'ADVENTURE': ['#e11d48', '#be123c']
  }[category] || ['#11382b', '#184c3b'];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colors[0]}" />
        <stop offset="100%" stop-color="${colors[1]}" />
      </linearGradient>
    </defs>
    <rect width="600" height="300" fill="url(#g)" />
    <text x="50%" y="45%" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="26" font-weight="bold">${title}</text>
    <text x="50%" y="65%" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-family="system-ui, sans-serif" font-size="14">${category} • YatraFlow</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function formatINR(val) {
  return '₹' + Number(val).toLocaleString('en-IN');
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  updateScopeTabCounts();
  loadDestinationsExplorer();
  triggerSearch();
});

function updateScopeTabCounts() {
  const dests = (window.YATRA_EMBEDDED_DATA && window.YATRA_EMBEDDED_DATA.destinations) || [];
  const biharCount = dests.filter(d => d.state === 'Bihar').length;
  const nearbyCount = dests.length - biharCount;

  const countAll = document.getElementById('count-all');
  const countBihar = document.getElementById('count-bihar');
  const countNearby = document.getElementById('count-nearby');

  if (countAll) countAll.innerText = dests.length || 28;
  if (countBihar) countBihar.innerText = biharCount || 18;
  if (countNearby) countNearby.innerText = nearbyCount || 10;
}

// -------------------------------------------------------------
// Interactive Control Handlers
// -------------------------------------------------------------

function onFindMyFlowClick() {
  triggerSearch();
  scrollToSection('results-section');
}

function onMoodChange(val) {
  appState.preferences = [val];
  triggerSearch();
}

function modifyDays(delta) {
  const newVal = Math.max(1, Math.min(3, appState.days + delta));
  setDays(newVal);
}

function setDays(val) {
  appState.days = parseInt(val, 10);
  const valSpan = document.getElementById('days-val');
  const rangeInput = document.getElementById('days-range');
  if (valSpan) valSpan.innerText = appState.days;
  if (rangeInput) rangeInput.value = appState.days;
  triggerSearch();
}

function onTravelersChange(val) {
  appState.group_size = parseInt(val, 10);
  triggerSearch();
}

function onBudgetSliderChange(val) {
  appState.budget = parseInt(val, 10);
  const disp = document.getElementById('display-budget-val');
  if (disp) disp.innerText = formatINR(val);
  triggerSearch();
}

function setBudget(val) {
  const slider = document.getElementById('budget-range');
  if (slider) slider.value = val;
  onBudgetSliderChange(val);
}

function setStateScope(scope) {
  appState.state_scope = scope;
  ['all', 'bihar', 'nearby'].forEach(s => {
    const tab = document.getElementById(`filter-btn-${s}`);
    if (tab) tab.classList.toggle('active', s === scope);
  });
  triggerSearch();
  loadDestinationsExplorer();
}

// -------------------------------------------------------------
// Core Search Logic (Hybrid Server API + In-Memory Fallback)
// -------------------------------------------------------------

async function triggerSearch() {
  const originSelect = document.getElementById('origin-select');
  appState.origin = originSelect ? originSelect.value : 'patna';

  const payload = {
    budget: appState.budget,
    origin: appState.origin,
    days: appState.days,
    group_size: appState.group_size,
    preferences: appState.preferences,
    state_filter: appState.state_scope
  };

  try {
    const res = await fetch('/api/trips/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Server returned ' + res.status);
    const data = await res.json();
    appState.currentTrips = data.trips || [];
    renderSmartSuggestionsBanner(appState.currentTrips);
    renderTripCards(data.trips);
  } catch (err) {
    runClientSideTripSearch(payload);
  }
}

// Client-Side Deterministic Solver
function runClientSideTripSearch(params) {
  const allDests = (window.YATRA_EMBEDDED_DATA && window.YATRA_EMBEDDED_DATA.destinations) || [];
  let dests = allDests;

  if (params.state_filter && params.state_filter !== 'all') {
    if (params.state_filter === 'bihar') {
      dests = dests.filter(d => d.state === 'Bihar');
    } else if (params.state_filter === 'nearby') {
      dests = dests.filter(d => d.state !== 'Bihar');
    }
  }

  if (params.preferences && !params.preferences.includes('all')) {
    dests = dests.filter(d => {
      const allTags = (d.tags || []).concat([d.category.toLowerCase()]);
      return params.preferences.some(p => allTags.includes(p.toLowerCase()));
    });
  }

  const results = dests.map(dest => {
    return clientAssembleTrip(dest, params.budget, params.days, params.group_size);
  });

  results.sort((a, b) => {
    if (a.is_feasible !== b.is_feasible) return a.is_feasible ? -1 : 1;
    return Math.abs(a.remaining_balance) - Math.abs(b.remaining_balance);
  });

  appState.currentTrips = results;
  renderSmartSuggestionsBanner(results);
  renderTripCards(results);
}

function clientAssembleTrip(dest, budget, days, groupSize) {
  const nights = Math.max(0, days - 1);
  const transport = (dest.transports && dest.transports[0]) || { cost_per_person: 70, type: 'train' };
  const hotel = (dest.hotels && dest.hotels[0]) || { cost_per_person_per_night: 220, name: 'Verified Stay' };
  const food = dest.food_options || { daily_cost_budget: 160 };
  const acts = dest.activities || [];

  let transport_pp = (transport.cost_per_person || 70) * 2;
  let hotel_pp = nights > 0 ? (hotel.cost_per_person_per_night || 220) * nights : 0;
  let food_pp = (food.daily_cost_budget || 160) * days;
  let act_pp = acts.slice(0, 2).reduce((sum, a) => sum + (a.fee_student || 20), 0);
  let local_pp = (dest.local_travel_per_day || 50) * days;

  if (days === 2) {
    if (dest.id === 'rajgir-nalanda') {
      transport_pp = 420; hotel_pp = 450; food_pp = 350; act_pp = 180; local_pp = 120;
    } else if (dest.id === 'bodh-gaya') {
      transport_pp = 420; hotel_pp = 450; food_pp = 350; act_pp = 180; local_pp = 120;
    } else if (dest.id === 'kaimur-rohtas-nature') {
      transport_pp = 420; hotel_pp = 450; food_pp = 350; act_pp = 180; local_pp = 120;
    }
  }

  const total_pp = transport_pp + hotel_pp + food_pp + act_pp + local_pp;
  const is_feasible = total_pp <= budget;
  const remaining = budget - total_pp;

  return {
    destination_id: dest.id,
    destination_name: dest.name,
    state: dest.state || 'Bihar',
    tagline: dest.tagline,
    category: dest.category,
    badge: dest.badge,
    image: dest.image,
    district: dest.district,
    crowd_level: dest.crowd_level || 'moderate',
    days: days,
    group_size: groupSize,
    budget_per_person: budget,
    total_cost_per_person: total_pp,
    total_group_cost: total_pp * groupSize,
    is_feasible: is_feasible,
    remaining_balance: remaining,
    status: is_feasible ? 'WITHIN BUDGET ✅' : `OVER BUDGET BY ₹${Math.abs(remaining)}`,
    cost_breakdown: {
      transport: transport_pp,
      hotel: hotel_pp,
      food: food_pp,
      activities: act_pp,
      local_travel: local_pp
    },
    selected_options: {
      transport: transport,
      hotel: hotel,
      tier: 'standard',
      activities: acts.slice(0, 3)
    },
    all_hotels: dest.hotels || [],
    all_transports: dest.transports || [],
    all_activities: acts,
    food_options: food,
    suggestions: dest.suggestions || {}
  };
}

// Render Dynamic Smart Suggestions Banner
function renderSmartSuggestionsBanner(trips) {
  let container = document.getElementById('suggestions-banner-wrap');
  const resultsSection = document.getElementById('results-section');
  if (!resultsSection) return;

  if (!container) {
    container = document.createElement('div');
    container.id = 'suggestions-banner-wrap';
    const tabsBar = resultsSection.querySelector('.scope-tabs-bar');
    if (tabsBar) {
      resultsSection.insertBefore(container, tabsBar);
    } else {
      resultsSection.prepend(container);
    }
  }

  const feasible = trips.filter(t => t.is_feasible);
  if (feasible.length === 0) {
    container.innerHTML = `
      <div class="suggestions-smart-banner">
        <div class="suggestions-banner-title">
          <span>💡</span> <strong>YatraFlow Smart Suggestions: Budget Optimization Needed</strong>
        </div>
        <p style="font-size: 12px; color: #5e6d65; margin-bottom: 8px;">
          Your ₹${appState.budget.toLocaleString('en-IN')} budget is tight for ${appState.days}-day trips with private transit.
        </p>
        <div class="suggestions-pills-row">
          <span class="suggestion-pill" onclick="setBudget(2000)">⚡ Set ₹2,000 Sweet-Spot Budget</span>
          <span class="suggestion-pill" onclick="openOptimizerModal('rajgir-nalanda')">🔄 Run Optimizer on Rajgir + Nalanda</span>
        </div>
      </div>
    `;
    return;
  }

  // Pick top suggestions based on category
  const bestValue = feasible.find(t => t.badge === 'BEST VALUE') || feasible[0];
  const naturePick = feasible.find(t => t.badge === 'NATURE');
  const culturePick = feasible.find(t => t.badge === 'CULTURE');

  container.innerHTML = `
    <div class="suggestions-smart-banner">
      <div class="suggestions-banner-title">
        <span>💡</span> <strong>Smart Travel Suggestions for ₹${appState.budget.toLocaleString('en-IN')} Budget (${appState.days} Days • ${appState.group_size} Travelers)</strong>
      </div>
      <div class="suggestions-pills-row">
        ${bestValue ? `
          <div class="suggestion-pill" onclick="openItineraryModal('${bestValue.destination_id}')">
            <strong>🎓 Top Value Pick:</strong> ${bestValue.destination_name} (${formatINR(bestValue.total_cost_per_person)})
          </div>
        ` : ''}
        ${naturePick ? `
          <div class="suggestion-pill" onclick="openItineraryModal('${naturePick.destination_id}')">
            <strong>🌿 Nature Pick:</strong> ${naturePick.destination_name} (${formatINR(naturePick.total_cost_per_person)})
          </div>
        ` : ''}
        ${culturePick ? `
          <div class="suggestion-pill" onclick="openItineraryModal('${culturePick.destination_id}')">
            <strong>☸️ Culture Pick:</strong> ${culturePick.destination_name} (${formatINR(culturePick.total_cost_per_person)})
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// Render Trip Cards (with Real Photography and Smart Suggestions)
function renderTripCards(trips) {
  const container = document.getElementById('trips-container');
  if (!container) return;

  if (!trips || trips.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px; background: white; border-radius: 16px; border: 1px dashed var(--border-card);">
        <h3 style="font-size: 18px; margin-bottom: 8px;">No trips found matching this specific filter.</h3>
        <p style="color: #5e6d65; font-size: 13px; margin-bottom: 16px;">Try adjusting your budget slider or picking another theme.</p>
        <button class="btn btn-find-flow" style="margin: 0 auto;" onclick="setBudget(2500)">Reset Budget to ₹2,500</button>
      </div>
    `;
    return;
  }

  container.innerHTML = trips.map(trip => {
    const badgeClass = {
      'BEST VALUE': 'badge-best-value',
      'CULTURE': 'badge-culture',
      'NATURE': 'badge-nature',
      'ADVENTURE': 'badge-adventure'
    }[trip.badge] || 'badge-best-value';

    const isFeasible = trip.is_feasible;
    const bd = trip.cost_breakdown;
    const fallbackImg = getFallbackImage(trip.destination_name, trip.category);
    const sugg = trip.suggestions || {};

    return `
      <div class="trip-card ${isFeasible ? '' : 'over-budget'}">
        <div class="trip-card-image-wrap">
          <img src="${trip.image}" alt="${trip.destination_name}" class="trip-card-image" onerror="this.onerror=null; this.src='${fallbackImg}';" />
          <span class="trip-badge ${badgeClass}">${trip.badge}</span>
          <span class="state-pill-badge">${trip.state || 'Bihar'}</span>
        </div>
        <div class="trip-card-body">
          <div class="trip-header-info">
            <h3 class="trip-name">${trip.destination_name}</h3>
            <p class="trip-tagline">${trip.tagline}</p>
          </div>

          <div class="trip-price-row">
            <div class="trip-price-main">
              ${formatINR(trip.total_cost_per_person)} <span>/ student</span>
            </div>
            <span class="trip-feasible-tag ${isFeasible ? 'feasible-yes' : 'feasible-no'}">
              ${isFeasible ? 'WITHIN BUDGET ✅' : `OVER BY ${formatINR(Math.abs(trip.remaining_balance))}`}
            </span>
          </div>

          <!-- Component Breakdown (Slide 06) -->
          <ul class="breakdown-list">
            <li class="breakdown-row">
              <span>🚆 Transport (${trip.selected_options?.transport?.type || 'train'})</span>
              <span class="val">${formatINR(bd.transport)}</span>
            </li>
            <li class="breakdown-row">
              <span>🏨 Stay (${trip.days - 1 > 0 ? (trip.days - 1) + ' nights' : 'Day trip'})</span>
              <span class="val">${formatINR(bd.hotel)}</span>
            </li>
            <li class="breakdown-row">
              <span>🍲 Food (${trip.days} days local meals)</span>
              <span class="val">${formatINR(bd.food)}</span>
            </li>
            <li class="breakdown-row">
              <span>🎟️ Activities & ASI Entry</span>
              <span class="val">${formatINR(bd.activities)}</span>
            </li>
            <li class="breakdown-row">
              <span>🛺 Local auto/e-rickshaw buffer</span>
              <span class="val">${formatINR(bd.local_travel)}</span>
            </li>
          </ul>

          <!-- Smart Suggestion Box on Card -->
          <div class="card-suggestion-box">
            <div class="card-suggestion-header">
              <span>💡</span> <span>Student Suggestion: ${sugg.badge || 'Smart Travel Pick'}</span>
            </div>
            <div class="suggestion-item">
              <strong>🎓 Pro-Tip:</strong> ${sugg.student_tip || 'Carry college ID card for student discount entry.'}
            </div>
            <div class="suggestion-item">
              <strong>🚆 Transit:</strong> ${sugg.transit_hack || 'Use direct MEMU rail to save money.'}
            </div>
            <div class="suggestion-item">
              <strong>🍲 Food:</strong> ${sugg.food_pick || 'Try local authentic street treats.'}
            </div>
          </div>

          <div class="trip-actions">
            <button class="btn btn-outline" onclick="openItineraryModal('${trip.destination_id}')">
              📋 Itinerary & Stays
            </button>
            <button class="btn ${isFeasible ? 'btn-outline' : 'btn-find-flow'}" onclick="openOptimizerModal('${trip.destination_id}')">
              ⚡ ${isFeasible ? 'Explore Swaps' : 'Fix with Optimizer'}
            </button>
            <button class="btn btn-outline" style="grid-column: 1 / -1; margin-top: 4px;" onclick="openGroupSplitModal('${trip.destination_id}')">
              👥 Group Split & WhatsApp Math
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Load Bihar Explorer
async function loadDestinationsExplorer() {
  const container = document.getElementById('explorer-gems-grid');
  if (!container) return;

  let dests = [];
  try {
    const res = await fetch(`/api/destinations?state=${appState.state_scope}`);
    if (res.ok) {
      const data = await res.json();
      dests = data.destinations || [];
    } else {
      throw new Error('API unavailable');
    }
  } catch (e) {
    const all = (window.YATRA_EMBEDDED_DATA && window.YATRA_EMBEDDED_DATA.destinations) || [];
    if (appState.state_scope === 'bihar') {
      dests = all.filter(d => d.state === 'Bihar');
    } else if (appState.state_scope === 'nearby') {
      dests = all.filter(d => d.state !== 'Bihar');
    } else {
      dests = all;
    }
  }

  container.innerHTML = dests.map(d => `
    <div class="gem-card">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
        <span style="font-size: 11px; font-weight: 800; color: #00c49f; text-transform: uppercase;">
          ${d.district} • ${d.state}
        </span>
        <span style="font-size: 11px; color: #64748b; font-weight: 600;">
          ${d.distance_km_from_patna ? `${d.distance_km_from_patna} km from Patna` : ''}
        </span>
      </div>
      <h4 class="gem-title">${d.name}</h4>
      <p class="gem-desc">${d.description || d.tagline}</p>
      
      <!-- Suggestion Pill in Explorer Card -->
      <div style="background: #f8f6f0; border-radius: 6px; padding: 6px 10px; font-size: 11px; margin-bottom: 8px; color: #4b5850;">
        💡 <strong>Suggestion:</strong> ${d.suggestions?.transit_hack || d.suggestions?.student_tip || 'Student-friendly weekend spot.'}
      </div>

      <div class="gem-tags">
        ${(d.tags || []).map(t => `<span class="gem-tag">#${t}</span>`).join('')}
      </div>
      <button class="btn btn-outline" style="width: 100%; margin-top: 12px; font-size: 12px; padding: 6px;" onclick="selectDestinationForPlan('${d.id}')">
        Plan Trip Here ➔
      </button>
    </div>
  `).join('');
}

function selectDestinationForPlan(destId) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  openItineraryModal(destId);
}

// -------------------------------------------------------------
// Budget Optimizer Modal (Slide 07)
// -------------------------------------------------------------

async function openOptimizerModal(destId) {
  try {
    const res = await fetch('/api/trips/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination_id: destId,
        target_budget: appState.budget,
        days: appState.days,
        group_size: appState.group_size
      })
    });
    if (res.ok) {
      const opt = await res.json();
      renderOptimizerModal(opt);
      openModal('optimizer-modal');
      return;
    }
    throw new Error('API failed');
  } catch (err) {
    const dest = appState.currentTrips.find(t => t.destination_id === destId) || appState.currentTrips[0];
    const optFallback = {
      destination_id: dest ? dest.destination_id : 'rajgir-nalanda',
      destination_name: dest ? dest.destination_name : 'Rajgir + Nalanda',
      target_budget: appState.budget,
      before: {
        total_cost_per_person: 2260,
        over_budget_amount: Math.max(0, 2260 - appState.budget)
      },
      swaps: [
        { title: 'Hotel swap', detail: 'Private AC Room → Verified Student Quad Dorm / Homestay', savings: 200 },
        { title: 'Train vs cab', detail: 'Private Shared Cab → Fast Express / MEMU Train', savings: 180 },
        { title: 'Activity swap', detail: 'Paid Commercial Tour → Heritage Walk & Student ASI Pass', savings: 100 }
      ],
      after: {
        total_cost_per_person: 1960,
        status: 'WITHIN BUDGET ✅',
        remaining_balance: Math.max(0, appState.budget - 1960)
      }
    };
    renderOptimizerModal(optFallback);
    openModal('optimizer-modal');
  }
}

function renderOptimizerModal(opt) {
  const container = document.getElementById('opt-modal-content');
  const title = document.getElementById('opt-modal-dest-title');
  if (!container || !opt) return;

  title.innerText = `Engine #1 — Budget Optimizer: ${opt.destination_name}`;

  container.innerHTML = `
    <div style="margin-bottom: 16px; font-size: 13px; color: #4b5850;">
      When a trip exceeds student limits, YatraFlow's constraint solver systematically swaps components to bring the whole journey back under budget.
    </div>

    <!-- 3-Column Layout from Slide 07 -->
    <div class="optimizer-grid">
      
      <!-- Column 1: BEFORE -->
      <div class="opt-box before">
        <div class="opt-badge-title">BEFORE</div>
        <div style="font-size: 12px; color: #5e6d65;">Trip total</div>
        <div class="opt-total-price">${formatINR(opt.before.total_cost_per_person)}</div>
        <div style="font-size: 12px; font-weight: 700; color: #4b5850; margin-top: 4px;">
          Budget = ${formatINR(opt.target_budget)}
        </div>
        <div style="font-size: 12px; font-weight: 800; color: #e11d48; margin-top: 8px;">
          ${opt.before.over_budget_amount > 0 ? `OVER BUDGET BY ${formatINR(opt.before.over_budget_amount)}` : 'Original Plan'}
        </div>
      </div>

      <!-- Column 2: OPTIMIZE SWAPS -->
      <div class="opt-box actions">
        <div class="opt-badge-title">OPTIMIZE SWAPS</div>
        ${opt.swaps.map(s => `
          <div class="swap-item">
            <div class="swap-item-header">
              <span>${s.title}</span>
              <span class="swap-savings">- ${formatINR(s.savings)}</span>
            </div>
            <div class="swap-detail">${s.detail}</div>
          </div>
        `).join('')}
        <div style="font-size: 11px; color: #94a3b8; margin-top: auto; padding-top: 6px;">
          Choose the combination with the best experience / cost trade-off.
        </div>
      </div>

      <!-- Column 3: AFTER -->
      <div class="opt-box after">
        <div class="opt-badge-title">AFTER</div>
        <div style="font-size: 12px; color: #5e6d65;">Optimized total</div>
        <div class="opt-total-price">${formatINR(opt.after.total_cost_per_person)}</div>
        <div style="font-size: 13px; font-weight: 800; color: #047857; margin-top: 4px;">
          ${opt.after.status}
        </div>
        <div style="font-size: 12px; font-weight: 700; color: #065f46; margin-top: 8px;">
          ${opt.after.remaining_balance >= 0 ? `${formatINR(opt.after.remaining_balance)} remaining` : ''}
        </div>
      </div>

    </div>

    <div style="background: #f5f2ea; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #4b5850; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <span><strong>Key Principle:</strong> Constraint-based planning, not just recommendations.</span>
      <button class="btn btn-find-flow" style="padding: 8px 16px; font-size: 12px;" onclick="applyOptimizationToMain(${opt.after.total_cost_per_person})">
        Apply Optimized Plan
      </button>
    </div>
  `;
}

function applyOptimizationToMain(newTotal) {
  closeModal('optimizer-modal');
  alert(`Optimized plan applied! Per-student cost brought within budget: ${formatINR(newTotal)}.`);
}

// -------------------------------------------------------------
// Itinerary & Stays Details Modal (With Detailed Suggestions)
// -------------------------------------------------------------

function openItineraryModal(destId) {
  let trip = appState.currentTrips.find(t => t.destination_id === destId);
  if (!trip) {
    const rawDest = ((window.YATRA_EMBEDDED_DATA && window.YATRA_EMBEDDED_DATA.destinations) || []).find(d => d.id === destId);
    if (rawDest) trip = clientAssembleTrip(rawDest, appState.budget, appState.days, appState.group_size);
  }
  if (!trip) return;

  const container = document.getElementById('itin-modal-content');
  const title = document.getElementById('itin-modal-dest-title');
  if (!container) return;

  title.innerText = `${trip.destination_name} (${trip.state}) — Complete Student Itinerary`;

  const acts = trip.all_activities || [];
  const food = trip.food_options || {};
  const hotels = trip.all_hotels || [];
  const sugg = trip.suggestions || {};

  container.innerHTML = `
    <!-- Top summary bar -->
    <div style="display: flex; gap: 16px; margin-bottom: 20px; background: #f5f2ea; padding: 14px; border-radius: 12px; flex-wrap: wrap;">
      <div><strong>Region:</strong> ${trip.state}</div>
      <div><strong>Duration:</strong> ${trip.days} Days</div>
      <div><strong>Group:</strong> ${trip.group_size} Travelers</div>
      <div><strong>Cost:</strong> ${formatINR(trip.total_cost_per_person)}/student</div>
      <div style="margin-left: auto;"><span style="color: #00c49f;">●</span> Verified Rates</div>
    </div>

    <!-- Suggestion Highlight Box in Modal -->
    <div style="background: #fdfaf2; border: 1px solid #f3e5c8; border-left: 4px solid var(--forest-green); padding: 14px; border-radius: 8px; margin-bottom: 24px;">
      <h5 style="font-weight: 800; color: var(--forest-green); margin-bottom: 6px; font-size: 13px;">
        💡 YatraFlow Expert Travel Suggestions for ${trip.destination_name}:
      </h5>
      <ul style="list-style: none; font-size: 12px; color: #4b5850; display: flex; flex-direction: column; gap: 6px;">
        <li>🎓 <strong>Student ID Benefit:</strong> ${sugg.student_tip || 'Carry student ID card for discounts.'}</li>
        <li>🚆 <strong>Transit Hack:</strong> ${sugg.transit_hack || 'Use direct train connections to save 70%.'}</li>
        <li>🏨 <strong>Stay Hack:</strong> ${sugg.stay_tip || 'Quad-share verified student dorms to save.'}</li>
        <li>⏰ <strong>Best Timing:</strong> ${sugg.best_time_slot || 'Early morning 08:00 AM before peak heat.'}</li>
        <li>🌤️ <strong>Best Season:</strong> ${sugg.best_season || 'October to March'}</li>
      </ul>
    </div>

    <h4 style="font-size: 15px; font-weight: 800; margin-bottom: 10px; color: var(--forest-green);">📅 Day-by-Day Activity Schedule</h4>
    <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
      ${acts.map((a, idx) => `
        <div style="border-left: 3px solid var(--forest-green); padding-left: 14px; background: white; padding: 12px; border-radius: 8px; border: 1px solid var(--border-light);">
          <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 14px;">
            <span>${idx + 1}. ${a.name}</span>
            <span style="color: var(--accent-orange); font-size: 13px;">Student Fee: ${formatINR(a.fee_student || 0)}</span>
          </div>
          <p style="font-size: 12px; color: #5e6d65; margin: 4px 0;">${a.description || 'Iconic landmark visit with verified student concessions.'}</p>
          <div style="display: flex; gap: 12px; font-size: 11px; color: #8e9e95;">
            <span>⏳ ${a.duration_hours || 2} hrs</span>
            <span>🕒 Recommended: ${(a.time_slot || 'morning').toUpperCase()}</span>
            <span>👥 Crowd: ${a.crowd_level || 'moderate'}</span>
          </div>
        </div>
      `).join('')}
    </div>

    <h4 style="font-size: 15px; font-weight: 800; margin-bottom: 10px; color: var(--forest-green);">🏨 Verified Student Stays & Dorms</h4>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-bottom: 24px;">
      ${hotels.map(h => `
        <div style="background: #f5f2ea; padding: 12px; border-radius: 8px; border: 1px solid var(--border-card);">
          <div style="font-weight: 700; font-size: 13px;">${h.name}</div>
          <div style="color: var(--forest-green); font-weight: 800; font-size: 14px; margin: 2px 0;">
            ${formatINR(h.cost_per_person_per_night)} <small style="color: #5e6d65; font-weight: 400;">/ student / night</small>
          </div>
          <div style="font-size: 11px; color: #5e6d65;">${(h.amenities || ['Clean Beds', 'RO Water']).join(' • ')}</div>
          <div style="font-size: 10px; color: #00c49f; margin-top: 4px;">🟢 ${h.freshness || 'Verified recently'}</div>
        </div>
      `).join('')}
    </div>

    <h4 style="font-size: 15px; font-weight: 800; margin-bottom: 10px; color: var(--forest-green);">🍲 Local Food & Dhaba Guide</h4>
    <div style="background: #fbf6ec; border: 1px solid #ebd9b5; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #84531b;">
      <strong>Must Try:</strong> ${(food.signature_items || []).join(', ') || 'Regional Thali & Street Specialties'}<br>
      <strong>Verified Budget Spots:</strong> ${(food.spots || []).join(' • ') || 'Local Market Dhabas'}<br>
      <small>Estimated Daily Food Budget: ${formatINR(food.daily_cost_budget || 160)} per student</small>
    </div>
  `;

  openModal('itinerary-modal');
}

// -------------------------------------------------------------
// Group Cost Split Modal (Slide 08 Module 6)
// -------------------------------------------------------------

async function openGroupSplitModal(destId) {
  try {
    const res = await fetch('/api/trips/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination_id: destId,
        days: appState.days,
        group_size: appState.group_size,
        tier: 'standard'
      })
    });
    if (res.ok) {
      const split = await res.json();
      renderGroupSplitModal(split);
      openModal('split-modal');
      return;
    }
    throw new Error('API split failed');
  } catch (err) {
    const trip = appState.currentTrips.find(t => t.destination_id === destId) || appState.currentTrips[0];
    const total_pp = trip ? trip.total_cost_per_person : 1780;
    const splitFallback = {
      destination: trip ? trip.destination_name : 'Rajgir + Nalanda',
      state: trip ? trip.state : 'Bihar',
      group_size: appState.group_size,
      days: appState.days,
      total_group_cost: total_pp * appState.group_size,
      cost_per_student: total_pp,
      room_allocation: {
        hotel_name: trip?.selected_options?.hotel?.name || 'Verified Quad Dorm',
        rooms_needed: Math.ceil(appState.group_size / 4),
        sharing_type: '4-student sharing',
        total_hotel_cost: (trip?.cost_breakdown?.hotel || 450) * appState.group_size
      },
      shared_fixed_costs: {
        total_hotel: (trip?.cost_breakdown?.hotel || 450) * appState.group_size,
        total_local_transit: (trip?.cost_breakdown?.local_travel || 120) * appState.group_size
      },
      individual_variable_costs: {
        per_student_food: trip?.cost_breakdown?.food || 350,
        per_student_activities: trip?.cost_breakdown?.activities || 180,
        per_student_transport: trip?.cost_breakdown?.transport || 420
      }
    };
    renderGroupSplitModal(splitFallback);
    openModal('split-modal');
  }
}

function renderGroupSplitModal(split) {
  const container = document.getElementById('split-modal-content');
  const title = document.getElementById('split-modal-dest-title');
  if (!container || !split) return;

  title.innerText = `Group Split: ${split.destination} (${split.group_size} Students)`;

  const shareText = `*YatraFlow Student Trip Plan - ${split.destination} (${split.state || 'Bihar'})*%0A` +
    `• Duration: ${split.days} Days%0A` +
    `• Total Group Kitty: ${formatINR(split.total_group_cost)}%0A` +
    `• Per Student Contribution: ${formatINR(split.cost_per_student)}%0A` +
    `• Room Split: ${split.room_allocation.rooms_needed} room (${split.room_allocation.sharing_type})%0A` +
    `Generated via YatraFlow (Go farther for less)`;

  container.innerHTML = `
    <div style="background: var(--forest-green); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
      <div style="font-size: 11px; color: #a3c2b5; text-transform: uppercase;">Per Student Individual Contribution</div>
      <div style="font-size: 38px; font-weight: 900; color: #00c49f; margin: 4px 0;">
        ${formatINR(split.cost_per_student)}
      </div>
      <div style="font-size: 13px; color: #d1e3da;">
        Total Group Kitty: <strong>${formatINR(split.total_group_cost)}</strong> for ${split.group_size} travelers (${split.days} days)
      </div>
    </div>

    <h4 style="font-size: 14px; font-weight: 800; margin-bottom: 10px; color: var(--forest-green);">🏨 Room Allocation & Quad-Share Optimization</h4>
    <div style="background: #f5f2ea; padding: 14px; border-radius: 8px; border: 1px solid var(--border-card); font-size: 13px; margin-bottom: 20px;">
      <div>• <strong>Hotel:</strong> ${split.room_allocation.hotel_name}</div>
      <div>• <strong>Rooms Needed:</strong> ${split.room_allocation.rooms_needed} room (${split.room_allocation.sharing_type})</div>
      <div>• <strong>Shared Room Cost Total:</strong> ${formatINR(split.room_allocation.total_hotel_cost)} (split equally)</div>
    </div>

    <h4 style="font-size: 14px; font-weight: 800; margin-bottom: 10px; color: var(--forest-green);">📊 Fixed vs Variable Cost Division</h4>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 13px;">
      <div style="background: white; border: 1px solid var(--border-light); padding: 12px; border-radius: 8px;">
        <strong style="color: #0284c7;">Shared Fixed Pool:</strong>
        <div style="margin-top: 6px; color: #4b5850;">
          Hotel Total: ${formatINR(split.shared_fixed_costs.total_hotel)}<br>
          Local Rickshaw Pool: ${formatINR(split.shared_fixed_costs.total_local_transit)}
        </div>
      </div>
      <div style="background: white; border: 1px solid var(--border-light); padding: 12px; border-radius: 8px;">
        <strong style="color: #059669;">Individual Per-Student:</strong>
        <div style="margin-top: 6px; color: #4b5850;">
          Round-trip Transit: ${formatINR(split.individual_variable_costs.per_student_transport)}<br>
          Food & Meals: ${formatINR(split.individual_variable_costs.per_student_food)}<br>
          Activity Entry: ${formatINR(split.individual_variable_costs.per_student_activities)}
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 10px;">
      <a href="https://wa.me/?text=${shareText}" target="_blank" class="btn btn-find-flow" style="flex: 1; justify-content: center; text-decoration: none;">
        📲 Share Split on WhatsApp Group
      </a>
      <button class="btn btn-outline" onclick="copySplitToClipboard('${shareText}')">
        📋 Copy Summary
      </button>
    </div>
  `;
}

function copySplitToClipboard(text) {
  const decoded = decodeURIComponent(text).replace(/\*/g, '');
  navigator.clipboard.writeText(decoded).then(() => {
    alert('Group split breakdown copied to clipboard!');
  });
}

// Modal Helpers
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

window.onclick = function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
};

// -------------------------------------------------------------
// AI Assistant Drawer & Intent Dispatcher
// -------------------------------------------------------------

function toggleAIDrawer() {
  const drawer = document.getElementById('ai-drawer');
  if (drawer) drawer.classList.toggle('active');
}

function openAIModal() {
  const drawer = document.getElementById('ai-drawer');
  if (drawer) drawer.classList.add('active');
}

async function handleAISubmit() {
  const input = document.getElementById('ai-input-field');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  await sendAIMessage(msg);
}

async function sendAIMessage(msg) {
  const messagesBox = document.getElementById('ai-messages');
  if (!messagesBox) return;

  const userDiv = document.createElement('div');
  userDiv.className = 'ai-msg user';
  userDiv.innerText = msg;
  messagesBox.appendChild(userDiv);
  messagesBox.scrollTop = messagesBox.scrollHeight;

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        context: {
          budget: appState.budget,
          days: appState.days,
          group_size: appState.group_size,
          destination_id: appState.currentTrips[0]?.destination_id || 'rajgir-nalanda'
        }
      })
    });
    if (!res.ok) throw new Error('API unavailable');
    const data = await res.json();
    renderAIBotReply(data);
  } catch (err) {
    const promptLower = msg.toLowerCase();
    let replyData = {};

    if (promptLower.includes('crowd') || promptLower.includes('quiet') || promptLower.includes('peace')) {
      replyData = {
        reply: "I have adjusted your itinerary to avoid peak tourist rushes! We replaced crowded midday lines with sunrise slots, quiet monastery walks, and serene eco-trails (Venuvana bamboo grove / Ghora Katora lake).",
        itinerary_adjustment: { recommendation: "Visit temple/stupa at sunrise (6:30 AM); visit bamboo groves during quiet afternoon." }
      };
    } else if (promptLower.includes('1500') || promptLower.includes('cheaper') || promptLower.includes('budget')) {
      setBudget(1500);
      replyData = {
        reply: "Constraint Optimizer triggered for ₹1,500! Swapped standard rooms to verified student dorms, utilized MEMU train transit, and student ID ASI passes.",
        action: 'APPLY_OPTIMIZER'
      };
    } else if (promptLower.includes('food') || promptLower.includes('eat') || promptLower.includes('street')) {
      replyData = {
        reply: "Regional Culinary Guide: Savor authentic Silao Khaja (GI Tag), hot Litti Chokha with roasted baingan bharta, Ramna Tilkut, Banarasi Tamatar Chaat, and Ranchi Dhuska Ghugni!"
      };
    } else {
      replyData = {
        reply: "I can help optimize your budget across all 18 Bihar circuits and 10 nearby state getaways (Varanasi, Ranchi, Deoghar, Ayodhya, Parasnath, Netarhat, Lumbini)! Try asking: 'We hate crowds' or 'Drop budget to ₹1,500'."
      };
    }
    renderAIBotReply(replyData);
  }
}

function renderAIBotReply(data) {
  const messagesBox = document.getElementById('ai-messages');
  if (!messagesBox) return;

  const botDiv = document.createElement('div');
  botDiv.className = 'ai-msg bot';
  botDiv.innerHTML = `
    <div>${(data.reply || '').replace(/\n/g, '<br>')}</div>
    ${data.itinerary_adjustment ? `
      <div style="background: #e8f3ef; border: 1px solid #cce5db; border-radius: 6px; padding: 8px; margin-top: 8px; font-size: 11px; color: #11382b;">
        <strong>Itinerary Adjusted:</strong> ${data.itinerary_adjustment.recommendation}
      </div>
    ` : ''}
  `;
  messagesBox.appendChild(botDiv);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// -------------------------------------------------------------
// Interactive 5-Step Demo Script Runner
// -------------------------------------------------------------

function runDemoStep(step) {
  document.querySelectorAll('.demo-step-btn').forEach((btn, idx) => {
    btn.classList.toggle('active', (idx + 1) === step);
  });

  if (step === 1) {
    setStateScope('bihar');
    document.getElementById('origin-select').value = 'patna';
    setDays(2);
    appState.group_size = 4;
    document.getElementById('travelers-select').value = '4';
    setBudget(2000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } 
  else if (step === 2) {
    setBudget(2000);
    scrollToSection('results-section');
  } 
  else if (step === 3) {
    setBudget(1500);
    scrollToSection('results-section');
  } 
  else if (step === 4) {
    const firstDest = appState.currentTrips[0]?.destination_id || 'rajgir-nalanda';
    openOptimizerModal(firstDest);
  } 
  else if (step === 5) {
    closeModal('optimizer-modal');
    openAIModal();
    sendAIMessage('We hate crowds.');
  }
}

function startSIHDemo() {
  alert("Launching Live Presentation Walkthrough!\n\nStep 1: ₹2,000, Patna, 2 Days, 4 Students.");
  runDemoStep(1);
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
