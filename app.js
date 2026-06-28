function attachAppInteractions() {
    const addFoodBtn = document.getElementById('btn-add-food');
    const addSportBtn = document.getElementById('btn-add-sport');

    addFoodBtn?.addEventListener('click', () => {
        if (typeof addFoodItem === 'function') addFoodItem();
    });

    document.getElementById('btn-save-food-preset')?.addEventListener('click', () => {
        if (typeof saveCurrentFoodAsPreset === 'function') saveCurrentFoodAsPreset();
    });

    addSportBtn?.addEventListener('click', () => {
        if (typeof addSportItem === 'function') addSportItem();
    });

    ['s-z1', 's-z2', 's-z3', 's-z4', 's-z5', 's-load-intensity'].forEach(id => {
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
}

window.addEventListener('DOMContentLoaded', () => {
    attachAppInteractions();
});

window.addEventListener('storage', () => {
    if (typeof initDashboard === 'function') initDashboard();
});
