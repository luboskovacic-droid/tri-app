const HEALTH_IMPORT_STATE = {
    lastPreview: null
};

const HEALTH_IMPORT_PROVIDER_ALIASES = {
    garmin: ['garmin', 'connect'],
    apple: ['apple', 'healthkit', 'apple health'],
    huawei: ['huawei', 'health']
};

function normalizeImportDate(value) {
    if (!value) return AppState?.selectedDate || getTodayString();
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    const text = String(value).trim();
    const iso = text.match(/\d{4}-\d{2}-\d{2}/);
    if (iso) return iso[0];
    const sk = text.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    if (sk) return `${sk[3]}-${String(sk[2]).padStart(2, '0')}-${String(sk[1]).padStart(2, '0')}`;
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return AppState?.selectedDate || getTodayString();
}

function parseImportNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const normalized = String(value).replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function firstImportValue(source, keys) {
    if (!source || typeof source !== 'object') return undefined;
    const flatKeys = Object.keys(source);
    for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
        const lowerKey = key.toLowerCase();
        const found = flatKeys.find(item => item.toLowerCase() === lowerKey);
        if (found && source[found] !== undefined && source[found] !== null && source[found] !== '') return source[found];
    }
    return undefined;
}

function flattenImportObject(input, prefix = '', out = {}) {
    if (!input || typeof input !== 'object') return out;
    Object.entries(input).forEach(([key, value]) => {
        const nextKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            flattenImportObject(value, nextKey, out);
        } else {
            out[nextKey] = value;
            out[key] = value;
        }
    });
    return out;
}

function detectHealthProvider(text = '') {
    const lower = String(text).toLowerCase();
    const found = Object.entries(HEALTH_IMPORT_PROVIDER_ALIASES).find(([, aliases]) => aliases.some(alias => lower.includes(alias)));
    return found ? found[0] : 'auto';
}

function parseDelimitedHealthImport(text) {
    const lines = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map(item => item.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
        const values = line.split(delimiter).map(item => item.trim().replace(/^"|"$/g, ''));
        return headers.reduce((acc, header, index) => {
            acc[header] = values[index] ?? '';
            return acc;
        }, {});
    });
}

function extractJsonBlocks(text) {
    const trimmed = String(text).trim();
    if (!trimmed) return [];
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed.records)) return parsed.records;
        if (Array.isArray(parsed.data)) return parsed.data;
        if (Array.isArray(parsed.activities)) return parsed.activities;
        if (Array.isArray(parsed.workouts)) return parsed.workouts;
        return [parsed];
    } catch (e) {
        return [];
    }
}

function parseLooseTextImport(text) {
    const lines = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const joined = lines.join('\n');
    const item = { raw: joined };
    const date = joined.match(/\d{4}-\d{2}-\d{2}|\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}/);
    if (date) item.date = date[0];
    const patterns = [
        ['restingHeartRate', /(rhr|rest(?:ing)?\s*hr|tep\s*rano|kludovy\s*tep)\D+(\d+)/i],
        ['hrv', /(hrv)\D+(\d+)/i],
        ['sleepMinutes', /(sleep|spanok)\D+(\d+(?:[,.]\d+)?)\s*(h|hod|min)?/i],
        ['calories', /(kcal|calories|active energy|energia)\D+(\d+)/i],
        ['durationMinutes', /(duration|trvanie|cas)\D+(\d+)/i],
        ['avgHeartRate', /(avg hr|average heart|priemerny tep)\D+(\d+)/i],
        ['weight', /(weight|hmotnost)\D+(\d+(?:[,.]\d+)?)/i],
        ['height', /(height|vyska)\D+(\d+(?:[,.]\d+)?)/i]
    ];
    patterns.forEach(([key, regex]) => {
        const match = joined.match(regex);
        if (match) item[key] = key === 'sleepMinutes' && match[3] && /^h|hod$/i.test(match[3])
            ? parseImportNumber(match[2]) * 60
            : parseImportNumber(match[2]);
    });
    return Object.keys(item).length > 1 ? [item] : [];
}

function parseHealthImportText(text) {
    const json = extractJsonBlocks(text);
    if (json.length) return json;
    const delimited = parseDelimitedHealthImport(text);
    if (delimited.length) return delimited;
    return parseLooseTextImport(text);
}

