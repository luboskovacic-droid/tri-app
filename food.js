const FOOD_PRESET_STORAGE_KEY = 'tri_food_presets_v1';
const WATER_LOG_STORAGE_KEY = 'pwa_water_log';
const MEAL_ORDER = ['Raňajky', 'Desiata', 'Obed', 'Olovrant', 'Večera', 'Druhá večera', 'Nezaradené'];
let editingFoodRef = null;

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
        water: Math.max(0, Number(preset.water) || 0),
        salt: Math.max(0, Number(preset.salt) || 0),
        magnesium: Math.max(0, Number(preset.magnesium) || 0),
        potassium: Math.max(0, Number(preset.potassium) || 0),
        amino: Math.max(0, Number(preset.amino) || 0),
        category: preset.category || 'Ostatné'
    };
}

function calculateFoodKcalFromMacros(item) {
    const protein = Math.max(0, Number(item.p) || 0);
    const carbs = Math.max(0, Number(item.c) || 0);
    const fiber = Math.min(carbs, Math.max(0, Number(item.fiber) || 0));
    const fat = Math.max(0, Number(item.f) || 0);
    if (!protein && !carbs && !fiber && !fat) return Math.round(Number(item.kcal) || 0);
    const netCarbs = Math.max(0, carbs - fiber);
    return Math.round((protein * 4) + (netCarbs * 4) + (fiber * 2) + (fat * 9));
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
        f: Math.max(0, Number(DOM.get('f-f')?.value) || 0),
        gi: Math.max(0, Math.min(100, Number(DOM.get('f-gi')?.value) || 0)),
        complexity: DOM.get('f-complexity')?.value || 'medium',
        fiber: Math.max(0, Number(DOM.get('f-fiber')?.value) || 0),
        water: Math.max(0, Number(DOM.get('f-water')?.value) || 0),
        salt: Math.max(0, Number(DOM.get('f-salt')?.value) || 0),
        magnesium: Math.max(0, Number(DOM.get('f-magnesium')?.value) || 0),
        potassium: Math.max(0, Number(DOM.get('f-potassium')?.value) || 0),
        amino: Math.max(0, Number(DOM.get('f-amino')?.value) || 0)
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
        suggestions.innerHTML = `<button type="button" class="food-suggestion" data-action="open-new-food"><strong>Pridať novú surovinu</strong><span>${escapeFoodHtml(searchInput.value.trim() || 'Nová surovina')}</span></button>`;
        suggestions.classList.add('open');
        return;
    }

    matches.forEach((preset) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'food-suggestion';
        btn.innerHTML = `<strong>${escapeFoodHtml(preset.name)}</strong><span>${escapeFoodHtml(preset.category || 'Ostatné')} · ${preset.kcal} kcal · B ${preset.p} / S ${preset.c} / Cukry ${preset.sugar || 0} / T ${preset.f} · GI ${preset.gi || 0} · Mg ${preset.magnesium || 0}</span>`;
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

        const magnesiumInput = document.createElement('input');
        magnesiumInput.type = 'number';
        magnesiumInput.value = preset.magnesium || 0;
        magnesiumInput.placeholder = 'Mg';

        const saltInput = document.createElement('input');
        saltInput.type = 'number';
        saltInput.step = '0.1';
        saltInput.value = preset.salt || 0;
        saltInput.placeholder = 'Soľ';

        const potassiumInput = document.createElement('input');
        potassiumInput.type = 'number';
        potassiumInput.value = preset.potassium || 0;
        potassiumInput.placeholder = 'K';

        const aminoInput = document.createElement('input');
        aminoInput.type = 'number';
        aminoInput.step = '0.1';
        aminoInput.value = preset.amino || 0;
        aminoInput.placeholder = 'AMK';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'preset-btn';
        deleteBtn.textContent = 'Zmazať';
        deleteBtn.style.cssText = 'background:#e53e3e;color:#fff;';
        deleteBtn.dataset.action = 'delete-preset';
        deleteBtn.dataset.index = row.dataset.presetIndex;

        row.append(nameInput, categoryInput, kcalInput, pInput, cInput, sugarInput, fInput, giInput, complexityInput, fiberInput, magnesiumInput, saltInput, potassiumInput, aminoInput, deleteBtn);
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
    const waterInput = DOM.get('f-water');
    const saltInput = DOM.get('f-salt');
    const magnesiumInput = DOM.get('f-magnesium');
    const potassiumInput = DOM.get('f-potassium');
    const aminoInput = DOM.get('f-amino');
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
    if (waterInput) waterInput.value = preset.water || '';
    if (saltInput) saltInput.value = preset.salt || '';
    if (magnesiumInput) magnesiumInput.value = preset.magnesium || '';
    if (potassiumInput) potassiumInput.value = preset.potassium || '';
    if (aminoInput) aminoInput.value = preset.amino || '';
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
        macrosSpan.textContent = `B: ${item.p.toFixed(1)}g | S: ${item.c.toFixed(1)}g | Cukry: ${sugar.toFixed(1)}g | T: ${item.f.toFixed(1)}g | Vl: ${Number(item.fiber || 0).toFixed(1)}g | Mg: ${item.magnesium || 0}mg | GI: ${item.gi || 0}${timing}`;

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
        const editBtn = document.createElement('span');
        editBtn.style.cssText = 'color: #2b6cb0; font-size: 12px; cursor: pointer; user-select: none; margin-right:8px;';
        editBtn.textContent = 'Upraviť';
        
        // Bezpečné mazanie cez UUID
        const targetId = item.id || item.createdAt;
        editBtn.addEventListener('click', () => editLoggedFoodItem(date, targetId));
        deleteBtn.addEventListener('click', () => deleteFoodItem(date, targetId));

        rightDiv.append(kcalSpan, brRight, editBtn, deleteBtn);

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
    const waterInput = DOM.get('f-water');
    const saltInput = DOM.get('f-salt');
    const magnesiumInput = DOM.get('f-magnesium');
    const potassiumInput = DOM.get('f-potassium');
    const aminoInput = DOM.get('f-amino');

    const name = nameInput?.value.trim() || 'Jedlo';
    const weight = Math.max(0, parseFloat(weightInput?.value) || 100);
    const multiplier = weight / 100;

    // Extrakcia hodnôt na 100g s ochranou proti záporným číslam
    const getNutrient = (input) => Math.max(0, parseFloat(input?.value) || 0);

    const protein = Math.round(getNutrient(pInput) * multiplier * 10) / 10;
    const carbs = Math.round(getNutrient(cInput) * multiplier * 10) / 10;
    const sugar = Math.min(carbs, Math.round(getNutrient(sugarInput) * multiplier * 10) / 10);
    const fat = Math.round(getNutrient(fInput) * multiplier * 10) / 10;
    const fiber = Math.round(getNutrient(fiberInput) * multiplier * 10) / 10;
    const macroKcal = calculateFoodKcalFromMacros({ p: protein, c: carbs, fiber, f: fat });
    const labelKcal = Math.round(getNutrient(kcalInput) * multiplier);

    const existingId = editingFoodRef?.date === date ? editingFoodRef.itemId : null;
    const newItem = {
        id: existingId || crypto.randomUUID?.() || Date.now().toString(),
        name,
        meal: mealInput?.value || 'Raňajky',
        timing: timingInput?.value || 'normal',
        weight,
        kcal: macroKcal || labelKcal,
        p: protein,
        c: carbs,
        sugar,
        f: fat,
        gi: Math.max(0, Math.min(100, Number(giInput?.value) || 0)),
        complexity: complexityInput?.value || 'medium',
        fiber,
        water: Math.round(getNutrient(waterInput) * multiplier),
        salt: Math.round(getNutrient(saltInput) * multiplier * 10) / 10,
        magnesium: Math.round(getNutrient(magnesiumInput) * multiplier),
        potassium: Math.round(getNutrient(potassiumInput) * multiplier),
        amino: Math.round(getNutrient(aminoInput) * multiplier * 10) / 10,
        createdAt: new Date().toISOString()
    };

    const allData = Storage.get(STORAGE_KEYS.FOOD);
    allData[date] = allData[date] || [];
    if (existingId) {
        const index = allData[date].findIndex(item => (item.id || item.createdAt) === existingId);
        if (index >= 0) {
            allData[date][index] = { ...allData[date][index], ...newItem, id: existingId, updatedAt: new Date().toISOString() };
        } else {
            allData[date].push(newItem);
        }
    } else {
        allData[date].push(newItem);
    }

    Storage.save(STORAGE_KEYS.FOOD, allData);
    editingFoodRef = null;
    setFoodAddButtonMode(false);

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
        ['f-search', 'f-name', 'f-kcal', 'f-weight', 'f-p', 'f-c', 'f-sugar', 'f-f', 'f-gi', 'f-fiber', 'f-water', 'f-salt', 'f-magnesium', 'f-potassium', 'f-amino'].forEach(id => {
            const el = DOM.get(id);
            if (el) el.value = '';
        });
    }
    document.getElementById('food-entry-modal')?.classList.remove('open');
}

