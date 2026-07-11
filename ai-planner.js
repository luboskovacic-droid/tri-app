const AI_BACKUP_KEYS = [
    'pwa_food_calendar',
    'pwa_sports_calendar',
    'pwa_health_log',
    'pwa_water_log',
    'pwa_recovery_log',
    'tri_user_bio_v1',
    'tri_food_presets_v1',
    'tri_gym_exercises_v1',
    'tri_gym_workouts_v1',
    'tri_gym_season_v1'
];

function aiEsc(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function aiDate(offset = 0, base = typeof AppState !== 'undefined' ? AppState.selectedDate : new Date().toISOString().slice(0, 10)) {
    const d = new Date(`${base}T00:00:00`);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function aiFoodTotals(date = aiDate()) {
    return typeof getFoodTotalsForDate === 'function'
        ? getFoodTotalsForDate(date)
        : { kcal: 0, p: 0, c: 0, sugar: 0, water: 0 };
}

function aiTargets(date = aiDate()) {
    return typeof getMacroTargetsForDate === 'function'
        ? getMacroTargetsForDate(date)
        : { kcal: 2200, p: 140, c: 250, f: 70, sugar: 45, context: { type: 'endurance', label: 'Tréning' } };
}

function aiSports(date = aiDate()) {
    return (Storage.get(STORAGE_KEYS.SPORTS)[date] || []).filter(Boolean);
}

function aiHealth(date = aiDate()) {
    return Storage.get(STORAGE_KEYS.HEALTH)[date] || {};
}

function aiTss(date = aiDate()) {
    if (typeof getDayTss === 'function') return getDayTss(date);
    return aiSports(date).reduce((sum, item) => sum + (Number(item.tss) || 0), 0);
}

function aiReadiness(date = aiDate()) {
    const health = aiHealth(date);
    const sleep = typeof normalizeSleepMinutes === 'function' ? normalizeSleepMinutes(health.sleep) : Number(health.sleep) || 0;
    const hrv = Number(health.hrv) || 0;
    const resthr = Number(health.resthr) || 0;
    const atl = typeof rollingTssAverage === 'function' ? rollingTssAverage(date, 7) : 0;
    const ctl = typeof rollingTssAverage === 'function' ? rollingTssAverage(date, 42) : 0;
    const tsb = ctl - atl;
    let score = 70;
    if (sleep && sleep < 390) score -= 18;
    if (sleep >= 450) score += 8;
    if (hrv && hrv < 45) score -= 12;
    if (resthr && resthr > 62) score -= 10;
    if (tsb < -20) score -= 20;
    if (tsb > 10) score += 8;
    const level = score >= 75 ? 'green' : score >= 52 ? 'orange' : 'red';
    return { score, level, sleep, hrv, resthr, atl, ctl, tsb };
}

function aiRenderCards(items) {
    return items.map(item => `<div class="ai-hub-card"><strong>${aiEsc(item.title)}</strong><span>${aiEsc(item.body)}</span>${item.points ? `<ul>${item.points.map(point => `<li>${aiEsc(point)}</li>`).join('')}</ul>` : ''}</div>`).join('');
}

function aiSetOutput(html) {
    const el = document.getElementById('ai-hub-output');
    if (el) el.innerHTML = html;
}

function aiNowCoach() {
    const date = aiDate();
    const totals = aiFoodTotals(date);
    const targets = aiTargets(date);
    const readiness = aiReadiness(date);
    const tomorrow = aiSports(aiDate(1));
    const steps = [];
    if ((totals.water || 0) < 2000) steps.push(`Daj vodu: chýba aspoň ${Math.max(250, 2000 - (totals.water || 0))} ml.`);
    if ((totals.p || 0) < targets.p * 0.75) steps.push(`Doplň bielkoviny: ešte cca ${Math.round(targets.p - (totals.p || 0))} g.`);
    if ((totals.sugar || 0) > targets.sugar) steps.push('Stop sladké: ďalšie sacharidy len ryža/zemiaky/chlieb/vločky.');
    if (tomorrow.length) steps.push(`Zajtra: ${tomorrow.map(item => item.title || 'tréning').join(', ')}. Priprav carbload a spánok.`);
    if (readiness.level === 'red') steps.push('Regenerácia červená: uber intenzitu, žiadne hrdinstvo.');
    while (steps.length < 3) steps.push('Drž jednoduchý plán: normálne jedlo, voda, večer pokoj.');
    aiSetOutput(aiRenderCards([{ title: 'Čo spraviť teraz', body: `Semafor: ${readiness.level.toUpperCase()} · TSB ${readiness.tsb}`, points: steps.slice(0, 3) }]));
}

function aiWeeklyPlan() {
    const rows = Array.from({ length: 7 }, (_, i) => {
        const date = aiDate(i);
        const sports = aiSports(date);
        const target = aiTargets(date);
        const label = sports.length ? sports.map(item => item.title || 'Tréning').join(', ') : (i === 2 || i === 5 ? 'Fitko / core' : 'Voľno alebo ľahká Z1');
        return { title: date, body: label, points: [`kcal cieľ ${target.kcal}`, `sacharidy ${target.c} g`, sports.length ? 'jedlo podľa tréningu' : 'bielkoviny + voda + regenerácia'] };
    });
    aiSetOutput(aiRenderCards([{ title: 'AI plán týždňa', body: '7 dní tréning + strava + regenerácia.' }, ...rows]));
}

function aiTrainingPlan() {
    const blocks = [
        ['1-2', 'Adaptácia', 'Z2 objem, technika, fitko ľahšie.'],
        ['3-5', 'Stavba', 'Dlhší bike/beh, 1 tempo, zima fitko silovo-vytrvalostne.'],
        ['6-7', 'Špecifikácia', 'Brick, race pace úseky, carbload test.'],
        ['8', 'Deload/test', 'Menej objemu, kontrola formy, krátky ostrý stimul.']
    ];
    aiSetOutput(aiRenderCards(blocks.map(([week, title, body]) => ({ title: `Týždeň ${week}: ${title}`, body }))));
}

function aiRaceWeek() {
    const items = [
        { title: '7-5 dní pred', body: 'Zníž objem, nechaj krátke ostrejšie impulzy. Jedlo normálne, cukry nepreháňať.' },
        { title: '4-2 dni pred', body: 'Carbload podľa plánovača. Voda + soľ primerane, žiadne nové jedlá.' },
        { title: '1 deň pred', body: 'Ľahké komplexné sacharidy, nízky tuk/vláknina, pripraviť výbavu.' },
        { title: 'Deň D', body: 'Raňajky 3h pred, posledná dávka 15-60 min pred výkonom, cukry podľa plánu.' }
    ];
    aiSetOutput(aiRenderCards(items));
}

function aiRecovery() {
    const r = aiReadiness();
    const body = r.level === 'green' ? 'Zelená: môžeš trénovať podľa plánu.' : r.level === 'orange' ? 'Oranžová: drž plán, ale skráť intenzitu alebo objem.' : 'Červená: deload/voľno, spánok, voda, normálne jedlo.';
    const deload = r.tsb < -20 || r.score < 52 ? 'Deload odporúčaný: 3-5 dní znížiť objem o 30-50 %.' : 'Deload zatiaľ netreba.';
    aiSetOutput(aiRenderCards([{ title: `Regeneračný semafor: ${r.level.toUpperCase()}`, body, points: [`score ${Math.round(r.score)}`, `ATL ${r.atl} / CTL ${r.ctl} / TSB ${r.tsb}`, deload] }]));
}

function aiTrends() {
    const days = Array.from({ length: 14 }, (_, i) => aiDate(-13 + i));
    const kcal = days.reduce((sum, date) => sum + (aiFoodTotals(date).kcal || 0), 0);
    const target = days.reduce((sum, date) => sum + (aiTargets(date).kcal || 0), 0);
    const diff = kcal - target;
    const weightDelta = diff / 7700;
    aiSetOutput(aiRenderCards([
        { title: 'Trend 14 dní', body: `Príjem ${Math.round(kcal)} kcal / cieľ ${Math.round(target)} kcal.` },
        { title: 'Predikcia hmotnosti', body: `${weightDelta >= 0 ? '+' : ''}${weightDelta.toFixed(2)} kg pri rovnakom trende.` },
        { title: 'Výkon', body: `TSS posledných 7 dní: ${Array.from({ length: 7 }, (_, i) => aiTss(aiDate(-6 + i))).reduce((a, b) => a + b, 0)}.` }
    ]));
}

function aiTemplates() {
    const templates = [
        'Voľno: bielkoviny, voda, nízke cukry, mobilita.',
        'Ľahký tréning: Z1/Z2, normálne sacharidy, bez sladkých výkyvov.',
        'Dlhý bike: viac sacharidov deň pred + počas, voda a soľ.',
        'Tempo beh: sacharidy pred/po, tuk a vláknina mimo okna.',
        'Fitko: proteín vyššie, sacharidy okolo tréningu.',
        'Race day: plánované raňajky, gél/džús len podľa času.',
        'Deň pred súťažou: carbload, pokoj, nič nové.'
    ];
    aiSetOutput(aiRenderCards([{ title: 'Rýchle šablóny dňa', body: 'Vyber režim a drž jednoduché pravidlá.', points: templates }]));
}

function aiEveningReview() {
    const totals = aiFoodTotals();
    const targets = aiTargets();
    const r = aiReadiness();
    const points = [
        totals.kcal <= targets.kcal * 1.08 ? 'Kalórie držané rozumne.' : 'Kalórie prestrelené, zajtra netrestať, len zjednodušiť.',
        totals.sugar <= targets.sugar ? 'Cukry pod kontrolou.' : 'Cukry vysoko, ďalší deň komplexné sacharidy.',
        (totals.water || 0) >= 2000 ? 'Voda splnená.' : 'Voda slabá, doplniť rutinu.',
        r.sleep >= 420 ? 'Spánok použiteľný.' : 'Spánok doplniť ako prioritu.'
    ];
    aiSetOutput(aiRenderCards([{ title: 'AI hodnotenie dňa', body: `Semafor ${r.level.toUpperCase()}`, points }]));
}

function aiBackup() {
    const data = AI_BACKUP_KEYS.reduce((acc, key) => {
        acc[key] = localStorage.getItem(key);
        return acc;
    }, { exportedAt: new Date().toISOString(), version: 1 });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tri-app-backup-${aiDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    aiSetOutput(aiRenderCards([{ title: 'Záloha vytvorená', body: 'Export JSON súboru je pripravený.' }]));
}

function aiRestore() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            try {
                const data = JSON.parse(String(reader.result || '{}'));
                let restored = 0;
                AI_BACKUP_KEYS.forEach(key => {
                    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== null) {
                        localStorage.setItem(key, data[key]);
                        restored += 1;
                    }
                });
                aiSetOutput(aiRenderCards([{ title: 'Obnova hotová', body: `Načítané oblasti: ${restored}. Obnov PWA alebo prepni deň.` }]));
            } catch (err) {
                aiSetOutput(aiRenderCards([{ title: 'Obnova zlyhala', body: 'Súbor nie je platná JSON záloha tri-app.' }]));
            }
        });
        reader.readAsText(file);
    });
    input.click();
}

