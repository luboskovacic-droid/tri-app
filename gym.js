const GYM_EXERCISE_STORAGE_KEY = 'tri_gym_exercises_v1';
const GYM_WORKOUT_STORAGE_KEY = 'tri_gym_workouts_v1';
let editingGymExerciseId = null;

const DEFAULT_GYM_EXERCISES = [
    { name: 'Trap bar deadlift', group: 'posterior', sets: '4', reps: '4-6', note: 'sila zadného reťazca, RPE 7-8' },
    { name: 'Bulgarian split squat', group: 'leg', sets: '3', reps: '6-8/strana', note: 'beh a cyklistika, kontrola kolena' },
    { name: 'Front squat', group: 'leg', sets: '4', reps: '4-6', note: 'sila bez preťaženia chrbta' },
    { name: 'Step-up na box', group: 'leg', sets: '3', reps: '8/strana', note: 'špecificky pre stúpanie na bicykli' },
    { name: 'Nordic hamstring', group: 'posterior', sets: '3', reps: '4-6', note: 'prevencia hamstringov' },
    { name: 'Hip thrust', group: 'posterior', sets: '3', reps: '8-10', note: 'gluteus pre beh a aero pozíciu' },
    { name: 'Pallof press', group: 'core', sets: '3', reps: '10/strana', note: 'anti-rotácia pre plávanie a beh' },
    { name: 'Dead bug', group: 'core', sets: '3', reps: '8/strana', note: 'panva a rebrá pod kontrolou' },
    { name: 'Side plank row', group: 'core', sets: '3', reps: '8/strana', note: 'core + lopatka' },
    { name: 'Farmer carry', group: 'core', sets: '4', reps: '30-40m', note: 'trup, úchop, držanie tela' },
    { name: 'Pull-up / lat pulldown', group: 'upper', sets: '4', reps: '6-8', note: 'ťah pre plávanie' },
    { name: 'Single-arm cable row', group: 'upper', sets: '3', reps: '8-10/strana', note: 'lopatka a symetria záberu' },
    { name: 'Face pull', group: 'upper', sets: '3', reps: '12-15', note: 'ramená pre plávanie' },
    { name: 'Copenhagen plank', group: 'core', sets: '3', reps: '20-30s/strana', note: 'adduktory a stabilita panvy' },
    { name: 'Ankle/hip mobility flow', group: 'mobility', sets: '2', reps: '8 min', note: 'rozsah členok/bedro pred behom' }
];

function getGymExercises() {
    try {
        const stored = JSON.parse(localStorage.getItem(GYM_EXERCISE_STORAGE_KEY));
        if (Array.isArray(stored) && stored.length) return stored;
    } catch (e) {}
    return DEFAULT_GYM_EXERCISES.map((exercise, index) => ({ ...exercise, id: `default-${index}` }));
}

function saveGymExercises(exercises) {
    localStorage.setItem(GYM_EXERCISE_STORAGE_KEY, JSON.stringify(exercises));
}

