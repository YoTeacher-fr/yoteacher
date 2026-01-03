// Gestion des réservations avec Cal.com (API v2)
class BookingManager {
    constructor() {
        const config = window.YOTEACHER_CONFIG || {};
        this.calcomApiKey = config.CALCOM_API_KEY;
        this.calcomUsername = config.CALCOM_USERNAME || 'yoann-bourbia-6ido9g';
        this.apiBaseUrl = 'https://api.cal.com/v2';
        this.eventTypeMap = {
            'essai': config.CALCOM_EVENT_TYPE_ESSAI || '4139074',
            'conversation': config.CALCOM_EVENT_TYPE_CONVERSATION || '',
            'curriculum': config.CALCOM_EVENT_TYPE_CURRICULUM || ''
        };
        this.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
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

    // Créer les headers pour l'authentification
    getAuthHeaders(endpoint = 'slots') {
        // Différentes versions d'API selon l'endpoint
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

    // Récupérer les créneaux disponibles (API v2)
    async getAvailableSlots(eventType = 'essai', date = null) {
        try {
            this.checkCalcomConfig();

            const targetDate = date || this.getToday();
            const eventTypeId = this.eventTypeMap[eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${eventType}" non configuré dans Cal.com`);
            }

            console.log(`🔍 Recherche créneaux pour eventTypeId: ${eventTypeId}, date: ${targetDate}, timeZone: ${this.timeZone}`);

            // API v2 - Paramètres requis
            const queryParams = new URLSearchParams({
                eventTypeId: eventTypeId,
                start: targetDate,
                end: targetDate,
                timeZone: this.timeZone
            });
            
            // Ajouter des paramètres optionnels qui peuvent aider
            if (this.calcomUsername) {
                queryParams.append('usernameList', this.calcomUsername);
            }

            console.log(`📍 URL complète: ${this.apiBaseUrl}/slots?${queryParams.toString()}`);

            const response = await fetch(
                `${this.apiBaseUrl}/slots?${queryParams}`,
                {
                    method: 'GET',
                    headers: this.getAuthHeaders('slots')
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Réponse API Cal.com v2:', { 
                    status: response.status, 
                    statusText: response.statusText,
                    text: errorText 
                });
                
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
            
            // Log pour débogage
            console.log('📅 Données reçues de Cal.com v2:', data);
            console.log('📅 Structure data.data:', data.data);
            
            if (!data || !data.data || typeof data.data !== 'object') {
                console.warn('Aucun créneau disponible ou format de réponse inattendu');
                return [];
            }
            
            // data.data est un objet avec des dates comme clés
            // Exemple: { "2026-01-03": [{ start: "...", ... }], "2026-01-04": [...] }
            const slotsData = data.data;
            
            // Vérifier s'il y a des créneaux
            const allSlots = Object.values(slotsData).flat();
            if (allSlots.length === 0) {
                console.warn('Aucun créneau disponible pour cette date');
                return [];
            }
            
            // Convertir le format des créneaux pour notre interface
            const formattedSlots = Object.entries(slotsData).flatMap(([date, slots]) => {
                if (!Array.isArray(slots)) {
                    console.warn(`Slots pour ${date} n'est pas un tableau:`, slots);
                    return [];
                }
                
                return slots.map(slot => ({
                    id: slot.time,
                    start: slot.time,
                    end: this.calculateEndTime(slot.time, eventType),
                    time: new Date(slot.time).toLocaleTimeString('fr-FR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    }),
                    duration: this.getDuration(eventType),
                    eventTypeId: eventTypeId
                }));
            });
            
            console.log(`✅ ${formattedSlots.length} créneau(x) disponible(s)`);
            return formattedSlots;
            
        } catch (error) {
            console.error('❌ Erreur Cal.com:', error);
            
            // Mode dégradé : simuler des créneaux pour le développement
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                console.warn('⚠️ Mode développement : simulation de créneaux');
                return this.generateMockSlots(date, eventType);
            }
            
            throw new Error(`Impossible de charger les créneaux : ${error.message}`);
        }
    }

    // Calculer l'heure de fin en fonction du type de cours
    calculateEndTime(startTime, eventType) {
        const start = new Date(startTime);
        let duration = 60; // minutes par défaut
        
        switch(eventType) {
            case 'essai':
                duration = 15;
                break;
            case 'conversation':
                duration = 60;
                break;
            case 'curriculum':
                duration = 60;
                break;
        }
        
        const end = new Date(start.getTime() + duration * 60000);
        return end.toISOString();
    }

    // Obtenir la durée en texte
    getDuration(eventType) {
        switch(eventType) {
            case 'essai': return '15 min';
            case 'conversation': return '60 min';
            case 'curriculum': return '60 min';
            default: return '60 min';
        }
    }

    // Générer des créneaux simulés pour le développement
    generateMockSlots(date, eventType) {
        const baseDate = date || this.getToday();
        const slots = [];
        
        // Générer des créneaux toutes les heures de 9h à 18h
        for (let hour = 9; hour <= 18; hour++) {
            const slotTime = `${baseDate}T${hour.toString().padStart(2, '0')}:00:00Z`;
            slots.push({
                id: `mock_${hour}`,
                start: slotTime,
                end: this.calculateEndTime(slotTime, eventType),
                time: `${hour}:00`,
                duration: this.getDuration(eventType),
                eventTypeId: this.eventTypeMap[eventType],
                isMock: true
            });
        }
        
        console.log(`⚠️ Mode simulation: ${slots.length} créneaux générés`);
        return slots;
    }

    // Vérifier si l'event type existe
    async verifyEventTypeExists(eventTypeId) {
        try {
            console.log(`🔍 Vérification de l'event type ID: ${eventTypeId}`);
            
            // Récupérer les event types avec le username
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

    // Créer une réservation (API v2)
    async createBooking(bookingData) {
        try {
            this.checkCalcomConfig();

            const user = window.authManager?.getCurrentUser();
            const eventTypeId = this.eventTypeMap[bookingData.eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${bookingData.eventType}" non configuré`);
            }

            // Préparer les données pour l'API v2
            const bookingPayload = {
                start: bookingData.startTime,
                eventTypeId: parseInt(eventTypeId),
                attendee: {
                    name: bookingData.name,
                    email: bookingData.email,
                    timeZone: this.timeZone,
                    language: 'fr'
                },
                metadata: {
                    userId: user?.id || null,
                    courseType: bookingData.courseType,
                    price: bookingData.price,
                    notes: bookingData.notes || ''
                }
            };

            console.log('📤 Envoi de la réservation à Cal.com:', bookingPayload);

            const response = await fetch(
                `${this.apiBaseUrl}/bookings`,
                {
                    method: 'POST',
                    headers: this.getAuthHeaders('bookings'),
                    body: JSON.stringify(bookingPayload)
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erreur création réservation:', { 
                    status: response.status, 
                    text: errorText 
                });
                
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.message || 'Erreur lors de la création de la réservation');
                } catch (e) {
                    throw new Error(`API Cal.com: ${response.status} - ${errorText}`);
                }
            }

            const result = await response.json();
            const data = result.data || result;
            console.log('✅ Réservation créée:', data);
            
            // Enregistrer dans Supabase
            if (data && user) {
                await this.saveBookingToSupabase(data, user.id);
            }

            return {
                success: true,
                data: data,
                booking: data
            };
            
        } catch (error) {
            console.error('❌ Erreur création réservation:', error);
            
            // Mode développement : simuler une réservation réussie
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                console.warn('⚠️ Mode développement : simulation de réservation');
                return this.mockBooking(bookingData);
            }
            
            throw new Error(`Échec de la réservation : ${error.message}`);
        }
    }

