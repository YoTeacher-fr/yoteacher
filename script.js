// ===== CONFIGURATION =====
const CONFIG = {
    autoScrollOffset: 80,
    coursesScrollOffset: 200
};

// ===== DONNÉES DES COURS MODIFIÉES =====
const coursesData = [
    {
        id: 1,
        type: "Conversation",
        focus: "Discussion uniquement",
        price: 20,
        duration: "60 minutes",
        features: [
            "Fluidité à l'oral",
            "Vocabulaire quotidien",
            "Correction en temps réel",
            "Sujets variés d'actualité"
        ],
        details: [
            { duration: "30min", price: 10 },
            { duration: "45min", price: 15 },
            { duration: "Forfait 10 cours", price: 190, discount: "(-5%)" }
        ],
        buttonText: "Réserver",
        featured: false
    },
    {
        id: 2,
        type: "Curriculum Complet",
        focus: "Grammaire, exercices, structure",
        price: 35,
        duration: "60 minutes",
        features: [
            "Grammaire approfondie",
            "Exercices personnalisés",
            "Structure complète",
            "Programme sur mesure"
        ],
        details: [
            { duration: "Forfait 10 cours", price: 332.50, discount: "(-5%)" }
        ],
        buttonText: "Choisir ce cours",
        featured: true
    },
    {
        id: 3,
        type: "Cours d'Essai",
        focus: "Premier contact, évaluation",
        price: 5,
        duration: "15 minutes",
        features: [
            "Évaluation de votre niveau",
            "Définition des objectifs",
            "Découverte de la méthode"
        ],
        details: [
            { duration: "Confirmation automatique" }
        ],
        buttonText: "Essayer",
        featured: false
    }
];

// ===== DONNÉES DES TÉMOIGNAGES =====
const testimonialsData = [
    {
        id: 1,
        name: "Marina",
        country: "🇧🇷 Brésil",
        content: "Yoann est un professeur fantastique ! Ses cours sont dynamiques et il sait vraiment comment me mettre à l'aise. J'ai fait des progrès incroyables en seulement quelques mois.",
        rating: 5,
        lessons: "42 cours"
    },
    {
        id: 2,
        name: "Kay",
        country: "🇺🇸 États-Unis",
        content: "J'adore apprendre avec Yoann. Il est patient, professionnel et ses cours sont toujours bien préparés. Il s'adapte parfaitement à mon niveau et mes besoins.",
        rating: 5,
        lessons: "28 cours"
    },
    {
        id: 3,
        name: "Julia",
        country: "🇩🇪 Allemagne",
        content: "Les cours avec Yoann sont un vrai plaisir ! Il crée une atmosphère détendue où je n'ai pas peur de faire des erreurs. Ma confiance en français a vraiment augmenté.",
        rating: 5,
        lessons: "15 cours"
    },
    {
        id: 4,
        name: "Octavi",
        country: "🇪🇸 Espagne",
        content: "Yoann est chaleureux et ouvert d'esprit. Ses voyages dans 75 pays rendent nos conversations très intéressantes. Je recommande vivement !",
        rating: 5,
        lessons: "56 cours"
    },
    {
        id: 5,
        name: "Nahéma",
        country: "🇨🇦 Canada",
        content: "Grâce à Yoann, j'ai réussi mon examen DELF B2 ! Sa méthode de préparation est efficace et il sait exactement comment vous préparer au succès.",
        rating: 5,
        lessons: "24 cours"
    },
    {
        id: 6,
        name: "Chen",
        country: "🇨🇳 Chine",
        content: "Professeur très professionnel et bienveillant. Il prend le temps d'expliquer la grammaire clairement et les cours sont toujours vivants et dynamiques.",
        rating: 5,
        lessons: "37 cours"
    },
    {
        id: 7,
        name: "Luca",
        country: "🇮🇹 Italie",
        content: "Je prépare le DELF B1 avec Yoann et ses conseils sont précieux. Il connaît parfaitement les exigences de l'examen.",
        rating: 5,
        lessons: "18 cours"
    },
    {
        id: 8,
        name: "Sofia",
        country: "🇦🇷 Argentine",
        content: "Les cours avec Yoann sont toujours très structurés et intéressants. J'ai beaucoup progressé en compréhension orale.",
        rating: 5,
        lessons: "32 cours"
    },
    {
        id: 9,
        name: "Ahmed",
        country: "🇲🇦 Maroc",
        content: "Professeur exceptionnel ! Yoann sait s'adapter à chaque élève et rend l'apprentissage du français agréable.",
        rating: 5,
        lessons: "25 cours"
    }
];

