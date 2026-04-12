// booking-ui.js - VERSION DB-DRIVEN
// ✅ Calcul prix : SUPPRIMÉ → affiché depuis create_booking_intent()
// ✅ Réductions : SUPPRIMÉES → gérées par RPC
// ✅ Prix VIP : SUPPRIMÉS → gérés par RPC

document.addEventListener('DOMContentLoaded', function() {
    let selectedDate = null;
    let selectedTime = null;
    let selectedSlot = null;
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let cachedIntentData = null; // Cache du dernier appel RPC
    
    let isVipUser = false;

    // Éléments DOM - DÉCLARATION COMPLÈTE AVANT TOUTE FONCTION
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
    const loginRequired = document.getElementById('loginRequired');
    const courseTypeName = document.getElementById('courseTypeName');
    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signupLink');
    const selectedLocationInput = document.getElementById('selectedLocation');
    const coursesCountGroup = document.getElementById('coursesCountGroup');
    const coursesCountInput = document.getElementById('coursesCount');
    const discountPercentInput = document.getElementById('discountPercent');
    const mobileSubmitBtn = document.getElementById('mobileSubmitBtn'); // DÉCLARÉ AVANT UTILISATION

    let preLoginCourseType = null;

    // ============================================================================
    // INITIALISATION PAGE
    // ============================================================================
    initializePage();

    // Navigation calendrier
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

    // Changement type de cours
    document.getElementById('courseType').addEventListener('change', function() {
        const courseType = this.value;
        preLoginCourseType = courseType;
        updateUIForCourseType(courseType, true);
        if (selectedDate) {
            loadAvailableSlots(selectedDate);
        }
        cachedIntentData = null; // Reset cache
        updateSummary();
        updateSubmitButtonText();
    });

    // Gestion durée
    document.querySelectorAll('.duration-option').forEach(button => {
        if (button.hasAttribute('data-duration')) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                document.querySelectorAll('.duration-option[data-duration]').forEach(btn => {
                    btn.classList.remove('selected');
                });
                
                this.classList.add('selected');
                
                const duration = this.getAttribute('data-duration');
                durationInput.value = duration;
                
                if (selectedDate) {
                    loadAvailableSlots(selectedDate);
                }
                
                cachedIntentData = null; // Reset cache
                updateSummary();
                updateSubmitButtonText();
                updateZoomButtonState();
            });
        }
    });

    // Gestion nombre de cours
    document.querySelectorAll('.courses-count-option').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            document.querySelectorAll('.courses-count-option').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            this.classList.add('selected');
            
            const count = this.getAttribute('data-count');
            const discount = this.getAttribute('data-discount');
            coursesCountInput.value = count;
            discountPercentInput.value = discount;
            
            cachedIntentData = null; // Reset cache
            updateSummary();
            updateSubmitButtonText();
        });
    });

    // Gestion localisation
    document.querySelectorAll('.location-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Bloquer le clic si le bouton est désactivé
            if (this.disabled || this.classList.contains('disabled-location')) return;
            
            document.querySelectorAll('.location-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            this.classList.add('selected');
            
            const location = this.getAttribute('data-location');
            selectedLocationInput.value = location;
            
            updateSummary();
        });
    });

    // ============================================================================
    // GESTION BOUTON MOBILE
    // ============================================================================
    if (mobileSubmitBtn) {
        // Synchroniser l'état initial du bouton mobile avec le desktop
        mobileSubmitBtn.disabled = submitButton.disabled;
        
        mobileSubmitBtn.addEventListener('click', function() {
            document.getElementById('submitBooking').click();
        });
    }

    // ============================================================================
    // EVENT DELEGATION POUR LES CRÉNEAUX HORAIRES
    // Correction bug mobile : utiliser la délégation d'événements au lieu
    // d'attacher des listeners individuels qui sont perdus lors des recréations
    // ============================================================================
    timeSlots.addEventListener('click', function(e) {
        const slotElement = e.target.closest('.time-slot');
        if (slotElement && slotElement.dataset.slotData) {
            try {
                const slot = JSON.parse(slotElement.dataset.slotData);
                selectTimeSlot(slot, slotElement);
            } catch (error) {
                console.error('Erreur parsing slot data:', error);
            }
        }
    });

    // ============================================================================
    // SOUMISSION FORMULAIRE - CORRECTION: DURÉE ESSAI FIXE À 15 MIN
    // ============================================================================
    bookingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        console.log('💰 Début préparation réservation');
        
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
        
        // CORRECTION: Durée fixe à 15 minutes pour l'essai
        let duration = parseInt(durationInput.value) || 60;
        if (courseType === 'essai') {
            duration = 15; // Durée fixe pour l'essai
        }

        if (!courseType || !name || !email) {
            showError('Veuillez remplir tous les champs obligatoires');
            return;
        }

        if ((courseType === 'conversation' || courseType === 'curriculum' || courseType === 'examen') && !window.authManager?.getCurrentUser()) {
            showError('Veuillez vous connecter pour réserver ce type de cours');
            return;
        }

        hideMessages();
        submitButton.disabled = true;
        
        const user = window.authManager?.getCurrentUser();
        
        if (user && coursesCount === 1 && courseType !== 'essai') {
            try {
                if (window.packagesManager) {
                    const hasCredits = await window.packagesManager.hasCreditForDuration(user.id, courseType, duration);
                    
                    if (hasCredits) {
                        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Réservation avec crédit...';
                    } else {
                        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Préparation du paiement...';
                    }
                }
            } catch (error) {
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Préparation du paiement...';
            }
        } else {
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Préparation du paiement...';
        }

        try {
            if (!selectedSlot) {
                throw new Error('Aucun créneau sélectionné');
            }

            const bookingData = {
                startTime: selectedSlot.start,
                endTime: selectedSlot.end,
                courseType: courseType,
                duration: duration, // ✅ Utilise la durée corrigée (15 pour essai)
                location: location,
                name: name,
                email: email,
                notes: notes,
                packageQuantity: coursesCount,
                discountPercent: discountPercent
            };

            console.log('📤 Appel bookingManager.createBooking avec:', bookingData);
            
            const result = await window.bookingManager.createBooking(bookingData);
            
            console.log('📥 Résultat:', result);
            
            if (result.success) {
                showSuccess('Redirection...');
                
                setTimeout(() => {
                    window.location.href = result.redirectTo;
                }, 1000);
            } else {
                throw new Error(result.error || 'Erreur inconnue');
            }

        } catch (error) {
            console.error('❌ Erreur préparation:', error);
            showError('Erreur : ' + error.message);
            submitButton.disabled = false;
            updateSubmitButtonText();
        }
    });

    // Événements
    window.addEventListener('auth:login', function() {
        console.log('Utilisateur connecté, mise à jour interface');
        updateUserInterface();
        setTimeout(updateSubmitButtonText, 500);
    });

    window.addEventListener('auth:logout', function() {
        console.log('Utilisateur déconnecté, mise à jour interface');
        updateUserInterface();
        updateSubmitButtonText();
    });
    
    window.addEventListener('currency:ready', function() {
        console.log('💱 CurrencyManager prêt, mise à jour');
        updateSummary();
    });
    
    window.addEventListener('currency:changed', function() {
        console.log('💱 Devise changée, INVALIDATION du cache et mise à jour');
        // Invalider le cache quand la devise change
        cachedIntentData = null;
        updateSummary();
    });
    
    window.addEventListener('language:changed', function() {
        initCalendar();
        updateSummary();
        updateSubmitButtonText();
    });
    
    window.addEventListener('vip:loaded', function() {
        console.log('🎁 Prix VIP chargés');
        isVipUser = window.authManager?.isUserVip();
        updateUserInterface();
        cachedIntentData = null;
        updateSummary();
    });
    
    // Protection contre bfcache mobile - forcer la resynchronisation de l'état du bouton
    window.addEventListener('pageshow', function(event) {
        if (event.persisted && mobileSubmitBtn && submitButton) {
            // Page restaurée depuis bfcache - synchroniser l'état du bouton mobile
            console.log('📱 Pageshow (bfcache) - resynchronisation bouton mobile');
            mobileSubmitBtn.disabled = submitButton.disabled;
        }
    });

    // ============================================================================
    // FONCTIONS
    // ============================================================================
    
    async function initializePage() {
        console.log('🚀 Initialisation page booking (DB-driven)');
        
        const urlParams = new URLSearchParams(window.location.search);
        let courseTypeParam = urlParams.get('type');
        
        if (!courseTypeParam || !['essai', 'conversation', 'curriculum', 'examen'].includes(courseTypeParam)) {
            const storedCourseType = localStorage.getItem('preLoginCourseType');
            
            if (storedCourseType && ['essai', 'conversation', 'curriculum', 'examen'].includes(storedCourseType)) {
                courseTypeParam = storedCourseType;
                localStorage.removeItem('preLoginCourseType');
            } else {
                courseTypeParam = 'essai';
            }
        }
        
        document.getElementById('courseType').value = courseTypeParam;
        preLoginCourseType = courseTypeParam;
        
        if (!urlParams.has('type')) {
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('type', courseTypeParam);
            window.history.replaceState({}, '', newUrl);
        }
        
        preselectDefaults();
        initCalendar();
        
        const today = new Date().toISOString().split('T')[0];
        selectToday(today);
        
        updateUIForCourseType(document.getElementById('courseType').value, false);
        updateUserInterface();
        
        setTimeout(updateSubmitButtonText, 1000);
    }
    

    function preselectDefaults() {
        const duration60Btn = document.querySelector('.duration-option[data-duration="60"]');
        if (duration60Btn) {
            document.querySelectorAll('.duration-option[data-duration]').forEach(btn => {
                btn.classList.remove('selected');
            });
            duration60Btn.classList.add('selected');
            durationInput.value = '60';
        }
        
        const courses1Btn = document.querySelector('.courses-count-option[data-count="1"]');
        if (courses1Btn) {
            document.querySelectorAll('.courses-count-option').forEach(btn => {
                btn.classList.remove('selected');
            });
            courses1Btn.classList.add('selected');
            coursesCountInput.value = '1';
            discountPercentInput.value = courses1Btn.getAttribute('data-discount') || '0';
        }
        
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
        
        const monthNames = isFrench ? 
            ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'] :
            ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        currentMonthElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;

        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        const dayHeaders = isFrench ? 
            ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] :
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
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

    function updateZoomButtonState() {
        const zoomBtn = document.querySelector('.location-btn[data-location="integrations:zoom"]');
        if (!zoomBtn) return;

        const courseType = document.getElementById('courseType').value;
        const duration = parseInt(durationInput.value) || 60;

        // Zoom désactivé pour 45 min et 60 min, sauf pour le cours essai
        const zoomDisabled = courseType !== 'essai' && (duration === 45 || duration === 60);

        if (zoomDisabled) {
            zoomBtn.disabled = true;
            zoomBtn.classList.add('disabled-location');
            zoomBtn.title = 'Zoom non disponible pour cette durée';

            // Si Zoom était sélectionné, basculer automatiquement sur Meet
            if (zoomBtn.classList.contains('selected')) {
                zoomBtn.classList.remove('selected');
                const meetBtn = document.querySelector('.location-btn[data-location="integrations:google:meet"]');
                if (meetBtn) {
                    meetBtn.classList.add('selected');
                    selectedLocationInput.value = 'integrations:google:meet';
                }
            }
        } else {
            zoomBtn.disabled = false;
            zoomBtn.classList.remove('disabled-location');
            zoomBtn.title = '';
        }
    }

    function updateUIForCourseType(courseType, forceUpdate = false) {
        console.log('updateUIForCourseType:', courseType);
        
        preLoginCourseType = courseType;
        
        const user = window.authManager?.getCurrentUser();
        const isLoggedIn = !!user;
        
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
            // CORRECTION: Forcer la durée à 15 pour l'essai
            durationInput.value = '15';
        } else if (courseType === 'conversation' || courseType === 'curriculum' || courseType === 'examen') {
            if (isLoggedIn) {
                durationGroup.classList.add('visible');
                coursesCountGroup.style.display = 'block';
                loginRequired.style.display = 'none';
            } else {
                durationGroup.classList.remove('visible');
                coursesCountGroup.style.display = 'none';
                loginRequired.style.display = 'block';
                
                if (window.translationManager) {
                    if (courseType === 'conversation') courseTypeName.textContent = window.translationManager.getTranslation('courses.conversation');
                    else if (courseType === 'curriculum') courseTypeName.textContent = window.translationManager.getTranslation('courses.curriculum');
                    else if (courseType === 'examen') courseTypeName.textContent = window.translationManager.getTranslation('courses.exam');
                }
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
        updateZoomButtonState();
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
            } else if (courseType === 'essai') {
                // CORRECTION: Durée fixe à 15 minutes pour l'essai
                duration = 15;
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
                    
                    // ✅ CORRECTION: Utiliser directement slot.time qui est déjà formaté correctement
                    // au lieu de re-formatter avec toLocaleTimeString qui cause une double conversion
                    const displayTime = slot.time || slotDate.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit'
                    });
                    
                    // Pour la description longue, extraire aussi depuis la string originale
                    let longDateDescription = '';
                    if (typeof slot.start === 'string' && slot.start.includes('T')) {
                        // Parser la date ISO pour avoir le jour/mois/année correct
                        const datePart = slot.start.split('T')[0]; // "2026-02-18"
                        const [year, month, day] = datePart.split('-');
                        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        
                        const isFrench = !window.translationManager || window.translationManager.getCurrentLanguage() === 'fr';
                        longDateDescription = dateObj.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        }) + ' à ' + displayTime;
                    } else {
                        // Fallback
                        const isFrench = !window.translationManager || window.translationManager.getCurrentLanguage() === 'fr';
                        longDateDescription = slotDate.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        }) + ' à ' + displayTime;
                    }
                    
                    slotElement.innerHTML = `
                        <div class="time-slot-time">
                            <i class="far fa-clock"></i>
                            ${displayTime}
                        </div>
                        <div class="time-slot-duration">
                            ${longDateDescription} - ${slot.duration}
                        </div>
                    `;
                    
                    // Stocker les données du slot dans un attribut data pour la délégation d'événements
                    // Correction bug mobile : éviter l'attachement individuel d'event listeners
                    slotElement.dataset.slotData = JSON.stringify(slot);
                    
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
            
            timeSlots.innerHTML = `
                <div class="error-slots">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorTitle}</p>
                    <p class="error-details">${error.message || 'Veuillez réessayer'}</p>
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
        
        // ✅ INVALIDER LE CACHE quand on change de créneau
        cachedIntentData = null;
        
        updateSummary();
    }

    // ============================================================================
    // MISE À JOUR TEXTE BOUTON (conservée - appelle RPC pour vérifier)
    // ============================================================================
    async function updateSubmitButtonText() {
        const user = window.authManager?.getCurrentUser();
        const courseType = document.getElementById('courseType').value;
        const coursesCount = parseInt(coursesCountInput.value) || 1;
        const submitBtn = document.getElementById('submitBooking');
        
        // Pour l'essai, durée fixe à 15 minutes
        let duration = parseInt(durationInput.value) || 60;
        if (courseType === 'essai') {
            duration = 15;
        }
        
        if (!submitBtn || !user || courseType === 'essai' || coursesCount > 1) {
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

    // ============================================================================
    // MISE À JOUR RÉCAPITULATIF - APPELLE calculate_price_estimate()
    // ============================================================================
    async function updateSummary() {
        console.log('📋 Mise à jour récapitulatif (DB-driven)');
        
        const courseType = document.getElementById('courseType').value;
        const user = window.authManager?.getCurrentUser();
        let courseName = '-';
        let price = '-';
        let duration = '-';
        let platform = 'Google Meet';
        const coursesCount = parseInt(coursesCountInput.value);
        const discountPercent = parseFloat(discountPercentInput.value);
        
        isVipUser = window.authManager?.isUserVip();
        
        // Plateforme
        const locationValue = selectedLocationInput.value;
        if (locationValue.includes('zoom')) platform = 'Zoom';
        else if (locationValue.includes('google')) platform = 'Google Meet';
        else if (locationValue.includes('teams')) platform = 'Microsoft Teams';

        // COURS D'ESSAI - Prix fixe
        if (courseType === 'essai') {
            console.log('🎫 Cours d\'essai');
            courseName = window.translationManager ? window.translationManager.getTranslation('courses.trial') : 'Cours d\'essai';
            duration = '15 min'; // ✅ CORRECTION: Toujours 15 minutes pour l'essai
            
            // Prix fixe 5 EUR - converti dans la devise courante
            if (window.currencyManager) {
                const convertedPrice = window.currencyManager.convert(5, 'EUR', window.currencyManager.currentCurrency);
                price = window.currencyManager.formatPriceInCurrency(convertedPrice, window.currencyManager.currentCurrency);
            } else {
                price = '5€';
            }
            
            console.log(`✅ Prix essai: ${price}`);
        } 
        // COURS PAYANTS - APPELER calculate_price_estimate() (DB-ONLY)
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
                
                console.log(`📞 Appel calculate_price_estimate() pour afficher prix`);
                
                // ✅ APPELER RPC calculate_price_estimate() (DB-ONLY)
                if (window.supabase && selectedDate && selectedSlot) {
                    try {
                        // Vérifier le cache - INVALIDER LE CACHE SI LA DEVISE A CHANGÉ
                        const currentCurrency = window.currencyManager ? window.currencyManager.currentCurrency : 'EUR';
                        if (cachedIntentData && 
                            cachedIntentData.course_type === courseType &&
                            cachedIntentData.duration === selectedDuration &&
                            cachedIntentData.quantity === coursesCount &&
                            cachedIntentData.lastCurrency === currentCurrency) { // Vérifier aussi la devise
                            
                            console.log('📦 Utilisation du cache pour le prix');
                            price = cachedIntentData.displayPrice;
                        } else {
                            console.log('📤 Paramètres RPC estimate:', {
                                p_user_id: user.id,
                                p_course_type: courseType,
                                p_duration: selectedDuration,
                                p_quantity: coursesCount
                            });

                            // ✅ APPEL RPC (DB-ONLY)
                            const { data: priceEstimate, error: estimateError } = await supabase.rpc('calculate_price_estimate', {
                                p_user_id: user.id,
                                p_course_type: courseType,
                                p_duration: selectedDuration,
                                p_quantity: coursesCount
                            });
                            
                            console.log('📥 Réponse RPC estimate:', { priceEstimate, estimateError });
                            
                            if (estimateError) {
                                console.error('❌ Erreur RPC calculate_price_estimate:', estimateError);
                                console.error('   Code:', estimateError.code);
                                console.error('   Message:', estimateError.message);
                                price = 'Erreur calcul';
                            } else if (!priceEstimate || !priceEstimate.success) {
                                console.warn('⚠️ RPC estimate échoué:', priceEstimate);
                                price = 'Prix à calculer';
                            } else {
                                console.log('✅ Prix estimé par RPC (DB):', priceEstimate.price, priceEstimate.currency);
                                
                                // Formater le prix dans la devise courante
                                if (window.currencyManager) {
                                    // Convertir le prix de la devise retournée vers la devise courante
                                    const currentCurrency = window.currencyManager.currentCurrency;
                                    const convertedPrice = window.currencyManager.convert(
                                        priceEstimate.price, 
                                        priceEstimate.currency, 
                                        currentCurrency
                                    );
                                    
                                    price = window.currencyManager.formatPriceInCurrency(convertedPrice, currentCurrency);
                                    
                                    // Mettre en cache avec la devise actuelle
                                    cachedIntentData = {
                                        course_type: courseType,
                                        duration: selectedDuration,
                                        quantity: coursesCount,
                                        displayPrice: price,
                                        rawPrice: priceEstimate.price,
                                        originalCurrency: priceEstimate.currency,
                                        lastCurrency: currentCurrency, // Stocker la devise utilisée
                                        is_vip: priceEstimate.is_vip
                                    };
                                } else {
                                    price = `${priceEstimate.price} ${priceEstimate.currency}`;
                                }
                            }
                        }
                    } catch (catchError) {
                        console.error('❌ Exception appel RPC estimate:', catchError);
                        console.error('   Type:', catchError.name);
                        console.error('   Message:', catchError.message);
                        price = 'Erreur calcul';
                    }
                } else {
                    price = 'Sélectionnez date et heure';
                }
                
                console.log(`✅ Prix final affiché: ${price}`);
                
            } else {
                duration = '60 min';
                price = 'Connectez-vous';
            }
        }
        
        // FORMATER LA DATE (utilisée pour les deux récapitulatifs)
        let formattedDate = '-';
        if (selectedDate) {
            const isFrench = !window.translationManager || window.translationManager.getCurrentLanguage() === 'fr';
            const dateObj = new Date(selectedDate);
            formattedDate = dateObj.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
        
        // MISE À JOUR RÉCAPITULATIF DESKTOP
        document.getElementById('summaryType').textContent = courseName;
        
        if (courseType === 'essai') {
            document.getElementById('summaryCoursesCount').textContent = `1 ${window.translationManager ? window.translationManager.getTranslation('booking.courses') : 'cours'}`;
            document.getElementById('summaryDiscount').textContent = '0%';
        } else {
            document.getElementById('summaryCoursesCount').textContent = `${coursesCount} ${window.translationManager ? window.translationManager.getTranslation('booking.courses') : 'cours'}`;
            document.getElementById('summaryDiscount').textContent = discountPercent > 0 ? `-${discountPercent}%` : '0%';
        }
        
        document.getElementById('summaryDate').textContent = formattedDate;
        document.getElementById('summaryTime').textContent = selectedTime || '-';
        document.getElementById('summaryDuration').textContent = duration;
        document.getElementById('summaryPlatform').textContent = platform;
        
        const summaryPriceElement = document.getElementById('summaryPrice');
        summaryPriceElement.innerHTML = price;
        
        if (isVipUser && courseType !== 'essai' && cachedIntentData?.is_vip) {
            summaryPriceElement.classList.add('vip-price-display');
            summaryPriceElement.title = "Prix VIP personnel";
        } else {
            summaryPriceElement.classList.remove('vip-price-display');
            summaryPriceElement.title = "";
        }

        // MISE À JOUR RÉCAPITULATIF MOBILE - ✅ AVEC PROTECTION COMPLÈTE
        try {
            const mobileSummaryType = document.getElementById('mobileSummaryType');
            const mobileSummaryCoursesCount = document.getElementById('mobileSummaryCoursesCount');
            const mobileSummaryDiscount = document.getElementById('mobileSummaryDiscount');
            const mobileSummaryDate = document.getElementById('mobileSummaryDate');
            const mobileSummaryTime = document.getElementById('mobileSummaryTime');
            const mobileSummaryDuration = document.getElementById('mobileSummaryDuration');
            const mobileSummaryPlatform = document.getElementById('mobileSummaryPlatform');
            const mobileSummaryPriceElement = document.getElementById('mobileSummaryPrice');
            
            if (mobileSummaryType) mobileSummaryType.textContent = courseName;
            
            if (courseType === 'essai') {
                if (mobileSummaryCoursesCount) mobileSummaryCoursesCount.textContent = `1 ${window.translationManager ? window.translationManager.getTranslation('booking.courses') : 'cours'}`;
                if (mobileSummaryDiscount) mobileSummaryDiscount.textContent = '0%';
            } else {
                if (mobileSummaryCoursesCount) mobileSummaryCoursesCount.textContent = `${coursesCount} ${window.translationManager ? window.translationManager.getTranslation('booking.courses') : 'cours'}`;
                if (mobileSummaryDiscount) mobileSummaryDiscount.textContent = discountPercent > 0 ? `-${discountPercent}%` : '0%';
            }
            
            if (mobileSummaryDate) mobileSummaryDate.textContent = formattedDate;
            if (mobileSummaryTime) mobileSummaryTime.textContent = selectedTime || '-';
            if (mobileSummaryDuration) mobileSummaryDuration.textContent = duration;
            if (mobileSummaryPlatform) mobileSummaryPlatform.textContent = platform;
            
            if (mobileSummaryPriceElement) {
                mobileSummaryPriceElement.innerHTML = price;
                
                if (isVipUser && courseType !== 'essai' && cachedIntentData?.is_vip) {
                    mobileSummaryPriceElement.classList.add('vip-price-display');
                    mobileSummaryPriceElement.title = "Prix VIP personnel";
                } else {
                    mobileSummaryPriceElement.classList.remove('vip-price-display');
                    mobileSummaryPriceElement.title = "";
                }
            }
        } catch (mobileUpdateError) {
            // Erreur silencieuse - normal si les éléments mobiles n'existent pas
            console.log('Note: Mise à jour mobile ignorée');
        }

        const canSubmit = selectedDate && selectedTime && courseType && 
            (courseType === 'essai' || (user && durationGroup.classList.contains('visible')));
        
        submitButton.disabled = !canSubmit;
        
        // Mettre à jour l'état du bouton mobile - TOUJOURS synchronisé avec desktop
        if (mobileSubmitBtn) {
            mobileSubmitBtn.disabled = submitButton.disabled;
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
        
        const currentCourseType = document.getElementById('courseType').value;
        updateUIForCourseType(currentCourseType, true);
    }
});

console.log('✅ booking-ui.js chargé - Version DB-driven (prix calculés par RPC) avec correction devise');