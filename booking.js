// booking.js - Gestion des réservations avec multi-cours, crédits et devises
class BookingManager {
    constructor() {
        const config = window.YOTEACHER_CONFIG || {};
        this.calcomApiKey = config.CALCOM_API_KEY;
        this.calcomUsername = config.CALCOM_USERNAME || 'yoann-bourbia-6ido9g';
        this.apiBaseUrl = 'https://api.cal.com/v2';
        this.eventTypeMap = {
            'essai': config.CALCOM_EVENT_TYPE_ESSAI || '4139074',
            'conversation': config.CALCOM_EVENT_TYPE_CONVERSATION || '4139515',
            'curriculum': config.CALCOM_EVENT_TYPE_CURRICULUM || '4139503'
        };
        
        this.durationOptions = {
            'essai': [15],
            'conversation': [30, 45, 60],
            'curriculum': [30, 45, 60]
        };
        
        this.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.rateLimitInfo = { limit: 120, remaining: 120, reset: null };
    }

    checkCalcomConfig() {
        if (!this.calcomApiKey) {
            throw new Error('CALCOM_API_KEY non configurée');
        }
        return true;
    }

    getAuthHeaders(endpoint = 'slots') {
        let apiVersion;
        switch(endpoint) {
            case 'bookings': apiVersion = '2024-08-13'; break;
            case 'event-types': apiVersion = '2024-06-14'; break;
            case 'slots': default: apiVersion = '2024-09-04'; break;
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
        }
    }

    async getAvailableSlots(eventType = 'essai', date = null, duration = null) {
        try {
            this.checkCalcomConfig();

            const targetDate = date || this.getToday();
            const eventTypeId = this.eventTypeMap[eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${eventType}" non configuré`);
            }

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
                { method: 'GET', headers: this.getAuthHeaders('slots') }
            );
            
            this.updateRateLimitInfo(response);
            
            if (!response.ok) {
                const errorText = await response.text();
                
                if (response.status === 429) {
                    throw new Error('Rate limit atteint. Veuillez patienter avant de réessayer.');
                }
                
                try {
                    const errorData = JSON.parse(errorText);
                    
                    if (errorData.message && errorData.message.includes('Unauthorized')) {
                        throw new Error('Clé API Cal.com invalide ou expirée');
                    }
                    
                    if (errorData.message && errorData.message.includes('not found')) {
                        await this.verifyEventTypeExists(eventTypeId);
                        throw new Error(`Type d'événement non trouvé (ID: ${eventTypeId})`);
                    }
                    
                    throw new Error(`API Cal.com: ${errorData.message || 'Erreur inconnue'}`);
                } catch (parseError) {
                    throw new Error(`API Cal.com: ${response.status} - ${errorText || response.statusText}`);
                }
            }
            
            const data = await response.json();
            
            if (!data || !data.data || typeof data.data !== 'object') {
                return [];
            }
            
            const slotsData = data.data;
            const allSlots = Object.values(slotsData).flat();
            
            if (allSlots.length === 0) {
                return [];
            }
            
            const formattedSlots = Object.entries(slotsData).flatMap(([date, slots]) => {
                if (!Array.isArray(slots)) return [];
                
                return slots.map(slot => {
                    const slotTime = slot.start || slot.time || slot;
                    
                    try {
                        const startDate = new Date(slotTime);
                        if (isNaN(startDate.getTime())) return null;
                        
                        const slotDuration = duration || this.getDefaultDuration(eventType);
                        
                        return {
                            id: slotTime,
                            start: slotTime,
                            end: this.calculateEndTime(slotTime, eventType, slotDuration),
                            time: startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                            duration: `${slotDuration} min`,
                            durationInMinutes: slotDuration,
                            eventTypeId: eventTypeId
                        };
                    } catch (error) {
                        return null;
                    }
                }).filter(slot => slot !== null);
            });
            
            return formattedSlots;
            
        } catch (error) {
            console.error('Erreur Cal.com:', error);
            
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                return this.generateMockSlots(date, eventType, duration);
            }
            
