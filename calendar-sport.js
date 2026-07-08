// Pomocná funkcia pre získanie prednastavených hodnôt podľa typu aktivity
const LOAD_INTENSITY_SETTINGS = {
    low: { label: 'Nízka záťaž', sugarRatio: 0.18, proteinPerKg: 0.25, distribution: [{ offset: -1, pct: 60 }, { offset: 0, pct: 40 }] },
    medium: { label: 'Stredná vytrvalosť', sugarRatio: 0.28, proteinPerKg: 0.28, distribution: [{ offset: -1, pct: 45 }, { offset: 0, pct: 55 }] },
    high: { label: 'Vysoká intenzita', sugarRatio: 0.38, proteinPerKg: 0.30, distribution: [{ offset: -2, pct: 35 }, { offset: -1, pct: 55 }, { offset: 0, pct: 10 }] },
    race: { label: 'Súťaž / triathlon', sugarRatio: 0.35, proteinPerKg: 0.30, distribution: [{ offset: -1, pct: 80 }, { offset: 0, pct: 20 }] },
    strength: { label: 'Sila / fitko', sugarRatio: 0.15, proteinPerKg: 0.35, distribution: [{ offset: 0, pct: 100 }] }
};

const ZONE_PHYSIOLOGY = Object.freeze({
    z1: { met: 3.2, carbFraction: 0.22, fuelFactor: 0.20 },
    z2: { met: 5.8, carbFraction: 0.38, fuelFactor: 0.30 },
    z3: { met: 8.0, carbFraction: 0.58, fuelFactor: 0.45 },
    z4: { met: 10.2, carbFraction: 0.76, fuelFactor: 0.62 },
    z5: { met: 12.5, carbFraction: 0.90, fuelFactor: 0.75 }
});

const TEMPLATE_MET_MULTIPLIER = Object.freeze({
    volno: 0,
    fitko: 0.72,
    indoor_bike: 0.95,
    plavanie: 1.05,
    bicykel: 1.00,
    beh: 1.08,
    duathlon: 1.06,
    aquathlon: 1.04,
    triathlon: 1.05,
    brick: 1.04,
    vlastne: 1.00
});

function getSelectedTemplate() {
    return document.getElementById('s-template')?.value || 'vlastne';
}

function inferLoadIntensity(breakDown, selected = 'auto', templateOverride = null) {
    if (selected && selected !== 'auto') return selected;

    const z1 = Number(breakDown.z1) || 0;
    const z2 = Number(breakDown.z2) || 0;
    const z3 = Number(breakDown.z3) || 0;
    const z4 = Number(breakDown.z4) || 0;
    const z5 = Number(breakDown.z5) || 0;
    const total = z1 + z2 + z3 + z4 + z5;
    if (!total) return 'low';

    const hardShare = (z4 + z5) / total;
    const enduranceShare = (z2 + z3) / total;
    const template = templateOverride || getSelectedTemplate();

    if (template === 'fitko') return 'strength';
    if (template === 'triathlon' || template === 'duathlon' || template === 'aquathlon') return hardShare >= 0.18 ? 'race' : 'high';
    if (hardShare >= 0.25 || z5 >= 10) return 'high';
    if (enduranceShare >= 0.5 || total >= 75) return 'medium';
    return 'low';
}

