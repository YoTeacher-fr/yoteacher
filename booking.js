// booking.js - VERSION DB-DRIVEN (Logique métier dans Supabase)
// ✅ Calcul de prix : SUPPRIMÉ → géré par create_booking_intent()
// ✅ Déduction crédit : DÉLÉGUÉE → géré par create_booking_with_credit()
// ✅ Validation : DÉLÉGUÉE → gérée par triggers
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
        
        console.log('📅 BookingManager initialisé (version DB-driven)');
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

            console.log(`🔍 Recherche créneaux pour eventTypeId: ${eventTypeId}, date: ${targetDate}, durée: ${duration || 'défaut'} min`);

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
                    throw new Error('Rate limit atteint. Veuillez patienter.');
                }
                
                throw new Error(`API Cal.com: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data || !data.data || typeof data.data !== 'object') {
                console.warn('Aucun créneau disponible');
                return [];
            }
            
            const slotsData = data.data;
            const formattedSlots = Object.entries(slotsData).flatMap(([date, slots]) => {
                if (!Array.isArray(slots)) {
                    return [];
                }
                
                return slots.map(slot => {
                    const slotTime = slot.start || slot.time || slot;
                    
                    try {
                        const startDate = new Date(slotTime);
                        if (isNaN(startDate.getTime())) {
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
                        return null;
                    }
                }).filter(slot => slot !== null);
            });
            
            console.log(`✅ ${formattedSlots.length} créneau(x) disponible(s)`);
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
                console.error('Date invalide:', startTime);
                return null;
            }
            
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
        
        console.log(`⚠️ Mode simulation: ${slots.length} créneaux générés`);
        return slots;
    }

    // ============================================================================
    // VÉRIFICATION CRÉDIT (conservée car appelle RPC)
    // ============================================================================
    async canUseCredit(bookingData) {
        console.log('🔍 Vérification crédit possible:', bookingData);
        
        const user = window.authManager?.getCurrentUser();
        if (!user || !window.packagesManager) {
            return false;
        }
        
        if (bookingData.packageQuantity && bookingData.packageQuantity > 1) {
            return false;
        }
        
        if (bookingData.courseType === 'essai') {
            return false;
        }
        
        try {
            const duration = bookingData.duration || 60;
            const hasCredits = await window.packagesManager.hasCreditForDuration(
                user.id, 
                bookingData.courseType, 
                duration
            );
            console.log(`🔍 Crédits disponibles pour ${bookingData.courseType} (${duration}min):`, hasCredits);
            return hasCredits;
        } catch (error) {
            console.warn('Erreur vérification crédits:', error);
            return false;
        }
    }

    // ============================================================================
    // FLUX CRÉDIT - APPELLE create_booking_with_credit()
    // ============================================================================
async createBookingWithCredit(bookingData) {
    try {
        console.log('🎫 Début création réservation AVEC CRÉDIT');
        
        const user = window.authManager?.getCurrentUser();
        if (!user) {
            throw new Error('Utilisateur non connecté');
        }
        
        const duration = bookingData.duration || 60;
        
        // Vérifier crédit disponible
        if (window.packagesManager) {
            const hasCredit = await window.packagesManager.hasCreditForDuration(
                user.id, 
                bookingData.courseType, 
                duration
            );
            if (!hasCredit) {
                throw new Error(`Aucun crédit disponible pour un cours de ${duration} minutes`);
            }
        }
        
        // ========================================
        // ✅ ÉTAPE 1: CRÉER LE BOOKING EN STATUS 'PENDING' DANS LA DB
        // Utiliser UNIQUEMENT les colonnes qui existent vraiment dans la table
        // ========================================
        console.log('📝 Création du booking en status pending...');
        
        const { data: pendingBooking, error: createError } = await window.supabase
            .from('bookings')
            .insert({
                user_id: user.id,
                course_type: bookingData.courseType,
                duration_minutes: duration,
                start_time: bookingData.startTime,
                end_time: bookingData.endTime || this.calculateEndTime(bookingData.startTime, bookingData.courseType, duration),
                status: 'pending',
                price_paid: 0,
                currency: bookingData.currency || 'EUR',
                platform: this.getPlatformFromLocation(bookingData.location),
                // ❌ NE PAS inclure: language, student_name, student_email, student_notes, timezone
                // Ces champs n'existent pas dans la table bookings
            })
            .select()
            .single();
        
        if (createError) {
            console.error('❌ Erreur création booking pending:', createError);
            throw new Error(`Échec création booking: ${createError.message}`);
        }
        
        console.log('✅ Booking pending créé avec ID:', pendingBooking.id);
        
        // ========================================
        // ✅ ÉTAPE 2: CONFIRMER LE BOOKING AVEC CRÉDIT VIA RPC
        // ========================================
        console.log('💰 Utilisation crédit via RPC avec booking ID:', pendingBooking.id);
        
        const { data: rpcResult, error: rpcError } = await window.supabase.rpc('create_booking_with_credit', {
            p_booking_id: pendingBooking.id
        });
        
        if (rpcError) {
            console.error('❌ Erreur RPC create_booking_with_credit:', rpcError);
            
            // Nettoyer le booking pending en cas d'erreur
            await window.supabase
                .from('bookings')
                .delete()
                .eq('id', pendingBooking.id);
            
            throw new Error(`Erreur lors de l'utilisation du crédit: ${rpcError.message}`);
        }
        
        if (!rpcResult || !rpcResult.success) {
            // Nettoyer aussi en cas d'échec de la RPC
            await window.supabase
                .from('bookings')
                .delete()
                .eq('id', pendingBooking.id);
                
            throw new Error(rpcResult?.error || 'Échec utilisation crédit');
        }
        
        console.log('✅ Crédit utilisé avec succès via RPC');
        console.log('   Package ID:', rpcResult.package_id);
        console.log('   Booking Number:', rpcResult.booking_number);
        
        // ========================================
        // ✅ ÉTAPE 3: RÉCUPÉRER LE BOOKING CONFIRMÉ
        // ========================================
        const { data: confirmedBooking, error: fetchError } = await window.supabase
            .from('bookings')
            .select('*')
            .eq('id', pendingBooking.id)
            .single();
        
        if (fetchError) {
            console.error('❌ Erreur récupération booking confirmé:', fetchError);
            // Continuer quand même car le booking est confirmé
        }
        
        // ========================================
        // ✅ ÉTAPE 4: CRÉER L'ÉVÉNEMENT CAL.COM
        // Les infos student (name, email, notes, timezone, language) vont à Cal.com
        // ========================================
        const finalBooking = confirmedBooking || pendingBooking;
        
        const bookingForCalcom = {
            startTime: finalBooking.start_time,
            endTime: finalBooking.end_time,
            eventType: finalBooking.course_type,
            location: bookingData.location || 'integrations:google:meet',
            name: bookingData.name || user.full_name || user.email,
            email: bookingData.email || user.email,
            notes: bookingData.notes || '',
            timeZone: bookingData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: bookingData.language || window.translationManager?.currentLanguage || 'fr'
        };
        
        console.log('📅 Création événement Cal.com...');
        const calcomResponse = await this.createCalcomBooking(bookingForCalcom);
        
        if (calcomResponse?.success) {
            console.log('✅ Événement Cal.com créé avec succès');
            
            // Mettre à jour avec l'ID Cal.com
            await window.supabase
                .from('bookings')
                .update({ 
                    calcom_booking_id: calcomResponse.data?.id,
                    calcom_uid: calcomResponse.data?.uid 
                })
                .eq('id', finalBooking.id);
        } else {
            console.warn('⚠️ Échec création Cal.com (non bloquant)');
        }
        
        // ========================================
        // ✅ ÉTAPE 5: ENVOYER L'EMAIL DE CONFIRMATION
        // ========================================
        console.log('📧 Envoi email de confirmation...');
        await this.sendBookingConfirmationEmail({
            ...finalBooking,
            booking_number: rpcResult.booking_number,
            student_name: bookingData.name || user.full_name,
            student_email: bookingData.email || user.email,
            student_notes: bookingData.notes || ''
        });
        
        // Actualiser les crédits
        if (window.packagesManager) {
            await window.packagesManager.loadUserPackages(user.id);
        }
        
        return {
            success: true,
            bookingData: {
                ...finalBooking,
                booking_number: rpcResult.booking_number,
                package_id: rpcResult.package_id,
                // Ajouter les infos qui ne sont pas dans la DB mais nécessaires pour le front
                student_name: bookingData.name || user.full_name,
                student_email: bookingData.email || user.email
            }
        };
        
    } catch (error) {
        console.error('❌ Erreur réservation avec crédit:', error);
        throw error;
    }
}

    // ============================================================================
    // CRÉATION RÉSERVATION - APPELLE create_booking_intent() POUR LE PRIX
    // ============================================================================
    async createBooking(bookingData) {
        try {
            const user = window.authManager?.getCurrentUser();
            
            if (!bookingData) {
                throw new Error('Données de réservation manquantes');
            }
            
            console.group('🎯 DÉBUT createBooking (DB-driven)');
            console.log('Données reçues:', bookingData);
            console.log('Utilisateur:', user?.email);
            console.groupEnd();
            
            // Vérifier si crédit disponible
            const canUseCredit = await this.canUseCredit(bookingData);
            console.log('✅ Peut utiliser crédit?', canUseCredit);
            
            if (canUseCredit) {
                console.log('🚀 Flux crédit...');
                const creditResult = await this.createBookingWithCredit(bookingData);
                
                if (creditResult.success) {
                    return creditResult;
                } else {
                    console.warn('⚠️ Échec flux crédit, passage au paiement');
                }
            }
            
// ============================================================================
// FLUX PAIEMENT - RÉUTILISER L'INTENTION DÉJÀ CRÉÉE
// ============================================================================
console.log('💰 Flux paiement (réutilisation intention existante)');

if (!window.supabase) {
    throw new Error('Supabase non disponible');
}

const requiredFields = ['startTime', 'courseType'];
for (const field of requiredFields) {
    if (!bookingData[field]) {
        throw new Error(`Champ requis manquant: ${field}`);
    }
}

const duration = bookingData.duration || 60;
const quantity = bookingData.packageQuantity || 1;

// ✅ VÉRIFIER SI UNE INTENTION EXISTE DÉJÀ (créée par updateSummary)
let intentData = null;

// Chercher une intention récente (< 5 min)
console.log('🔍 Recherche intention existante...');

const { data: existingIntents, error: searchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', user.id)
    .eq('course_type', bookingData.courseType)
    .eq('duration_minutes', duration)
    .eq('start_time', bookingData.startTime)
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // < 5 min
    .order('created_at', { ascending: false })
    .limit(1);

if (searchError) {
    console.error('❌ Erreur recherche intention:', searchError);
}

if (existingIntents && existingIntents.length > 0) {
    // ✅ RÉUTILISER L'INTENTION EXISTANTE
    const existingIntent = existingIntents[0];
    console.log('✅ Intention existante trouvée:', existingIntent.id);
    
    intentData = {
        success: true,
        intent_id: existingIntent.id,
        price: existingIntent.price_paid,
        currency: existingIntent.currency,
        can_use_credit: false, // Déjà vérifié
        is_vip: existingIntent.is_vip || false,
        discount_percent: 0
    };
} else {
    // ❌ CRÉER UNE NOUVELLE INTENTION (si aucune trouvée)
    console.log('📞 Création nouvelle intention...');
    
    const { data: newIntent, error: intentError } = await supabase.rpc('create_booking_intent', {
        p_user_id: user?.id || null,
        p_course_type: bookingData.courseType,
        p_duration: duration,
        p_start_time: bookingData.startTime,
        p_end_time: bookingData.endTime || this.calculateEndTime(bookingData.startTime, bookingData.courseType, duration),
        p_quantity: quantity,
        p_location: bookingData.location || 'integrations:google:meet'
    });
    
    if (intentError) {
        console.error('❌ Erreur create_booking_intent:', intentError);
        throw new Error('Impossible de calculer le prix: ' + intentError.message);
    }
    
    if (!newIntent || !newIntent.success) {
        throw new Error('Échec création intention: ' + (newIntent?.error || 'Erreur inconnue'));
    }
    
    intentData = newIntent;
}

console.log('✅ Intention prête:', {
    intent_id: intentData.intent_id,
    price: intentData.price,
    currency: intentData.currency,
    is_vip: intentData.is_vip
});
            
            // Construire les données complètes avec le prix DB
            const completeBookingData = {
                startTime: bookingData.startTime,
                endTime: bookingData.endTime,
                eventType: bookingData.eventType || bookingData.courseType,
                courseType: bookingData.courseType,
                
                // ✅ PRIX DEPUIS LA DB (SOURCE UNIQUE)
                price: intentData.price,
                currency: intentData.currency,
                
                duration: duration,
                location: bookingData.location,
                
                name: bookingData.name,
                email: bookingData.email,
                notes: bookingData.notes,
                userId: user?.id || null,
                timeZone: this.timeZone,
                language: 'fr',
                
                isPackage: quantity > 1,
                packageQuantity: quantity,
                packageCredits: quantity,
                discountPercent: intentData.discount_percent || 0,
                
                isVip: intentData.is_vip,
                canUseCredit: intentData.can_use_credit,
                intentId: intentData.intent_id,
                
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

    // ============================================================================
    // CRÉATION APRÈS PAIEMENT (conservée)
    // ============================================================================
    async createBookingAfterPayment(bookingData) {
        try {
            this.checkCalcomConfig();

            const user = window.authManager?.getCurrentUser();
            const eventTypeId = this.eventTypeMap[bookingData.eventType];
            
            if (!eventTypeId) {
                throw new Error(`Type de cours "${bookingData.eventType}" non configuré`);
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
                    isVip: String(bookingData.isVip || 'false'),
                    quantity: String(bookingData.packageQuantity || '1'),
                    discount: String(bookingData.discountPercent || '0'),
                    isCreditBooking: String(bookingData.isCreditBooking || 'false')
                }
            };

            if (bookingData.location) {
                bookingPayload.location = bookingData.location;
            }

            if (bookingData.eventType !== 'essai' && bookingData.duration) {
                bookingPayload.lengthInMinutes = parseInt(bookingData.duration);
            }

            console.log('📤 Création réservation Cal.com:', bookingPayload);

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
                console.error('Erreur Cal.com:', errorText);
                throw new Error(`API Cal.com: ${response.status}`);
            }

            const result = await response.json();
            const data = result.data || result;
            console.log('✅ Réservation Cal.com créée:', data);
            
            // Sauvegarder dans Supabase
            const bookingId = await this.saveBookingToSupabase(data, user, bookingData, 'confirmed');
            
            return { 
                success: true, 
                data,
                supabaseBookingId: bookingId,
                message: 'Réservation confirmée'
            };
            
        } catch (error) {
            console.error('❌ Erreur création après paiement:', error);
            
            if (window.location.hostname === 'localhost') {
                return this.mockBookingAfterPayment(bookingData);
            }
            
            throw new Error(`Échec création : ${error.message}`);
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
                    title: `Cours ${bookingData.courseType}`,
                    attendees: [{
                        email: bookingData.email,
                        name: bookingData.name
                    }],
                    location: bookingData.location
                };
                
                resolve({ success: true, data: mockBooking, supabaseBookingId: `mock_${Date.now()}` });
            }, 1000);
        });
    }

    async saveBookingToSupabase(calcomBooking, user, bookingData, status = 'confirmed') {
    try {
        if (!window.supabase) {
            console.warn('⚠️ Supabase non disponible, skip sauvegarde');
            return null;
        }

        if (bookingData.intentId) {
            console.log('📝 Mise à jour booking existant (intent_id:', bookingData.intentId + ')');
            
            const { data, error } = await supabase
                .from('bookings')
                .update({
                    status: status,
                    calcom_booking_id: calcomBooking.id || calcomBooking.uid,
                    calcom_uid: calcomBooking.uid,
                    meeting_link: calcomBooking.location || calcomBooking.meetingUrl,
                    payment_method: bookingData.paymentMethod || 'card',
                    payment_reference: bookingData.transactionId || bookingData.paymentReference,
                    package_id: bookingData.packageId || null,
                })
                .eq('id', bookingData.intentId)
                .select();

            if (error) {
                console.error('❌ Erreur UPDATE bookings:', error);
                throw new Error(`Impossible de confirmer la réservation: ${error.message}`);
            }

            if (!data || data.length === 0) {
                console.error('❌ Aucun booking trouvé avec intent_id:', bookingData.intentId);
                throw new Error('Réservation introuvable');
            }

            console.log('✅ Booking confirmé (UPDATE):', data[0].id);
            console.log('   Booking Number:', data[0].booking_number);
            console.log('   Status:', data[0].status);
            console.log('   Meeting Link:', data[0].meeting_link);
            
            return data[0].id;
        }
        
        console.log('📝 Création nouveau booking (mode legacy - pas d\'intent)');
        
        const bookingNumber = `BK-${Date.now().toString().slice(-8)}`;
        let platformValue = this.getPlatformName(bookingData.location);
        
        const allowedPlatforms = ['meet', 'zoom', 'teams', 'other'];
        if (!allowedPlatforms.includes(platformValue)) {
            platformValue = 'zoom';
        }

        const bookingRecord = {
            user_id: user?.id || bookingData.userId,
            course_type: bookingData.courseType,
            duration_minutes: bookingData.duration || 60,
            start_time: bookingData.startTime,
            end_time: bookingData.endTime,
            status: status,
            confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
            price_paid: bookingData.packageId ? 0 : (bookingData.price || null),
            currency: bookingData.packageId ? null : (bookingData.currency || null),
            platform: platformValue,
            calcom_booking_id: calcomBooking.id || calcomBooking.uid,
            calcom_uid: calcomBooking.uid,
            meeting_link: calcomBooking.location || calcomBooking.meetingUrl,
            payment_method: bookingData.paymentMethod || 'card',
            payment_reference: bookingData.transactionId,
            package_id: bookingData.packageId || null,
        };

        const { data, error } = await supabase
            .from('bookings')
            .insert([bookingRecord])
            .select();

        if (error) {
            console.error('❌ Erreur INSERT bookings:', error);
            
            if (error.message?.includes('duplicate key')) {
                throw new Error('Cette réservation existe déjà');
            } else if (error.message?.includes('foreign key')) {
                throw new Error('Erreur de référence (utilisateur ou package invalide)');
            } else {
                throw new Error(`Erreur lors de la création: ${error.message}`);
            }
        }

        if (!data || data.length === 0) {
            throw new Error('Aucune donnée retournée après insertion');
        }

        console.log('✅ Booking créé (INSERT legacy):', data[0].id);
        console.log('   Booking Number:', data[0].booking_number);
        console.log('   Price Paid:', data[0].price_paid, data[0].currency);
        
        return data[0].id;
        
    } catch (error) {
        console.error('❌ Exception saveBookingToSupabase:', error);
        
        console.group('🔍 Détails erreur');
        console.log('Error message:', error.message);
        console.log('Booking data:', {
            intentId: bookingData.intentId,
            courseType: bookingData.courseType,
            userId: user?.id
        });
        console.groupEnd();
        
        return null;
    }
}   
    

    getPlatformName(location) {
        if (!location) return 'zoom';
        
        const cleanLocation = String(location).trim().toLowerCase();
        
        if (cleanLocation.includes('google') || cleanLocation.includes('meet')) return 'meet';
        if (cleanLocation.includes('teams') || cleanLocation.includes('microsoft')) return 'teams';
        if (cleanLocation.includes('zoom')) return 'zoom';
        if (cleanLocation.includes('integrations:google:meet')) return 'meet';
        if (cleanLocation.includes('integrations:microsoft:teams')) return 'teams';
        if (cleanLocation.includes('integrations:zoom')) return 'zoom';
        
        return 'other';
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
}

// Initialisation
function initializeBookingManager() {
    try {
        if (!window.bookingManager) {
            window.bookingManager = new BookingManager();
            console.log('✅ BookingManager initialisé (DB-driven)');
        }
        return window.bookingManager;
    } catch (error) {
        console.error('❌ Erreur initialisation BookingManager:', error);
        return null;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBookingManager);
} else {
    initializeBookingManager();
}

window.bookingManager = initializeBookingManager();

console.log('✅ booking.js chargé - Version DB-driven (calculs de prix supprimés)');