function getGymWorkouts() {
    try {
        return JSON.parse(localStorage.getItem(GYM_WORKOUT_STORAGE_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function saveGymWorkouts(workouts) {
    localStorage.setItem(GYM_WORKOUT_STORAGE_KEY, JSON.stringify(workouts));
}

function getGymDate() {
    return document.getElementById('gym-date-picker')?.value || (typeof AppState !== 'undefined' ? AppState.selectedDate : new Date().toISOString().slice(0, 10));
}

function getGymDateOffset(baseDate, offset) {
    const d = new Date(`${baseDate}T00:00:00`);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getGymPlanGroups(type) {
    if (type === 'leg') return ['leg', 'posterior', 'core'];
    if (type === 'core') return ['core', 'mobility'];
    if (type === 'posterior') return ['posterior', 'core'];
    if (type === 'upper') return ['upper', 'core'];
    if (type === 'mobility') return ['mobility', 'core'];
    return ['leg', 'posterior', 'upper', 'core'];
}

function buildGymPlan(type, rpe = 7, minutes = 55) {
    const groups = getGymPlanGroups(type);
    const exercises = getGymExercises();
    const limit = type === 'full' ? 7 : type === 'mobility' ? 5 : 6;
    const selected = exercises
        .filter(exercise => groups.includes(exercise.group))
        .slice(0, limit)
        .map(exercise => ({ ...exercise, rpe }));
    return {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type,
        title: getGymPlanTitle(type),
        rpe,
        minutes,
        exercises: selected,
        createdAt: new Date().toISOString()
    };
}

function getGymPlanTitle(type) {
    if (type === 'leg') return 'Leg day triathlon';
    if (type === 'core') return 'Core stabilita';
    if (type === 'posterior') return 'Zadný reťazec';
    if (type === 'upper') return 'Vrch/plávanie';
    if (type === 'mobility') return 'Mobilita a stabilita';
    return 'Full body triathlon';
}

function addGymPlanToCalendar() {
    const baseDate = getGymDate();
    const type = document.getElementById('gym-plan-type')?.value || 'leg';
    const offset = Math.max(0, Number(document.getElementById('gym-plan-days-offset')?.value) || 0);
    const targetDate = getGymDateOffset(baseDate, offset);
    const rpe = Math.max(1, Math.min(10, Number(document.getElementById('gym-plan-rpe')?.value) || 7));
    const minutes = Math.max(20, Number(document.getElementById('gym-plan-min')?.value) || 55);
    const plan = buildGymPlan(type, rpe, minutes);
    const workouts = getGymWorkouts();
    workouts[targetDate] = workouts[targetDate] || [];
    workouts[targetDate].push(plan);
    saveGymWorkouts(workouts);
    const picker = document.getElementById('gym-date-picker');
    if (picker) picker.value = targetDate;
    if (typeof AppState !== 'undefined') AppState.selectedDate = targetDate;
    renderGymWorkouts();
}

function renderGymWorkouts(date = getGymDate()) {
    const list = document.getElementById('gym-workout-list');
    if (!list) return;
    const workouts = getGymWorkouts()[date] || [];
    if (!workouts.length) {
        list.innerHTML = '<p style="text-align:center;color:#718096;padding:8px;">Žiadne fitko v tento deň.</p>';
        return;
    }
    list.innerHTML = workouts.map(workout => `
        <div class="gym-workout-item">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:start;">
                <div>
                    <strong>${escapeGymHtml(workout.title)}</strong>
                    <span>${workout.minutes || 0} min · RPE ${workout.rpe || 7}</span>
                </div>
                <button type="button" class="preset-btn" data-gym-delete="${workout.id}" style="width:auto;background:#e53e3e;color:#fff;">Zmazať</button>
            </div>
            <ol style="margin:8px 0 0 20px;padding:0;font-size:12px;color:#2d3748;">${(workout.exercises || []).map(ex => `<li><b>${escapeGymHtml(ex.name)}</b> · ${escapeGymHtml(ex.sets)} x ${escapeGymHtml(ex.reps)} · ${escapeGymHtml(ex.note || '')}</li>`).join('')}</ol>
        </div>
    `).join('');
}

function deleteGymWorkout(date, id) {
    const workouts = getGymWorkouts();
    workouts[date] = (workouts[date] || []).filter(workout => workout.id !== id);
    if (!workouts[date].length) delete workouts[date];
    saveGymWorkouts(workouts);
    renderGymWorkouts(date);
}

function renderGymExercises() {
    const list = document.getElementById('gym-exercise-list');
    if (!list) return;
    const exercises = getGymExercises();
    list.innerHTML = exercises.map(exercise => `
        <div class="gym-exercise-row" data-gym-exercise-id="${exercise.id}">
            <strong>${escapeGymHtml(exercise.name)}</strong>
            <span>${escapeGymHtml(exercise.group)}</span>
            <span>${escapeGymHtml(exercise.sets)}</span>
            <span>${escapeGymHtml(exercise.reps)}</span>
            <span>${escapeGymHtml(exercise.note || '')}</span>
            <div style="display:flex;gap:4px;">
                <button type="button" class="preset-btn" data-gym-edit="${exercise.id}" style="width:auto;">Upraviť</button>
                <button type="button" class="preset-btn" data-gym-ex-delete="${exercise.id}" style="width:auto;background:#e53e3e;color:#fff;">Zmazať</button>
            </div>
        </div>
    `).join('');
}

function saveGymExerciseFromForm() {
    const name = document.getElementById('gym-ex-name')?.value?.trim();
    if (!name) return;
    const exercise = {
        id: editingGymExerciseId || crypto.randomUUID?.() || `${Date.now()}`,
        name,
        group: document.getElementById('gym-ex-group')?.value || 'leg',
        sets: document.getElementById('gym-ex-sets')?.value?.trim() || '3',
        reps: document.getElementById('gym-ex-reps')?.value?.trim() || '8',
        note: document.getElementById('gym-ex-note')?.value?.trim() || ''
    };
    const exercises = getGymExercises();
    const index = exercises.findIndex(item => item.id === exercise.id);
    if (index >= 0) exercises[index] = exercise;
    else exercises.push(exercise);
    saveGymExercises(exercises);
    editingGymExerciseId = null;
    ['gym-ex-name', 'gym-ex-sets', 'gym-ex-reps', 'gym-ex-note'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderGymExercises();
}

function editGymExercise(id) {
    const exercise = getGymExercises().find(item => item.id === id);
    if (!exercise) return;
    editingGymExerciseId = id;
    const set = (field, value) => { const el = document.getElementById(field); if (el) el.value = value || ''; };
    set('gym-ex-name', exercise.name);
    set('gym-ex-group', exercise.group);
    set('gym-ex-sets', exercise.sets);
    set('gym-ex-reps', exercise.reps);
    set('gym-ex-note', exercise.note);
}

function deleteGymExercise(id) {
    saveGymExercises(getGymExercises().filter(item => item.id !== id));
    renderGymExercises();
}

function initGym() {
    const picker = document.getElementById('gym-date-picker');
    if (picker && !picker.value) picker.value = typeof AppState !== 'undefined' ? AppState.selectedDate : new Date().toISOString().slice(0, 10);
    picker?.addEventListener('change', event => {
        if (typeof AppState !== 'undefined') AppState.selectedDate = event.target.value;
        renderGymWorkouts(event.target.value);
    });
    document.getElementById('btn-add-gym-plan')?.addEventListener('click', addGymPlanToCalendar);
    document.getElementById('gym-plan-type')?.addEventListener('change', event => {
        const offset = document.getElementById('gym-plan-days-offset');
        if (offset && event.target.value === 'core') offset.value = 1;
        else if (offset && Number(offset.value) === 1) offset.value = 0;
    });
    document.getElementById('btn-save-gym-exercise')?.addEventListener('click', saveGymExerciseFromForm);
    document.getElementById('gym-workout-list')?.addEventListener('click', event => {
        const btn = event.target.closest('button[data-gym-delete]');
        if (btn) deleteGymWorkout(getGymDate(), btn.dataset.gymDelete);
    });
    document.getElementById('gym-exercise-list')?.addEventListener('click', event => {
        const editBtn = event.target.closest('button[data-gym-edit]');
        const deleteBtn = event.target.closest('button[data-gym-ex-delete]');
        if (editBtn) editGymExercise(editBtn.dataset.gymEdit);
        if (deleteBtn) deleteGymExercise(deleteBtn.dataset.gymExDelete);
    });
    if (typeof AppState !== 'undefined') {
        AppState.subscribe(date => {
            if (picker && picker.value !== date) picker.value = date;
            renderGymWorkouts(date);
        });
    }
    renderGymExercises();
    renderGymWorkouts();
}

function escapeGymHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.addEventListener('DOMContentLoaded', initGym);
