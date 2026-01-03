// Gestion des réservations avec Cal.com
class BookingManager {
    constructor() {
        const config = window.YOTEACHER_CONFIG || {};
        this.calcomApiKey = config.CALCOM_API_KEY;
        this.calcomUsername = config.CALCOM_USERNAME || 'yoann-bourbia-6ido9g';
        this.apiVersion = 'v1'; // Utiliser v1 qui est plus stable
        this.eventTypeMap = {
            'essai': config.CALCOM_EVENT_TYPE_ESSAI || '4139074',
            'conversation': config.CALCOM_EVENT_TYPE_CONVERSATION || '',
            'curriculum': config.CALCOM_EVENT_TYPE_CURRICULUM || ''
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
            this.checkCalcomConfig();

            const targetDate = date || this.getToday();
            const eventTypeId = this.eventTypeMap[eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${eventType}" non configuré dans Cal.com`);
            }

            console.log(`🔍 Recherche créneaux pour eventTypeId: ${eventTypeId}, date: ${targetDate}`);

            // API v1 (plus stable et documentée)
            const params = new URLSearchParams({
                apiKey: this.calcomApiKey,
                eventTypeId: eventTypeId,
                date: targetDate
            });

            const response = await fetch(
                `https://api.cal.com/v1/availability?${params.toString()}`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Réponse API Cal.com:', { status: response.status, text: errorText });
                
                // Si 404, tester si l'event type existe
                if (response.status === 404) {
                    await this.verifyEventTypeExists(eventTypeId);
                }
                
                throw new Error(`API Cal.com: ${response.status} - ${errorText || response.statusText}`);
            }
            
            const data = await response.json();
            
            // Log pour débogage
            console.log('📅 Données reçues de Cal.com:', data);
            
            return data.availableSlots || [];
            
        } catch (error) {
            console.error('Erreur Cal.com:', error);
            throw error;
        }
    }

    // Vérifier si l'event type existe
    async verifyEventTypeExists(eventTypeId) {
        try {
            const response = await fetch('https://api.cal.com/v1/event-types', {
                headers: {
                    'Authorization': `Bearer ${this.calcomApiKey}`,
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('📋 Vos event types disponibles:', data.event_types || data);
                
                const foundEvent = (data.event_types || data).find(
                    event => event.id == eventTypeId || event.id === parseInt(eventTypeId)
                );
                
                if (!foundEvent) {
                    console.error(`❌ Event type ID ${eventTypeId} non trouvé dans vos event types`);
                    console.log('IDs disponibles:', (data.event_types || data).map(e => ({ id: e.id, slug: e.slug, title: e.title })));
                }
            }
        } catch (error) {
            console.warn('Impossible de vérifier les event types:', error);
        }
    }

    // Créer une réservation
    async createBooking(bookingData) {
        try {
            this.checkCalcomConfig();

            const user = window.authManager?.getCurrentUser();
            const eventTypeId = this.eventTypeMap[bookingData.eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${bookingData.eventType}" non configuré`);
            }

            const booking = {
                eventTypeId: parseInt(eventTypeId),
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

            // API v1 pour la création aussi
            const params = new URLSearchParams({ apiKey: this.calcomApiKey });
            const response = await fetch(`https://api.cal.com/v1/bookings?${params.toString()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(booking)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Cal.com: ${response.status} - ${errorText}`);
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
                        event_type: calcomBooking.eventType || 'essai',
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

// Fonction de débogage pour vérifier la configuration
window.debugCalcomConfig = function() {
    const config = window.YOTEACHER_CONFIG || {};
    const manager = window.bookingManager;
    
    console.group('🔧 Debug Configuration Cal.com');
    console.log('API Key présente:', !!config.CALCOM_API_KEY);
    console.log('Username configuré:', config.CALCOM_USERNAME);
    console.log('Event Type IDs:', manager.eventTypeMap);
    
    // Tester la connexion API
    if (config.CALCOM_API_KEY) {
        fetch('https://api.cal.com/v1/event-types', {
            headers: {
                'Authorization': `Bearer ${config.CALCOM_API_KEY}`
            }
        })
        .then(response => response.json())
        .then(data => {
            console.log('✅ Connexion API réussie');
            console.log('Event types disponibles:', data.event_types || data);
        })
        .catch(error => {
            console.error('❌ Erreur connexion API:', error);
        });
    }
    console.groupEnd();
};

// Vérification de configuration au démarrage
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        console.log('🔧 BookingManager configuré:', {
            hasApiKey: !!window.YOTEACHER_CONFIG?.CALCOM_API_KEY,
            eventTypes: window.bookingManager?.eventTypeMap
        });
        
        // Lancer le debug si en mode développement
        if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
            window.debugCalcomConfig();
        }
    }, 1000);
});