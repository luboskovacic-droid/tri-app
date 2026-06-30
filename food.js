const FOOD_PRESET_STORAGE_KEY = 'tri_food_presets_v1';
const MEAL_ORDER = ['Raňajky', 'Desiata', 'Obed', 'Olovrant', 'Večera', 'Druhá večera', 'Nezaradené'];

const DEFAULT_FOOD_PRESETS = [
    { name: 'Ovsené vločky', category: 'Karbóny', kcal: 389, p: 16.9, c: 66.3, sugar: 0.9, f: 6.9 },
    { name: 'Jogurt natural', category: 'Mliečne', kcal: 61, p: 3.5, c: 4.7, sugar: 4.7, f: 3.0 },
    { name: 'Tvaroh', category: 'Mliečne', kcal: 98, p: 11.1, c: 3.3, sugar: 3.3, f: 4.3 },
    { name: 'Mlieko', category: 'Mliečne', kcal: 61, p: 3.2, c: 4.8, sugar: 4.8, f: 3.6 },
    { name: 'Vajcia', category: 'Proteíny', kcal: 155, p: 13.0, c: 1.1, sugar: 1.1, f: 11.0 },
    { name: 'Ryža', category: 'Karbóny', kcal: 130, p: 2.7, c: 28.0, sugar: 0.1, f: 0.3 },
    { name: 'Těstoviny', category: 'Karbóny', kcal: 131, p: 4.8, c: 25.0, sugar: 0.8, f: 1.1 },
    { name: 'Kuracie prsia', category: 'Proteíny', kcal: 165, p: 31.0, c: 0.0, sugar: 0.0, f: 3.6 },
    { name: 'Hovädzina', category: 'Proteíny', kcal: 250, p: 26.0, c: 0.0, sugar: 0.0, f: 15.0 },
    { name: 'Tuniak', category: 'Proteíny', kcal: 144, p: 24.0, c: 0.0, sugar: 0.0, f: 6.0 },
    { name: 'Šunka', category: 'Proteíny', kcal: 150, p: 20.0, c: 1.0, sugar: 0.5, f: 7.0 },
    { name: 'Chlieb', category: 'Karbóny', kcal: 265, p: 9.0, c: 49.0, sugar: 5.0, f: 3.2 },
    { name: 'Banán', category: 'Ovocie', kcal: 89, p: 1.1, c: 22.8, sugar: 12.2, f: 0.3 },
    { name: 'Jablko', category: 'Ovocie', kcal: 52, p: 0.3, c: 14.0, sugar: 10.4, f: 0.2 },
    { name: 'Arašidy', category: 'Ostatné', kcal: 567, p: 25.0, c: 16.0, sugar: 4.0, f: 49.0 },
    { name: 'Avokádo', category: 'Ovocie', kcal: 160, p: 2.0, c: 8.5, sugar: 0.7, f: 14.7 },
    { name: 'Zemiaky', category: 'Karbóny', kcal: 77, p: 2.0, c: 17.0, sugar: 0.8, f: 0.1 },
    { name: 'Müsli', category: 'Karbóny', kcal: 380, p: 8.0, c: 70.0, sugar: 18.0, f: 6.0 },
    { name: 'Syr', category: 'Mliečne', kcal: 402, p: 25.0, c: 1.3, sugar: 0.5, f: 33.0 },
    { name: 'Kuskus', category: 'Karbóny', kcal: 358, p: 13.0, c: 72.0, sugar: 0.1, f: 0.6 },
    { name: 'Quinoa', category: 'Karbóny', kcal: 120, p: 4.4, c: 21.3, sugar: 0.9, f: 1.9 },
    { name: 'Lentilky', category: 'Proteíny', kcal: 116, p: 9.0, c: 20.0, sugar: 1.8, f: 0.4 }
];

