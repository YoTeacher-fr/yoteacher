// booking.js - Gestion des réservations avec Cal.com (API v2) - VERSION CORRIGÉE DOUBLE DÉDUCTION
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
        this.rateLimitInfo = { limit: 120, remaining: 120, reset: null };
        
        // VERROU DE SÉCURITÉ : Empêche les doubles clics/soumissions
        this.isBookingInProgress = false;
        
        console.log('📅 BookingManager initialisé - Version corrigée');
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

    async getAvailableSlots(eventType = 'essai', date = null, duration = null) {
        try {
            this.checkCalcomConfig();

            const targetDate = date || this.getToday();
            const eventTypeId = this.eventTypeMap[eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${eventType}" non configuré dans Cal.com`);
            }

            console.log(`🔍 Recherche créneaux pour eventTypeId: ${eventTypeId}, date: ${targetDate}`);

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
                if (response.status === 429) throw new Error('Rate limit atteint. Veuillez patienter.');
                try {
                    const errorData = JSON.parse(errorText);
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
                            time: startDate.toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            }),
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
            console.error('❌ Erreur Cal.com:', error);
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                return this.generateMockSlots(date, eventType, duration);
            }
            throw new Error(`Impossible de charger les créneaux : ${error.message}`);
        }
    }

    calculateEndTime(startTime, eventType, customDuration = null) {
        try {
            const start = new Date(startTime);
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

    async canUseCredit(bookingData) {
        const user = window.authManager?.getCurrentUser();
        if (!user || !window.packagesManager) return false;
        if (bookingData.packageQuantity && bookingData.packageQuantity > 1) return false;
        if (bookingData.courseType === 'essai') return false;
        
        try {
            const credits = await window.packagesManager.getUserCredits(user.id);
            return credits[bookingData.courseType] > 0;
        } catch (error) {
            return false;
        }
    }

    async createBooking(bookingData) {
        // PROTECTION DOUBLE SOUMISSION
        if (this.isBookingInProgress) {
            console.warn('🚫 Réservation déjà en cours, clic ignoré.');
            return { success: false, error: 'Traitement déjà en cours' };
        }

        this.isBookingInProgress = true;

        try {
            console.group('🎯 DÉBUT createBooking');
            const user = window.authManager?.getCurrentUser();
            
            const isCreditBooking = await this.canUseCredit(bookingData);
            const isPackagePurchase = bookingData.packageQuantity && bookingData.packageQuantity > 1;
            
            // FLUX 1: Réservation avec crédit existant
            if (isCreditBooking && !isPackagePurchase) {
                console.log('🚀 FLUX 1: Réservation avec crédit existant');
                return await this.createBookingWithCredit(bookingData);
            }
            
            // FLUX 2: Achat de forfait + réservation immédiate
            if (isPackagePurchase) {
                console.log('🚀 FLUX 2: Achat de forfait + réservation immédiate');
                return await this.preparePackagePurchase(bookingData);
            }
            
            // FLUX 3: Réservation simple (payer maintenant)
            console.log('🚀 FLUX 3: Réservation simple - paiement normal');
            return await this.prepareRegularBooking(bookingData);
            
        } catch (error) {
            console.error('❌ Erreur création réservation:', error);
            return { 
                success: false, 
                error: `Échec de la préparation : ${error.message}` 
            };
        } finally {
            // Toujours relâcher le verrou à la fin
            this.isBookingInProgress = false;
        }
    }

    async createBookingWithCredit(bookingData) {
        try {
            console.log('🎫 Début création réservation AVEC CRÉDIT');
            
            const user = window.authManager?.getCurrentUser();
            if (!user) throw new Error('Utilisateur non connecté');
            
            // CORRECTION DOUBLE DÉDUCTION : 
            // Créer un ID stable basé sur les données de réservation (à la minute près)
            // Cela permet à packages.js de détecter si cet appel est un doublon
            const timeFingerprint = Math.floor(new Date().getTime() / 60000); // Même minute
            const idempotencyKey = `credit_${user.id}_${bookingData.courseType}_${timeFingerprint}`;
            
            console.log('💰 Utilisation d\'un crédit avec ID stable:', idempotencyKey);
            
            // 1. Utiliser un crédit
            const creditResult = await window.packagesManager.useCredit(
                user.id,
                bookingData.courseType,
                { 
                    id: idempotencyKey, // Utilisation de l'ID stable au lieu de temp_Date.now()
                    duration: bookingData.duration || 60 
                }
            );
            
            if (!creditResult.success) {
                // Si packages.js détecte un doublon, il renverra une erreur ici, bloquant la 2ème déduction
                throw new Error(`Impossible d'utiliser un crédit: ${creditResult.error}`);
            }
            
            // 2. Préparer les données pour la réservation
            const bookingForCalcom = {
                startTime: bookingData.startTime,
                endTime: bookingData.endTime || this.calculateEndTime(bookingData.startTime, bookingData.courseType, bookingData.duration),
                eventType: bookingData.eventType || bookingData.courseType,
                courseType: bookingData.courseType,
                duration: bookingData.duration || 60,
                location: bookingData.location || 'integrations:google:meet',
                name: bookingData.name,
                email: bookingData.email,
                notes: bookingData.notes || '',
                userId: user.id,
                timeZone: this.timeZone,
                language: 'fr',
                price: 0,
                currency: null,
                paymentMethod: 'credit',
                transactionId: `CREDIT-${Date.now()}`,
                packageId: creditResult.package_id,
                status: 'confirmed',
                isCreditBooking: true,
                isPackage: false,
                packageQuantity: 1
            };
            
            // 3. Créer la réservation sur Cal.com
            const bookingResult = await this.createBookingAfterPayment(bookingForCalcom);
            
            if (!bookingResult.success) {
                throw new Error(`Échec création réservation: ${bookingResult.error}`);
            }
            
            // 4. Préparer les données pour la page de succès
            const finalBookingData = {
                ...bookingForCalcom,
                calcomId: bookingResult.data?.id || bookingResult.data?.uid,
                meetingLink: bookingResult.data?.location,
                bookingNumber: `BK-CREDIT-${Date.now().toString().slice(-8)}`,
                confirmedAt: new Date().toISOString(),
                supabaseBookingId: bookingResult.supabaseBookingId
            };
            
            return {
                success: true,
                bookingData: finalBookingData,
                redirectTo: `payment-success.html?booking=${encodeURIComponent(JSON.stringify(finalBookingData))}`,
                message: 'Réservation avec crédit confirmée'
            };
            
        } catch (error) {
            console.error('❌ Erreur création réservation avec crédit:', error);
            return { success: false, error: error.message };
        }
    }

    async preparePackagePurchase(bookingData) {
        // ... (Code existant inchangé pour le flux achat forfait)
        const user = window.authManager?.getCurrentUser();
        const duration = bookingData.duration || 60;
        const quantity = bookingData.packageQuantity || 1;
        const discount = bookingData.discountPercent || 0;
        
        let priceEUR = 0;
        const basePrice = this.getDefaultPrice(bookingData.courseType, duration);
        priceEUR = basePrice * quantity * (1 - discount / 100);
        
        const currentCurrency = window.currencyManager?.currentCurrency || 'EUR';
        let finalPrice = window.currencyManager ? window.currencyManager.convert(priceEUR, 'EUR', currentCurrency) : priceEUR;
        
        const completeBookingData = {
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            eventType: bookingData.eventType || bookingData.courseType,
            courseType: bookingData.courseType,
            duration: duration,
            location: bookingData.location || 'integrations:google:meet',
            name: bookingData.name,
            email: bookingData.email,
            notes: bookingData.notes || '',
            userId: user?.id || null,
            timeZone: this.timeZone,
            language: 'fr',
            price: finalPrice,
            currency: currentCurrency,
            priceEUR: priceEUR,
            isPackagePurchase: true,
            isCreditBooking: false,
            packageQuantity: quantity,
            discountPercent: discount,
            packageCredits: quantity,
            status: 'pending_payment'
        };
        
        localStorage.setItem('pendingBooking', JSON.stringify(completeBookingData));
        
        return {
            success: true,
            bookingData: completeBookingData,
            redirectTo: `payment.html?booking=${encodeURIComponent(JSON.stringify(completeBookingData))}`,
            message: 'Redirection vers le paiement pour achat forfait...'
        };
    }

    async prepareRegularBooking(bookingData) {
        // ... (Code existant inchangé pour le flux normal)
        const user = window.authManager?.getCurrentUser();
        const duration = bookingData.duration || 60;
        const quantity = bookingData.packageQuantity || 1;
        const discount = bookingData.discountPercent || 0;
        
        let priceEUR = 0;
        const basePrice = this.getDefaultPrice(bookingData.courseType, duration);
        priceEUR = basePrice * quantity * (1 - discount / 100);
        
        const currentCurrency = window.currencyManager?.currentCurrency || 'EUR';
        let finalPrice = window.currencyManager ? window.currencyManager.convert(priceEUR, 'EUR', currentCurrency) : priceEUR;
        
        const completeBookingData = {
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            eventType: bookingData.eventType || bookingData.courseType,
            courseType: bookingData.courseType,
            duration: duration,
            location: bookingData.location || 'integrations:google:meet',
            name: bookingData.name,
            email: bookingData.email,
            notes: bookingData.notes || '',
            userId: user?.id || null,
            timeZone: this.timeZone,
            language: 'fr',
            price: finalPrice,
            currency: currentCurrency,
            priceEUR: priceEUR,
            isPackagePurchase: false,
            isCreditBooking: false,
            packageQuantity: quantity,
            discountPercent: discount,
            status: 'pending_payment'
        };
        
        localStorage.setItem('pendingBooking', JSON.stringify(completeBookingData));
        
        return {
            success: true,
            bookingData: completeBookingData,
            redirectTo: `payment.html?booking=${encodeURIComponent(JSON.stringify(completeBookingData))}`,
            message: 'Redirection vers le paiement...'
        };
    }

    getDefaultPrice(courseType, duration = 60) {
        const basePrices = { 'essai': 5, 'conversation': 20, 'curriculum': 35, 'examen': 30 };
        let price = basePrices[courseType] || 20;
        if (courseType !== 'essai') price = price * (duration / 60);
        return price;
    }

    async createBookingAfterPayment(bookingData) {
        // ... (Code existant inchangé, gestion de l'appel API Cal.com)
        try {
            this.checkCalcomConfig();
            const user = window.authManager?.getCurrentUser();
            const eventTypeId = this.eventTypeMap[bookingData.eventType];
            
            if (!eventTypeId) throw new Error(`Type de cours "${bookingData.eventType}" non configuré`);

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
                    currency: String(bookingData.currency || 'EUR'),
                    notes: String(bookingData.notes || ''),
                    duration: String(bookingData.duration || ''),
                    isVip: String(window.authManager?.isUserVip() || 'false'),
                    quantity: String(bookingData.packageQuantity || '1'),
                    discount: String(bookingData.discountPercent || '0'),
                    isCreditBooking: String(bookingData.isCreditBooking || 'false')
                }
            };

            if (bookingData.location) bookingPayload.location = bookingData.location;

            if (bookingData.eventType !== 'essai' && bookingData.duration) {
                const requestedDuration = parseInt(bookingData.duration);
                bookingPayload.lengthInMinutes = requestedDuration;
                
                const defaultDuration = this.getDefaultDuration(bookingData.eventType);
                if (requestedDuration !== defaultDuration && this.apiBaseUrl.includes('/v2/')) {
                    bookingPayload.duration = requestedDuration;
                }
            }

            const response = await fetch(`${this.apiBaseUrl}/bookings`, {
                method: 'POST',
                headers: this.getAuthHeaders('bookings'),
                body: JSON.stringify(bookingPayload)
            });

            this.updateRateLimitInfo(response);

            if (!response.ok) {
                const errorText = await response.text();
                // Tentative de retry automatique sans durée si erreur
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.message && (errorData.message.includes('duration') || errorData.message.includes('length'))) {
                        delete bookingPayload.lengthInMinutes;
                        delete bookingPayload.duration;
                        const retryResponse = await fetch(`${this.apiBaseUrl}/bookings`, {
                            method: 'POST',
                            headers: this.getAuthHeaders('bookings'),
                            body: JSON.stringify(bookingPayload)
                        });
                        if (!retryResponse.ok) throw new Error('Échec même sans durée spécifique');
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
            const bookingId = await this.saveBookingToSupabase(data, user, bookingData, 'confirmed');
            
            return { 
                success: true, 
                data,
                supabaseBookingId: bookingId,
                message: 'Réservation confirmée sur Cal.com' 
            };
            
        } catch (error) {
            console.error('❌ Erreur création réservation après paiement:', error);
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                return this.mockBookingAfterPayment(bookingData);
            }
            throw new Error(`Échec création réservation : ${error.message}`);
        }
    }

    async saveBookingToSupabase(calcomBooking, user, bookingData, status = 'confirmed') {
        if (!window.supabase) return null;
        try {
            const bookingNumber = `BK-${Date.now().toString().slice(-8)}`;
            let platformValue = this.getPlatformName(bookingData.location);
            const allowedPlatforms = ['meet', 'zoom', 'teams', 'other'];
            if (!allowedPlatforms.includes(platformValue)) platformValue = 'zoom';

            const bookingRecord = {
                user_id: user?.id || bookingData.userId,
                course_type: bookingData.courseType,
                duration_minutes: bookingData.duration || 60,
                start_time: bookingData.startTime,
                end_time: bookingData.endTime,
                status: status,
                price_paid: bookingData.packageId ? 0 : bookingData.price,
                currency: bookingData.packageId ? null : bookingData.currency,
                platform: platformValue,
                booking_number: bookingNumber,
                payment_method: bookingData.paymentMethod || 'credit',
                payment_reference: bookingData.transactionId,
                calcom_booking_id: calcomBooking.id || calcomBooking.uid,
                calcom_uid: calcomBooking.uid,
                meeting_link: calcomBooking.location || calcomBooking.meetingUrl,
                created_at: new Date().toISOString()
            };

            if (bookingData.packageId) bookingRecord.package_id = bookingData.packageId;

            const { data, error } = await supabase.from('bookings').insert([bookingRecord]).select();
            if (error) {
                console.error('❌ Erreur insertion:', error);
                // Logique de retry simplifiée pour garder le code propre
                return null;
            }
            return data[0].id;
        } catch (error) {
            console.error('Exception sauvegarde Supabase:', error);
            return null;
        }
    }

    getPlatformName(location) {
        if (!location) return 'zoom';
        const cleanLocation = String(location).trim().toLowerCase();
        if (cleanLocation.includes('google') || cleanLocation.includes('meet')) return 'meet';
        if (cleanLocation.includes('teams') || cleanLocation.includes('microsoft')) return 'teams';
        return 'zoom';
    }

    getToday() {
        return new Date().toISOString().split('T')[0];
    }

    updateRateLimitInfo(response) {
        if (response.headers) {
            const limit = response.headers.get('X-RateLimit-Limit');
            const remaining = response.headers.get('X-RateLimit-Remaining');
            if (limit) this.rateLimitInfo.limit = parseInt(limit);
            if (remaining) this.rateLimitInfo.remaining = parseInt(remaining);
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
                    attendees: [{ email: bookingData.email, name: bookingData.name }],
                    location: bookingData.location || 'integrations:zoom'
                };
                resolve({ success: true, data: mockBooking, supabaseBookingId: `mock_${Date.now()}` });
            }, 1000);
        });
    }
}

function initializeBookingManager() {
    try {
        if (!window.bookingManager) {
            window.bookingManager = new BookingManager();
        }
        return window.bookingManager;
    } catch (error) {
        return null;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBookingManager);
} else {
    initializeBookingManager();
}
window.bookingManager = initializeBookingManager();