/* =============================================
   PoulStock — main.js
   Template JS : navigation, modales, interactions
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

    /* —————————————————————————————————————
       Sidebar Toggle (responsive)
    ————————————————————————————————————— */
    const sidebar      = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');

    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('is-open');
    });

    // Fermer la sidebar au clic en dehors (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            sidebar.classList.contains('is-open') &&
            !sidebar.contains(e.target) &&
            !sidebarToggle.contains(e.target)) {
            sidebar.classList.remove('is-open');
        }
    });

    /* —————————————————————————————————————
       Navigation active state
    ————————————————————————————————————— */
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Fermer sidebar sur mobile après navigation
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('is-open');
            }
        });
    });

    /* —————————————————————————————————————
       Modales
    ————————————————————————————————————— */
    const modalAddProduct  = document.getElementById('modal-add-product');
    const modalAddCategory = document.getElementById('modal-add-category');

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

    // Bouton "Ajouter" dans la topbar → modale produit
    document.getElementById('btn-add-product')?.addEventListener('click', () => {
        openModal(modalAddProduct);
    });

    // Boutons "Ajouter" dans chaque catégorie → modale produit
    document.querySelectorAll('.btn-add-item').forEach(btn => {
        btn.addEventListener('click', () => {
            // On pré-sélectionne la catégorie correspondante
            const categoryBlock = btn.closest('.category-block');
            const categoryKey   = categoryBlock?.dataset.category;
            const select        = document.getElementById('product-category');

            if (select && categoryKey) {
                select.value = categoryKey;
            }

            openModal(modalAddProduct);
        });
    });

    // Bouton "Ajouter une catégorie" → modale catégorie
    document.getElementById('btn-add-category')?.addEventListener('click', () => {
        openModal(modalAddCategory);
    });

    // Fermer les modales : boutons .modal-close
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const overlay = btn.closest('.modal-overlay');
            closeModal(overlay);
        });
    });

    // Fermer les modales : clic sur l'overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(overlay);
            }
        });
    });

    // Fermer les modales : touche Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    /* —————————————————————————————————————
       Recherche (filtre visuel basique)
    ————————————————————————————————————— */
    const searchInput = document.getElementById('search-input');

    searchInput?.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const cards = document.querySelectorAll('.product-card');

        cards.forEach(card => {
            const name = card.querySelector('h3')?.textContent.toLowerCase() || '';
            if (query === '' || name.includes(query)) {
                card.style.display = '';
                card.style.opacity = '1';
            } else {
                card.style.opacity = '0';
                setTimeout(() => {
                    if (!name.includes(searchInput.value.toLowerCase().trim())) {
                        card.style.display = 'none';
                    }
                }, 150);
            }
        });

        // Masquer les catégories sans résultats visibles
        document.querySelectorAll('.category-block').forEach(block => {
            const visibleCards = block.querySelectorAll('.product-card:not([style*="display: none"])');
            block.style.display = visibleCards.length === 0 && query !== '' ? 'none' : '';
        });
    });

    /* —————————————————————————————————————
       Suppression de produit (template)
       → Supprime visuellement la carte
    ————————————————————————————————————— */
    document.querySelectorAll('.btn-icon--danger').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.product-card');
            if (!card) return;

            // Animation de sortie
            card.style.transition = 'all 0.3s ease';
            card.style.transform  = 'scale(0.9)';
            card.style.opacity    = '0';

            setTimeout(() => {
                card.remove();
                updateCategoryCounts();
            }, 300);
        });
    });

    /* —————————————————————————————————————
       Suppression de catégorie (template)
    ————————————————————————————————————— */
    document.querySelectorAll('.btn-delete-category').forEach(btn => {
        btn.addEventListener('click', () => {
            const block = btn.closest('.category-block');
            if (!block) return;

            block.style.transition = 'all 0.3s ease';
            block.style.transform  = 'translateX(-20px)';
            block.style.opacity    = '0';

            setTimeout(() => block.remove(), 300);
        });
    });

    /* —————————————————————————————————————
       Mettre à jour les compteurs de catégorie
    ————————————————————————————————————— */
    function updateCategoryCounts() {
        document.querySelectorAll('.category-block').forEach(block => {
            const count  = block.querySelectorAll('.product-card').length;
            const badge  = block.querySelector('.category-count');
            if (badge) {
                badge.textContent = `${count} produit${count > 1 ? 's' : ''}`;
            }
        });
    }

    /* —————————————————————————————————————
       Hover effects améliorés sur les stat-cards
    ————————————————————————————————————— */
    document.querySelectorAll('.stat-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transition = 'all 0.2s ease';
        });
    });

});
