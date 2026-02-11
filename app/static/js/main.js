/* =============================================
   Poulstock — main.js
   Rendu dynamique via API Flask + SQLite
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

    // ——— Références DOM ———
    const sidebar             = document.getElementById('sidebar');
    const sidebarToggle       = document.getElementById('sidebar-toggle');
    const sidebarNav          = document.getElementById('sidebar-nav');
    const statsGrid           = document.getElementById('stats-grid');
    const categoriesContainer = document.getElementById('categories-container');
    const searchInput         = document.getElementById('search-input');

    const modalAddProduct     = document.getElementById('modal-add-product');
    const modalAddCategory    = document.getElementById('modal-add-category-modal');
    const modalConfirmDelete  = document.getElementById('modal-confirm-delete');
    const modalThresholds     = document.getElementById('modal-thresholds');
    const btnAddProduct       = document.getElementById('btn-add-product');

    const alertsPanel         = document.getElementById('alerts-panel');
    const alertsOverlay       = document.getElementById('alerts-overlay');
    const alertsPanelBody     = document.getElementById('alerts-panel-body');
    const btnAlerts           = document.getElementById('btn-alerts');
    const bellBadge           = document.getElementById('bell-badge');

    // ——— État ———
    let DB = [];                // Données chargées depuis l'API
    let deleteCallback = null;  // Callback pour la suppression confirmée
    let editingProductId = null; // ID du produit en cours d'édition (null = ajout)

    /* ===========================================
       HELPERS — Utilitaires
    =========================================== */

    function hexToRgba(hex, opacity = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    /* ===========================================
       API — Helpers
    =========================================== */

    async function api(url, options = {}) {
        if (options.body && typeof options.body === 'object') {
            options.body = JSON.stringify(options.body);
            options.headers = { 'Content-Type': 'application/json', ...options.headers };
        }
        const res = await fetch(url, options);
        return res.json();
    }

    async function loadData() {
        DB = await api('/api/data');
        render();
    }

    /* ===========================================
       RENDER — Génère tout le DOM depuis DB
    =========================================== */

    function render() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            const addSection = mainContent.querySelector('.add-category-section');
            if (addSection) addSection.remove();
        }
        renderSidebarNav();
        renderStats();
        renderCategories();
        populateCategorySelect();
        updateAlertsBell();
        updateAddProductButton();
    }

    function updateAddProductButton() {
        const hasCategories = DB.length > 0;
        if (btnAddProduct) {
            btnAddProduct.disabled = !hasCategories;
        }
    }

    /* ——— Sidebar Nav ——— */
    function renderSidebarNav() {
        const existingDynamic = sidebarNav.querySelectorAll('.nav-item[data-target]:not([data-target="all"])');
        existingDynamic.forEach(el => el.remove());
        
        const oldAddBtn = sidebarNav.querySelector('#btn-add-category');
        if (oldAddBtn) oldAddBtn.remove();

        DB.forEach(cat => {
            const a = document.createElement('a');
            a.href = '#';
            a.className = 'nav-item';
            a.dataset.target = cat.id;
            a.innerHTML = `<i class="${cat.icon}"></i><span>${cat.name}</span>`;
            sidebarNav.appendChild(a);
        });

        const addCategoryBtn = document.createElement('button');
        addCategoryBtn.id = 'btn-add-category';
        addCategoryBtn.className = 'nav-item';
        addCategoryBtn.innerHTML = `<i class="fa-solid fa-folder-plus"></i><span>Ajouter une catégorie</span>`;
        addCategoryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.innerWidth <= 768) sidebar.classList.remove('is-open');
            const errEl = document.getElementById('category-modal-error');
            if (errEl) errEl.style.display = 'none';
            openModal(modalAddCategory);
        });
        sidebarNav.appendChild(addCategoryBtn);

        bindNavClicks();
    }

    function bindNavClicks() {
        sidebarNav.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                sidebarNav.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');

                const target = item.dataset.target;
                filterByCategory(target);

                if (window.innerWidth <= 768) sidebar.classList.remove('is-open');
            });
        });
    }

    /* ——— Stats Cards ——— */
    function renderStats() {
        statsGrid.innerHTML = '';

        DB.forEach(cat => {
            const totalProducts = cat.products.length;
            const color = cat.color || '#C0574F';

            const card = document.createElement('div');
            card.className = 'stat-card';
            card.dataset.category = cat.id;
            card.style.position = 'relative';
            
            const colorBar = document.createElement('div');
            colorBar.style.position = 'absolute';
            colorBar.style.top = '0';
            colorBar.style.left = '0';
            colorBar.style.width = '4px';
            colorBar.style.height = '100%';
            colorBar.style.borderRadius = 'var(--radius-sm) 0 0 var(--radius-sm)';
            colorBar.style.background = color;
            
            const iconEl = document.createElement('div');
            iconEl.className = 'stat-icon';
            iconEl.style.background = hexToRgba(color, 0.3);
            iconEl.style.color = color;
            iconEl.innerHTML = `<i class="${cat.icon}"></i>`;
            
            const infoEl = document.createElement('div');
            infoEl.className = 'stat-info';
            infoEl.innerHTML = `
                <span class="stat-value">${totalProducts}</span>
                <span class="stat-label">${cat.name}</span>
            `;
            
            card.appendChild(colorBar);
            card.appendChild(iconEl);
            card.appendChild(infoEl);

            card.addEventListener('click', () => {
                sidebarNav.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                const navItem = sidebarNav.querySelector(`[data-target="${cat.id}"]`);
                if (navItem) navItem.classList.add('active');
                filterByCategory(cat.id);
            });

            statsGrid.appendChild(card);
        });
    }

    /* ——— Categories & Products ——— */
    function renderCategories() {
        categoriesContainer.innerHTML = '';

        DB.forEach((cat, catIndex) => {
            const block = document.createElement('div');
            block.className = 'category-block';
            block.id = `category-${cat.id}`;
            block.dataset.category = cat.id;
            block.style.animationDelay = `${catIndex * 0.05}s`;

            // Header
            const header = document.createElement('div');
            header.className = 'category-header';
            const threshold = cat.low_stock_threshold ?? 5;
            const color = cat.color || '#C0574F';
            
            const dot = document.createElement('span');
            dot.className = 'category-dot';
            dot.style.background = color;
            
            header.innerHTML = `
                <div class="category-title">
                    <h2>${cat.name}</h2>
                    <span class="category-count">${cat.products.length} produit${cat.products.length > 1 ? 's' : ''}</span>
                    <button class="threshold-badge" title="Modifier le seuil de stock faible">
                        <i class="fa-solid fa-triangle-exclamation"></i> Seuil : ${threshold}
                    </button>
                </div>
            `;
            
            const titleDiv = header.querySelector('.category-title');
            titleDiv.insertBefore(dot, titleDiv.firstChild);

            // Modifier le seuil de cette catégorie
            header.querySelector('.threshold-badge').addEventListener('click', () => {
                const badge = header.querySelector('.threshold-badge');
                const currentVal = cat.low_stock_threshold ?? 5;

                // Remplacer le badge par un petit input inline
                const editor = document.createElement('span');
                editor.className = 'threshold-editor';
                editor.innerHTML = `
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    Seuil :
                    <input type="number" min="0" value="${currentVal}" class="threshold-inline-input">
                    <button class="threshold-save-btn" title="Valider"><i class="fa-solid fa-check"></i></button>
                `;
                badge.replaceWith(editor);

                const input = editor.querySelector('input');
                input.focus();
                input.select();

                const saveThreshold = async () => {
                    const newVal = parseInt(input.value) || 0;
                    await api(`/api/categories/${cat.id}/threshold`, {
                        method: 'PUT',
                        body: { low_stock_threshold: newVal }
                    });
                    await loadData();
                };

                editor.querySelector('.threshold-save-btn').addEventListener('click', saveThreshold);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') saveThreshold();
                    if (e.key === 'Escape') loadData(); // Annuler
                });
            });

            // Product grid
            const grid = document.createElement('div');
            grid.className = 'product-grid';

            // Grouper si la catégorie a des groupes
            const hasGroups = cat.products.some(p => p.group);

            if (hasGroups) {
                const groups = {};
                const noGroup = [];

                cat.products.forEach(p => {
                    if (p.group) {
                        if (!groups[p.group]) groups[p.group] = [];
                        groups[p.group].push(p);
                    } else {
                        noGroup.push(p);
                    }
                });

                for (const [groupName, products] of Object.entries(groups)) {
                    const label = document.createElement('div');
                    label.className = 'product-group-label';
                    label.textContent = groupName;
                    grid.appendChild(label);

                    products.forEach(product => {
                        grid.appendChild(createProductCard(product, cat));
                    });
                }

                if (noGroup.length > 0) {
                    const label = document.createElement('div');
                    label.className = 'product-group-label';
                    label.textContent = 'Divers';
                    grid.appendChild(label);

                    noGroup.forEach(product => {
                        grid.appendChild(createProductCard(product, cat));
                    });
                }
            } else {
                cat.products.forEach(product => {
                    grid.appendChild(createProductCard(product, cat));
                });
            }

            block.appendChild(header);
            block.appendChild(grid);
            categoriesContainer.appendChild(block);
        });
    }

    function createProductCard(product, category) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.productId = product.id;

        const threshold = category.low_stock_threshold ?? 5;
        const isLow = product.qty !== null && product.qty <= threshold;

        let qtyClass = 'product-qty';
        if (product.qty === null) qtyClass += ' stock-unknown';
        else if (isLow) qtyClass += ' stock-low';

        const noteHtml = product.note
            ? `<p class="product-note"><i class="fa-solid fa-circle-info"></i> ${product.note}</p>`
            : '';

        const qtyNum = product.qty !== null ? product.qty : 0;
        const qtyText = product.qty !== null ? product.qty : '?';
        const unitText = product.unit ? ' ' + product.unit : '';
        const color = category.color || '#C0574F';

        const headerEl = document.createElement('div');
        headerEl.className = 'product-card-header';
        headerEl.style.background = hexToRgba(color, 0.3);
        headerEl.style.color = color;
        headerEl.innerHTML = `<i class="${category.icon}"></i>`;

        card.innerHTML = `
            <div class="product-card-body">
                <h3>${product.name}</h3>
                <div class="qty-inline">
                    <button class="qty-inline-btn qty-minus" title="Retirer 1"><i class="fa-solid fa-minus"></i></button>
                    <span class="${qtyClass}" data-qty="${qtyNum}">${qtyText}${unitText}</span>
                    <button class="qty-inline-btn qty-plus" title="Ajouter 1"><i class="fa-solid fa-plus"></i></button>
                </div>
                ${noteHtml}
                <button class="qty-validate-btn" style="display:none"><i class="fa-solid fa-check"></i> Valider</button>
            </div>
            <div class="product-card-footer">
                <button class="btn-icon btn-icon--danger btn-delete" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        
        card.insertBefore(headerEl, card.firstChild);

        // État local de la quantité
        let localQty = qtyNum;
        const qtySpan = card.querySelector('.product-qty, .product-qty.stock-low, .product-qty.stock-unknown');
        const validateBtn = card.querySelector('.qty-validate-btn');

        function updateQtyDisplay() {
            const isNowLow = localQty <= threshold;
            qtySpan.textContent = `${localQty}${unitText}`;
            qtySpan.className = 'product-qty' + (isNowLow ? ' stock-low' : '');
            qtySpan.dataset.qty = localQty;
        }

        card.querySelector('.qty-minus').addEventListener('click', (e) => {
            e.stopPropagation();
            if (localQty > 0) localQty--;
            updateQtyDisplay();
            validateBtn.style.display = (localQty !== qtyNum) ? '' : 'none';
        });

        card.querySelector('.qty-plus').addEventListener('click', (e) => {
            e.stopPropagation();
            localQty++;
            updateQtyDisplay();
            validateBtn.style.display = (localQty !== qtyNum) ? '' : 'none';
        });

        validateBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await api(`/api/products/${product.id}`, {
                method: 'PUT',
                body: { name: product.name, qty: localQty, unit: product.unit || '', note: product.note || '' }
            });
            await loadData();
        });

        // Clic sur la card → modifier le produit
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete') || e.target.closest('.qty-inline-btn') || e.target.closest('.qty-validate-btn')) return;

            editingProductId = product.id;
            document.getElementById('modal-product-title').innerHTML = '<i class="fa-solid fa-pen"></i> Modifier le produit';
            document.getElementById('btn-confirm-add-product').textContent = 'Enregistrer';
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-qty').value = product.qty !== null ? product.qty : '';
            document.getElementById('product-unit').value = product.unit || '';
            document.getElementById('product-note').value = product.note || '';
            document.getElementById('product-category').value = category.id;
            openModal(modalAddProduct);
        });

        // Supprimer le produit
        card.querySelector('.btn-delete').addEventListener('click', () => {
            openDeleteConfirm(
                `Supprimer « ${product.name} » ?`,
                async () => {
                    await api(`/api/products/${product.id}`, { method: 'DELETE' });
                    await loadData();
                }
            );
        });

        return card;
    }

    /* ——— Populate select dans la modale produit ——— */
    function populateCategorySelect() {
        const select = document.getElementById('product-category');
        select.innerHTML = '';
        DB.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            select.appendChild(opt);
        });
    }

    /* ===========================================
       FILTRAGE par catégorie
    =========================================== */

    function filterByCategory(categoryId) {
        const blocks = categoriesContainer.querySelectorAll('.category-block');

        if (categoryId === 'all') {
            blocks.forEach(b => b.style.display = '');
        } else {
            blocks.forEach(b => {
                b.style.display = String(b.dataset.category) === String(categoryId) ? '' : 'none';
            });
            const target = document.getElementById(`category-${categoryId}`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    /* ===========================================
       RECHERCHE
    =========================================== */

    searchInput?.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const cards = document.querySelectorAll('.product-card');

        cards.forEach(card => {
            const name = card.querySelector('h3')?.textContent.toLowerCase() || '';
            const note = card.querySelector('.product-note')?.textContent.toLowerCase() || '';
            const match = query === '' || name.includes(query) || note.includes(query);
            card.style.display = match ? '' : 'none';
        });

        // Masquer les catégories sans résultats visibles
        document.querySelectorAll('.category-block').forEach(block => {
            const visibleCards = block.querySelectorAll('.product-card:not([style*="display: none"])');
            block.style.display = visibleCards.length === 0 && query !== '' ? 'none' : '';
        });

        // Masquer les group labels sans produits visibles
        document.querySelectorAll('.product-group-label').forEach(label => {
            let nextEl = label.nextElementSibling;
            let hasVisible = false;
            while (nextEl && !nextEl.classList.contains('product-group-label')) {
                if (nextEl.classList.contains('product-card') && nextEl.style.display !== 'none') {
                    hasVisible = true;
                    break;
                }
                nextEl = nextEl.nextElementSibling;
            }
            label.style.display = hasVisible || query === '' ? '' : 'none';
        });
    });

    /* ===========================================
       MODALES
    =========================================== */

    function openModal(modal) {
        if (!modal) return;
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    function closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => closeModal(m));
    }

    function openDeleteConfirm(message, callback) {
        document.getElementById('delete-confirm-text').textContent = message;
        deleteCallback = callback;
        openModal(modalConfirmDelete);
    }

    function resetProductForm() {
        editingProductId = null;
        document.getElementById('modal-product-title').innerHTML = '<i class="fa-solid fa-plus"></i> Ajouter un produit';
        document.getElementById('btn-confirm-add-product').textContent = 'Ajouter';
        document.getElementById('product-name').value = '';
        document.getElementById('product-qty').value = '';
        document.getElementById('product-unit').value = '';
        document.getElementById('product-note').value = '';
    }

    // Fermer les modales
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.closest('.modal-overlay')));
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllModals();
    });

    // Bouton "Ajouter" topbar
    btnAddProduct?.addEventListener('click', () => {
        if (DB.length === 0) return; // Ne rien faire si pas de catégories
        resetProductForm();
        openModal(modalAddProduct);
    });


    // Confirmer ajout / modification produit
    document.getElementById('btn-confirm-add-product')?.addEventListener('click', async () => {
        const name  = document.getElementById('product-name').value.trim();
        const qty   = document.getElementById('product-qty').value.trim();
        const unit  = document.getElementById('product-unit').value.trim();
        const note  = document.getElementById('product-note').value.trim();
        const catId = document.getElementById('product-category').value;

        if (!name) return;

        if (editingProductId) {
            // Mode édition → PUT
            await api(`/api/products/${editingProductId}`, {
                method: 'PUT',
                body: {
                    name: name,
                    qty: qty ? parseInt(qty) : null,
                    unit: unit,
                    note: note,
                }
            });
        } else {
            // Mode ajout → POST
            await api('/api/products', {
                method: 'POST',
                body: {
                    category_id: catId,
                    name: name,
                    qty: qty ? parseInt(qty) : null,
                    unit: unit,
                    note: note,
                }
            });
        }

        resetProductForm();
        closeModal(modalAddProduct);
        await loadData();
    });

    // Confirmer ajout catégorie
    const categoryModalError = document.getElementById('category-modal-error');
    const categoryModalErrorText = document.getElementById('category-modal-error-text');

    document.getElementById('btn-confirm-add-category')?.addEventListener('click', async () => {
        const name = document.getElementById('category-name').value.trim();
        const icon = document.getElementById('category-icon').value.trim() || 'fa-solid fa-box';

        if (!name) return;

        if (categoryModalError) categoryModalError.style.display = 'none';

        const data = await api('/api/categories', {
            method: 'POST',
            body: { name, icon }
        });

        if (data.error) {
            if (categoryModalError && categoryModalErrorText) {
                categoryModalErrorText.textContent = data.error;
                categoryModalError.style.display = 'block';
            }
            return;
        }

        document.getElementById('category-name').value = '';
        document.getElementById('category-icon').value = '';
        closeModal(modalAddCategory);
        await loadData();
    });

    // Confirmer suppression
    document.getElementById('btn-confirm-delete')?.addEventListener('click', async () => {
        if (deleteCallback) {
            await deleteCallback();
            deleteCallback = null;
        }
        closeModal(modalConfirmDelete);
    });

    /* ===========================================
       ALERTES — Stock faible
    =========================================== */

    function getLowStockProducts() {
        const alerts = [];
        DB.forEach(cat => {
            const threshold = cat.low_stock_threshold ?? 5;
            const lowProducts = cat.products.filter(p =>
                p.qty === null || (p.qty !== null && p.qty <= threshold)
            );
            if (lowProducts.length > 0) {
                alerts.push({ category: cat, products: lowProducts, threshold });
            }
        });
        return alerts;
    }

    function getTotalAlertCount() {
        return getLowStockProducts().reduce((sum, g) => sum + g.products.length, 0);
    }

    function updateAlertsBell() {
        const count = getTotalAlertCount();
        if (count > 0) {
            btnAlerts?.classList.add('has-alerts');
            if (bellBadge) {
                bellBadge.textContent = count;
            }
        } else {
            btnAlerts?.classList.remove('has-alerts');
        }
    }

    function renderAlertsPanel() {
        const alerts = getLowStockProducts();

        if (alerts.length === 0) {
            alertsPanelBody.innerHTML = `
                <div class="alerts-empty">
                    <i class="fa-solid fa-circle-check"></i>
                    <p>Tous les stocks sont OK</p>
                </div>
            `;
            return;
        }

        alertsPanelBody.innerHTML = alerts.map(group => `
            <div class="alert-category-group">
                <div class="alert-category-title">
                    <i class="${group.category.icon}"></i>
                    ${group.category.name}
                    <span style="font-weight:400; font-size:0.7rem; color:var(--color-text-muted)">(seuil : ${group.threshold})</span>
                </div>
                ${group.products.map(p => {
                    const isUnknown = p.qty === null;
                    return `
                        <div class="alert-item ${isUnknown ? 'unknown' : ''}">
                            <div class="alert-item-info">
                                <div class="alert-item-name">${p.name}</div>
                                <div class="alert-item-qty">
                                    ${isUnknown
                                        ? '<span>Stock inconnu</span>'
                                        : `<span>${p.qty}</span>${p.unit ? ' ' + p.unit : ''} restant${p.qty > 1 ? 's' : ''}`
                                    }
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `).join('');
    }

    function openAlertsPanel() {
        renderAlertsPanel();
        alertsPanel?.classList.add('is-open');
        alertsOverlay?.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function closeAlertsPanel() {
        alertsPanel?.classList.remove('is-open');
        alertsOverlay?.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    // Ouvrir / fermer le panneau
    btnAlerts?.addEventListener('click', () => openAlertsPanel());
    document.getElementById('alerts-panel-close')?.addEventListener('click', () => closeAlertsPanel());
    alertsOverlay?.addEventListener('click', () => closeAlertsPanel());

    // Fermer le panneau avec Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && alertsPanel?.classList.contains('is-open')) {
            closeAlertsPanel();
        }
    });

    // Régler les seuils
    document.getElementById('btn-edit-thresholds')?.addEventListener('click', () => {
        closeAlertsPanel();
        renderThresholdsModal();
        openModal(modalThresholds);
    });

    function renderThresholdsModal() {
        const body = document.getElementById('thresholds-body');
        body.innerHTML = DB.map(cat => `
            <div class="threshold-row">
                <label><i class="${cat.icon}"></i> ${cat.name}</label>
                <input type="number" min="0" data-cat-id="${cat.id}" value="${cat.low_stock_threshold ?? 5}">
            </div>
        `).join('');
    }

    document.getElementById('btn-save-thresholds')?.addEventListener('click', async () => {
        const inputs = document.querySelectorAll('#thresholds-body input[data-cat-id]');
        const promises = [];

        inputs.forEach(input => {
            const catId = input.dataset.catId;
            const threshold = parseInt(input.value) || 0;
            promises.push(
                api(`/api/categories/${catId}/threshold`, {
                    method: 'PUT',
                    body: { low_stock_threshold: threshold }
                })
            );
        });

        await Promise.all(promises);
        closeModal(modalThresholds);
        await loadData();
    });

    /* ===========================================
       SIDEBAR TOGGLE (mobile)
    =========================================== */

    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('is-open');
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            sidebar.classList.contains('is-open') &&
            !sidebar.contains(e.target) &&
            !sidebarToggle.contains(e.target)) {
            sidebar.classList.remove('is-open');
        }
    });

    /* ===========================================
       INIT — Charger les données depuis l'API
    =========================================== */

    loadData();

});