function normalizeFoodPreset(preset) {
    const carbs = Number(preset.c) || 0;
    const sugar = Math.min(carbs, Math.max(0, Number(preset.sugar) || 0));
    return {
        ...preset,
        sugar,
        gi: Math.max(0, Math.min(100, Number(preset.gi) || 0)),
        complexity: preset.complexity || 'medium',
        fiber: Math.max(0, Number(preset.fiber) || 0),
        category: preset.category || 'Ostatné'
    };
}

function getFoodPresets() {
    try {
        const raw = localStorage.getItem(FOOD_PRESET_STORAGE_KEY);
        if (!raw) return DEFAULT_FOOD_PRESETS.map(normalizeFoodPreset);
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_FOOD_PRESETS.map(normalizeFoodPreset);
        return parsed
            .filter((preset) => preset.category !== 'Zelenina')
            .map(normalizeFoodPreset);
    } catch (e) {
        return DEFAULT_FOOD_PRESETS.map(normalizeFoodPreset);
    }
}

function saveFoodPresets(presets) {
    localStorage.setItem(FOOD_PRESET_STORAGE_KEY, JSON.stringify(presets));
}

function upsertFoodPreset(preset) {
    const presets = getFoodPresets();
    const normalizedPreset = normalizeFoodPreset(preset);
    const existingIndex = presets.findIndex(item => item.name.toLowerCase() === normalizedPreset.name.toLowerCase());
    if (existingIndex >= 0) {
        const category = normalizedPreset.category === 'Ostatné' ? presets[existingIndex].category : normalizedPreset.category;
        presets[existingIndex] = { ...presets[existingIndex], ...normalizedPreset, category };
    } else {
        presets.push(normalizedPreset);
    }

    saveFoodPresets(presets);
    renderFoodPresets();
    renderFoodSuggestions();
    renderPresetEditor(
        document.getElementById('preset-macro-filter')?.value || 'Všetky',
        document.getElementById('preset-editor-search')?.value || ''
    );
    return existingIndex >= 0 ? 'updated' : 'created';
}

function buildPresetFromForm() {
    const name = DOM.get('f-name')?.value?.trim();
    if (!name) return null;

    const carbs = Math.max(0, Number(DOM.get('f-c')?.value) || 0);
    return normalizeFoodPreset({
        name,
        category: 'Ostatné',
        kcal: Math.max(0, Number(DOM.get('f-kcal')?.value) || 0),
        p: Math.max(0, Number(DOM.get('f-p')?.value) || 0),
        c: carbs,
        sugar: Math.min(carbs, Math.max(0, Number(DOM.get('f-sugar')?.value) || 0)),
        f: Math.max(0, Number(DOM.get('f-f')?.value) || 0)
        ,
        gi: Math.max(0, Math.min(100, Number(DOM.get('f-gi')?.value) || 0)),
        complexity: DOM.get('f-complexity')?.value || 'medium',
        fiber: Math.max(0, Number(DOM.get('f-fiber')?.value) || 0)
    });
}

function renderFoodSuggestions() {
    const searchInput = DOM.get('f-search');
    const suggestions = DOM.get('food-suggestions');
    if (!searchInput || !suggestions) return;

    const query = searchInput.value.trim().toLowerCase();
    const presets = getFoodPresets();
    const matches = (query
        ? presets.filter((preset) => `${preset.name} ${preset.category}`.toLowerCase().includes(query))
        : presets
    ).slice(0, 8);

    suggestions.innerHTML = '';
    if (!matches.length) {
        suggestions.classList.remove('open');
        return;
    }

    matches.forEach((preset) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'food-suggestion';
        btn.innerHTML = `<strong>${escapeFoodHtml(preset.name)}</strong><span>${escapeFoodHtml(preset.category || 'Ostatné')} · ${preset.kcal} kcal · B ${preset.p} / S ${preset.c} / Cukry ${preset.sugar || 0} / T ${preset.f} · GI ${preset.gi || 0}</span>`;
        btn.addEventListener('click', () => {
            applyFoodPreset(preset);
            searchInput.value = preset.name;
            suggestions.classList.remove('open');
        });
        suggestions.appendChild(btn);
    });

    suggestions.classList.add('open');
}

function escapeFoodHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderFoodPresets() {
    const container = document.getElementById('food-presets');
    if (!container) return;

    const presets = getFoodPresets();
    const grouped = presets.reduce((acc, preset) => {
        const category = preset.category || 'Ostatné';
        if (!acc[category]) acc[category] = [];
        acc[category].push(preset);
        return acc;
    }, {});

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    Object.keys(grouped).forEach((category) => {
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom:8px; width:100%;';

        const title = document.createElement('div');
        title.textContent = category;
        title.style.cssText = 'font-size:11px;font-weight:700;color:#4a5568;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;';

        const buttonsRow = document.createElement('div');
        buttonsRow.className = 'preset-row';
        buttonsRow.style.marginTop = '0';

        grouped[category].forEach((preset) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'preset-btn';
            btn.textContent = preset.name;
            btn.addEventListener('click', () => applyFoodPreset(preset));
            buttonsRow.appendChild(btn);
        });

        section.append(title, buttonsRow);
        fragment.appendChild(section);
    });

    container.appendChild(fragment);
}

function getPresetMacroGroup(preset) {
    const values = [preset.c || 0, preset.p || 0, preset.f || 0];
    const max = Math.max(...values);
    if (max === 0) return 'Všetky';
    if (preset.c >= preset.p && preset.c >= preset.f) return 'Sacharidy';
    if (preset.p >= preset.c && preset.p >= preset.f) return 'Bielkoviny';
    return 'Tuky';
}

function renderPresetEditor(filter = 'Všetky', search = '') {
    const list = document.getElementById('preset-editor-list');
    if (!list) return;
    const presets = getFoodPresets();
    const searchTerm = String(search || '').trim().toLowerCase();
    const filteredPresets = filter === 'Všetky'
        ? presets
        : presets.filter((preset) => getPresetMacroGroup(preset) === filter);
    const visiblePresets = searchTerm
        ? filteredPresets.filter((preset) => `${preset.name} ${preset.category}`.toLowerCase().includes(searchTerm))
        : filteredPresets;

    list.innerHTML = '';

    if (!visiblePresets.length) {
        list.innerHTML = '<div style="font-size:12px;color:#718096;">Žiadne položky pre túto skupinu.</div>';
        return;
    }

    visiblePresets.forEach((preset, visibleIndex) => {
        const originalIndex = presets.findIndex((item) => item.name === preset.name && item.kcal === preset.kcal && item.p === preset.p && item.c === preset.c && item.f === preset.f);
        const row = document.createElement('div');
        row.className = 'preset-editor-row';
        row.dataset.presetIndex = originalIndex >= 0 ? originalIndex : visibleIndex;

        const nameInput = document.createElement('input');
        nameInput.value = preset.name;
        nameInput.dataset.field = 'name';
        nameInput.dataset.index = row.dataset.presetIndex;

        const categoryInput = document.createElement('input');
        categoryInput.value = preset.category || 'Ostatné';
        categoryInput.dataset.field = 'category';
        categoryInput.dataset.index = row.dataset.presetIndex;

        const kcalInput = document.createElement('input');
        kcalInput.type = 'number';
        kcalInput.value = preset.kcal;
        kcalInput.dataset.field = 'kcal';
        kcalInput.dataset.index = row.dataset.presetIndex;

        const pInput = document.createElement('input');
        pInput.type = 'number';
        pInput.step = '0.1';
        pInput.value = preset.p;
        pInput.dataset.field = 'p';
        pInput.dataset.index = row.dataset.presetIndex;

        const cInput = document.createElement('input');
        cInput.type = 'number';
        cInput.step = '0.1';
        cInput.value = preset.c;
        cInput.dataset.field = 'c';
        cInput.dataset.index = row.dataset.presetIndex;

        const sugarInput = document.createElement('input');
        sugarInput.type = 'number';
        sugarInput.step = '0.1';
        sugarInput.value = preset.sugar || 0;
        sugarInput.placeholder = 'Cukry';
        sugarInput.dataset.field = 'sugar';
        sugarInput.dataset.index = row.dataset.presetIndex;

        const fInput = document.createElement('input');
        fInput.type = 'number';
        fInput.step = '0.1';
        fInput.value = preset.f;
        fInput.dataset.field = 'f';
        fInput.dataset.index = row.dataset.presetIndex;

        const giInput = document.createElement('input');
        giInput.type = 'number';
        giInput.value = preset.gi || 0;
        giInput.placeholder = 'GI';
        giInput.dataset.field = 'gi';
        giInput.dataset.index = row.dataset.presetIndex;

        const complexityInput = document.createElement('input');
        complexityInput.value = preset.complexity || 'medium';
        complexityInput.placeholder = 'simple/medium/complex';
        complexityInput.dataset.field = 'complexity';
        complexityInput.dataset.index = row.dataset.presetIndex;

        const fiberInput = document.createElement('input');
        fiberInput.type = 'number';
        fiberInput.step = '0.1';
        fiberInput.value = preset.fiber || 0;
        fiberInput.placeholder = 'Vláknina';
        fiberInput.dataset.field = 'fiber';
        fiberInput.dataset.index = row.dataset.presetIndex;

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'preset-btn';
        deleteBtn.textContent = 'Zmazať';
        deleteBtn.style.cssText = 'background:#e53e3e;color:#fff;';
        deleteBtn.dataset.action = 'delete-preset';
        deleteBtn.dataset.index = row.dataset.presetIndex;

        row.append(nameInput, categoryInput, kcalInput, pInput, cInput, sugarInput, fInput, giInput, complexityInput, fiberInput, deleteBtn);
        list.appendChild(row);
    });
}

