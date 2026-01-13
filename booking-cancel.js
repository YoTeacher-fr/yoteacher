// booking-cancel.js - Gestion de l'annulation des réservations - VERSION CORRIGÉE
class BookingCancellation {
    constructor() {
        this.cancellationWindowHours = 24;
        console.log('🎫 BookingCancellation initialisé');
    }

    // Vérifier si l'annulation est possible (plus de 24h avant)
    canCancelBooking(startTime) {
        try {
            const now = new Date();
            const bookingStart = new Date(startTime);
            const hoursUntilStart = (bookingStart - now) / (1000 * 60 * 60);
            
            return hoursUntilStart > this.cancellationWindowHours;
        } catch (error) {
            console.error('Erreur dans canCancelBooking:', error);
            return false;
        }
    }

    // Récupérer les détails de la réservation depuis la table bookings
    async getBookingDetails(bookingId, userId) {
        try {
            if (!window.supabase) {
                console.error('Supabase non disponible');
                return null;
            }

            const { data: booking, error } = await supabase
                .from('bookings')
                .select('calcom_booking_id, package_id, start_time, status, booking_number')
                .eq('id', bookingId)
                .eq('user_id', userId)
                .single();
                
            if (error) {
                console.warn('⚠️ Erreur récupération détails de la réservation:', error);
                return null;
            }
            
            return booking;
        } catch (error) {
            console.error('Exception récupération détails de la réservation:', error);
            return null;
        }
    }

    // Annuler une réservation complètement
    async cancelBooking(bookingId, userId) {
        try {
            if (!window.supabase) {
                throw new Error('Supabase non disponible');
            }

            // 1. Récupérer les détails de la réservation depuis la table bookings
            const bookingDetails = await this.getBookingDetails(bookingId, userId);
            if (!bookingDetails) {
                throw new Error('Réservation non trouvée');
            }

            // 2. Vérifier si l'annulation est possible
            if (!this.canCancelBooking(bookingDetails.start_time)) {
                throw new Error('Annulation impossible : le cours commence dans moins de 24h');
            }

            // 3. Vérifier le statut
            if (bookingDetails.status === 'cancelled') {
                throw new Error('Cette réservation est déjà annulée');
            }

            // 4. Annuler côté Cal.com (API v2) si calcom_booking_id existe
            let calcomCancelled = false;
            if (bookingDetails.calcom_booking_id) {
                try {
                    calcomCancelled = await this.cancelCalcomBooking(bookingDetails.calcom_booking_id);
                } catch (error) {
                    console.warn('⚠️ Impossible d\'annuler sur Cal.com:', error);
                    // Continuer quand même avec l'annulation locale
                }
            }

            console.log('🔄 Début de la transaction d\'annulation...');

            // 5. Mettre à jour la réservation dans bookings
            const { error: updateError } = await supabase
                .from('bookings')
                .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', bookingId)
                .eq('user_id', userId);

            if (updateError) throw updateError;

            // 6. Si la réservation utilisait un package, rembourser un crédit
            let creditTransaction = null;
            if (bookingDetails.package_id) {
                try {
                    // Utiliser packagesManager.refundCredit si disponible
                    if (window.packagesManager && window.packagesManager.refundCredit) {
                        creditTransaction = await window.packagesManager.refundCredit(
                            bookingDetails.package_id, 
                            userId, 
                            bookingId
                        );
                    } else {
                        // Méthode de secours
                        creditTransaction = await this.refundCreditToPackage(bookingDetails.package_id, userId, bookingId);
                    }
                } catch (creditError) {
                    console.warn('⚠️ Erreur remboursement crédit:', creditError);
                    // Ne pas échouer l'annulation si seulement le remboursement échoue
                }
            }

            // 7. Créer un log système
            await this.logCancellation(bookingDetails, userId, calcomCancelled, creditTransaction);

            console.log('✅ Annulation réussie!');
            
            return {
                success: true,
                bookingId,
                bookingNumber: bookingDetails.booking_number,
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
        if (!config || !config.CALCOM_API_KEY) {
            console.warn('⚠️ Clé API Cal.com non configurée');
            return false;
        }

        try {
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
        } catch (error) {
            console.warn('⚠️ Erreur annulation Cal.com:', error);
            throw error;
        }
    }

    // Rembourser un crédit au package (méthode de secours)
    async refundCreditToPackage(packageId, userId, bookingId) {
        try {
            // 1. Récupérer le package actuel
            const { data: pkg, error: packageError } = await supabase
                .from('packages')
                .select('*')
                .eq('id', packageId)
                .eq('user_id', userId)
                .single();

            if (packageError) throw packageError;

            // 2. Calculer les nouveaux crédits
            const newRemainingCredits = (pkg.remaining_credits || 0) + 1;
            const creditsBefore = pkg.remaining_credits || 0;
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
            const transactionData = {
                user_id: userId,
                package_id: packageId,
                booking_id: bookingId,
                credits_change: 1,
                credits_before: creditsBefore,
                credits_after: creditsAfter,
                transaction_type: 'refund',
                reason: 'Annulation de réservation',
                created_at: new Date().toISOString()
            };

            const { error: transactionError } = await supabase
                .from('credit_transactions')
                .insert(transactionData);

            if (transactionError) {
                console.warn('Erreur création transaction crédit:', transactionError);
            } else {
                console.log('✅ Transaction crédit créée');
            }

            console.log(`💰 Crédit remboursé: ${creditsBefore} → ${creditsAfter}`);
            return { success: true, transactionData };

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
                bookingNumber: booking.booking_number,
                calcomCancelled,
                creditRefunded: !!creditTransaction,
                originalStatus: booking.status,
                calcomBookingId: booking.calcom_booking_id,
                packageId: booking.package_id,
                startTime: booking.start_time
            }
        });
    }
}

// Initialiser et exposer globalement
try {
    window.bookingCancellation = new BookingCancellation();
    console.log('✅ BookingCancellation chargé et initialisé');
} catch (error) {
    console.error('❌ Erreur initialisation BookingCancellation:', error);
    window.bookingCancellation = null;
}