// ===== ÉTAT GLOBAL =====
let state = {
    testimonialsLoaded: false,
    currentTestimonialSlide: 0
};

// ===== FONCTIONS UTILITAIRES =====
const utils = {
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    showNotification: (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
};

// ===== GÉNÉRATION DES COURS =====
const coursesManager = {
    init: () => {
        const container = document.getElementById('coursesContainer');
        if (!container) return;
        
        container.innerHTML = '';
        coursesData.forEach(course => coursesManager.createCourseCard(course, container));
        
        // Ajouter les événements aux boutons
        coursesManager.addCourseEvents();
    },
    
    createCourseCard: (course, container) => {
        const card = document.createElement('div');
        card.className = `course-card ${course.featured ? 'featured' : ''}`;
        card.setAttribute('data-course-id', course.id);
        
        // Générer les détails de prix
        let priceDetailsHTML = '';
        
        if (course.id === 1) {
            priceDetailsHTML = `
                <div style="margin-top: 10px; color: #666; font-weight: 500;">
                    30min : 10€ │ 45min : 15€
                </div>
            `;
        }
        
        // Ajouter les détails supplémentaires (forfaits)
        course.details.forEach(detail => {
            if (detail.discount) {
                priceDetailsHTML += `
                    <div style="margin-top: 10px; color: #4CAF50; font-weight: 600;">
                        ${detail.duration}: ${detail.price}€ ${detail.discount}
                    </div>
                `;
            } else if (detail.price && course.id !== 1) {
                priceDetailsHTML += `
                    <div style="margin-top: 10px; color: #666; font-weight: 500;">
                        ${detail.duration}: ${detail.price}€
                    </div>
                `;
            }
        });
        
        // Générer les features
        const featuresHTML = course.features.map(feature => `
            <div class="course-feature">
                <i class="fas fa-check"></i>
                <span>${feature}</span>
            </div>
        `).join('');
        
        // HTML pour le prix avec "/h" en plus petit
        let priceHTML = '';
        if (course.id === 3) {
            priceHTML = `<span class="price-main">${course.price}€</span>`;
        } else {
            priceHTML = `
                <span class="price-main">${course.price}€<span class="price-per-hour">/h</span></span>
            `;
        }
        
        card.innerHTML = `
            <div class="course-header">
                <div class="course-type">${course.type}</div>
                <div class="course-focus">${course.focus}</div>
            </div>
            <div class="course-body">
                <div class="course-price">
                    ${priceHTML}
                    <div class="price-details">${priceDetailsHTML}</div>
                </div>
                
                <div class="course-features">
                    ${featuresHTML}
                </div>
                
                <button class="btn btn-primary course-book-btn" data-course="${course.id}">
                    ${course.buttonText}
                </button>
            </div>
        `;
        
        container.appendChild(card);
    },
    
    addCourseEvents: () => {
        document.querySelectorAll('.course-book-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const courseId = e.target.getAttribute('data-course');
                const course = coursesData.find(c => c.id == courseId);
                
                if (course) {
                    utils.showNotification(`Réservation du cours "${course.type}" - Redirection en cours...`, 'success');
                    
                    setTimeout(() => {
                        window.open('#', '_blank');
                    }, 1500);
                }
            });
        });
        
        // Animation au survol
        document.querySelectorAll('.course-card').forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            });
        });
    }
};