function inferZoneBreakdown(item, duration) {
    const flat = flattenImportObject(item);
    const direct = {
        z1: parseImportNumber(firstImportValue(flat, ['z1', 'zone1', 'Zone 1', 'hrZone1', 'heartRateZone1'])),
        z2: parseImportNumber(firstImportValue(flat, ['z2', 'zone2', 'Zone 2', 'hrZone2', 'heartRateZone2'])),
        z3: parseImportNumber(firstImportValue(flat, ['z3', 'zone3', 'Zone 3', 'hrZone3', 'heartRateZone3'])),
        z4: parseImportNumber(firstImportValue(flat, ['z4', 'zone4', 'Zone 4', 'hrZone4', 'heartRateZone4'])),
        z5: parseImportNumber(firstImportValue(flat, ['z5', 'zone5', 'Zone 5', 'hrZone5', 'heartRateZone5']))
    };
    if (Object.values(direct).some(Boolean)) return direct;

    const zones = firstImportValue(flat, ['heartRateZones', 'hrZones', 'timeInZones', 'zones']);
    if (Array.isArray(zones)) {
        return zones.slice(0, 5).reduce((acc, zone, index) => {
            acc[`z${index + 1}`] = parseImportNumber(zone.minutes ?? zone.duration ?? zone.value ?? zone);
            return acc;
        }, { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 });
    }

    const avgHr = parseImportNumber(firstImportValue(flat, ['avgHeartRate', 'averageHeartRate', 'averageHR', 'heartRateAverage', 'Avg HR']));
    if (!avgHr || !duration || typeof getHeartRateZones !== 'function') {
        return { z1: Math.round(duration || 0), z2: 0, z3: 0, z4: 0, z5: 0 };
    }
    const zone = getHeartRateZones().findIndex(itemZone => avgHr >= itemZone.min && avgHr <= itemZone.max);
    const key = `z${Math.max(1, zone + 1)}`;
    return { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, [key]: Math.round(duration) };
}

function normalizeImportedRecord(record, provider = 'auto') {
    const flat = flattenImportObject(record);
    const typeText = String(firstImportValue(flat, ['type', 'recordType', 'activityType', 'sport', 'workoutActivityType', 'name', 'source']) || '').toLowerCase();
    const date = normalizeImportDate(firstImportValue(flat, ['date', 'startDate', 'startTime', 'timestamp', 'calendarDate', 'day']));
    const duration = Math.round(parseImportNumber(firstImportValue(flat, ['durationMinutes', 'duration', 'elapsedDuration', 'movingDuration', 'Duration', 'time'])));
    const kcal = Math.round(parseImportNumber(firstImportValue(flat, ['calories', 'activeCalories', 'activeEnergy', 'energy', 'kcal', 'Calories'])));
    const resthr = Math.round(parseImportNumber(firstImportValue(flat, ['restingHeartRate', 'restHR', 'rhr', 'resthr', 'Resting Heart Rate'])));
    const hrv = Math.round(parseImportNumber(firstImportValue(flat, ['hrv', 'HRV', 'heartRateVariability', 'rmssd'])));
    let sleep = parseImportNumber(firstImportValue(flat, ['sleepMinutes', 'sleep', 'asleepDuration', 'sleepDuration', 'Sleep']));
    if (sleep > 0 && sleep <= 24) sleep *= 60;

    const profile = {
        weight: parseImportNumber(firstImportValue(flat, ['weight', 'bodyMass', 'Body Mass', 'hmotnost'])),
        height: parseImportNumber(firstImportValue(flat, ['height', 'Height', 'vyska'])),
        resthr,
        maxhr: Math.round(parseImportNumber(firstImportValue(flat, ['maxHeartRate', 'maxHR', 'maximumHeartRate']))),
        birthYear: Math.round(parseImportNumber(firstImportValue(flat, ['birthYear', 'yearOfBirth']))),
        sex: String(firstImportValue(flat, ['sex', 'gender']) || '').toLowerCase()
    };

    const nutritionKcal = Math.round(parseImportNumber(firstImportValue(flat, ['dietaryEnergy', 'foodCalories', 'nutritionCalories', 'consumedCalories'])));
    const protein = parseImportNumber(firstImportValue(flat, ['protein', 'dietaryProtein']));
    const carbs = parseImportNumber(firstImportValue(flat, ['carbs', 'carbohydrates', 'dietaryCarbohydrates']));
    const fat = parseImportNumber(firstImportValue(flat, ['fat', 'dietaryFat', 'totalFat']));
    const foodName = firstImportValue(flat, ['food', 'foodName', 'meal', 'name']);

    const isWorkout = duration > 0 || /workout|activity|running|cycling|bike|swim|run|ride|walk|tréning|beh|bicykel|plav/.test(typeText);
    const isNutrition = nutritionKcal > 0 || protein > 0 || carbs > 0 || fat > 0 || /nutrition|food|dietary|meal|strava|jedlo/.test(typeText);

    return {
        provider,
        date,
        health: resthr || hrv || sleep ? { resthr, hrv, sleep: Math.round(sleep) } : null,
        profile,
        workout: isWorkout ? {
            title: String(firstImportValue(flat, ['title', 'name', 'activityName', 'workoutActivityType', 'sport']) || `${provider === 'auto' ? 'Import' : provider} tréning`),
            duration,
            kcal,
            breakDown: inferZoneBreakdown(flat, duration),
            template: inferWorkoutTemplate(typeText),
            startTime: normalizeImportTime(firstImportValue(flat, ['startTimeLocal', 'startTime', 'time']))
        } : null,
        food: isNutrition ? {
            name: String(foodName || `${provider === 'auto' ? 'Import' : provider} strava`),
            kcal: nutritionKcal,
            p: protein,
            c: carbs,
            sugar: parseImportNumber(firstImportValue(flat, ['sugar', 'dietarySugar'])),
            f: fat,
            fiber: parseImportNumber(firstImportValue(flat, ['fiber', 'dietaryFiber'])),
            salt: parseImportNumber(firstImportValue(flat, ['salt', 'sodium'])),
            potassium: parseImportNumber(firstImportValue(flat, ['potassium'])),
            magnesium: parseImportNumber(firstImportValue(flat, ['magnesium'])),
            meal: String(firstImportValue(flat, ['mealType', 'meal']) || 'Nezaradené')
        } : null
    };
}

