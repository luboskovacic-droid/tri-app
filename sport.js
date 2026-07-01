// ==========================================
// GLOBÁLNE NASTAVENIA A REAKTÍVNY STAV
// ==========================================

function getBioProfile() {
    try {
        const raw = localStorage.getItem('tri_user_bio_v1');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        console.warn('Nepodarilo sa načítať bio profil:', e);
        return null;
    }
}

function getDailyKcalTarget() {
    const bio = getBioProfile();
    if (!bio) return 2000;

    const weight = Number(bio.weight) || 70;
    const height = Number(bio.height) || 175;
    const age = Number(bio.age) || 30;
    const sex = bio.sex === 'female' ? 'female' : 'male';
    const restHr = Number(bio.resthr) || 60;
    const maxHr = Number(bio.maxhr) || 0;

    const bmr = sex === 'female'
        ? (10 * weight) + (6.25 * height) - (5 * age) - 161
        : (10 * weight) + (6.25 * height) - (5 * age) + 5;

    let activityFactor = 1.2;
    if (maxHr > 0 && restHr > 0) {
        const hrReserve = maxHr - restHr;
        activityFactor += Math.min(0.25, hrReserve / 400);
    }
    if (restHr < 55) activityFactor += 0.05;
    if (restHr > 75) activityFactor += 0.05;

    return Math.round(bmr * activityFactor);
}

function getAthleteWeight() {
    const bio = getBioProfile();
    return Math.max(45, Number(bio?.weight) || 70);
}

function getDayDifference(fromDate, targetDate) {
    const from = new Date(`${fromDate}T00:00:00`);
    const target = new Date(`${targetDate}T00:00:00`);
    return Math.round((target - from) / (1000 * 60 * 60 * 24));
}

function getSportCarbSlots(sport) {
    const carbload = Number(sport.carbload) || 0;
    const sugarTarget = Number(sport.sugarTarget) || 0;
    if (!carbload) return [];

    if (Array.isArray(sport.carbDistribution) && sport.carbDistribution.length) {
        return sport.carbDistribution.map(slot => ({
            offset: Number(slot.offset) || 0,
            pct: Number(slot.pct) || 0,
            carbs: Math.max(0, Number(slot.carbs) || 0),
            sugar: Math.max(0, Number(slot.sugar) || 0)
        }));
    }

    const sharePrevDay = Number(sport.carbSharePrevDay) || 30;
    const prevDayCarbs = Math.round(carbload * sharePrevDay / 100);
    const eventDayCarbs = Math.max(0, carbload - prevDayCarbs);
    const prevDaySugar = Math.round(sugarTarget * sharePrevDay / 100);
    const eventDaySugar = Math.max(0, sugarTarget - prevDaySugar);
    return [
        { offset: -1, pct: sharePrevDay, carbs: prevDayCarbs, sugar: prevDaySugar },
        { offset: 0, pct: 100 - sharePrevDay, carbs: eventDayCarbs, sugar: eventDaySugar }
    ];
}

function getCarbloadBonusForDate(date) {
    const sportsStore = Storage.get(STORAGE_KEYS.SPORTS);
    let totalBonus = 0;

    Object.entries(sportsStore).forEach(([sportDate, items]) => {
        if (!Array.isArray(items)) return;

        items.forEach((sport) => {
            const diff = getDayDifference(date, sportDate);
            getSportCarbSlots(sport).forEach(slot => {
                if (diff === Math.abs(slot.offset)) totalBonus += slot.carbs;
            });
        });
    });

    return totalBonus;
}

function getSugarTargetForDate(date) {
    const sportsStore = Storage.get(STORAGE_KEYS.SPORTS);
    let totalSugar = 0;

    Object.entries(sportsStore).forEach(([sportDate, items]) => {
        if (!Array.isArray(items)) return;

        items.forEach((sport) => {
            const diff = getDayDifference(date, sportDate);
            getSportCarbSlots(sport).forEach(slot => {
                if (diff === Math.abs(slot.offset)) totalSugar += slot.sugar;
            });
        });
    });

    return totalSugar;
}

function getTrainingContextForDate(date) {
    const sportsStore = Storage.get(STORAGE_KEYS.SPORTS);
    const items = sportsStore[date] || [];
    if (!Array.isArray(items) || !items.length) return { type: 'rest', label: 'Voľno', items: [] };
    const hasStrength = items.some(item => item.template === 'fitko' || item.intensityKey === 'strength');
    const hasRace = items.some(item => item.intensityKey === 'race' || item.template === 'triathlon' || item.template === 'duathlon');
    const hasHigh = items.some(item => item.intensityKey === 'high' || Number(item.carbload) > 120);
    if (hasRace) return { type: 'race', label: 'Výkon/súťaž', items };
    if (hasHigh) return { type: 'high', label: 'Vysoká záťaž', items };
    if (hasStrength) return { type: 'strength', label: 'Fitko/sila', items };
    return { type: 'endurance', label: 'Tréning', items };
}

