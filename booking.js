// booking.js - Gestion des réservations avec Cal.com (API v2) et Supabase
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
                
                throw new Error(`API Cal.com: ${response.status} - ${errorText || response.statusText}`);
            }
            
            const data = await response.json();
            
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

    async createBooking(bookingData) {
        try {
            const user = window.authManager?.getCurrentUser();
            
            const currentCurrency = window.currencyManager?.currentCurrency || 'EUR';
            const priceEUR = bookingData.priceEUR || bookingData.price;
            
            let finalPrice = bookingData.price;
            if (window.currencyManager && currentCurrency !== 'EUR') {
                finalPrice = window.currencyManager.convert(priceEUR, 'EUR', currentCurrency);
            }
            
            const completeBookingData = {
                startTime: bookingData.startTime,
                endTime: bookingData.endTime,
                eventType: bookingData.eventType,
                courseType: bookingData.courseType,
                priceEUR: priceEUR,
                price: finalPrice,
                duration: bookingData.duration,
                location: bookingData.location,
                currency: currentCurrency,
                
                name: bookingData.name,
                email: bookingData.email,
                notes: bookingData.notes,
                userId: user?.id || null,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: 'fr',
                
                coursesCount: bookingData.coursesCount || 1,
                discountPercent: bookingData.discountPercent || 0,
                basePriceEUR: bookingData.basePriceEUR,
                
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

    // NOUVELLE MÉTHODE CORRIGÉE : Créer la réservation sur Cal.com APRÈS paiement
    async createBookingAfterPayment(bookingData) {
        try {
            this.checkCalcomConfig();

            const user = window.authManager?.getCurrentUser();
            const eventTypeId = this.eventTypeMap[bookingData.eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${bookingData.eventType}" non configuré`);
            }

            // Mapper la location au format Cal.com
            let calcomLocation = 'integrations:zoom'; // Défaut
            if (bookingData.location) {
                if (bookingData.location.includes('google')) {
                    calcomLocation = 'integrations:google:meet';
                } else if (bookingData.location.includes('teams')) {
                    calcomLocation = bookingData.location; // URL directe pour Teams
                } else if (bookingData.location.includes('zoom')) {
                    calcomLocation = 'integrations:zoom';
                }
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
                location: calcomLocation,
                metadata: {
                    userId: user?.id ? String(user.id) : "", 
                    courseType: String(bookingData.courseType || ''),
                    price: String(bookingData.priceEUR || bookingData.price || '0'),
                    currency: String(bookingData.currency || 'EUR'),
                    notes: String(bookingData.notes || ''),
                    duration: String(bookingData.duration || '')
                }
            };

            // Ajouter la durée si nécessaire
            if (bookingData.eventType !== 'essai' && bookingData.duration) {
                const requestedDuration = parseInt(bookingData.duration);
                bookingPayload.lengthInMinutes = requestedDuration;
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
                
                throw new Error(`API Cal.com: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            const calcomBooking = result.data || result;
            console.log('✅ Réservation créée sur Cal.com:', calcomBooking);
            
            // Sauvegarder dans Supabase avec le nouveau schéma
            const supabaseBookingId = await this.saveBookingToSupabase(calcomBooking, bookingData, 'confirmed');
            
            return { 
                success: true, 
                data: calcomBooking,
                supabaseId: supabaseBookingId,
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
                resolve({ success: true, data: mockBooking });
            }, 1000);
        });
    }

    // NOUVELLE MÉTHODE : Sauvegarder dans Supabase avec nouveau schéma
    async saveBookingToSupabase(calcomBooking, originalBookingData, status = 'confirmed') {
        try {
            if (!window.supabase) {
                console.warn('Supabase non disponible pour sauvegarde');
                return null;
            }

            const user = window.authManager?.getCurrentUser();
            if (!user) {
                console.warn('Utilisateur non connecté, impossible de sauvegarder');
                return null;
            }

            // Mapper la location au format DB
            let platform = 'zoom';
            if (originalBookingData.location) {
                if (originalBookingData.location.includes('google')) platform = 'google_meet';
                else if (originalBookingData.location.includes('teams')) platform = 'teams';
                else if (originalBookingData.location.includes('zoom')) platform = 'zoom';
            }

            // Déterminer le payment_method
            const paymentMethod = originalBookingData.coursesCount > 1 ? 'credit' : 'stripe';

            const bookingRecord = {
                user_id: user.id,
                course_type: originalBookingData.courseType || originalBookingData.eventType,
                duration_minutes: parseInt(originalBookingData.duration) || 60,
                start_time: originalBookingData.startTime,
                end_time: originalBookingData.endTime,
                platform: platform,
                meeting_link: calcomBooking.location || calcomBooking.meetingUrl,
                price_paid: parseFloat(originalBookingData.priceEUR || originalBookingData.price || 0),
                currency: originalBookingData.currency || 'EUR',
                calcom_booking_id: String(calcomBooking.id || calcomBooking.uid),
                calcom_uid: calcomBooking.uid || null,
                status: status,
                payment_method: paymentMethod,
                payment_reference: originalBookingData.transactionId || null
            };

            console.log('💾 Tentative sauvegarde Supabase:', bookingRecord);

            const { data, error } = await supabase
                .from('bookings')
                .insert([bookingRecord])
                .select();

            if (error) {
                console.error('Erreur sauvegarde Supabase:', error);
                return null;
            }
            
            console.log('✅ Réservation sauvegardée dans Supabase avec ID:', data[0].id);
            console.log('📋 Numéro de réservation:', data[0].booking_number);
            
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
                    console.log(`🕐 Durée par défaut: ${eventType.lengthInMinutes || eventType.length} min`);
                    
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
    }, 1000);
});