            throw new Error(`Impossible de charger les créneaux : ${error.message}`);
        }
    }

    calculateEndTime(startTime, eventType, customDuration = null) {
        try {
            const start = new Date(startTime);
            if (isNaN(start.getTime())) return null;
            
            const duration = customDuration || this.getDefaultDuration(eventType);
            const end = new Date(start.getTime() + duration * 60000);
            return end.toISOString();
        } catch (error) {
            return null;
        }
    }

    getDefaultDuration(eventType) {
        switch(eventType) {
            case 'essai': return 15;
            case 'conversation': return 60;
            case 'curriculum': return 60;
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
        
        return slots;
    }

    async createBooking(bookingData) {
        try {
            const user = window.authManager?.getCurrentUser();
            
            // Vérifier si l'utilisateur veut utiliser des crédits
            if (bookingData.useCredits && user) {
                return await this.createBookingWithCredits(bookingData);
            }
            
            // Paiement normal
            const completeBookingData = {
                startTime: bookingData.startTime,
                endTime: bookingData.endTime,
                eventType: bookingData.eventType,
                courseType: bookingData.courseType,
                price: bookingData.price,
                duration: bookingData.duration,
                quantity: bookingData.quantity || 1,
                meetingTool: bookingData.meetingTool || 'cal_video',
                
                name: bookingData.name,
                email: bookingData.email,
                notes: bookingData.notes,
                userId: user?.id || null,
                timeZone: bookingData.timeZone || this.timeZone,
                language: bookingData.language || 'fr',
                
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
            console.error('Erreur préparation réservation:', error);
            return { success: false, error: `Échec de la préparation : ${error.message}` };
        }
    }

    // NOUVELLE MÉTHODE : Réservation avec crédits
    async createBookingWithCredits(bookingData) {
        try {
            const user = window.authManager?.getCurrentUser();
            if (!user) {
                throw new Error('Utilisateur non connecté');
            }

            const quantity = bookingData.quantity || 1;
            
            // Vérifier les crédits via l'API Supabase
            const creditsAvailable = await this.checkUserCredits(user.id);
            if (creditsAvailable < quantity) {
                throw new Error(`Crédits insuffisants. Disponible: ${creditsAvailable}, Nécessaire: ${quantity}`);
            }

            // Utiliser les crédits via la fonction PostgreSQL
            const creditResult = await this.useCredits(user.id, quantity, bookingData.courseType);
            if (!creditResult.success) {
                throw new Error(creditResult.message || 'Erreur utilisation crédits');
            }

            // Créer la réservation sur Cal.com
            const calcomResult = await this.createBookingAfterPayment(bookingData);
            if (!calcomResult.success) {
                // Rembourser les crédits en cas d'erreur
                await this.refundCredits(user.id, quantity);
                throw new Error(calcomResult.error || 'Échec réservation Cal.com');
            }

            // Enregistrer la réservation dans Supabase
            const bookingId = await this.saveBookingToSupabase(
                calcomResult.data, 
                user.id, 
                'confirmed',
                bookingData
            );

            // Lier l'utilisation des crédits à la réservation
            if (bookingId && creditResult.credit_usage_id) {
                await this.linkCreditUsageToBooking(creditResult.credit_usage_id, bookingId);
            }

            return {
                success: true,
                booking: calcomResult.data,
                creditsUsed: quantity,
                remainingCredits: creditsAvailable - quantity,
                redirectTo: `booking-success.html?booking=${encodeURIComponent(JSON.stringify({
                    ...bookingData,
                    usedCredits: quantity,
                    remainingCredits: creditsAvailable - quantity,
                    bookingId: bookingId
                }))}`,
                message: 'Réservation confirmée avec vos crédits'
            };

        } catch (error) {
            console.error('Erreur réservation avec crédits:', error);
            return { success: false, error: error.message };
        }
    }

    async checkUserCredits(userId) {
        try {
            const { data, error } = await window.supabase
                .from('profiles')
                .select('credits')
                .eq('id', userId)
                .single();
            
            if (error) throw error;
            return data?.credits || 0;
        } catch (error) {
            console.error('Erreur vérification crédits:', error);
            return 0;
        }
    }

    async useCredits(userId, creditsNeeded, courseType) {
        try {
            // Appeler la fonction PostgreSQL
            const { data, error } = await window.supabase.rpc('use_credits', {
                p_user_id: userId,
                p_credits_needed: creditsNeeded,
                p_course_type: courseType
            });
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erreur utilisation crédits:', error);
            return { success: false, message: error.message };
        }
    }

    async refundCredits(userId, credits) {
        try {
            const { error } = await window.supabase
                .from('profiles')
                .update({ credits: window.supabase.raw('credits + ?', [credits]) })
                .eq('id', userId);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Erreur remboursement crédits:', error);
            return false;
        }
    }

    async linkCreditUsageToBooking(creditUsageId, bookingId) {
        try {
            const { error } = await window.supabase
                .from('credit_usage')
                .update({ booking_id: bookingId })
                .eq('id', creditUsageId);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Erreur lien crédit-réservation:', error);
            return false;
        }
    }

    async createBookingAfterPayment(bookingData) {
        try {
            this.checkCalcomConfig();

            const user = window.authManager?.getCurrentUser();
            const eventTypeId = this.eventTypeMap[bookingData.eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${bookingData.eventType}" non configuré`);
            }

            // Préparer le payload pour Cal.com avec meeting tool
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
                    notes: String(bookingData.notes || ''),
                    duration: String(bookingData.duration || ''),
                    meetingTool: String(bookingData.meetingTool || 'cal_video'),
                    quantity: String(bookingData.quantity || '1')
                }
            };

            // Ajouter la location si meeting tool spécifié
            if (bookingData.meetingTool && bookingData.meetingTool !== 'cal_video') {
                const locationMap = {
                    'zoom': 'integrations:zoom',
                    'google_meet': 'integrations:google:meet',
                    'microsoft_teams': 'integrations:office365_video',
                    'whereby': 'integrations:whereby_video',
                    'jitsi': 'integrations:jitsi_video',
                    'phone': 'integrations:daily_video'
                };
                
                bookingPayload.location = locationMap[bookingData.meetingTool] || 'integrations:daily_video';
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
            
            return { success: true, data };
            
        } catch (error) {
            console.error('Erreur création réservation:', error);
            
            // En mode développement, simuler la création
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                return this.mockBookingAfterPayment(bookingData);
            }
            
            throw error;
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
                    }]
                };
                
                resolve({ success: true, data: mockBooking });
            }, 1000);
        });
    }

    async saveBookingToSupabase(calcomBooking, userId, status = 'confirmed', bookingData = null) {
        try {
            if (!window.supabase) {
                console.warn('Supabase non disponible pour sauvegarde');
                return null;
            }

            const bookingRecord = {
                user_id: userId,
                calcom_id: calcomBooking.id || calcomBooking.uid,
                event_type: bookingData?.courseType || 'essai',
                start_time: calcomBooking.start || calcomBooking.startTime,
                end_time: calcomBooking.end || calcomBooking.endTime,
                status: status,
                meet_link: calcomBooking.location || calcomBooking.meetingUrl,
                meeting_tool: bookingData?.meetingTool || 'cal_video',
                booking_quantity: bookingData?.quantity || 1,
                used_credits: bookingData?.useCredits ? (bookingData.quantity || 1) : 0,
                booking_data: calcomBooking,
                created_at: new Date().toISOString()
            };

            const { data, error } = await window.supabase
                .from('bookings')
                .insert([bookingRecord])
                .select();

            if (error) {
                console.warn('Erreur sauvegarde Supabase:', error);
                return null;
            }
            
            return data[0]?.id;
            
        } catch (error) {
            console.error('Exception sauvegarde Supabase:', error);
            return null;
        }
    }

    // Méthodes utilitaires
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

    // NOUVELLE MÉTHODE: Vérifier les durées disponibles
    async checkEventTypeDurations(eventTypeId) {
        try {
            const queryParams = new URLSearchParams({
                username: this.calcomUsername
            });
            
            const response = await fetch(
                `${this.apiBaseUrl}/event-types?${queryParams}`, 
                { headers: this.getAuthHeaders('event-types') }
            );
            
            if (response.ok) {
                const result = await response.json();
                const data = result.data || result;
                const eventTypes = data.eventTypes || [];
                
                const eventType = eventTypes.find(e => e.id == eventTypeId || e.id === parseInt(eventTypeId));
                if (eventType) {
                    return {
                        defaultDuration: eventType.lengthInMinutes || eventType.length,
                        availableLengths: eventType.availableLengths ? 
                            eventType.availableLengths.map(l => parseInt(l)) : 
                            [eventType.lengthInMinutes || eventType.length]
                    };
                }
            }
            
            return null;
        } catch (error) {
            console.warn('Erreur vérification durées:', error);
            return null;
        }
    }

    // NOUVELLE MÉTHODE: Ajouter des crédits à un utilisateur
    async addCreditsToUser(userId, packageType, credits, price, currency = 'EUR', expiresMonths = 12) {
        try {
            const { data, error } = await window.supabase.rpc('add_credits', {
                p_user_id: userId,
                p_package_type: packageType,
                p_credits: credits,
                p_price: price,
                p_currency: currency,
                p_expires_months: expiresMonths
            });
            
            if (error) throw error;
            return { success: true, packageId: data };
        } catch (error) {
            console.error('Erreur ajout crédits:', error);
            return { success: false, error: error.message };
        }
    }

    // NOUVELLE MÉTHODE: Obtenir les réservations à venir d'un utilisateur
    async getUpcomingBookings(userId, limit = 5) {
        try {
            const { data, error } = await window.supabase
                .from('bookings')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'confirmed')
                .gte('start_time', new Date().toISOString())
                .order('start_time', { ascending: true })
                .limit(limit);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Erreur récupération réservations:', error);
            return [];
        }
    }

    // NOUVELLE MÉTHODE: Obtenir les statistiques utilisateur
    async getUserStats(userId) {
        try {
            const { data, error } = await window.supabase
                .from('user_stats')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erreur statistiques:', error);
            return null;
        }
    }
}