function applyFoodPreset(preset) {
    const nameInput = DOM.get('f-name');
    const searchInput = DOM.get('f-search');
    const kcalInput = DOM.get('f-kcal');
    const pInput = DOM.get('f-p');
    const cInput = DOM.get('f-c');
    const sugarInput = DOM.get('f-sugar');
    const fInput = DOM.get('f-f');
    const giInput = DOM.get('f-gi');
    const complexityInput = DOM.get('f-complexity');
    const fiberInput = DOM.get('f-fiber');
    const weightInput = DOM.get('f-weight');

    if (nameInput) nameInput.value = preset.name;
    if (searchInput) searchInput.value = preset.name;
    if (kcalInput) kcalInput.value = preset.kcal;
    if (pInput) pInput.value = preset.p;
    if (cInput) cInput.value = preset.c;
    if (sugarInput) sugarInput.value = preset.sugar || 0;
    if (fInput) fInput.value = preset.f;
    if (giInput) giInput.value = preset.gi || '';
    if (complexityInput) complexityInput.value = preset.complexity || 'medium';
    if (fiberInput) fiberInput.value = preset.fiber || '';
    if (weightInput) weightInput.value = 100;

    if (nameInput) nameInput.focus();
}

// 1. Načítanie stravy pre vybraný deň (Využíva AppState a DocumentFragment)
function loadFoodDay() {
    const list = DOM.get('food-list');
    if (!list) return;
    
    list.textContent = ''; // Bezpečné premazanie zoznamu
    
    const date = AppState.selectedDate;
    const allData = Storage.get(STORAGE_KEYS.FOOD);
    const dayLogs = allData[date] || [];

    if (dayLogs.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#718096; padding: 12px;">Žiadne zaznamenané jedlá.</p>';
        return;
    }

    const fragment = document.createDocumentFragment();

    const groupedLogs = dayLogs.reduce((acc, item) => {
        const meal = item.meal || 'Nezaradené';
        if (!acc[meal]) acc[meal] = [];
        acc[meal].push(item);
        return acc;
    }, {});

    MEAL_ORDER.forEach((meal) => {
        const mealItems = groupedLogs[meal] || [];
        if (!mealItems.length) return;

        const mealSection = document.createElement('div');
        mealSection.style.cssText = 'margin-top:10px;';

        const mealTitle = document.createElement('div');
        const mealKcal = mealItems.reduce((sum, item) => sum + (Number(item.kcal) || 0), 0);
        mealTitle.textContent = `${meal} · ${mealKcal} kcal`;
        mealTitle.style.cssText = 'font-size:12px;font-weight:800;color:#2d3748;text-transform:uppercase;letter-spacing:.03em;margin:8px 0 4px;';
        mealSection.appendChild(mealTitle);

        mealItems.forEach((item) => {
        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'list-item';
        itemWrapper.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-top: 4px;';

        // Ľavá strana: Názov a makrá
        const leftDiv = document.createElement('div');
        
        const titleEl = document.createElement('strong');
        titleEl.textContent = item.name;
        
        const weightEl = document.createElement('small');
        weightEl.textContent = ` (${item.weight}g)`;
        weightEl.style.color = '#718096';

        const br = document.createElement('br');

        const macrosSpan = document.createElement('span');
        macrosSpan.style.cssText = 'font-size: 11px; color: #718096;';
        const sugar = Math.min(Number(item.c) || 0, Math.max(0, Number(item.sugar) || 0));
        const timing = item.timing && item.timing !== 'normal' ? ` | ${formatFoodTiming(item.timing)}` : '';
        macrosSpan.textContent = `B: ${item.p.toFixed(1)}g | S: ${item.c.toFixed(1)}g | Cukry: ${sugar.toFixed(1)}g | T: ${item.f.toFixed(1)}g | GI: ${item.gi || 0}${timing}`;

        leftDiv.append(titleEl, weightEl, br, macrosSpan);

        // Pravá strana: Kalórie a zmazanie
        const rightDiv = document.createElement('div');
        rightDiv.style.textAlign = 'right';

        const kcalSpan = document.createElement('span');
        kcalSpan.style.fontWeight = '600';
        kcalSpan.textContent = `${item.kcal} kcal`;

        const brRight = document.createElement('br');

        const deleteBtn = document.createElement('span');
        deleteBtn.style.cssText = 'color: #e53e3e; font-size: 12px; cursor: pointer; user-select: none;';
        deleteBtn.textContent = 'Zmazať';
        
        // Bezpečné mazanie cez UUID
        const targetId = item.id || item.createdAt;
        deleteBtn.addEventListener('click', () => deleteFoodItem(date, targetId));

        rightDiv.append(kcalSpan, brRight, deleteBtn);

        itemWrapper.append(leftDiv, rightDiv);
        mealSection.append(itemWrapper);
        });

        fragment.append(mealSection);
    });

    list.append(fragment);
}

