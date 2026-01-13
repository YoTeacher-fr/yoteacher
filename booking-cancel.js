// booking-cancel.js - Version corrigée avec 90 jours de validité
class BookingCancellation {
    constructor() {
        this.cancellationWindowHours = 24;
        this.packageValidityDays = 90; // 90 jours pour tous les packages
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
                .select('calcom_uid, package_id, start_time, status, booking_number, duration_minutes, course_type, created_at, price_paid, currency')
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

            // 1. Récupérer les détails de la réservation
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

            // 6. REMBOURSER TOUJOURS 1 CRÉDIT (cours unique ou avec package)
            let creditTransaction = null;
            try {
                // Déterminer la date d'achat pour le calcul des 90 jours
                let purchaseDate = new Date();
                
                // Si c'est un cours unique (sans package_id), utiliser la date de création de la réservation
                if (!bookingDetails.package_id) {
                    purchaseDate = new Date(bookingDetails.created_at);
                    console.log(`📅 Cours unique: date d'achat = ${purchaseDate.toISOString()} (création réservation)`);
                } else {
                    // Si c'est un cours avec package, récupérer la date d'achat du package
                    const { data: packageData, error: packageError } = await supabase
                        .from('packages')
                        .select('purchased_at')
                        .eq('id', bookingDetails.package_id)
                        .single();
                    
                    if (!packageError && packageData && packageData.purchased_at) {
                        purchaseDate = new Date(packageData.purchased_at);
                        console.log(`📅 Cours avec package: date d'achat = ${purchaseDate.toISOString()} (date d'achat du package)`);
                    }
                }

                // Créer un package de remboursement avec 90 jours de validité
                creditTransaction = await this.createRefundPackage(
                    userId,
                    bookingDetails.course_type,
                    bookingDetails.duration_minutes || 60,
                    bookingId,
                    purchaseDate
                );

                console.log(`✅ Crédit de remboursement créé avec validité 90 jours à partir du ${purchaseDate.toLocaleDateString('fr-FR')}`);

            } catch (creditError) {
                console.warn('⚠️ Erreur remboursement crédit:', creditError);
                // Ne pas échouer l'annulation si seulement le remboursement échoue
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
                message: 'Réservation annulée avec succès. 1 crédit a été ajouté à votre compte.'
            };

        } catch (error) {
            console.error('❌ Erreur lors de l'annulation:', error);
            
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

    // Annuler un rendez-vous sur Cal.com (API v2)
    async cancelCalcomBooking(calcomUid) {
        const config = window.YOTEACHER_CONFIG;
        if (!config || !config.CALCOM_API_KEY) {
            console.warn('⚠️ Clé API Cal.com non configurée');
            return false;
        }

        try {
            const apiUrl = `https://api.cal.com/v2/bookings/${calcomUid}`;
            
            console.log('📡 Tentative d'annulation Cal.com pour UID:', calcomUid);
            
            // Vérifier si la réservation existe
            const checkResponse = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + config.CALCOM_API_KEY,
                    'Content-Type': 'application/json',
                    'Cal-API-Version': 'v2'
                }
            });

            if (checkResponse.status === 404) {
                console.log('ℹ️ Réservation Cal.com non trouvée (déjà annulée ou inexistante)');
                return false;
            }

            if (!checkResponse.ok) {
                const errorText = await checkResponse.text();
                console.warn('⚠️ Erreur vérification réservation Cal.com:', errorText);
                return false;
            }

            // Annulation avec POST /cancel
            console.log('✅ Réservation Cal.com trouvée, annulation via POST /cancel...');
            
            const cancelUrl = `${apiUrl}/cancel`;
            const postResponse = await fetch(cancelUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + config.CALCOM_API_KEY,
                    'Content-Type': 'application/json',
                    'Cal-API-Version': 'v2'
                },
                body: JSON.stringify({
                    cancellationReason: 'Annulé par l'étudiant via YoTeacher'
                })
            });

            if (postResponse.ok) {
                console.log('✅ Annulation Cal.com réussie');
                return true;
            }

            const errorText = await postResponse.text();
            console.warn('⚠️ Annulation Cal.com échouée:', errorText);
            return false;

        } catch (error) {
            console.warn('⚠️ Erreur lors de l'annulation Cal.com:', error);
            
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.log('ℹ️ Réservation Cal.com déjà annulée ou inexistante');
                return false;
            }
            
            throw error;
        }
    }

    // Créer un package de remboursement avec 90 jours de validité
    async createRefundPackage(userId, courseType, duration, bookingId, purchaseDate) {
        try {
            if (!window.supabase) {
                throw new Error('Supabase non disponible');
            }

            // Si purchaseDate n'est pas fourni, utiliser la date actuelle
            const purchasedDate = purchaseDate ? new Date(purchaseDate) : new Date();
            
            // Calculer la date d'expiration : 90 jours après la date d'achat
            const expiresAt = new Date(purchasedDate);
            expiresAt.setDate(expiresAt.getDate() + this.packageValidityDays);

            console.log(`📦 Création package de remboursement:`);
            console.log(`   - Date d'achat: ${purchasedDate.toLocaleDateString('fr-FR')}`);
            console.log(`   - Expiration: ${expiresAt.toLocaleDateString('fr-FR')} (90 jours)`);

            const packageData = {
                user_id: userId,
                course_type: courseType,
                duration_minutes: duration,
                total_credits: 1,
                remaining_credits: 1,
                price_paid: 0, // Gratuit - crédit de remboursement
                discount_percent: 0,
                currency: 'EUR',
                status: 'active',
                purchased_at: purchasedDate.toISOString(),
                expires_at: expiresAt.toISOString(),
                expiration_alert_sent: false
            };

            console.log('📤 Insertion package de remboursement:', packageData);
            
            const { data: newPackage, error: createError } = await supabase
                .from('packages')
                .insert(packageData)
                .select()
                .single();

            if (createError) {
                console.error('❌ Erreur création package remboursement:', createError);
                throw createError;
            }

            // Créer une transaction de crédit
            const transactionData = {
                user_id: userId,
                package_id: newPackage.id,
                booking_id: bookingId,
                credits_change: 1,
                credits_before: 0,
                credits_after: 1,
                transaction_type: 'refund',
                reason: `Annulation de réservation ${courseType}`,
                created_at: new Date().toISOString()
            };

            const { error: transactionError } = await supabase
                .from('credit_transactions')
                .insert(transactionData);

            if (transactionError) {
                console.warn('⚠️ Erreur création transaction crédit:', transactionError);
            } else {
                console.log('✅ Transaction crédit créée');
            }

            console.log(`✅ Package de remboursement créé (ID: ${newPackage.id})`);
            
            // Vérification de la durée de validité
            const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            console.log(`⏳ Validité: ${daysUntilExpiry} jours restants`);
            
            return { 
                success: true, 
                package: newPackage,
                transaction: transactionData,
                expiry_date: expiresAt,
                days_remaining: daysUntilExpiry
            };

        } catch (error) {
            console.error('❌ Erreur création package remboursement:', error);
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
                    durationMinutes: booking.duration_minutes,
                    refundPackageExpiry: creditTransaction?.expiry_date || null,
                    daysRemaining: creditTransaction?.days_remaining || null
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