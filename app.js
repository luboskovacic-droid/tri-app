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
}

window.addEventListener('DOMContentLoaded', () => {
    attachAppInteractions();
});

window.addEventListener('storage', () => {
    if (typeof initDashboard === 'function') initDashboard();
});