function aiNotificationBody() {
    const totals = aiFoodTotals();
    const targets = aiTargets();
    if ((totals.water || 0) < 2000) return `Voda: dnes máš ${totals.water || 0} ml. Daj 300-500 ml.`;
    if ((totals.p || 0) < targets.p * 0.75) return `Bielkoviny: chýba cca ${Math.round(targets.p - (totals.p || 0))} g.`;
    if ((totals.kcal || 0) < targets.kcal * 0.7) return 'Jedlo: nečakaj na vlčí hlad, daj normálnu porciu.';
    return 'Kontrola: voda, jedlo, regenerácia. Drž jednoduchý plán.';
}

function aiScheduleNotifications() {
    if (!('Notification' in window) || Notification.permission !== 'granted' || window.aiNotificationTimer) return;
    window.aiNotificationTimer = setInterval(() => {
        new Notification('Tri-app', { body: aiNotificationBody() });
    }, 60 * 60 * 1000);
}

function aiNotifications() {
    if (!('Notification' in window)) {
        aiSetOutput(aiRenderCards([{ title: 'Upozornenia', body: 'Tento prehliadač nepodporuje notifikácie.' }]));
        return;
    }
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            localStorage.setItem('tri_ai_notifications_v1', '1');
            aiScheduleNotifications();
        }
        aiSetOutput(aiRenderCards([{ title: 'Upozornenia', body: permission === 'granted' ? 'Povolené. PWA pripomenie vodu/jedlo každú hodinu, keď je otvorená.' : 'Nepovolené. Zapni ich v nastaveniach prehliadača/PWA.' }]));
        if (permission === 'granted') new Notification('Tri-app', { body: 'Upozornenia sú pripravené.' });
    });
}