function calculateTrainingPredictionFromBreakdown(breakDown, selectedIntensity = 'auto', template = getSelectedTemplate()) {
    const bio = typeof getNormalizedBioProfile === 'function'
        ? getNormalizedBioProfile()
        : { weight: 72, resthr: 60, maxhr: 188 };
    const weight = Math.max(35, Number(bio.weight) || 72);
    const templateMultiplier = TEMPLATE_MET_MULTIPLIER[template] ?? 1;
    const zones = ['z1', 'z2', 'z3', 'z4', 'z5'];
    let totalDuration = 0;
    let totalKcalRaw = 0;
    let carbFuelRaw = 0;

    zones.forEach(zone => {
        const minutes = Math.max(0, Number(breakDown[zone]) || 0);
        totalDuration += minutes;
        const physiology = ZONE_PHYSIOLOGY[zone] || ZONE_PHYSIOLOGY.z2;
        const kcalPerMin = ((physiology.met * templateMultiplier) * 3.5 * weight) / 200;
        const kcal = minutes * kcalPerMin;
        totalKcalRaw += kcal;
        carbFuelRaw += (kcal * physiology.carbFraction * physiology.fuelFactor) / 4;
    });

    const intensityKey = inferLoadIntensity(breakDown, selectedIntensity, template);
    const intensity = LOAD_INTENSITY_SETTINGS[intensityKey] || LOAD_INTENSITY_SETTINGS.medium;
    let totalCarbsNeeded = Math.round(carbFuelRaw);

    if (intensityKey === 'strength' || template === 'fitko') {
        totalCarbsNeeded = Math.round(totalCarbsNeeded * 0.65);
    }

    if (intensityKey === 'race' || template === 'triathlon' || selectedIntensity === 'race') {
        const raceCarbsPerKg = totalDuration >= 180 ? 8 : totalDuration >= 90 ? 6 : 4.5;
        totalCarbsNeeded = Math.max(totalCarbsNeeded, Math.round(weight * raceCarbsPerKg));
    }

    const totalSugarNeeded = Math.round(totalCarbsNeeded * intensity.sugarRatio);
    const totalProteinNeeded = Math.round(weight * intensity.proteinPerKg);
    const totalKcalBurned = Math.round(totalKcalRaw);
    const carbDistribution = buildCarbDistribution(totalCarbsNeeded, totalSugarNeeded, intensityKey, breakDown, totalDuration);

    return {
        totalCarbsNeeded,
        totalSugarNeeded,
        totalProteinNeeded,
        totalDuration,
        totalKcalBurned,
        breakDown: { ...breakDown },
        intensityKey,
        intensityLabel: intensity.label,
        carbDistribution
    };
}

function buildCarbDistribution(totalCarbs, totalSugar, intensityKey, breakDown = {}, duration = 0) {
    const settings = LOAD_INTENSITY_SETTINGS[intensityKey] || LOAD_INTENSITY_SETTINGS.medium;
    const hardMinutes = (Number(breakDown.z4) || 0) + (Number(breakDown.z5) || 0);
    const hardShare = duration > 0 ? hardMinutes / duration : 0;
    let distribution = settings.distribution;
    if (intensityKey === 'race') {
        distribution = [{ offset: -1, pct: 80 }, { offset: 0, pct: 20 }];
    }
    if (intensityKey === 'high' && totalCarbs < 220 && duration < 120 && hardShare < 0.3) {
        distribution = [{ offset: -1, pct: 70 }, { offset: 0, pct: 30 }];
    }
    if (intensityKey === 'medium' && (totalCarbs > 260 || duration > 150 || hardShare > 0.2)) {
        distribution = [{ offset: -2, pct: 30 }, { offset: -1, pct: 55 }, { offset: 0, pct: 15 }];
    }
    let usedCarbs = 0;
    let usedSugar = 0;
    return distribution.map((slot, index) => {
        const isLast = index === distribution.length - 1;
        const carbs = isLast ? Math.max(0, totalCarbs - usedCarbs) : Math.round(totalCarbs * slot.pct / 100);
        const sugar = isLast ? Math.max(0, totalSugar - usedSugar) : Math.round(totalSugar * slot.pct / 100);
        usedCarbs += carbs;
        usedSugar += sugar;
        return { ...slot, carbs, sugar };
    });
}

function handleTemplateChange() {
    const template = document.getElementById('s-template').value;
    const titleInput = document.getElementById('s-title');
    const intensityInput = document.getElementById('s-load-intensity');
    
    if (template !== 'vlastne') {
        // Automaticky predvyplní názov podľa šablóny
        titleInput.value = document.getElementById('s-template').options[document.getElementById('s-template').selectedIndex].text;
    }

    if (template === 'fitko') {
        if (intensityInput) intensityInput.value = 'strength';
        const defaults = { 's-z1': 10, 's-z2': 20, 's-z3': 20, 's-z4': 10, 's-z5': 0 };
        Object.entries(defaults).forEach(([id, value]) => { const el = document.getElementById(id); if (el && !el.value) el.value = value; });
    } else if (template === 'indoor_bike') {
        if (intensityInput) intensityInput.value = 'medium';
    } else if (template === 'triathlon') {
        if (intensityInput) intensityInput.value = 'race';
    }

    // Automatický reset minút pri zmene šablóny, ak ide o Voľno
    if (template === 'volno') {
        ['s-z1', 's-z2', 's-z3', 's-z4', 's-z5'].forEach(id => document.getElementById(id).value = 0);
        if (intensityInput) intensityInput.value = 'low';
        predictCarbload();
    }

    predictCarbload();
}

