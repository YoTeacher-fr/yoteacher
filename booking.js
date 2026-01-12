// booking.js - Gestion des réservations avec Cal.com - VERSION CORRIGÉE POUR CRÉDIT SEULEMENT
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
        
        this.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.rateLimitInfo = { limit: 120, remaining: 120, reset: null };
        
        console.log('📅 BookingManager initialisé - Version crédit corrigée');
    }

    async getAvailableSlots(eventType = 'essai', date = null, duration = null) {
        try {
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
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.calcomApiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Cal.com: ${errorText}`);
            }
            
            const data = await response.json();
            
            if (!data || !data.data) {
                console.warn('Aucun créneau disponible');
                return [];
            }
            
            const slotsData = data.data;
            const formattedSlots = Object.entries(slotsData).flatMap(([date, slots]) => {
                if (!Array.isArray(slots)) return [];
                
                return slots.map(slot => {
                    const slotTime = slot.start || slot.time || slot;
                    const startDate = new Date(slotTime);
                    
                    return {
                        id: slotTime,
                        start: slotTime,
                        end: this.calculateEndTime(slotTime, eventType, duration),
                        time: startDate.toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        }),
                        duration: `${duration || 60} min`,
                        durationInMinutes: duration || 60,
                        eventTypeId: eventTypeId
                    };
                }).filter(slot => slot !== null);
            });
            
            console.log(`✅ ${formattedSlots.length} créneau(x) disponible(s)`);
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
            console.error('Erreur calculateEndTime:', error);
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
        console.log('🔍 Vérification crédit:', bookingData);
        
        const user = window.authManager?.getCurrentUser();
        if (!user || !window.packagesManager) {
            console.log('❌ Pas d\'utilisateur ou packagesManager');
            return false;
        }
        
        // Uniquement pour 1 cours (pas les forfaits)
        if (bookingData.packageQuantity && bookingData.packageQuantity > 1) {
            console.log('❌ PackageQuantity > 1 - pas de crédit');
            return false;
        }
        
        // Uniquement pour les cours payants (pas essai)
        if (bookingData.courseType === 'essai') {
            console.log('❌ Cours d\'essai - pas de crédit');
            return false;
        }
        
        try {
            const credits = await window.packagesManager.getUserCredits(user.id);
            const hasCredits = credits[bookingData.courseType] > 0;
            console.log('✅ Peut utiliser crédit?', hasCredits);
            return hasCredits;
        } catch (error) {
            console.warn('Erreur vérification crédits:', error);
            return false;
        }
    }

    async createBooking(bookingData) {
        try {
            console.group('🎯 DÉBUT createBooking');
            console.log('Données reçues:', bookingData);
            
            const user = window.authManager?.getCurrentUser();
            
            // VÉRIFIER SI ON PEUT UTILISER UN CRÉDIT
            const canUseCredit = await this.canUseCredit(bookingData);
            const isPackagePurchase = bookingData.packageQuantity && bookingData.packageQuantity > 1;
            
            console.log('Flux déterminé:', {
                canUseCredit,
                isPackagePurchase,
                packageQuantity: bookingData.packageQuantity
            });
            
            // FLUX 1: Réservation avec crédit existant (1 cours seulement)
            if (canUseCredit && !isPackagePurchase) {
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
        }
    }

    async createBookingWithCredit(bookingData) {
        console.group('🎫 CRÉATION RÉSERVATION AVEC CRÉDIT');
        
        try {
            const user = window.authManager?.getCurrentUser();
            if (!user) {
                throw new Error('Utilisateur non connecté');
            }
            
            console.log('👤 Utilisateur:', user.email);
            
            // 1. Utiliser un crédit IMMÉDIATEMENT
            console.log('💰 Utilisation d\'un crédit...');
            const creditResult = await window.packagesManager.useCredit(
                user.id,
                bookingData.courseType,
                { 
                    id: `temp_${Date.now()}`,
                    duration: bookingData.duration || 60,
                    source: 'booking_with_credit',
                    timestamp: Date.now()
                }
            );
            
            console.log('📦 Résultat utilisation crédit:', creditResult);
            
            if (!creditResult.success) {
                if (creditResult.alreadyUsed) {
                    console.warn('⚠️ Crédit déjà utilisé pour cette réservation');
                } else {
                    throw new Error(`Impossible d'utiliser un crédit: ${creditResult.error}`);
                }
            }
            
            console.log('✅ Crédit utilisé, package_id:', creditResult.package_id);
            
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
                
                // Informations crédit
                price: 0,
                currency: null,
                paymentMethod: 'credit',
                transactionId: `CREDIT-${Date.now()}`,
                packageId: creditResult.package_id,
                status: 'confirmed',
                isCreditBooking: true, // IMPORTANT
                isPackage: false,
                packageQuantity: 1,
                skipCreditDeduction: true // IMPORTANT: pour éviter double déduction
            };
            
            console.log('📤 Données pour Cal.com:', bookingForCalcom);
            
            // 3. Créer la réservation sur Cal.com
            const bookingResult = await this.createBookingAfterPayment(bookingForCalcom);
            
            console.log('📥 Résultat création réservation:', bookingResult);
            
            if (!bookingResult.success) {
                console.error('❌ Échec création réservation après utilisation crédit');
                throw new Error(`Échec création réservation: ${bookingResult.error}`);
            }
            
            // 4. Préparer les données pour la page de succès
            const finalBookingData = {
                ...bookingForCalcom,
                calcomId: bookingResult.data?.id || bookingResult.data?.uid,
                meetingLink: bookingResult.data?.location,
                bookingNumber: `BK-CREDIT-${Date.now().toString().slice(-8)}`,
                confirmedAt: new Date().toISOString(),
                supabaseBookingId: bookingResult.supabaseBookingId,
                creditUsed: true,
                creditTransactionId: creditResult.package_id ? `CT-${creditResult.package_id}` : null
            };
            
            console.log('✅ Réservation avec crédit créée avec succès');
            console.groupEnd();
            
            return {
                success: true,
                bookingData: finalBookingData,
                redirectTo: `payment-success.html?booking=${encodeURIComponent(JSON.stringify(finalBookingData))}`,
                message: 'Réservation avec crédit confirmée'
            };
            
        } catch (error) {
            console.error('❌ Erreur création réservation avec crédit:', error);
            console.groupEnd();
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async createBookingAfterPayment(bookingData) {
        try {
            console.group('📅 CRÉATION RÉSERVATION APRÈS PAIEMENT');
            console.log('Données:', {
                courseType: bookingData.courseType,
                isCreditBooking: bookingData.isCreditBooking,
                isPackagePurchase: bookingData.isPackagePurchase,
                packageId: bookingData.packageId
            });

            const user = window.authManager?.getCurrentUser();
            const eventTypeId = this.eventTypeMap[bookingData.eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${bookingData.eventType}" non configuré`);
            }

            // IMPORTANT: Si c'est une réservation avec crédit, NE PAS déduire de crédit ici
            if (bookingData.isCreditBooking) {
                console.log('⚠️ Réservation crédit - pas de déduction de crédit ici');
            }
            
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

            if (bookingData.location) {
                bookingPayload.location = bookingData.location;
                console.log('📍 Location ajoutée:', bookingData.location);
            }

            if (bookingData.eventType !== 'essai' && bookingData.duration) {
                const requestedDuration = parseInt(bookingData.duration);
                bookingPayload.lengthInMinutes = requestedDuration;
            }

            console.log('📤 Création réservation Cal.com');

            const response = await fetch(
                `${this.apiBaseUrl}/bookings`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.calcomApiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(bookingPayload)
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erreur création réservation Cal.com:', errorText);
                throw new Error(`API Cal.com: ${errorText}`);
            }

            const result = await response.json();
            const data = result.data || result;
            console.log('✅ Réservation créée sur Cal.com:', data);
            
            // Sauvegarder dans Supabase
            const bookingId = await this.saveBookingToSupabase(data, user, bookingData, 'confirmed');
            
            console.groupEnd();
            
            return { 
                success: true, 
                data,
                supabaseBookingId: bookingId,
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

    async saveBookingToSupabase(calcomBooking, user, bookingData, status = 'confirmed') {
        try {
            if (!window.supabase) {
                console.warn('Supabase non disponible pour sauvegarde');
                return null;
            }

            const bookingNumber = `BK-${Date.now().toString().slice(-8)}`;

            let platformValue = 'zoom';
            if (bookingData.location) {
                const cleanLocation = String(bookingData.location).toLowerCase();
                if (cleanLocation.includes('google') || cleanLocation.includes('meet')) {
                    platformValue = 'meet';
                } else if (cleanLocation.includes('teams') || cleanLocation.includes('microsoft')) {
                    platformValue = 'teams';
                } else if (cleanLocation.includes('zoom')) {
                    platformValue = 'zoom';
                }
            }

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

            if (bookingData.packageId) {
                bookingRecord.package_id = bookingData.packageId;
            }

            console.log('💾 Insertion dans Supabase');

            const { data, error } = await supabase
                .from('bookings')
                .insert([bookingRecord])
                .select();

            if (error) {
                console.error('❌ Erreur insertion:', error);
                return null;
            }

            console.log('✅ Réservation sauvegardée avec ID:', data[0].id);
            return data[0].id;
            
        } catch (error) {
            console.error('Exception sauvegarde Supabase:', error);
            return null;
        }
    }

    async preparePackagePurchase(bookingData) {
        console.log('📦 Préparation achat forfait + réservation');
        
        const user = window.authManager?.getCurrentUser();
        const duration = bookingData.duration || 60;
        const quantity = bookingData.packageQuantity || 1;
        const discount = bookingData.discountPercent || 0;
        
        // Calculer le prix
        let priceEUR = 0;
        const basePrice = this.getDefaultPrice(bookingData.courseType, duration);
        priceEUR = basePrice * quantity * (1 - discount / 100);
        
        const currentCurrency = window.currencyManager?.currentCurrency || 'EUR';
        let finalPrice = priceEUR;
        
        if (window.currencyManager) {
            finalPrice = window.currencyManager.convert(priceEUR, 'EUR', currentCurrency);
        }
        
        const completeBookingData = {
            startTime: bookingData.startTime,
            endTime: bookingData.endTime || this.calculateEndTime(bookingData.startTime, bookingData.courseType, duration),
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
            
            // Informations forfait
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
        
        console.log('📤 Données achat forfait:', completeBookingData);
        
        localStorage.setItem('pendingBooking', JSON.stringify(completeBookingData));
        
        return {
            success: true,
            bookingData: completeBookingData,
            redirectTo: `payment.html?booking=${encodeURIComponent(JSON.stringify(completeBookingData))}`,
            message: 'Redirection vers le paiement...'
        };
    }

    async prepareRegularBooking(bookingData) {
        console.log('💰 Préparation réservation simple');
        
        const user = window.authManager?.getCurrentUser();
        const duration = bookingData.duration || 60;
        const quantity = bookingData.packageQuantity || 1;
        const discount = bookingData.discountPercent || 0;
        
        // Calculer le prix
        let priceEUR = 0;
        const basePrice = this.getDefaultPrice(bookingData.courseType, duration);
        priceEUR = basePrice * quantity * (1 - discount / 100);
        
        const currentCurrency = window.currencyManager?.currentCurrency || 'EUR';
        let finalPrice = priceEUR;
        
        if (window.currencyManager) {
            finalPrice = window.currencyManager.convert(priceEUR, 'EUR', currentCurrency);
        }
        
        const completeBookingData = {
            startTime: bookingData.startTime,
            endTime: bookingData.endTime || this.calculateEndTime(bookingData.startTime, bookingData.courseType, duration),
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
            
            // Informations paiement
            price: finalPrice,
            currency: currentCurrency,
            priceEUR: priceEUR,
            isPackagePurchase: false,
            isCreditBooking: false,
            packageQuantity: quantity,
            discountPercent: discount,
            status: 'pending_payment'
        };
        
        console.log('📤 Données réservation simple:', completeBookingData);
        
        localStorage.setItem('pendingBooking', JSON.stringify(completeBookingData));
        
        return {
            success: true,
            bookingData: completeBookingData,
            redirectTo: `payment.html?booking=${encodeURIComponent(JSON.stringify(completeBookingData))}`,
            message: 'Redirection vers le paiement...'
        };
    }

    getDefaultPrice(courseType, duration = 60) {
        const basePrices = {
            'essai': 5,
            'conversation': 20,
            'curriculum': 35,
            'examen': 30
        };
        
        let price = basePrices[courseType] || 20;
        
        if (courseType !== 'essai') {
            const ratio = duration / 60;
            price = price * ratio;
        }
        
        return price;
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
                resolve({ success: true, data: mockBooking, supabaseBookingId: `mock_${Date.now()}` });
            }, 1000);
        });
    }

    getToday() {
        return new Date().toISOString().split('T')[0];
    }

    formatTime(dateTime) {
        try {
            const date = new Date(dateTime);
            return date.toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit'
            });
        } catch (error) {
            return dateTime || 'Date non disponible';
        }
    }
}

// Initialisation
function initializeBookingManager() {
    try {
        if (!window.bookingManager) {
            window.bookingManager = new BookingManager();
            console.log('✅ BookingManager initialisé avec succès');
        }
        return window.bookingManager;
    } catch (error) {
        console.error('❌ Erreur initialisation BookingManager:', error);
        return null;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeBookingManager();
    });
} else {
    initializeBookingManager();
}

window.bookingManager = initializeBookingManager();
console.log('✅ booking.js chargé - Version simplifiée pour crédit');