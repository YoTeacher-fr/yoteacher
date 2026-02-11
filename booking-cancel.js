// booking-cancel.js - VERSION DB-DRIVEN MINIMALISTE
// Toute la logique métier est gérée par cancel_booking_safe()
// Ce fichier ne fait que :
// 1. Appeler la RPC pour la logique DB
// 2. Annuler côté Cal.com si nécessaire
// 3. Logger les résultats

class BookingCancellation {
    constructor() {
        console.log('🎫 BookingCancellation initialisé (version DB-driven)');
        this.translationManager = window.translationManager;
    }

    getTranslation(key, params = []) {
        if (this.translationManager) {
            return this.translationManager.getTranslation(key, params);
        }
        return key;
    }

    /**
     * Annuler une réservation
     * Délègue TOUTE la logique métier à cancel_booking_safe()
     * @param {string} bookingId - ID de la réservation
     * @param {string} userId - ID de l'utilisateur
     * @returns {Promise<Object>} Résultat de l'annulation
     */
    async cancelBooking(bookingId, userId) {
        try {
            if (!window.supabase) {
                throw new Error(this.getTranslation('error.supabase_unavailable'));
            }

            console.log('🔄 Appel de cancel_booking_safe() pour booking:', bookingId);

            // ============================================================================
            // ÉTAPE 1 : APPELER LA RPC QUI FAIT TOUT LE TRAVAIL
            // ============================================================================
            const { data, error } = await supabase.rpc('cancel_booking_safe', {
                p_booking_id: bookingId
            });

            if (error) {
                console.error('❌ Erreur RPC cancel_booking_safe:', error);
                throw new Error(error.message);
            }

            if (!data || !data.success) {
                const errorMsg = data?.error || this.getTranslation('booking.cancellation.failed');
                console.error('❌ RPC a échoué:', errorMsg);
                throw new Error(errorMsg);
            }

            console.log('✅ RPC cancel_booking_safe réussie:', {
                booking_id: data.booking_id,
                booking_number: data.booking_number,
                credit_refunded: data.credit_refunded,
                hours_before: data.hours_before
            });

            // ============================================================================
            // ÉTAPE 2 : ANNULER CÔTÉ CAL.COM (si calcom_uid existe)
            // ============================================================================
            let calcomCancelled = false;

            // Récupérer le calcom_uid depuis la DB
            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .select('calcom_uid, booking_number')
                .eq('id', bookingId)
                .single();

            if (bookingError) {
                console.warn(this.getTranslation('booking.calcom_uid_error'), bookingError.message);
            } else if (booking?.calcom_uid) {
                console.log('📞 Tentative d\'annulation Cal.com pour UID:', booking.calcom_uid);
                
                try {
                    calcomCancelled = await this.cancelCalcomBooking(booking.calcom_uid);
                    console.log(calcomCancelled ? this.getTranslation('booking.calcom_cancelled') : this.getTranslation('booking.calcom_not_cancelled'));
                } catch (calcomError) {
                    console.warn(this.getTranslation('booking.calcom_error'), calcomError.message);
                    // Ne pas faire échouer l'annulation si Cal.com échoue
                }
            } else {
                console.log(this.getTranslation('booking.no_calcom_uid'));
            }

            // ============================================================================
            // ÉTAPE 3 : LOGGER LE SUCCÈS
            // ============================================================================
            await this.logCancellationSuccess(bookingId, userId, data, calcomCancelled);

            // ============================================================================
            // RETOURNER LE RÉSULTAT
            // ============================================================================
            return {
                success: true,
                bookingId: data.booking_id,
                bookingNumber: data.booking_number,
                creditRefunded: data.credit_refunded,
                hoursBeforeStart: data.hours_before,
                calcomCancelled: calcomCancelled,
                message: data.message || this.getTranslation('booking.cancellation.success')
            };

        } catch (error) {
            console.error('❌ Erreur lors de l\'annulation:', error);
            
            // Logger l'erreur
            if (window.supabase) {
                await this.logCancellationError(bookingId, userId, error);
            }
            
            throw error;
        }
    }