// 2. Pridanie jedla pre zvolený deň
function addFoodItem() {
    const date = AppState.selectedDate;
    
    const nameInput = DOM.get('f-name');
    const mealInput = DOM.get('f-meal');
    const timingInput = DOM.get('f-timing');
    const weightInput = DOM.get('f-weight');
    const kcalInput = DOM.get('f-kcal');
    const pInput = DOM.get('f-p');
    const cInput = DOM.get('f-c');
    const sugarInput = DOM.get('f-sugar');
    const fInput = DOM.get('f-f');
    const giInput = DOM.get('f-gi');
    const complexityInput = DOM.get('f-complexity');
    const fiberInput = DOM.get('f-fiber');

    const name = nameInput?.value.trim() || 'Jedlo';
    const weight = Math.max(0, parseFloat(weightInput?.value) || 100);
    const multiplier = weight / 100;

    // Extrakcia hodnôt na 100g s ochranou proti záporným číslam
    const getNutrient = (input) => Math.max(0, parseFloat(input?.value) || 0);

    const carbs = Math.round(getNutrient(cInput) * multiplier * 10) / 10;
    const sugar = Math.min(carbs, Math.round(getNutrient(sugarInput) * multiplier * 10) / 10);

    const newItem = {
        id: crypto.randomUUID?.() || Date.now().toString(),
        name,
        meal: mealInput?.value || 'Raňajky',
        timing: timingInput?.value || 'normal',
        weight,
        kcal: Math.round(getNutrient(kcalInput) * multiplier),
        p: Math.round(getNutrient(pInput) * multiplier * 10) / 10,
        c: carbs,
        sugar,
        f: Math.round(getNutrient(fInput) * multiplier * 10) / 10,
        gi: Math.max(0, Math.min(100, Number(giInput?.value) || 0)),
        complexity: complexityInput?.value || 'medium',
        fiber: Math.round(getNutrient(fiberInput) * multiplier * 10) / 10,
        createdAt: new Date().toISOString()
    };

    const allData = Storage.get(STORAGE_KEYS.FOOD);
    allData[date] = allData[date] || [];
    allData[date].push(newItem);

    Storage.save(STORAGE_KEYS.FOOD, allData);

    const preset = buildPresetFromForm();
    if (preset) upsertFoodPreset(preset);
    
    // REAKTÍVNY UPDATE: Vyžiadame prekreslenie dashboardu a zoznamu jedál
    initDashboard();
    loadFoodDay();
    renderFoodDayMetrics(date);
    evaluateLoggedFood(newItem, date);

    // Vyčistenie formulára natívne (ak existuje form podval) alebo manuálne cez cache
    const form = nameInput?.closest('form');
    if (form) {
        form.reset();
        const searchInput = DOM.get('f-search');
        if (searchInput) searchInput.value = '';
        const suggestions = DOM.get('food-suggestions');
        if (suggestions) suggestions.classList.remove('open');
    } else {
        ['f-search', 'f-name', 'f-kcal', 'f-weight', 'f-p', 'f-c', 'f-sugar', 'f-f', 'f-gi', 'f-fiber'].forEach(id => {
            const el = DOM.get(id);
            if (el) el.value = '';
        });
    }
}

