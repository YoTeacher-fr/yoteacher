// Gestion des réservations avec Cal.com (API v2)
// Documentation: https://cal.com/docs/api-reference/v2/introduction
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
        
        console.log("🔧 BookingManager configuré avec API v2");
    }

    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.calcomApiKey}`,
            'Content-Type': 'application/json',
            'cal-api-version': '2024-06-11'
        };
    }

    /**
     * Récupère les créneaux disponibles pour une date donnée
     */
    async getAvailableSlots(eventTypeId, date, duration) {
        try {
            console.log(`🔍 Recherche créneaux pour eventTypeId: ${eventTypeId}, date: ${date}, timeZone: ${this.timeZone}`);
            
            // L'API v2 de Cal.com utilise les paramètres start et end (format YYYY-MM-DD)
            const url = `${this.apiBaseUrl}/slots?eventTypeId=${eventTypeId}&start=${date}&end=${date}&timeZone=${encodeURIComponent(this.timeZone)}`;
            
            console.log(`📍 URL complète: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la récupération des créneaux');
            }

            const data = await response.json();
            console.log('📅 Données reçues de Cal.com v2:', data);

            // Structure Cal.com v2 : data.data.slots[date] ou data.data[date]
            const slotsData = data.data?.slots || data.data || {};
            const slots = slotsData[date] || [];

            if (slots.length === 0) {
                console.log('Aucun créneau disponible pour cette date');
                return [];
            }

            // Note : Aucun filtrage visuel n'est appliqué ici, tous les créneaux 
            // renvoyés par l'API (ex: toutes les 15min) seront affichés.
            
            console.log(`✅ ${slots.length} créneau(x) disponible(s)`);
            return slots;
        } catch (error) {
            console.error('Erreur lors de la récupération des créneaux:', error);
            throw error;
        }
    }

    /**
     * Crée une réservation sur Cal.com
     */
    async createBooking(bookingData) {
        try {
            const eventTypeId = this.eventTypeMap[bookingData.courseType];
            const user = window.authManager?.user;

            if (!eventTypeId) {
                throw new Error(`Type de cours inconnu: ${bookingData.courseType}`);
            }

            // Construction du payload pour l'API Cal.com v2
            const bookingPayload = {
                start: bookingData.startTime,
                eventTypeId: parseInt(eventTypeId),
                lengthInMinutes: parseInt(bookingData.duration), // Force la durée choisie sur le site
                attendee: {
                    name: bookingData.name,
                    email: bookingData.email,
                    timeZone: this.timeZone,
                    language: 'fr'
                },
                metadata: {
                    // L'API v2 est stricte : convertit tout en String pour éviter l'erreur 400
                    userId: user?.id ? String(user.id) : "",
                    courseType: String(bookingData.courseType),
                    price: String(bookingData.price),
                    notes: String(bookingData.notes || '')
                }
            };

            console.log("📤 Envoi de la réservation à Cal.com:", bookingPayload);

            const response = await fetch(`${this.apiBaseUrl}/bookings`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(bookingPayload)
            });

            const result = await response.json();

            if (!response.ok) {
                console.error("❌ Erreur API Cal.com détaillée:", result);
                throw new Error(`Échec de la réservation : API Cal.com: ${response.status} - ${JSON.stringify(result.error || result)}`);
            }

            console.log("✅ Réservation réussie sur Cal.com:", result);

            // Sauvegarder dans Supabase si l'utilisateur est connecté
            if (user && window.supabase) {
                const bookingInfo = result.data || result;
                await this.saveToSupabase(bookingInfo, bookingData);
            }

            return result.data || result;
        } catch (error) {
            console.error('Erreur dans createBooking:', error);
            throw error;
        }
    }

    /**
     * Enregistre la réservation dans la base de données Supabase
     */
    async saveToSupabase(calcomData, bookingData) {
        try {
            const user = window.authManager.user;
            
            // Préparation des données pour Supabase
            const dbData = {
                user_id: user.id,
                calcom_id: String(calcomData.id),
                event_type: bookingData.courseType,
                start_time: bookingData.startTime,
                status: 'confirmed',
                meet_link: calcomData.meetingUrl || calcomData.location || ''
            };

            console.log("💾 Sauvegarde dans Supabase...", dbData);

            const { data, error } = await window.supabase
                .from('bookings')
                .insert([dbData]);

            if (error) throw error;
            console.log("✅ Sauvegarde Supabase réussie");
        } catch (error) {
            console.error("❌ Erreur lors de la sauvegarde Supabase:", error);
            // On ne bloque pas l'utilisateur car la réservation Cal.com est déjà faite
        }
    }
}

// Initialiser le gestionnaire
window.bookingManager = new BookingManager();

// --- OUTILS DE DEBUG ---

window.debugCalcomConfig = async function() {
    console.log('🔧 Debug Configuration Cal.com');
    const manager = window.bookingManager;
    console.log('API Key présente:', !!manager.calcomApiKey);
    console.log('Username configuré:', manager.calcomUsername);
    console.log('Event Type IDs:', manager.eventTypeMap);
    console.log('Fuseau horaire:', manager.timeZone);
    console.log('URL API:', manager.apiBaseUrl);
    
    try {
        const response = await fetch(`${manager.apiBaseUrl}/me`, {
            headers: manager.getAuthHeaders()
        });
        
        if (response.ok) {
            console.log('✅ Connexion API réussie');
            const data = await response.json();
            console.log('Compte Cal.com:', data.data?.username || 'OK');
        } else {
            console.error('❌ Échec test API:', response.status);
        }
    } catch (e) {
        console.error('❌ Erreur réseau:', e);
    }
};