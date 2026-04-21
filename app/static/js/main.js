/* =============================================
   PharmaStock — main.js
   Rendu dynamique via API Flask + SQLite
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

    // ——— Références DOM ———
    const sidebar             = document.getElementById('sidebar');
    const sidebarToggle       = document.getElementById('sidebar-toggle');
    const sidebarNav          = document.getElementById('sidebar-nav');
    const categoriesContainer = document.getElementById('categories-container');
    const searchInput         = document.getElementById('search-input');

    const modalAddProduct     = document.getElementById('modal-add-product');
    const modalAddCategory    = document.getElementById('modal-add-category-modal');
    const modalConfirmDelete  = document.getElementById('modal-confirm-delete');
    const btnAddProduct       = document.getElementById('btn-add-product');

    const alertsPanel         = document.getElementById('alerts-panel');
    const alertsOverlay       = document.getElementById('alerts-overlay');
    const alertsPanelBody     = document.getElementById('alerts-panel-body');
    const btnAlerts           = document.getElementById('btn-alerts');
    const bellBadge           = document.getElementById('bell-badge');

    // ——— État ———
    let DB = [];                    // Données chargées depuis l'API
    let ORDERS = [];                // Commandes chargées depuis l'API
    let pennylaneConfigured = false;
    let deleteCallback = null;      // Callback pour la suppression confirmée
    let editingProductId = null;    // ID du produit en cours d'édition (null = ajout)
    let editingProductCurrentQty = null; // Qté actuelle du produit en cours d'édition
    let editingCategoryId = null;   // ID de la catégorie en cours d'édition (null = ajout)
    let pendingOrderProduct = null; // Produit cible de la modale de commande

    /* ===========================================
       HELPERS — Utilitaires
    =========================================== */

    function hexToRgba(hex, opacity = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    function smoothScrollTo(el) {
        if (!el) return;
        setTimeout(() => {
            const rect = el.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetY = scrollTop + rect.top - (window.innerHeight / 2) + (rect.height / 2);
            try {
                window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
            } catch (_) {
                window.scrollTo(0, Math.max(0, targetY));
            }
        }, 200);
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
        if (!localStorage.getItem('categories_custom_ordered')) {
            DB.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' }));
        }
        render();
        await loadOrders();
    }

    async function loadOrders() {
        const [orders, status] = await Promise.all([
            api('/api/orders'),
            api('/api/orders/pennylane/status'),
        ]);
        ORDERS = orders;
        pennylaneConfigured = status.configured;
        updateOrdersBadge();
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
        renderCategories();
        initDragAndDrop();
        populateCategorySelect();
        updateAlertsBell();
        updateAddProductButton();
    }

    function updateOrdersBadge() {
        const pending = ORDERS.filter(o => o.status === 'en_attente').length;
        const badge = document.getElementById('orders-badge');
        if (badge) {
            badge.textContent = pending;
            badge.style.display = pending > 0 ? '' : 'none';
        }
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
        // Repositionner #btn-orders après les catégories dynamiques (il sera déplacé plus bas)
        const ordersBtn = document.getElementById('btn-orders');
        
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
            resetCategoryForm();
            openModal(modalAddCategory);
        });
        sidebarNav.appendChild(addCategoryBtn);

        bindNavClicks();
    }

    function bindNavClicks() {
        sidebarNav.querySelectorAll('.nav-item:not(#btn-add-category)').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                sidebarNav.querySelectorAll('.nav-item:not(#btn-add-category)').forEach(n => n.classList.remove('active'));
                item.classList.add('active');

                const target = item.dataset.target;
                filterByCategory(target);

                if (window.innerWidth <= 768) sidebar.classList.remove('is-open');
            });
        });
    }

    /* ——— Stats Cards ——— */
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
            const color = cat.color || '#C0574F';

            const dot = document.createElement('span');
            dot.className = 'category-dot';
            dot.style.background = color;

            header.innerHTML = `
                <div class="category-title">
                    <h2>${cat.name}</h2>
                    <span class="category-count">${cat.products.length} produit${cat.products.length > 1 ? 's' : ''}</span>
                </div>
                <div style="display:flex;gap:4px">
                    <button class="btn-icon btn-edit-cat" title="Modifier la catégorie"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon btn-icon--danger btn-delete-cat" title="Supprimer la catégorie"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;

            const titleDiv = header.querySelector('.category-title');
            titleDiv.insertBefore(dot, titleDiv.firstChild);

            // Bouton modifier catégorie
            header.querySelector('.btn-edit-cat').addEventListener('click', (e) => {
                e.stopPropagation();
                editingCategoryId = cat.id;
                document.getElementById('category-name').value = cat.name;
                const errEl = document.getElementById('category-modal-error');
                if (errEl) errEl.style.display = 'none';
                renderIconSelector(cat.icon);
                document.querySelector('#modal-add-category-modal .modal-header h2').innerHTML =
                    '<i class="fa-solid fa-pen"></i> Modifier la catégorie';
                document.getElementById('btn-confirm-add-category').textContent = 'Enregistrer';
                openModal(modalAddCategory);
            });

            // Bouton supprimer catégorie
            header.querySelector('.btn-delete-cat').addEventListener('click', (e) => {
                e.stopPropagation();
                openDeleteConfirm(
                    `Supprimer la catégorie « ${cat.name} » et tous ses produits ?`,
                    async () => {
                        await api(`/api/categories/${cat.id}`, { method: 'DELETE' });
                        await loadData();
                    }
                );
            });

            // Product grid
            const grid = document.createElement('div');
            grid.className = 'product-grid';

            // Tri alphabétique/alphanumérique automatique
            cat.products.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' }));

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

        const threshold = product.low_stock_threshold ?? 5;
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
                <button class="threshold-badge" title="Modifier le min. de stock">
                    <i class="fa-solid fa-triangle-exclamation"></i> min. ${threshold}
                </button>
                <div style="display:flex;gap:2px">
                    <button class="btn-icon btn-edit" title="Modifier"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon btn-icon--danger btn-delete" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
                </div>
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
            const savedProductId = product.id;
            await api(`/api/products/${product.id}`, {
                method: 'PUT',
                body: { name: product.name, qty: localQty, unit: product.unit || '', note: product.note || '' }
            });
            await loadData();
            smoothScrollTo(document.querySelector(`[data-product-id="${savedProductId}"]`));
        });

        // Bouton crayon → modifier le produit
        card.querySelector('.btn-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            editingProductId = product.id;
            editingProductCurrentQty = product.qty ?? 0;
            document.getElementById('modal-product-title').innerHTML = '<i class="fa-solid fa-pen"></i> Modifier le produit';
            document.getElementById('btn-confirm-add-product').textContent = 'Enregistrer';
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-qty').value = 0;
            document.getElementById('product-qty-label').textContent = `Qté à ajouter (actuel : ${product.qty ?? '?'}${product.unit ? ' ' + product.unit : ''})`;
            document.getElementById('product-unit').value = product.unit || '';
            document.getElementById('product-note').value = product.note || '';
            document.getElementById('product-supplier').value = product.supplier || '';
            document.getElementById('product-reference').value = product.reference || '';
            document.getElementById('product-order-qty').value = product.order_qty ?? 1;
            document.getElementById('product-category').value = category.id;
            document.getElementById('modal-product-delete-row').style.display = '';
            document.getElementById('product-qty-remove-row').style.display = '';
            document.getElementById('product-qty-remove').value = '';
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

        // Modifier le min. de ce produit
        card.querySelector('.threshold-badge').addEventListener('click', (e) => {
            e.stopPropagation();
            const badge = card.querySelector('.threshold-badge');
            const currentVal = product.low_stock_threshold ?? 5;

            const editor = document.createElement('span');
            editor.className = 'threshold-editor';
            editor.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation"></i>
                <input type="number" min="0" value="${currentVal}" class="threshold-inline-input">
                <button class="threshold-save-btn" title="Valider"><i class="fa-solid fa-check"></i></button>
            `;
            badge.replaceWith(editor);

            const input = editor.querySelector('input');
            input.focus();
            input.select();

            const saveThreshold = async () => {
                const newVal = parseInt(input.value) || 0;
                await api(`/api/products/${product.id}/threshold`, {
                    method: 'PUT',
                    body: { low_stock_threshold: newVal }
                });
                await loadData();
            };

            editor.querySelector('.threshold-save-btn').addEventListener('click', saveThreshold);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') saveThreshold();
                if (e.key === 'Escape') loadData();
            });
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

    function resetCategoryForm() {
        editingCategoryId = null;
        document.getElementById('category-name').value = '';
        categoryIconInput.value = 'fa-solid fa-box';
        document.querySelector('#modal-add-category-modal .modal-header h2').innerHTML =
            '<i class="fa-solid fa-folder-plus"></i> Nouvelle catégorie';
        document.getElementById('btn-confirm-add-category').textContent = 'Créer';
        renderIconSelector();
    }

    function resetProductForm() {
        editingProductId = null;
        editingProductCurrentQty = null;
        document.getElementById('modal-product-title').innerHTML = '<i class="fa-solid fa-plus"></i> Ajouter un produit';
        document.getElementById('btn-confirm-add-product').textContent = 'Ajouter';
        document.getElementById('product-qty-label').textContent = 'Quantité';
        document.getElementById('product-name').value = '';
        document.getElementById('product-qty').value = '';
        document.getElementById('product-unit').value = '';
        document.getElementById('product-note').value = '';
        document.getElementById('product-supplier').value = '';
        document.getElementById('product-reference').value = '';
        document.getElementById('product-order-qty').value = '1';
        document.getElementById('modal-product-delete-row').style.display = 'none';
        document.getElementById('product-qty-remove-row').style.display = 'none';
        document.getElementById('product-qty-remove').value = '';
    }

    // Fermer les modales
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const overlay = btn.closest('.modal-overlay');
            if (overlay === modalAddCategory) resetCategoryForm();
            closeModal(overlay);
        });
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

    // Bouton rafraîchir
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
        loadData();
    });

    // Bouton supprimer depuis la modale édition produit
    document.getElementById('btn-delete-product-modal')?.addEventListener('click', () => {
        if (!editingProductId) return;
        const productId = editingProductId;
        closeModal(modalAddProduct);
        resetProductForm();
        openDeleteConfirm(
            `Supprimer ce produit ?`,
            async () => {
                await api(`/api/products/${productId}`, { method: 'DELETE' });
                await loadData();
            }
        );
    });


    // Confirmer ajout / modification produit
    document.getElementById('btn-confirm-add-product')?.addEventListener('click', async () => {
        const name      = document.getElementById('product-name').value.trim();
        const qty       = document.getElementById('product-qty').value.trim();
        const qtyRemove = document.getElementById('product-qty-remove').value.trim();
        const unit      = document.getElementById('product-unit').value.trim();
        const note      = document.getElementById('product-note').value.trim();
        const supplier  = document.getElementById('product-supplier').value.trim();
        const reference = document.getElementById('product-reference').value.trim();
        const orderQty  = parseInt(document.getElementById('product-order-qty').value) || 1;
        const catId     = document.getElementById('product-category').value;

        if (!name) return;

        if (editingProductId) {
            const addedQty   = qty !== '' ? parseInt(qty) : 0;
            const removedQty = qtyRemove !== '' ? parseInt(qtyRemove) : 0;
            const newQty = Math.max(0, editingProductCurrentQty + addedQty - removedQty);
            await api(`/api/products/${editingProductId}`, {
                method: 'PUT',
                body: {
                    name, qty: newQty, unit, note, supplier, reference,
                    order_qty: orderQty, category_id: parseInt(catId),
                }
            });
        } else {
            await api('/api/products', {
                method: 'POST',
                body: {
                    category_id: catId, name,
                    qty: qty ? parseInt(qty) : null,
                    unit, note, supplier, reference, order_qty: orderQty,
                }
            });
        }

        const savedProductId = editingProductId;
        resetProductForm();
        closeModal(modalAddProduct);
        await loadData();
        if (savedProductId) {
            smoothScrollTo(document.querySelector(`[data-product-id="${savedProductId}"]`));
        }
    });

    // Confirmer ajout catégorie
    const categoryModalError = document.getElementById('category-modal-error');
    const categoryModalErrorText = document.getElementById('category-modal-error-text');
    const iconSelectorGrid = document.getElementById('icon-selector-grid');
    const categoryIconInput = document.getElementById('category-icon');

    // Liste d'icônes pertinentes pour gestion de stock
    const availableIcons = [
        'fa-solid fa-box',
        'fa-solid fa-box-archive',
        'fa-solid fa-jar',
        'fa-solid fa-cart-shopping',
        'fa-solid fa-tags',
        'fa-solid fa-tag',
        'fa-solid fa-warehouse',
        'fa-solid fa-pallet',
        'fa-solid fa-cube',
        'fa-solid fa-cubes',
        'fa-solid fa-basket-shopping',
        'fa-solid fa-shopping-bag',
        'fa-solid fa-dolly',
        'fa-solid fa-boxes-stacked',
        'fa-solid fa-tape',
        'fa-solid fa-scissors',
        'fa-solid fa-toolbox',
        'fa-solid fa-wrench',
        'fa-solid fa-screwdriver-wrench',
        'fa-solid fa-hammer',
        'fa-solid fa-clipboard-list',
        'fa-solid fa-list-check',
        'fa-solid fa-file-invoice',
        'fa-solid fa-receipt',
    ];

    function renderIconSelector(selectedIcon = null) {
        if (!iconSelectorGrid) return;

        // En mode édition, inclure l'icône actuelle même si déjà utilisée
        const usedIcons = new Set(DB.map(cat => cat.icon));
        if (selectedIcon) usedIcons.delete(selectedIcon);

        const iconsToShow = availableIcons.filter(icon => !usedIcons.has(icon));
        // Ajouter l'icône actuelle en tête si elle n'est pas dans la liste
        if (selectedIcon && !iconsToShow.includes(selectedIcon)) {
            iconsToShow.unshift(selectedIcon);
        }

        iconSelectorGrid.innerHTML = '';

        iconsToShow.forEach(icon => {
            const iconBtn = document.createElement('div');
            iconBtn.className = 'icon-selector-item';
            iconBtn.dataset.icon = icon;
            iconBtn.innerHTML = `<i class="${icon}"></i>`;

            iconBtn.addEventListener('click', () => {
                iconSelectorGrid.querySelectorAll('.icon-selector-item').forEach(item => item.classList.remove('selected'));
                iconBtn.classList.add('selected');
                categoryIconInput.value = icon;
            });

            iconSelectorGrid.appendChild(iconBtn);
        });

        // Présélectionner l'icône voulue ou la première
        const toSelect = selectedIcon || iconsToShow[0];
        if (toSelect) {
            const btn = iconSelectorGrid.querySelector(`[data-icon="${toSelect}"]`);
            if (btn) {
                btn.classList.add('selected');
                categoryIconInput.value = toSelect;
            }
        }
    }


    document.getElementById('btn-confirm-add-category')?.addEventListener('click', async () => {
        const name = document.getElementById('category-name').value.trim();
        const icon = categoryIconInput.value.trim() || 'fa-solid fa-box';

        if (!name) return;

        if (categoryModalError) categoryModalError.style.display = 'none';

        let data;
        if (editingCategoryId) {
            data = await api(`/api/categories/${editingCategoryId}`, {
                method: 'PUT',
                body: { name, icon }
            });
        } else {
            data = await api('/api/categories', {
                method: 'POST',
                body: { name, icon }
            });
        }

        if (data.error) {
            if (categoryModalError && categoryModalErrorText) {
                categoryModalErrorText.textContent = data.error;
                categoryModalError.style.display = 'block';
            }
            return;
        }

        resetCategoryForm();
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
            const lowProducts = cat.products.filter(p => {
                const t = p.low_stock_threshold ?? 5;
                return p.qty === null || p.qty <= t;
            });
            if (lowProducts.length > 0) {
                alerts.push({ category: cat, products: lowProducts });
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
                </div>
                ${group.products.map(p => {
                    const isUnknown = p.qty === null;
                    const t = p.low_stock_threshold ?? 5;
                    const hasPending = ORDERS.some(o => o.product_id === p.id && o.status === 'en_attente');
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
                            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                                <span style="font-size:0.65rem; color:var(--color-text-muted)">min. : ${t}</span>
                                ${hasPending
                                    ? `<span class="order-auto-badge"><i class="fa-solid fa-clock"></i> En attente</span>`
                                    : `<button class="btn-order" data-product-id="${p.id}"><i class="fa-solid fa-cart-plus"></i> Commander</button>`
                                }
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `).join('');

        // Liaison des boutons Commander
        alertsPanelBody.querySelectorAll('.btn-order').forEach(btn => {
            btn.addEventListener('click', () => {
                const productId = btn.dataset.productId;
                const product = DB.flatMap(c => c.products).find(p => p.id === productId);
                if (product) openOrderModal(product);
            });
        });
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

    btnAlerts?.addEventListener('click', () => openAlertsPanel());
    document.getElementById('alerts-panel-close')?.addEventListener('click', () => closeAlertsPanel());
    alertsOverlay?.addEventListener('click', () => closeAlertsPanel());

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && alertsPanel?.classList.contains('is-open')) {
            closeAlertsPanel();
        }
    });

    /* ===========================================
       PANNEAU COMMANDES
    =========================================== */

    const ordersPanel  = document.getElementById('orders-panel');
    const ordersOverlay = document.getElementById('orders-overlay');
    const ordersPanelBody = document.getElementById('orders-panel-body');

    const ORDER_STATUSES = {
        en_attente: { label: 'En attente', color: 'var(--color-warning)' },
        envoyee:    { label: 'Envoyée',    color: '#1a6bb5' },
        recue:      { label: 'Reçue',      color: 'var(--color-success)' },
        annulee:    { label: 'Annulée',    color: 'var(--color-text-muted)' },
    };

    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function renderOrdersPanel() {
        const statusBar = document.getElementById('pennylane-status-bar');
        if (statusBar) {
            statusBar.style.display = '';
            statusBar.innerHTML = pennylaneConfigured
                ? `<div class="pennylane-status configured"><i class="fa-solid fa-plug"></i> Pennylane connecté — envoi automatique activé</div>`
                : `<div class="pennylane-status not-configured"><i class="fa-solid fa-plug-circle-xmark"></i> Pennylane non configuré (PENNYLANE_API_KEY manquante)</div>`;
        }

        if (ORDERS.length === 0) {
            ordersPanelBody.innerHTML = `
                <div class="alerts-empty">
                    <i class="fa-solid fa-inbox"></i>
                    <p>Aucune commande enregistrée</p>
                </div>`;
            return;
        }

        const groups = {};
        ['en_attente', 'envoyee', 'recue', 'annulee'].forEach(s => { groups[s] = []; });
        ORDERS.forEach(o => { if (groups[o.status]) groups[o.status].push(o); });

        ordersPanelBody.innerHTML = '';

        Object.entries(groups).forEach(([status, orders]) => {
            if (orders.length === 0) return;
            const info = ORDER_STATUSES[status];
            const group = document.createElement('div');
            group.className = 'order-group';
            group.innerHTML = `<div class="order-group-title" style="color:${info.color}"><i class="fa-solid fa-circle" style="font-size:0.5rem"></i>${info.label} (${orders.length})</div>`;

            orders.forEach(o => {
                const item = document.createElement('div');
                item.className = 'order-item';
                item.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                        <div>
                            <div class="order-item-name">${o.product_name}</div>
                            <div class="order-item-meta">
                                Qté : <strong>${o.quantity}</strong>
                                ${o.supplier ? ` · ${o.supplier}` : ''}
                                · ${formatDate(o.created_at)}
                            </div>
                            ${o.notes ? `<div class="order-item-meta" style="font-style:italic">${o.notes}</div>` : ''}
                            ${o.auto_triggered ? `<span class="order-auto-badge"><i class="fa-solid fa-robot"></i> Auto</span>` : ''}
                            ${o.pennylane_order_id ? `<div class="order-pennylane-badge"><i class="fa-solid fa-check"></i> Pennylane #${o.pennylane_order_id}</div>` : ''}
                        </div>
                    </div>
                    <div class="order-item-actions">
                        ${status === 'en_attente' ? `<button class="btn-status success" data-id="${o.id}" data-action="envoyee">Marquer envoyée</button>` : ''}
                        ${status === 'envoyee' ? `<button class="btn-status success" data-id="${o.id}" data-action="recue">Marquer reçue</button>` : ''}
                        ${status !== 'annulee' && status !== 'recue' ? `<button class="btn-status danger" data-id="${o.id}" data-action="annulee">Annuler</button>` : ''}
                        <button class="btn-status" data-id="${o.id}" data-action="delete" style="border-color:var(--color-danger);color:var(--color-danger)"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                group.appendChild(item);
            });

            ordersPanelBody.appendChild(group);
        });

        // Délégation événements
        ordersPanelBody.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const { id, action } = btn.dataset;
                if (action === 'delete') {
                    await api(`/api/orders/${id}`, { method: 'DELETE' });
                } else {
                    await api(`/api/orders/${id}`, { method: 'PUT', body: { status: action } });
                }
                await loadOrders();
                renderOrdersPanel();
            });
        });
    }

    function openOrdersPanel() {
        renderOrdersPanel();
        ordersPanel?.classList.add('is-open');
        ordersOverlay?.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function closeOrdersPanel() {
        ordersPanel?.classList.remove('is-open');
        ordersOverlay?.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    document.getElementById('orders-panel-close')?.addEventListener('click', () => closeOrdersPanel());
    ordersOverlay?.addEventListener('click', () => closeOrdersPanel());
    document.getElementById('btn-orders')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.innerWidth <= 768) sidebar.classList.remove('is-open');
        openOrdersPanel();
    });

    /* ===========================================
       MODAL COMMANDE
    =========================================== */

    const modalOrder = document.getElementById('modal-order');

    function openOrderModal(product) {
        pendingOrderProduct = product;
        document.getElementById('order-product-name').value = product.name;
        document.getElementById('order-quantity').value = product.order_qty ?? 1;
        document.getElementById('order-supplier').value = product.supplier || '';
        document.getElementById('order-notes').value = '';
        const infoEl = document.getElementById('order-pennylane-info');
        if (infoEl) infoEl.style.display = pennylaneConfigured ? '' : 'none';
        openModal(modalOrder);
    }

    document.getElementById('btn-confirm-order')?.addEventListener('click', async () => {
        if (!pendingOrderProduct) return;
        const quantity = parseInt(document.getElementById('order-quantity').value) || 1;
        const supplier = document.getElementById('order-supplier').value.trim();
        const notes    = document.getElementById('order-notes').value.trim();

        await api('/api/orders', {
            method: 'POST',
            body: {
                product_id: pendingOrderProduct.id,
                product_name: pendingOrderProduct.name,
                supplier: supplier || pendingOrderProduct.supplier || '',
                quantity,
                notes,
                auto_triggered: false,
            }
        });

        pendingOrderProduct = null;
        closeModal(modalOrder);
        closeAlertsPanel();
        await loadOrders();
        openOrdersPanel();
    });

    /* ===========================================
       AUTO-COMMANDE (déclenchée au chargement si activée)
    =========================================== */

    async function checkAutoOrders() {
        const settings = loadSettings();
        if (!settings.auto_order) return;

        const lowProducts = DB.flatMap(c => c.products).filter(p => {
            const t = p.low_stock_threshold ?? 5;
            return p.qty === null || p.qty <= t;
        });

        let created = 0;
        for (const p of lowProducts) {
            const hasPending = ORDERS.some(o => o.product_id === p.id && o.status === 'en_attente');
            if (!hasPending) {
                await api('/api/orders', {
                    method: 'POST',
                    body: {
                        product_id: p.id,
                        product_name: p.name,
                        supplier: p.supplier || '',
                        quantity: p.order_qty ?? 1,
                        notes: '',
                        auto_triggered: true,
                    }
                });
                created++;
            }
        }
        if (created > 0) await loadOrders();
    }


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
       DRAG-AND-DROP — Réorganisation des catégories
    =========================================== */

    function initDragAndDrop() {
        const blocks = categoriesContainer.querySelectorAll('.category-block');
        let dragSrc = null;

        blocks.forEach(block => {
            const header = block.querySelector('.category-header');
            header.setAttribute('draggable', 'true');

            header.addEventListener('dragstart', () => {
                dragSrc = block;
                setTimeout(() => block.classList.add('dragging'), 0);
            });

            header.addEventListener('dragend', () => {
                block.classList.remove('dragging');
                blocks.forEach(b => b.classList.remove('drag-over'));
            });

            block.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (block !== dragSrc) {
                    blocks.forEach(b => b.classList.remove('drag-over'));
                    block.classList.add('drag-over');
                }
            });

            block.addEventListener('dragleave', () => {
                block.classList.remove('drag-over');
            });

            block.addEventListener('drop', async (e) => {
                e.preventDefault();
                block.classList.remove('drag-over');
                if (!dragSrc || dragSrc === block) return;

                // Réordonner dans le DOM
                const allBlocks = [...categoriesContainer.querySelectorAll('.category-block')];
                const srcIdx = allBlocks.indexOf(dragSrc);
                const tgtIdx = allBlocks.indexOf(block);
                if (srcIdx < tgtIdx) {
                    block.after(dragSrc);
                } else {
                    block.before(dragSrc);
                }

                // Envoyer le nouvel ordre à l'API et mémoriser que l'ordre est custom
                const newOrder = [...categoriesContainer.querySelectorAll('.category-block')].map((b, i) => ({
                    id: parseInt(b.dataset.category),
                    sort_order: i
                }));
                await api('/api/categories/reorder', { method: 'PUT', body: newOrder });
                localStorage.setItem('categories_custom_ordered', '1');
            });
        });
    }


    /* ===========================================
       PARAMÈTRES
    =========================================== */

    const SETTINGS_KEY = 'pharmastock_settings';
    const modalSettings = document.getElementById('modal-settings');
    const settingUpdateNotif = document.getElementById('setting-update-notif');
    const settingAutoOrder   = document.getElementById('setting-auto-order');

    function loadSettings() {
        try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (_) { return {}; }
    }

    function saveSetting(key, value) {
        const settings = loadSettings();
        settings[key] = value;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    function initSettings() {
        const settings = loadSettings();
        settingUpdateNotif.checked = settings.update_notif !== false;
        if (settingAutoOrder) settingAutoOrder.checked = !!settings.auto_order;

        const statusEl = document.getElementById('pennylane-settings-status');
        if (statusEl) {
            statusEl.innerHTML = pennylaneConfigured
                ? `<div class="pennylane-status configured"><i class="fa-solid fa-plug"></i> Pennylane connecté</div>`
                : `<div class="pennylane-status not-configured"><i class="fa-solid fa-plug-circle-xmark"></i> Pennylane non configuré — ajoutez <code>PENNYLANE_API_KEY</code> dans votre .env</div>`;
        }
    }

    settingUpdateNotif?.addEventListener('change', () => {
        saveSetting('update_notif', settingUpdateNotif.checked);
    });

    settingAutoOrder?.addEventListener('change', () => {
        saveSetting('auto_order', settingAutoOrder.checked);
    });

    document.getElementById('btn-settings')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.innerWidth <= 768) sidebar.classList.remove('is-open');
        initSettings();
        openModal(modalSettings);
    });

    /* ===========================================
       CHANGELOG — Détection de mise à jour
    =========================================== */

    const modalChangelog = document.getElementById('modal-changelog');
    const changelogBody = document.getElementById('changelog-body');

    async function checkForUpdate() {
        const settings = loadSettings();
        if (settings.update_notif === false) return;

        try {
            const [versionData, changelog] = await Promise.all([
                api('/api/version'),
                api('/api/changelog')
            ]);

            const currentSha = versionData.sha;
            const storedSha = localStorage.getItem('pharmastock_sha');

            if (!storedSha) {
                localStorage.setItem('pharmastock_sha', currentSha);
                return;
            }

            if (storedSha === currentSha) return;

            localStorage.setItem('pharmastock_sha', currentSha);

            if (!changelog || changelog.length === 0) return;

            const latest = changelog[0];
            changelogBody.innerHTML = `
                <div>
                    <span class="changelog-date">${latest.date}</span>
                </div>
                <ul class="changelog-list">
                    ${latest.changes.map(c => `<li><i class="fa-solid fa-check"></i>${c}</li>`).join('')}
                </ul>
            `;
            openModal(modalChangelog);
        } catch (_) {}
    }

    /* ===========================================
       INIT
    =========================================== */

    async function init() {
        await loadData();
        checkForUpdate();
        await checkAutoOrders();
    }

    init();

});