function getMacroTargetsForDate(date) {
    const weight = getAthleteWeight();
    const context = getTrainingContextForDate(date);
    const carbloadBonusGrams = getCarbloadBonusForDate(date);
    const sugarTargetGrams = getSugarTargetForDate(date);
    let protein = Math.round(weight * 1.8);
    let carbs = Math.round(weight * 3.0) + carbloadBonusGrams;
    let fat = Math.round(weight * 0.8);

    if (context.type === 'strength') {
        protein = Math.round(weight * 2.0);
        carbs = Math.round(weight * 2.4) + carbloadBonusGrams;
        fat = Math.round(weight * 0.9);
    } else if (context.type === 'high' || context.type === 'race') {
        protein = Math.round(weight * 1.7);
        carbs = Math.round(weight * 3.5) + carbloadBonusGrams;
        fat = Math.round(weight * 0.55);
    } else if (context.type === 'rest') {
        protein = Math.round(weight * 1.8);
        carbs = Math.round(weight * 2.2);
        fat = Math.round(weight * 0.9);
    }

    const macroKcal = (protein * 4) + (carbs * 4) + (fat * 9);
    const baseKcal = getDailyKcalTarget() + (carbloadBonusGrams * KCAL_PER_GRAM_CARB);

    return {
        kcal: Math.round(Math.max(baseKcal, macroKcal)),
        p: protein,
        c: carbs,
        f: fat,
        sugar: sugarTargetGrams,
        context
    };
}

function getHydrationTargetsForDate(date) {
    const weight = getAthleteWeight();
    const context = getTrainingContextForDate(date);
    const minutes = context.items.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
    const min = Math.round((weight * 30) + (minutes * 6));
    const max = Math.round((weight * 45) + (minutes * 10));
    return { min, max };
}

function getFoodStrategyForDate(date) {
    const targets = getMacroTargetsForDate(date);
    const context = targets.context;
    if (context.type === 'race' || context.type === 'high') {
        return 'Pred výkonom: low-fat, low-fiber, high-carb. Cukry drž v oknách podľa carbload plánu.';
    }
    if (context.type === 'strength') {
        return 'Fitko: viac bielkovín, sacharidy okolo tréningu, tuky mimo okna pred tréningom.';
    }
    if (context.type === 'rest') {
        return 'Voľno: drž bielkoviny, sacharidy nižšie, cukry len podľa jedál.';
    }
    return 'Tréning: sacharidy pred/po výkone, tuk a vlákninu radšej mimo tréningové okno.';
}

function buildCarbloadPlanForDate(date) {
    const sportsStore = Storage.get(STORAGE_KEYS.SPORTS);
    let bestPlan = null;
    let bestDiff = Infinity;

    Object.entries(sportsStore).forEach(([sportDate, items]) => {
        if (!Array.isArray(items)) return;

        items.forEach((sport) => {
            const diff = getDayDifference(date, sportDate);
            const slots = getSportCarbSlots(sport);

            slots.forEach((slot) => {
                if (diff !== Math.abs(slot.offset)) return;
                const candidate = {
                    title: sport.title || 'Tréning',
                    startTime: sport.startTime || '08:00',
                    carbload: Number(sport.carbload) || 0,
                    carbs: slot.carbs,
                    sugar: slot.sugar,
                    protein: Number(sport.proteinTarget) || 0,
                    intensityLabel: sport.intensityLabel || 'Intenzita podľa zón',
                    kind: slot.offset < 0 ? 'prev' : 'event',
                    label: slot.offset < 0
                        ? `Dnes (${slot.pct || 0}% carbloadu, ${Math.abs(slot.offset)} dni pred výkonom)`
                        : `Dnes (${slot.pct || 0}% v deň výkonu)`
                };

                if (Math.abs(diff) < bestDiff) {
                    bestPlan = candidate;
                    bestDiff = Math.abs(diff);
                }
            });
        });
    });

    return bestPlan;
}

function formatMinutesToTime(minutes) {
    const safe = Math.max(0, Math.min(24 * 60, minutes));
    const hh = String(Math.floor(safe / 60)).padStart(2, '0');
    const mm = String(safe % 60).padStart(2, '0');
    return `${hh}:${mm}`;
}

