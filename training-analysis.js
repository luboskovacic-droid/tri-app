const ROUTE_SESSION_KEY = 'pwa_route_sessions';
const RACE_PLANNER_KEY = 'pwa_race_planner';
let lastRouteSession = null;

function taEsc(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function taDate(offset = 0, base = typeof AppState !== 'undefined' ? AppState.selectedDate : new Date().toISOString().slice(0, 10)) {
    const d = new Date(`${base}T00:00:00`);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function taStore(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || {};
    } catch (e) {
        return {};
    }
}

function taSave(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function taRenderItems(id, items) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = items.map(item => (
        `<div class="route-analysis-item"><strong>${taEsc(item.title)}</strong><span>${taEsc(item.body)}</span></div>`
    )).join('');
}

function taDistance(a, b) {
    if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return 0;
    const r = 6371000;
    const toRad = value => value * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(h));
}

function taParseXml(text) {
    return new DOMParser().parseFromString(text, 'application/xml');
}

function taXmlText(node, names) {
    for (const name of names) {
        const found = node.getElementsByTagName(name)[0];
        if (found?.textContent) return found.textContent.trim();
    }
    return '';
}

function taParseGpx(text) {
    const xml = taParseXml(text);
    const points = [...xml.getElementsByTagName('trkpt')].map(point => ({
        lat: Number(point.getAttribute('lat')),
        lon: Number(point.getAttribute('lon')),
        ele: Number(taXmlText(point, ['ele'])) || null,
        time: taXmlText(point, ['time']),
        hr: Number(taXmlText(point, ['gpxtpx:hr', 'hr'])) || null
    })).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon));
    return { source: 'GPX', title: taXmlText(xml, ['name']) || 'GPX tréning', points };
}

function taParseTcx(text) {
    const xml = taParseXml(text);
    const points = [...xml.getElementsByTagName('Trackpoint')].map(point => {
        const pos = point.getElementsByTagName('Position')[0];
        return {
            lat: Number(taXmlText(pos || point, ['LatitudeDegrees'])),
            lon: Number(taXmlText(pos || point, ['LongitudeDegrees'])),
            ele: Number(taXmlText(point, ['AltitudeMeters'])) || null,
            time: taXmlText(point, ['Time']),
            hr: Number(taXmlText(point, ['Value'])) || null,
            distance: Number(taXmlText(point, ['DistanceMeters'])) || null
        };
    }).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon));
    return { source: 'TCX', title: taXmlText(xml, ['Name']) || 'TCX tréning', points };
}

function taReadFitValue(view, offset, size, baseType, little) {
    const type = baseType;
    if (type === 0x01) return view.getInt8(offset);
    if (type === 0x02) return view.getUint8(offset);
    if (type === 0x83) return view.getInt16(offset, little);
    if (type === 0x84) return view.getUint16(offset, little);
    if (type === 0x85) return view.getInt32(offset, little);
    if (type === 0x86) return view.getUint32(offset, little);
    if (type === 0x88) return view.getFloat32(offset, little);
    if (size === 1) return view.getUint8(offset);
    if (size === 2) return view.getUint16(offset, little);
    if (size === 4) return view.getUint32(offset, little);
    return null;
}

