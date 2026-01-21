// booking.js - Gestion des réservations avec Cal.com (API v2) - VERSION FINALE CORRIGÉE
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
        
        console.log('📅 BookingManager initialisé - Version finale corrigée');
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
            // Récupérer la durée, par défaut 60
            const duration = bookingData.duration || 60;
            
            // Utiliser la nouvelle méthode pour vérifier les crédits par durée
            const hasCredits = await window.packagesManager.hasCreditForDuration(user.id, bookingData.courseType, duration);
            console.log(`🔍 Crédits disponibles pour ${bookingData.courseType} (${duration}min):`, hasCredits);
            return hasCredits;
        } catch (error) {
            console.warn('Erreur vérification crédits:', error);
            return false;
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
            
            const duration = bookingData.duration || 60;
            
            // Vérifier d'abord si le crédit existe pour cette durée
            if (window.packagesManager) {
                const hasCredit = await window.packagesManager.hasCreditForDuration(user.id, bookingData.courseType, duration);
                if (!hasCredit) {
                    throw new Error(`Vous n'avez pas de crédit disponible pour un cours de ${duration} minutes. Veuillez choisir une durée correspondant à vos forfaits.`);
                }
            }
            
            // CRÉER D'ABORD LA RÉSERVATION DANS SUPABASE AVANT D'UTILISER LE CRÉDIT
            console.log('📝 Création de la réservation temporaire dans Supabase...');
            
            // Générer un ID de réservation temporaire mais valide
            const tempBookingId = crypto.randomUUID ? crypto.randomUUID() : `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Insérer d'abord la réservation dans Supabase avec un statut 'pending_credit'
            const tempBookingRecord = {
                id: tempBookingId,
                user_id: user.id,
                course_type: bookingData.courseType,
                duration_minutes: duration,
                start_time: bookingData.startTime,
                end_time: bookingData.endTime || this.calculateEndTime(bookingData.startTime, bookingData.courseType, bookingData.duration),
                status: 'pending_credit',
                booking_number: `BK-TEMP-${Date.now().toString().slice(-6)}`,
                created_at: new Date().toISOString()
            };
            
            // 1. Créer d'abord l'enregistrement de réservation
            const { error: insertError } = await supabase
                .from('bookings')
                .insert([tempBookingRecord]);
                
            if (insertError) {
                console.error('❌ Erreur création réservation temporaire:', insertError);
                throw new Error(`Impossible de créer la réservation: ${insertError.message}`);
            }
            
            console.log('✅ Réservation temporaire créée avec ID:', tempBookingId);
            
            // 2. Utiliser un crédit avec le VRAI ID de réservation
            console.log('💰 Utilisation d\'un crédit...');
            const creditResult = await window.packagesManager.useCredit(
                user.id,
                bookingData.courseType,
                { 
                    id: tempBookingId, // Utiliser l'ID réel maintenant
                    duration: duration 
                }
            );
            
            console.log('📦 Résultat utilisation crédit:', creditResult);
            
            if (!creditResult.success) {
                // Nettoyer la réservation temporaire en cas d'échec
                await supabase
                    .from('bookings')
                    .delete()
                    .eq('id', tempBookingId);
                    
                throw new Error(`Impossible d'utiliser un crédit: ${creditResult.error}`);
            }
            
            console.log('✅ Crédit utilisé, package_id:', creditResult.package_id);
            
            // 3. Préparer les données pour la réservation Cal.com
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
                
                // Informations spécifiques crédit
                price: 0,
                currency: null,
                paymentMethod: 'credit',
                transactionId: `CREDIT-${Date.now()}`,
                packageId: creditResult.package_id,
                status: 'confirmed',
                isCreditBooking: true
            };
            
            console.log('📤 Données pour Cal.com:', bookingForCalcom);
            
            // 4. Créer la réservation sur Cal.com
            const bookingResult = await this.createBookingAfterPayment(bookingForCalcom);
            
            console.log('📥 Résultat création réservation:', bookingResult);
            
            if (!bookingResult.success) {
                console.error('❌ Échec création réservation après utilisation crédit');
                
                // Rembourser le crédit si la réservation Cal.com échoue
                try {
                    await this.refundCredit(user.id, creditResult.package_id, tempBookingId);
                } catch (refundError) {
                    console.error('❌ Impossible de rembourser le crédit:', refundError);
                }
                
                throw new Error(`Échec création réservation: ${bookingResult.error}`);
            }
            
            // 5. Mettre à jour la réservation dans Supabase avec les infos Cal.com
            const updatedBookingData = {
                calcom_booking_id: bookingResult.data?.id || bookingResult.data?.uid,
                calcom_uid: bookingResult.data?.uid,
                meeting_link: bookingResult.data?.location || bookingForCalcom.location,
                status: 'confirmed',
                booking_number: `BK-CREDIT-${Date.now().toString().slice(-8)}`,
                payment_method: 'credit',
                payment_reference: bookingForCalcom.transactionId,
                package_id: creditResult.package_id,
                updated_at: new Date().toISOString()
            };
            
            await supabase
                .from('bookings')
                .update(updatedBookingData)
                .eq('id', tempBookingId);
            
            // 6. Préparer les données pour la page de succès
            const finalBookingData = {
                ...bookingForCalcom,
                calcomId: bookingResult.data?.id || bookingResult.data?.uid,
                meetingLink: bookingResult.data?.location,
                bookingNumber: updatedBookingData.booking_number,
                confirmedAt: new Date().toISOString(),
                supabaseBookingId: tempBookingId
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

    // AJOUTER CETTE MÉTHODE POUR REMBOURSER LES CRÉDITS
    async refundCredit(userId, packageId, bookingId) {
        try {
            console.log('💰 Tentative de remboursement de crédit...');
            
            // Récupérer le package
            const { data: packageData, error: packageError } = await supabase
                .from('packages')
                .select('remaining_credits')
                .eq('id', packageId)
                .single();

            if (!packageError && packageData) {
                const newRemainingCredits = (packageData.remaining_credits || 0) + 1;
                
                await supabase
                    .from('packages')
                    .update({
                        remaining_credits: newRemainingCredits,
                        status: newRemainingCredits > 0 ? 'active' : 'depleted'
                    })
                    .eq('id', packageId);

                // Créer une transaction de remboursement
                await supabase
                    .from('credit_transactions')
                    .insert({
                        user_id: userId,
                        package_id: packageId,
                        booking_id: bookingId,
                        credits_before: packageData.remaining_credits || 0,
                        credits_change: 1,
                        credits_after: newRemainingCredits,
                        transaction_type: 'refund',
                        reason: `Échec réservation avec ID: ${bookingId}`,
                        created_at: new Date().toISOString()
                    });

                console.log('✅ Crédit remboursé avec succès');
            }
        } catch (creditError) {
            console.error('❌ Erreur lors du remboursement du crédit:', creditError);
            throw creditError;
        }
    }

    async createBooking(bookingData) {
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
                // FLUX CRÉDIT - CORRECTION: Appeler correctement la méthode
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
            
            // FLUX PAIEMENT NORMAL (existant)
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
                console.log('🎫 Cours d'essai détecté');
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
                            
                            // CORRECTION CRITIQUE: Utiliser le prix VIP pour le forfait
                            let totalVipPrice = vipUnitPrice * quantity;
                            
                            // Appliquer la réduction DANS LA DEVISE VIP (si forfait)
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
                            
                            // Calculer le prix final DANS LA DEVISE COURANTE
                            if (currencyManagerReady) {
                                if (originalCurrency === currentCurrency) {
                                    finalPrice = totalVipPrice;
                                    console.log(`💳 Même devise: ${finalPrice} ${currentCurrency}`);
                                } else {
                                    // Convertir de la devise VIP vers la devise courante
                                    finalPrice = window.currencyManager.convert(totalVipPrice, originalCurrency, currentCurrency);
                                    console.log(`💳 Conversion: ${totalVipPrice} ${originalCurrency} → ${finalPrice} ${currentCurrency}`);
                                }
                            } else {
                                finalPrice = totalVipPrice;
                            }
                            
                            priceEUR = null;
                            unitPriceEUR = 0;
                            
                            // Stocker les données VIP pour référence
                            vipPriceData = {
                                ...vipPriceData,
                                unitPrice: vipUnitPrice,
                                totalPrice: totalVipPrice
                            };
                            
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
                    
                    // Total en EUR
                    priceEUR = unitPriceEUR * quantity;
                    
                    // Appliquer la réduction si forfait
                    if (isPackage && bookingData.discountPercent) {
                        const discount = parseFloat(bookingData.discountPercent) || 0;
                        if (discount > 0) {
                            priceEUR = priceEUR * (1 - discount / 100);
                            console.log(`🎁 Réduction ${discount}% appliquée: ${priceEUR}€`);
                        }
                    }
                    
                    // Conversion vers devise courante
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
                
                // Stocker les informations de prix
                price: finalPrice, // Prix final dans la devise courante
                currency: currentCurrency, // Devise courante
                
                // Pour référence
                priceEUR: isVIP && useVipPrice ? null : priceEUR, // Prix en EUR seulement pour non-VIP
                originalPrice: vipPriceData?.price || unitPriceEUR,
                originalCurrency: vipPriceData?.currency || 'EUR', // Devise d'origine
                
                duration: duration,
                location: bookingData.location,
                
                name: bookingData.name,
                email: bookingData.email,
                notes: bookingData.notes,
                userId: user?.id || null,
                timeZone: this.timeZone,
                language: 'fr',
                
                // Informations package
                isPackage: isPackage,
                packageQuantity: quantity,
                packageCredits: quantity,
                discountPercent: bookingData.discountPercent || 0,
                
                // Informations VIP
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
                    originalPrice: String(bookingData.vipPriceData?.price || bookingData.originalPrice || '0'),
                    originalCurrency: String(bookingData.vipPriceData?.currency || bookingData.originalCurrency || 'EUR'),
                    currency: String(bookingData.currency || 'EUR'),
                    notes: String(bookingData.notes || ''),
                    duration: String(bookingData.duration || ''),
                    isVip: String(bookingData.isVip || 'false'),
                    vipPriceData: bookingData.vipPriceData ? JSON.stringify(bookingData.vipPriceData) : '',
                    quantity: String(bookingData.packageQuantity || '1'),
                    discount: String(bookingData.discountPercent || '0'),
                    isCreditBooking: String(bookingData.isCreditBooking || 'false')
                }
            };

            // Ajouter la location (moyen de communication)
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
            
            // Si c'est une réservation avec crédit, ne pas réinsérer dans Supabase (déjà fait)
            if (bookingData.isCreditBooking && bookingData.supabaseBookingId) {
                console.log('✅ Réservation avec crédit, pas de réinsertion dans Supabase nécessaire');
                return { 
                    success: true, 
                    data,
                    supabaseBookingId: bookingData.supabaseBookingId,
                    message: 'Réservation confirmée sur Cal.com' 
                };
            }
            
            // Sauvegarder dans Supabase AVEC LA STRUCTURE CORRIGÉE POUR VOTRE SCHÉMA
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

            // Générer un numéro de réservation
            const bookingNumber = `BK-${Date.now().toString().slice(-8)}`;

            // CORRECTION : Utiliser les valeurs autorisées par la contrainte CHECK avec nettoyage
            let platformValue = this.getPlatformName(bookingData.location);
            
            // Vérifier si c'est une valeur autorisée
            const allowedPlatforms = ['meet', 'zoom', 'teams', 'other'];
            if (!allowedPlatforms.includes(platformValue)) {
                console.warn(`⚠️ Platform "${platformValue}" non autorisée, utilisation de "zoom"`);
                platformValue = 'zoom';
            }

            // STRUCTURE EXACTE selon votre table 'bookings' - CORRIGÉE
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
                        
                        // Tentative 3: Essayer avec des valeurs minimales obligatoires seulement
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
        
        // Nettoyer la chaîne
        const cleanLocation = String(location).trim().toLowerCase();
        
        // Vérifier les patterns connus
        if (cleanLocation.includes('google') || cleanLocation.includes('meet')) {
            return 'meet';
        }
        if (cleanLocation.includes('teams') || cleanLocation.includes('microsoft')) {
            return 'teams';
        }
        if (cleanLocation.includes('zoom')) {
            return 'zoom';
        }
        
        // Vérifier les valeurs intégrations de Cal.com
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

    // NOUVELLE MÉTHODE : Vérification sécurisée pour éviter la double réservation
    async checkExistingBooking(userId, startTime, courseType) {
        try {
            if (!window.supabase || !userId) {
                console.warn('Supabase non disponible pour vérification');
                return false;
            }

            // Vérifier si une réservation existe déjà pour cet utilisateur à cette heure
            const { data, error } = await supabase
                .from('bookings')
                .select('id, status')
                .eq('user_id', userId)
                .eq('course_type', courseType)
                .eq('start_time', startTime)
                .in('status', ['pending', 'pending_payment', 'confirmed'])
                .limit(1);

            if (error) {
                console.warn('Erreur vérification réservation existante:', error);
                return false;
            }

            const hasExistingBooking = data && data.length > 0;
            
            if (hasExistingBooking) {
                console.warn(`⚠️ Réservation existante trouvée: ${data[0].id} (statut: ${data[0].status})`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Erreur vérification réservation existante:', error);
            return false;
        }
    }

    // NOUVELLE MÉTHODE : Annulation sécurisée d'une réservation
    async cancelBooking(bookingId, userId) {
        try {
            if (!window.supabase || !bookingId || !userId) {
                throw new Error('Paramètres manquants pour l\'annulation');
            }

            // Vérifier que l'utilisateur est bien propriétaire de la réservation
            const { data: booking, error: fetchError } = await supabase
                .from('bookings')
                .select('*')
                .eq('id', bookingId)
                .eq('user_id', userId)
                .single();

            if (fetchError || !booking) {
                throw new Error('Réservation non trouvée ou non autorisée');
            }

            // Vérifier que la réservation peut être annulée
            const startTime = new Date(booking.start_time);
            const now = new Date();
            const hoursUntilStart = (startTime - now) / (1000 * 60 * 60);

            if (hoursUntilStart < 24) {
                throw new Error('Les réservations doivent être annulées au moins 24 heures à l\'avance');
            }

            // Mettre à jour le statut de la réservation
            const { error: updateError } = await supabase
                .from('bookings')
                .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString()
                })
                .eq('id', bookingId);

            if (updateError) {
                throw new Error(`Erreur lors de l'annulation: ${updateError.message}`);
            }

            // Rembourser un crédit si la réservation utilisait un crédit
            if (booking.package_id && booking.payment_method === 'credit') {
                console.log('💰 Tentative de remboursement du crédit...');
                try {
                    // Récupérer le package
                    const { data: packageData, error: packageError } = await supabase
                        .from('packages')
                        .select('remaining_credits')
                        .eq('id', booking.package_id)
                        .single();

                    if (!packageError && packageData) {
                        const newRemainingCredits = (packageData.remaining_credits || 0) + 1;
                        
                        await supabase
                            .from('packages')
                            .update({
                                remaining_credits: newRemainingCredits,
                                status: newRemainingCredits > 0 ? 'active' : 'depleted'
                            })
                            .eq('id', booking.package_id);

                        // Créer une transaction de crédit pour le remboursement
                        await supabase
                            .from('credit_transactions')
                            .insert({
                                user_id: userId,
                                package_id: booking.package_id,
                                booking_id: bookingId,
                                credits_before: packageData.remaining_credits || 0,
                                credits_change: 1,
                                credits_after: newRemainingCredits,
                                transaction_type: 'refund',
                                reason: `Annulation de réservation ${booking.booking_number}`,
                                created_at: new Date().toISOString()
                            });

                        console.log('✅ Crédit remboursé avec succès');
                    }
                } catch (creditError) {
                    console.warn('⚠️ Erreur lors du remboursement du crédit:', creditError);
                    // Ne pas bloquer l'annulation si le remboursement échoue
                }
            }

            // Annuler la réservation sur Cal.com si possible
            if (booking.calcom_booking_id && this.calcomApiKey) {
                console.log('📅 Tentative d\'annulation sur Cal.com...');
                try {
                    const response = await fetch(
                        `${this.apiBaseUrl}/bookings/${booking.calcom_booking_id}`,
                        {
                            method: 'DELETE',
                            headers: this.getAuthHeaders('bookings')
                        }
                    );

                    if (response.ok) {
                        console.log('✅ Réservation annulée sur Cal.com');
                    } else {
                        console.warn('⚠️ Impossible d\'annuler sur Cal.com, réservation annulée localement');
                    }
                } catch (calcomError) {
                    console.warn('⚠️ Erreur lors de l\'annulation Cal.com:', calcomError);
                }
            }

            return {
                success: true,
                message: 'Réservation annulée avec succès',
                bookingId: bookingId
            };

        } catch (error) {
            console.error('❌ Erreur annulation réservation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // NOUVELLE MÉTHODE : Vérification des créneaux VIP
    async getVipSlots(eventType = 'conversation', date = null, duration = null) {
        try {
            const user = window.authManager?.getCurrentUser();
            if (!user || !window.authManager?.isUserVip()) {
                console.log('👤 Utilisateur non VIP, utilisation des créneaux normaux');
                return await this.getAvailableSlots(eventType, date, duration);
            }

            console.log('👑 Recherche créneaux VIP pour:', eventType);
            
            // Pour les VIP, nous pouvons ajouter des créneaux supplémentaires ou des heures étendues
            const normalSlots = await this.getAvailableSlots(eventType, date, duration);
            
            // Si mode développement, ajouter des créneaux VIP supplémentaires
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                console.log('⚠️ Mode VIP simulation');
                
                const targetDate = date || this.getToday();
                const selectedDuration = duration || this.getDefaultDuration(eventType);
                
                // Ajouter des créneaux VIP supplémentaires (8h-9h et 18h-20h)
                const vipSlots = [];
                
                // Créneaux du matin (8h-9h)
                for (let hour = 8; hour < 9; hour++) {
                    const slotTime = `${targetDate}T${hour.toString().padStart(2, '0')}:00:00Z`;
                    vipSlots.push({
                        id: `vip_morning_${hour}`,
                        start: slotTime,
                        end: this.calculateEndTime(slotTime, eventType, selectedDuration),
                        time: `${hour}:00`,
                        duration: `${selectedDuration} min`,
                        durationInMinutes: selectedDuration,
                        eventTypeId: this.eventTypeMap[eventType],
                        isVipSlot: true
                    });
                }
                
                // Créneaux du soir (18h-20h)
                for (let hour = 18; hour < 20; hour++) {
                    const slotTime = `${targetDate}T${hour.toString().padStart(2, '0')}:00:00Z`;
                    vipSlots.push({
                        id: `vip_evening_${hour}`,
                        start: slotTime,
                        end: this.calculateEndTime(slotTime, eventType, selectedDuration),
                        time: `${hour}:00`,
                        duration: `${selectedDuration} min`,
                        durationInMinutes: selectedDuration,
                        eventTypeId: this.eventTypeMap[eventType],
                        isVipSlot: true
                    });
                }
                
                return [...normalSlots, ...vipSlots];
            }
            
            return normalSlots;
            
        } catch (error) {
            console.error('❌ Erreur récupération créneaux VIP:', error);
            return await this.getAvailableSlots(eventType, date, duration);
        }
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

console.log('✅ booking.js chargé - Version finale corrigée avec gestion VIP améliorée');