function formatFoodTiming(value) {
    if (value === 'preworkout') return 'Pre-workout';
    if (value === 'postworkout') return 'Post-workout';
    if (value === 'between') return 'Medzi tréningami';
    return 'Bežné';
}

function getFoodTotalsForDate(date) {
    const totals = (Storage.get(STORAGE_KEYS.FOOD)[date] || []).reduce((acc, item) => {
        acc.kcal += calculateFoodKcalFromMacros(item);
        acc.p += Number(item.p) || 0;
        acc.c += Number(item.c) || 0;
        acc.sugar += Math.min(Number(item.c) || 0, Math.max(0, Number(item.sugar) || 0));
        acc.f += Number(item.f) || 0;
        acc.fiber += Number(item.fiber) || 0;
        acc.water += Number(item.water) || 0;
        acc.salt += Number(item.salt) || 0;
        acc.magnesium += Number(item.magnesium) || 0;
        acc.potassium += Number(item.potassium) || 0;
        acc.amino += Number(item.amino) || 0;
        return acc;
    }, { kcal: 0, p: 0, c: 0, sugar: 0, f: 0, fiber: 0, water: 0, salt: 0, magnesium: 0, potassium: 0, amino: 0 });
    totals.water += getWaterTotalForDate(date);
    return totals;
}

function setFoodRing(id, textId, current, target) {
    const ring = DOM.get(id);
    const text = DOM.get(textId);
    const pct = target > 0 ? current / target : 0;
    const degrees = Math.min(360, pct * 360);
    let color = '#3182ce';
    if (target <= 0) color = '#48bb78';
    else if (pct < 0.85) color = '#3182ce';
    else if (pct < 0.98) color = '#4299e1';
    else if (pct <= 1.05) color = '#48bb78';
    else if (pct >= 1.5) color = '#e53e3e';
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
    setFoodRing('food-ring-kcal', 'food-ring-kcal-text', totals.kcal, targets.kcal || 0);
    setFoodRing('food-ring-c', 'food-ring-c-text', totals.c, targets.c);
    setFoodRing('food-ring-p', 'food-ring-p-text', totals.p, targets.p);
    setFoodRing('food-ring-f', 'food-ring-f-text', totals.f, targets.f);
    setFoodRing('food-ring-sugar', 'food-ring-sugar-text', totals.sugar, targets.sugar);
    setFoodRing('food-ring-fiber', 'food-ring-fiber-text', totals.fiber || 0, Math.max(20, Math.round(getAthleteWeight?.() * 0.35 || 25)));
    renderHydrationMetrics(date, totals);
    renderFoodTimeline(date);
    renderCarbloadFoodSuggestions(date);
}

function renderHydrationMetrics(date, totals = getFoodTotalsForDate(date)) {
    const target = typeof getHydrationTargetsForDate === 'function'
        ? getHydrationTargetsForDate(date)
        : { min: 2000, max: 3000 };
    const hydrationEl = DOM.get('hydration-target');
    const saltEl = DOM.get('salt-total');
    const magnesiumEl = DOM.get('magnesium-total');
    const potassiumEl = DOM.get('potassium-total');
    if (hydrationEl) hydrationEl.textContent = `${(totals.water / 1000).toFixed(1)} / ${(target.min / 1000).toFixed(1)}-${(target.max / 1000).toFixed(1)} l`;
    if (saltEl) saltEl.textContent = `${totals.salt.toFixed(1)}g`;
    if (magnesiumEl) magnesiumEl.textContent = `${Math.round(totals.magnesium)}mg`;
    if (potassiumEl) potassiumEl.textContent = `${Math.round(totals.potassium)}mg`;
    renderWaterPanel(date, totals.water, target);
}