// Načítanie uloženého bio profilu (localStorage)
function getUserBio() {
    try {
        const raw = localStorage.getItem('tri_user_bio_v1');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        console.warn('Chyba pri načítaní bio profilu:', e);
        return null;
    }
}

// 2. Pokročilá predikcia Carbloadu na základe minút v zónach Z1 až Z5 a bio
function predictCarbload() {
    const zones = ['z1', 'z2', 'z3', 'z4', 'z5'];
    const breakDown = {};
    zones.forEach(zone => {
        const input = document.getElementById(`s-${zone}`);
        const minutes = Math.max(0, parseFloat(input?.value) || 0);
        breakDown[zone] = minutes;
    });

    const selectedIntensity = document.getElementById('s-load-intensity')?.value || 'auto';
    const template = getSelectedTemplate();
    const prediction = calculateTrainingPredictionFromBreakdown(breakDown, selectedIntensity, template);
    const { totalCarbsNeeded, totalSugarNeeded, totalProteinNeeded, totalDuration, totalKcalBurned, intensityLabel } = prediction;
    const box = document.getElementById('carb-prediction-box');

    if (totalDuration <= 0) {
        if (box) box.style.display = 'none';
        return prediction;
    }

    const carbsEl = document.getElementById('predicted-carbs');
    const durationEl = document.getElementById('predicted-duration');
    const kcalEl = document.getElementById('predicted-kcal');
    const sugarEl = document.getElementById('predicted-sugar');
    const proteinEl = document.getElementById('predicted-protein');
    const intensityEl = document.getElementById('predicted-intensity');
    
    if (carbsEl) carbsEl.textContent = totalCarbsNeeded;
    if (durationEl) durationEl.textContent = totalDuration;
    if (kcalEl) kcalEl.textContent = totalKcalBurned;
    if (sugarEl) sugarEl.textContent = totalSugarNeeded;
    if (proteinEl) proteinEl.textContent = totalProteinNeeded;
    if (intensityEl) intensityEl.textContent = intensityLabel;
    if (box) box.style.display = 'block';

    return prediction;
}



// 3. Načítanie športového dňa z kalendára do listu
function loadSportDay() {
    const dateInput = document.getElementById('sport-date-picker');
    const list = document.getElementById('sport-list');
    if (!list || !dateInput || !dateInput.value) return;

    const date = dateInput.value;
    const allSports = getSportsCalendar();
    const daySports = allSports[date] || [];

    // Fast path when empty
    if (daySports.length === 0) {
        if (!list || !(list instanceof HTMLElement)) {
            console.error('Expected #sport-list element not found or not an HTMLElement', { list });
            return;
        }
        try {
            list.innerHTML = '<p style="text-align:center; color:#718096; padding: 8px;">Žiadne aktivity na tento deň.</p>';
        } catch (err) {
            console.error('Failed to set list.innerHTML for empty day:', err, { list, date, daySports });
            try { list.textContent = 'Žiadne aktivity na tento deň.'; } catch(e){}
        }
        return;
    }

    // Build HTML string (faster on iPhone Safari than many DOM ops)
    let html = '';
    for (let i = 0; i < daySports.length; i++) {
        const item = daySports[i];
        const bd = item.breakDown || {};
        const zones = [];
        ['z1','z2','z3','z4','z5'].forEach(z => { if ((bd[z] || 0) > 0) zones.push(z.toUpperCase() + ': ' + (bd[z] || 0) + 'm'); });
        const zonesText = zones.length ? zones.join(', ') : 'Žiadna intenzita';

        html += '<div class="list-item" style="border-left:4px solid var(--sports);padding-left:8px;margin-top:4px;display:flex;justify-content:space-between;align-items:center;">';
        html += '<div><strong>' + escapeHtml(item.title || '') + '</strong> (' + (item.duration || 0) + ' min)<br><span style="font-size:11px;color:#718096;">Rozpis: ' + escapeHtml(zonesText) + '</span><br><span style="font-size:12px;color:#2b6cb0;font-weight:700;">🔋 Carbload: +' + (item.carbload || 0) + 'g</span> <span style="font-size:12px;color:#d69e2e;font-weight:700;">🍯 ' + (item.sugarTarget || 0) + 'g cukry</span><br><span style="font-size:11px;color:#4a5568;">' + escapeHtml(item.intensityLabel || 'Intenzita podľa zón') + ' · 🥩 ' + (item.proteinTarget || 0) + 'g po výkone</span></div>';
        html += '<div style="display:flex;gap:8px;"><button class="preset-btn" data-action="edit" data-id="' + (item.id || item.createdAt) + '">Upraviť</button><button class="preset-btn" data-action="delete" data-id="' + (item.id || item.createdAt) + '" style="background:#e53e3e;color:#fff;">Zmazať</button></div>';
        html += '</div>';
    }

    list.innerHTML = html;

    // Delegated event handling (bind once)
    if (!list._delegated) {
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const id = btn.dataset.id;
            const action = btn.dataset.action;
            if (action === 'delete') {
                deleteSportItem(document.getElementById('sport-date-picker').value, id);
            } else if (action === 'edit') {
                openEditSportModal(document.getElementById('sport-date-picker').value, id);
            }
        });
        list._delegated = true;
    }
}

