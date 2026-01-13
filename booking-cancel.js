// booking-cancel.js - Gestion de l'annulation des réservations
class BookingCancellation {
    constructor() {
        this.cancellationWindowHours = 24;
    }

    // Vérifier si l'annulation est possible (plus de 24h avant)
    canCancelBooking(startTime) {
        const now = new Date();
        const bookingStart = new Date(startTime);
        const hoursUntilStart = (bookingStart - now) / (1000 * 60 * 60);
        
        return hoursUntilStart > this.cancellationWindowHours;
    }

    // Annuler une réservation complètement
    async cancelBooking(bookingId, userId) {
        try {
            if (!window.supabase) {
                throw new Error('Supabase non disponible');
            }

            // 1. Récupérer les détails de la réservation
            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .select('*, packages(*)')
                .eq('id', bookingId)
                .eq('user_id', userId)
                .single();

            if (bookingError) throw bookingError;
            if (!booking) throw new Error('Réservation non trouvée');

            // 2. Vérifier si l'annulation est possible
            if (!this.canCancelBooking(booking.start_time)) {
                throw new Error('Annulation impossible : le cours commence dans moins de 24h');
            }

            // 3. Vérifier le statut
            if (booking.status === 'cancelled') {
                throw new Error('Cette réservation est déjà annulée');
            }

            // 4. Annuler côté Cal.com (API v2)
            let calcomCancelled = false;
            if (booking.calcom_booking_id) {
                try {
                    calcomCancelled = await this.cancelCalcomBooking(booking.calcom_booking_id);
                } catch (error) {
                    console.warn('⚠️ Impossible d\'annuler sur Cal.com:', error);
                    // Continuer quand même avec l'annulation locale
                }
            }

            // 5. Démarrer une transaction pour assurer la cohérence des données
            console.log('🔄 Début de la transaction d\'annulation...');

            // 5a. Mettre à jour la réservation
            const { error: updateError } = await supabase
                .from('bookings')
                .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', bookingId);

            if (updateError) throw updateError;

            // 5b. Si la réservation utilisait un package, rembourser un crédit
            let creditTransaction = null;
            if (booking.package_id) {
                creditTransaction = await this.refundCreditToPackage(
                    booking.package_id,
                    booking.user_id,
                    bookingId
                );
            }

            // 6. Créer un log système
            await this.logCancellation(booking, userId, calcomCancelled, creditTransaction);

            console.log('✅ Annulation réussie!');
            
            return {
                success: true,
                bookingId,
                calcomCancelled,
                creditRefunded: !!creditTransaction,
                message: 'Réservation annulée avec succès'
            };

        } catch (error) {
            console.error('❌ Erreur lors de l\'annulation:', error);
            
            // Log d'erreur
            if (window.supabase) {
                await supabase.from('system_logs').insert({
                    user_id: userId,
                    log_level: 'ERROR',
                    source: 'booking-cancel.js',
                    message: `Erreur annulation réservation ${bookingId}: ${error.message}`,
                    metadata: { bookingId, error: error.message }
                });
            }
            
            throw error;
        }
    }

    // Annuler un rendez-vous sur Cal.com (API v2)
    async cancelCalcomBooking(calcomBookingId) {
        const config = window.YOTEACHER_CONFIG;
        if (!config.CALCOM_API_KEY) {
            throw new Error('Clé API Cal.com non configurée');
        }

        const apiUrl = 'https://api.cal.com/v2/bookings/' + calcomBookingId;
        
        console.log('📡 Annulation Cal.com API v2 pour:', calcomBookingId);
        
        const response = await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + config.CALCOM_API_KEY,
                'Content-Type': 'application/json',
                'Cal-API-Version': 'v2'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Cal.com API error: ${response.status} - ${errorText}`);
        }

        console.log('✅ Annulation Cal.com réussie');
        return true;
    }

    // Rembourser un crédit au package
    async refundCreditToPackage(packageId, userId, bookingId) {
        try {
            // 1. Récupérer le package actuel
            const { data: package, error: packageError } = await supabase
                .from('packages')
                .select('*')
                .eq('id', packageId)
                .single();

            if (packageError) throw packageError;

            // 2. Calculer les nouveaux crédits
            const newRemainingCredits = (package.remaining_credits || 0) + 1;
            const creditsBefore = package.remaining_credits || 0;
            const creditsAfter = newRemainingCredits;

            // 3. Mettre à jour le package
            const { error: updateError } = await supabase
                .from('packages')
                .update({
                    remaining_credits: newRemainingCredits,
                    updated_at: new Date().toISOString()
                })
                .eq('id', packageId);

            if (updateError) throw updateError;

            // 4. Créer une transaction de crédit
            const { data: transaction, error: transactionError } = await supabase
                .from('credit_transactions')
                .insert({
                    user_id: userId,
                    booking_id: bookingId,
                    package_id: packageId,
                    credits_change: 1,
                    credits_before: creditsBefore,
                    credits_after: creditsAfter,
                    transaction_type: 'refund',
                    reason: 'Annulation de réservation',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (transactionError) throw transactionError;

            console.log(`💰 Crédit remboursé: ${creditsBefore} → ${creditsAfter}`);
            return transaction;

        } catch (error) {
            console.error('❌ Erreur remboursement crédit:', error);
            throw error;
        }
    }

    // Log de l'annulation
    async logCancellation(booking, userId, calcomCancelled, creditTransaction) {
        if (!window.supabase) return;

        await supabase.from('system_logs').insert({
            user_id: userId,
            log_level: 'INFO',
            source: 'booking-cancel.js',
            message: `Réservation ${booking.booking_number || booking.id} annulée`,
            metadata: {
                bookingId: booking.id,
                calcomCancelled,
                creditRefunded: !!creditTransaction,
                originalStatus: booking.status,
                courseType: booking.course_type,
                startTime: booking.start_time
            }
        });
    }

    // Fonction pour vérifier l'état d'une réservation
    async getBookingStatus(bookingId, userId) {
        try {
            const { data: booking, error } = await supabase
                .from('bookings')
                .select('status, start_time, cancelled_at')
                .eq('id', bookingId)
                .eq('user_id', userId)
                .single();

            if (error) throw error;
            return booking;
        } catch (error) {
            console.error('Erreur vérification statut:', error);
            return null;
        }
    }
}

// Initialiser et exposer globalement
window.bookingCancellation = new BookingCancellation();