    /**
     * Annuler un rendez-vous sur Cal.com (API v2)
     * CONSERVATION DE LA LOGIQUE CAL.COM UNIQUEMENT
     * @param {string} calcomUid - UID de la réservation Cal.com
     * @returns {Promise<boolean>} true si annulé, false sinon
     */
    async cancelCalcomBooking(calcomUid) {
        const config = window.YOTEACH_CONFIG;
        
        if (!config || !config.CALCOM_API_KEY) {
            console.warn(this.getTranslation('booking.calcom_api_missing'));
            return false;
        }

        try {
            const apiUrl = `https://api.cal.com/v2/bookings/${calcomUid}`;
            
            console.log('🔍 Vérification réservation Cal.com:', calcomUid);
            
            // Vérifier si la réservation existe
            const checkResponse = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.CALCOM_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Cal-API-Version': 'v2'
                }
            });

            if (checkResponse.status === 404) {
                console.log(this.getTranslation('booking.calcom_not_found'));
                return false;
            }

            if (!checkResponse.ok) {
                const errorText = await checkResponse.text();
                console.warn(this.getTranslation('booking.calcom_check_error'), errorText);
                return false;
            }

            // Annulation
            console.log('📞 Annulation Cal.com via POST /cancel...');
            
            const cancelUrl = `${apiUrl}/cancel`;
            const postResponse = await fetch(cancelUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.CALCOM_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Cal-API-Version': 'v2'
                },
                body: JSON.stringify({
                    cancellationReason: this.getTranslation('booking.cancellation_reason')
                })
            });

            if (postResponse.ok) {
                console.log(this.getTranslation('booking.calcom_success'));
                return true;
            }

            const errorText = await postResponse.text();
            console.warn(this.getTranslation('booking.calcom_failed'), errorText);
            return false;

        } catch (error) {
            console.warn(this.getTranslation('booking.calcom_exception'), error.message);
            
            // Si 404, considérer comme déjà annulé
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.log(this.getTranslation('booking.calcom_already_cancelled'));
                return false;
            }
            
            // Ne pas faire échouer l'annulation globale
            return false;
        }
    }

    /**
     * Logger le succès de l'annulation
     * @private
     */
    async logCancellationSuccess(bookingId, userId, rpcResult, calcomCancelled) {
        if (!window.supabase) return;

        try {
            await supabase.from('system_logs').insert({
                user_id: userId,
                log_level: 'INFO',
                source: 'booking-cancel.js',
                message: this.getTranslation('booking.cancellation.log_success', [rpcResult.booking_number || bookingId]),
                metadata: {
                    bookingId: bookingId,
                    bookingNumber: rpcResult.booking_number,
                    creditRefunded: rpcResult.credit_refunded,
                    hoursBeforeStart: rpcResult.hours_before,
                    calcomCancelled: calcomCancelled,
                    cancelledVia: 'cancel_booking_safe RPC',
                    timestamp: new Date().toISOString()
                }
            });
        } catch (logError) {
            console.warn(this.getTranslation('booking.log_error'), logError.message);
        }
    }

    /**
     * Logger une erreur d'annulation
     * @private
     */
    async logCancellationError(bookingId, userId, error) {
        try {
            await supabase.from('system_logs').insert({
                user_id: userId,
                log_level: 'ERROR',
                source: 'booking-cancel.js',
                message: this.getTranslation('booking.cancellation.log_error', [bookingId, error.message]),
                metadata: {
                    bookingId: bookingId,
                    error: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (logError) {
            console.warn(this.getTranslation('booking.log_error'), logError.message);
        }
    }
}

// ============================================================================
// INITIALISATION
// ============================================================================
try {
    window.bookingCancellation = new BookingCancellation();
    console.log('✅ BookingCancellation chargé (version DB-driven minimaliste)');
} catch (error) {
    console.error('❌ Erreur initialisation BookingCancellation:', error);
    window.bookingCancellation = null;
}