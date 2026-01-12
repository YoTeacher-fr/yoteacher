// booking.js - Gestion des réservations avec Cal.com (API v2) - VERSION CORRIGÉE POUR VOTRE SCHÉMA
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
        
        // Durées disponibles pour chaque type de cours (en minutes)
        this.durationOptions = {
            'essai': [15],
            'conversation': [30, 45, 60],
            'curriculum': [30, 45, 60],
            'examen': [30, 45, 60]
        };
        
        this.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Rate limits: API Key = 120 req/min
        this.rateLimitInfo = {
            limit: 120,
            remaining: 120,
            reset: null
        };
        
        console.log('📅 BookingManager initialisé - Version corrigée pour votre schéma');
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
            console.log('📅 Structure data.data:', data.data);
            
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
                        
                        // CORRECTION: Utiliser la durée passée en paramètre ou la durée par défaut
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
                        
                        // Vérifier si l'event type supporte des durées multiples
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

    async createBooking(bookingData) {
        try {
            const user = window.authManager?.getCurrentUser();
            if (!bookingData) {
                throw new Error('Données de réservation manquantes');
            }
            
            const requiredFields = ['startTime', 'courseType'];
            for (const field of requiredFields) {
                if (!bookingData[field]) {
                    throw new Error(`Champ requis manquant: ${field}`);
                }
            }
            
            console.group('💰 Calcul prix réservation - LOGIQUE VIP CORRIGÉE POUR TOUS LES CAS');
            console.log('Type de cours:', bookingData.courseType);
            console.log('Durée:', bookingData.duration);
            console.log('Quantité:', bookingData.packageQuantity || 1);
            
            const currentCurrency = window.currencyManager?.currentCurrency || 'EUR';
            
            let finalPrice = 0;
            let priceEUR = 0;
            let unitPriceEUR = 0; // CORRECTION: Déclaré ici pour être accessible dans toute la fonction
            
            const isVIP = window.authManager?.isUserVip();
            const duration = bookingData.duration || 60;
            const quantity = bookingData.packageQuantity || 1;
            const isPackage = quantity > 1;
            let vipPriceData = null;
            let useVipPrice = isVIP;
            
            console.log('Statut VIP:', isVIP);
            console.log('Est un package:', isPackage);
            console.log('Quantité de cours:', quantity);
            
            // Vérifier que les taux de change sont chargés
            if (window.currencyManager && 
                (!window.currencyManager.exchangeRates || 
                 Object.keys(window.currencyManager.exchangeRates).length === 0)) {
                console.log('💱 Chargement des taux de change...');
                await window.currencyManager.loadExchangeRates();
            }
            
            // COURS D'ESSAI - Toujours 5€
            if (bookingData.courseType === 'essai') {
                console.log('🎫 Cours d\'essai détecté');
                priceEUR = 5;
                unitPriceEUR = 5; // CORRECTION: Défini pour cours d'essai
                finalPrice = window.currencyManager ? 
                    window.currencyManager.convert(5, 'EUR', currentCurrency) : 5;
                
                console.log(`Prix essai: ${priceEUR}€ → ${finalPrice} ${currentCurrency}`);
            }
            // COURS PAYANTS
            else {
                // PRIX VIP - LOGIQUE CORRECTE POUR TOUS LES CAS
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
                            
                            // 1. Calculer le total DANS LA DEVISE VIP
                            let totalVipPrice = vipUnitPrice * quantity;
                            
                            // 2. Appliquer la réduction DANS LA DEVISE VIP (si forfait)
                            if (isPackage && bookingData.discountPercent) {
                                const discount = parseFloat(bookingData.discountPercent) || 0;
                                if (discount > 0) {
                                    totalVipPrice = totalVipPrice * (1 - discount / 100);
                                    console.log(`🎁 Réduction ${discount}% appliquée: ${totalVipPrice} ${vipCurrency}`);
                                }
                            }
                            
                            console.log(`📦 Total VIP (${quantity} cours): ${totalVipPrice} ${vipCurrency}`);
                            
                            // 3. Stocker les informations originales
                            const originalCurrency = vipCurrency;
                            const originalPrice = totalVipPrice;
                            
                            // 4. Calculer le prix final DANS LA DEVISE COURANTE
                            if (window.currencyManager) {
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
                            
                            // 5. NE PAS UTILISER priceEUR pour les VIP (c'est en USD, pas en EUR)
                            priceEUR = null;
                            unitPriceEUR = 0; // CORRECTION: Défini même pour VIP
                            
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
                    
                    // Calcul en EUR d'abord
                    unitPriceEUR = 0; // CORRECTION: Réaffecté ici
                    
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
                    if (window.currencyManager) {
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
                originalPrice: vipPriceData?.price || unitPriceEUR, // CORRECTION: unitPriceEUR est maintenant toujours défini
                originalCurrency: vipPriceData?.currency || 'EUR', // Devise d'origine
                
                duration: duration,
                location: bookingData.location,
                
                name: bookingData.name,
                email: bookingData.email,
                notes: bookingData.notes,
                userId: user?.id || null,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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

    // NOUVELLE MÉTHODE : Obtenir un prix par défaut en cas d'échec
    getDefaultPrice(courseType, duration = 60) {
        // Prix par défaut si tout échoue
        const basePrices = {
            'essai': 5,
            'conversation': 20,
            'curriculum': 35,
            'examen': 30
        };
        
        let price = basePrices[courseType] || 20;
        
        // Ajuster selon la durée
        if (courseType !== 'essai') {
            const ratio = duration / 60;
            price = price * ratio;
        }
        
        console.log(`💰 Prix par défaut pour ${courseType} ${duration}min: ${price}€`);
        return price;
    }

    // MÉTHODE : Formater un prix VIP pour les logs
    formatVipPriceForLog(vipPriceData) {
        if (!vipPriceData || !vipPriceData.price) return 'N/A';
        
        let formatted = `${vipPriceData.price} ${vipPriceData.currency || 'EUR'}`;
        
        if (window.currencyManager) {
            // Afficher la conversion en devise courante
            const converted = window.currencyManager.convertVIPPrice(vipPriceData);
            if (converted) {
                formatted += ` → ${converted.display}`;
            }
        }
        
        return formatted;
    }

    // MÉTHODE : Calculer le prix avec conversion de devise
    calculatePriceWithCurrencyConversion(price, fromCurrency, toCurrency) {
        if (!window.currencyManager) return price;
        
        return window.currencyManager.convert(price, fromCurrency, toCurrency);
    }

    // MÉTHODE : Créer la réservation sur Cal.com APRÈS paiement
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
                    discount: String(bookingData.discountPercent || '0')
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

            console.log('📤 Création réservation Cal.com après paiement:', JSON.stringify(bookingPayload, null, 2));

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
            
            // Sauvegarder dans Supabase AVEC LA STRUCTURE CORRIGÉE POUR VOTRE SCHÉMA
            await this.saveBookingToSupabase(data, user, bookingData, 'confirmed');
            
            return { 
                success: true, 
                data,
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

    // Méthode mock pour le développement
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
                resolve({ success: true, data: mockBooking });
            }, 1000);
        });
    }

    // FONCTION CORRIGÉE : Sauvegarder la réservation dans Supabase selon votre schéma
    async saveBookingToSupabase(calcomBooking, user, bookingData, status = 'confirmed') {
        try {
            if (!window.supabase) {
                console.warn('Supabase non disponible pour sauvegarde');
                return null;
            }

            // Générer un numéro de réservation
            const bookingNumber = `BK-${Date.now().toString().slice(-8)}`;

            // DÉBOGAGE DÉTAILLÉ : Vérifier toutes les valeurs
            console.log('🔍 DÉBOGAGE COMPLET - Valeurs à insérer:');
            console.log('- Location reçue:', bookingData.location);
            console.log('- Type de location:', typeof bookingData.location);
            
            // CORRECTION : Utiliser les valeurs autorisées par la contrainte CHECK avec nettoyage
            const platformValue = this.getPlatformName(bookingData.location);
            console.log('- Platform calculée:', platformValue);
            
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
                price_paid: bookingData.price,
                currency: bookingData.currency,
                // CORRECTION : Utiliser les valeurs autorisées par la contrainte CHECK
                platform: platformValue,
                booking_number: bookingNumber,
                payment_method: bookingData.paymentMethod,
                payment_reference: bookingData.transactionId,
                calcom_booking_id: calcomBooking.id || calcomBooking.uid,
                calcom_uid: calcomBooking.uid,
                meeting_link: calcomBooking.location || calcomBooking.meetingUrl,
                created_at: new Date().toISOString()
            };

            // IMPORTANT : Les colonnes suivantes n'existent PAS dans votre schéma et ont été RETIRÉES :
            // - is_vip_booking
            // - original_price
            // - original_currency
            // - package_quantity
            // - discount_percent

            console.log('💾 Insertion dans Supabase bookings (structure corrigée):', JSON.stringify(bookingRecord, null, 2));
            
            // DÉBOGAGE : Vérifier chaque champ individuellement
            console.log('🔍 Vérification des champs critiques:');
            console.log('- platform:', bookingRecord.platform, '(type:', typeof bookingRecord.platform + ')');
            console.log('- status:', bookingRecord.status, '(doit être dans: pending, pending_payment, confirmed, completed, cancelled, lost, refunded)');
            console.log('- currency:', bookingRecord.currency, '(doit être dans: EUR, USD, CAD, GBP)');
            console.log('- payment_method:', bookingRecord.payment_method, '(doit être dans: stripe, revolut, wise, interac, paypal, credit)');
            console.log('- course_type:', bookingRecord.course_type, '(doit être: essai, conversation, curriculum, examen)');

            try {
                const { data, error } = await supabase
                    .from('bookings')
                    .insert([bookingRecord])
                    .select();

                if (error) {
                    console.error('❌ Erreur insertion dans bookings:', error);
                    console.error('❌ Détails de l\'erreur:');
                    console.error('- Code:', error.code);
                    console.error('- Message:', error.message);
                    console.error('- Détails:', error.details);
                    console.error('- Hint:', error.hint);
                    
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
                
                // Si c'est une réservation utilisant un crédit, utiliser le crédit
                if (!bookingData.isPackage && user?.id && window.packagesManager) {
                    const creditResult = await window.packagesManager.useCredit(
                        user.id, 
                        bookingData.courseType, 
                        data[0]
                    );
                    
                    if (creditResult.success) {
                        console.log('✅ Crédit utilisé pour la réservation');
                    }
                }
                
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

    async createBookingEmailNotification(bookingData) {
        try {
            console.log('📧 Création notification email pour réservation...');
            
            // DÉSACTIVER TEMPORAIREMENT - Cal.com envoie déjà les emails
            console.log('📧 Email notification désactivée (Cal.com gère les emails)');
            
        } catch (error) {
            console.warn('Exception création notification email:', error);
        }
    }

    // CORRECTION : Utiliser les valeurs autorisées par la contrainte CHECK avec nettoyage robuste
    getPlatformName(location) {
        if (!location) {
            console.log('⚠️ Location est null/undefined, retourne "zoom"');
            return 'zoom';
        }
        
        // Nettoyer la chaîne
        const cleanLocation = String(location).trim().toLowerCase();
        console.log(`🔍 Analyse location nettoyée: "${cleanLocation}"`);
        
        // Vérifier les patterns connus
        if (cleanLocation.includes('google') || cleanLocation.includes('meet')) {
            console.log('✅ Location identifiée comme Google Meet, retourne "meet"');
            return 'meet';
        }
        if (cleanLocation.includes('teams') || cleanLocation.includes('microsoft')) {
            console.log('✅ Location identifiée comme Microsoft Teams, retourne "teams"');
            return 'teams';
        }
        if (cleanLocation.includes('zoom')) {
            console.log('✅ Location identifiée comme Zoom, retourne "zoom"');
            return 'zoom';
        }
        
        // Vérifier les valeurs intégrations de Cal.com
        if (cleanLocation.includes('integrations:google:meet')) {
            console.log('✅ Location identifiée comme integrations:google:meet, retourne "meet"');
            return 'meet';
        }
        if (cleanLocation.includes('integrations:microsoft:teams')) {
            console.log('✅ Location identifiée comme integrations:microsoft:teams, retourne "teams"');
            return 'teams';
        }
        if (cleanLocation.includes('integrations:zoom')) {
            console.log('✅ Location identifiée comme integrations:zoom, retourne "zoom"');
            return 'zoom';
        }
        
        console.log(`⚠️ Location non reconnue: "${cleanLocation}", retourne "other"`);
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
    
    // MÉTHODE: Vérifier les durées disponibles pour un event type
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

// Fonction globale pour être appelée depuis booking.html
window.loadAvailableSlots = async function() {
    console.log('📅 Chargement des créneaux disponibles...');
    
    // Vérifier si bookingManager est disponible
    if (!window.bookingManager) {
        console.error('❌ BookingManager non disponible');
        
        // Essayer de réinitialiser
        try {
            window.bookingManager = new BookingManager();
            console.log('✅ BookingManager réinitialisé');
        } catch (error) {
            console.error('❌ Impossible d\'initialiser BookingManager:', error);
            return;
        }
    }
    
    try {
        // Récupérer les paramètres depuis l'interface
        const courseType = document.getElementById('courseType')?.value || 'conversation';
        const durationSelect = document.getElementById('durationSelect');
        const selectedDate = document.getElementById('datePicker')?.value;
        
        let duration = null;
        if (durationSelect && durationSelect.value) {
            duration = parseInt(durationSelect.value);
        }
        
        // Charger les créneaux
        const slots = await window.bookingManager.getAvailableSlots(courseType, selectedDate, duration);
        
        // Mettre à jour l'interface
        updateSlotsDisplay(slots);
        
        console.log(`✅ ${slots.length} créneaux chargés`);
    } catch (error) {
        console.error('❌ Erreur lors du chargement des créneaux:', error);
        alert('Erreur lors du chargement des créneaux: ' + error.message);
    }
};

// Fonction pour mettre à jour l'affichage des créneaux
function updateSlotsDisplay(slots) {
    const container = document.getElementById('availableSlots');
    if (!container) return;
    
    if (slots.length === 0) {
        container.innerHTML = '<p class="no-slots">Aucun créneau disponible pour cette date.</p>';
        return;
    }
    
    container.innerHTML = slots.map(slot => `
        <div class="slot-card" data-slot-id="${slot.id}" data-start="${slot.start}">
            <div class="slot-time">${slot.time}</div>
            <div class="slot-duration">${slot.duration}</div>
            <button class="btn-select-slot" onclick="selectSlot('${slot.id}', '${slot.start}', '${slot.duration}')">
                Choisir
            </button>
        </div>
    `).join('');
}

// Fonction pour sélectionner un créneau
window.selectSlot = function(slotId, startTime, duration) {
    console.log('🎯 Créneau sélectionné:', { slotId, startTime, duration });
    
    // Mettre à jour l'interface
    document.querySelectorAll('.slot-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const selectedCard = document.querySelector(`[data-slot-id="${slotId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    // Stocker la sélection
    window.selectedSlot = { slotId, startTime, duration };
    
    // Mettre à jour le récapitulatif
    updateSummaryWithSlot(startTime, duration);
};

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

// TEST DE VERIFICATION DES PRIX VIP
window.testVipPriceCalculation = async function() {
    console.group('🧪 TEST CALCUL PRIX VIP');
    
    // Simuler un forfait 10 cours VIP avec 5% réduction
    const vipPrice = 3; // USD
    const quantity = 10;
    const discount = 5;
    const currentCurrency = window.currencyManager?.currentCurrency || 'EUR';
    
    console.log('📊 Données test:');
    console.log('- Prix unitaire VIP:', vipPrice, 'USD');
    console.log('- Quantité:', quantity, 'cours');
    console.log('- Réduction:', discount, '%');
    console.log('- Devise courante:', currentCurrency);
    
    // Calcul attendu
    const totalVipUSD = vipPrice * quantity * (1 - discount/100);
    console.log('💰 Total attendu en USD:', totalVipUSD.toFixed(2), 'USD');
    
    if (window.currencyManager && currentCurrency !== 'USD') {
        const converted = window.currencyManager.convert(totalVipUSD, 'USD', currentCurrency);
        console.log('💱 Conversion USD →', currentCurrency + ':', converted.toFixed(2));
        
        // Vérifier le taux de change
        const rate = window.currencyManager.exchangeRates['USD'];
        console.log('📈 Taux USD/EUR:', rate);
        console.log('💱 Taux implicite:', converted / totalVipUSD);
    }
    
    console.groupEnd();
};

// TEST VIP COMPLET
window.testVipAllCases = async function() {
    console.group('🧪 TEST COMPLET PRIX VIP - TOUS LES CAS');
    
    // Prix VIP: 3 USD par cours
    const vipPrice = 3;
    const vipCurrency = 'USD';
    
    const testCases = [
        { quantity: 1, discount: 0, expected: 3.00, description: '1 cours - pas de réduction' },
        { quantity: 5, discount: 2, expected: 14.70, description: '5 cours - 2% réduction' },
        { quantity: 10, discount: 5, expected: 28.50, description: '10 cours - 5% réduction' }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n📊 ${testCase.description}`);
        console.log(`📦 Calcul: ${vipPrice}$ × ${testCase.quantity} × (1 - ${testCase.discount}%)`);
        
        const totalVip = vipPrice * testCase.quantity * (1 - testCase.discount/100);
        console.log(`💰 Total VIP: ${totalVip.toFixed(2)} ${vipCurrency}`);
        
        if (Math.abs(totalVip - testCase.expected) > 0.01) {
            console.error(`❌ ERREUR: Attendu ${testCase.expected}$, obtenu ${totalVip.toFixed(2)}$`);
        } else {
            console.log(`✅ CORRECT: ${totalVip.toFixed(2)} ${vipCurrency}`);
        }
        
        // Test avec conversion
        if (window.currencyManager) {
            const currentCurrency = window.currencyManager.currentCurrency;
            if (currentCurrency !== vipCurrency) {
                const converted = window.currencyManager.convert(totalVip, vipCurrency, currentCurrency);
                console.log(`💱 Conversion: ${totalVip.toFixed(2)} ${vipCurrency} → ${converted.toFixed(2)} ${currentCurrency}`);
            }
        }
    }
    
    console.groupEnd();
};

// FONCTION DE DEBUG GLOBALE
window.debugVIPPriceIssue = function() {
    console.group('🔍 DEBUG PRIX VIP');
    
    // 1. Vérifier CurrencyManager
    if (window.currencyManager) {
        console.log('💱 CurrencyManager:');
        console.log('- Devise courante:', window.currencyManager.currentCurrency);
        console.log('- Symbole:', window.currencyManager.getSymbol());
        console.log('- Taux USD:', window.currencyManager.exchangeRates['USD']);
        console.log('- Taux EUR:', window.currencyManager.exchangeRates['EUR']);
    }
    
    // 2. Vérifier AuthManager
    if (window.authManager) {
        console.log('🔐 AuthManager:');
        console.log('- Utilisateur VIP:', window.authManager.isUserVip());
        console.log('- Utilisateur:', window.authManager.user?.email);
        console.log('- Prix VIP chargés:', window.authManager.user?.vipPrices);
    }
    
    // 3. Test de conversion
    console.log('🧪 Test conversion 28.50 USD:');
    const testAmount = 28.50;
    if (window.currencyManager) {
        const converted = window.currencyManager.convert(testAmount, 'USD', window.currencyManager.currentCurrency);
        console.log(`${testAmount} USD → ${converted.toFixed(2)} ${window.currencyManager.currentCurrency}`);
        
        // Taux implicite
        const implicitRate = converted / testAmount;
        console.log(`Taux implicite USD→${window.currencyManager.currentCurrency}:`, implicitRate.toFixed(4));
    }
    
    // 4. Calcul manuel
    console.log('🧮 Calcul manuel:');
    const vipPrice = 3; // USD
    const quantity = 10;
    const discount = 5; // %
    
    const totalUSD = vipPrice * quantity * (1 - discount/100);
    console.log(`3 USD × 10 × (1 - 5%) = ${totalUSD.toFixed(2)} USD`);
    
    if (window.currencyManager) {
        const convertedTotal = window.currencyManager.convert(totalUSD, 'USD', window.currencyManager.currentCurrency);
        console.log(`→ ${convertedTotal.toFixed(2)} ${window.currencyManager.currentCurrency}`);
    }
    
    console.groupEnd();
};

// Initialiser globalement
window.bookingManager = initializeBookingManager();

// Test automatique au chargement
if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
    setTimeout(() => {
        console.log('🧪 Test automatique des calculs de prix VIP');
        window.testVipPriceCalculation();
        window.testVipAllCases();
    }, 3000);
}

console.log('✅ booking.js chargé - Version finale corrigée avec débogage complet');