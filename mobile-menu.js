// ===== GESTION DU MENU MOBILE =====
const mobileMenuManager = {
    init: () => {
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const closeBtn = document.getElementById('closeMenuBtn');
        const mobileMenu = document.getElementById('mobileMenu');
        const mobileLinks = document.querySelectorAll('.mobile-nav-link');
        
        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', () => {
                mobileMenuManager.toggleMobileMenu();
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                mobileMenuManager.closeMobileMenu();
            });
        }
        
        // Fermer le menu en cliquant sur les liens
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenuManager.closeMobileMenu();
                // Scroller vers la section
                const href = link.getAttribute('href');
                if (href && href !== '#') {
                    setTimeout(() => {
                        const target = document.querySelector(href);
                        if (target) {
                            window.scrollTo({
                                top: target.offsetTop - 100,
                                behavior: 'smooth'
                            });
                        }
                    }, 300);
                }
            });
        });
        
        // Fermer le menu en cliquant en dehors
        if (mobileMenu) {
            mobileMenu.addEventListener('click', (e) => {
                if (e.target === mobileMenu) {
                    mobileMenuManager.closeMobileMenu();
                }
            });
        }
        
        // Fermer le menu avec la touche Échap
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                mobileMenuManager.closeMobileMenu();
            }
        });
    },
    
    toggleMobileMenu: () => {
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const mobileMenu = document.getElementById('mobileMenu');
        
        if (mobileMenu.classList.contains('active')) {
            mobileMenu.classList.remove('active');
            hamburgerBtn.classList.remove('active');
            document.body.style.overflow = 'auto';
        } else {
            mobileMenu.classList.add('active');
            hamburgerBtn.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },
    
    closeMobileMenu: () => {
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const mobileMenu = document.getElementById('mobileMenu');
        
        mobileMenu.classList.remove('active');
        hamburgerBtn.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
};

// Initialiser le menu mobile quand le DOM est chargé
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mobileMenuManager.init);
} else {
    mobileMenuManager.init();
}