function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Open modal and populate fields for editing a saved sport
function openEditSportModal(date, itemId) {
    const all = getSportsCalendar();
    const items = all[date] || [];
    const item = items.find(i => (i.id || i.createdAt) === itemId);
    if (!item) return alert('Nenájdený tréning.');

    document.getElementById('edit-s-title').value = item.title || '';
    document.getElementById('edit-s-load-intensity').value = item.intensityKey || 'auto';
    document.getElementById('edit-s-start-time').value = item.startTime || '08:00';
    document.getElementById('edit-s-carb-share-prev-day').value = item.carbSharePrevDay ?? 30;
    ['z1','z2','z3','z4','z5'].forEach((z, idx) => {
        const val = (item.breakDown && item.breakDown[z]) || 0;
        document.getElementById('edit-s-' + z).value = val;
    });

    const modal = document.getElementById('sport-edit-modal');
    modal?.classList.add('open');

    // Save handler bound once
    const saveHandler = () => {
        console.groupCollapsed('saveEditedSport', itemId, date);
        ['z1','z2','z3','z4','z5'].forEach(z => {
            const v = Number(document.getElementById('edit-s-' + z).value) || 0;
            item.breakDown = item.breakDown || {};
            item.breakDown[z] = v;
        });
        item.title = document.getElementById('edit-s-title').value.trim() || item.title;
        item.intensityKey = document.getElementById('edit-s-load-intensity').value || item.intensityKey || 'auto';
        item.startTime = document.getElementById('edit-s-start-time').value || item.startTime;
        item.carbSharePrevDay = Number(document.getElementById('edit-s-carb-share-prev-day').value) || item.carbSharePrevDay;

        const updatedPred = calculateTrainingPredictionFromBreakdown(item.breakDown, item.intensityKey, item.template || 'vlastne');

        item.carbload = updatedPred.totalCarbsNeeded || item.carbload;
        item.sugarTarget = updatedPred.totalSugarNeeded || 0;
        item.proteinTarget = updatedPred.totalProteinNeeded || 0;
        item.intensityKey = updatedPred.intensityKey || item.intensityKey;
        item.intensityLabel = updatedPred.intensityLabel || item.intensityLabel;
        item.carbDistribution = updatedPred.carbDistribution || item.carbDistribution;
        item.kcalBurned = updatedPred.totalKcalBurned || item.kcalBurned;
        item.duration = updatedPred.totalDuration || item.duration;

        try {
            console.log('Saving edited item', item);
            saveSportsCalendar(all);
            console.info('Edited sport saved');
        } catch (err) {
            console.error('Failed saving edited sport', err);
        }
        safelyRefreshUI();
        modal?.classList.remove('open');
        document.getElementById('btn-save-edit-sport').removeEventListener('click', saveHandler);
        console.groupEnd();
    };

    document.getElementById('btn-save-edit-sport').addEventListener('click', saveHandler);
    document.getElementById('btn-close-edit-sport').addEventListener('click', () => {
        document.getElementById('sport-edit-modal')?.classList.remove('open');
        document.getElementById('btn-save-edit-sport').removeEventListener('click', saveHandler);
    }, { once: true });
}