    // Simulation de réservation pour le développement
    async mockBooking(bookingData) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockBooking = {
                    id: `mock_${Date.now()}`,
                    uid: `mock_${Date.now()}`,
                    start: bookingData.startTime,
                    end: bookingData.endTime,
                    title: `Cours ${bookingData.courseType}`,
                    description: bookingData.notes || '',
                    attendees: [{
                        email: bookingData.email,
                        name: bookingData.name
                    }]
                };
                
                console.log('✅ Réservation simulée créée:', mockBooking);
                
                resolve({
                    success: true,
                    data: mockBooking,
                    booking: mockBooking,
                    message: 'Réservation simulée réussie (mode développement)'
                });
            }, 1000);
        });
    }

    // Enregistrer la réservation dans Supabase
    async saveBookingToSupabase(calcomBooking, userId) {
        try {
            if (!window.supabase) {
                console.warn('Supabase non disponible pour sauvegarde');
                return false;
            }

            const bookingData = {
                user_id: userId,
                calcom_id: calcomBooking.id || calcomBooking.uid,
                event_type: calcomBooking.eventType || 'essai',
                start_time: calcomBooking.start || calcomBooking.startTime,
                end_time: calcomBooking.end || calcomBooking.endTime,
                status: calcomBooking.status || 'confirmed',
                meet_link: calcomBooking.meetingUrl,
                booking_data: calcomBooking,
                created_at: new Date().toISOString()
            };

            console.log('💾 Sauvegarde dans Supabase:', bookingData);

            const { error } = await supabase
                .from('bookings')
                .insert([bookingData]);

            if (error) {
                console.warn('Erreur sauvegarde Supabase:', error);
                return false;
            }
            
            console.log('✅ Réservation sauvegardée dans Supabase');
            return true;
            
        } catch (error) {
            console.error('Exception sauvegarde Supabase:', error);
            return false;
        }
    }

    // Obtenir la date d'aujourd'hui au format YYYY-MM-DD
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
                month: 'long',
                year: 'numeric'
            });
        } catch (error) {
            console.warn('Erreur formatage date:', error);
            return dateTime || 'Date non disponible';
        }
    }

    // Formater la date pour l'affichage
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
}

// Initialiser le gestionnaire de réservations
window.bookingManager = new BookingManager();