function aiOpenHub() {
    document.getElementById('ai-hub-modal')?.classList.add('open');
    aiNowCoach();
}

function setupAiPlanner() {
    document.getElementById('btn-open-ai-hub')?.addEventListener('click', aiOpenHub);
    document.getElementById('btn-close-ai-hub')?.addEventListener('click', () => document.getElementById('ai-hub-modal')?.classList.remove('open'));
    document.getElementById('ai-hub-modal')?.addEventListener('click', event => {
        if (event.target.id === 'ai-hub-modal') event.target.classList.remove('open');
    });
    document.getElementById('ai-hub-modal')?.addEventListener('click', event => {
        const action = event.target.closest('button[data-ai-action]')?.dataset.aiAction;
        if (!action) return;
        const actions = {
            now: aiNowCoach,
            week: aiWeeklyPlan,
            training: aiTrainingPlan,
            race: aiRaceWeek,
            recovery: aiRecovery,
            trends: aiTrends,
            templates: aiTemplates,
            review: aiEveningReview,
            backup: aiBackup,
            restore: aiRestore,
            notifications: aiNotifications
        };
        actions[action]?.();
    });
    if (localStorage.getItem('tri_ai_notifications_v1') === '1') aiScheduleNotifications();
}

window.addEventListener('DOMContentLoaded', setupAiPlanner);
