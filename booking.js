// booking.js - VERSION DB-DRIVEN (Logique métier dans Supabase)
// ✅ Calcul de prix : SUPPRIMÉ → géré par create_booking_intent()
// ✅ Déduction crédit : DÉLÉGUÉE → géré par create_booking_with_credit()
// ✅ Validation : DÉLÉGUÉE → gérée par triggers
class BookingManager {
    constructor() {
        const config = window.YOTEACH_CONFIG || {};
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
        this.translationManager = window.translationManager;
    }

    getTranslation(key, params = []) {
        if (this.translationManager) {
            return this.translationManager.getTranslation(key, params);
        }
        return key;
    }

    checkCalcomConfig() {
        if (!this.calcomApiKey) {
            throw new Error(this.getTranslation('booking.calcom_api_missing'));
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
                console.warn(this.getTranslation('booking.rate_limit_warning', [this.rateLimitInfo.remaining, this.rateLimitInfo.limit]));
            }
        }
    }

    async getAvailableSlots(eventType = 'essai', date = null, duration = null) {
        try {
            this.checkCalcomConfig();

            const targetDate = date || this.getToday();
            const eventTypeId = this.eventTypeMap[eventType];
            
            if (!eventTypeId) {
                throw new Error(this.getTranslation('booking.event_type_not_configured', [eventType]));
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
                    throw new Error(this.getTranslation('booking.rate_limit_reached'));
                }
                
                throw new Error(this.getTranslation('booking.calcom_api_error', [response.status]));
            }
            
            const data = await response.json();
            
            if (!data || !data.data || typeof data.data !== 'object') {
                console.warn(this.getTranslation('booking.no_slots_available'));
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
                        
                        // ✅ CORRECTION: Pour l'essai, durée doit être 15
                        let slotDuration = duration || this.getDefaultDuration(eventType);
                        if (eventType === 'essai') {
                            slotDuration = 15;
                        }
                        
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
            
            console.log(this.getTranslation('booking.slots_available', [formattedSlots.length]));
            return formattedSlots;
            
        } catch (error) {
            console.error('❌ Erreur Cal.com:', error);
            
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                console.warn(this.getTranslation('booking.dev_mode_slots'));
                return this.generateMockSlots(date, eventType, duration);
            }
            
            throw new Error(this.getTranslation('booking.load_slots_error', [error.message]));
        }
    }

    calculateEndTime(startTime, eventType, customDuration = null) {
        try {
            const start = new Date(startTime);
            
            if (isNaN(start.getTime())) {
                console.error(this.getTranslation('booking.invalid_date'), startTime);
                return null;
            }
            
            // ✅ CORRECTION: Pour l'essai, durée fixe à 15
            let duration = customDuration || this.getDefaultDuration(eventType);
            if (eventType === 'essai') {
                duration = 15;
            }
            
            const end = new Date(start.getTime() + duration * 60000);
            return end.toISOString();
        } catch (error) {
            console.error(this.getTranslation('booking.calculate_end_time_error'), error);
            return null;
        }
    }

    getDefaultDuration(eventType) {
        switch(eventType) {
            case 'essai': return 15; // ✅ CORRECTION: 15 minutes pour l'essai
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
        // ✅ CORRECTION: Pour l'essai, durée fixe à 15
        let selectedDuration = duration || this.getDefaultDuration(eventType);
        if (eventType === 'essai') {
            selectedDuration = 15;
        }
        
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
        
        console.log(this.getTranslation('booking.mock_slots_generated', [slots.length]));
        return slots;
    }

    // ============================================================================
    // VÉRIFICATION CRÉDIT (conservée car appelle RPC)
    // ============================================================================
    async canUseCredit(bookingData) {
        console.log('🔍 Vérification crédit possible:', bookingData);
        
        const user = window.authManager?.getCurrentUser();
        
        // ✅ CORRECTION: Vérifier si l'utilisateur est connecté
        if (!user || !window.packagesManager) {
            console.log(this.getTranslation('booking.no_user_or_packages'));
            return false;
        }
        
        // ✅ CORRECTION: Les cours d'essai n'utilisent pas de crédits
        if (bookingData.courseType === 'essai') {
            console.log(this.getTranslation('booking.trial_no_credits'));
            return false;
        }
        
        if (bookingData.packageQuantity && bookingData.packageQuantity > 1) {
            console.log(this.getTranslation('booking.package_no_credits'));
            return false;
        }
        
        try {
            const duration = bookingData.duration || 60;
            const hasCredits = await window.packagesManager.hasCreditForDuration(
                user.id, 
                bookingData.courseType, 
                duration
            );
            console.log(this.getTranslation('booking.credits_check', [bookingData.courseType, duration, hasCredits]));
            return hasCredits;
        } catch (error) {
            console.warn(this.getTranslation('booking.credits_check_error'), error);
            return false;
        }
    }

    // ========================================
    // CORRECTION DÉFINITIVE: createBookingWithCredit()
    // Sans aucune erreur de colonne ou méthode
    // ========================================
    async createBookingWithCredit(bookingData) {
        try {
            console.log('🎫 Début création réservation AVEC CRÉDIT');
            
            const user = window.authManager?.getCurrentUser();
            if (!user) {
                throw new Error(this.getTranslation('booking.user_not_logged_in'));
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
                    throw new Error(this.getTranslation('booking.no_credit_for_duration', [duration]));
                }
            }
            
            // ========================================
            // ✅ ÉTAPE 1: CRÉER LE BOOKING EN STATUS 'PENDING'
            // ========================================
            console.log(this.getTranslation('booking.creating_pending'));
            
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
                    platform: this.getPlatformName(bookingData.location)
                })
                .select()
                .single();
            
            if (createError) {
                console.error(this.getTranslation('booking.pending_error'), createError);
                throw new Error(this.getTranslation('booking.creation_failed', [createError.message]));
            }
            
            console.log(this.getTranslation('booking.pending_created', [pendingBooking.id]));
            
            // ========================================
            // ✅ ÉTAPE 2: CONFIRMER LE BOOKING AVEC CRÉDIT VIA RPC
            // ========================================
            console.log(this.getTranslation('booking.using_credit_via_rpc', [pendingBooking.id]));
            
            const { data: rpcResult, error: rpcError } = await window.supabase.rpc('create_booking_with_credit', {
                p_booking_id: pendingBooking.id
            });
            
            if (rpcError) {
                console.error(this.getTranslation('booking.rpc_credit_error'), rpcError);
                
                // Nettoyer le booking pending en cas d'erreur
                await window.supabase
                    .from('bookings')
                    .delete()
                    .eq('id', pendingBooking.id);
                
                throw new Error(this.getTranslation('booking.credit_usage_error', [rpcError.message]));
            }
            
            if (!rpcResult || !rpcResult.success) {
                // Nettoyer aussi en cas d'échec de la RPC
                await window.supabase
                    .from('bookings')
                    .delete()
                    .eq('id', pendingBooking.id);
                    
                throw new Error(rpcResult?.error || this.getTranslation('booking.credit_failed'));
            }
            
            console.log(this.getTranslation('booking.credit_used_success'));
            console.log('   Package ID:', rpcResult.package_id);
            console.log('   Booking Number:', rpcResult.booking_number);
            
            // ========================================
            // ✅ ÉTAPE 3: CRÉER ÉVÉNEMENT CAL.COM
            // ========================================
            
            // Préparer données pour Cal.com
            const bookingForCalcom = {
                startTime: bookingData.startTime,
                endTime: bookingData.endTime || this.calculateEndTime(bookingData.startTime, bookingData.courseType, duration),
                eventType: bookingData.courseType,
                courseType: bookingData.courseType,
                duration: duration,
                location: bookingData.location || 'integrations:google:meet',
                name: bookingData.name,
                email: bookingData.email,
                notes: bookingData.notes || '',
                userId: user.id,
                timeZone: bookingData.timeZone || this.timeZone,
                language: bookingData.language || 'fr',
                
                // Infos paiement/crédit
                price: 0,
                currency: null,
                paymentMethod: 'credit',
                transactionId: `CREDIT-${pendingBooking.id}`,
                packageId: rpcResult.package_id,
                status: 'confirmed',
                isCreditBooking: true,
                
                // ✅ IMPORTANT: Passer l'intentId pour UPDATE au lieu de INSERT
                intentId: pendingBooking.id,
                supabaseBookingId: pendingBooking.id,
                bookingNumber: rpcResult.booking_number
            };
            
            console.log(this.getTranslation('booking.creating_calcom_event'));
            
            // ✅ UTILISER createBookingAfterPayment() qui existe déjà
            const bookingResult = await this.createBookingAfterPayment(bookingForCalcom);
            
            if (!bookingResult || !bookingResult.success) {
                console.warn(this.getTranslation('booking.calcom_failed_db_confirmed'));
                // Ne pas throw car le booking est confirmé dans la DB
            } else {
                console.log(this.getTranslation('booking.calcom_created_success'));
            }
            
            // ========================================
            // ✅ ÉTAPE 4: RETOURNER LE RÉSULTAT
            // ========================================
            const finalBookingData = {
                ...bookingForCalcom,
                calcomId: bookingResult?.data?.id || bookingResult?.data?.uid,
                meetingLink: bookingResult?.data?.location,
                bookingNumber: rpcResult.booking_number,
                confirmedAt: new Date().toISOString(),
                supabaseBookingId: pendingBooking.id
            };
            
            console.log(this.getTranslation('booking.credit_booking_created'));
            
            return {
                success: true,
                bookingData: finalBookingData,
                redirectTo: `payment-success.html?booking=${encodeURIComponent(JSON.stringify(finalBookingData))}`,
                message: this.getTranslation('booking.credit_reservation_confirmed')
            };
            
        } catch (error) {
            console.error(this.getTranslation('booking.credit_booking_error'), error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    // ============================================================================
    // CRÉATION RÉSERVATION - APPELLE create_booking_intent() POUR LE PRIX
    // ============================================================================
    async createBooking(bookingData) {
        try {
            const user = window.authManager?.getCurrentUser();
            
            if (!bookingData) {
                throw new Error(this.getTranslation('booking.missing_data'));
            }
            
            console.group('🎯 DÉBUT createBooking (DB-driven)');
            console.log('Données reçues:', bookingData);
            console.log('Utilisateur:', user?.email || this.getTranslation('booking.not_logged_in'));
            console.groupEnd();
            
            // ✅ CORRECTION: Ajuster la durée pour l'essai
            let duration = bookingData.duration || 60;
            if (bookingData.courseType === 'essai') {
                duration = 15; // Durée fixe pour l'essai
            }
            
            // ✅ CORRECTION: Pour l'essai, on ne vérifie pas les crédits
            let canUseCredit = false;
            if (user && bookingData.courseType !== 'essai') {
                canUseCredit = await this.canUseCredit(bookingData);
            }
            console.log(this.getTranslation('booking.can_use_credit'), canUseCredit);
            
            if (canUseCredit) {
                console.log(this.getTranslation('booking.credit_flow'));
                const creditResult = await this.createBookingWithCredit(bookingData);
                
                if (creditResult.success) {
                    return creditResult;
                } else {
                    console.warn(this.getTranslation('booking.credit_fallback'));
                }
            }
            
            // ============================================================================
            // FLUX PAIEMENT - RÉUTILISER L'INTENTION DÉJÀ CRÉÉE
            // ============================================================================
            console.log(this.getTranslation('booking.payment_flow'));
            
            if (!window.supabase) {
                throw new Error(this.getTranslation('error.supabase_unavailable'));
            }
            
            const requiredFields = ['startTime', 'courseType'];
            for (const field of requiredFields) {
                if (!bookingData[field]) {
                    throw new Error(this.getTranslation('booking.missing_field', [field]));
                }
            }
            
            const quantity = bookingData.packageQuantity || 1;
            
            // ✅ CORRECTION: Recherche d'intention seulement si utilisateur connecté
            let intentData = null;
            
            if (user) {
                console.log(this.getTranslation('booking.searching_existing_intent'));
                
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
                    console.error(this.getTranslation('booking.intent_search_error'), searchError);
                }
                
                if (existingIntents && existingIntents.length > 0) {
                    // ✅ RÉUTILISER L'INTENTION EXISTANTE
                    const existingIntent = existingIntents[0];
                    console.log(this.getTranslation('booking.existing_intent_found', [existingIntent.id]));
                    
                    intentData = {
                        success: true,
                        intent_id: existingIntent.id,
                        price: existingIntent.price_paid,
                        currency: existingIntent.currency,
                        can_use_credit: false, // Déjà vérifié
                        is_vip: existingIntent.is_vip || false,
                        discount_percent: 0
                    };
                }
            }
            
            // Si aucune intention trouvée (ou utilisateur non connecté), créer une nouvelle
            if (!intentData) {
                console.log(this.getTranslation('booking.creating_new_intent'));
                
                // ✅ CORRECTION: Préparer les paramètres RPC selon connexion
                const rpcParams = {
                    p_course_type: bookingData.courseType,
                    p_duration: duration,
                    p_start_time: bookingData.startTime,
                    p_end_time: bookingData.endTime || this.calculateEndTime(bookingData.startTime, bookingData.courseType, duration),
                    p_quantity: quantity,
                    p_location: bookingData.location || 'integrations:google:meet'
                };
                
                // ✅ CORRECTION: Ajouter user_id seulement si connecté
                if (user) {
                    rpcParams.p_user_id = user.id;
                } else if (bookingData.courseType !== 'essai') {
                    // ✅ CORRECTION: Pour les cours payants sans compte, lever une erreur
                    throw new Error(this.getTranslation('booking.login_required_paid'));
                }
                
                const { data: newIntent, error: intentError } = await supabase.rpc('create_booking_intent', rpcParams);
                
                if (intentError) {
                    console.error(this.getTranslation('booking.intent_error'), intentError);
                    throw new Error(this.getTranslation('booking.price_calculation_error', [intentError.message]));
                }
                
                if (!newIntent || !newIntent.success) {
                    throw new Error(this.getTranslation('booking.intent_failed', [newIntent?.error || this.getTranslation('error.unknown')]));
                }
                
                intentData = newIntent;
            }
            
            console.log(this.getTranslation('booking.intent_ready'), {
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
                message: this.getTranslation('booking.redirect_payment')
            };
            
        } catch (error) {
            console.error(this.getTranslation('booking.preparation_error'), error);
            return { 
                success: false, 
                error: this.getTranslation('booking.preparation_failed', [error.message])
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
                throw new Error(this.getTranslation('booking.event_type_not_configured', [bookingData.eventType]));
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

            // ✅ CORRECTION: Pour l'essai, durée doit être 15
            let duration = parseInt(bookingData.duration) || 60;
            if (bookingData.eventType === 'essai') {
                duration = 15;
            }
            
            if (bookingData.eventType !== 'essai' && duration) {
                bookingPayload.lengthInMinutes = duration;
            }

            console.log(this.getTranslation('booking.creating_calcom_booking'), bookingPayload);

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
                console.error(this.getTranslation('booking.calcom_error_detail'), errorText);
                throw new Error(this.getTranslation('booking.calcom_api_error', [response.status]));
            }

            const result = await response.json();
            const data = result.data || result;
            console.log(this.getTranslation('booking.calcom_booking_created'), data);
            
            // Sauvegarder dans Supabase
            const bookingId = await this.saveBookingToSupabase(data, user, bookingData, 'confirmed');
            
            return { 
                success: true, 
                data,
                supabaseBookingId: bookingId,
                message: this.getTranslation('booking.reservation_confirmed')
            };
            
        } catch (error) {
            console.error(this.getTranslation('booking.after_payment_error'), error);
            
            if (window.location.hostname === 'localhost') {
                return this.mockBookingAfterPayment(bookingData);
            }
            
            throw new Error(this.getTranslation('booking.creation_failed_generic', [error.message]));
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
                    title: this.getTranslation('booking.mock_title', [bookingData.courseType]),
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
                console.warn(this.getTranslation('booking.supabase_unavailable_warn'));
                return null;
            }

            if (bookingData.intentId) {
                console.log(this.getTranslation('booking.updating_existing_booking', [bookingData.intentId]));
                
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
                    console.error(this.getTranslation('booking.update_error'), error);
                    throw new Error(this.getTranslation('booking.confirmation_error', [error.message]));
                }

                if (!data || data.length === 0) {
                    console.error(this.getTranslation('booking.booking_not_found', [bookingData.intentId]));
                    throw new Error(this.getTranslation('booking.booking_not_found_generic'));
                }

                console.log(this.getTranslation('booking.booking_confirmed', [data[0].id]));
                console.log('   Booking Number:', data[0].booking_number);
                console.log('   Status:', data[0].status);
                console.log('   Meeting Link:', data[0].meeting_link);
                
                return data[0].id;
            }
            
            console.log(this.getTranslation('booking.creating_legacy_booking'));
            
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
                console.error(this.getTranslation('booking.insert_error'), error);
                
                if (error.message?.includes('duplicate key')) {
                    throw new Error(this.getTranslation('booking.duplicate_booking'));
                } else if (error.message?.includes('foreign key')) {
                    throw new Error(this.getTranslation('booking.foreign_key_error'));
                } else {
                    throw new Error(this.getTranslation('booking.creation_error', [error.message]));
                }
            }

            if (!data || data.length === 0) {
                throw new Error(this.getTranslation('booking.no_data_returned'));
            }

            console.log(this.getTranslation('booking.booking_created', [data[0].id]));
            console.log('   Booking Number:', data[0].booking_number);
            console.log('   Price Paid:', data[0].price_paid, data[0].currency);
            
            return data[0].id;
            
        } catch (error) {
            console.error(this.getTranslation('booking.save_booking_exception'), error);
            
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
            return dateTime || this.getTranslation('booking.date_unavailable');
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