function inferWorkoutTemplate(typeText) {
    if (/swim|plav/.test(typeText)) return 'plavanie';
    if (/run|beh/.test(typeText)) return 'beh';
    if (/bike|cycling|ride|bicykel/.test(typeText)) return 'bicykel';
    if (/strength|gym|fitko|sil/.test(typeText)) return 'fitko';
    if (/triathlon/.test(typeText)) return 'triathlon';
    return 'vlastne';
}

function normalizeImportTime(value) {
    const text = String(value || '').trim();
    const time = text.match(/(?:^|[^\d])([01]\d|2[0-3]):([0-5]\d)(?:$|[^\d])/);
    return time ? `${time[1]}:${time[2]}` : '08:00';
}

function buildHealthImportPreview(records, provider) {
    const normalized = records.map(record => normalizeImportedRecord(record, provider));
    const summary = normalized.reduce((acc, item) => {
        if (item.health) acc.health += 1;
        if (item.workout) acc.workouts += 1;
        if (item.food) acc.food += 1;
        if (Object.values(item.profile).some(Boolean)) acc.profile += 1;
        return acc;
    }, { health: 0, workouts: 0, food: 0, profile: 0 });
    return { normalized, summary };
}

function saveImportedHealthData(preview) {
    if (!preview) return { saved: false, message: 'Najprv načítaj dáta.' };
    const healthLog = Storage.get(STORAGE_KEYS.HEALTH);
    const sportsCalendar = Storage.get(STORAGE_KEYS.SPORTS);
    const foodCalendar = Storage.get(STORAGE_KEYS.FOOD);
    let bio = typeof getBioProfile === 'function' ? (getBioProfile() || {}) : {};

    preview.normalized.forEach(item => {
        if (item.health) {
            healthLog[item.date] = {
                ...(healthLog[item.date] || {}),
                ...(item.health.resthr ? { resthr: item.health.resthr } : {}),
                ...(item.health.hrv ? { hrv: item.health.hrv } : {}),
                ...(item.health.sleep ? { sleep: item.health.sleep } : {}),
                source: item.provider,
                savedAt: new Date().toISOString()
            };
        }

        if (Object.values(item.profile).some(Boolean)) {
            bio = {
                ...bio,
                ...(item.profile.weight ? { weight: item.profile.weight } : {}),
                ...(item.profile.height ? { height: item.profile.height } : {}),
                ...(item.profile.resthr ? { resthr: item.profile.resthr } : {}),
                ...(item.profile.maxhr ? { maxhr: item.profile.maxhr } : {}),
                ...(item.profile.birthYear ? { birthYear: item.profile.birthYear } : {}),
                ...(item.profile.sex === 'female' || item.profile.sex === 'male' ? { sex: item.profile.sex } : {}),
                savedAt: new Date().toISOString()
            };
        }

        if (item.workout && item.workout.duration > 0) {
            const prediction = calculateTrainingPredictionFromBreakdown(item.workout.breakDown, 'auto', item.workout.template);
            sportsCalendar[item.date] = sportsCalendar[item.date] || [];
            sportsCalendar[item.date].push({
                id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
                title: item.workout.title,
                duration: prediction.totalDuration || item.workout.duration,
                carbload: prediction.totalCarbsNeeded || 0,
                sugarTarget: prediction.totalSugarNeeded || 0,
                proteinTarget: prediction.totalProteinNeeded || 0,
                kcalBurned: item.workout.kcal || prediction.totalKcalBurned || 0,
                tss: prediction.tss || 0,
                breakDown: prediction.breakDown || item.workout.breakDown,
                template: item.workout.template,
                intensityKey: prediction.intensityKey || 'auto',
                intensityLabel: prediction.intensityLabel || 'Import',
                carbDistribution: prediction.carbDistribution || [],
                startTime: item.workout.startTime || '08:00',
                carbSharePrevDay: 30,
                source: item.provider,
                createdAt: new Date().toISOString()
            });
        }

        if (item.food && (item.food.kcal || item.food.p || item.food.c || item.food.f)) {
            const foodItem = {
                id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
                name: item.food.name,
                meal: MEAL_ORDER.includes(item.food.meal) ? item.food.meal : 'Nezaradené',
                timing: 'normal',
                weight: 100,
                kcal: item.food.kcal || calculateFoodKcalFromMacros(item.food),
                p: item.food.p,
                c: item.food.c,
                sugar: Math.min(item.food.c || 0, item.food.sugar || 0),
                f: item.food.f,
                fiber: item.food.fiber,
                salt: item.food.salt,
                potassium: item.food.potassium,
                magnesium: item.food.magnesium,
                source: item.provider,
                createdAt: new Date().toISOString()
            };
            foodCalendar[item.date] = foodCalendar[item.date] || [];
            foodCalendar[item.date].push(foodItem);
        }
    });

    Storage.save(STORAGE_KEYS.HEALTH, healthLog);
    Storage.save(STORAGE_KEYS.SPORTS, sportsCalendar);
    Storage.save(STORAGE_KEYS.FOOD, foodCalendar);
    if (Object.keys(bio).length) localStorage.setItem('tri_user_bio_v1', JSON.stringify(bio));
    return { saved: true, message: 'Import uložený.' };
}