// ===== GÉNÉRATION DES TÉMOIGNAGES =====
const testimonialsManager = {
    currentSlide: 0,
    slidesPerView: 3,
    
    init: () => {
        const container = document.getElementById('testimonialsSlider');
        const indicatorsContainer = document.getElementById('testimonialIndicators');
        
        if (!container) {
            console.error('Conteneur des témoignages non trouvé');
            return;
        }
        
        // Calculer le nombre de slides en fonction de l'écran
        testimonialsManager.calculateSlidesPerView();
        
        // Générer les témoignages
        container.innerHTML = '';
        testimonialsData.forEach((testimonial, index) => {
            const card = testimonialsManager.createTestimonialCard(testimonial);
            container.appendChild(card);
            
            // Afficher/masquer selon l'index
            if (index < testimonialsManager.slidesPerView) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
        
        // Générer les indicateurs
        testimonialsManager.generateIndicators(indicatorsContainer);
        
        // Ajouter les événements
        testimonialsManager.addTestimonialEvents();
        testimonialsManager.setupNavigation();
    },
    
    calculateSlidesPerView: () => {
        const width = window.innerWidth;
        if (width >= 992) {
            testimonialsManager.slidesPerView = 3;
        } else if (width >= 768) {
            testimonialsManager.slidesPerView = 2;
        } else {
            testimonialsManager.slidesPerView = 1;
        }
    },
    
    createTestimonialCard: (testimonial) => {
        const card = document.createElement('div');
        card.className = 'testimonial-card fade-in-up';
        card.setAttribute('data-testimonial-id', testimonial.id);
        
        // Générer les étoiles
        let starsHTML = '';
        for (let i = 0; i < testimonial.rating; i++) {
            starsHTML += '<i class="fas fa-star"></i>';
        }
        
        // Première lettre du nom
        const firstLetter = testimonial.name.charAt(0);
        
        card.innerHTML = `
            <div class="quote-icon">
                <i class="fas fa-quote-right"></i>
            </div>
            
            <div class="rating-stars">
                ${starsHTML}
            </div>
            
            <p class="testimonial-content">
                "${testimonial.content}"
            </p>
            
            <div class="testimonial-author">
                <div class="author-avatar">
                    ${firstLetter}
                </div>
                <div class="author-info">
                    <h4>${testimonial.name}</h4>
                    <p>${testimonial.country} • ${testimonial.lessons}</p>
                </div>
            </div>
        `;
        
        return card;
    },
    
    generateIndicators: (container) => {
        if (!container) return;
        
        const totalSlides = Math.ceil(testimonialsData.length / testimonialsManager.slidesPerView);
        container.innerHTML = '';
        
        for (let i = 0; i < totalSlides; i++) {
            const indicator = document.createElement('button');
            indicator.className = `testimonial-indicator ${i === 0 ? 'active' : ''}`;
            indicator.setAttribute('data-slide', i);
            indicator.addEventListener('click', () => {
                testimonialsManager.goToSlide(i);
            });
            container.appendChild(indicator);
        }
    },
    
    setupNavigation: () => {
        const prevBtn = document.getElementById('prevTestimonial');
        const nextBtn = document.getElementById('nextTestimonial');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                testimonialsManager.prevSlide();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                testimonialsManager.nextSlide();
            });
        }
        
        // Navigation au clavier
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                testimonialsManager.prevSlide();
            } else if (e.key === 'ArrowRight') {
                testimonialsManager.nextSlide();
            }
        });
        
        // Redimensionnement de la fenêtre
        window.addEventListener('resize', () => {
            testimonialsManager.calculateSlidesPerView();
            testimonialsManager.updateSlider();
            testimonialsManager.generateIndicators(document.getElementById('testimonialIndicators'));
        });
    },
    
    prevSlide: () => {
        const totalSlides = Math.ceil(testimonialsData.length / testimonialsManager.slidesPerView);
        testimonialsManager.currentSlide = (testimonialsManager.currentSlide - 1 + totalSlides) % totalSlides;
        testimonialsManager.updateSlider();
    },
    
    nextSlide: () => {
        const totalSlides = Math.ceil(testimonialsData.length / testimonialsManager.slidesPerView);
        testimonialsManager.currentSlide = (testimonialsManager.currentSlide + 1) % totalSlides;
        testimonialsManager.updateSlider();
    },
    
    goToSlide: (slideIndex) => {
        const totalSlides = Math.ceil(testimonialsData.length / testimonialsManager.slidesPerView);
        if (slideIndex >= 0 && slideIndex < totalSlides) {
            testimonialsManager.currentSlide = slideIndex;
            testimonialsManager.updateSlider();
        }
    },
    
    updateSlider: () => {
        const container = document.getElementById('testimonialsSlider');
        const indicators = document.querySelectorAll('.testimonial-indicator');
        
        if (!container) return;
        
        // Masquer tous les témoignages
        const cards = container.querySelectorAll('.testimonial-card');
        cards.forEach(card => {
            card.style.display = 'none';
        });
        
        // Afficher seulement ceux de la slide actuelle
        const startIndex = testimonialsManager.currentSlide * testimonialsManager.slidesPerView;
        const endIndex = startIndex + testimonialsManager.slidesPerView;
        
        for (let i = startIndex; i < endIndex && i < testimonialsData.length; i++) {
            if (cards[i]) {
                cards[i].style.display = 'block';
            }
        }
        
        // Mettre à jour les indicateurs
        indicators.forEach((indicator, index) => {
            if (index === testimonialsManager.currentSlide) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
        
        // Mettre à jour les boutons de navigation
        const prevBtn = document.getElementById('prevTestimonial');
        const nextBtn = document.getElementById('nextTestimonial');
        const totalSlides = Math.ceil(testimonialsData.length / testimonialsManager.slidesPerView);
        
        if (prevBtn) {
            prevBtn.disabled = testimonialsManager.currentSlide === 0;
        }
        
        if (nextBtn) {
            nextBtn.disabled = testimonialsManager.currentSlide === totalSlides - 1;
        }
    },
    
    addTestimonialEvents: () => {
        document.querySelectorAll('.testimonial-card').forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-10px)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        });
    }
};

