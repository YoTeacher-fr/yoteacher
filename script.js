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
    if (window.translationManager) {
        if (typeof window.translationManager.getTranslation === 'function') {
            const translation = window.translationManager.getTranslation(key);
            if (translation && translation !== key) {
                return translation;
            }
        }
    }
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
        
        coursesData.forEach(course => coursesManager.createCourseCard(course, container));
        
        coursesManager.addCourseEvents();
        
        coursesManager.updateCoursePrices();
        
        console.log(`✅ ${coursesData.length} cartes de cours créées`);
    },
    
    createCourseCard: (course, container) => {
        const card = document.createElement('div');
        card.className = `course-card ${course.featured ? 'featured' : ''}`;
        card.setAttribute('data-course-id', course.id);
        card.setAttribute('data-base-price', course.basePriceEUR);
        
        const courseType = getTranslation(course.typeKey, course.type);
        const courseFocus = getTranslation(course.focusKey, course.focus);
        const courseButtonText = getTranslation(course.buttonTextKey, course.buttonText);
        const pricePerHour = getTranslation('courses.price_per_hour', '/h');
        
        let priceDetailsHTML = '';
        
        const detail30min = course.details.find(d => d.duration === '30min' || d.durationKey === 'courses.detail_30min');
        const detail45min = course.details.find(d => d.duration === '45min' || d.durationKey === 'courses.detail_45min');
        const forfaitDetail = course.details.find(d => d.durationKey === 'courses.detail_forfait');
        
        if (detail30min && detail45min) {
            const duration30 = getTranslation(detail30min.durationKey || 'courses.detail_30min', '30min');
            const duration45 = getTranslation(detail45min.durationKey || 'courses.detail_45min', '45min');
            
            priceDetailsHTML = `
                <div class="price-detail-item" data-base-price-30="${detail30min.basePriceEUR || detail30min.price}" data-base-price-45="${detail45min.basePriceEUR || detail45min.price}">
                    ${duration30} : <span class="price-30">${detail30min.price}€</span> │ ${duration45} : <span class="price-45">${detail45min.price}€</span>
                </div>
            `;
        } else {
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
        
        if (forfaitDetail) {
            const durationText = getTranslation(forfaitDetail.durationKey, forfaitDetail.duration);
            const discountText = getTranslation(forfaitDetail.discountKey, forfaitDetail.discount);
            
            priceDetailsHTML += `
                <div class="price-detail-item" data-base-price-forfait="${forfaitDetail.basePriceEUR || forfaitDetail.price}">
                    ${durationText}: <span class="price-forfait">${forfaitDetail.price}€</span> ${discountText}
                </div>
            `;
        }
        
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
                
                const perHourSpan = priceElement.querySelector('.price-per-hour');
                if (perHourSpan) {
                    priceElement.innerHTML = `${formattedPrice}<span class="price-per-hour">${getTranslation('courses.price_per_hour', '/h')}</span>`;
                } else {
                    priceElement.textContent = formattedPrice;
                }
            }
            
            const priceDetails = card.querySelectorAll('.price-detail-item');
            priceDetails.forEach(detail => {
                let basePriceDetail = 0;
                
                if (detail.hasAttribute('data-base-price-30')) {
                    basePriceDetail = parseFloat(detail.getAttribute('data-base-price-30'));
                    const price30 = detail.querySelector('.price-30');
                    if (price30) {
                        price30.textContent = window.currencyManager.formatPrice(basePriceDetail);
                    }
                    
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
        
        testimonialsManager.currentSlide = 0;
        
        testimonialsManager.calculateSlidesPerView();
        
        container.innerHTML = '';
        testimonialsData.forEach((testimonial, index) => {
            const card = testimonialsManager.createTestimonialCard(testimonial);
            container.appendChild(card);
        });
        
        testimonialsManager.generateIndicators(indicatorsContainer);
        
        testimonialsManager.addTestimonialEvents();
        testimonialsManager.setupNavigation();
        
        testimonialsManager.updateSlider();
        
        state.testimonialsLoaded = true;
        console.log(`✅ ${testimonialsData.length} témoignages créés, slidesPerView: ${testimonialsManager.slidesPerView}`);
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
        
        console.log(`📱 Écran: ${width}px, slidesPerView: ${testimonialsManager.slidesPerView}`);
    },
    
    createTestimonialCard: (testimonial) => {
        const card = document.createElement('div');
        card.className = 'testimonial-card fade-in-up';
        card.setAttribute('data-testimonial-id', testimonial.id);
        
        const name = getTranslation(`testimonial.${testimonial.id}.name`, testimonial.name);
        const country = getTranslation(`testimonial.${testimonial.id}.country`, testimonial.country);
        const content = getTranslation(`testimonial.${testimonial.id}.content`, testimonial.content);
        const lessons = getTranslation(`testimonial.${testimonial.id}.lessons`, testimonial.lessons);
        
        let starsHTML = '';
        for (let i = 0; i < testimonial.rating; i++) {
            starsHTML += '<i class="fas fa-star"></i>';
        }
        
        const firstLetter = name.charAt(0);
        
        card.innerHTML = `
            <div class="quote-icon">
                <i class="fas fa-quote-right"></i>
            </div>
            
            <div class="rating-stars">
                ${starsHTML}
            </div>
            
            <p class="testimonial-content">
                "${content}"
            </p>
            
            <div class="testimonial-author">
                <div class="author-avatar">
                    ${firstLetter}
                </div>
                <div class="author-info">
                    <h4>${name}</h4>
                    <p>${country} • ${lessons}</p>
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
        
        console.log(`📊 ${totalSlides} indicateurs créés`);
    },
    
    setupNavigation: () => {
        testimonialsManager.removeAllEventListeners();
        
        const prevBtn = document.getElementById('prevTestimonial');
        const nextBtn = document.getElementById('nextTestimonial');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                testimonialsManager.prevSlide();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                testimonialsManager.nextSlide();
            });
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                testimonialsManager.prevSlide();
            } else if (e.key === 'ArrowRight') {
                testimonialsManager.nextSlide();
            }
        });
        
        window.addEventListener('resize', () => {
            const oldSlidesPerView = testimonialsManager.slidesPerView;
            testimonialsManager.calculateSlidesPerView();
            
            if (oldSlidesPerView !== testimonialsManager.slidesPerView) {
                testimonialsManager.init();
            } else {
                testimonialsManager.updateSlider();
            }
        });
    },
    
    removeAllEventListeners: () => {
        const prevBtn = document.getElementById('prevTestimonial');
        const nextBtn = document.getElementById('nextTestimonial');
        
        if (prevBtn) {
            const newPrevBtn = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
        }
        
        if (nextBtn) {
            const newNextBtn = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
        }
        
        const indicators = document.querySelectorAll('.testimonial-indicator');
        indicators.forEach(indicator => {
            const newIndicator = indicator.cloneNode(true);
            indicator.parentNode.replaceChild(newIndicator, indicator);
        });
    },
    
    prevSlide: () => {
        const totalSlides = Math.ceil(testimonialsData.length / testimonialsManager.slidesPerView);
        
        if (testimonialsManager.currentSlide > 0) {
            testimonialsManager.currentSlide--;
            testimonialsManager.updateSlider();
        } else {
            testimonialsManager.currentSlide = totalSlides - 1;
            testimonialsManager.updateSlider();
        }
        
        console.log(`⬅️ Slide précédente: ${testimonialsManager.currentSlide + 1}/${totalSlides}`);
    },
    
    nextSlide: () => {
        const totalSlides = Math.ceil(testimonialsData.length / testimonialsManager.slidesPerView);
        
        if (testimonialsManager.currentSlide < totalSlides - 1) {
            testimonialsManager.currentSlide++;
            testimonialsManager.updateSlider();
        } else {
            testimonialsManager.currentSlide = 0;
            testimonialsManager.updateSlider();
        }
        
        console.log(`➡️ Slide suivante: ${testimonialsManager.currentSlide + 1}/${totalSlides}`);
    },
    
    goToSlide: (slideIndex) => {
        const totalSlides = Math.ceil(testimonialsData.length / testimonialsManager.slidesPerView);
        if (slideIndex >= 0 && slideIndex < totalSlides) {
            testimonialsManager.currentSlide = slideIndex;
            testimonialsManager.updateSlider();
            console.log(`🎯 Aller à la slide: ${slideIndex + 1}/${totalSlides}`);
        }
    },
    
    updateSlider: () => {
        const container = document.getElementById('testimonialsSlider');
        const indicators = document.querySelectorAll('.testimonial-indicator');
        
        if (!container) return;
        
        const cards = container.querySelectorAll('.testimonial-card');
        cards.forEach(card => {
            card.style.display = 'none';
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
        });
        
        const startIndex = testimonialsManager.currentSlide * testimonialsManager.slidesPerView;
        const endIndex = Math.min(startIndex + testimonialsManager.slidesPerView, testimonialsData.length);
        
        console.log(`🔄 Affichage des témoignages ${startIndex + 1} à ${endIndex}`);
        
        for (let i = startIndex; i < endIndex; i++) {
            if (cards[i]) {
                cards[i].style.display = 'block';
                setTimeout(() => {
                    cards[i].style.opacity = '1';
                    cards[i].style.transform = 'translateY(0)';
                    cards[i].style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                }, 100 * (i - startIndex));
            }
        }
        
        indicators.forEach((indicator, index) => {
            if (index === testimonialsManager.currentSlide) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
        
        const prevBtn = document.getElementById('prevTestimonial');
        const nextBtn = document.getElementById('nextTestimonial');
        const totalSlides = Math.ceil(testimonialsData.length / testimonialsManager.slidesPerView);
        
        if (prevBtn) {
            prevBtn.disabled = false;
            prevBtn.style.opacity = '1';
            prevBtn.style.cursor = 'pointer';
        }
        
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.style.opacity = '1';
            nextBtn.style.cursor = 'pointer';
        }
    },
    
    addTestimonialEvents: () => {
        document.querySelectorAll('.testimonial-card').forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-10px) scale(1.02)';
                this.style.transition = 'all 0.3s ease';
                this.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
                this.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
            });
        });
    }
};

// ===== NAVIGATION =====
const navigationManager = {
    init: () => {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href === '#') return;
                
                e.preventDefault();
                navigationManager.scrollToSection(href);
            });
        });
        
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
        window.addEventListener('scroll', uiManager.handleScroll);
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
        mobileManager.updateMobileLoginLinks();
        window.addEventListener('resize', mobileManager.updateMobileLoginLinks);
        mobileManager.checkMobileLayout();
    },
    
    updateMobileLoginLinks: () => {
        if (window.innerWidth <= 768) {
            const mobileLoginBtn = document.querySelector('.mobile-login-btn');
            const mobileLoginHeaderBtn = document.querySelector('.mobile-login-btn-header');
            
            if (mobileLoginHeaderBtn && !window.location.pathname.includes('login.html')) {
                const currentUrl = encodeURIComponent(window.location.href);
                mobileLoginHeaderBtn.href = `login.html?redirect=${currentUrl}`;
            }
            
            if (mobileLoginBtn && !window.location.pathname.includes('login.html')) {
                const currentUrl = encodeURIComponent(window.location.href);
                mobileLoginBtn.href = `login.html?redirect=${currentUrl}`;
            }
        }
    },
    
    checkMobileLayout: () => {
        if (window.innerWidth <= 768) {
            document.querySelectorAll('.desktop-stat').forEach(el => {
                el.style.display = 'none';
            });
            document.querySelectorAll('.mobile-stat').forEach(el => {
                el.style.display = 'inline';
            });
        } else {
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
        
        if (!window.translationManager) {
            console.warn('⚠️ TranslationManager principal non disponible');
            return;
        }
        
        console.log('✅ TranslationManager principal disponible');
        appTranslationManager.translateCourses();
        
        window.addEventListener('language:changed', () => {
            console.log('🌍 Changement de langue détecté dans l\'app');
            testimonialsManager.init();
            appTranslationManager.translateCourses();
        });
        
        console.log(`🌍 Langue actuelle: ${window.translationManager.getCurrentLanguage()}`);
    },
    
    translateCourses: () => {
        console.log('🌍 Traduction des cours dans l\'app...');
        coursesManager.reloadCourses();
    }
};

// ===== GESTION DES PRIX VIP =====
const vipPriceManager = {
    init: () => {
        console.log('👑 Initialisation du gestionnaire de prix VIP...');
        
        window.addEventListener('vip:loaded', (e) => {
            console.log('🎁 Prix VIP chargés, mise à jour de l\'interface');
            vipPriceManager.updateVIPPrices();
        });
        
        window.addEventListener('currency:changed', () => {
            if (window.authManager && window.authManager.isUserVip()) {
                console.log('💱 Devise changée, mise à jour des prix VIP');
                vipPriceManager.updateVIPPrices();
            }
        });
        
        window.addEventListener('auth:login', () => {
            console.log('🔐 Connexion détectée');
            setTimeout(() => {
                if (window.authManager && window.authManager.isUserVip()) {
                    console.log('👑 Utilisateur VIP, chargement des prix');
                    vipPriceManager.updateVIPPrices();
                }
            }, 1500);
        });
        
        window.addEventListener('auth:logout', () => {
            console.log('🔓 Déconnexion, réinitialisation des prix');
            coursesManager.updateCoursePrices();
        });
        
        console.log('✅ Gestionnaire de prix VIP initialisé');
    },
    
    updateVIPPrices: async () => {
        if (!window.authManager || !window.authManager.isUserVip()) {
            console.log('👑 Utilisateur non VIP, pas de mise à jour des prix');
            return;
        }
        
        console.log('👑 Mise à jour des prix VIP sur la page d\'accueil');
        
        const essaiBtn = document.getElementById('essaiPriceBtn');
        if (essaiBtn && window.currencyManager) {
            const priceSpan = essaiBtn.querySelector('.price-essai');
            if (priceSpan) {
                priceSpan.textContent = window.currencyManager.formatPrice(5);
                console.log('✅ Prix essai mis à jour');
            }
        }
        
        const coursesUpdated = [];
        
        for (const card of document.querySelectorAll('.course-card')) {
            const courseId = card.dataset.courseId;
            if (!courseId) continue;
            
            let courseType = '';
            switch(courseId) {
                case '1': courseType = 'conversation'; break;
                case '2': courseType = 'curriculum'; break;
                case '3': courseType = 'examen'; break;
            }
            
            if (!courseType) continue;
            
            console.log(`🔄 Traitement ${courseType}...`);
            
            const priceInfo = await window.authManager.getVipPrice(courseType, 60);
            
            if (!priceInfo) {
                console.log(`⚠️ Aucun prix VIP pour ${courseType}`);
                continue;
            }
            
            console.log(`✅ Prix VIP trouvé pour ${courseType}:`, priceInfo);
            
            const priceMain = card.querySelector('.price-main');
            if (priceMain && window.currencyManager) {
                const displayPrice = window.currencyManager.formatPrice(
                    window.currencyManager.convert(
                        priceInfo.price, 
                        priceInfo.currency, 
                        window.currencyManager.currentCurrency
                    )
                );
                
                const perHourSpan = priceMain.querySelector('.price-per-hour');
                const perHourText = getTranslation('courses.price_per_hour', '/h');
                
                if (perHourSpan) {
                    priceMain.innerHTML = `${displayPrice}<span class="price-per-hour">${perHourText}</span>`;
                } else {
                    priceMain.innerHTML = `${displayPrice}<span class="price-per-hour">${perHourText}</span>`;
                }
                console.log(`  ✅ Prix principal ${courseType}: ${displayPrice}`);
            }
            
            const priceDetailItems = card.querySelectorAll('.price-detail-item');
            
            for (const item of priceDetailItems) {
                const price30Element = item.querySelector('.price-30');
                if (price30Element) {
                    const price30Info = await window.authManager.getVipPrice(courseType, 30);
                    if (price30Info && window.currencyManager) {
                        const display30 = window.currencyManager.formatPrice(
                            window.currencyManager.convert(
                                price30Info.price,
                                price30Info.currency,
                                window.currencyManager.currentCurrency
                            )
                        );
                        price30Element.textContent = display30;
                        console.log(`  ✅ Prix 30min ${courseType}: ${display30}`);
                    }
                }
                
                const price45Element = item.querySelector('.price-45');
                if (price45Element) {
                    const price45Info = await window.authManager.getVipPrice(courseType, 45);
                    if (price45Info && window.currencyManager) {
                        const display45 = window.currencyManager.formatPrice(
                            window.currencyManager.convert(
                                price45Info.price,
                                price45Info.currency,
                                window.currencyManager.currentCurrency
                            )
                        );
                        price45Element.textContent = display45;
                        console.log(`  ✅ Prix 45min ${courseType}: ${display45}`);
                    }
                }
                
                const priceForfaitElement = item.querySelector('.price-forfait');
                if (priceForfaitElement && priceInfo) {
                    const forfaitPrice = priceInfo.price * 10 * 0.95;
                    if (window.currencyManager) {
                        const displayForfait = window.currencyManager.formatPrice(
                            window.currencyManager.convert(
                                forfaitPrice,
                                priceInfo.currency,
                                window.currencyManager.currentCurrency
                            )
                        );
                        priceForfaitElement.textContent = displayForfait;
                        console.log(`  ✅ Prix forfait ${courseType}: ${displayForfait}`);
                    }
                }
            }
            
            coursesUpdated.push(courseType);
        }
        
        console.log('✅ Prix VIP mis à jour pour:', coursesUpdated);
    }
};

// ===== GESTION DES BOUTONS DE LANGUE =====
const initLanguageButtons = () => {
    console.log('🔧 Initialisation des boutons de langue...');
    
    const toggleLanguage = () => {
        if (window.translationManager && typeof window.translationManager.toggleLanguage === 'function') {
            window.translationManager.toggleLanguage();
        } else {
            const currentLang = document.documentElement.lang || 'fr';
            const newLang = currentLang === 'fr' ? 'en' : 'fr';
            
            document.documentElement.lang = newLang;
            
            document.querySelectorAll('.language-switcher span:last-child, .mobile-language span:last-child').forEach(el => {
                el.textContent = newLang === 'fr' ? 'EN' : 'FR';
            });
            
            localStorage.setItem('language', newLang);
            
            window.dispatchEvent(new CustomEvent('language:changed', { 
                detail: { language: newLang } 
            }));
            
            console.log(`🌍 Langue basculée vers: ${newLang} (fallback)`);
        }
    };
    
    const desktopSwitcher = document.getElementById('languageSwitcherDesktop');
    if (desktopSwitcher) {
        const newDesktopSwitcher = desktopSwitcher.cloneNode(true);
        desktopSwitcher.parentNode.replaceChild(newDesktopSwitcher, desktopSwitcher);
        
        newDesktopSwitcher.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🌍 Clic sur bouton de langue desktop');
            toggleLanguage();
        });
    }
    
    const mobileSwitcher = document.getElementById('languageSwitcherMobile');
    if (mobileSwitcher) {
        const newMobileSwitcher = mobileSwitcher.cloneNode(true);
        mobileSwitcher.parentNode.replaceChild(newMobileSwitcher, mobileSwitcher);
        
        newMobileSwitcher.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🌍 Clic sur bouton de langue mobile');
            toggleLanguage();
            
            const mobileMenu = document.getElementById('mobileMenu');
            if (mobileMenu && mobileMenu.classList.contains('active')) {
                mobileMenu.classList.remove('active');
            }
        });
    }
    
    console.log('✅ Boutons de langue initialisés');
};

// ===== INITIALISATION PRINCIPALE =====
const app = {
    init: () => {
        console.log('🚀 Initialisation de l\'application...');
        
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
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', app.setup);
        } else {
            app.setup();
        }
    },
    
    setup: () => {
        console.log('⚙️ Configuration des modules...');
        
        document.body.style.paddingTop = '80px';
        
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
                
                console.log('8. Initialisation des prix VIP...');
                vipPriceManager.init();
                
                console.log('✅ Application prête !');
            } else {
                console.log('⏳ En attente de translationManager...');
                setTimeout(waitForTranslationManager, 100);
            }
        };
        
        waitForTranslationManager();
        
        window.addEventListener('resize', () => {
            testimonialsManager.calculateSlidesPerView();
            testimonialsManager.updateSlider();
            mobileManager.checkMobileLayout();
        });
        
        window.addEventListener('currency:ready', () => {
            coursesManager.updateCoursePrices();
        });
        
        window.addEventListener('currency:changed', () => {
            coursesManager.updateCoursePrices();
        });
        
        setTimeout(initLanguageButtons, 300);
    }
};

// ===== INITIALISATION FINALE =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOMContentLoaded - Initialisation...');
        
        app.init();
        
        setTimeout(() => {
            const coursesContainer = document.getElementById('coursesContainer');
            const testimonialsContainer = document.getElementById('testimonialsSlider');
            
            console.log('🔍 Vérification des conteneurs:');
            console.log(`- Conteneur cours: ${coursesContainer ? 'TROUVÉ' : 'NON TROUVÉ'}`);
            console.log(`- Conteneur témoignages: ${testimonialsContainer ? 'TROUVÉ' : 'NON TROUVÉ'}`);
            
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
    console.log('📄 DOM déjà chargé - Initialisation...');
    app.init();
}

// ===== FONCTIONS DE DEBUG =====
window.debugVIP = async function() {
    console.clear();
    console.group('🛠️ DEBUG VIP COMPLET');
    
    console.log('1. ✅ authManager:', {
        exists: !!window.authManager,
        user: window.authManager?.user,
        isVip: window.authManager?.isUserVip(),
        profile: window.authManager?.user?.profile
    });
    
    console.log('2. 💰 currencyManager:', {
        exists: !!window.currencyManager,
        currentCurrency: window.currencyManager?.currentCurrency,
        rates: window.currencyManager?.rates
    });
    
    const courses = [
        { id: 1, type: 'conversation' },
        { id: 2, type: 'curriculum' },
        { id: 3, type: 'examen' }
    ];
    
    for (const course of courses) {
        console.group(`3. 🧪 Test ${course.type}`);
        
        const priceInfo = await window.authManager.getVipPrice(course.type, 60);
        console.log('Résultat:', priceInfo);
        
        if (priceInfo) {
            const converted = window.currencyManager.convert(
                priceInfo.price,
                priceInfo.currency,
                window.currencyManager.currentCurrency
            );
            console.log(`Conversion: ${priceInfo.price}${priceInfo.currency} → ${converted}${window.currencyManager.currentCurrency}`);
            console.log('isNaN?', isNaN(converted));
        }
        
        console.groupEnd();
    }
    
    console.log('4. 📦 Données utilisateur dans localStorage:');
    const storedUser = localStorage.getItem('yoteacher_user');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            console.log('Utilisateur:', {
                id: user.id,
                email: user.email,
                is_vip: user.profile?.is_vip,
                vipPrices: user.vipPrices
            });
        } catch (e) {
            console.error('Erreur parsing JSON:', e);
        }
    }
    
    console.log('5. 👑 Prix VIP dans authManager.user:');
    console.log(window.authManager.user?.vipPrices);
    
    console.groupEnd();
    
    console.log('🔄 Lancement de updateVIPPrices...');
    await vipPriceManager.updateVIPPrices();
};

window.testVipPrice = async function(courseType = 'conversation', duration = 60) {
    console.group(`🧪 Test rapide prix VIP pour ${courseType} ${duration}min`);
    
    if (!window.authManager) {
        console.error('❌ authManager non disponible');
        console.groupEnd();
        return;
    }
    
    if (!window.authManager.user) {
        console.error('❌ Aucun utilisateur connecté');
        console.groupEnd();
        return;
    }
    
    console.log('👤 Utilisateur:', window.authManager.user.email);
    console.log('👑 Est VIP?', window.authManager.isUserVip());
    
    const priceInfo = await window.authManager.getVipPrice(courseType, duration);
    console.log('💰 Prix VIP:', priceInfo);
    
    if (priceInfo && window.currencyManager) {
        const converted = window.currencyManager.convert(
            priceInfo.price,
            priceInfo.currency,
            window.currencyManager.currentCurrency
        );
        console.log(`💱 Conversion: ${priceInfo.price} ${priceInfo.currency} → ${converted} ${window.currencyManager.currentCurrency}`);
        console.log('📊 Formaté:', window.currencyManager.formatPrice(converted));
    }
    
    console.groupEnd();
};

console.log('🔧 Fonctions de debug disponibles:');
console.log('- debugVIP(): Analyse complète du système VIP');
console.log('- testVipPrice("conversation", 60): Test un prix spécifique');
console.log('- window.authManager.getVipPrice(type, durée): Récupère un prix VIP');

window.coursesManager = coursesManager;
window.testimonialsManager = testimonialsManager;
window.appTranslationManager = appTranslationManager;
window.vipPriceManager = vipPriceManager;

console.log('📦 Script.js chargé avec succès');