// booking.js - Gestion des réservations avec Cal.com (API v2) - VERSION CORRIGÉE
class BookingManager {
    constructor() {
        const config = window.YOTEACHER_CONFIG || {};
        this.calcomApiKey = config.CALCOM_API_KEY;
        this.calcomUsername = config.CALCOM_USERNAME || 'yoann-bourbia-6ido9g';
        this.apiBaseUrl = 'https://api.cal.com/v2';
        this.eventTypeMap = {
            'essai': config.CALCOM_EVENT_TYPE_ESSAI || '4139074',
            'conversation': config.CALCOM_EVENT_TYPE_CONVERSATION || '',
            'curriculum': config.CALCOM_EVENT_TYPE_CURRICULUM || '',
            'examen': config.CALCOM_EVENT_TYPE_EXAMEN || '4139076'
        };
        
        this.durationOptions = {
            'essai': [15],
            'conversation': [30, 45, 60],
            'curriculum': [30, 45, 60],
            'examen': [30, 45, 60]
        };
        
        this.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.rateLimitInfo = { limit: 120, remaining: 120, reset: null };
        
        console.log('📅 BookingManager initialisé - Version corrigée');
    }

    checkCalcomConfig() {
        if (!this.calcomApiKey) {
            throw new Error('CALCOM_API_KEY non configurée. Configurez-la dans config.js');
        }
        
        if (!this.calcomApiKey.startsWith('cal_live_') && !this.calcomApiKey.startsWith('cal_test_')) {
            console.warn('Format de clé API Cal.com inhabituel. Vérifiez qu\'elle est correcte.');
        }
        
        return true;
    }

    getAuthHeaders(endpoint = 'slots') {
        let apiVersion;
        switch(endpoint) {
            case 'bookings':
                apiVersion = '2024-08-13';
                break;
            case 'event-types':
                apiVersion = '2024-06-14';
                break;
            case 'slots':
            default:
                apiVersion = '2024-09-04';
                break;
        }
        
        return {
            'Authorization': `Bearer ${this.calcomApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'cal-api-version': apiVersion
        };
    }

    async getAvailableSlots(eventType = 'essai', date = null, duration = null) {
        try {
            this.checkCalcomConfig();

            const targetDate = date || this.getToday();
            const eventTypeId = this.eventTypeMap[eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${eventType}" non configuré dans Cal.com`);
            }

            console.log(`🔍 Recherche créneaux pour eventTypeId: ${eventTypeId}, date: ${targetDate}`);

            const queryParams = new URLSearchParams({
                eventTypeId: eventTypeId,
                start: targetDate,
                end: targetDate,
                timeZone: this.timeZone
            });
            
            if (duration) {
                queryParams.append('duration', duration);
            }

            const response = await fetch(
                `${this.apiBaseUrl}/slots?${queryParams}`,
                {
                    method: 'GET',
                    headers: this.getAuthHeaders('slots')
                }
            );
            