// 4. Pridanie športovej aktivity do kalendára
function addSportItem() {
    const dateInput = document.getElementById('sport-date-picker');
    const titleInput = document.getElementById('s-title');
    const startTimeInput = document.getElementById('s-start-time');
    const carbShareInput = document.getElementById('s-carb-share-prev-day');
    const templateInput = document.getElementById('s-template');
    const intensityInput = document.getElementById('s-load-intensity');
    
    if (!dateInput || !dateInput.value) {
        alert('Prosím, vyberte platný dátum aktivity.');
        return;
    }

    const date = dateInput.value;
    const title = titleInput?.value.trim() || 'Tréning / Súťaž';
    
    // Predikcia sacharidov s ošetrením chýb
    let prediction = { totalDuration: 0, totalCarbsNeeded: 0, breakDown: null };
    try {
        if (typeof predictCarbload === "function") prediction = predictCarbload();
    } catch (err) {
        console.error('predictCarbload() threw', err);
    }

    console.groupCollapsed('addSportItem');
    console.log('date:', date, 'title:', title);
    console.log('startTime:', startTimeInput?.value, 'carbSharePrevDay:', carbShareInput?.value);
    console.log('prediction:', prediction);

    const newItem = {
        id: crypto.randomUUID?.() || Date.now().toString(),
        title,
        duration: prediction.totalDuration ?? 0,
        carbload: prediction.totalCarbsNeeded ?? 0,
        sugarTarget: prediction.totalSugarNeeded ?? 0,
        proteinTarget: prediction.totalProteinNeeded ?? 0,
        kcalBurned: prediction.totalKcalBurned ?? 0,
        breakDown: prediction.breakDown ?? null,
        template: templateInput?.value || 'vlastne',
        intensityKey: prediction.intensityKey || intensityInput?.value || 'auto',
        intensityLabel: prediction.intensityLabel || '',
        carbDistribution: prediction.carbDistribution || [],
        startTime: startTimeInput?.value || '08:00',
        carbSharePrevDay: Number(carbShareInput?.value) || 30,
        createdAt: new Date().toISOString()
    };

    // Zápis do úložiska
    try {
        const allSports = getSportsCalendar();
        allSports[date] = allSports[date] || [];
        allSports[date].push(newItem);
        console.log('Saving newItem for date', date, newItem);
        saveSportsCalendar(allSports);
        console.info('addSportItem saved OK');
    } catch (err) {
        console.error('addSportItem failed to save:', err);
    }
    
    // Obnova UI
    safelyRefreshUI();

    // Reset formulára pomocou natívneho resetu (ak je v <form>) alebo manuálne
    const form = dateInput.closest('form');
    if (form) {
        form.reset();
    } else {
        if (titleInput) titleInput.value = '';
        if (startTimeInput) startTimeInput.value = '08:00';
        if (carbShareInput) carbShareInput.value = '30';
        const template = document.getElementById('s-template');
        if (template) template.value = 'vlastne';
        const intensity = document.getElementById('s-load-intensity');
        if (intensity) intensity.value = 'auto';
        ['s-z1', 's-z2', 's-z3', 's-z4', 's-z5'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    // Skrytie boxu predikcie
    const predictionBox = document.getElementById('carb-prediction-box');
    if (predictionBox) predictionBox.style.display = 'none';
    console.groupEnd();
}

function calculateAfterSessionRecovery() {
    const kcal = Math.max(0, Number(document.getElementById('real-kcal')?.value) || 0);
    const duration = Math.max(0, Number(document.getElementById('real-duration')?.value) || 0);
    const breakDown = {};
    ['z1','z2','z3','z4','z5'].forEach(z => {
        breakDown[z] = Math.max(0, Number(document.getElementById('real-' + z)?.value) || 0);
    });

    const intensityKey = inferLoadIntensity(breakDown, 'auto', 'vlastne');
    const settings = LOAD_INTENSITY_SETTINGS[intensityKey] || LOAD_INTENSITY_SETTINGS.medium;
    const hardMinutes = (breakDown.z4 || 0) + (breakDown.z5 || 0);
    const carbBase = kcal > 0 ? kcal / 4 : duration * 0.7;
    const carbMultiplier = intensityKey === 'strength' ? 0.35 : hardMinutes > 20 ? 0.55 : 0.42;
    const carbsFirstHours = Math.round(carbBase * carbMultiplier);
    const sugarFirstHour = Math.round(carbsFirstHours * settings.sugarRatio);
    const bio = getUserBio();
    const weight = (bio && Number(bio.weight)) || 70;
    const protein = Math.round(weight * settings.proteinPerKg);
    const result = document.getElementById('after-session-result');
    if (!result) return;

    result.innerHTML = '<strong>' + escapeHtml(settings.label) + '</strong><br>' +
        'Prvá hodina: ' + Math.round(carbsFirstHours * 0.45) + 'g sacharidov, z toho max ' + Math.round(sugarFirstHour * 0.6) + 'g cukrov.<br>' +
        'Ďalšie 2-3 hodiny: ' + Math.max(0, carbsFirstHours - Math.round(carbsFirstHours * 0.45)) + 'g sacharidov, z toho max ' + Math.max(0, sugarFirstHour - Math.round(sugarFirstHour * 0.6)) + 'g cukrov.<br>' +
        'Bielkoviny po výkone: ' + protein + 'g. Ak bol tréning ľahší než plán, drž cukor nižšie a doplň skôr normálnym jedlom.';
    result.style.display = 'block';
}

// 5. Zmazanie športovej aktivity (upravené na mazanie cez unikátne ID)
function deleteSportItem(date, itemId) {
    const allSports = getSportsCalendar();
    
    if (!allSports[date]) return;

    // Bezpečnejšie mazanie cez ID namiesto indexu (predchádza bugom pri preusporiadaní)
    allSports[date] = allSports[date].filter(item => (item.id || item) !== itemId);

    // Vyčistenie prázdneho dňa, aby nezaberal miesto
    if (allSports[date].length === 0) {
        delete allSports[date];
    }

    saveSportsCalendar(allSports);
    safelyRefreshUI();
}

// Spustenie pri načítaní
window.addEventListener('DOMContentLoaded', () => {
    safelyRefreshUI();
});

// ----------------------
// Úložisko a pomocné funkcie
// ----------------------

// Kľúč v localStorage (zhoda so zvyškom aplikácie)
const SPORTS_STORAGE_KEY = 'pwa_sports_calendar';

function getSportsCalendar() {
    try {
        const raw = localStorage.getItem(SPORTS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
        console.error('Chyba pri načítaní kalendára športov (invalid JSON?):', err, 'raw=', localStorage.getItem(SPORTS_STORAGE_KEY));
        return {};
    }
}

function saveSportsCalendar(data) {
    try {
        // Minimalna validácia
        if (!data || typeof data !== 'object') throw new Error('Invalid data');
        localStorage.setItem(SPORTS_STORAGE_KEY, JSON.stringify(data));
        console.info('Sports calendar saved. keys=', Object.keys(data).length);
    } catch (err) {
        console.error('Chyba pri ukladaní kalendára športov:', err, 'data=', data);
        try { alert('Nepodarilo sa uložiť tréningy do localStorage. Skontrolujte konzolu.'); } catch(e){}
    }
}

// Bezpečný refresh UI: aktualizuje zoznam dňa a vysiela event pre ďalšie komponenty
function safelyRefreshUI() {
    try {
        // Aktualizuj zobrazenie pre vybraný deň
        loadSportDay();
        if (typeof initDashboard === 'function') initDashboard();
        if (typeof renderFoodDayMetrics === 'function') renderFoodDayMetrics();

        // Vysielame CustomEvent, aby sa prípadné kalendáre (FullCalendar atď.) vedeli synchronizovať
        const all = getSportsCalendar();
        try {
            window.dispatchEvent(new CustomEvent('sportsCalendarUpdated', { detail: all }));
        } catch (e) {
            // Nie všetky prostredia podporujú CustomEvent konštruktér rovnakým spôsobom
            const evt = document.createEvent('Event');
            evt.initEvent('sportsCalendarUpdated', true, true);
            evt.detail = all;
            window.dispatchEvent(evt);
        }
    } catch (err) {
        console.error('Chyba pri refreshovaní UI športov:', err);
    }
}