function formatFoodTiming(value) {
    if (value === 'preworkout') return 'Pre-workout';
    if (value === 'postworkout') return 'Post-workout';
    if (value === 'between') return 'Medzi tréningami';
    return 'Bežné';
}

function getFoodTotalsForDate(date) {
    return (Storage.get(STORAGE_KEYS.FOOD)[date] || []).reduce((acc, item) => {
        acc.kcal += Number(item.kcal) || 0;
        acc.p += Number(item.p) || 0;
        acc.c += Number(item.c) || 0;
        acc.sugar += Math.min(Number(item.c) || 0, Math.max(0, Number(item.sugar) || 0));
        acc.f += Number(item.f) || 0;
        return acc;
    }, { kcal: 0, p: 0, c: 0, sugar: 0, f: 0 });
}

function setFoodRing(id, textId, current, target) {
    const ring = DOM.get(id);
    const text = DOM.get(textId);
    const pct = target > 0 ? current / target : 0;
    const degrees = Math.min(360, pct * 360);
    let color = '#48bb78';
    if (pct >= 1.5) color = '#e53e3e';
    else if (pct > 1.15) color = '#ed8936';
    else if (pct > 1) color = '#ecc94b';
    if (ring) ring.style.background = `conic-gradient(${color} ${degrees}deg,#e2e8f0 ${degrees}deg)`;
    if (text) text.textContent = `${Math.round(current)}/${Math.round(target)}`;
}