            this.updateRateLimitInfo(response);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Réponse API Cal.com v2:', { 
                    status: response.status, 
                    statusText: response.statusText,
                    text: errorText 
                });
                
                if (response.status === 429) {
                    throw new Error('Rate limit atteint. Veuillez patienter avant de réessayer.');
                }
                
                try {
                    const errorData = JSON.parse(errorText);
                    
                    if (errorData.message && errorData.message.includes('invalid_type')) {
                        throw new Error('Paramètres invalides pour l\'API Cal.com');
                    }
                    
                    if (errorData.message && (errorData.message.includes('Unauthorized') || errorData.message.includes('unauthorized'))) {
                        throw new Error('Clé API Cal.com invalide ou expirée.');
                    }
                    
                    if (errorData.message && errorData.message.includes('not found')) {
                        await this.verifyEventTypeExists(eventTypeId);
                        throw new Error(`Type d'événement non trouvé (ID: ${eventTypeId})`);
                    }
                    
                    throw new Error(`API Cal.com: ${errorData.message || 'Erreur inconnue'}`);
                    
                } catch (parseError) {
                    if (response.status === 401) {
                        throw new Error('Authentification échouée.');
                    }
                    throw new Error(`API Cal.com: ${response.status} - ${errorText || response.statusText}`);
                }
            }
            
            const data = await response.json();
            
            console.log('📅 Données reçues de Cal.com v2:', data);
            
            if (!data || !data.data || typeof data.data !== 'object') {
                console.warn('Aucun créneau disponible ou format de réponse inattendu');
                return [];
            }
            
            const slotsData = data.data;
            const allSlots = Object.values(slotsData).flat();
            
            if (allSlots.length === 0) {
                console.warn('Aucun créneau disponible pour cette date');
                return [];
            }
            
            const formattedSlots = Object.entries(slotsData).flatMap(([date, slots]) => {
                if (!Array.isArray(slots)) {
                    console.warn(`Slots pour ${date} n'est pas un tableau:`, slots);
                    return [];
                }
                
                return slots.map(slot => {
                    const slotTime = slot.start || slot.time || slot;
                    
                    try {
                        const startDate = new Date(slotTime);
                        if (isNaN(startDate.getTime())) {
                            console.warn('Date invalide:', slot);
                            return null;
                        }
                        
                        const slotDuration = duration || this.getDefaultDuration(eventType);
                        
                        return {
                            id: slotTime,
                            start: slotTime,
                            end: this.calculateEndTime(slotTime, eventType, slotDuration),
                            time: startDate.toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            }),
                            duration: `${slotDuration} min`,
                            durationInMinutes: slotDuration,
                            eventTypeId: eventTypeId
                        };
                    } catch (error) {
                        console.warn('Erreur traitement slot:', slot, error);
                        return null;
                    }
                }).filter(slot => slot !== null);
            });
            
            console.log(`✅ ${formattedSlots.length} créneau(x) disponible(s) de ${duration || this.getDefaultDuration(eventType)} min`);
            return formattedSlots;
            
        } catch (error) {
            console.error('❌ Erreur Cal.com:', error);
            
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                console.warn('⚠️ Mode développement : simulation de créneaux');
                return this.generateMockSlots(date, eventType, duration);
            }
            
            throw new Error(`Impossible de charger les créneaux : ${error.message}`);
        }
    }

    calculateEndTime(startTime, eventType, customDuration = null) {
        try {
            const start = new Date(startTime);
            
            if (isNaN(start.getTime())) {
                console.error('Date invalide pour calculateEndTime:', startTime);
                return null;
            }
            
            const duration = customDuration || this.getDefaultDuration(eventType);
            const end = new Date(start.getTime() + duration * 60000);
            return end.toISOString();
        } catch (error) {
            console.error('Erreur dans calculateEndTime:', error, startTime);
            return null;
        }
    }

    getDefaultDuration(eventType) {
        switch(eventType) {
            case 'essai': return 15;
            case 'conversation': return 60;
            case 'curriculum': return 60;
            case 'examen': return 60;
            default: return 60;
        }
    }

    generateMockSlots(date, eventType, duration = null) {
        const baseDate = date || this.getToday();
        const slots = [];
        const selectedDuration = duration || this.getDefaultDuration(eventType);
        
        for (let hour = 9; hour <= 18; hour++) {
            const slotTime = `${baseDate}T${hour.toString().padStart(2, '0')}:00:00Z`;
            slots.push({
                id: `mock_${hour}`,
                start: slotTime,
                end: this.calculateEndTime(slotTime, eventType, selectedDuration),
                time: `${hour}:00`,
                duration: `${selectedDuration} min`,
                durationInMinutes: selectedDuration,
                eventTypeId: this.eventTypeMap[eventType],
                isMock: true
            });
        }
        
        console.log(`⚠️ Mode simulation: ${slots.length} créneaux générés (${selectedDuration} min)`);
        return slots;
    }

    async canUseCredit(bookingData) {
        console.log('🔍 Vérification si on peut utiliser un crédit:', bookingData);
        
        const user = window.authManager?.getCurrentUser();
        if (!user || !window.packagesManager) {
            console.log('❌ Pas d\'utilisateur ou packagesManager');
            return false;
        }
        
        // Uniquement pour 1 cours (pas les forfaits)
        if (bookingData.packageQuantity && bookingData.packageQuantity > 1) {
            console.log('❌ PackageQuantity > 1');
            return false;
        }
        
        // Uniquement pour les cours payants (pas essai)
        if (bookingData.courseType === 'essai') {
            console.log('❌ Cours d\'essai');
            return false;
        }
        
        try {
            const credits = await window.packagesManager.getUserCredits(user.id);
            console.log(`🔍 Crédits disponibles pour ${bookingData.courseType}:`, credits[bookingData.courseType]);
            const hasCredits = credits[bookingData.courseType] > 0;
            console.log('✅ Peut utiliser crédit?', hasCredits);
            return hasCredits;
        } catch (error) {
            console.warn('Erreur vérification crédits:', error);
            return false;
        }
    }

    async createBooking(bookingData) {
        try {
            console.group('🎯 DÉBUT createBooking');
            console.log('Données reçues:', bookingData);
            
            const user = window.authManager?.getCurrentUser();
            
            // DÉTERMINER LE FLUX
            const isCreditBooking = await this.canUseCredit(bookingData);
            const isPackagePurchase = bookingData.packageQuantity && bookingData.packageQuantity > 1;
            
            console.log('Flux déterminé:', {
                isCreditBooking,
                isPackagePurchase,
                packageQuantity: bookingData.packageQuantity
            });
            
            // FLUX 1: Réservation avec crédit existant
            if (isCreditBooking && !isPackagePurchase) {
                console.log('🚀 FLUX 1: Réservation avec crédit existant');
                const creditResult = await this.createBookingWithCredit(bookingData);
                return creditResult;
            }
            
            // FLUX 2: Achat de forfait + réservation immédiate
            if (isPackagePurchase) {
                console.log('🚀 FLUX 2: Achat de forfait + réservation immédiate');
                return await this.preparePackagePurchase(bookingData);
            }
            
            // FLUX 3: Réservation simple (payer maintenant)
            console.log('🚀 FLUX 3: Réservation simple - paiement normal');
            return await this.prepareRegularBooking(bookingData);
            
        } catch (error) {
            console.error('❌ Erreur création réservation:', error);
            return { 
                success: false, 
                error: `Échec de la préparation : ${error.message}` 
            };
        }
    }

    async createBookingWithCredit(bookingData) {
        try {
            console.log('🎫 Début création réservation AVEC CRÉDIT');
            
            const user = window.authManager?.getCurrentUser();
            if (!user) {
                throw new Error('Utilisateur non connecté');
            }
            
            console.log('👤 Utilisateur:', user.email);
            
            // 1. Utiliser un crédit
            console.log('💰 Utilisation d\'un crédit...');
            const creditResult = await window.packagesManager.useCredit(
                user.id,
                bookingData.courseType,
                { 
                    id: `temp_${Date.now()}`,
                    duration: bookingData.duration || 60 
                }
            );
            
            console.log('📦 Résultat utilisation crédit:', creditResult);
            
            if (!creditResult.success) {
                throw new Error(`Impossible d'utiliser un crédit: ${creditResult.error}`);
            }
            
            console.log('✅ Crédit utilisé, package_id:', creditResult.package_id);
            
            // 2. Préparer les données pour la réservation
            const bookingForCalcom = {
                startTime: bookingData.startTime,
                endTime: bookingData.endTime || this.calculateEndTime(bookingData.startTime, bookingData.courseType, bookingData.duration),
                eventType: bookingData.eventType || bookingData.courseType,
                courseType: bookingData.courseType,
                duration: bookingData.duration || 60,
                location: bookingData.location || 'integrations:google:meet',
                name: bookingData.name,
                email: bookingData.email,
                notes: bookingData.notes || '',
                userId: user.id,
                timeZone: this.timeZone,
                language: 'fr',
                
                // Informations crédit
                price: 0,
                currency: null,
                paymentMethod: 'credit',
                transactionId: `CREDIT-${Date.now()}`,
                packageId: creditResult.package_id,
                status: 'confirmed',
                isCreditBooking: true, // ← IMPORTANT
                isPackage: false,
                packageQuantity: 1
            };
            
            console.log('📤 Données pour Cal.com:', bookingForCalcom);
            
            // 3. Créer la réservation sur Cal.com
            const bookingResult = await this.createBookingAfterPayment(bookingForCalcom);
            
            console.log('📥 Résultat création réservation:', bookingResult);
            
            if (!bookingResult.success) {
                console.error('❌ Échec création réservation après utilisation crédit');
                throw new Error(`Échec création réservation: ${bookingResult.error}`);
            }
            
            // 4. Préparer les données pour la page de succès
            const finalBookingData = {
                ...bookingForCalcom,
                calcomId: bookingResult.data?.id || bookingResult.data?.uid,
                meetingLink: bookingResult.data?.location,
                bookingNumber: `BK-CREDIT-${Date.now().toString().slice(-8)}`,
                confirmedAt: new Date().toISOString(),
                supabaseBookingId: bookingResult.supabaseBookingId
            };
            
            console.log('✅ Réservation avec crédit créée avec succès');
            
            return {
                success: true,
                bookingData: finalBookingData,
                redirectTo: `payment-success.html?booking=${encodeURIComponent(JSON.stringify(finalBookingData))}`,
                message: 'Réservation avec crédit confirmée'
            };
            
        } catch (error) {
            console.error('❌ Erreur création réservation avec crédit:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async preparePackagePurchase(bookingData) {
        console.log('📦 Préparation achat forfait + réservation');
        
        const user = window.authManager?.getCurrentUser();
        const duration = bookingData.duration || 60;
        const quantity = bookingData.packageQuantity || 1;
        const discount = bookingData.discountPercent || 0;
        
        // Calculer le prix (avec réduction)
        let priceEUR = 0;
        const basePrice = this.getDefaultPrice(bookingData.courseType, duration);
        priceEUR = basePrice * quantity * (1 - discount / 100);
        
        const currentCurrency = window.currencyManager?.currentCurrency || 'EUR';
        let finalPrice = priceEUR;
        
        if (window.currencyManager) {
            finalPrice = window.currencyManager.convert(priceEUR, 'EUR', currentCurrency);
        }
        
        const completeBookingData = {
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            eventType: bookingData.eventType || bookingData.courseType,
            courseType: bookingData.courseType,
            duration: duration,
            location: bookingData.location || 'integrations:google:meet',
            name: bookingData.name,
            email: bookingData.email,
            notes: bookingData.notes || '',
            userId: user?.id || null,
            timeZone: this.timeZone,
            language: 'fr',
            
            // Informations forfait
            price: finalPrice,
            currency: currentCurrency,
            priceEUR: priceEUR,
            isPackagePurchase: true, // ← IMPORTANT
            isCreditBooking: false,
            packageQuantity: quantity,
            discountPercent: discount,
            packageCredits: quantity,
            status: 'pending_payment'
        };
        
        console.log('📤 Données achat forfait:', completeBookingData);
        
        localStorage.setItem('pendingBooking', JSON.stringify(completeBookingData));
        
        return {
            success: true,
            bookingData: completeBookingData,
            redirectTo: `payment.html?booking=${encodeURIComponent(JSON.stringify(completeBookingData))}`,
            message: 'Redirection vers le paiement pour achat forfait...'
        };
    }

    async prepareRegularBooking(bookingData) {
        console.log('💰 Préparation réservation simple');
        
        const user = window.authManager?.getCurrentUser();
        const duration = bookingData.duration || 60;
        const quantity = bookingData.packageQuantity || 1;
        const discount = bookingData.discountPercent || 0;
        
        // Calculer le prix
        let priceEUR = 0;
        const basePrice = this.getDefaultPrice(bookingData.courseType, duration);
        priceEUR = basePrice * quantity * (1 - discount / 100);
        
        const currentCurrency = window.currencyManager?.currentCurrency || 'EUR';
        let finalPrice = priceEUR;
        
        if (window.currencyManager) {
            finalPrice = window.currencyManager.convert(priceEUR, 'EUR', currentCurrency);
        }
        
        const completeBookingData = {
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            eventType: bookingData.eventType || bookingData.courseType,
            courseType: bookingData.courseType,
            duration: duration,
            location: bookingData.location || 'integrations:google:meet',
            name: bookingData.name,
            email: bookingData.email,
            notes: bookingData.notes || '',
            userId: user?.id || null,
            timeZone: this.timeZone,
            language: 'fr',
            
            // Informations paiement
            price: finalPrice,
            currency: currentCurrency,
            priceEUR: priceEUR,
            isPackagePurchase: false,
            isCreditBooking: false,
            packageQuantity: quantity,
            discountPercent: discount,
            status: 'pending_payment'
        };
        
        console.log('📤 Données réservation simple:', completeBookingData);
        
        localStorage.setItem('pendingBooking', JSON.stringify(completeBookingData));
        
        return {
            success: true,
            bookingData: completeBookingData,
            redirectTo: `payment.html?booking=${encodeURIComponent(JSON.stringify(completeBookingData))}`,
            message: 'Redirection vers le paiement...'
        };
    }

    getDefaultPrice(courseType, duration = 60) {
        const basePrices = {
            'essai': 5,
            'conversation': 20,
            'curriculum': 35,
            'examen': 30
        };
        
        let price = basePrices[courseType] || 20;
        
        if (courseType !== 'essai') {
            const ratio = duration / 60;
            price = price * ratio;
        }
        
        console.log(`💰 Prix par défaut pour ${courseType} ${duration}min: ${price}€`);
        return price;
    }

    async createBookingAfterPayment(bookingData) {
        try {
            this.checkCalcomConfig();

            const user = window.authManager?.getCurrentUser();
            const eventTypeId = this.eventTypeMap[bookingData.eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${bookingData.eventType}" non configuré`);
            }

            // Préparer le payload pour Cal.com
            const bookingPayload = {
                start: bookingData.startTime,
                eventTypeId: parseInt(eventTypeId),
                attendee: {
                    name: bookingData.name,
                    email: bookingData.email,
                    timeZone: bookingData.timeZone || this.timeZone,
                    language: bookingData.language || 'fr'
                },
                metadata: {
                    userId: user?.id ? String(user.id) : "", 
                    courseType: String(bookingData.courseType || ''),
                    price: String(bookingData.price || '0'),
                    currency: String(bookingData.currency || 'EUR'),
                    notes: String(bookingData.notes || ''),
                    duration: String(bookingData.duration || ''),
                    isVip: String(window.authManager?.isUserVip() || 'false'),
                    quantity: String(bookingData.packageQuantity || '1'),
                    discount: String(bookingData.discountPercent || '0'),
                    isCreditBooking: String(bookingData.isCreditBooking || 'false')
                }
            };

            // Ajouter la location
            if (bookingData.location) {
                bookingPayload.location = bookingData.location;
                console.log('📍 Location ajoutée:', bookingData.location);
            }

            // Ajouter la durée si nécessaire
            if (bookingData.eventType !== 'essai' && bookingData.duration) {
                const requestedDuration = parseInt(bookingData.duration);
                bookingPayload.lengthInMinutes = requestedDuration;
                
                const defaultDuration = this.getDefaultDuration(bookingData.eventType);
                if (requestedDuration !== defaultDuration && this.apiBaseUrl.includes('/v2/')) {
                    bookingPayload.duration = requestedDuration;
                }
            }

            console.log('📤 Création réservation Cal.com:', JSON.stringify(bookingPayload, null, 2));

            const response = await fetch(
                `${this.apiBaseUrl}/bookings`,
                {
                    method: 'POST',
                    headers: this.getAuthHeaders('bookings'),
                    body: JSON.stringify(bookingPayload)
                }
            );

            this.updateRateLimitInfo(response);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erreur création réservation Cal.com:', { 
                    status: response.status, 
                    text: errorText 
                });
                
                // Gérer les erreurs spécifiques
                try {
                    const errorData = JSON.parse(errorText);
                    
                    // Réessayer sans durée si erreur de durée
                    if (errorData.message && (errorData.message.includes('duration') || errorData.message.includes('length'))) {
                        console.log('🔄 Tentative sans durée spécifique...');
                        delete bookingPayload.lengthInMinutes;
                        delete bookingPayload.duration;
                        
                        const retryResponse = await fetch(
                            `${this.apiBaseUrl}/bookings`,
                            {
                                method: 'POST',
                                headers: this.getAuthHeaders('bookings'),
                                body: JSON.stringify(bookingPayload)
                            }
                        );
                        
                        if (!retryResponse.ok) {
                            throw new Error('Échec même sans durée spécifique');
                        }
                        
                        const retryResult = await retryResponse.json();
                        return { success: true, data: retryResult.data || retryResult };
                    }
                    
                    throw new Error(errorData.message || 'Erreur Cal.com');
                } catch (e) {
                    throw new Error(`API Cal.com: ${response.status} - ${errorText}`);
                }
            }

            const result = await response.json();
            const data = result.data || result;
            console.log('✅ Réservation créée sur Cal.com:', data);
            
            // Sauvegarder dans Supabase
            const bookingId = await this.saveBookingToSupabase(data, user, bookingData, 'confirmed');
            
            return { 
                success: true, 
                data,
                supabaseBookingId: bookingId,
                message: 'Réservation confirmée sur Cal.com' 
            };
            
        } catch (error) {
            console.error('❌ Erreur création réservation après paiement:', error);
            
            // En mode développement, simuler la création
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                console.warn('⚠️ Mode développement : simulation réservation Cal.com');
                return this.mockBookingAfterPayment(bookingData);
            }
            
            throw new Error(`Échec création réservation : ${error.message}`);
        }
    }

    async saveBookingToSupabase(calcomBooking, user, bookingData, status = 'confirmed') {
        try {
            if (!window.supabase) {
                console.warn('Supabase non disponible pour sauvegarde');
                return null;
            }

            // Générer un numéro de réservation
            const bookingNumber = `BK-${Date.now().toString().slice(-8)}`;

            let platformValue = this.getPlatformName(bookingData.location);
            const allowedPlatforms = ['meet', 'zoom', 'teams', 'other'];
            if (!allowedPlatforms.includes(platformValue)) {
                console.warn(`⚠️ Platform "${platformValue}" non autorisée, utilisation de "zoom"`);
                platformValue = 'zoom';
            }

            // STRUCTURE selon votre table 'bookings'
            const bookingRecord = {
                user_id: user?.id || bookingData.userId,
                course_type: bookingData.courseType,
                duration_minutes: bookingData.duration || 60,
                start_time: bookingData.startTime,
                end_time: bookingData.endTime,
                status: status,
                price_paid: bookingData.packageId ? 0 : bookingData.price,
                currency: bookingData.packageId ? null : bookingData.currency,
                platform: platformValue,
                booking_number: bookingNumber,
                payment_method: bookingData.paymentMethod || 'credit',
                payment_reference: bookingData.transactionId,
                calcom_booking_id: calcomBooking.id || calcomBooking.uid,
                calcom_uid: calcomBooking.uid,
                meeting_link: calcomBooking.location || calcomBooking.meetingUrl,
                created_at: new Date().toISOString()
            };

            // Ajouter package_id si présent
            if (bookingData.packageId) {
                bookingRecord.package_id = bookingData.packageId;
            }

            console.log('💾 Insertion dans Supabase bookings:', JSON.stringify(bookingRecord, null, 2));

            try {
                const { data, error } = await supabase
                    .from('bookings')
                    .insert([bookingRecord])
                    .select();

                if (error) {
                    console.error('❌ Erreur insertion dans bookings:', error);
                    
                    // Tentative 2: Essayer avec platform = NULL
                    console.log('🔄 Tentative 2: avec platform = NULL...');
                    const bookingRecordWithoutPlatform = { ...bookingRecord };
                    delete bookingRecordWithoutPlatform.platform;
                    
                    const { data: data2, error: error2 } = await supabase
                        .from('bookings')
                        .insert([bookingRecordWithoutPlatform])
                        .select();
                        
                    if (error2) {
                        console.error('❌ Même erreur avec platform = NULL:', error2);
                        
                        // Tentative 3: Essayer avec des valeurs minimales
                        console.log('🔄 Tentative 3: avec valeurs minimales...');
                        const minimalRecord = {
                            user_id: bookingRecord.user_id,
                            course_type: bookingRecord.course_type,
                            start_time: bookingRecord.start_time,
                            status: bookingRecord.status,
                            booking_number: bookingRecord.booking_number,
                            created_at: bookingRecord.created_at
                        };
                        
                        const { data: data3, error: error3 } = await supabase
                            .from('bookings')
                            .insert([minimalRecord])
                            .select();
                            
                        if (error3) {
                            console.error('❌ Échec même avec valeurs minimales:', error3);
                            return null;
                        } else {
                            console.log('✅ Insertion réussie avec valeurs minimales');
                            return data3[0].id;
                        }
                    } else {
                        console.log('✅ Insertion réussie avec platform = NULL');
                        return data2[0].id;
                    }
                }

                console.log('✅ Réservation sauvegardée dans bookings avec ID:', data[0].id);
                return data[0].id;
                
            } catch (dbError) {
                console.error('❌ Exception base de données:', dbError);
                return null;
            }
        } catch (error) {
            console.error('Exception sauvegarde Supabase:', error);
            return null;
        }
    }

    getPlatformName(location) {
        if (!location) {
            console.log('⚠️ Location est null/undefined, retourne "zoom"');
            return 'zoom';
        }
        
        const cleanLocation = String(location).trim().toLowerCase();
        
        if (cleanLocation.includes('google') || cleanLocation.includes('meet')) {
            return 'meet';
        }
        if (cleanLocation.includes('teams') || cleanLocation.includes('microsoft')) {
            return 'teams';
        }
        if (cleanLocation.includes('zoom')) {
            return 'zoom';
        }
        
        if (cleanLocation.includes('integrations:google:meet')) {
            return 'meet';
        }
        if (cleanLocation.includes('integrations:microsoft:teams')) {
            return 'teams';
        }
        if (cleanLocation.includes('integrations:zoom')) {
            return 'zoom';
        }
        
        return 'other';
    }

    getToday() {
        return new Date().toISOString().split('T')[0];
    }

    formatTime(dateTime) {
        try {
            const date = new Date(dateTime);
            return date.toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit',
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch (error) {
            console.warn('Erreur formatage date:', error);
            return dateTime || 'Date non disponible';
        }
    }

    updateRateLimitInfo(response) {
        if (response.headers) {
            const limit = response.headers.get('X-RateLimit-Limit');
            const remaining = response.headers.get('X-RateLimit-Remaining');
            const reset = response.headers.get('X-RateLimit-Reset');
            
            if (limit) this.rateLimitInfo.limit = parseInt(limit);
            if (remaining) this.rateLimitInfo.remaining = parseInt(remaining);
            if (reset) this.rateLimitInfo.reset = new Date(parseInt(reset) * 1000);
            
            if (this.rateLimitInfo.remaining < 10) {
                console.warn(`⚠️ Rate limit proche: ${this.rateLimitInfo.remaining}/${this.rateLimitInfo.limit} requêtes restantes`);
            }
        }
    }

    async mockBookingAfterPayment(bookingData) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockBooking = {
                    id: `mock_${Date.now()}`,
                    uid: `mock_${Date.now()}`,
                    start: bookingData.startTime,
                    end: bookingData.endTime,
                    title: `Cours ${bookingData.courseType} (${bookingData.duration}min)`,
                    attendees: [{
                        email: bookingData.email,
                        name: bookingData.name
                    }],
                    location: bookingData.location || 'integrations:zoom'
                };
                
                console.log('✅ Réservation Cal.com simulée:', mockBooking);
                resolve({ success: true, data: mockBooking, supabaseBookingId: `mock_${Date.now()}` });
            }, 1000);
        });
    }
}

// Initialisation sécurisée
function initializeBookingManager() {
    try {
        if (!window.bookingManager) {
            window.bookingManager = new BookingManager();
            console.log('✅ BookingManager initialisé avec succès');
        }
        return window.bookingManager;
    } catch (error) {
        console.error('❌ Erreur initialisation BookingManager:', error);
        return null;
    }
}

// Attendre que tout soit chargé avant d'initialiser
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM chargé, initialisation BookingManager...');
        initializeBookingManager();
    });
} else {
    console.log('📄 DOM déjà chargé, initialisation BookingManager...');
    initializeBookingManager();
}

// Initialiser globalement
window.bookingManager = initializeBookingManager();

console.log('✅ booking.js chargé - Version corrigée avec les 3 flux');