// ===== NAVIGATION =====
const navigationManager = {
    init: () => {
        // Navigation fluide
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href === '#') return;
                
                e.preventDefault();
                navigationManager.scrollToSection(href);
            });
        });
        
        // Boutons CTA
        document.querySelectorAll('.btn[href^="#"]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href === '#') return;
                
                e.preventDefault();
                navigationManager.scrollToSection(href);
            });
        });
    },
    
    scrollToSection: (selector) => {
        const target = document.querySelector(selector);
        if (!target) return;
        
        // Pour la section cours
        if (selector === '#courses') {
            setTimeout(() => {
                const coursesContainer = document.querySelector('.courses-container');
                if (coursesContainer) {
                    const containerRect = coursesContainer.getBoundingClientRect();
                    const scrollPosition = window.pageYOffset + containerRect.top - 120;
                    
                    window.scrollTo({
                        top: scrollPosition,
                        behavior: 'smooth'
                    });
                } else {
                    window.scrollTo({
                        top: target.offsetTop - 150,
                        behavior: 'smooth'
                    });
                }
            }, 50);
            return;
        }
        
        // Pour les autres sections
        const headerHeight = 100;
        window.scrollTo({
            top: target.offsetTop - headerHeight,
            behavior: 'smooth'
        });
    }
};

// ===== INTERACTIONS UTILISATEUR =====
const uiManager = {
    init: () => {
        // Changement de langue
        const languageSwitcher = document.querySelector('.language-switcher');
        if (languageSwitcher) {
            languageSwitcher.addEventListener('click', () => {
                utils.showNotification('Fonctionnalité de changement de langue à venir', 'info');
            });
        }
        
        // Bouton connexion desktop
        const loginBtn = document.querySelector('.login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                utils.showNotification('Page de connexion en développement', 'info');
            });
        }
        
        // Bouton connexion MOBILE (nouveau)
        const mobileLoginBtn = document.querySelector('.mobile-login-btn-header');
        if (mobileLoginBtn) {
            mobileLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                utils.showNotification('Page de connexion en développement', 'info');
                // Fermer le menu mobile si ouvert
                mobileMenuManager.closeMobileMenu();
            });
        }
        
        // Gestion du scroll pour le header
        window.addEventListener('scroll', uiManager.handleScroll);
        
        // Initialiser le header
        uiManager.handleScroll();
    },
    
    handleScroll: utils.debounce(() => {
        const header = document.querySelector('.main-header');
        const aboutSection = document.querySelector('#about');
        
        if (!header) return;
        
        const aboutOffset = aboutSection ? aboutSection.offsetTop : 0;
        const scrollPosition = window.scrollY;
        
        if (scrollPosition > 100 || 
            (scrollPosition >= aboutOffset - 100 && scrollPosition <= aboutOffset + aboutSection.offsetHeight)) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }, 10)
};