function parseTimeToMinutes(value) {
    if (!value) return 8 * 60;
    const [hh = '08', mm = '00'] = String(value).split(':');
    return Number(hh) * 60 + Number(mm);
}

function buildMealTimesForPlan(plan) {
    if (!plan) return [];

    if (plan.kind === 'prev') {
        const total = plan.carbs;
        return [
            { time: '10:00', grams: Math.round(total * 0.35) },
            { time: '15:00', grams: Math.round(total * 0.35) },
            { time: '20:00', grams: Math.max(1, total - Math.round(total * 0.7)) }
        ];
    }

    const total = plan.carbs;
    const startMinutes = parseTimeToMinutes(plan.startTime);
    return [
        { time: formatMinutesToTime(startMinutes - 180), grams: Math.max(1, Math.round(total * 0.2)) },
        { time: formatMinutesToTime(startMinutes - 120), grams: Math.max(1, Math.round(total * 0.35)) },
        { time: formatMinutesToTime(startMinutes - 60), grams: Math.max(1, Math.round(total * 0.25)) },
        { time: formatMinutesToTime(startMinutes - 30), grams: Math.max(1, total - Math.round(total * 0.8)) }
    ].filter(slot => slot.grams > 0);
}

function renderCarbloadPlanCard(date) {
    const summaryEl = DOM.get('carbload-plan-summary');
    const timeEl = DOM.get('carbload-plan-times');
    const plan = buildCarbloadPlanForDate(date);

    if (!plan) {
        if (summaryEl) summaryEl.textContent = 'Žiadny plán carbloadu pre tréningom.';
        if (timeEl) timeEl.innerHTML = '';
        return;
    }

    const mealTimes = buildMealTimesForPlan(plan);
    const carbs = plan.carbs;
    const kcal = carbs * KCAL_PER_GRAM_CARB;

    if (summaryEl) {
        summaryEl.innerHTML = `${plan.label}: <strong>${carbs}g sacharidov</strong>, z toho cukry <strong>${plan.sugar || 0}g</strong> (${kcal} kcal)<br><span style="font-size:12px;color:#718096;">${plan.intensityLabel}${plan.protein ? ` · po výkone bielkoviny ${plan.protein}g` : ''}</span>`;
    }

    if (timeEl) {
        const sugarRatio = carbs > 0 ? (Number(plan.sugar) || 0) / carbs : 0;
        timeEl.innerHTML = mealTimes.map(slot => `<div><strong>${slot.time}</strong> — ${slot.grams}g sacharidov, cukry max ${Math.round(slot.grams * sugarRatio)}g</div>`).join('');
    }
}

const BASE_TARGETS = Object.freeze({ kcal: 2000, p: 150, c: 200, f: 65 });
const KCAL_PER_GRAM_CARB = 4;
const STORAGE_KEYS = Object.freeze({
    FOOD: 'pwa_food_calendar',
    SPORTS: 'pwa_sports_calendar'
});

// Pomocná funkcia pre lokálny ISO dátum (odolný voči časovým pásmam)
const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// JEDINÝ ZDROJ PRAVDY (State Management)
const AppState = {
    _selectedDate: getTodayString(),
    _listeners: [],

    get selectedDate() {
        return this._selectedDate;
    },

    set selectedDate(newDate) {
        if (this._selectedDate === newDate) return;
        this._selectedDate = newDate;
        this.notify();
    },

    subscribe(callback) {
        this._listeners.push(callback);
    },

    notify() {
        this._listeners.forEach(callback => callback(this._selectedDate));
    }
};

// Bezpečné a rýchle IO operácie
const Storage = {
    get(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || {};
        } catch (e) {
            console.error(`Chyba čítania úložiska pre kľúč "${key}":`, e);
            return {};
        }
    },
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error(`Chyba zápisu úložiska pre kľúč "${key}":`, e);
        }
    }
};

// Cache DOM elementov, aby sme ich nehľadali pri každom prekreslení
const DOM = {
    cache: {},
    get(id) {
        if (!this.cache[id]) this.cache[id] = document.getElementById(id);
        return this.cache[id];
    },
    getSelector(selector) {
        if (!this.cache[selector]) this.cache[selector] = document.querySelector(selector);
        return this.cache[selector];
    }
};

// ==========================================
// PREPÍNANIE SKLADIÍST (Tabs)
// ==========================================
function switchTab(viewId, btn) {
    if (!btn) return;
    
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    const targetView = DOM.get(`view-${viewId}`);
    if (targetView) targetView.classList.add('active');
    
    btn.classList.add('active');
    if (viewId === 'sports') btn.classList.add('sports-tab');

    if (viewId === 'home') initDashboard();
    if (viewId === 'food' && typeof renderFoodPresets === 'function') renderFoodPresets();
}