function renderFoodDayMetrics(date = AppState.selectedDate) {
    const totals = getFoodTotalsForDate(date);
    const targets = typeof getMacroTargetsForDate === 'function'
        ? getMacroTargetsForDate(date)
        : { c: 200, p: 150, f: 65, sugar: 0 };
    setFoodRing('food-ring-c', 'food-ring-c-text', totals.c, targets.c);
    setFoodRing('food-ring-p', 'food-ring-p-text', totals.p, targets.p);
    setFoodRing('food-ring-f', 'food-ring-f-text', totals.f, targets.f);
    setFoodRing('food-ring-sugar', 'food-ring-sugar-text', totals.sugar, targets.sugar);
    renderFoodTimeline(date);
}

function renderFoodTimeline(date = AppState.selectedDate) {
    const el = DOM.get('food-day-timeline');
    if (!el) return;
    const sports = Storage.get(STORAGE_KEYS.SPORTS)[date] || [];
    const foods = Storage.get(STORAGE_KEYS.FOOD)[date] || [];
    const slots = [
        { label: 'Ráno', filter: item => ['Raňajky', 'Desiata'].includes(item.meal) },
        { label: 'Pre-workout', filter: item => item.timing === 'preworkout' },
        { label: 'Post-workout', filter: item => item.timing === 'postworkout' },
        { label: 'Medzi tréningami', filter: item => item.timing === 'between' },
        { label: 'Večer', filter: item => ['Večera', 'Druhá večera'].includes(item.meal) }
    ];

    el.innerHTML = slots.map(slot => {
        const slotFoods = foods.filter(slot.filter);
        const foodText = slotFoods.length
            ? slotFoods.map(item => `${escapeFoodHtml(item.name)} ${Math.round(Number(item.c) || 0)}g S`).join(', ')
            : 'bez zápisu';
        const trainingText = sports.length && (slot.label.includes('workout') || slot.label === 'Medzi tréningami')
            ? sports.map(item => `${escapeFoodHtml(item.startTime || '??:??')} ${escapeFoodHtml(item.title || 'Tréning')}`).join(', ')
            : '';
        return `<div class="timeline-slot"><b>${slot.label}</b><span>${trainingText ? `${trainingText}<br>` : ''}${foodText}</span></div>`;
    }).join('');
}

function evaluateLoggedFood(item, date) {
    const box = DOM.get('food-evaluation');
    if (!box) return;
    const strategy = typeof getFoodStrategyForDate === 'function' ? getFoodStrategyForDate(date) : '';
    const warnings = [];
    if (item.timing === 'preworkout') {
        if ((Number(item.f) || 0) > 12) warnings.push('pred tréningom zníž tuk');
        if ((Number(item.fiber) || 0) > 8) warnings.push('pred tréningom zníž vlákninu');
        if (item.complexity === 'complex' && (Number(item.gi) || 0) < 55) warnings.push('tesne pred výkonom zvoľ ľahšie sacharidy');
    }
    if (item.timing === 'postworkout' && (Number(item.p) || 0) < 20) warnings.push('po výkone doplň viac bielkovín');
    box.innerHTML = `${strategy}${warnings.length ? `<br><strong>Úprava:</strong> ${warnings.join(', ')}.` : ''}`;
    box.style.display = 'block';
}

// 3. Bezpečné zmazanie jedla podľa ID
function deleteFoodItem(date, itemId) {
    const allData = Storage.get(STORAGE_KEYS.FOOD);
    if (!allData[date]) return;

    // Odstránenie konkrétneho jedla cez ID (nie indexu!)
    allData[date] = allData[date].filter(item => (item.id || item.createdAt) !== itemId);

    // Ak deň ostal prázdny, odstránime kľúč, aby sme neplnili pamäť prázdnymi poliami
    if (allData[date].length === 0) {
        delete allData[date];
    }

    Storage.save(STORAGE_KEYS.FOOD, allData);
    
    // REAKTÍVNY UPDATE
    initDashboard();
    loadFoodDay();
}