function getWaterLog() {
    try {
        return JSON.parse(localStorage.getItem(WATER_LOG_STORAGE_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function saveWaterLog(log) {
    localStorage.setItem(WATER_LOG_STORAGE_KEY, JSON.stringify(log));
}

function getWaterEntriesForDate(date = AppState.selectedDate) {
    const items = getWaterLog()[date] || [];
    return Array.isArray(items) ? items : [];
}

function getWaterTotalForDate(date = AppState.selectedDate) {
    return getWaterEntriesForDate(date).reduce((sum, item) => sum + (Number(item.ml) || 0), 0);
}

function addWaterEntry(ml, date = AppState.selectedDate) {
    const amount = Math.max(0, Math.round(Number(ml) || 0));
    if (!amount) return;
    const log = getWaterLog();
    log[date] = log[date] || [];
    log[date].push({
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        ml: amount,
        time: new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString()
    });
    saveWaterLog(log);
    initDashboard();
    renderFoodDayMetrics(date);
}

function deleteWaterEntry(date, id) {
    const log = getWaterLog();
    if (!Array.isArray(log[date])) return;
    log[date] = log[date].filter(item => item.id !== id);
    if (!log[date].length) delete log[date];
    saveWaterLog(log);
    initDashboard();
    renderFoodDayMetrics(date);
}

function renderWaterPanel(date, waterMl, target) {
    const ring = DOM.get('hydration-ring');
    const ringText = DOM.get('hydration-ring-text');
    const ringSubtext = DOM.get('hydration-ring-subtext');
    const status = DOM.get('hydration-status');
    const nextStep = DOM.get('hydration-next-step');
    const logList = DOM.get('water-log-list');
    const min = Math.max(1, Number(target.min) || 2000);
    const max = Math.max(min, Number(target.max) || min);
    const pct = waterMl / min;
    const degrees = Math.min(360, pct * 360);
    let color = '#3182ce';
    let label = 'Doplň vodu.';
    let step = 'Daj si teraz 250-500 ml a nerieš to v hlave.';

    if (pct >= 1 && waterMl <= max) {
        color = '#10b981';
        label = 'Hydratácia splnená.';
        step = 'Drž už len malé dávky podľa smädu a tréningu.';
    } else if (pct >= 0.75) {
        color = '#38bdf8';
        label = 'Už si blízko cieľa.';
        step = `Chýba približne ${Math.max(0, Math.round((min - waterMl) / 50) * 50)} ml.`;
    } else if (pct < 0.35) {
        color = '#f97316';
        label = 'Voda zaostáva.';
        step = 'Najbližší krok: 500 ml, potom jedlo alebo tréning.';
    }

    if (waterMl > max) {
        color = '#f59e0b';
        label = 'Už si nad horným rozsahom.';
        step = 'Ďalej už radšej po dúškoch, sleduj soľ a tréning.';
    }

    if (ring) ring.style.background = `conic-gradient(${color} ${degrees}deg,#e2e8f0 ${degrees}deg)`;
    if (ringText) ringText.textContent = `${Math.round(Math.min(1.25, pct) * 100)}%`;
    if (ringSubtext) ringSubtext.textContent = `${(waterMl / 1000).toFixed(1)} l`;
    if (status) status.textContent = label;
    if (nextStep) nextStep.textContent = step;

    if (!logList) return;
    const entries = getWaterEntriesForDate(date).slice().reverse();
    if (!entries.length) {
        logList.innerHTML = '<span style="color:#718096;">Zatiaľ bez samostatnej vody.</span>';
        return;
    }
    logList.innerHTML = entries.map(item => (
        `<div class="water-log-item"><span>${item.time || '--:--'} · ${item.ml} ml</span><button type="button" class="preset-btn" data-water-delete="${item.id}" style="background:#edf2f7;color:#2d3748;padding:4px 8px;">Zmazať</button></div>`
    )).join('');
}

function renderCarbloadFoodSuggestions(date = AppState.selectedDate) {
    const el = DOM.get('carbload-food-suggestions');
    if (!el) return;
    el.innerHTML = '';
    return;
    const mealPlan = buildDailyMealPlanSuggestions(date);
    if (mealPlan.length) {
        el.innerHTML = mealPlan.map((meal, index) => {
            const foods = meal.foods.map(food => (
                `<div style="font-size:12px;color:#4a5568;">${escapeFoodHtml(food.name)} · ${food.grams}g · B ${food.p.toFixed(0)} / S ${food.c.toFixed(0)} / T ${food.f.toFixed(0)}</div>`
            )).join('');
            return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px;background:#fff;">
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:start;">
                    <div><strong>${escapeFoodHtml(meal.meal)}</strong><br><span style="font-size:11px;color:#718096;">${escapeFoodHtml(meal.note)} · cieľ B ${meal.targets.p} / S ${meal.targets.c} / T ${meal.targets.f}</span></div>
                    <button type="button" class="preset-btn" data-meal-plan-add="${index}" style="background:#2b6cb0;color:#fff;">Zapísať</button>
                </div>
                <div style="display:grid;gap:3px;margin-top:6px;">${foods}</div>
            </div>`;
        }).join('');
        return;
    }

    const plan = typeof buildCarbloadPlanForDate === 'function' ? buildCarbloadPlanForDate(date) : null;
    if (!plan || !plan.carbs) {
        el.innerHTML = '<span style="font-size:12px;color:#718096;">Bez carbload cieľa.</span>';
        return;
    }

    if (plan.kind === 'event' && typeof buildMealTimesForPlan === 'function') {
        const sugarRatio = plan.carbs > 0 ? (Number(plan.sugar) || 0) / plan.carbs : 0;
        el.innerHTML = buildMealTimesForPlan(plan).map(slot => (
            `<button type="button" class="preset-btn" style="text-align:left;background:#edf2f7;color:#2d3748;">${escapeFoodHtml(slot.time)} · ${escapeFoodHtml(slot.label || 'jedlo')} · ${slot.grams}g S · cukry max ${Math.round(slot.grams * sugarRatio)}g</button>`
        )).join('');
        return;
    }

    const remaining = Math.max(0, plan.carbs - getFoodTotalsForDate(date).c);
    const scorePreset = (item) => {
        const carbs = Number(item.c) || 0;
        const sugarRatio = carbs > 0 ? (Number(item.sugar) || 0) / carbs : 1;
        const gi = Number(item.gi) || 55;
        const fiber = Number(item.fiber) || 0;
        const complexity = item.complexity || 'medium';
        return (complexity === 'complex' ? 35 : complexity === 'medium' ? 15 : -35)
            + Math.max(0, 75 - gi)
            + Math.min(20, fiber * 3)
            - (sugarRatio * 60)
            - Math.max(0, (Number(item.f) || 0) - 6) * 3;
    };
    let suggestions = getFoodPresets()
        .filter(item => {
            const carbs = Number(item.c) || 0;
            const sugarRatio = carbs > 0 ? (Number(item.sugar) || 0) / carbs : 1;
            return carbs >= 12
                && sugarRatio <= 0.35
                && (Number(item.f) || 0) <= 10
                && (Number(item.gi) || 55) <= 75
                && item.complexity !== 'simple';
        })
        .sort((a, b) => scorePreset(b) - scorePreset(a))
        .slice(0, 4);

    if (!suggestions.length) {
        suggestions = getFoodPresets()
            .filter(item => (Number(item.c) || 0) >= 12 && (Number(item.sugar) || 0) <= 12 && (Number(item.f) || 0) <= 10)
            .sort((a, b) => scorePreset(b) - scorePreset(a))
            .slice(0, 4);
    }

    if (!suggestions.length) {
        el.innerHTML = '<span style="font-size:12px;color:#718096;">Doplň v databáze komplexné sacharidy s nízkym cukrom.</span>';
        return;
    }

    el.innerHTML = suggestions.map(item => {
        const carbs = Math.max(1, Number(item.c) || 1);
        const grams = Math.min(180, Math.max(60, Math.round((remaining / Math.max(1, suggestions.length) / carbs) * 100)));
        const gi = Number(item.gi) || 55;
        return `<button type="button" class="preset-btn" data-carb-suggest="${escapeFoodHtml(item.name)}" style="text-align:left;background:#edf2f7;color:#2d3748;">${escapeFoodHtml(item.name)} · cca ${grams}g · komplexné S ${item.c}g · cukry ${item.sugar || 0}g · vláknina ${item.fiber || 0}g · GI ${gi}</button>`;
    }).join('');
}

function getMealPlanSplits(contextType, planKind) {
    if (contextType === 'race' || planKind === 'event') {
        return [
            { meal: 'Raňajky', p: 0.25, c: 0.55, f: 0.15, note: '3 h pred štartom normálne jedlo', timing: 'preworkout' },
            { meal: 'Obed', p: 0.35, c: 0.25, f: 0.35, note: 'po výkone normálne jedlo', timing: 'postworkout' },
            { meal: 'Večera', p: 0.40, c: 0.20, f: 0.50, note: 'doplní bielkoviny a minerály', timing: 'normal' }
        ];
    }
    if (contextType === 'strength') {
        return [
            { meal: 'Raňajky', p: 0.30, c: 0.25, f: 0.30, note: 'stabilná energia', timing: 'normal' },
            { meal: 'Obed', p: 0.35, c: 0.45, f: 0.30, note: 'okolo tréningu viac sacharidov', timing: 'preworkout' },
            { meal: 'Večera', p: 0.35, c: 0.30, f: 0.40, note: 'regenerácia po sile', timing: 'postworkout' }
        ];
    }
    if (contextType === 'rest') {
        return [
            { meal: 'Raňajky', p: 0.32, c: 0.30, f: 0.32, note: 'voľno, nižšie sacharidy', timing: 'normal' },
            { meal: 'Obed', p: 0.36, c: 0.40, f: 0.36, note: 'hlavné jedlo dňa', timing: 'normal' },
            { meal: 'Večera', p: 0.32, c: 0.30, f: 0.32, note: 'ľahšia večera', timing: 'normal' }
        ];
    }
    return [
        { meal: 'Raňajky', p: 0.28, c: 0.30, f: 0.25, note: 'štart energie', timing: 'normal' },
        { meal: 'Obed', p: 0.36, c: 0.45, f: 0.35, note: 'hlavné tréningové jedlo', timing: 'preworkout' },
        { meal: 'Večera', p: 0.36, c: 0.25, f: 0.40, note: 'regenerácia', timing: 'postworkout' }
    ];
}

function scorePresetForMacro(item, macro, contextType) {
    const p = Number(item.p) || 0;
    const c = Number(item.c) || 0;
    const f = Number(item.f) || 0;
    const sugarRatio = c > 0 ? (Number(item.sugar) || 0) / c : 0;
    const fiber = Number(item.fiber) || 0;
    const complexity = item.complexity || 'medium';
    if (macro === 'p') return (p * 3) - (f * 0.7) - (sugarRatio * 8);
    if (macro === 'f') return (f * 2) + (p * 0.2) - (sugarRatio * 10);
    const complexBonus = complexity === 'complex' ? 18 : complexity === 'simple' ? -18 : 6;
    const racePenalty = contextType === 'race' ? Math.max(0, fiber - 4) * 3 : 0;
    return (c * 2) + complexBonus + Math.min(12, fiber * 2) - (sugarRatio * 35) - (f * 0.8) - racePenalty;
}

function pickPresetForMacro(presets, macro, usedNames, contextType) {
    return presets
        .filter(item => !usedNames.has(item.name))
        .filter(item => {
            if (macro === 'p') return (Number(item.p) || 0) >= 8;
            if (macro === 'f') return (Number(item.f) || 0) >= 6;
            return (Number(item.c) || 0) >= 10;
        })
        .sort((a, b) => scorePresetForMacro(b, macro, contextType) - scorePresetForMacro(a, macro, contextType))[0] || null;
}

function plannedFoodFromPreset(preset, grams, meal, timing) {
    const multiplier = grams / 100;
    const p = Math.round((Number(preset.p) || 0) * multiplier * 10) / 10;
    const c = Math.round((Number(preset.c) || 0) * multiplier * 10) / 10;
    const f = Math.round((Number(preset.f) || 0) * multiplier * 10) / 10;
    const fiber = Math.round((Number(preset.fiber) || 0) * multiplier * 10) / 10;
    const sugar = Math.min(c, Math.round((Number(preset.sugar) || 0) * multiplier * 10) / 10);
    const item = {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        name: preset.name,
        meal,
        timing,
        weight: grams,
        p,
        c,
        sugar,
        f,
        gi: Number(preset.gi) || 0,
        complexity: preset.complexity || 'medium',
        fiber,
        water: Math.round((Number(preset.water) || 0) * multiplier),
        salt: Math.round((Number(preset.salt) || 0) * multiplier * 10) / 10,
        magnesium: Math.round((Number(preset.magnesium) || 0) * multiplier),
        potassium: Math.round((Number(preset.potassium) || 0) * multiplier),
        amino: Math.round((Number(preset.amino) || 0) * multiplier * 10) / 10,
        createdAt: new Date().toISOString()
    };
    item.kcal = calculateFoodKcalFromMacros(item);
    return item;
}

function buildDailyMealPlanSuggestions(date = AppState.selectedDate) {
    const presets = getFoodPresets();
    if (!presets.length || typeof getMacroTargetsForDate !== 'function') return [];
    const totals = getFoodTotalsForDate(date);
    const targets = getMacroTargetsForDate(date);
    const contextType = targets.context?.type || 'rest';
    const carbPlan = typeof buildCarbloadPlanForDate === 'function' ? buildCarbloadPlanForDate(date) : null;
    const remaining = {
        p: Math.max(0, targets.p - totals.p),
        c: Math.max(0, targets.c - totals.c),
        f: Math.max(0, targets.f - totals.f)
    };
    if ((remaining.p + remaining.c + remaining.f) < 25) return [];

    const usedNames = new Set();
    return getMealPlanSplits(contextType, carbPlan?.kind).map(split => {
        const mealTargets = {
            p: Math.round(remaining.p * split.p),
            c: Math.round(remaining.c * split.c),
            f: Math.round(remaining.f * split.f)
        };
        const foods = [];
        const carbPreset = pickPresetForMacro(presets, 'c', usedNames, contextType);
        if (carbPreset) {
            usedNames.add(carbPreset.name);
            foods.push(plannedFoodFromPreset(carbPreset, Math.min(260, Math.max(50, Math.round((mealTargets.c / Math.max(1, Number(carbPreset.c) || 1)) * 100))), split.meal, split.timing));
        }
        const proteinPreset = pickPresetForMacro(presets, 'p', usedNames, contextType);
        if (proteinPreset) {
            usedNames.add(proteinPreset.name);
            foods.push(plannedFoodFromPreset(proteinPreset, Math.min(240, Math.max(60, Math.round((mealTargets.p / Math.max(1, Number(proteinPreset.p) || 1)) * 100))), split.meal, split.timing));
        }
        const fatPreset = mealTargets.f > 8 ? pickPresetForMacro(presets, 'f', usedNames, contextType) : null;
        if (fatPreset) {
            usedNames.add(fatPreset.name);
            foods.push(plannedFoodFromPreset(fatPreset, Math.min(80, Math.max(15, Math.round((mealTargets.f / Math.max(1, Number(fatPreset.f) || 1)) * 100))), split.meal, split.timing));
        }
        return { meal: split.meal, note: `${targets.context?.label || 'Deň'}: ${split.note}`, targets: mealTargets, foods };
    }).filter(meal => meal.foods.length);
}

function addSuggestedMealToDay(mealIndex, date = AppState.selectedDate) {
    const meal = buildDailyMealPlanSuggestions(date)[mealIndex];
    if (!meal || !meal.foods.length) return;
    const allData = Storage.get(STORAGE_KEYS.FOOD);
    allData[date] = allData[date] || [];
    allData[date].push(...meal.foods.map(food => ({ ...food, id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString() })));
    Storage.save(STORAGE_KEYS.FOOD, allData);
    initDashboard();
    loadFoodDay();
    renderFoodDayMetrics(date);
}

function getCoachPantryPresets() {
    const current = getFoodPresets();
    const fallback = [
        { name: 'Ryža', category: 'Karbóny', kcal: 130, p: 2.7, c: 28, sugar: 0.1, f: 0.3, gi: 64, complexity: 'complex', fiber: 0.4, salt: 0.01, potassium: 35 },
        { name: 'Zemiaky', category: 'Karbóny', kcal: 77, p: 2, c: 17, sugar: 0.8, f: 0.1, gi: 65, complexity: 'complex', fiber: 2.2, salt: 0.01, potassium: 425 },
        { name: 'Ovsené vločky', category: 'Karbóny', kcal: 389, p: 16.9, c: 66.3, sugar: 0.9, f: 6.9, gi: 55, complexity: 'complex', fiber: 10.6, salt: 0.02, magnesium: 177 },
        { name: 'Chlieb', category: 'Karbóny', kcal: 265, p: 9, c: 49, sugar: 5, f: 3.2, gi: 65, complexity: 'medium', fiber: 6, salt: 0.45 },
        { name: 'Kuskus', category: 'Karbóny', kcal: 112, p: 3.8, c: 23.2, sugar: 0.1, f: 0.2, gi: 65, complexity: 'complex', fiber: 1.4, salt: 0.01 },
        { name: 'Quinoa', category: 'Karbóny', kcal: 120, p: 4.4, c: 21.3, sugar: 0.9, f: 1.9, gi: 53, complexity: 'complex', fiber: 2.8, salt: 0.01 },
        { name: 'Celozrnné cestoviny', category: 'Karbóny', kcal: 150, p: 5.8, c: 30, sugar: 1.1, f: 1.2, gi: 48, complexity: 'complex', fiber: 4.5, salt: 0.02 },
        { name: 'Kuracie prsia', category: 'Proteíny', kcal: 165, p: 31, c: 0, sugar: 0, f: 3.6, gi: 0, complexity: 'medium', salt: 0.18, potassium: 256 },
        { name: 'Losos', category: 'Proteíny', kcal: 208, p: 20, c: 0, sugar: 0, f: 13, gi: 0, complexity: 'medium', salt: 0.15, potassium: 363 },
        { name: 'Morčacie prsia', category: 'Proteíny', kcal: 135, p: 29, c: 0, sugar: 0, f: 1.5, gi: 0, complexity: 'medium', salt: 0.18, potassium: 240 },
        { name: 'Tvaroh', category: 'Mliečne', kcal: 98, p: 11.1, c: 3.3, sugar: 3.3, f: 4.3, gi: 30, complexity: 'medium', salt: 0.09 },
        { name: 'Jogurt natural', category: 'Mliečne', kcal: 61, p: 3.5, c: 4.7, sugar: 4.7, f: 3, gi: 35, complexity: 'medium', salt: 0.05 },
        { name: 'Vajcia', category: 'Proteíny', kcal: 155, p: 13, c: 1.1, sugar: 1.1, f: 11, gi: 0, complexity: 'medium', salt: 0.31 },
        { name: 'Banán', category: 'Ovocie', kcal: 89, p: 1.1, c: 22.8, sugar: 12.2, f: 0.3, gi: 52, complexity: 'medium', fiber: 2.6, potassium: 358 },
        { name: 'Jablko', category: 'Ovocie', kcal: 52, p: 0.3, c: 14, sugar: 10.4, f: 0.2, gi: 38, complexity: 'medium', fiber: 2.4, potassium: 107 },
        { name: 'Avokádo', category: 'Tuky', kcal: 160, p: 2, c: 8.5, sugar: 0.7, f: 14.7, gi: 15, complexity: 'complex', fiber: 6.7, potassium: 485 }
    ].map(normalizeFoodPreset);

    fallback.forEach(item => {
        if (!current.some(existing => existing.name.toLowerCase() === item.name.toLowerCase())) current.push(item);
    });
    return current;
}

function getCoachMealProfile(mealKey) {
    const profiles = {
        breakfast: {
            carb: ['Ovsené vločky', 'Chlieb', 'Quinoa', 'Zemiaky'],
            protein: ['Tvaroh', 'Jogurt natural', 'Vajcia', 'Mlieko'],
            fat: ['Vajcia', 'Avokádo', 'Arašidy'],
            banned: ['Ryža', 'Kuracie prsia', 'Hovädzina', 'Tuniak', 'Kuskus', 'Celozrnné cestoviny', 'Müsli']
        },
        snack1: {
            carb: ['Chlieb', 'Ovsené vločky', 'Zemiaky', 'Quinoa', 'Jablko', 'Banán'],
            protein: ['Jogurt natural', 'Tvaroh', 'Mlieko'],
            fat: ['Arašidy', 'Avokádo'],
            banned: ['Ryža', 'Kuracie prsia', 'Hovädzina', 'Müsli']
        },
        lunch: {
            carb: ['Ryža', 'Zemiaky', 'Kuskus', 'Quinoa', 'Celozrnné cestoviny', 'Těstoviny'],
            protein: ['Kuracie prsia', 'Morčacie prsia', 'Tuniak', 'Hovädzina', 'Lentilky'],
            fat: ['Avokádo', 'Syr'],
            banned: ['Ovsené vločky', 'Müsli', 'Jogurt natural']
        },
        snack2: {
            carb: ['Zemiaky', 'Chlieb', 'Quinoa', 'Ovsené vločky', 'Jablko', 'Banán'],
            protein: ['Tvaroh', 'Jogurt natural', 'Vajcia', 'Tuniak'],
            fat: ['Arašidy', 'Avokádo'],
            banned: ['Ryža', 'Kuracie prsia', 'Hovädzina', 'Müsli']
        },
        dinner: {
            carb: ['Zemiaky', 'Quinoa', 'Celozrnné cestoviny', 'Kuskus', 'Ryža'],
            protein: ['Losos', 'Tuniak', 'Vajcia', 'Morčacie prsia', 'Kuracie prsia', 'Tvaroh'],
            fat: ['Avokádo', 'Vajcia', 'Losos'],
            banned: ['Ovsené vločky', 'Müsli']
        }
    };
    return profiles[mealKey] || profiles.lunch;
}

function pickCoachPreset(presets, role, usedNames, contextType, mealKey) {
    const profile = getCoachMealProfile(mealKey);
    const names = profile[role] || [];
    const globallyUsed = new Set([...usedNames].map(value => String(value).split(':').pop()));
    const isSnack = mealKey === 'snack1' || mealKey === 'snack2';
    const candidates = presets.filter(item => !globallyUsed.has(item.name)).filter(item => {
        if ((profile.banned || []).includes(item.name)) return false;
        const c = Number(item.c) || 0;
        const p = Number(item.p) || 0;
        const f = Number(item.f) || 0;
        const sugarRatio = c > 0 ? (Number(item.sugar) || 0) / c : 0;
        const salt = Number(item.salt) || 0;
        if (salt > 0.8) return false;
        if (role === 'carb') return c >= 10 && sugarRatio <= (isSnack ? 0.28 : contextType === 'race' ? 0.35 : 0.30) && f <= 9;
        if (role === 'protein') return p >= 3 && f <= 18 && sugarRatio <= 0.75;
        return f >= 6 && sugarRatio <= 0.25;
    });
    return candidates.sort((a, b) => {
        const ai = names.indexOf(a.name);
        const bi = names.indexOf(b.name);
        const ap = ai >= 0 ? 1000 - (ai * 20) : 0;
        const bp = bi >= 0 ? 1000 - (bi * 20) : 0;
        const sameMealPenaltyA = usedNames.has(`${mealKey}:${a.name}`) ? -500 : 0;
        const sameMealPenaltyB = usedNames.has(`${mealKey}:${b.name}`) ? -500 : 0;
        return (bp + sameMealPenaltyB) - (ap + sameMealPenaltyA)
            || scorePresetForMacro(b, role === 'protein' ? 'p' : role === 'fat' ? 'f' : 'c', contextType) - scorePresetForMacro(a, role === 'protein' ? 'p' : role === 'fat' ? 'f' : 'c', contextType);
    })[0] || null;
}

function clampCoachGrams(value, min, max) {
    return Math.round(Math.min(max, Math.max(min, value)) / 5) * 5;
}

function getCoachGramBounds(role, mealKey, carbPlan) {
    const bounds = {
        breakfast: { carb: [70, carbPlan ? 180 : 220], protein: [100, 260], fat: [20, 70] },
        snack1: { carb: [60, 180], protein: [90, 190], fat: [10, 35] },
        lunch: { carb: [130, carbPlan ? 420 : 380], protein: [120, 320], fat: [25, 95] },
        snack2: { carb: [60, 190], protein: [80, 200], fat: [10, 35] },
        dinner: { carb: [110, carbPlan ? 360 : 340], protein: [120, 320], fat: [25, 100] }
    };
    return (bounds[mealKey] && bounds[mealKey][role]) || [60, 240];
}

function shouldUseCoachSnacks(carbPlan) {
    return Boolean(carbPlan && carbPlan.kind === 'prev' && Number(carbPlan.carbs) > 0);
}

function getCoachMealSplits(contextType, carbPlan) {
    if (shouldUseCoachSnacks(carbPlan)) {
        return [
            { meal: 'Raňajky', key: 'breakfast', timing: 'normal', p: 0.20, c: 0.22, f: 0.18, note: 'stabilný štart carbloadu, nízky cukor' },
            { meal: 'Desiata', key: 'snack1', timing: 'normal', p: 0.12, c: 0.18, f: 0.08, note: 'komplexné sacharidy, nie sladkosť' },
            { meal: 'Obed', key: 'lunch', timing: 'normal', p: 0.30, c: 0.30, f: 0.28, note: 'hlavná porcia dňa pred výkonom' },
            { meal: 'Olovrant', key: 'snack2', timing: 'normal', p: 0.12, c: 0.14, f: 0.08, note: 'doplnenie carbloadu bez cukrového úletu' },
            { meal: 'Večera', key: 'dinner', timing: 'normal', p: 0.26, c: 0.16, f: 0.38, note: 'ľahšia regenerácia, bez prehnanej soli' }
        ];
    }

    if (contextType === 'strength') {
        return [
            { meal: 'Raňajky', key: 'breakfast', timing: 'normal', p: 0.30, c: 0.25, f: 0.26, note: 'väčšia stabilná porcia bez sladkého zobkania' },
            { meal: 'Obed', key: 'lunch', timing: 'preworkout', p: 0.38, c: 0.46, f: 0.34, note: 'hlavné jedlo okolo tréningu' },
            { meal: 'Večera', key: 'dinner', timing: 'postworkout', p: 0.32, c: 0.29, f: 0.40, note: 'regenerácia po sile' }
        ];
    }

    if (contextType === 'rest') {
        return [
            { meal: 'Raňajky', key: 'breakfast', timing: 'normal', p: 0.33, c: 0.30, f: 0.30, note: 'sýte raňajky, menej rýchlych cukrov' },
            { meal: 'Obed', key: 'lunch', timing: 'normal', p: 0.38, c: 0.42, f: 0.36, note: 'hlavná porcia, nech netreba sladké' },
            { meal: 'Večera', key: 'dinner', timing: 'normal', p: 0.29, c: 0.28, f: 0.34, note: 'ľahšia večera, stále dosť bielkovín' }
        ];
    }

    return [
        { meal: 'Raňajky', key: 'breakfast', timing: 'normal', p: 0.28, c: 0.30, f: 0.26, note: 'štart energie bez sladkého zobkania' },
        { meal: 'Obed', key: 'lunch', timing: 'preworkout', p: 0.40, c: 0.45, f: 0.34, note: 'väčšie tréningové jedlo' },
        { meal: 'Večera', key: 'dinner', timing: 'postworkout', p: 0.32, c: 0.25, f: 0.40, note: 'regenerácia a sýtosť' }
    ];
}

function buildCoachMealPlan(date = AppState.selectedDate) {
    const targets = getMacroTargetsForDate(date);
    const totals = getFoodTotalsForDate(date);
    const remaining = {
        p: Math.max(0, targets.p - totals.p),
        c: Math.max(0, targets.c - totals.c),
        f: Math.max(0, targets.f - totals.f),
        sugar: Math.max(0, targets.sugar - totals.sugar)
    };
    const contextType = targets.context?.type || 'rest';
    const carbPlan = typeof buildCarbloadPlanForDate === 'function' ? buildCarbloadPlanForDate(date) : null;
    const splits = getCoachMealSplits(contextType, carbPlan);
    const sugarCeiling = Math.max(12, Math.round((remaining.sugar || targets.sugar || 40) / splits.length));
    const usesSnacks = shouldUseCoachSnacks(carbPlan);
    const presets = getCoachPantryPresets();
    const usedNames = new Set();
    const meals = splits.map(split => {
        const targetsForMeal = {
            p: Math.round(remaining.p * split.p),
            c: Math.round(remaining.c * split.c),
            f: Math.round(remaining.f * split.f),
            sugarMax: sugarCeiling + (usesSnacks && split.key === 'snack1' ? Math.round(sugarCeiling * 0.25) : 0)
        };
        const foods = [];
        const carbPreset = pickCoachPreset(presets, 'carb', usedNames, contextType, split.key);
        const proteinPreset = pickCoachPreset(presets, 'protein', usedNames, contextType, split.key);
        const fatPreset = targetsForMeal.f > 7 ? pickCoachPreset(presets, 'fat', usedNames, contextType, split.key) : null;

        if (carbPreset && targetsForMeal.c > 5) {
            usedNames.add(`${split.key}:${carbPreset.name}`);
            const [min, max] = getCoachGramBounds('carb', split.key, carbPlan);
            foods.push(plannedFoodFromPreset(carbPreset, clampCoachGrams((targetsForMeal.c / Math.max(1, Number(carbPreset.c) || 1)) * 100, min, max), split.meal, split.timing));
        }
        if (proteinPreset && targetsForMeal.p > 5) {
            usedNames.add(`${split.key}:${proteinPreset.name}`);
            const [min, max] = getCoachGramBounds('protein', split.key, carbPlan);
            foods.push(plannedFoodFromPreset(proteinPreset, clampCoachGrams((targetsForMeal.p / Math.max(1, Number(proteinPreset.p) || 1)) * 100, min, max), split.meal, split.timing));
        }
        if (fatPreset && targetsForMeal.f > 7) {
            usedNames.add(`${split.key}:${fatPreset.name}`);
            const [min, max] = getCoachGramBounds('fat', split.key, carbPlan);
            foods.push(plannedFoodFromPreset(fatPreset, clampCoachGrams((targetsForMeal.f / Math.max(1, Number(fatPreset.f) || 1)) * 100, min, max), split.meal, split.timing));
        }

        const mealSugar = foods.reduce((sum, item) => sum + (Number(item.sugar) || 0), 0);
        if (mealSugar > targetsForMeal.sugarMax) {
            foods.forEach(food => {
                if ((Number(food.sugar) || 0) > 6 && Number(food.c) > 0) {
                    const ratio = targetsForMeal.sugarMax / Math.max(1, mealSugar);
                    food.weight = clampCoachGrams(food.weight * ratio, 40, food.weight);
                    const source = presets.find(preset => preset.name === food.name);
                    if (source) Object.assign(food, plannedFoodFromPreset(source, food.weight, split.meal, split.timing));
                }
            });
        }

        return { ...split, targets: targetsForMeal, foods };
    }).filter(meal => meal.foods.length);

    return {
        date,
        note: usesSnacks
            ? `${targets.context?.label || 'Deň'}: deň pred výkonom s carbloadom, preto pridávam desiatu a olovrant. Sacharidy sú komplexné, sladké držím nízko.`
            : `${targets.context?.label || 'Deň'}: bez rozloženého carbloadu držím 3 väčšie jedlá, aby nevznikal priestor na sladké blbosti.`,
        meals
    };
}

function renderCoachMealPlan(date = AppState.selectedDate) {
    const el = document.getElementById('coach-meal-plan');
    if (!el) return;
    const plan = buildCoachMealPlan(date);
    if (!plan.meals.length) {
        el.innerHTML = '<span style="font-size:12px;color:#718096;">Ciele sú už takmer splnené.</span>';
        return;
    }
    el.dataset.planDate = date;
    el.innerHTML = `<div class="info-box" style="margin:0;background:#ebf8ff;border-left-color:#3182ce;">${escapeFoodHtml(plan.note)}</div>` + plan.meals.map((meal, index) => {
        const totals = meal.foods.reduce((acc, item) => {
            acc.p += Number(item.p) || 0;
            acc.c += Number(item.c) || 0;
            acc.f += Number(item.f) || 0;
            acc.sugar += Number(item.sugar) || 0;
            acc.salt += Number(item.salt) || 0;
            return acc;
        }, { p: 0, c: 0, f: 0, sugar: 0, salt: 0 });
        return `<div class="coach-meal">
            <strong>${escapeFoodHtml(meal.meal)}</strong>
            <span>${escapeFoodHtml(meal.note)} · B ${Math.round(totals.p)} / S ${Math.round(totals.c)} / T ${Math.round(totals.f)} · cukry ${Math.round(totals.sugar)}g · soľ ${totals.salt.toFixed(1)}g</span>
            <ul>${meal.foods.map(food => `<li>${escapeFoodHtml(food.name)} ${food.weight}g</li>`).join('')}</ul>
            <button type="button" class="preset-btn" data-coach-meal-add="${index}" style="margin-top:6px;background:#2b6cb0;color:#fff;">Zapísať jedlo</button>
        </div>`;
    }).join('');
}

function addCoachMealPlanToDay(mealIndex = null, date = AppState.selectedDate) {
    const plan = buildCoachMealPlan(date);
    const meals = mealIndex === null ? plan.meals : [plan.meals[mealIndex]].filter(Boolean);
    if (!meals.length) return;
    const allData = Storage.get(STORAGE_KEYS.FOOD);
    allData[date] = allData[date] || [];
    meals.forEach(meal => {
        allData[date].push(...meal.foods.map(food => ({ ...food, id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString() })));
    });
    Storage.save(STORAGE_KEYS.FOOD, allData);
    initDashboard();
    loadFoodDay();
    renderFoodDayMetrics(date);
    renderCoachMealPlan(date);
}

function editLoggedFoodItem(date, itemId) {
    const allData = Storage.get(STORAGE_KEYS.FOOD);
    const item = (allData[date] || []).find(food => (food.id || food.createdAt) === itemId);
    if (!item) return;

    const setValue = (id, value) => {
        const el = DOM.get(id);
        if (el) el.value = value ?? '';
    };

    setValue('f-search', item.name);
    setValue('f-name', item.name);
    setValue('f-meal', item.meal || 'Raňajky');
    setValue('f-timing', item.timing || 'normal');
    setValue('f-weight', item.weight || 100);
    const multiplier = (Number(item.weight) || 100) / 100;
    setValue('f-kcal', Math.round((Number(item.kcal) || 0) / multiplier));
    setValue('f-p', Math.round(((Number(item.p) || 0) / multiplier) * 10) / 10);
    setValue('f-c', Math.round(((Number(item.c) || 0) / multiplier) * 10) / 10);
    setValue('f-sugar', Math.round(((Number(item.sugar) || 0) / multiplier) * 10) / 10);
    setValue('f-f', Math.round(((Number(item.f) || 0) / multiplier) * 10) / 10);
    setValue('f-gi', item.gi || '');
    setValue('f-complexity', item.complexity || 'medium');
    setValue('f-fiber', Math.round(((Number(item.fiber) || 0) / multiplier) * 10) / 10);
    setValue('f-water', Math.round((Number(item.water) || 0) / multiplier));
    setValue('f-salt', Math.round(((Number(item.salt) || 0) / multiplier) * 10) / 10);
    setValue('f-magnesium', Math.round((Number(item.magnesium) || 0) / multiplier));
    setValue('f-potassium', Math.round((Number(item.potassium) || 0) / multiplier));
    setValue('f-amino', Math.round(((Number(item.amino) || 0) / multiplier) * 10) / 10);
    editingFoodRef = { date, itemId };
    setFoodAddButtonMode(true);
    DOM.get('f-name')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setFoodAddButtonMode(isEditing) {
    const btn = DOM.get('btn-add-food');
    if (!btn) return;
    btn.textContent = isEditing ? 'Uložiť zmenu' : 'Pridať do dňa';
}

function foodSearchHasExactMatch() {
    const searchValue = DOM.get('f-search')?.value?.trim().toLowerCase() || '';
    const nameValue = DOM.get('f-name')?.value?.trim().toLowerCase() || '';
    const value = nameValue || searchValue;
    if (!value) return true;
    return getFoodPresets().some(item => item.name.toLowerCase() === value);
}

function openNewFoodModal(prefill = '') {
    const modal = document.getElementById('new-food-modal');
    const nameInput = document.getElementById('new-food-name');
    if (nameInput) nameInput.value = prefill || DOM.get('f-search')?.value || DOM.get('f-name')?.value || '';
    const categoryInput = document.getElementById('new-food-category');
    if (categoryInput && !categoryInput.value) categoryInput.value = 'Ostatné';
    modal?.classList.add('open');
}

function handleAddFoodButton() {
    const searchValue = DOM.get('f-search')?.value?.trim() || '';
    const nameValue = DOM.get('f-name')?.value?.trim() || '';
    const hasMacros = ['f-kcal', 'f-p', 'f-c', 'f-f'].some(id => Number(DOM.get(id)?.value) > 0);
    if (!editingFoodRef && searchValue && !nameValue && !foodSearchHasExactMatch()) {
        openNewFoodModal(searchValue);
        return;
    }
    if (!editingFoodRef && searchValue && !foodSearchHasExactMatch() && !hasMacros) {
        openNewFoodModal(searchValue);
        return;
    }
    addFoodItem();
}

function saveNewFoodFromModal() {
    const name = document.getElementById('new-food-name')?.value?.trim();
    if (!name) return;
    const carbs = Math.max(0, Number(document.getElementById('new-food-c')?.value) || 0);
    const preset = normalizeFoodPreset({
        name,
        category: document.getElementById('new-food-category')?.value?.trim() || 'Ostatné',
        kcal: Math.max(0, Number(document.getElementById('new-food-kcal')?.value) || 0),
        p: Math.max(0, Number(document.getElementById('new-food-p')?.value) || 0),
        c: carbs,
        sugar: Math.min(carbs, Math.max(0, Number(document.getElementById('new-food-sugar')?.value) || 0)),
        f: Math.max(0, Number(document.getElementById('new-food-f')?.value) || 0),
        fiber: Math.max(0, Number(document.getElementById('new-food-fiber')?.value) || 0)
    });
    upsertFoodPreset(preset);
    applyFoodPreset(preset);
    const searchInput = DOM.get('f-search');
    if (searchInput) searchInput.value = preset.name;
    document.getElementById('new-food-modal')?.classList.remove('open');
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
    renderCoachMealPlan();
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
    suggestions?.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-action="open-new-food"]');
        if (!btn) return;
        openNewFoodModal(foodSearch?.value || '');
        suggestions.classList.remove('open');
    });
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.food-suggest-wrap')) suggestions?.classList.remove('open');
    });

    closeBtn?.addEventListener('click', () => modal?.classList.remove('open'));
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
    });
    document.getElementById('btn-close-new-food')?.addEventListener('click', () => document.getElementById('new-food-modal')?.classList.remove('open'));
    document.getElementById('btn-save-new-food')?.addEventListener('click', saveNewFoodFromModal);
    document.getElementById('new-food-modal')?.addEventListener('click', (event) => {
        if (event.target.id === 'new-food-modal') event.target.classList.remove('open');
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
            const magnesium = Math.max(0, Number(inputs[10]?.value) || 0);
            const salt = Math.max(0, Number(inputs[11]?.value) || 0);
            const potassium = Math.max(0, Number(inputs[12]?.value) || 0);
            const amino = Math.max(0, Number(inputs[13]?.value) || 0);
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
                fiber,
                magnesium,
                salt,
                potassium,
                amino
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

    document.getElementById('carbload-food-suggestions')?.addEventListener('click', (event) => {
        const mealBtn = event.target.closest('button[data-meal-plan-add]');
        if (mealBtn) {
            addSuggestedMealToDay(Number(mealBtn.dataset.mealPlanAdd) || 0);
            return;
        }
        const btn = event.target.closest('button[data-carb-suggest]');
        if (!btn) return;
        const preset = getFoodPresets().find(item => item.name === btn.dataset.carbSuggest);
        if (preset) applyFoodPreset(preset);
    });

    document.getElementById('btn-build-coach-plan')?.addEventListener('click', () => renderCoachMealPlan());
    document.getElementById('btn-add-coach-plan')?.addEventListener('click', () => addCoachMealPlanToDay(null));
    document.getElementById('coach-meal-plan')?.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-coach-meal-add]');
        if (!btn) return;
        addCoachMealPlanToDay(Number(btn.dataset.coachMealAdd));
    });

    const openFoodModal = (id) => {
        const modalEl = document.getElementById(id);
        modalEl?.classList.add('open');
    };
    const closeFoodModal = (id) => document.getElementById(id)?.classList.remove('open');

    document.getElementById('btn-open-food-entry')?.addEventListener('click', () => {
        openFoodModal('food-entry-modal');
        setTimeout(() => DOM.get('f-search')?.focus(), 50);
    });
    document.getElementById('btn-close-food-entry')?.addEventListener('click', () => closeFoodModal('food-entry-modal'));
    document.getElementById('food-entry-modal')?.addEventListener('click', (event) => {
        if (event.target.id === 'food-entry-modal') closeFoodModal('food-entry-modal');
    });

    document.getElementById('btn-open-coach-modal')?.addEventListener('click', () => {
        renderCoachMealPlan();
        openFoodModal('food-coach-modal');
    });
    document.getElementById('btn-close-coach-modal')?.addEventListener('click', () => closeFoodModal('food-coach-modal'));
    document.getElementById('food-coach-modal')?.addEventListener('click', (event) => {
        if (event.target.id === 'food-coach-modal') closeFoodModal('food-coach-modal');
    });

    document.getElementById('btn-open-food-insights')?.addEventListener('click', () => {
        renderFoodDayMetrics();
        openFoodModal('food-insights-modal');
    });
    document.getElementById('btn-close-food-insights')?.addEventListener('click', () => closeFoodModal('food-insights-modal'));
    document.getElementById('food-insights-modal')?.addEventListener('click', (event) => {
        if (event.target.id === 'food-insights-modal') closeFoodModal('food-insights-modal');
    });

    document.querySelectorAll('button[data-water-quick]').forEach(btn => {
        btn.addEventListener('click', () => addWaterEntry(btn.dataset.waterQuick));
    });
    document.getElementById('btn-add-water-custom')?.addEventListener('click', () => {
        const input = DOM.get('water-custom-ml');
        addWaterEntry(input?.value);
        if (input) input.value = '';
    });
    document.getElementById('water-log-list')?.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-water-delete]');
        if (!btn) return;
        deleteWaterEntry(AppState.selectedDate, btn.dataset.waterDelete);
    });

    renderCoachMealPlan();
});

window.addEventListener('storage', () => {
    renderFoodPresets();
    renderPresetEditor();
    renderFoodDayMetrics();
});