// ===== GESTION DE L'IMAGE =====
const imageManager = {
    init: () => {
        const yoannImage = document.getElementById('yoannImage');
        
        if (yoannImage) {
            yoannImage.addEventListener('error', () => {
                yoannImage.src = 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
                yoannImage.alt = 'Professeur de français';
            });
            
            yoannImage.addEventListener('load', () => {
                yoannImage.style.opacity = '1';
                yoannImage.style.transform = 'scale(1)';
            });
        }
    }
};

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
        
        console.log('Menu mobile initialisé');
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

// ===== INITIALISATION =====
const app = {
    init: () => {
        console.log('Initialisation de l\'application...');
        
        // Empêcher le retour en haut au rafraîchissement
        window.addEventListener('beforeunload', () => {
            sessionStorage.setItem('scrollPosition', window.scrollY);
        });
        
        if (sessionStorage.getItem('scrollPosition')) {
            window.addEventListener('load', () => {
                const savedPosition = parseInt(sessionStorage.getItem('scrollPosition'));
                setTimeout(() => {
                    window.scrollTo(0, savedPosition);
                    sessionStorage.removeItem('scrollPosition');
                }, 100);
            });
        }
        
        // Vérifier que le DOM est chargé
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', app.setup);
        } else {
            app.setup();
        }
    },
    
    setup: () => {
        console.log('Configuration des modules...');
        
        // Ajuster le padding pour le header fixe
        document.body.style.paddingTop = '80px';
        
        // Initialiser les managers
        mobileMenuManager.init();
        coursesManager.init();
        testimonialsManager.init();
        navigationManager.init();
        uiManager.init();
        imageManager.init();
        
        // Gestion du redimensionnement
        window.addEventListener('resize', utils.debounce(() => {
            testimonialsManager.calculateSlidesPerView();
            testimonialsManager.updateSlider();
        }, 250));
        
        // Ajouter les styles de notification
        app.addNotificationStyles();
        
        // Debug
        console.log('Application prête !');
        console.log('Bouton connexion mobile:', document.querySelector('.mobile-login-btn-header'));
    },
    
    addNotificationStyles: () => {
        const style = document.createElement('style');
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 15px 20px;
                border-radius: 10px;
                box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 10000;
                transform: translateX(120%);
                transition: transform 0.3s ease;
                border-left: 4px solid #1e88e5;
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification-success {
                border-left-color: #4CAF50;
            }
            
            .notification-error {
                border-left-color: #e74c3c;
            }
            
            .notification-info {
                border-left-color: #1e88e5;
            }
            
            .notification i {
                font-size: 1.2rem;
            }
            
            .notification-success i {
                color: #4CAF50;
            }
            
            .notification-error i {
                color: #e74c3c;
            }
            
            .notification-info i {
                color: #1e88e5;
            }
        `;
        document.head.appendChild(style);
    }
};

// ===== DÉMARRAGE DE L'APPLICATION =====
app.init();

// Exposer certaines fonctions globalement pour le débogage
window.appDebug = {
    reloadTestimonials: () => {
        testimonialsManager.init();
        utils.showNotification('Témoignages rechargés', 'success');
    },
    
    nextSlide: () => testimonialsManager.nextSlide(),
    prevSlide: () => testimonialsManager.prevSlide(),
    
    showTestNotification: () => {
        utils.showNotification('Notification de test', 'success');
    },
    
    testScrollToCourses: () => {
        navigationManager.scrollToSection('#courses');
    },
    
    testMenu: () => {
        mobileMenuManager.toggleMobileMenu();
    }
};