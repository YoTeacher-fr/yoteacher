// SCRIPT JAVASCRIPT POUR BOOKING.HTML - CORRIGÉ AVEC GESTION CRÉDITS PAR DURÉE
document.addEventListener('DOMContentLoaded', function() {
    let selectedDate = null;
    let selectedTime = null;
    let selectedSlot = null;
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let vipPriceInfo = null;
    
    // Variable pour suivre si c'est VIP
    let isVipUser = false;

    // Éléments DOM
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    const errorText = document.getElementById('errorText');
    const successText = document.getElementById('successText');
    const calendarDays = document.getElementById('calendarDays');
    const timeSlots = document.getElementById('timeSlots');
    const currentMonthElement = document.getElementById('currentMonth');
    const bookingForm = document.getElementById('bookingForm');
    const submitButton = document.getElementById('submitBooking');
    const durationGroup = document.getElementById('durationGroup');
    const durationInput = document.getElementById('duration');
    const basePriceInput = document.getElementById('basePriceEUR');
    const loginRequired = document.getElementById('loginRequired');
    const courseTypeName = document.getElementById('courseTypeName');
    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signupLink');
    const selectedLocationInput = document.getElementById('selectedLocation');
    const coursesCountGroup = document.getElementById('coursesCountGroup');
    const coursesCountInput = document.getElementById('coursesCount');
    const discountPercentInput = document.getElementById('discountPercent');

    // Stocker le type de cours avant redirection
    let preLoginCourseType = null;

    // Fonction pour mettre à jour le texte du bouton
    async function updateSubmitButtonText() {
        const user = window.authManager?.getCurrentUser();
        const courseType = document.getElementById('courseType').value;
        const coursesCount = parseInt(coursesCountInput.value) || 1;
        const submitBtn = document.getElementById('submitBooking');
        const duration = parseInt(durationInput.value) || 60;
        
        if (!submitBtn || !user || courseType === 'essai' || coursesCount > 1) {
            // Réinitialiser à l'état normal
            submitBtn.innerHTML = '<i class="fas fa-calendar-check"></i> <span data-i18n="booking.book_and_pay">Réserver et payer</span>';
            submitBtn.style.background = 'linear-gradient(135deg, #3c84f6, #1e88e5)';
            return;
        }
        
        try {
            if (window.packagesManager) {
                const hasCredits = await window.packagesManager.hasCreditForDuration(user.id, courseType, duration);
                console.log(`💳 Crédits disponibles pour ${courseType} ${duration}min:`, hasCredits);
                
                if (hasCredits) {
                    submitBtn.innerHTML = `<i class="fas fa-ticket-alt"></i> Réserver avec un crédit (${duration}min)`;
                    submitBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
                    console.log(`✅ Bouton changé: "Réserver avec un crédit (${duration}min)"`);
                } else {
                    submitBtn.innerHTML = '<i class="fas fa-calendar-check"></i> <span data-i18n="booking.book_and_pay">Réserver et payer</span>';
                    submitBtn.style.background = 'linear-gradient(135deg, #3c84f6, #1e88e5)';
                    console.log(`❌ Pas de crédits pour ${duration}min, bouton normal`);
                }
            }
        } catch (error) {
            console.warn('Erreur vérification crédits:', error);
        }
    }

    // FORCER L'INITIALISATION DE CURRENCYMANAGER SI NÉCESSAIRE
    function ensureCurrencyManager() {
        return new Promise(async (resolve, reject) => {
            console.log('💰 Vérification de CurrencyManager...');
            
            if (!window.currencyManager) {
                console.log('💱 CurrencyManager non trouvé, création...');
                try {
                    if (typeof CurrencyManager === 'undefined') {
                        console.error('❌ Classe CurrencyManager non définie');
                        reject(new Error('CurrencyManager non disponible'));
                        return;
                    }
                    
                    window.currencyManager = new CurrencyManager();
                    await window.currencyManager.init();
                    console.log('✅ CurrencyManager créé avec succès');
                    resolve(window.currencyManager);
                } catch (error) {
                    console.error('❌ Erreur création CurrencyManager:', error);
                    reject(error);
                }
            } else if (!window.currencyManager.currentCurrency || 
                      !window.currencyManager.exchangeRates || 
                      Object.keys(window.currencyManager.exchangeRates).length === 0) {
                console.log('💱 CurrencyManager incomplet, réinitialisation...');
                try {
                    await window.currencyManager.init();
                    resolve(window.currencyManager);
                } catch (error) {
                    console.error('❌ Erreur réinitialisation CurrencyManager:', error);
                    reject(error);
                }
            } else {
                console.log('✅ CurrencyManager déjà disponible');
                resolve(window.currencyManager);
            }
        });
    }

    // DEBUG GLOBAL
    window.debugCurrencyManager = function() {
        console.group('🔧 Debug CurrencyManager - Booking');
        console.log('Disponible:', !!window.currencyManager);
        console.log('Devise actuelle:', window.currencyManager?.currentCurrency);
        console.log('Taux chargés:', window.currencyManager?.exchangeRates);
        console.log('Taille des taux:', Object.keys(window.currencyManager?.exchangeRates || {}).length);
        
        if (window.currencyManager) {
            console.log('Test conversion 10 EUR → USD:', window.currencyManager.convert(10, 'EUR', 'USD'));
            console.log('Test conversion 10 EUR → devise courante:', window.currencyManager.formatPrice(10));
        }
        
        console.groupEnd();
    };

    // Initialiser la page
    initializePage();

    // Navigation du calendrier
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        initCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        initCalendar();
    });

    // Changement de type de cours
    document.getElementById('courseType').addEventListener('change', function() {
        const courseType = this.value;
        preLoginCourseType = courseType;
        updateUIForCourseType(courseType, true);
        if (selectedDate) {
            loadAvailableSlots(selectedDate);
        }
        updateSummary();
        updateSubmitButtonText();
    });

    // Gestion des boutons de durée
    document.querySelectorAll('.duration-option').forEach(button => {
        if (button.hasAttribute('data-duration')) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Retirer la sélection précédente
                document.querySelectorAll('.duration-option[data-duration]').forEach(btn => {
                    btn.classList.remove('selected');
                });
                
                // Ajouter la nouvelle sélection
                this.classList.add('selected');
                
                // Mettre à jour la valeur
                const duration = this.getAttribute('data-duration');
                durationInput.value = duration;
                
                // Mettre à jour le prix de base
                const basePrice = this.getAttribute('data-price-eur') || '20';
                basePriceInput.value = basePrice;
                
                // Recharger les créneaux si une date est sélectionnée
                if (selectedDate) {
                    loadAvailableSlots(selectedDate);
                }
                
                updateSummary();
                updateSubmitButtonText(); // ← AJOUT IMPORTANT
            });
        }
    });

    // Gestion des boutons de nombre de cours
    document.querySelectorAll('.courses-count-option').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Retirer la sélection précédente
            document.querySelectorAll('.courses-count-option').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // Ajouter la nouvelle sélection
            this.classList.add('selected');
            
            // Mettre à jour les valeurs
            const count = this.getAttribute('data-count');
            const discount = this.getAttribute('data-discount');
            coursesCountInput.value = count;
            discountPercentInput.value = discount;
            
            updateSummary();
            updateSubmitButtonText();
        });
    });

    // Gestion des boutons de moyen de communication
    document.querySelectorAll('.location-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Retirer la sélection précédente
            document.querySelectorAll('.location-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // Ajouter la nouvelle sélection
            this.classList.add('selected');
            
            // Mettre à jour la valeur
            const location = this.getAttribute('data-location');
            selectedLocationInput.value = location;
            
            updateSummary();
        });
    });

    // Soumission du formulaire
    bookingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        console.log('💰 Début de la préparation du paiement/credit');
        console.log('📊 Détails:', {
            selectedDate,
            selectedTime,
            courseType: document.getElementById('courseType').value,
            coursesCount: coursesCountInput.value,
            duration: durationInput.value
        });
        
        // FORCER l'initialisation de currencyManager
        try {
            await ensureCurrencyManager();
            console.log('✅ CurrencyManager prêt');
        } catch (error) {
            console.error('❌ Impossible d\'initialiser CurrencyManager:', error);
            showError('Système de devise temporairement indisponible. Veuillez réessayer dans quelques instants.');
            return;
        }
        
        if (!selectedDate || !selectedTime) {
            showError('Veuillez sélectionner une date et une heure');
            return;
        }

        const courseType = document.getElementById('courseType').value;
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const notes = document.getElementById('notes').value;
        const location = selectedLocationInput.value;
        const coursesCount = parseInt(coursesCountInput.value);
        const discountPercent = parseFloat(discountPercentInput.value);
        const duration = parseInt(durationInput.value) || 60;

        // Validation
        if (!courseType || !name || !email) {
            showError('Veuillez remplir tous les champs obligatoires');
            return;
        }

        // Vérifier si l'utilisateur doit être connecté
        if ((courseType === 'conversation' || courseType === 'curriculum' || courseType === 'examen') && !window.authManager?.getCurrentUser()) {
            showError('Veuillez vous connecter pour réserver ce type de cours');
            return;
        }

        hideMessages();
        submitButton.disabled = true;
        
        // Changer le texte du bouton selon le type
        const user = window.authManager?.getCurrentUser();
        console.log('👤 Utilisateur:', user?.email);
        
        // Vérifier explicitement les crédits
        if (user && coursesCount === 1 && courseType !== 'essai') {
            try {
                if (window.packagesManager) {
                    const hasCredits = await window.packagesManager.hasCreditForDuration(user.id, courseType, duration);
                    
                    if (hasCredits) {
                        console.log(`✅ Crédits disponibles pour ${courseType} ${duration}min`);
                        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Réservation avec crédit...';
                    } else {
                        console.log(`❌ Pas de crédits disponibles pour ${courseType} ${duration}min`);
                        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Préparation du paiement...';
                    }
                }
            } catch (error) {
                console.warn('Erreur vérification crédits:', error);
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Préparation du paiement...';
            }
        } else {
            console.log('❌ Conditions crédit non remplies:', {
                user: !!user,
                coursesCount,
                courseType,
                isEssai: courseType === 'essai',
                duration: duration
            });
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Préparation du paiement...';
        }

        try {
            // Utiliser les données du créneau sélectionné
            if (!selectedSlot) {
                throw new Error('Aucun créneau sélectionné');
            }

            // Préparer les données de réservation
            const bookingData = {
                startTime: selectedSlot.start,
                endTime: selectedSlot.end,
                courseType: courseType,
                duration: duration,
                location: location,
                name: name,
                email: email,
                notes: notes,
                packageQuantity: coursesCount,
                discountPercent: discountPercent
            };

            console.log('📤 Appel à bookingManager.createBooking avec:', bookingData);
            
            // Appeler la méthode qui prépare les données
            const result = await window.bookingManager.createBooking(bookingData);
            
            console.log('📥 Résultat de createBooking:', result);
            
            if (result.success) {
                showSuccess('Redirection...');
                
                // Redirection vers la page appropriée
                setTimeout(() => {
                    window.location.href = result.redirectTo;
                }, 1000);
            } else {
                throw new Error(result.error || 'Erreur inconnue');
            }

        } catch (error) {
            console.error('❌ Erreur lors de la préparation :', error);
            showError('Erreur lors de la préparation : ' + error.message);
            submitButton.disabled = false;
            updateSubmitButtonText();
        }
    });

    // Écouter les événements d'authentification
    window.addEventListener('auth:login', function() {
        console.log('Utilisateur connecté, mise à jour de l\'interface');
        updateUserInterface();
        setTimeout(updateSubmitButtonText, 500);
    });

    window.addEventListener('auth:logout', function() {
        console.log('Utilisateur déconnecté, mise à jour de l\'interface');
        updateUserInterface();
        updateSubmitButtonText();
    });
    
    // Écouter les changements de devise
    window.addEventListener('currency:ready', function() {
        console.log('💱 CurrencyManager prêt, mise à jour du résumé');
        updateSummary();
    });
    
    window.addEventListener('currency:changed', function() {
        console.log('💱 Devise changée, mise à jour du résumé');
        updateSummary();
    });
    
    // Écouter les changements de langue
    window.addEventListener('language:changed', function() {
        initCalendar();
        updateSummary();
        updateSubmitButtonText();
    });
    
    // Écouter les événements VIP
    window.addEventListener('vip:loaded', function() {
        console.log('🎁 Prix VIP chargés dans booking.html');
        isVipUser = window.authManager?.isUserVip();
        updateUserInterface();
        updateSummary();
    });

    // Fonction pour initialiser le sélecteur de devise mobile
    function initMobileCurrencySelector() {
        const mobileSelector = document.getElementById('currencySelectorMobile');
        if (!mobileSelector || !window.currencyManager) return;
        
        mobileSelector.innerHTML = '';
        
        window.currencyManager.supportedCurrencies.forEach(currency => {
            const option = document.createElement('option');
            option.value = currency;
            option.textContent = `${window.currencyManager.currencySymbols[currency] || currency} ${currency}`;
            
            if (currency === window.currencyManager.currentCurrency) {
                option.selected = true;
            }
            
            mobileSelector.appendChild(option);
        });
        
        mobileSelector.addEventListener('change', (e) => {
            const newCurrency = e.target.value;
            if (window.currencyManager.setCurrency(newCurrency)) {
                const mobileMenu = document.getElementById('mobileMenu');
                if (mobileMenu) {
                    mobileMenu.classList.remove('active');
                }
            }
        });
    }

    // Fonctions
    async function initializePage() {
        console.log('🚀 Initialisation de la page booking...');
        
        // FORCER l'initialisation de currencyManager d'abord
        try {
            await ensureCurrencyManager();
            console.log('✅ CurrencyManager initialisé avec succès');
            
            // Initialiser les sélecteurs de devise
            if (window.currencyManager.initCurrencySelectors) {
                window.currencyManager.initCurrencySelectors();
            }
        } catch (error) {
            console.warn('⚠️ CurrencyManager non disponible, continuation en mode EUR');
        }
        
        // Récupérer le type de cours depuis l'URL
        const urlParams = new URLSearchParams(window.location.search);
        let courseTypeParam = urlParams.get('type');
        
        // Si pas de paramètre "type", vérifier dans localStorage
        if (!courseTypeParam || !['essai', 'conversation', 'curriculum', 'examen'].includes(courseTypeParam)) {
            const storedCourseType = localStorage.getItem('preLoginCourseType');
            
            if (storedCourseType && ['essai', 'conversation', 'curriculum', 'examen'].includes(storedCourseType)) {
                courseTypeParam = storedCourseType;
                localStorage.removeItem('preLoginCourseType');
            } else {
                courseTypeParam = 'essai';
            }
        }
        
        // Forcer la sélection dans le dropdown
        document.getElementById('courseType').value = courseTypeParam;
        preLoginCourseType = courseTypeParam;
        
        // Stocker aussi dans l'URL si ce n'est pas déjà fait
        if (!urlParams.has('type')) {
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('type', courseTypeParam);
            window.history.replaceState({}, '', newUrl);
        }
        
        // Pré-sélectionner 60min, 1 cours, Google Meet
        preselectDefaults();
        
        // Initialiser le calendrier
        initCalendar();
        
        // Charger les créneaux pour aujourd'hui par défaut
        const today = new Date().toISOString().split('T')[0];
        selectToday(today);
        
        // Mettre à jour l'interface
        updateUIForCourseType(document.getElementById('courseType').value, false);
        
        // Mettre à jour l'interface utilisateur
        updateUserInterface();
        
        // Initialiser le sélecteur de devise mobile
        if (window.currencyManager) {
            initMobileCurrencySelector();
        } else {
            // Attendre que currencyManager soit prêt
            window.addEventListener('currency:ready', function() {
                initMobileCurrencySelector();
            });
        }
        
        // Gestion du menu mobile
        initMobileMenu();
        
        // Mettre à jour le bouton
        setTimeout(updateSubmitButtonText, 1000);
    }
    
    function initMobileMenu() {
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const closeMenuBtn = document.getElementById('closeMenuBtn');
        const mobileMenu = document.getElementById('mobileMenu');
        
        if (hamburgerBtn && mobileMenu) {
            hamburgerBtn.addEventListener('click', () => {
                mobileMenu.classList.add('active');
            });
        }
        
        if (closeMenuBtn && mobileMenu) {
            closeMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.remove('active');
            });
        }
        
        if (mobileMenu) {
            mobileMenu.addEventListener('click', (e) => {
                if (e.target === mobileMenu) {
                    mobileMenu.classList.remove('active');
                }
            });
        }
        
        const mobileLanguageSwitcher = document.getElementById('languageSwitcherMobile');
        if (mobileLanguageSwitcher) {
            mobileLanguageSwitcher.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.translationManager) {
                    window.translationManager.toggleLanguage();
                }
                
                if (mobileMenu) {
                    mobileMenu.classList.remove('active');
                }
            });
        }
        
        const desktopLanguageSwitcher = document.getElementById('languageSwitcherDesktop');
        if (desktopLanguageSwitcher) {
            desktopLanguageSwitcher.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.translationManager) {
                    window.translationManager.toggleLanguage();
                }
            });
        }
    }
    
    function preselectDefaults() {
        // Pré-sélectionner 60 min
        const duration60Btn = document.querySelector('.duration-option[data-duration="60"]');
        if (duration60Btn) {
            document.querySelectorAll('.duration-option[data-duration]').forEach(btn => {
                btn.classList.remove('selected');
            });
            duration60Btn.classList.add('selected');
            durationInput.value = '60';
            basePriceInput.value = duration60Btn.getAttribute('data-price-eur') || '20';
        }
        
        // Pré-sélectionner 1 cours
        const courses1Btn = document.querySelector('.courses-count-option[data-count="1"]');
        if (courses1Btn) {
            document.querySelectorAll('.courses-count-option').forEach(btn => {
                btn.classList.remove('selected');
            });
            courses1Btn.classList.add('selected');
            coursesCountInput.value = '1';
            discountPercentInput.value = courses1Btn.getAttribute('data-discount') || '0';
        }
        
        // Pré-sélectionner Google Meet
        const meetBtn = document.querySelector('.location-btn[data-location*="google"]');
        if (meetBtn) {
            document.querySelectorAll('.location-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            meetBtn.classList.add('selected');
            selectedLocationInput.value = meetBtn.getAttribute('data-location');
        }
    }

    function initCalendar() {
        const isFrench = !window.translationManager || window.translationManager.getCurrentLanguage() === 'fr';
        
        const monthNamesFr = [
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        
        const monthNamesEn = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        const monthNames = isFrench ? monthNamesFr : monthNamesEn;
        currentMonthElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;

        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        const dayHeadersFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const dayHeadersEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sam'];
        const dayHeaders = isFrench ? dayHeadersFr : dayHeadersEn;
        
        calendarDays.innerHTML = '';

        dayHeaders.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day-header';
            dayElement.textContent = day;
            calendarDays.appendChild(dayElement);
        });

        for (let i = 0; i < startingDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day disabled';
            calendarDays.appendChild(emptyDay);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentYear, currentMonth, day);
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            dayElement.setAttribute('data-date', 
                `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            );
            
            if (date.getDate() === today.getDate() && 
                date.getMonth() === today.getMonth() && 
                date.getFullYear() === today.getFullYear()) {
                dayElement.classList.add('today');
            }

            if (date < today) {
                dayElement.classList.add('disabled');
            } else {
                dayElement.addEventListener('click', () => selectDate(
                    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                ));
            }

            calendarDays.appendChild(dayElement);
        }
    }

    function selectToday(today) {
        const todayElement = document.querySelector(`.calendar-day[data-date="${today}"]`);
        if (todayElement && !todayElement.classList.contains('disabled')) {
            selectDate(today);
        } else {
            const firstAvailable = document.querySelector('.calendar-day:not(.disabled)');
            if (firstAvailable) {
                selectDate(firstAvailable.getAttribute('data-date'));
            }
        }
    }

    function updateUIForCourseType(courseType, forceUpdate = false) {
        console.log('updateUIForCourseType appelé avec:', courseType, 'forceUpdate:', forceUpdate);
        
        preLoginCourseType = courseType;
        
        const user = window.authManager?.getCurrentUser();
        const isLoggedIn = !!user;
        
        console.log('Utilisateur connecté:', isLoggedIn, 'User:', user);
        
        if (courseType && courseType !== 'essai') {
            const redirectUrl = `booking.html?type=${courseType}`;
            loginLink.href = `login.html?redirect=${encodeURIComponent(redirectUrl)}`;
            signupLink.href = `signup.html?redirect=${encodeURIComponent(redirectUrl)}`;
            localStorage.setItem('preLoginCourseType', courseType);
        }
        
        if (courseType === 'essai') {
            durationGroup.classList.remove('visible');
            coursesCountGroup.style.display = 'none';
            loginRequired.style.display = 'none';
        } else if (courseType === 'conversation' || courseType === 'curriculum' || courseType === 'examen') {
            if (isLoggedIn) {
                durationGroup.classList.add('visible');
                coursesCountGroup.style.display = 'block';
                loginRequired.style.display = 'none';
                console.log('Sélecteur de durée affiché pour', courseType);
            } else {
                durationGroup.classList.remove('visible');
                coursesCountGroup.style.display = 'none';
                loginRequired.style.display = 'block';
                // Mettre à jour le nom du type de cours dans le message
                if (window.translationManager) {
                    if (courseType === 'conversation') courseTypeName.textContent = window.translationManager.getTranslation('courses.conversation');
                    else if (courseType === 'curriculum') courseTypeName.textContent = window.translationManager.getTranslation('courses.curriculum');
                    else if (courseType === 'examen') courseTypeName.textContent = window.translationManager.getTranslation('courses.exam');
                } else {
                    if (courseType === 'conversation') courseTypeName.textContent = 'Conversation';
                    else if (courseType === 'curriculum') courseTypeName.textContent = 'Curriculum complet';
                    else if (courseType === 'examen') courseTypeName.textContent = 'Préparation d\'examen';
                }
                console.log('Message connexion affiché pour', courseType);
            }
        } else {
            durationGroup.classList.remove('visible');
            coursesCountGroup.style.display = 'none';
            loginRequired.style.display = 'none';
        }
        
        if (isLoggedIn && user) {
            document.getElementById('name').value = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
            document.getElementById('email').value = user.email || '';
        }
        
        if (forceUpdate && selectedDate) {
            loadAvailableSlots(selectedDate);
        }
        
        updateSummary();
    }

    async function loadAvailableSlots(date = null) {
        try {
            const loadingText = window.translationManager ? 
                window.translationManager.getTranslation('booking.loading_slots') : 
                'Chargement des créneaux...';
            
            timeSlots.innerHTML = `<div class="loading-slots"><i class="fas fa-spinner fa-spin"></i> ${loadingText}</div>`;
            
            const courseType = document.getElementById('courseType').value || 'essai';
            
            let duration = null;
            if (courseType !== 'essai' && durationGroup.classList.contains('visible')) {
                duration = parseInt(durationInput.value) || 60;
            }
            
            const slots = await window.bookingManager.getAvailableSlots(courseType, date, duration);
            
            timeSlots.innerHTML = '';
            
            if (slots.length === 0) {
                const noSlotsText = window.translationManager ?
                    window.translationManager.getTranslation('booking.no_slots') :
                    'Aucun créneau disponible pour cette date.';
                timeSlots.innerHTML = `<p class="no-slots">${noSlotsText}</p>`;
                return;
            }

            let hasFutureSlots = false;
            
            slots.forEach(slot => {
                const slotDate = new Date(slot.start);
                const now = new Date();
                
                if (slotDate > now) {
                    hasFutureSlots = true;
                    const slotElement = document.createElement('div');
                    slotElement.className = 'time-slot';
                    
                    const isFrench = !window.translationManager || window.translationManager.getCurrentLanguage() === 'fr';
                    const timeOptions = { hour: '2-digit', minute: '2-digit' };
                    
                    slotElement.innerHTML = `
                        <div class="time-slot-time">
                            <i class="far fa-clock"></i>
                            ${slotDate.toLocaleTimeString(isFrench ? 'fr-FR' : 'en-US', timeOptions)}
                        </div>
                        <div class="time-slot-duration">
                            ${window.bookingManager.formatTime(slot.start)} - ${slot.duration}
                        </div>
                    `;
                    
                    slotElement.addEventListener('click', () => selectTimeSlot(slot, slotElement));
                    timeSlots.appendChild(slotElement);
                }
            });

            if (!hasFutureSlots) {
                const noFutureSlotsText = window.translationManager ?
                    window.translationManager.getTranslation('booking.no_future_slots') :
                    'Tous les créneaux sont complets pour aujourd\'hui.';
                timeSlots.innerHTML = `<p class="no-slots">${noFutureSlotsText}</p>`;
            }

        } catch (error) {
            console.error('Erreur chargement créneaux:', error);
            
            const errorTitle = window.translationManager ?
                window.translationManager.getTranslation('booking.error_loading') :
                'Erreur lors du chargement des créneaux';
            
            const retryText = window.translationManager ?
                window.translationManager.getTranslation('booking.retry') :
                'Réessayer';
            
            timeSlots.innerHTML = `
                <div class="error-slots">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorTitle}</p>
                    <p class="error-details">${error.message || 'Veuillez réessayer'}</p>
                    <button onclick="loadAvailableSlots('${date}')" class="retry-btn">
                        <i class="fas fa-redo"></i> ${retryText}
                    </button>
                </div>
            `;
        }
    }

    function selectDate(date) {
        selectedDate = date;
        
        document.querySelectorAll('.calendar-day').forEach(dayEl => {
            dayEl.classList.remove('selected');
        });
        
        const selectedDayElement = document.querySelector(`.calendar-day[data-date="${date}"]`);
        if (selectedDayElement) {
            selectedDayElement.classList.add('selected');
        }
        
        loadAvailableSlots(selectedDate);
        updateSummary();
    }

    function selectTimeSlot(slot, element) {
        document.querySelectorAll('.time-slot').forEach(slotEl => {
            slotEl.classList.remove('selected');
        });

        element.classList.add('selected');
        
        selectedSlot = slot;
        
        const isFrench = !window.translationManager || window.translationManager.getCurrentLanguage() === 'fr';
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        
        selectedTime = new Date(slot.start).toLocaleTimeString(isFrench ? 'fr-FR' : 'en-US', timeOptions);
        
        updateSummary();
    }

    async function updateSummary() {
        console.log('📋 Mise à jour du récapitulatif...');
        
        // VÉRIFIER QUE CURRENCYMANAGER EST DISPONIBLE
        if (!window.currencyManager || !window.currencyManager.currentCurrency) {
            console.warn('⚠️ CurrencyManager non disponible, tentative d\'initialisation...');
            try {
                await ensureCurrencyManager();
                console.log('✅ CurrencyManager initialisé pour updateSummary');
            } catch (error) {
                console.error('❌ Impossible d\'initialiser CurrencyManager:', error);
                // Fallback: afficher les prix en EUR
                showDefaultPricesInEUR();
                return;
            }
        }
        
        const courseType = document.getElementById('courseType').value;
        const user = window.authManager?.getCurrentUser();
        let courseName = '-';
        let price = '-';
        let duration = '-';
        let platform = 'Google Meet';
        const coursesCount = parseInt(coursesCountInput.value);
        const discountPercent = parseFloat(discountPercentInput.value);
        
        isVipUser = window.authManager?.isUserVip();
        console.log(`💰 [updateSummary] Statut VIP: ${isVipUser}, Type: ${courseType}`);
        
        // Déterminer la plateforme
        const locationValue = selectedLocationInput.value;
        if (locationValue.includes('zoom')) platform = window.translationManager ? window.translationManager.getTranslation('booking.zoom') : 'Zoom';
        else if (locationValue.includes('google')) platform = window.translationManager ? window.translationManager.getTranslation('booking.meet') : 'Google Meet';
        else if (locationValue.includes('teams')) platform = window.translationManager ? window.translationManager.getTranslation('booking.teams') : 'Microsoft Teams';

        // COURS D'ESSAI
        if (courseType === 'essai') {
            console.log('🎫 Cours d\'essai détecté');
            courseName = window.translationManager ? window.translationManager.getTranslation('courses.trial') : 'Cours d\'essai';
            duration = '15 min';
            
            let unitPriceEUR = 5;
            let totalPriceEUR = unitPriceEUR;
            
            if (window.currencyManager && window.currencyManager.currentCurrency) {
                price = window.currencyManager.formatPrice(totalPriceEUR);
            } else {
                price = totalPriceEUR + '€';
            }
            
            console.log(`✅ Prix essai: ${price}`);
        } 
        // COURS PAYANTS
        else if (courseType === 'conversation' || courseType === 'curriculum' || courseType === 'examen') {
            if (courseType === 'conversation') {
                courseName = window.translationManager ? window.translationManager.getTranslation('courses.conversation') : 'Conversation';
            } else if (courseType === 'curriculum') {
                courseName = window.translationManager ? window.translationManager.getTranslation('courses.curriculum') : 'Curriculum complet';
            } else if (courseType === 'examen') {
                courseName = window.translationManager ? window.translationManager.getTranslation('courses.exam') : 'Préparation d\'examen';
            }
            
            if (user && durationGroup.classList.contains('visible')) {
                const selectedDuration = selectedSlot ? selectedSlot.durationInMinutes : (parseInt(durationInput.value) || 60);
                duration = selectedDuration + ' min';
                
                let unitPriceEUR = 0;
                
                console.log(`📊 Calcul prix pour ${courseType} ${selectedDuration}min`);
                
                // PRIX VIP
                if (isVipUser) {
                    console.log(`💎 Utilisateur VIP, recherche prix personnalisé...`);
                    
                    try {
                        vipPriceInfo = await window.authManager.getVipPrice(courseType, selectedDuration);
                        
                        if (vipPriceInfo && typeof vipPriceInfo.price === 'number' && !isNaN(vipPriceInfo.price)) {
                            console.log(`✅ Prix VIP trouvé:`, vipPriceInfo);
                            
                            const vipCurrency = vipPriceInfo.currency || 'EUR';
                            let currentCurrency = window.currencyManager.currentCurrency || 'EUR';
                            
                            // SI MÊME DEVISE: PAS DE CONVERSION, retour direct
                            if (vipCurrency === currentCurrency) {
                                console.log('✅ Même devise, pas de conversion');
                                // Calculer le total VIP
                                let totalVipPrice = vipPriceInfo.price * coursesCount;
                                
                                // Appliquer la réduction
                                if (discountPercent > 0) {
                                    totalVipPrice = totalVipPrice * (1 - discountPercent / 100);
                                    console.log(`🎁 Réduction ${discountPercent}% appliquée: ${totalVipPrice} ${vipCurrency}`);
                                }
                                
                                price = window.currencyManager.formatPriceInCurrency(totalVipPrice, vipCurrency);
                                console.log(`✅ Prix VIP (devise native ${vipCurrency}): ${price}`);
                            } else {
                                // Devises différentes: convertir
                                console.log(`💱 Devises différentes: ${vipCurrency} → ${currentCurrency}`);
                                
                                if (window.currencyManager.convertVIPPrice) {
                                    const totalVipPrice = vipPriceInfo.price * coursesCount * (1 - discountPercent / 100);
                                    const converted = window.currencyManager.convertVIPPrice(
                                        { price: totalVipPrice, currency: vipCurrency },
                                        currentCurrency
                                    );
                                    
                                    if (converted) {
                                        price = converted.display;
                                        console.log(`💱 Prix VIP converti: ${price}`);
                                    } else {
                                        price = window.currencyManager.formatPrice(totalVipPrice);
                                    }
                                } else {
                                    price = window.currencyManager.formatPrice(totalVipPrice);
                                }
                            }
                        } else {
                            console.log(`⚠️ Aucun prix VIP valide, utilisation prix normal`);
                            unitPriceEUR = getNormalPrice(courseType, selectedDuration);
                            price = calculateNormalPrice(unitPriceEUR, coursesCount, discountPercent);
                        }
                    } catch (error) {
                        console.error('❌ Erreur récupération prix VIP:', error);
                        unitPriceEUR = getNormalPrice(courseType, selectedDuration);
                        price = calculateNormalPrice(unitPriceEUR, coursesCount, discountPercent);
                    }
                }
                // PRIX NORMAL
                else {
                    console.log(`👤 Utilisateur standard, prix normal`);
                    unitPriceEUR = getNormalPrice(courseType, selectedDuration);
                    price = calculateNormalPrice(unitPriceEUR, coursesCount, discountPercent);
                }
                
                console.log(`✅ Prix final affiché: ${price}`);
                
            } else {
                duration = '60 min';
                let unitPriceEUR = getNormalPrice(courseType, 60);
                price = calculateNormalPrice(unitPriceEUR, coursesCount, discountPercent);
            }
        }

        // MISE À JOUR INTERFACE
        document.getElementById('summaryType').textContent = courseName;
        
        if (courseType === 'essai') {
            document.getElementById('summaryCoursesCount').textContent = `1 ${window.translationManager ? window.translationManager.getTranslation('booking.courses') : 'cours'}`;
            document.getElementById('summaryDiscount').textContent = '0%';
        } else {
            document.getElementById('summaryCoursesCount').textContent = `${coursesCount} ${window.translationManager ? window.translationManager.getTranslation('booking.courses') : 'cours'}`;
            document.getElementById('summaryDiscount').textContent = discountPercent > 0 ? `-${discountPercent}%` : '0%';
        }
        
        if (selectedDate) {
            const isFrench = !window.translationManager || window.translationManager.getCurrentLanguage() === 'fr';
            const dateObj = new Date(selectedDate);
            const formattedDate = dateObj.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            document.getElementById('summaryDate').textContent = formattedDate;
        } else {
            document.getElementById('summaryDate').textContent = '-';
        }
        
        document.getElementById('summaryTime').textContent = selectedTime || '-';
        document.getElementById('summaryDuration').textContent = duration;
        document.getElementById('summaryPlatform').textContent = platform;
        
        const summaryPriceElement = document.getElementById('summaryPrice');
        summaryPriceElement.innerHTML = price;
        
        if (isVipUser && courseType !== 'essai') {
            summaryPriceElement.classList.add('vip-price-display');
            summaryPriceElement.title = "Prix VIP personnel";
        } else {
            summaryPriceElement.classList.remove('vip-price-display');
            summaryPriceElement.title = "";
        }

        const canSubmit = selectedDate && selectedTime && courseType && 
            (courseType === 'essai' || (user && durationGroup.classList.contains('visible')));
        
        submitButton.disabled = !canSubmit;
    }

    // Fonction fallback pour afficher les prix en EUR
    function showDefaultPricesInEUR() {
        document.getElementById('summaryPrice').textContent = '20€';
        console.warn('⚠️ Affichage des prix en EUR par défaut');
    }

    // Fonction : Calculer le prix normal
    function calculateNormalPrice(unitPriceEUR, coursesCount, discountPercent) {
        let totalPriceEUR = unitPriceEUR * coursesCount;
        
        if (discountPercent > 0) {
            totalPriceEUR = totalPriceEUR * (1 - discountPercent / 100);
        }
        
        if (window.currencyManager && window.currencyManager.currentCurrency) {
            return window.currencyManager.formatPrice(totalPriceEUR);
        } else {
            return totalPriceEUR.toFixed(2) + ' EUR';
        }
    }

    // Fonction : Obtenir les prix normaux
    function getNormalPrice(courseType, duration) {
        console.log(`📋 Calcul prix normal pour ${courseType} ${duration}min`);
        
        switch(courseType) {
            case 'conversation':
                if (duration === 30) return 10;
                else if (duration === 45) return 15;
                else return 20;
            case 'curriculum':
                if (duration === 30) return 17.5;
                else if (duration === 45) return 26.25;
                else return 35;
            case 'examen':
                if (duration === 30) return 15;
                else if (duration === 45) return 22.5;
                else return 30;
            case 'essai':
                return 5;
            default:
                console.warn(`⚠️ Type de cours inconnu: ${courseType}`);
                return 20;
        }
    }

    function showError(message) {
        errorText.textContent = message;
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
    }

    function showSuccess(message) {
        successText.textContent = message;
        successDiv.style.display = 'block';
        errorDiv.style.display = 'none';
    }

    function hideMessages() {
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';
    }
    
    function updateUserInterface() {
        const user = window.authManager?.getCurrentUser();
        const isLoggedIn = !!user;
        isVipUser = window.authManager?.isUserVip();
        
        if (isLoggedIn && user) {
            document.getElementById('name').value = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
            document.getElementById('email').value = user.email || '';
            
            // Ajouter un badge VIP si l'utilisateur est VIP
            if (isVipUser) {
                const bookingTitle = document.querySelector('.booking-title');
                if (bookingTitle && !bookingTitle.querySelector('.vip-badge-booking')) {
                    const vipBadge = document.createElement('span');
                    vipBadge.className = 'vip-badge-booking';
                    vipBadge.textContent = 'VIP';
                    vipBadge.style.cssText = `
                        display: inline-block;
                        background: linear-gradient(135deg, #FFD700, #FFA500);
                        color: #000;
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 14px;
                        font-weight: bold;
                        margin-left: 15px;
                        border: 1px solid #FFA500;
                        vertical-align: middle;
                    `;
                    bookingTitle.appendChild(vipBadge);
                }
            }
        }
        
        // Mettre à jour l'interface en fonction du type de cours
        const currentCourseType = document.getElementById('courseType').value;
        updateUIForCourseType(currentCourseType, true);
    }
    
    // Fonction de débogage pour tester les crédits
    window.testCredits = async function() {
        const authMgr = window.authManager;
        const packagesMgr = window.packagesManager;
        
        if (!authMgr || !packagesMgr) {
            console.error('❌ Managers non disponibles');
            return;
        }
        
        const user = authMgr.getCurrentUser();
        if (!user) {
            console.error('❌ Utilisateur non connecté');
            return;
        }
        
        console.group('🧪 Test des crédits par durée');
        console.log('User ID:', user.id);
        
        try {
            // Tester plusieurs durées
            const durations = [30, 45, 60];
            const courseTypes = ['conversation', 'curriculum', 'examen'];
            
            for (const courseType of courseTypes) {
                console.log(`\n📚 ${courseType}:`);
                for (const duration of durations) {
                    const hasCredits = await packagesMgr.hasCreditForDuration(user.id, courseType, duration);
                    console.log(`  ${duration}min: ${hasCredits ? '✅ Crédits disponibles' : '❌ Pas de crédits'}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Erreur test crédits:', error);
        }
        
        console.groupEnd();
    };
});