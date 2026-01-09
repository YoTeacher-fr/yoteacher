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
        typeKey: "courses.conversation",
        focus: "Discussion uniquement",
        focusKey: "courses.conversation_focus",
        price: 20,
        basePriceEUR: 20,
        duration: "60 minutes",
        features: [
            { text: "Fluidité à l'oral", key: "courses.feature1" },
            { text: "Vocabulaire quotidien", key: "courses.feature2" },
            { text: "Correction en temps réel", key: "courses.feature3" },
            { text: "Sujets variés d'actualité", key: "courses.feature4" }
        ],
        details: [
            { duration: "30min", durationKey: "courses.detail_30min", price: 10, basePriceEUR: 10 },
            { duration: "45min", durationKey: "courses.detail_45min", price: 15, basePriceEUR: 15 },
            { duration: "Forfait 10 cours", durationKey: "courses.detail_forfait", price: 190, basePriceEUR: 190, discount: "(-5%)", discountKey: "courses.discount" }
        ],
        buttonText: "Réserver",
        buttonTextKey: "courses.button_reserve",
        featured: false
    },
    {
        id: 2,
        type: "Curriculum Complet",
        typeKey: "courses.curriculum",
        focus: "Grammaire, exercices, structure",
        focusKey: "courses.curriculum_focus",
        price: 35,
        basePriceEUR: 35,
        duration: "60 minutes",
        features: [
            { text: "Grammaire approfondie", key: "courses.feature5" },
            { text: "Exercices personnalisés", key: "courses.feature6" },
            { text: "Structure complète", key: "courses.feature7" },
            { text: "Programme sur mesure", key: "courses.feature8" }
        ],
        details: [
            { duration: "30min", durationKey: "courses.detail_30min", price: 17.5, basePriceEUR: 17.5 },
            { duration: "45min", durationKey: "courses.detail_45min", price: 26.25, basePriceEUR: 26.25 },
            { duration: "Forfait 10 cours", durationKey: "courses.detail_forfait", price: 332.50, basePriceEUR: 332.50, discount: "(-5%)", discountKey: "courses.discount" }
        ],
        buttonText: "Choisir ce cours",
        buttonTextKey: "courses.button_choose",
        featured: true
    },
    {
        id: 3,
        type: "Préparation d'examen",
        typeKey: "courses.exam",
        focus: "DELF, DALF, TCF",
        focusKey: "courses.exam_focus",
        price: 30,
        basePriceEUR: 30,
        duration: "60 minutes",
        features: [
            { text: "Simulations d'examen", key: "courses.feature9" },
            { text: "Correction détaillée", key: "courses.feature10" },
            { text: "Stratégies de réussite", key: "courses.feature11" },
            { text: "Feedbacks personnalisés", key: "courses.feature12" }
        ],
        details: [
            { duration: "30min", durationKey: "courses.detail_30min", price: 15, basePriceEUR: 15 },
            { duration: "45min", durationKey: "courses.detail_45min", price: 22.5, basePriceEUR: 22.5 },
            { duration: "Forfait 10 cours", durationKey: "courses.detail_forfait", price: 285, basePriceEUR: 285, discount: "(-5%)", discountKey: "courses.discount" }
        ],
        buttonText: "Choisir ce cours",
        buttonTextKey: "courses.button_choose",
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

// Fonction utilitaire pour obtenir une traduction
function getTranslation(key, fallback) {
    console.log('🔍 getTranslation appelé avec key:', key);
    
    if (window.translationManager) {
        console.log('✅ translationManager trouvé:', window.translationManager);
        console.log('🔍 Type de getTranslation:', typeof window.translationManager.getTranslation);
        
        // Vérifier si getTranslation existe et est une fonction
        if (typeof window.translationManager.getTranslation === 'function') {
            const translation = window.translationManager.getTranslation(key);
            console.log('🌍 Traduction obtenue:', translation);
            
            if (translation && translation !== key) {
                return translation;
            }
        } else {
            console.error('❌ translationManager.getTranslation n\'est pas une fonction');
            console.log('🔍 translationManager:', window.translationManager);
        }
    } else {
        console.error('❌ translationManager non disponible');
    }
    
    console.log('↩️ Retour fallback:', fallback);
    return fallback;
}

// ===== GÉNÉRATION DES COURS =====
const coursesManager = {
    init: () => {
        console.log('📚 Initialisation des cours...');
        const container = document.getElementById('coursesContainer');
        if (!container) {
            console.error('❌ Conteneur des cours non trouvé');
            return;
        }
        
        container.innerHTML = '';
        
        // Vérifier si translationManager est prêt
        if (!window.translationManager) {
            console.warn('⚠️ translationManager non disponible, utilisation des textes par défaut');
        }
        
        coursesData.forEach(course => coursesManager.createCourseCard(course, container));
        
        // Ajouter les événements aux boutons
        coursesManager.addCourseEvents();
        
        // Mettre à jour les prix avec la devise actuelle
        coursesManager.updateCoursePrices();
        
        console.log(`✅ ${coursesData.length} cartes de cours créées`);
    },
    
    createCourseCard: (course, container) => {
        const card = document.createElement('div');
        card.className = `course-card ${course.featured ? 'featured' : ''}`;
        card.setAttribute('data-course-id', course.id);
        card.setAttribute('data-base-price', course.basePriceEUR);
        
        // Obtenir les textes traduits avec fallback
        const courseType = getTranslation(course.typeKey, course.type);
        const courseFocus = getTranslation(course.focusKey, course.focus);
        const courseButtonText = getTranslation(course.buttonTextKey, course.buttonText);
        const pricePerHour = getTranslation('courses.price_per_hour', '/h');
        
        // Générer les détails de prix
        let priceDetailsHTML = '';
        
        // Pour TOUTES les cartes, on affiche 30min et 45min sur la même ligne, puis le forfait séparément
        // Chercher les détails 30min et 45min
        const detail30min = course.details.find(d => d.duration === '30min' || d.durationKey === 'courses.detail_30min');
        const detail45min = course.details.find(d => d.duration === '45min' || d.durationKey === 'courses.detail_45min');
        const forfaitDetail = course.details.find(d => d.durationKey === 'courses.detail_forfait');
        
        // Afficher 30min et 45min sur la même ligne avec │
        if (detail30min && detail45min) {
            const duration30 = getTranslation(detail30min.durationKey || 'courses.detail_30min', '30min');
            const duration45 = getTranslation(detail45min.durationKey || 'courses.detail_45min', '45min');
            
            priceDetailsHTML = `
                <div class="price-detail-item" data-base-price-30="${detail30min.basePriceEUR || detail30min.price}" data-base-price-45="${detail45min.basePriceEUR || detail45min.price}">
                    ${duration30} : <span class="price-30">${detail30min.price}€</span> │ ${duration45} : <span class="price-45">${detail45min.price}€</span>
                </div>
            `;
        } else {
            // Fallback si on ne trouve pas les deux durées
            course.details.forEach(detail => {
                if (detail.duration !== 'Forfait 10 cours' && detail.durationKey !== 'courses.detail_forfait') {
                    const durationText = getTranslation(detail.durationKey, detail.duration);
                    priceDetailsHTML += `
                        <div class="price-detail-item" data-base-price="${detail.basePriceEUR || detail.price}">
                            ${durationText}: <span class="price-detail">${detail.price}€</span>
                        </div>
                    `;
                }
            });
        }
        
        // Ajouter le forfait séparément
        if (forfaitDetail) {
            const durationText = getTranslation(forfaitDetail.durationKey, forfaitDetail.duration);
            const discountText = getTranslation(forfaitDetail.discountKey, forfaitDetail.discount);
            
            priceDetailsHTML += `
                <div class="price-detail-item" data-base-price-forfait="${forfaitDetail.basePriceEUR || forfaitDetail.price}">
                    ${durationText}: <span class="price-forfait">${forfaitDetail.price}€</span> ${discountText}
                </div>
            `;
        }
        
        // Générer les features avec traductions
        const featuresHTML = course.features.map(feature => {
            const featureText = feature.key ? 
                getTranslation(feature.key, feature.text) : 
                feature.text;
            return `
                <div class="course-feature">
                    <i class="fas fa-check"></i>
                    <span>${featureText}</span>
                </div>
            `;
        }).join('');
        
        // HTML pour le prix
        let priceHTML = '';
        if (course.id === 3) {
            priceHTML = `<span class="price-main">${course.price}€<span class="price-per-hour">${pricePerHour}</span></span>`;
        } else {
            priceHTML = `
                <span class="price-main">${course.price}€<span class="price-per-hour">${pricePerHour}</span></span>
            `;
        }
        
        card.innerHTML = `
            <div class="course-header">
                <div class="course-type">${courseType}</div>
                <div class="course-focus">${courseFocus}</div>
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
                    ${courseButtonText}
                </button>
            </div>
        `;
        
        container.appendChild(card);
    },
    
    updateCoursePrices: () => {
        if (!window.currencyManager) {
            console.log('⏳ Gestionnaire de devise non disponible pour mettre à jour les prix');
            return;
        }
        
        const currency = window.currencyManager.currentCurrency;
        
        document.querySelectorAll('.course-card').forEach(card => {
            const basePrice = parseFloat(card.dataset.basePrice || '0');
            const priceElement = card.querySelector('.price-main');
            
            if (priceElement && basePrice > 0) {
                const formattedPrice = window.currencyManager.formatPrice(basePrice);
                
                // Garder le "/h" si présent
                const perHourSpan = priceElement.querySelector('.price-per-hour');
                if (perHourSpan) {
                    priceElement.innerHTML = `${formattedPrice}<span class="price-per-hour">${getTranslation('courses.price_per_hour', '/h')}</span>`;
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
                    if (course.id === 2) courseType = 'curriculum';
                    if (course.id === 3) courseType = 'examen';
                    
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
    },
    
    reloadCourses: () => {
        console.log('🔄 Rechargement des cours avec les nouvelles traductions...');
        coursesManager.init();
    }
};

// ===== GÉNÉRATION DES TÉMOIGNAGES =====
const testimonialsManager = {
    currentSlide: 0,
    slidesPerView: 3,
    
    init: () => {
        console.log('💬 Initialisation des témoignages...');
        const container = document.getElementById('testimonialsSlider');
        const indicatorsContainer = document.getElementById('testimonialIndicators');
        
        if (!container) {
            console.error('❌ Conteneur des témoignages non trouvé');
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
        
        state.testimonialsLoaded = true;
        console.log(`✅ ${testimonialsData.length} témoignages créés`);
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
        // Gestion du scroll pour le header
        window.addEventListener('scroll', uiManager.handleScroll);
        
        // Initialiser le header
        uiManager.handleScroll();
    },
    
    handleScroll: () => {
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
    }
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

// ===== GESTION MOBILE =====
const mobileManager = {
    init: () => {
        // Mettre à jour les liens de connexion mobile
        mobileManager.updateMobileLoginLinks();
        
        // Redimensionnement
        window.addEventListener('resize', mobileManager.updateMobileLoginLinks);
        
        // Vérifier la taille d'écran au chargement
        mobileManager.checkMobileLayout();
    },
    
    updateMobileLoginLinks: () => {
        if (window.innerWidth <= 768) {
            const mobileLoginBtn = document.querySelector('.mobile-login-btn');
            const mobileLoginHeaderBtn = document.querySelector('.mobile-login-btn-header');
            
            // Mettre à jour le bouton dans le header
            if (mobileLoginHeaderBtn && !window.location.pathname.includes('login.html')) {
                const currentUrl = encodeURIComponent(window.location.href);
                mobileLoginHeaderBtn.href = `login.html?redirect=${currentUrl}`;
            }
            
            // Mettre à jour le bouton dans le menu mobile
            if (mobileLoginBtn && !window.location.pathname.includes('login.html')) {
                const currentUrl = encodeURIComponent(window.location.href);
                mobileLoginBtn.href = `login.html?redirect=${currentUrl}`;
            }
        }
    },
    
    checkMobileLayout: () => {
        // Adapter le layout pour mobile
        if (window.innerWidth <= 768) {
            // Cacher les statistiques desktop, montrer mobile
            document.querySelectorAll('.desktop-stat').forEach(el => {
                el.style.display = 'none';
            });
            document.querySelectorAll('.mobile-stat').forEach(el => {
                el.style.display = 'inline';
            });
        } else {
            // Cacher les statistiques mobile, montrer desktop
            document.querySelectorAll('.desktop-stat').forEach(el => {
                el.style.display = 'inline';
            });
            document.querySelectorAll('.mobile-stat').forEach(el => {
                el.style.display = 'none';
            });
        }
    }
};

// ===== GESTION DE LA TRADUCTION =====
const appTranslationManager = {
    init: () => {
        console.log('🌍 Initialisation du gestionnaire de traduction de l\'app...');
        
        // Vérifier que le gestionnaire de traduction principal est disponible
        if (!window.translationManager) {
            console.warn('⚠️ TranslationManager principal non disponible');
            return;
        }
        
        console.log('✅ TranslationManager principal disponible');
        
        // Mettre à jour les cartes de cours avec les traductions
        appTranslationManager.translateCourses();
        
        // Écouter les changements de langue
        window.addEventListener('language:changed', () => {
            console.log('🌍 Changement de langue détecté dans l\'app');
            appTranslationManager.translateCourses();
            
            // Recharger les témoignages si nécessaire
            if (state.testimonialsLoaded) {
                testimonialsManager.init();
            }
        });
        
        // Vérifier l'état initial de la langue
        console.log(`🌍 Langue actuelle: ${window.translationManager.getCurrentLanguage()}`);
    },
    
    translateCourses: () => {
        console.log('🌍 Traduction des cours dans l\'app...');
        
        // Recharger toutes les cartes de cours avec les nouvelles traductions
        coursesManager.reloadCourses();
    }
};

// ===== INITIALISATION PRINCIPALE =====
const app = {
    init: () => {
        console.log('🚀 Initialisation de l\'application...');
        
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
        console.log('⚙️ Configuration des modules...');
        
        // Ajuster le padding pour le header fixe
        document.body.style.paddingTop = '80px';
        
        // Vérifier d'abord que translationManager est prêt
        const waitForTranslationManager = () => {
            if (window.translationManager && typeof window.translationManager.getTranslation === 'function') {
                console.log('✅ TranslationManager prêt, initialisation des composants...');
                
                console.log('1. Initialisation des cours...');
                coursesManager.init();
                
                console.log('2. Initialisation des témoignages...');
                testimonialsManager.init();
                
                console.log('3. Initialisation de la navigation...');
                navigationManager.init();
                
                console.log('4. Initialisation de l\'UI...');
                uiManager.init();
                
                console.log('5. Initialisation de l\'image...');
                imageManager.init();
                
                console.log('6. Initialisation du mobile...');
                mobileManager.init();
                
                console.log('7. Initialisation de la traduction de l\'app...');
                appTranslationManager.init();
                
                console.log('✅ Application prête !');
            } else {
                console.log('⏳ En attente de translationManager...');
                setTimeout(waitForTranslationManager, 100);
            }
        };
        
        waitForTranslationManager();
        
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
    }
};

// ===== GESTION DES BOUTONS DE LANGUE =====
const initLanguageButtons = () => {
    console.log('🔧 Initialisation des boutons de langue...');
    
    // Fonction pour basculer la langue
    const toggleLanguage = () => {
        if (window.translationManager && typeof window.translationManager.toggleLanguage === 'function') {
            window.translationManager.toggleLanguage();
        } else {
            // Fallback si translationManager n'est pas disponible
            const currentLang = document.documentElement.lang || 'fr';
            const newLang = currentLang === 'fr' ? 'en' : 'fr';
            
            // Mettre à jour l'attribut lang
            document.documentElement.lang = newLang;
            
            // Mettre à jour l'affichage des boutons
            document.querySelectorAll('.language-switcher span:last-child, .mobile-language span:last-child').forEach(el => {
                el.textContent = newLang === 'fr' ? 'EN' : 'FR';
            });
            
            // Sauvegarder dans localStorage
            localStorage.setItem('language', newLang);
            
            // Déclencher un événement
            window.dispatchEvent(new CustomEvent('language:changed', { 
                detail: { language: newLang } 
            }));
            
            console.log(`🌍 Langue basculée vers: ${newLang} (fallback)`);
        }
    };
    
    // Attacher les événements aux boutons de langue desktop
    const desktopSwitcher = document.getElementById('languageSwitcherDesktop');
    if (desktopSwitcher) {
        // Supprimer les anciens écouteurs pour éviter les doublons
        const newDesktopSwitcher = desktopSwitcher.cloneNode(true);
        desktopSwitcher.parentNode.replaceChild(newDesktopSwitcher, desktopSwitcher);
        
        newDesktopSwitcher.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🌍 Clic sur bouton de langue desktop');
            toggleLanguage();
        });
    }
    
    // Attacher les événements aux boutons de langue mobile
    const mobileSwitcher = document.getElementById('languageSwitcherMobile');
    if (mobileSwitcher) {
        // Supprimer les anciens écouteurs pour éviter les doublons
        const newMobileSwitcher = mobileSwitcher.cloneNode(true);
        mobileSwitcher.parentNode.replaceChild(newMobileSwitcher, mobileSwitcher);
        
        newMobileSwitcher.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🌍 Clic sur bouton de langue mobile');
            toggleLanguage();
            
            // Fermer le menu mobile après changement
            const mobileMenu = document.getElementById('mobileMenu');
            if (mobileMenu && mobileMenu.classList.contains('active')) {
                mobileMenu.classList.remove('active');
            }
        });
    }
    
    console.log('✅ Boutons de langue initialisés');
};

// ===== INITIALISATION FINALE =====
// Attendre que tout soit chargé
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOMContentLoaded - Initialisation...');
        
        // Initialiser l'application principale
        app.init();
        
        // Initialiser les boutons de langue (double sécurité)
        setTimeout(initLanguageButtons, 300);
        
        // Vérifier que les conteneurs existent
        setTimeout(() => {
            const coursesContainer = document.getElementById('coursesContainer');
            const testimonialsContainer = document.getElementById('testimonialsSlider');
            
            console.log('🔍 Vérification des conteneurs:');
            console.log(`- Conteneur cours: ${coursesContainer ? 'TROUVÉ' : 'NON TROUVÉ'}`);
            console.log(`- Conteneur témoignages: ${testimonialsContainer ? 'TROUVÉ' : 'NON TROUVÉ'}`);
            
            // Si les conteneurs existent mais sont vides, réinitialiser
            if (coursesContainer && coursesContainer.children.length === 0) {
                console.log('⚠️ Conteneur cours vide, réinitialisation...');
                coursesManager.init();
            }
            
            if (testimonialsContainer && testimonialsContainer.children.length === 0) {
                console.log('⚠️ Conteneur témoignages vide, réinitialisation...');
                testimonialsManager.init();
            }
        }, 1000);
    });
} else {
    // Le DOM est déjà chargé
    console.log('📄 DOM déjà chargé - Initialisation...');
    app.init();
    setTimeout(initLanguageButtons, 300);
}

// Exposer les managers pour le débogage (mais ne pas écraser translationManager !)
window.coursesManager = coursesManager;
window.testimonialsManager = testimonialsManager;
// ⚠️ NE PAS ÉCRASER window.translationManager !
// window.translationManager = appTranslationManager;

console.log('📦 Script.js chargé avec succès');