function taParseFit(buffer) {
    const view = new DataView(buffer);
    const headerSize = view.getUint8(0);
    const dataSize = view.getUint32(4, true);
    const end = Math.min(buffer.byteLength, headerSize + dataSize);
    const defs = {};
    const points = [];
    let offset = headerSize;
    const readRecord = (def) => {
        const record = {};
        def.fields.forEach(field => {
            if (offset + field.size > end) return;
            const value = taReadFitValue(view, offset, field.size, field.type, def.little);
            offset += field.size;
            if (def.global !== 20) return;
            if (field.num === 0) record.lat = value * (180 / 2147483648);
            if (field.num === 1) record.lon = value * (180 / 2147483648);
            if (field.num === 2) record.ele = (value / 5) - 500;
            if (field.num === 3) record.hr = value;
            if (field.num === 5) record.distance = value / 100;
            if (field.num === 253) record.time = new Date((value + 631065600) * 1000).toISOString();
        });
        if (Number.isFinite(record.lat) && Number.isFinite(record.lon)) points.push(record);
    };
    while (offset < end) {
        const header = view.getUint8(offset++);
        if (header & 0x80) {
            const def = defs[(header >> 5) & 0x03];
            if (!def) break;
            readRecord(def);
            continue;
        }
        const local = header & 0x0f;
        if (header & 0x40) {
            offset += 1;
            const arch = view.getUint8(offset++);
            const little = arch === 0;
            const global = view.getUint16(offset, little);
            offset += 2;
            const count = view.getUint8(offset++);
            const fields = [];
            for (let i = 0; i < count; i++) {
                fields.push({ num: view.getUint8(offset), size: view.getUint8(offset + 1), type: view.getUint8(offset + 2) });
                offset += 3;
            }
            defs[local] = { global, little, fields };
            continue;
        }
        const def = defs[local];
        if (!def) break;
        readRecord(def);
    }
    return { source: 'FIT', title: 'FIT tréning', points };
}

function taAnalyzeRoute(parsed, fileName = 'tréning') {
    const points = parsed.points || [];
    let distance = 0;
    let ascent = 0;
    let hrSum = 0;
    let hrCount = 0;
    for (let i = 1; i < points.length; i++) {
        const segment = points[i].distance && points[i - 1].distance
            ? Math.max(0, points[i].distance - points[i - 1].distance)
            : taDistance(points[i - 1], points[i]);
        distance += segment;
        const climb = Number(points[i].ele) - Number(points[i - 1].ele);
        if (Number.isFinite(climb) && climb > 0) ascent += climb;
    }
    points.forEach(point => {
        if (Number(point.hr) > 0) {
            hrSum += Number(point.hr);
            hrCount += 1;
        }
    });
    if (points.at(-1)?.distance) distance = Math.max(distance, Number(points.at(-1).distance) || 0);
    const firstTime = Date.parse(points[0]?.time || '');
    const lastTime = Date.parse(points.at(-1)?.time || '');
    const duration = Number.isFinite(firstTime) && Number.isFinite(lastTime) && lastTime > firstTime
        ? Math.round((lastTime - firstTime) / 60000)
        : 0;
    const km = distance / 1000;
    const speed = duration > 0 ? km / (duration / 60) : 0;
    const pace = km > 0 && duration > 0 ? duration / km : 0;
    const routeHash = taRouteHash(points, km);
    return {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        date: taDate(),
        title: parsed.title || fileName,
        source: parsed.source,
        fileName,
        points,
        distance,
        km,
        ascent,
        duration,
        speed,
        pace,
        avgHr: hrCount ? Math.round(hrSum / hrCount) : 0,
        routeHash,
        savedAt: new Date().toISOString()
    };
}

function taRouteHash(points, km) {
    if (!points.length) return `manual-${Math.round(km * 10)}`;
    const sample = [points[0], points[Math.floor(points.length / 2)], points.at(-1)]
        .filter(Boolean)
        .map(point => `${Math.round(point.lat * 100)}:${Math.round(point.lon * 100)}`)
        .join('|');
    return `${sample}|${Math.round(km * 10)}`;
}

function taSaveSession(session) {
    const store = taStore(ROUTE_SESSION_KEY);
    store[session.id] = { ...session, points: session.points.slice(0, 900) };
    taSave(ROUTE_SESSION_KEY, store);
}

function taFormatPace(session) {
    if (!session.pace) return '-';
    if ((session.title || '').toLowerCase().includes('bike') || session.speed > 13) return `${session.speed.toFixed(1)} km/h`;
    const min = Math.floor(session.pace);
    const sec = Math.round((session.pace - min) * 60);
    return `${min}:${String(sec).padStart(2, '0')} /km`;
}

