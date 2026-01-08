// Gestion des réservations avec Cal.com (API v2) et redirection vers paiement
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
            'examen': config.CALCOM_EVENT_TYPE_EXAMEN || '4139076' // NOUVEAU
        };
        
        // Durées disponibles pour chaque type de cours (en minutes)
        this.durationOptions = {
            'essai': [15],
            'conversation': [30, 45, 60],
            'curriculum': [30, 45, 60],
            'examen': [30, 45, 60] // NOUVEAU
        };
        
        this.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Rate limits: API Key = 120 req/min
        this.rateLimitInfo = {
            limit: 120,
            remaining: 120,
            reset: null
        };
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
            case 'examen': return 60; // NOUVEAU
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
            
            // Récupérer la devise actuelle
            const currentCurrency = window.currencyManager?.currentCurrency || 'EUR';
            const priceEUR = bookingData.priceEUR || bookingData.price;
            
            // Convertir le prix si nécessaire
            let finalPrice = bookingData.price;
            if (window.currencyManager && currentCurrency !== 'EUR') {
                finalPrice = window.currencyManager.convert(priceEUR, 'EUR', currentCurrency);
            }
            
            // Préparer les données pour le paiement, SANS créer sur Cal.com
            const completeBookingData = {
                // Informations de réservation
                startTime: bookingData.startTime,
                endTime: bookingData.endTime,
                eventType: bookingData.eventType,
                courseType: bookingData.courseType,
                priceEUR: priceEUR, // Prix en EUR pour référence
                price: finalPrice, // Prix dans la devise actuelle
                duration: bookingData.duration,
                location: bookingData.location, // Ajouter la location
                currency: currentCurrency, // Devise utilisée
                
                // Informations utilisateur
                name: bookingData.name,
                email: bookingData.email,
                notes: bookingData.notes,
                userId: user?.id || null,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: 'fr',
                
                // Métadonnées
                createdAt: new Date().toISOString(),
                status: 'pending_payment' // Statut en attente de paiement
            };
            
            // Sauvegarder dans localStorage
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

    // NOUVELLE MÉTHODE : Créer la réservation sur Cal.com APRÈS paiement
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
                attendees: [{
        name: bookingData.name,
        email: bookingData.email,
        timeZone: bookingData.timeZone || this.timeZone,
        language: bookingData.language || 'fr'
    }],
                metadata: {
                    userId: user?.id ? String(user.id) : "", 
                    courseType: String(bookingData.courseType || ''),
                    price: String(bookingData.priceEUR || bookingData.price || '0'),
                    currency: String(bookingData.currency || 'EUR'),
                    notes: String(bookingData.notes || ''),
                    duration: String(bookingData.duration || '')
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
            
            // Sauvegarder dans Supabase
            await this.saveBookingToSupabase(data, user, 'confirmed');
            
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

    async saveBookingToSupabase(calcomBooking, userId, status = 'confirmed') {
        try {
            if (!window.supabase) {
                console.warn('Supabase non disponible pour sauvegarde');
                return null;
            }

            const bookingData = {
                user_id: userId,
                calcom_id: calcomBooking.id || calcomBooking.uid,
                event_type: calcomBooking.eventType || 'essai',
                start_time: calcomBooking.start || calcomBooking.startTime,
                end_time: calcomBooking.end || calcomBooking.endTime,
                status: status,
                meet_link: calcomBooking.location || calcomBooking.meetingUrl,
                booking_data: calcomBooking,
                created_at: new Date().toISOString()
            };

            console.log('💾 Sauvegarde dans Supabase:', bookingData);

            const { data, error } = await supabase
                .from('bookings')
                .insert([bookingData])
                .select();

            if (error) {
                console.warn('Erreur sauvegarde Supabase:', error);
                return null;
            }
            
            console.log('✅ Réservation sauvegardée dans Supabase avec ID:', data[0].id);
            return data[0].id;
            
        } catch (error) {
            console.error('Exception sauvegarde Supabase:', error);
            return null;
        }
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
    
    // NOUVELLE MÉTHODE: Vérifier les durées disponibles pour un event type
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

window.bookingManager = new BookingManager();

// Fonctions de debug
window.debugCalcomConfig = async function() {
    const config = window.YOTEACHER_CONFIG || {};
    const manager = window.bookingManager;
    
    console.group('🔧 Debug Configuration Cal.com');
    console.log('API Key présente:', !!config.CALCOM_API_KEY);
    console.log('Username configuré:', config.CALCOM_USERNAME);
    console.log('Event Type IDs:', manager.eventTypeMap);
    console.log('Fuseau horaire:', manager.timeZone);
    console.log('URL API:', manager.apiBaseUrl);
    console.log('Rate Limit Info:', manager.rateLimitInfo);
    
    if (config.CALCOM_API_KEY) {
        try {
            const queryParams = new URLSearchParams({
                username: config.CALCOM_USERNAME || manager.calcomUsername
            });
            
            const response = await fetch(
                `${manager.apiBaseUrl}/event-types?${queryParams}`, 
                {
                    headers: manager.getAuthHeaders('event-types')
                }
            );
            
            manager.updateRateLimitInfo(response);
            
            if (response.ok) {
                const result = await response.json();
                const data = result.data || result;
                console.log('✅ Connexion API réussie');
                
                if (data.eventTypes) {
                    console.log('Event types disponibles:', data.eventTypes.length);
                    
                    // Vérifier chaque event type configuré
                    Object.entries(manager.eventTypeMap).forEach(([key, value]) => {
                        if (value) {
                            const found = data.eventTypes.find(e => e.id == value || e.id === parseInt(value));
                            if (found) {
                                console.log(`\n${key} (ID: ${value}):`);
                                console.log(`  Titre: "${found.title}"`);
                                console.log(`  Slug: ${found.slug}`);
                                console.log(`  Durée: ${found.lengthInMinutes || found.length} min`);
                                
                                if (found.availableLengths) {
                                    console.log(`  Durées multiples: ${found.availableLengths.join(', ')} min`);
                                } else {
                                    console.log(`  ℹ️ Durées multiples non configurées`);
                                }
                                
                                // Vérifier les durées demandées
                                const requestedDurations = manager.durationOptions[key] || [60];
                                if (found.availableLengths) {
                                    requestedDurations.forEach(duration => {
                                        const isAvailable = found.availableLengths.some(d => parseInt(d) === duration);
                                        console.log(`  ${duration} min: ${isAvailable ? '✅ Disponible' : '❌ Non disponible'}`);
                                    });
                                }
                            } else {
                                console.log(`${key} (ID: ${value}): ❌ Non trouvé`);
                            }
                        } else {
                            console.log(`${key}: ❌ Non configuré`);
                        }
                    });
                }
            } else {
                const errorText = await response.text();
                console.error('❌ Erreur connexion API:', response.status, response.statusText);
                console.error('Détails:', errorText);
            }
        } catch (error) {
            console.error('❌ Erreur connexion API:', error);
        }
    } else {
        console.error('❌ Aucune clé API configurée');
    }
    
    console.log('\n🧪 Test récupération créneaux:');
    try {
        // Tester différentes durées
        const testDurations = [30, 45, 60];
        for (const duration of testDurations) {
            console.log(`\n📅 Test conversation ${duration}min:`);
            try {
                const slots = await manager.getAvailableSlots('conversation', null, duration);
                console.log(`  Créneaux disponibles: ${slots.length}`);
                if (slots.length > 0) {
                    console.log(`  Exemple: ${manager.formatTime(slots[0].start)} (${slots[0].duration})`);
                }
            } catch (error) {
                console.error(`  ❌ Erreur: ${error.message}`);
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        console.error('❌ Erreur récupération créneaux:', error.message);
    }
    
    console.log('\n📊 Rate Limit Status:', manager.rateLimitInfo);
    console.groupEnd();
};

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        console.log('🔧 BookingManager configuré avec API v2 - Réservation après paiement');
        console.log('Configuration:', {
            hasApiKey: !!window.YOTEACHER_CONFIG?.CALCOM_API_KEY,
            eventTypes: window.bookingManager?.eventTypeMap,
            apiVersion: 'v2',
            baseUrl: window.bookingManager?.apiBaseUrl
        });
        
        // Vérifier la configuration des durées
        if (window.YOTEACHER_CONFIG?.CALCOM_API_KEY) {
            console.log('🔍 Vérification des durées disponibles...');
            
            // Vérifier chaque event type
            Object.entries(window.bookingManager.eventTypeMap).forEach(async ([type, id]) => {
                if (id) {
                    const durations = await window.bookingManager.checkEventTypeDurations(id);
                    if (durations) {
                        console.log(`${type}: Durée par défaut ${durations.defaultDuration}min, disponibles: ${durations.availableLengths.join(', ')}min`);
                    }
                }
            });
        }
        
        if ((window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) && 
            !window.YOTEACHER_CONFIG?.CALCOM_API_KEY) {
            console.warn('⚠️ Mode développement : Aucune clé API Cal.com configurée. Les créneaux seront simulés.');
            
            const devWarning = document.createElement('div');
            devWarning.style.cssText = `
                position: fixed;
                bottom: 70px;
                right: 20px;
                background: #ff9800;
                color: white;
                padding: 10px 15px;
                border-radius: 8px;
                z-index: 9999;
                font-size: 12px;
                max-width: 250px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            devWarning.textContent = 'Mode développement : Créneaux et paiements simulés';
            document.body.appendChild(devWarning);
            
            setTimeout(() => {
                if (devWarning.parentElement) devWarning.remove();
            }, 10000);
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('debug') === 'calcom') {
            window.debugCalcomConfig();
        }
    }, 1000);
});

// Fonctions de test
window.testCalcomSlots = async function(date = null, eventType = 'essai', duration = null) {
    const durationText = duration ? ` (${duration} min)` : '';
    console.log(`🧪 Test Cal.com slots pour ${eventType}${durationText} le ${date || 'aujourd\'hui'}`);
    try {
        const slots = await window.bookingManager.getAvailableSlots(eventType, date, duration);
        console.log(`✅ ${slots.length} créneau(x) trouvé(s):`);
        if (slots.length > 0) {
            slots.slice(0, 5).forEach(slot => {
                console.log(`  • ${window.bookingManager.formatTime(slot.start)} (${slot.duration})`);
            });
            if (slots.length > 5) console.log(`  ... et ${slots.length - 5} autres`);
        }
        return slots;
    } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
        return [];
    }
};

window.checkCalcomHealth = async function() {
    console.log('🏥 Vérification santé API Cal.com...');
    const manager = window.bookingManager;
    
    if (!manager.calcomApiKey) {
        console.error('❌ Pas de clé API configurée');
        return false;
    }
    
    try {
        const queryParams = new URLSearchParams({
            username: manager.calcomUsername
        });
        
        const response = await fetch(
            `${manager.apiBaseUrl}/event-types?${queryParams}`, 
            {
                headers: manager.getAuthHeaders('event-types')
            }
        );
        
        const data = response.ok ? await response.json() : null;
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log('Health:', response.ok ? '✅ API fonctionnelle' : '❌ API non fonctionnelle');
        
        if (data && (data.eventTypes || data.data?.eventTypes)) {
            const eventTypes = data.eventTypes || data.data.eventTypes;
            console.log(`Event types disponibles: ${eventTypes.length}`);
            
            // Vérifier les durées pour chaque event type
            eventTypes.slice(0, 3).forEach(event => {
                console.log(`  • ${event.title}: ${event.lengthInMinutes || event.length} min`);
                if (event.availableLengths) {
                    console.log(`    Durées multiples: ${event.availableLengths.join(', ')} min`);
                }
            });
        }
        
        return response.ok;
    } catch (error) {
        console.error('❌ Erreur santé API:', error.message);
        return false;
    }
};

// NOUVELLE FONCTION: Vérifier la configuration des durées
window.checkDurationConfiguration = async function() {
    console.log('🔧 Vérification de la configuration des durées...');
    
    const manager = window.bookingManager;
    const config = window.YOTEACHER_CONFIG || {};
    
    if (!config.CALCOM_API_KEY) {
        console.error('❌ Aucune clé API configurée');
        return;
    }
    
    try {
        // Vérifier chaque event type configuré
        for (const [eventType, eventTypeId] of Object.entries(manager.eventTypeMap)) {
            if (!eventTypeId) continue;
            
            console.log(`\n📋 ${eventType} (ID: ${eventTypeId}):`);
            
            // Obtenir les informations de l'event type
            const durationsInfo = await manager.checkEventTypeDurations(eventTypeId);
            if (durationsInfo) {
                console.log(`  Durée par défaut: ${durationsInfo.defaultDuration} min`);
                console.log(`  Durées disponibles: ${durationsInfo.availableLengths.join(', ')} min`);
                
                // Vérifier si nos durées configurées sont disponibles
                const expectedDurations = manager.durationOptions[eventType] || [60];
                console.log(`  Durées attendues: ${expectedDurations.join(', ')} min`);
                
                expectedDurations.forEach(duration => {
                    const isAvailable = durationsInfo.availableLengths.includes(duration);
                    console.log(`  ${duration} min: ${isAvailable ? '✅ Disponible' : '❌ NON DISPONIBLE'}`);
                });
                
                // Suggestions si des durées ne sont pas disponibles
                const missingDurations = expectedDurations.filter(d => !durationsInfo.availableLengths.includes(d));
                if (missingDurations.length > 0) {
                    console.warn(`  ⚠️ Durées manquantes: ${missingDurations.join(', ')} min`);
                    console.warn(`  💡 Solution: Allez sur Cal.com > Event Types > "${eventType}" > Durée > Cocher "Multiple durations"`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Erreur vérification configuration:', error);
    }
};