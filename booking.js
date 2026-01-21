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
        this.rateLimitInfo = {
            limit: 120,
            remaining: 120,
            reset: null
        };
        
        // Verrou pour éviter les réservations simultanées
        this.bookingLocks = new Map();
        
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

    async getAvailableSlots(eventType = 'essai', date = null, duration = null) {
        try {
            this.checkCalcomConfig();

            const targetDate = date || this.getToday();
            const eventTypeId = this.eventTypeMap[eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${eventType}" non configuré dans Cal.com`);
            }

            console.log(`🔍 Recherche créneaux pour eventTypeId: ${eventTypeId}, date: ${targetDate}, timeZone: ${this.timeZone}, durée: ${duration || 'défaut'} min`);

            const queryParams = new URLSearchParams({
                eventTypeId: eventTypeId,
                start: targetDate,
                end: targetDate,
                timeZone: this.timeZone
            });
            
            if (duration) {
                queryParams.append('duration', duration);
            }

            console.log(`📍 URL complète: ${this.apiBaseUrl}/slots?${queryParams.toString()}`);

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
                    console.error('Détails erreur:', errorData);
                    
                    if (errorData.message && errorData.message.includes('invalid_type')) {
                        throw new Error('Paramètres invalides pour l\'API Cal.com');
                    }
                    
                    if (errorData.message && (errorData.message.includes('Unauthorized') || errorData.message.includes('unauthorized'))) {
                        throw new Error('Clé API Cal.com invalide ou expirée. Vérifiez votre clé dans config.js');
                    }
                    
                    if (errorData.message && errorData.message.includes('not found')) {
                        await this.verifyEventTypeExists(eventTypeId);
                        throw new Error(`Type d'événement non trouvé (ID: ${eventTypeId})`);
                    }
                    
                    throw new Error(`API Cal.com: ${errorData.message || 'Erreur inconnue'}`);
                    
                } catch (parseError) {
                    if (response.status === 401) {
                        throw new Error('Authentification échouée. Vérifiez que votre clé API est valide et commence par "cal_live_" ou "cal_test_"');
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
                
                console.log(`📋 Exemple de slot reçu pour ${date}:`, slots[0]);
                
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

    getDurationOptions(eventType) {
        return this.durationOptions[eventType] || [60];
    }

    getDuration(eventType) {
        const defaultDuration = this.getDefaultDuration(eventType);
        return `${defaultDuration} min`;
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

    async verifyEventTypeExists(eventTypeId) {
        try {
            console.log(`🔍 Vérification de l'event type ID: ${eventTypeId}`);
            
            const queryParams = new URLSearchParams({
                username: this.calcomUsername
            });
            
            const response = await fetch(
                `${this.apiBaseUrl}/event-types?${queryParams}`, 
                {
                    headers: this.getAuthHeaders('event-types')
                }
            );
            
            this.updateRateLimitInfo(response);
            
            if (response.ok) {
                const result = await response.json();
                const data = result.data || result;
                console.log('📋 Vos event types disponibles:', data);
                
                if (data.eventTypes) {
                    const foundEvent = data.eventTypes.find(
                        event => event.id == eventTypeId || event.id === parseInt(eventTypeId)
                    );
                    
                    if (!foundEvent) {
                        console.error(`❌ Event type ID ${eventTypeId} non trouvé dans vos event types`);
                        console.log('IDs disponibles:', data.eventTypes.map(e => ({ 
                            id: e.id, 
                            slug: e.slug, 
                            title: e.title,
                            length: e.lengthInMinutes || e.length 
                        })));
                    } else {
                        console.log(`✅ Event type trouvé: ${foundEvent.title} (${foundEvent.lengthInMinutes || foundEvent.length} min)`);
                        
                        if (foundEvent.availableLengths) {
                            console.log(`📏 Durées disponibles: ${foundEvent.availableLengths.join(', ')} min`);
                        } else {
                            console.log(`ℹ️ Pas de durées multiples configurées pour cet event type`);
                        }
                    }
                } else {
                    console.warn('Format de réponse inattendu pour /event-types');
                }
            } else {
                const errorText = await response.text();
                console.warn('Impossible de vérifier les event types');
                console.warn('Status:', response.status, response.statusText);
                console.warn('Erreur:', errorText);
            }
        } catch (error) {
            console.warn('Erreur lors de la vérification des event types:', error);
        }
    }

    // NOUVEAU : Vérification avancée des crédits avec lock
    async canUseCredit(bookingData) {
        console.log('🔍 Vérification crédit avancée:', bookingData);
        
        const user = window.authManager?.getCurrentUser();
        if (!user || !window.packagesManager) {
            console.log('❌ Pas d\'utilisateur ou packagesManager');
            return false;
        }
        
        if (bookingData.packageQuantity && bookingData.packageQuantity > 1) {
            console.log('❌ PackageQuantity > 1');
            return false;
        }
        
        if (bookingData.courseType === 'essai') {
            console.log('❌ Cours d\'essai');
            return false;
        }
        
        try {
            const duration = bookingData.duration || 60;
            
            // Vérifier s'il y a un verrou pour cette réservation
            const lockKey = `credit_check_${user.id}_${bookingData.courseType}_${duration}_${bookingData.startTime}`;
            if (this.bookingLocks.has(lockKey)) {
                console.log('⏳ Vérification crédit déjà en cours pour cette réservation');
                return false;
            }
            
            this.bookingLocks.set(lockKey, true);
            
            try {
                const hasCredits = await window.packagesManager.hasCreditForDuration(user.id, bookingData.courseType, duration);
                console.log(`🔍 Crédits disponibles pour ${bookingData.courseType} (${duration}min):`, hasCredits);
                return hasCredits;
            } finally {
                this.bookingLocks.delete(lockKey);
            }
        } catch (error) {
            console.warn('Erreur vérification crédits:', error);
            return false;
        }
    }

    // NOUVEAU : Méthode sécurisée pour la réservation avec crédit
    async createBookingWithCredit(bookingData) {
        const transactionId = `credit_trx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const lockKey = `credit_booking_${transactionId}`;
        
        // Vérifier si cette transaction est déjà en cours
        if (this.bookingLocks.has(lockKey)) {
            throw new Error('Transaction de crédit déjà en cours');
        }
        
        this.bookingLocks.set(lockKey, transactionId);
        
        try {
            console.log('🎫 Début création réservation AVEC CRÉDIT - Transaction:', transactionId);
            
            const user = window.authManager?.getCurrentUser();
            if (!user) {
                throw new Error('Utilisateur non connecté');
            }
            
            console.log('👤 Utilisateur:', user.email);
            
            const duration = bookingData.duration || 60;
            
            // 1. Vérifier si le crédit existe pour cette durée
            if (window.packagesManager) {
                const hasCredit = await window.packagesManager.hasCreditForDuration(user.id, bookingData.courseType, duration);
                if (!hasCredit) {
                    throw new Error(`Vous n'avez pas de crédit disponible pour un cours de ${duration} minutes.`);
                }
            }
            
            // 2. Créer d'abord la réservation dans Supabase avec statut "pending_credit"
            console.log('💾 Création réservation Supabase...');
            const tempBookingId = `temp_${Date.now()}`;
            
            // Préparer les données pour la réservation
            const bookingForCalcom = {
                startTime: bookingData.startTime,
                endTime: bookingData.endTime || this.calculateEndTime(bookingData.startTime, bookingData.courseType, bookingData.duration),
                eventType: bookingData.courseType,
                courseType: bookingData.courseType,
                duration: duration,
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
                transactionId: transactionId,
                status: 'pending_credit',
                isCreditBooking: true,
                tempId: tempBookingId
            };
            
            console.log('📤 Données pour réservation crédit:', bookingForCalcom);
            
            // 3. Utiliser un crédit AVEC la transaction ID
            console.log('💰 Utilisation d\'un crédit...');
            const creditResult = await window.packagesManager.useCredit(
                user.id,
                bookingData.courseType,
                { 
                    id: tempBookingId,
                    duration: duration 
                },
                transactionId  // Passer l'ID de transaction
            );
            
            console.log('📦 Résultat utilisation crédit:', creditResult);
            
            if (!creditResult.success) {
                throw new Error(`Impossible d'utiliser un crédit: ${creditResult.error}`);
            }
            
            console.log('✅ Crédit utilisé, package_id:', creditResult.package_id);
            
            // 4. Créer la réservation sur Cal.com et dans Supabase
            const bookingResult = await this.createBookingAfterPayment(bookingForCalcom);
            
            console.log('📥 Résultat création réservation:', bookingResult);
            
            if (!bookingResult.success) {
                console.error('❌ Échec création réservation après utilisation crédit');
                
                // Tenter de rembourser le crédit
                try {
                    await window.packagesManager.refundCredit(
                        creditResult.package_id,
                        user.id,
                        transactionId
                    );
                } catch (refundError) {
                    console.error('❌ Erreur lors du remboursement du crédit:', refundError);
                }
                
                throw new Error(`Échec création réservation: ${bookingResult.error}`);
            }
            
            // 5. Mettre à jour la réservation avec les infos finales
            const finalBookingData = {
                ...bookingForCalcom,
                calcomId: bookingResult.data?.id || bookingResult.data?.uid,
                meetingLink: bookingResult.data?.location,
                bookingNumber: `BK-CREDIT-${Date.now().toString().slice(-8)}`,
                confirmedAt: new Date().toISOString(),
                supabaseBookingId: bookingResult.supabaseBookingId,
                packageId: creditResult.package_id,
                status: 'confirmed'
            };
            
            // 6. Mettre à jour la réservation dans Supabase
            try {
                if (window.supabase && bookingResult.supabaseBookingId) {
                    await supabase
                        .from('bookings')
                        .update({
                            status: 'confirmed',
                            booking_number: finalBookingData.bookingNumber,
                            package_id: creditResult.package_id
                        })
                        .eq('id', bookingResult.supabaseBookingId);
                }
            } catch (updateError) {
                console.warn('⚠️ Impossible de mettre à jour la réservation:', updateError);
            }
            
            console.log('✅ Réservation avec crédit créée avec succès - Transaction:', transactionId);
            
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
                error: error.message,
                transactionId: transactionId
            };
        } finally {
            this.bookingLocks.delete(lockKey);
        }
    }

    async createBooking(bookingData) {
        // Vérifier si une réservation similaire est déjà en cours
        const bookingKey = `${bookingData.courseType}_${bookingData.startTime}_${bookingData.duration || 60}`;
        if (this.bookingLocks.has(bookingKey)) {
            throw new Error('Une réservation est déjà en cours pour ce créneau');
        }
        
        this.bookingLocks.set(bookingKey, true);
        
        try {
            const user = window.authManager?.getCurrentUser();
            if (!bookingData) {
                throw new Error('Données de réservation manquantes');
            }
            
            console.group('🎯 DÉBUT createBooking');
            console.log('Données reçues:', bookingData);
            console.log('Utilisateur:', user?.email);
            console.groupEnd();
            
            // VÉRIFIER SI ON PEUT UTILISER UN CRÉDIT
            console.log('🔍 Vérification crédit...');
            const canUseCredit = await this.canUseCredit(bookingData);
            console.log('✅ Peut utiliser crédit?', canUseCredit);
            
            if (canUseCredit) {
                // FLUX CRÉDIT
                console.log('🚀 Début du flux crédit...');
                const creditResult = await this.createBookingWithCredit(bookingData);
                
                if (creditResult.success) {
                    console.log('✅ Flux crédit réussi');
                    return creditResult;
                } else {
                    console.warn('⚠️ Échec du flux crédit, tentative paiement normal:', creditResult.error);
                    // Continuer avec le flux paiement normal
                }
            }
            
            // FLUX PAIEMENT NORMAL
            console.log('💰 Début de la préparation du paiement');
            
            // FORCER l'initialisation de currencyManager
            let currencyManagerReady = false;
            if (window.currencyManager) {
                try {
                    if (!window.currencyManager.currentCurrency || 
                        !window.currencyManager.exchangeRates || 
                        Object.keys(window.currencyManager.exchangeRates).length === 0) {
                        await window.currencyManager.init();
                    }
                    currencyManagerReady = true;
                } catch (error) {
                    console.error('❌ Impossible d\'initialiser CurrencyManager:', error);
                }
            }
            
            const requiredFields = ['startTime', 'courseType'];
            for (const field of requiredFields) {
                if (!bookingData[field]) {
                    throw new Error(`Champ requis manquant: ${field}`);
                }
            }
            
            console.group('💰 Calcul prix réservation');
            console.log('Type de cours:', bookingData.courseType);
            console.log('Durée:', bookingData.duration);
            console.log('Quantité:', bookingData.packageQuantity || 1);
            
            const currentCurrency = window.currencyManager?.currentCurrency || 'EUR';
            
            let finalPrice = 0;
            let priceEUR = 0;
            let unitPriceEUR = 0;
            
            const isVIP = window.authManager?.isUserVip();
            const duration = bookingData.duration || 60;
            const quantity = bookingData.packageQuantity || 1;
            const isPackage = quantity > 1;
            let vipPriceData = null;
            let useVipPrice = isVIP;
            
            console.log('Statut VIP:', isVIP);
            console.log('Est un package:', isPackage);
            console.log('Quantité de cours:', quantity);
            
            // COURS D'ESSAI - Toujours 5€
            if (bookingData.courseType === 'essai') {
                console.log('🎫 Cours d\'essai détecté');
                priceEUR = 5;
                unitPriceEUR = 5;
                finalPrice = currencyManagerReady ? 
                    window.currencyManager.convert(5, 'EUR', currentCurrency) : 5;
                
                console.log(`Prix essai: ${priceEUR}€ → ${finalPrice} ${currentCurrency}`);
            }
            // COURS PAYANTS
            else {
                // PRIX VIP
                if (isVIP) {
                    console.log('👑 Recherche prix VIP...');
                    
                    try {
                        vipPriceData = await window.authManager.getVipPrice(
                            bookingData.courseType, 
                            duration
                        );
                        
                        if (vipPriceData && typeof vipPriceData.price === 'number' && !isNaN(vipPriceData.price)) {
                            console.log('✅ Prix VIP trouvé:', vipPriceData);
                            
                            const vipCurrency = vipPriceData.currency || 'USD';
                            const vipUnitPrice = vipPriceData.price;
                            
                            console.log(`💰 Prix unitaire VIP: ${vipUnitPrice} ${vipCurrency}`);
                            
                            let totalVipPrice = vipUnitPrice * quantity;
                            
                            if (isPackage && bookingData.discountPercent) {
                                const discount = parseFloat(bookingData.discountPercent) || 0;
                                if (discount > 0) {
                                    totalVipPrice = totalVipPrice * (1 - discount / 100);
                                    console.log(`🎁 Réduction ${discount}% appliquée: ${totalVipPrice} ${vipCurrency}`);
                                }
                            }
                            
                            console.log(`📦 Total VIP (${quantity} cours): ${totalVipPrice} ${vipCurrency}`);
                            
                            const originalCurrency = vipCurrency;
                            const originalPrice = totalVipPrice;
                            
                            if (currencyManagerReady) {
                                if (originalCurrency === currentCurrency) {
                                    finalPrice = totalVipPrice;
                                    console.log(`💳 Même devise: ${finalPrice} ${currentCurrency}`);
                                } else {
                                    finalPrice = window.currencyManager.convert(totalVipPrice, originalCurrency, currentCurrency);
                                    console.log(`💳 Conversion: ${totalVipPrice} ${originalCurrency} → ${finalPrice} ${currentCurrency}`);
                                }
                            } else {
                                finalPrice = totalVipPrice;
                            }
                            
                            priceEUR = null;
                            unitPriceEUR = 0;
                            
                        } else {
                            console.log('⚠️ Prix VIP invalide, utilisation prix normal');
                            useVipPrice = false;
                        }
                    } catch (error) {
                        console.error('❌ Erreur prix VIP:', error);
                        useVipPrice = false;
                    }
                }
                
                // PRIX NORMAL ou fallback si VIP échoue
                if (!isVIP || !useVipPrice) {
                    console.log('👤 Utilisation prix normal');
                    
                    unitPriceEUR = 0;
                    
                    if (window.packagesManager) {
                        unitPriceEUR = window.packagesManager.calculatePrice(
                            bookingData.courseType, 
                            1,
                            duration
                        );
                    } else {
                        unitPriceEUR = this.getDefaultPrice(bookingData.courseType, duration);
                    }
                    
                    if (typeof unitPriceEUR !== 'number' || isNaN(unitPriceEUR) || unitPriceEUR <= 0) {
                        console.error('❌ Prix unitaire invalide:', unitPriceEUR);
                        unitPriceEUR = this.getDefaultPrice(bookingData.courseType, duration);
                    }
                    
                    console.log(`💎 Prix unitaire EUR: ${unitPriceEUR}€`);
                    
                    priceEUR = unitPriceEUR * quantity;
                    
                    if (isPackage && bookingData.discountPercent) {
                        const discount = parseFloat(bookingData.discountPercent) || 0;
                        if (discount > 0) {
                            priceEUR = priceEUR * (1 - discount / 100);
                            console.log(`🎁 Réduction ${discount}% appliquée: ${priceEUR}€`);
                        }
                    }
                    
                    if (currencyManagerReady) {
                        finalPrice = window.currencyManager.convert(priceEUR, 'EUR', currentCurrency);
                    } else {
                        finalPrice = priceEUR;
                    }
                    
                    console.log(`📦 Total EUR (${quantity} cours): ${priceEUR}€`);
                    console.log(`💳 Prix final (${currentCurrency}): ${finalPrice}`);
                }
            }
            
            // Validation finale
            if (isNaN(finalPrice) || finalPrice <= 0) {
                console.error('❌ Prix final invalide, reset');
                finalPrice = isVIP && vipPriceData ? vipPriceData.price : priceEUR;
            }
            
            console.log('✅ Prix validés:', { 
                finalPrice: finalPrice + ' ' + currentCurrency,
                currency: currentCurrency,
                isVip: isVIP && useVipPrice,
                vipOriginalPrice: vipPriceData ? `${vipPriceData.price} ${vipPriceData.currency}` : 'N/A',
                quantity: quantity,
                discount: bookingData.discountPercent || 0,
                useVipPrice: useVipPrice
            });
            console.groupEnd();
            
            const completeBookingData = {
                startTime: bookingData.startTime,
                endTime: bookingData.endTime,
                eventType: bookingData.eventType || bookingData.courseType,
                courseType: bookingData.courseType,
                
                price: finalPrice,
                currency: currentCurrency,
                
                priceEUR: isVIP && useVipPrice ? null : priceEUR,
                originalPrice: vipPriceData?.price || unitPriceEUR,
                originalCurrency: vipPriceData?.currency || 'EUR',
                
                duration: duration,
                location: bookingData.location,
                
                name: bookingData.name,
                email: bookingData.email,
                notes: bookingData.notes,
                userId: user?.id || null,
                timeZone: this.timeZone,
                language: 'fr',
                
                isPackage: isPackage,
                packageQuantity: quantity,
                packageCredits: quantity,
                discountPercent: bookingData.discountPercent || 0,
                
                isVip: isVIP && useVipPrice,
                vipPriceData: vipPriceData,
                vipOriginalPrice: vipPriceData?.price || null,
                vipOriginalCurrency: vipPriceData?.currency || null,
                vipTotal: vipPriceData ? vipPriceData.price * quantity * (1 - (bookingData.discountPercent || 0)/100) : null,
                
                createdAt: new Date().toISOString(),
                status: 'pending_payment'
            };
            
            localStorage.setItem('pendingBooking', JSON.stringify(completeBookingData));
            
            return {
                success: true,
                bookingData: completeBookingData,
                redirectTo: `payment.html?booking=${encodeURIComponent(JSON.stringify(completeBookingData))}`,
                message: 'Redirection vers le paiement...'
            };
            
        } catch (error) {
            console.error('❌ Erreur préparation réservation:', error);
            return { 
                success: false, 
                error: `Échec de la préparation : ${error.message}` 
            };
        } finally {
            this.bookingLocks.delete(bookingKey);
        }
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

    formatVipPriceForLog(vipPriceData) {
        if (!vipPriceData || !vipPriceData.price) return 'N/A';
        
        let formatted = `${vipPriceData.price} ${vipPriceData.currency || 'EUR'}`;
        
        if (window.currencyManager) {
            const converted = window.currencyManager.convertVIPPrice(vipPriceData);
            if (converted) {
                formatted += ` → ${converted.display}`;
            }
        }
        
        return formatted;
    }

    calculatePriceWithCurrencyConversion(price, fromCurrency, toCurrency) {
        if (!window.currencyManager) return price;
        
        return window.currencyManager.convert(price, fromCurrency, toCurrency);
    }

    async createBookingAfterPayment(bookingData) {
        try {
            this.checkCalcomConfig();

            const user = window.authManager?.getCurrentUser();
            const eventTypeId = this.eventTypeMap[bookingData.eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${bookingData.eventType}" non configuré`);
            }

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
                    originalPrice: String(bookingData.vipPriceData?.price || bookingData.originalPrice || '0'),
                    originalCurrency: String(bookingData.vipPriceData?.currency || bookingData.originalCurrency || 'EUR'),
                    currency: String(bookingData.currency || 'EUR'),
                    notes: String(bookingData.notes || ''),
                    duration: String(bookingData.duration || ''),
                    isVip: String(bookingData.isVip || 'false'),
                    vipPriceData: bookingData.vipPriceData ? JSON.stringify(bookingData.vipPriceData) : '',
                    quantity: String(bookingData.packageQuantity || '1'),
                    discount: String(bookingData.discountPercent || '0'),
                    isCreditBooking: String(bookingData.isCreditBooking || 'false'),
                    transactionId: String(bookingData.transactionId || '')
                }
            };

            if (bookingData.location) {
                bookingPayload.location = bookingData.location;
                console.log('📍 Location ajoutée:', bookingData.location);
            }

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
                
                try {
                    const errorData = JSON.parse(errorText);
                    
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
            const bookingId = await this.saveBookingToSupabase(data, user, bookingData, bookingData.status || 'confirmed');
            
            return { 
                success: true, 
                data,
                supabaseBookingId: bookingId,
                message: 'Réservation confirmée sur Cal.com' 
            };
            
        } catch (error) {
            console.error('❌ Erreur création réservation après paiement:', error);
            
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                console.warn('⚠️ Mode développement : simulation réservation Cal.com');
                return this.mockBookingAfterPayment(bookingData);
            }
            
            throw new Error(`Échec création réservation : ${error.message}`);
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

    async saveBookingToSupabase(calcomBooking, user, bookingData, status = 'confirmed') {
        try {
            if (!window.supabase) {
                console.warn('Supabase non disponible pour sauvegarde');
                return null;
            }

            const bookingNumber = status === 'pending_credit' 
                ? `BK-PENDING-${Date.now().toString().slice(-8)}`
                : `BK-${Date.now().toString().slice(-8)}`;

            let platformValue = this.getPlatformName(bookingData.location);
            
            const allowedPlatforms = ['meet', 'zoom', 'teams', 'other'];
            if (!allowedPlatforms.includes(platformValue)) {
                console.warn(`⚠️ Platform "${platformValue}" non autorisée, utilisation de "zoom"`);
                platformValue = 'zoom';
            }

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
                payment_reference: bookingData.transactionId || `TRX-${Date.now()}`,
                calcom_booking_id: calcomBooking.id || calcomBooking.uid,
                calcom_uid: calcomBooking.uid,
                meeting_link: calcomBooking.location || calcomBooking.meetingUrl,
                created_at: new Date().toISOString()
            };

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
                    
                    console.log('🔄 Tentative avec platform = NULL...');
                    const bookingRecordWithoutPlatform = { ...bookingRecord };
                    delete bookingRecordWithoutPlatform.platform;
                    
                    const { data: data2, error: error2 } = await supabase
                        .from('bookings')
                        .insert([bookingRecordWithoutPlatform])
                        .select();
                        
                    if (error2) {
                        console.error('❌ Même erreur avec platform = NULL:', error2);
                        
                        console.log('🔄 Tentative avec valeurs minimales...');
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

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }

    convertToUTC(localDateTime) {
        const date = new Date(localDateTime);
        return date.toISOString();
    }
    
    async checkEventTypeDurations(eventTypeId) {
        try {
            console.log(`🔍 Vérification des durées pour event type ID: ${eventTypeId}`);
            
            const queryParams = new URLSearchParams({
                username: this.calcomUsername
            });
            
            const response = await fetch(
                `${this.apiBaseUrl}/event-types?${queryParams}`, 
                {
                    headers: this.getAuthHeaders('event-types')
                }
            );
            
            if (response.ok) {
                const result = await response.json();
                const data = result.data || result;
                const eventTypes = data.eventTypes || [];
                
                const eventType = eventTypes.find(e => e.id == eventTypeId || e.id === parseInt(eventTypeId));
                if (eventType) {
                    console.log(`📋 Event type trouvé: "${eventType.title}"`);
                    console.log(`📏 Durée par défaut: ${eventType.lengthInMinutes || eventType.length} min`);
                    
                    if (eventType.availableLengths && Array.isArray(eventType.availableLengths)) {
                        console.log(`✅ Durées multiples supportées: ${eventType.availableLengths.join(', ')} min`);
                        return {
                            defaultDuration: eventType.lengthInMinutes || eventType.length,
                            availableLengths: eventType.availableLengths.map(l => parseInt(l))
                        };
                    } else {
                        console.log(`ℹ️ Durées multiples non configurées. Durée fixe: ${eventType.lengthInMinutes || eventType.length} min`);
                        return {
                            defaultDuration: eventType.lengthInMinutes || eventType.length,
                            availableLengths: [eventType.lengthInMinutes || eventType.length]
                        };
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.warn('Erreur vérification durées:', error);
            return null;
        }
    }
}

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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM chargé, initialisation BookingManager...');
        initializeBookingManager();
    });
} else {
    console.log('📄 DOM déjà chargé, initialisation BookingManager...');
    initializeBookingManager();
}

window.bookingManager = initializeBookingManager();

console.log('✅ booking.js chargé - Version corrigée avec gestion des crédits sécurisée');