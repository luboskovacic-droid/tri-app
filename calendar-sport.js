// Pomocná funkcia pre získanie prednastavených hodnôt podľa typu aktivity
function handleTemplateChange() {
    const template = document.getElementById('s-template').value;
    const titleInput = document.getElementById('s-title');
    
    if (template !== 'vlastne') {
        // Automaticky predvyplní názov podľa šablóny
        titleInput.value = document.getElementById('s-template').options[document.getElementById('s-template').selectedIndex].text;
    }

    // Automatický reset minút pri zmene šablóny, ak ide o Voľno
    if (template === 'volno') {
        ['s-z1', 's-z2', 's-z3', 's-z4', 's-z5'].forEach(id => document.getElementById(id).value = 0);
        predictCarbload();
    }
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
    let totalDuration = 0;
    let totalCarbsRaw = 0;

    // Základné MET odhady pre zóny (približné)
    const ZONE_MET = { z1: 3, z2: 5, z3: 8, z4: 10, z5: 12 };
    const ZONE_CARB_FRAC = { z1: 0.30, z2: 0.40, z3: 0.60, z4: 0.75, z5: 0.90 };

    // Načítanie bio profilu
    const bio = getUserBio();
    const weight = (bio && Number(bio.weight)) || 70; // kg fallback

    // Kalkulácia: kcal/min = MET * 3.5 * weight(kg) / 200
    const kcalPerMinForZone = {};
    zones.forEach(z => {
        const met = ZONE_MET[z] || 5;
        kcalPerMinForZone[z] = (met * 3.5 * weight) / 200;
    });

    // Načítanie hodnôt z UI pomocou cyklu
    zones.forEach(zone => {
        const input = document.getElementById(`s-${zone}`);
        const minutes = Math.max(0, parseFloat(input?.value) || 0);
        breakDown[zone] = minutes;
        totalDuration += minutes;

        const kcalMin = kcalPerMinForZone[zone] || 0;
        const carbFrac = ZONE_CARB_FRAC[zone] || 0.5;
        // grams per minute = (kcal per min * carb fraction) / 4 (kcal per gram carb)
        const carbsPerMin = (kcalMin * carbFrac) / 4;
        totalCarbsRaw += minutes * carbsPerMin;
    });

    const totalCarbsNeeded = Math.round(totalCarbsRaw);
    const totalKcalBurned = Math.round(totalDuration * (bio ? (Number(bio.weight) || 70) * 0.08 : 8));
    const box = document.getElementById('carb-prediction-box');

    if (totalDuration <= 0) {
        if (box) box.style.display = 'none';
        return { totalCarbsNeeded: 0, totalDuration, breakDown };
    }

    const carbsEl = document.getElementById('predicted-carbs');
    const durationEl = document.getElementById('predicted-duration');
    const kcalEl = document.getElementById('predicted-kcal');
    if (carbsEl) carbsEl.textContent = totalCarbsNeeded;
    if (durationEl) durationEl.textContent = totalDuration;
    if (kcalEl) kcalEl.textContent = totalKcalBurned;
    if (box) box.style.display = 'block';

    return { totalCarbsNeeded, totalDuration, totalKcalBurned, breakDown };
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
        html += '<div><strong>' + escapeHtml(item.title || '') + '</strong> (' + (item.duration || 0) + ' min)<br><span style="font-size:11px;color:#718096;">Rozpis: ' + escapeHtml(zonesText) + '</span><br><span style="font-size:12px;color:#2b6cb0;font-weight:700;">🔋 Carbload: +' + (item.carbload || 0) + 'g</span></div>';
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
        item.startTime = document.getElementById('edit-s-start-time').value || item.startTime;
        item.carbSharePrevDay = Number(document.getElementById('edit-s-carb-share-prev-day').value) || item.carbSharePrevDay;

        // Recompute prediction based on updated zones
        const oldPrediction = predictCarbload();
        const updatedPred = (() => {
            // Temporarily populate UI inputs with edited values to reuse predictCarbload
            ['z1','z2','z3','z4','z5'].forEach(z => {
                const el = document.getElementById('s-' + z);
                if (el) el.value = item.breakDown[z] || 0;
            });
            const p = predictCarbload();
            return p;
        })();

        item.carbload = updatedPred.totalCarbsNeeded || item.carbload;
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
        kcalBurned: prediction.totalKcalBurned ?? 0,
        breakDown: prediction.breakDown ?? null,
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