// ==========================================
// CENTRALIZOVANÁ INICIALIZÁCIA DASHBOARDU
// ==========================================
function initDashboard() {
    const date = AppState.selectedDate;

    // 1. Agregácia stravy cez n-rozmerný reduce s elimináciou nulových chýb
    const foodTotals = (Storage.get(STORAGE_KEYS.FOOD)[date] || []).reduce((acc, item) => {
        acc.kcal += Number(item.kcal) || 0;
        acc.p += Number(item.p) || 0;
        acc.c += Number(item.c) || 0;
        acc.sugar += Math.min(Number(item.c) || 0, Math.max(0, Number(item.sugar) || 0));
        acc.f += Number(item.f) || 0;
        return acc;
    }, { kcal: 0, p: 0, c: 0, sugar: 0, f: 0 });

    // 2. Dynamické ciele podľa hmotnosti a typu dňa
    const macroTargets = getMacroTargetsForDate(date);
    const dynamicCarbTarget = macroTargets.c;
    const dynamicKcalTarget = macroTargets.kcal;
    const remainingKcal = dynamicKcalTarget - Math.round(foodTotals.kcal);

    // 4. Ultra-bezpečný render do UI (XSS imunita)
    const elRemaining = DOM.get('kcalRemaining');
    if (elRemaining) elRemaining.textContent = remainingKcal.toLocaleString('sk-SK');
    
    const elTargetKcal = DOM.getSelector('.circle-inner span:last-child');
    if (elTargetKcal) {
        elTargetKcal.innerHTML = `z <span id="kcalTarget">${dynamicKcalTarget}</span> kcal`;
    }

    const setMacroText = (id, current, target) => {
        const el = DOM.get(id);
        if (el) el.textContent = `${current.toFixed(0)}/${target}`;
    };

    setMacroText('p-total', foodTotals.p, macroTargets.p);
    setMacroText('c-total', foodTotals.c, dynamicCarbTarget);
    setMacroText('sugar-total', foodTotals.sugar, macroTargets.sugar);
    setMacroText('f-total', foodTotals.f, macroTargets.f);

    // 5. Grafický progress bar (Kruh)
    const kcalCircle = DOM.get('kcalCircle');
    if (kcalCircle) {
        const pct = dynamicKcalTarget > 0 ? (foodTotals.kcal / dynamicKcalTarget) : 0;
        const degrees = Math.min(pct * 360, 360);
        let progressColor = '#48bb78';
        if (pct >= 1.5) progressColor = '#e53e3e';
        else if (pct > 1.15) progressColor = '#ed8936';
        else if (pct > 1) progressColor = '#ecc94b';
        kcalCircle.style.background = `conic-gradient(${progressColor} ${degrees}deg, #e2e8f0 ${degrees}deg)`;
    }
    
    renderCarbloadPlanCard(date);
    if (typeof renderFoodDayMetrics === 'function') renderFoodDayMetrics(date);

    if (typeof updateSportsDashboardSummary === "function") {
        updateSportsDashboardSummary();
    }
}

// ==========================================
// REAKTÍVNE PREPOJENIE (Event Binding)
// ==========================================
function setupStateWatchers() {
    const foodPicker = DOM.get('food-date-picker');
    const sportPicker = DOM.get('sport-date-picker');

    // Sledovanie zmien v Inputoch -> Aktualizácia stavu
    const handleDateChange = (e) => {
        AppState.selectedDate = e.target.value;
    };

    foodPicker?.addEventListener('change', handleDateChange);
    sportPicker?.addEventListener('change', handleDateChange);

    // Sledovanie zmeny stavu -> Automatický update UI komponentov
    AppState.subscribe((newDate) => {
        if (foodPicker && foodPicker.value !== newDate) foodPicker.value = newDate;
        if (sportPicker && sportPicker.value !== newDate) sportPicker.value = newDate;
        
        initDashboard();
        if (typeof loadSportDay === "function") loadSportDay();
    });
}

// Inicializácia pri štarte aplikácie
window.addEventListener('DOMContentLoaded', () => {
    const today = AppState.selectedDate;
    
    const foodPicker = DOM.get('food-date-picker');
    const sportPicker = DOM.get('sport-date-picker');
    if (foodPicker) foodPicker.value = today;
    if (sportPicker) sportPicker.value = today;
    
    const dateEl = DOM.get('date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' });
    }

    setupStateWatchers();
    initDashboard();
});