// 4. Integrácia do State Managementu (Doplnenie do setupStateWatchers z minulého kroku)
AppState.subscribe(() => {
    loadFoodDay(); // Kedykoľvek sa zmení dátum v AppState, jedlo sa automaticky načíta nanovo
    renderFoodDayMetrics();
});

window.addEventListener('DOMContentLoaded', () => {
    renderFoodPresets();
    renderPresetEditor();

    const editBtn = document.getElementById('btn-edit-food-presets');
    const modal = document.getElementById('food-preset-modal');
    const closeBtn = document.getElementById('btn-close-preset-editor');
    const saveBtn = document.getElementById('btn-save-preset-editor');
    const macroFilter = document.getElementById('preset-macro-filter');
    const editorSearch = document.getElementById('preset-editor-search');
    const foodSearch = DOM.get('f-search');
    const suggestions = DOM.get('food-suggestions');

    editBtn?.addEventListener('click', () => {
        renderPresetEditor(macroFilter?.value || 'Všetky', editorSearch?.value || '');
        modal?.classList.add('open');
    });

    macroFilter?.addEventListener('change', (event) => {
        renderPresetEditor(event.target.value, editorSearch?.value || '');
    });

    editorSearch?.addEventListener('input', () => {
        renderPresetEditor(macroFilter?.value || 'Všetky', editorSearch.value);
    });

    foodSearch?.addEventListener('input', renderFoodSuggestions);
    foodSearch?.addEventListener('focus', renderFoodSuggestions);
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.food-suggest-wrap')) suggestions?.classList.remove('open');
    });

    closeBtn?.addEventListener('click', () => modal?.classList.remove('open'));
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
    });

    saveBtn?.addEventListener('click', () => {
        const rows = document.querySelectorAll('#preset-editor-list .preset-editor-row');
        const presets = getFoodPresets();
        const updated = presets.map((preset) => ({ ...preset }));
        const deleted = new Set();

        rows.forEach((row) => {
            const index = Number(row.dataset.presetIndex);
            if (row.dataset.deleted === 'true') {
                deleted.add(index);
                return;
            }
            const inputs = row.querySelectorAll('input');
            if (!updated[index]) return;
            const kcal = Math.max(0, Number(inputs[2]?.value) || 0);
            const protein = Math.max(0, Number(inputs[3]?.value) || 0);
            const carbs = Math.max(0, Number(inputs[4]?.value) || 0);
            const sugar = Math.min(carbs, Math.max(0, Number(inputs[5]?.value) || 0));
            const fat = Math.max(0, Number(inputs[6]?.value) || 0);
            const gi = Math.max(0, Math.min(100, Number(inputs[7]?.value) || 0));
            const complexity = ['simple', 'medium', 'complex'].includes(inputs[8]?.value) ? inputs[8].value : 'medium';
            const fiber = Math.max(0, Number(inputs[9]?.value) || 0);
            updated[index] = {
                ...updated[index],
                name: inputs[0]?.value?.trim() || updated[index].name,
                category: inputs[1]?.value?.trim() || updated[index].category || 'Ostatné',
                kcal,
                p: protein,
                c: carbs,
                sugar,
                f: fat,
                gi,
                complexity,
                fiber
            };
        });

        saveFoodPresets(updated.filter((_, index) => !deleted.has(index)).map(normalizeFoodPreset));
        renderFoodPresets();
        renderFoodSuggestions();
        modal?.classList.remove('open');
    });

    document.getElementById('preset-editor-list')?.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-action="delete-preset"]');
        if (!btn) return;
        const row = btn.closest('.preset-editor-row');
        if (!row) return;
        row.dataset.deleted = 'true';
        row.style.opacity = '0.45';
        row.style.textDecoration = 'line-through';
    });
});

window.addEventListener('storage', () => {
    renderFoodPresets();
    renderPresetEditor();
    renderFoodDayMetrics();
});
