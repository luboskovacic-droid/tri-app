function attachAppInteractions() {
    const addFoodBtn = document.getElementById('btn-add-food');
    const addSportBtn = document.getElementById('btn-add-sport');

    addFoodBtn?.addEventListener('click', () => {
        if (typeof handleAddFoodButton === 'function') handleAddFoodButton();
        else if (typeof addFoodItem === 'function') addFoodItem();
    });

    addSportBtn?.addEventListener('click', () => {
        if (typeof addSportItem === 'function') addSportItem();
    });

    ['s-z1', 's-z2', 's-z3', 's-z4', 's-z5', 's-load-intensity', 's-carb-share-two-days', 's-carb-share-one-day', 's-carb-share-event-day'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                try {
                    if (typeof predictCarbload === 'function') predictCarbload();
                } catch (e) {}
            });
        }
    });

    const templateSel = document.getElementById('s-template');
    if (templateSel) {
        templateSel.addEventListener('change', () => {
            try {
                if (typeof handleTemplateChange === 'function') handleTemplateChange();
            } catch (e) {}
        });
    }

    const afterSessionBtn = document.getElementById('btn-after-session');
    afterSessionBtn?.addEventListener('click', () => {
        if (typeof calculateAfterSessionRecovery === 'function') calculateAfterSessionRecovery();
    });

    document.getElementById('btn-gi-help')?.addEventListener('click', () => {
        const el = document.getElementById('gi-help');
        if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('btn-form-help')?.addEventListener('click', () => {
        const el = document.getElementById('form-help');
        if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
    });

    const openModal = (id) => document.getElementById(id)?.classList.add('open');
    const closeModal = (id) => document.getElementById(id)?.classList.remove('open');
    const bindModal = (openId, modalId, closeId, beforeOpen = null) => {
        document.getElementById(openId)?.addEventListener('click', () => {
            if (typeof beforeOpen === 'function') beforeOpen();
            openModal(modalId);
        });
        document.getElementById(closeId)?.addEventListener('click', () => closeModal(modalId));
        document.getElementById(modalId)?.addEventListener('click', (event) => {
            if (event.target.id === modalId) closeModal(modalId);
        });
    };

    bindModal('btn-open-sport-plan', 'sport-plan-modal', 'btn-close-sport-plan', () => {
        if (typeof renderHeartZoneGuide === 'function') renderHeartZoneGuide();
        if (typeof predictCarbload === 'function') predictCarbload();
    });
    bindModal('btn-open-after-session', 'after-session-modal', 'btn-close-after-session', () => {
        if (typeof loadRecoveryForDate === 'function') {
            loadRecoveryForDate(document.getElementById('sport-date-picker')?.value || '');
        }
    });
    bindModal('btn-open-sport-zones', 'sport-zones-modal', 'btn-close-sport-zones', renderSportZoneModal);

    document.getElementById('btn-sport-refresh')?.addEventListener('click', () => {
        if (typeof safelyRefreshUI === 'function') safelyRefreshUI();
        if (typeof renderHeartZoneGuide === 'function') renderHeartZoneGuide();
        renderSportZoneModal();
    });
}

function renderSportZoneModal() {
    const target = document.getElementById('sport-zone-guide-modal');
    if (!target || typeof getHeartRateZones !== 'function') return;
    const colors = ['#94a3b8', '#10b981', '#f59e0b', '#f97316', '#ef4444'];
    target.innerHTML = getHeartRateZones().map((zone, index) => (
        `<div class="zone-card" style="border-left:4px solid ${colors[index]};"><strong>${zone.key.toUpperCase()}</strong><br><span>${zone.label}</span><br><b>${zone.min}-${zone.max} bpm</b></div>`
    )).join('');
}

window.addEventListener('DOMContentLoaded', () => {
    attachAppInteractions();
});

window.addEventListener('storage', () => {
    if (typeof initDashboard === 'function') initDashboard();
});
