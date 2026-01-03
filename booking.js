// Gestion des réservations avec Cal.com
class BookingManager {
    constructor() {
        const config = window.YOTEACHER_CONFIG || {};
        this.calcomApiKey = config.CALCOM_API_KEY;
        this.calcomUsername = config.CALCOM_USERNAME || 'yoann';
    }

    // Récupérer les créneaux disponibles
    async getAvailableSlots(eventType = 'essai', date = null) {
        try {
            // Si Cal.com n'est pas configuré, retourner des créneaux simulés
            if (!this.calcomApiKey) {
                return this.getMockSlots();
            }

            // Appel à l'API Cal.com
            const response = await fetch(
                `https://api.cal.com/v1/availability?apiKey=${this.calcomApiKey}&eventTypeId=${eventType}&date=${date || this.getToday()}`
            );
            
            const data = await response.json();
            return data.availableSlots || [];
        } catch (error) {
            console.warn('Cal.com non disponible - mode démo activé');
            return this.getMockSlots();
        }
    }

    // Créer une réservation
    async createBooking(bookingData) {
        const user = window.authManager?.getCurrentUser();
        
        // Données de base
        const booking = {
            eventTypeId: bookingData.eventType || 'essai',
            start: bookingData.startTime,
            end: bookingData.endTime,
            name: bookingData.name || 'Invité',
            email: bookingData.email,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            notes: bookingData.notes || '',
            metadata: {
                userId: user?.id || null,
                courseType: bookingData.courseType,
                price: bookingData.price
            }
        };

        try {
            // Mode démo (sans Cal.com)
            if (!this.calcomApiKey) {
                return this.createMockBooking(booking);
            }

            // Appel réel à Cal.com
            const response = await fetch('https://api.cal.com/v1/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.calcomApiKey}`
                },
                body: JSON.stringify(booking)
            });

            const data = await response.json();
            
            // Enregistrer dans Supabase
            if (data.booking && user) {
                await this.saveBookingToSupabase(data.booking, user.id);
            }

            return data;
        } catch (error) {
            console.error('Erreur réservation:', error);
            throw error;
        }
    }

    // Enregistrer la réservation dans Supabase
    async saveBookingToSupabase(calcomBooking, userId) {
        try {
            const { error } = await supabase
                .from('bookings')
                .insert([
                    {
                        user_id: userId,
                        calcom_id: calcomBooking.id,
                        event_type: calcomBooking.eventType,
                        start_time: calcomBooking.startTime,
                        end_time: calcomBooking.endTime,
                        status: 'confirmed',
                        meet_link: calcomBooking.meetingUrl,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (error) throw error;
            return true;
        } catch (error) {
            console.warn('Impossible de sauvegarder dans Supabase:', error);
            return false;
        }
    }

    // Créer des créneaux simulés (pour le développement)
    getMockSlots() {
        const slots = [];
        const today = new Date();
        
        // Générer des créneaux pour les 7 prochains jours
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            // Skip weekend
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            
            // Créneaux de 9h à 18h
            for (let hour = 9; hour < 18; hour++) {
                const slot = new Date(date);
                slot.setHours(hour, 0, 0, 0);
                
                // Ne pas montrer les créneaux passés
                if (slot > new Date()) {
                    slots.push({
                        start: slot.toISOString(),
                        end: new Date(slot.getTime() + 60 * 60000).toISOString(),
                        available: true
                    });
                }
            }
        }
        
        return slots;
    }

    // Créer une réservation simulée
    createMockBooking(bookingData) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockBooking = {
                    id: 'mock_' + Date.now(),
                    meetingUrl: 'https://meet.google.com/mock-' + Math.random().toString(36).substr(2, 9),
                    startTime: bookingData.start,
                    endTime: bookingData.end,
                    status: 'confirmed',
                    eventType: bookingData.eventTypeId
                };
                
                // Simuler l'enregistrement dans Supabase
                if (window.authManager?.getCurrentUser()) {
                    this.saveBookingToSupabase(mockBooking, window.authManager.getCurrentUser().id);
                }
                
                resolve({ booking: mockBooking, message: 'Réservation créée avec succès (mode démo)' });
            }, 1000);
        });
    }

    getToday() {
        return new Date().toISOString().split('T')[0];
    }

    // Formater l'heure pour l'affichage
    formatTime(dateTime) {
        const date = new Date(dateTime);
        return date.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit',
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    }
}

// Initialiser le gestionnaire de réservations
window.bookingManager = new BookingManager();