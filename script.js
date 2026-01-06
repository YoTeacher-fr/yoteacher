// ===== CONFIGURATION =====
const APP_CONFIG = {
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
        basePriceEUR: 20, // Prix de base en EUR
        duration: "60 minutes",
        features: [
            "Fluidité à l'oral",
            "Vocabulaire quotidien",
            "Correction en temps réel",
            "Sujets variés d'actualité"
        ],
        details: [
            { duration: "30min", price: 10, basePriceEUR: 10 },
            { duration: "45min", price: 15, basePriceEUR: 15 },
            { duration: "Forfait 10 cours", price: 190, basePriceEUR: 190, discount: "(-5%)" }
        ],
        buttonText: "Réserver",
        featured: false
    },
    {
        id: 2,
        type: "Curriculum Complet",
        focus: "Grammaire, exercices, structure",
        price: 35,
        basePriceEUR: 35,
        duration: "60 minutes",
        features: [
            "Grammaire approfondie",
            "Exercices personnalisés",
            "Structure complète",
            "Programme sur mesure"
        ],
        details: [
            { duration: "Forfait 10 cours", price: 332.50, basePriceEUR: 332.50, discount: "(-5%)" }
        ],
        buttonText: "Choisir ce cours",
        featured: true
    },
    {
        id: 3,
        type: "Cours d'Essai",
        focus: "Premier contact, évaluation",
        price: 5,
        basePriceEUR: 5,
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

// ===== GÉNÉRATION DES COURS =====
const coursesManager = {
    init: () => {
        const container = document.getElementById('coursesContainer');
        if (!container) return;
        
        container.innerHTML = '';
        coursesData.forEach(course => coursesManager.createCourseCard(course, container));
        
        // Ajouter les événements aux boutons
        coursesManager.addCourseEvents();
        
        // Mettre à jour les prix avec la devise actuelle
        coursesManager.updateCoursePrices();
    },
    
    createCourseCard: (course, container) => {
        const card = document.createElement('div');
        card.className = `course-card ${course.featured ? 'featured' : ''}`;
        card.setAttribute('data-course-id', course.id);
        card.setAttribute('data-base-price', course.basePriceEUR);
        
        // Générer les détails de prix
        let priceDetailsHTML = '';
        
        if (course.id === 1) {
            priceDetailsHTML = `
                <div class="price-detail-item" data-base-price-30="10" data-base-price-45="15">
                    30min : <span class="price-30">10€</span> │ 45min : <span class="price-45">15€</span>
                </div>
            `;
        }
        
        // Ajouter les détails supplémentaires (forfaits)
        course.details.forEach(detail => {
            if (detail.discount) {
                priceDetailsHTML += `
                    <div class="price-detail-item" data-base-price-forfait="${detail.basePriceEUR || detail.price}">
                        ${detail.duration}: <span class="price-forfait">${detail.price}€</span> ${detail.discount}
                    </div>
                `;
            } else if (detail.price && course.id !== 1) {
                priceDetailsHTML += `
                    <div class="price-detail-item" data-base-price="${detail.basePriceEUR || detail.price}">
                        ${detail.duration}: <span class="price-detail">${detail.price}€</span>
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
    
    updateCoursePrices: () => {
        if (!window.currencyManager) return;
        
        const currency = window.currencyManager.currentCurrency;
        const symbol = window.currencyManager.getSymbol();
        
        document.querySelectorAll('.course-card').forEach(card => {
            const basePrice = parseFloat(card.dataset.basePrice || '0');
            const priceElement = card.querySelector('.price-main');
            
            if (priceElement && basePrice > 0) {
                const formattedPrice = window.currencyManager.formatPrice(basePrice);
                
                // Garder le "/h" si présent
                const perHourSpan = priceElement.querySelector('.price-per-hour');
                if (perHourSpan) {
                    priceElement.innerHTML = `${formattedPrice}<span class="price-per-hour">/h</span>`;
                } else {
                    priceElement.textContent = formattedPrice;
                }
            }
            
            // Mettre à jour les prix détaillés
            const priceDetails = card.querySelectorAll('.price-detail-item');
            priceDetails.forEach(detail => {
                // Récupérer le prix de base depuis les attributs data
                let basePriceDetail = 0;
                
                if (detail.hasAttribute('data-base-price-30')) {
                    basePriceDetail = parseFloat(detail.getAttribute('data-base-price-30'));
                    const price30 = detail.querySelector('.price-30');
                    if (price30) {
                        price30.textContent = window.currencyManager.formatPrice(basePriceDetail);
                    }
                    
                    // Mettre à jour aussi le prix 45min
                    const basePrice45 = parseFloat(detail.getAttribute('data-base-price-45'));
                    const price45 = detail.querySelector('.price-45');
                    if (price45) {
                        price45.textContent = window.currencyManager.formatPrice(basePrice45);
                    }
                } 
                else if (detail.hasAttribute('data-base-price-forfait')) {
                    basePriceDetail = parseFloat(detail.getAttribute('data-base-price-forfait'));
                    const priceForfait = detail.querySelector('.price-forfait');
                    if (priceForfait) {
                        priceForfait.textContent = window.currencyManager.formatPrice(basePriceDetail);
                    }
                }
                else if (detail.hasAttribute('data-base-price')) {
                    basePriceDetail = parseFloat(detail.getAttribute('data-base-price'));
                    const priceDetail = detail.querySelector('.price-detail');
                    if (priceDetail) {
                        priceDetail.textContent = window.currencyManager.formatPrice(basePriceDetail);
                    }
                }
            });
        });
        
        console.log(`✅ Prix des cours mis à jour en ${currency}`);
    },
    
    addCourseEvents: () => {
        document.querySelectorAll('.course-book-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const courseId = e.target.getAttribute('data-course');
                const course = coursesData.find(c => c.id == courseId);
                
                if (course) {
                    let courseType = 'essai';
                    if (course.id === 1) courseType = 'conversation';
                    if (course.id === 2) courseType = 'grammaire';
                    if (course.id === 3) courseType = 'essai';
                    
                    // Correction pour mobile: navigation directe sans notification
                    window.location.href = `booking.html?type=${courseType}`;
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
        coursesManager.init();
        testimonialsManager.init();
        navigationManager.init();
        uiManager.init();
        imageManager.init();
        mobileManager.init();
        
        // Gestion du redimensionnement
        window.addEventListener('resize', () => {
            testimonialsManager.calculateSlidesPerView();
            testimonialsManager.updateSlider();
            mobileManager.checkMobileLayout();
        });
        
        // Écouter les changements de devise
        window.addEventListener('currency:ready', () => {
            coursesManager.updateCoursePrices();
        });
        
        window.addEventListener('currency:changed', () => {
            coursesManager.updateCoursePrices();
        });
        
        // Debug
        console.log('Application prête !');
    }
};

// ===== DÉMARRAGE DE L'APPLICATION =====
app.init();