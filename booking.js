// Gestion des réservations avec Cal.com
class BookingManager {
    constructor() {
        const config = window.YOTEACHER_CONFIG || {};
        this.calcomApiKey = config.CALCOM_API_KEY;
        this.calcomUsername = config.CALCOM_USERNAME || 'yoann';
        this.apiVersion = 'v2';
        this.eventTypeMap = {
            'essai': config.CALCOM_EVENT_TYPE_ESSAI || '1',
            'conversation': config.CALCOM_EVENT_TYPE_CONVERSATION || '2',
            'curriculum': config.CALCOM_EVENT_TYPE_CURRICULUM || '3'
        };
    }

    // Vérifier la configuration Cal.com
   checkCalcomConfig() {
    if (!this.calcomApiKey) {
        throw new Error('CALCOM_API_KEY non configurée. Configurez-la dans config.js');
    }
    
    // Clés API Cal.com valides commencent par cal_live_ ou cal_test_
    if (!this.calcomApiKey.startsWith('cal_live_') && !this.calcomApiKey.startsWith('cal_test_')) {
        console.warn('Format de clé API Cal.com inhabituel. Vérifiez qu\'elle est correcte.');
    }
    
    return true;
}

    // Récupérer les créneaux disponibles
    async getAvailableSlots(eventType = 'essai', date = null) {
        try {
            // Vérifier la configuration
            this.checkCalcomConfig();

            const targetDate = date || this.getToday();
            const eventTypeId = this.eventTypeMap[eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${eventType}" non configuré dans Cal.com`);
            }

            const params = new URLSearchParams({
                apiKey: this.calcomApiKey,
                startTime: `${targetDate}T00:00:00.000Z`,
                endTime: `${targetDate}T23:59:59.999Z`,
                eventTypeId: eventTypeId
            });

            const response = await fetch(
                `https://api.cal.com/v2/availability?${params.toString()}`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API Cal.com: ${response.status} - ${errorData.message || response.statusText}`);
            }
            
            const data = await response.json();
            
            // Format de réponse Cal.com v2
            if (data.slots && Array.isArray(data.slots)) {
                return data.slots.map(slot => ({
                    start: slot.time,
                    end: new Date(new Date(slot.time).getTime() + 60 * 60000).toISOString(),
                    available: true
                }));
            }
            
            return data.availableSlots || [];
            
        } catch (error) {
            console.error('Erreur Cal.com:', error);
            throw error;
        }
    }

    // Créer une réservation
    async createBooking(bookingData) {
        try {
            // Vérifier la configuration
            this.checkCalcomConfig();

            const user = window.authManager?.getCurrentUser();
            const eventTypeId = this.eventTypeMap[bookingData.eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${bookingData.eventType}" non configuré`);
            }

            const booking = {
                eventTypeId: eventTypeId,
                start: bookingData.startTime,
                end: bookingData.endTime,
                name: bookingData.name,
                email: bookingData.email,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                notes: bookingData.notes || '',
                metadata: {
                    userId: user?.id || null,
                    courseType: bookingData.courseType,
                    price: bookingData.price
                }
            };

            const response = await fetch('https://api.cal.com/v2/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.calcomApiKey}`
                },
                body: JSON.stringify(booking)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API Cal.com: ${response.status} - ${errorData.message || response.statusText}`);
            }

            const data = await response.json();
            
            // Enregistrer dans Supabase
            if (data.booking && user) {
                await this.saveBookingToSupabase(data.booking, user.id);
            }

            return data;
            
        } catch (error) {
            console.error('Erreur création réservation:', error);
            throw error;
        }
    }

    // Enregistrer la réservation dans Supabase
    async saveBookingToSupabase(calcomBooking, userId) {
        try {
            if (!window.supabase) {
                console.warn('Supabase non disponible pour sauvegarde');
                return false;
            }

            const { error } = await supabase
                .from('bookings')
                .insert([
                    {
                        user_id: userId,
                        calcom_id: calcomBooking.id || calcomBooking.bookingId,
                        event_type: calcomBooking.eventType || calcomBooking.eventTypeId,
                        start_time: calcomBooking.startTime || calcomBooking.start,
                        end_time: calcomBooking.endTime || calcomBooking.end,
                        status: calcomBooking.status || 'confirmed',
                        meet_link: calcomBooking.meetingUrl || calcomBooking.videoCallUrl,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (error) {
                console.warn('Erreur sauvegarde Supabase:', error);
                throw error;
            }
            
            console.log('✅ Réservation sauvegardée dans Supabase');
            return true;
            
        } catch (error) {
            console.error('Exception sauvegarde Supabase:', error);
            throw error;
        }
    }

    getToday() {
        return new Date().toISOString().split('T')[0];
    }

    // Formater l'heure pour l'affichage
    formatTime(dateTime) {
        try {
            const date = new Date(dateTime);
            return date.toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit',
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        } catch (error) {
            console.warn('Erreur formatage date:', error);
            return dateTime || 'Date non disponible';
        }
    }
}

// Initialiser le gestionnaire de réservations
window.bookingManager = new BookingManager();

// Vérification de configuration au démarrage
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (window.bookingManager && window.YOTEACHER_CONFIG) {
            console.log('🔧 BookingManager configuré:', {
                hasApiKey: !!window.YOTEACHER_CONFIG.CALCOM_API_KEY,
                eventTypes: window.bookingManager.eventTypeMap
            });
        }
    }, 500);
});