// Initialiser
window.bookingManager = new BookingManager();

// Débogage
window.debugCalcomConfig = async function() {
    const config = window.YOTEACHER_CONFIG || {};
    const manager = window.bookingManager;
    
    console.group('🔧 Debug Configuration Cal.com');
    console.log('API Key présente:', !!config.CALCOM_API_KEY);
    console.log('Event Type IDs:', manager.eventTypeMap);
    
    if (config.CALCOM_API_KEY) {
        try {
            const queryParams = new URLSearchParams({
                username: config.CALCOM_USERNAME || manager.calcomUsername
            });
            
            const response = await fetch(
                `${manager.apiBaseUrl}/event-types?${queryParams}`, 
                { headers: manager.getAuthHeaders('event-types') }
            );
            
            manager.updateRateLimitInfo(response);
            
            if (response.ok) {
                const result = await response.json();
                const data = result.data || result;
                console.log('✅ Connexion API réussie');
                
                if (data.eventTypes) {
                    console.log('Event types disponibles:', data.eventTypes.length);
                    
                    Object.entries(manager.eventTypeMap).forEach(([key, value]) => {
                        if (value) {
                            const found = data.eventTypes.find(e => e.id == value || e.id === parseInt(value));
                            if (found) {
                                console.log(`\n${key} (ID: ${value}):`);
                                console.log(`  Titre: "${found.title}"`);
                                console.log(`  Durée: ${found.lengthInMinutes || found.length} min`);
                                
                                if (found.availableLengths) {
                                    console.log(`  Durées multiples: ${found.availableLengths.join(', ')} min`);
                                }
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('❌ Erreur connexion API:', error);
        }
    }
    
    console.groupEnd();
};

// Test des créneaux
window.testCalcomSlots = async function(date = null, eventType = 'essai', duration = null) {
    const durationText = duration ? ` (${duration} min)` : '';
    console.log(`🧪 Test Cal.com slots pour ${eventType}${durationText}`);
    try {
        const slots = await window.bookingManager.getAvailableSlots(eventType, date, duration);
        console.log(`✅ ${slots.length} créneau(x) trouvé(s):`);
        if (slots.length > 0) {
            slots.slice(0, 5).forEach(slot => {
                console.log(`  • ${window.bookingManager.formatTime(slot.start)} (${slot.duration})`);
            });
        }
        return slots;
    } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
        return [];
    }
};

// Vérifier la santé de l'API
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
            { headers: manager.getAuthHeaders('event-types') }
        );
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log('Health:', response.ok ? '✅ API fonctionnelle' : '❌ API non fonctionnelle');
        return response.ok;
    } catch (error) {
        console.error('❌ Erreur santé API:', error.message);
        return false;
    }
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        console.log('🔧 BookingManager configuré avec multi-cours, crédits et devises');
        
        if ((window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) && 
            !window.YOTEACHER_CONFIG?.CALCOM_API_KEY) {
            console.warn('⚠️ Mode développement : Créneaux et paiements simulés');
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('debug') === 'calcom') {
            window.debugCalcomConfig();
        }
    }, 1000);
});