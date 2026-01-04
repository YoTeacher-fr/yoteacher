class BookingManager {
    constructor() {
        const config = window.YOTEACHER_CONFIG || {};
        this.calcomApiKey = config.CALCOM_API_KEY;
        this.apiBaseUrl = 'https://api.cal.com/v2';
        this.eventTypeMap = {
            'essai': config.CALCOM_EVENT_TYPE_ESSAI || '4139074',
            'conversation': config.CALCOM_EVENT_TYPE_CONVERSATION || '4139515',
            'curriculum': config.CALCOM_EVENT_TYPE_CURRICULUM || '4139503'
        };
        this.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.calcomApiKey}`,
            'Content-Type': 'application/json',
            'cal-api-version': '2024-06-11'
        };
    }

    async getAvailableSlots(eventTypeId, date) {
        try {
            const url = `${this.apiBaseUrl}/slots?eventTypeId=${eventTypeId}&start=${date}&end=${date}&timeZone=${encodeURIComponent(this.timeZone)}`;
            const response = await fetch(url, { headers: this.getAuthHeaders() });
            const data = await response.json();
            const slotsData = data.data?.slots || data.data || {};
            return slotsData[date] || [];
        } catch (error) {
            console.error('Erreur slots:', error);
            return [];
        }
    }

    async createBooking(bookingData) {
        try {
            const eventTypeId = this.eventTypeMap[bookingData.courseType];
            const user = window.authManager?.user;

            // --- FORCE LA DURÉE ---
            // On récupère la durée de bookingData.duration. 
            // Si elle est absente, on met 30 par défaut pour éviter le 60 de Cal.com
            const finalDuration = parseInt(bookingData.duration) || 30;

            const bookingPayload = {
                start: bookingData.startTime,
                eventTypeId: parseInt(eventTypeId),
                lengthInMinutes: finalDuration, // <--- C'est cette ligne qui commande Cal.com
                attendee: {
                    name: bookingData.name,
                    email: bookingData.email,
                    timeZone: this.timeZone,
                    language: 'fr'
                },
                metadata: {
                    userId: user?.id ? String(user.id) : "",
                    courseType: String(bookingData.courseType),
                    price: String(bookingData.price).replace('€', '').trim(),
                    notes: String(bookingData.notes || '')
                }
            };

            console.log(`🚀 Tentative de réservation de ${finalDuration} minutes...`);

            const response = await fetch(`${this.apiBaseUrl}/bookings`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(bookingPayload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(`Erreur API: ${JSON.stringify(result.error || result)}`);
            }

            if (user && window.supabase) {
                await this.saveToSupabase(result.data || result, bookingData);
            }

            return result.data || result;
        } catch (error) {
            console.error('Erreur réservation:', error);
            throw error;
        }
    }

    async saveToSupabase(calcomData, bookingData) {
        try {
            const user = window.authManager.user;
            await window.supabase.from('bookings').insert([{
                user_id: user.id,
                calcom_id: String(calcomData.id),
                event_type: bookingData.courseType,
                start_time: bookingData.startTime,
                status: 'confirmed',
                meet_link: calcomData.meetingUrl || calcomData.location || ''
            }]);
        } catch (err) {
            console.error("Erreur Supabase ignorée:", err);
        }
    }
}

window.bookingManager = new BookingManager();