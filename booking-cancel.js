// booking-cancel.js - Version corrigée avec utilisation de calcom_uid
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
                .select('calcom_uid, package_id, start_time, status, booking_number, duration_minutes, course_type')
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

            // 4. Annuler côté Cal.com (API v2) si calcom_uid existe
            let calcomCancelled = false;
            if (bookingDetails.calcom_uid) {
                try {
                    calcomCancelled = await this.cancelCalcomBooking(bookingDetails.calcom_uid);
                } catch (error) {
                    console.warn('⚠️ Impossible d\'annuler sur Cal.com:', error);
                    // Continuer quand même avec l'annulation locale
                }
            } else {
                console.log('ℹ️ Aucun calcom_uid trouvé, annulation Cal.com ignorée');
            }

            console.log('🔄 Début de la transaction d\'annulation...');

            // 5. Mettre à jour la réservation dans bookings
            const updateData = {
                status: 'cancelled',
                cancelled_at: new Date().toISOString()
            };

            const { error: updateError } = await supabase
                .from('bookings')
                .update(updateData)
                .eq('id', bookingId)
                .eq('user_id', userId);

            if (updateError) {
                console.error('Erreur détaillée de mise à jour:', updateError);
                throw new Error(`Erreur de mise à jour: ${updateError.message}`);
            }

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
            } else {
                console.log('ℹ️ Aucun package_id associé, pas de remboursement de crédit');
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
                    metadata: { 
                        bookingId, 
                        error: error.message, 
                        stack: error.stack,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            
            throw error;
        }
    }

    // Annuler un rendez-vous sur Cal.com (API v2) - CORRIGÉ avec calcom_uid
    async cancelCalcomBooking(calcomUid) {
        const config = window.YOTEACHER_CONFIG;
        if (!config || !config.CALCOM_API_KEY) {
            console.warn('⚠️ Clé API Cal.com non configurée');
            return false;
        }

        try {
            // Construire l'URL avec l'UID de Cal.com
            const apiUrl = `https://api.cal.com/v2/bookings/${calcomUid}`;
            
            console.log('📡 Tentative d\'annulation Cal.com pour UID:', calcomUid);
            
            // D'abord, vérifier si la réservation existe
            const checkResponse = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + config.CALCOM_API_KEY,
                    'Content-Type': 'application/json',
                    'Cal-API-Version': 'v2'
                }
            });

            if (checkResponse.status === 404) {
                console.log('ℹ️ Réservation Cal.com non trouvée (peut-être déjà annulée)');
                return false; // Pas d'erreur, juste retourner false
            }

            if (!checkResponse.ok) {
                const errorText = await checkResponse.text();
                console.warn('⚠️ Erreur vérification réservation Cal.com:', errorText);
                // Continuer quand même avec l'annulation locale
                return false;
            }

            // Si on arrive ici, la réservation existe, on peut l'annuler
            console.log('✅ Réservation Cal.com trouvée, tentative d\'annulation...');
            
            // Essayer DELETE d'abord (méthode standard)
            const deleteResponse = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + config.CALCOM_API_KEY,
                    'Content-Type': 'application/json',
                    'Cal-API-Version': 'v2'
                }
            });

            if (deleteResponse.ok) {
                console.log('✅ Annulation Cal.com réussie (DELETE)');
                return true;
            }

            // Si DELETE échoue, essayer POST /cancel
            console.log('⚠️ DELETE a échoué, essai avec POST /cancel...');
            
            const cancelUrl = `${apiUrl}/cancel`;
            const postResponse = await fetch(cancelUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + config.CALCOM_API_KEY,
                    'Content-Type': 'application/json',
                    'Cal-API-Version': 'v2'
                },
                body: JSON.stringify({
                    cancellationReason: 'Annulé par l\'étudiant via YoTeacher'
                })
            });

            if (postResponse.ok) {
                console.log('✅ Annulation Cal.com réussie (POST /cancel)');
                return true;
            }

            // Les deux méthodes ont échoué
            const errorText = await postResponse.text();
            console.warn('⚠️ Les deux méthodes d\'annulation Cal.com ont échoué:', errorText);
            return false;

        } catch (error) {
            console.warn('⚠️ Erreur lors de l\'annulation Cal.com:', error);
            
            // Ne pas échouer si l'erreur est 404 (déjà annulée ou inexistante)
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.log('ℹ️ Réservation Cal.com déjà annulée ou inexistante');
                return false;
            }
            
            // Pour les autres erreurs, on lance l'exception pour qu'elle soit gérée en amont
            throw error;
        }
    }

    // Rembourser un crédit au package (méthode de secours)
    async refundCreditToPackage(packageId, userId, bookingId) {
        try {
            if (!window.supabase) {
                throw new Error('Supabase non disponible');
            }

            // 1. Récupérer le package actuel
            const { data: pkg, error: packageError } = await supabase
                .from('packages')
                .select('*')
                .eq('id', packageId)
                .eq('user_id', userId)
                .single();

            if (packageError) {
                console.error('Erreur récupération package:', packageError);
                throw packageError;
            }

            // 2. Calculer les nouveaux crédits
            const newRemainingCredits = (pkg.remaining_credits || 0) + 1;
            
            // 3. Vérifier que les crédits ne dépassent pas total_credits
            const maxCredits = pkg.total_credits || 0;
            const finalCredits = Math.min(newRemainingCredits, maxCredits);
            
            const creditsBefore = pkg.remaining_credits || 0;
            const creditsAfter = finalCredits;

            // 4. Mettre à jour le package
            const updateData = {
                remaining_credits: finalCredits,
                status: finalCredits > 0 ? 'active' : 'depleted'
            };

            const { error: updateError } = await supabase
                .from('packages')
                .update(updateData)
                .eq('id', packageId);

            if (updateError) {
                console.error('Erreur mise à jour package:', updateError);
                throw updateError;
            }

            // 5. Créer une transaction de crédit
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

        try {
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
                    calcomUid: booking.calcom_uid,
                    packageId: booking.package_id,
                    startTime: booking.start_time,
                    courseType: booking.course_type,
                    durationMinutes: booking.duration_minutes
                }
            });
        } catch (logError) {
            console.warn('⚠️ Erreur création log:', logError);
        }
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