function taDrawRoute(session) {
    const el = document.getElementById('route-map');
    if (!el) return;
    const points = session?.points || [];
    if (points.length < 2) {
        el.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#718096;font-size:13px;">Importuj GPX/FIT/TCX.</div>';
        return;
    }
    const xs = points.map(p => p.lon);
    const ys = points.map(p => p.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = (value, min, max, size, pad = 16) => pad + ((value - min) / Math.max(0.000001, max - min)) * (size - (pad * 2));
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${scale(p.lon, minX, maxX, 360).toFixed(1)} ${scale(maxY - (p.lat - minY), minY, maxY, 200).toFixed(1)}`).join(' ');
    el.innerHTML = `<svg viewBox="0 0 360 200" preserveAspectRatio="xMidYMid meet"><rect width="360" height="200" fill="#eef2f7"/><path d="${path}" fill="none" stroke="#2b6cb0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${scale(points[0].lon, minX, maxX, 360).toFixed(1)}" cy="${scale(maxY - (points[0].lat - minY), minY, maxY, 200).toFixed(1)}" r="5" fill="#10b981"/><circle cx="${scale(points.at(-1).lon, minX, maxX, 360).toFixed(1)}" cy="${scale(maxY - (points.at(-1).lat - minY), minY, maxY, 200).toFixed(1)}" r="5" fill="#ef4444"/></svg>`;
}

function taTrainingVerdict(session) {
    const tss = typeof calculateTssFromBreakdown === 'function'
        ? Math.round((session.duration || 0) * Math.min(1.15, Math.max(0.55, (session.avgHr || 130) / 170)) ** 2 / 0.6)
        : Math.round((session.duration || 0) * 0.9);
    const atl = typeof rollingTssAverage === 'function' ? rollingTssAverage(session.date, 7) : 0;
    const ctl = typeof rollingTssAverage === 'function' ? rollingTssAverage(session.date, 42) : 0;
    const tsb = ctl - atl;
    const hard = tss > 110 || session.ascent > 900 || session.duration > 150;
    const verdict = hard && tsb < -15 ? 'Silný tréning do únavy. Zajtra nehrdiniť.' : hard ? 'Kvalitný záťažový tréning. Daj jedlo, vodu a spánok.' : 'Kontrolovaný tréning. Dobré na budovanie bez prepálenia.';
    const food = hard ? 'Po výkone doplň sacharidy + bielkoviny, večer nerieš sladké impulzívne.' : 'Stačí normálne jedlo, bielkoviny a voda.';
    return { tss, atl, ctl, tsb, verdict, food };
}

function taRenderSession(session) {
    lastRouteSession = session;
    document.getElementById('route-distance').textContent = `${session.km.toFixed(2)} km`;
    document.getElementById('route-duration').textContent = session.duration ? `${session.duration} min` : '-';
    document.getElementById('route-pace').textContent = taFormatPace(session);
    document.getElementById('route-ascent').textContent = `${Math.round(session.ascent)} m`;
    taDrawRoute(session);
    const ai = taTrainingVerdict(session);
    taRenderItems('route-analysis-output', [
        { title: 'AI verdikt', body: ai.verdict },
        { title: 'Výkon', body: `${session.source} · ${session.km.toFixed(2)} km · ${taFormatPace(session)} · HR ${session.avgHr || '-'} · odhad TSS ${ai.tss}` },
        { title: 'Regenerácia', body: `${ai.food} Forma: ATL ${ai.atl}, CTL ${ai.ctl}, TSB ${ai.tsb > 0 ? '+' : ''}${ai.tsb}.` }
    ]);
}

function taCompareRoutes() {
    const sessions = Object.values(taStore(ROUTE_SESSION_KEY));
    const base = lastRouteSession || sessions.at(-1);
    if (!base) {
        taRenderItems('route-analysis-output', [{ title: 'Porovnanie', body: 'Najprv importuj trasu.' }]);
        return;
    }
    const matches = sessions
        .filter(item => item.id !== base.id && item.routeHash === base.routeHash)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!matches.length) {
        taRenderItems('route-analysis-output', [{ title: 'Porovnanie trás', body: 'Rovnaká trasa zatiaľ nemá starší záznam. Importuj ďalšie GPX/TCX/FIT z tej istej trasy.' }]);
        return;
    }
    const best = matches.concat(base).filter(item => item.duration).sort((a, b) => a.duration - b.duration)[0];
    const previous = matches[0];
    const delta = base.duration && previous.duration ? previous.duration - base.duration : 0;
    taRenderItems('route-analysis-output', [
        { title: 'Rovnaká trasa', body: `${matches.length + 1} záznamy · najlepší čas ${best.duration} min · ${best.date || '-'}` },
        { title: 'Posledné porovnanie', body: delta ? `${delta > 0 ? 'Zlepšenie' : 'Zhoršenie'} o ${Math.abs(delta)} min oproti ${previous.date}.` : 'Tempo podobné alebo chýba čas.' },
        { title: 'Signál progresu', body: base.avgHr && previous.avgHr ? `HR teraz ${base.avgHr}, predtým ${previous.avgHr}. Nižší tep pri podobnom tempe = dobrý trend.` : 'Pre presnejší trend importuj súbory s tepom.' }
    ]);
}

function taWeeklyPlan() {
    const date = taDate();
    const atl = typeof rollingTssAverage === 'function' ? rollingTssAverage(date, 7) : 0;
    const ctl = typeof rollingTssAverage === 'function' ? rollingTssAverage(date, 42) : 0;
    const tsb = ctl - atl;
    const mode = tsb < -18 ? 'deload' : tsb > 14 ? 'build' : 'steady';
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = taDate(i);
        const planned = typeof Storage !== 'undefined' ? (Storage.get(STORAGE_KEYS.SPORTS)[d] || []) : [];
        if (planned.length) return { title: d, body: planned.map(item => item.title || 'Tréning').join(', ') };
        if (mode === 'deload') return { title: d, body: i % 3 === 0 ? 'Voľno / mobilita' : 'Z1-Z2 30-45 min, bez tlaku.' };
        if (mode === 'build') return { title: d, body: i === 1 ? 'Tempo/intervaly' : i === 4 ? 'Dlhší bike/beh Z2' : i === 5 ? 'Fitko/core' : 'Ľahké Z1-Z2 alebo voľno.' };
        return { title: d, body: i === 2 ? 'Kvalita krátko' : i === 5 ? 'Dlhší Z2' : 'Základ/voľno podľa pocitu.' };
    });
    taRenderItems('route-analysis-output', [
        { title: 'AI týždeň podľa únavy', body: `Režim: ${mode}. ATL ${atl}, CTL ${ctl}, TSB ${tsb > 0 ? '+' : ''}${tsb}.` },
        ...days
    ]);
}

function taRacePlan() {
    const raceDate = document.getElementById('race-date-input')?.value;
    const priority = document.getElementById('race-priority-input')?.value || 'a';
    if (!raceDate) {
        taRenderItems('race-plan-output', [{ title: 'Race planner', body: 'Vyber dátum súťaže.' }]);
        return;
    }
    const today = taDate();
    const days = typeof getDayDifference === 'function' ? getDayDifference(today, raceDate) : 0;
    const taper = priority === 'a' ? '10-14 dní' : priority === 'b' ? '5-7 dní' : '2-4 dni';
    const volume = priority === 'a' ? 'posledný týždeň -40 až -60 % objemu' : 'jemne ubrať objem, intenzitu krátko nechať';
    const plan = [
        { title: 'Odpočítavanie', body: `Súťaž za ${Math.max(0, days)} dní · taper ${taper}.` },
        { title: 'Tréning', body: `${volume}. Posledné 2 dni žiadne ťažké nohy.` },
        { title: 'Strava', body: days <= 3 ? 'Spusti carbload podľa STRAVA. Nízky tuk/vláknina, nič nové.' : 'Testuj carbload na kľúčových tréningoch, nie až v deň D.' },
        { title: 'Riziko', body: 'Ak TSB padá pod -20 alebo spánok slabne, zníž objem okamžite.' }
    ];
    taSave(RACE_PLANNER_KEY, { raceDate, priority, savedAt: new Date().toISOString() });
    taRenderItems('race-plan-output', plan);
}

function taRenderTomorrowCenter(date = taDate()) {
    const tomorrow = taDate(1, date);
    const sports = typeof Storage !== 'undefined' ? (Storage.get(STORAGE_KEYS.SPORTS)[tomorrow] || []) : [];
    const target = typeof getMacroTargetsForDate === 'function' ? getMacroTargetsForDate(tomorrow) : { kcal: 0, c: 0, p: 0, sugar: 0 };
    const tss = typeof getDayTss === 'function' ? getDayTss(tomorrow) : 0;
    const race = sports.some(item => item.intensityKey === 'race' || ['triathlon', 'duathlon', 'aquathlon'].includes(item.template));
    taRenderItems('dashboard-tomorrow-center', [
        { title: sports.length ? (race ? 'Zajtra výkon' : 'Zajtra tréning') : 'Zajtra voľno', body: sports.length ? sports.map(item => item.title || 'Tréning').join(', ') : 'Drž regeneráciu, vodu a normálne jedlo.' },
        { title: 'Palivo', body: `${Math.round(target.kcal || 0)} kcal · sacharidy ${target.c || 0}g · bielkoviny ${target.p || 0}g · cukry max ${target.sugar || 0}g.` },
        { title: 'Záťaž', body: `Odhad TSS ${Math.round(tss)}. ${tss > 100 ? 'Priprav spánok a jedlo, nekomplikuj deň.' : 'Bez paniky, drž plán.'}` }
    ]);
}

function taHandleFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = () => {
        try {
            let parsed;
            if (ext === 'fit') parsed = taParseFit(reader.result);
            else {
                const text = String(reader.result || '');
                parsed = ext === 'tcx' ? taParseTcx(text) : taParseGpx(text);
            }
            const session = taAnalyzeRoute(parsed, file.name);
            if (!session.points.length) throw new Error('empty route');
            taSaveSession(session);
            taRenderSession(session);
            if (typeof initDashboard === 'function') initDashboard();
        } catch (err) {
            taRenderItems('route-analysis-output', [{ title: 'Import zlyhal', body: 'Súbor sa nepodarilo prečítať. Skús GPX, TCX alebo štandardný FIT z Garminu/Cyklopočítača.' }]);
        }
    };
    if (ext === 'fit') reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
}

function setupTrainingAnalysis() {
    taDrawRoute(null);
    document.getElementById('route-file-input')?.addEventListener('change', event => taHandleFile(event.target.files?.[0]));
    document.getElementById('btn-route-compare')?.addEventListener('click', taCompareRoutes);
    document.getElementById('btn-route-week-plan')?.addEventListener('click', taWeeklyPlan);
    document.getElementById('btn-route-race-plan')?.addEventListener('click', taRacePlan);
    const savedRace = taStore(RACE_PLANNER_KEY);
    if (savedRace.raceDate) {
        const raceInput = document.getElementById('race-date-input');
        const priorityInput = document.getElementById('race-priority-input');
        if (raceInput) raceInput.value = savedRace.raceDate;
        if (priorityInput) priorityInput.value = savedRace.priority || 'a';
    }
    taRenderTomorrowCenter();
}

window.addEventListener('DOMContentLoaded', setupTrainingAnalysis);
window.addEventListener('sportsCalendarUpdated', () => taRenderTomorrowCenter());