function renderHealthImportPreview(preview) {
    const out = document.getElementById('health-import-result');
    if (!out) return;
    const { summary } = preview;
    out.innerHTML = `<strong>Nájdené:</strong> ${summary.health} zdravotných záznamov, ${summary.workouts} tréningov, ${summary.food} záznamov stravy, ${summary.profile} profilových údajov.`;
    out.style.display = 'block';
}

function refreshAfterHealthImport() {
    if (typeof loadBio === 'function') loadBio();
    if (typeof initDashboard === 'function') initDashboard();
    if (typeof loadFoodDay === 'function') loadFoodDay();
    if (typeof loadSportDay === 'function') loadSportDay();
    if (typeof renderCoachMealPlan === 'function') renderCoachMealPlan();
    if (typeof renderSportHistoryGraphs === 'function') renderSportHistoryGraphs();
    if (typeof renderHeartZoneGuide === 'function') renderHeartZoneGuide();
    if (typeof renderDashboardAnalysis === 'function') renderDashboardAnalysis();
}

function setupHealthImport() {
    const input = document.getElementById('health-import-input');
    const source = document.getElementById('health-import-source');
    const previewBtn = document.getElementById('btn-preview-health-import');
    const saveBtn = document.getElementById('btn-save-health-import');
    const result = document.getElementById('health-import-result');
    if (!input || !previewBtn || !saveBtn) return;

    previewBtn.addEventListener('click', () => {
        const provider = source?.value && source.value !== 'auto' ? source.value : detectHealthProvider(input.value);
        const records = parseHealthImportText(input.value);
        HEALTH_IMPORT_STATE.lastPreview = buildHealthImportPreview(records, provider);
        renderHealthImportPreview(HEALTH_IMPORT_STATE.lastPreview);
    });

    saveBtn.addEventListener('click', () => {
        if (!HEALTH_IMPORT_STATE.lastPreview) {
            const provider = source?.value && source.value !== 'auto' ? source.value : detectHealthProvider(input.value);
            HEALTH_IMPORT_STATE.lastPreview = buildHealthImportPreview(parseHealthImportText(input.value), provider);
        }
        const saved = saveImportedHealthData(HEALTH_IMPORT_STATE.lastPreview);
        if (result) {
            result.innerHTML = saved.saved
                ? `${saved.message} Nástenka, strava a šport sú prepočítané.`
                : saved.message;
            result.style.display = 'block';
        }
        refreshAfterHealthImport();
        if (saved.saved) document.getElementById('health-import-modal')?.classList.remove('open');
    });
}

window.addEventListener('DOMContentLoaded', setupHealthImport);