// Fonction de débogage pour vérifier la configuration
window.debugCalcomConfig = async function() {
    const config = window.YOTEACHER_CONFIG || {};
    const manager = window.bookingManager;
    
    console.group('🔧 Debug Configuration Cal.com');
    console.log('API Key présente:', !!config.CALCOM_API_KEY);
    console.log('Username configuré:', config.CALCOM_USERNAME);
    console.log('Event Type IDs:', manager.eventTypeMap);
    console.log('Fuseau horaire:', manager.timeZone);
    console.log('URL API:', manager.apiBaseUrl);
    
    // Tester la connexion API avec l'endpoint /event-types
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
            
            if (response.ok) {
                const result = await response.json();
                const data = result.data || result;
                console.log('✅ Connexion API réussie');
                console.log('Event types disponibles:', data.eventTypes || data);
                
                // Vérifier chaque event type configuré
                Object.entries(manager.eventTypeMap).forEach(([key, value]) => {
                    if (value) {
                        const eventTypes = data.eventTypes || [];
                        const found = eventTypes.find(e => e.id == value || e.id === parseInt(value));
                        console.log(`${key} (ID: ${value}):`, found ? `✅ Trouvé: "${found.title}"` : '❌ Non trouvé');
                    } else {
                        console.log(`${key}: ❌ Non configuré`);
                    }
                });
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
    
    // Tester la récupération de créneaux
    console.log('\n🧪 Test récupération créneaux:');
    try {
        const slots = await manager.getAvailableSlots('essai');
        console.log(`📅 Créneaux disponibles: ${slots.length}`);
        if (slots.length > 0) {
            slots.slice(0, 3).forEach(slot => {
                console.log(`  • ${manager.formatTime(slot.start)} (${slot.duration})`);
            });
            if (slots.length > 3) console.log(`  ... et ${slots.length - 3} autres`);
        }
    } catch (error) {
        console.error('❌ Erreur récupération créneaux:', error.message);
    }
    
    console.groupEnd();
};

// Vérification de configuration au démarrage
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        console.log('🔧 BookingManager configuré avec API v2');
        console.log('Configuration:', {
            hasApiKey: !!window.YOTEACHER_CONFIG?.CALCOM_API_KEY,
            eventTypes: window.bookingManager?.eventTypeMap,
            apiVersion: 'v2',
            baseUrl: window.bookingManager?.apiBaseUrl
        });
        
        // Afficher un avertissement si en mode développement sans clé API
        if ((window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) && 
            !window.YOTEACHER_CONFIG?.CALCOM_API_KEY) {
            console.warn('⚠️ Mode développement : Aucune clé API Cal.com configurée. Les créneaux seront simulés.');
            
            // Afficher une notification à l'utilisateur
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
            devWarning.textContent = 'Mode développement : Créneaux simulés';
            document.body.appendChild(devWarning);
            
            setTimeout(() => {
                if (devWarning.parentElement) devWarning.remove();
            }, 10000);
        }
        
        // Lancer le debug si en mode développement et demandé
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('debug') === 'calcom') {
            window.debugCalcomConfig();
        }
    }, 1000);
});

// Fonction utilitaire pour tester rapidement depuis la console
window.testCalcomSlots = async function(date = null, eventType = 'essai') {
    console.log(`🧪 Test Cal.com slots pour ${eventType} le ${date || 'aujourd\'hui'}`);
    try {
        const slots = await window.bookingManager.getAvailableSlots(eventType, date);
        console.log(`✅ ${slots.length} créneau(x) trouvé(s):`);
        slots.forEach(slot => {
            console.log(`  • ${window.bookingManager.formatTime(slot.start)} (${slot.duration})`);
        });
        return slots;
    } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
        return [];
    }
};

// Fonction pour tester plusieurs dates
window.testMultipleDates = async function(eventType = 'essai', daysAhead = 7) {
    console.log(`🧪 Test sur ${daysAhead} jours à venir...`);
    const results = [];
    
    for (let i = 0; i < daysAhead; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        console.log(`\n📅 Test pour ${dateStr}:`);
        try {
            const slots = await window.bookingManager.getAvailableSlots(eventType, dateStr);
            console.log(`   ${slots.length} créneaux trouvés`);
            results.push({ date: dateStr, count: slots.length, slots });
        } catch (error) {
            console.error(`   Erreur: ${error.message}`);
            results.push({ date: dateStr, count: 0, error: error.message });
        }
        
        // Petit délai pour ne pas surcharger l'API
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Résumé:');
    const totalSlots = results.reduce((sum, r) => sum + r.count, 0);
    console.log(`Total de ${totalSlots} créneaux trouvés sur ${daysAhead} jours`);
    results.forEach(r => {
        if (r.count > 0) {
            console.log(`  • ${r.date}: ${r.count} créneaux`);
        }
    });
    
    return results;
};

// Fonction pour vérifier la santé de l'API
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
        }
        
        return response.ok;
    } catch (error) {
        console.error('❌ Erreur santé API:', error.message);
        return false;
    }
};