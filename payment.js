// payment.js - Version corrigée avec DÉDUCTION CRÉDIT AUTOMATIQUE
class PaymentManager {
    constructor() {
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        this.currentBooking = null;
        this.paymentIntentId = null;
        this.clientSecret = null;
        this.processingPayment = false;
        console.log('💳 PaymentManager initialisé (version crédit auto-déduit)');
    }

    async setupStripeForm() {
        try {
            const config = window.YOTEACHER_CONFIG || {};
            const stripeKey = config.STRIPE_PUBLISHABLE_KEY;
            
            if (!stripeKey) {
                console.warn('⚠️ Clé Stripe non configurée');
                return;
            }

            if (!window.Stripe) {
                console.error('❌ Stripe.js non chargé');
                return;
            }

            this.stripe = window.Stripe(stripeKey);
            this.elements = this.stripe.elements();
            
            const cardStyle = {
                base: {
                    color: '#32325d',
                    fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                    fontSmoothing: 'antialiased',
                    fontSize: '16px',
                    '::placeholder': {
                        color: '#aab7c4'
                    }
                },
                invalid: {
                    color: '#fa755a',
                    iconColor: '#fa755a'
                }
            };

            this.cardElement = this.elements.create('card', { style: cardStyle });
            
            const cardContainer = document.getElementById('card-element');
            if (cardContainer) {
                this.cardElement.mount(cardContainer);
                
                this.cardElement.on('change', (event) => {
                    const displayError = document.getElementById('card-errors');
                    if (displayError) {
                        if (event.error) {
                            displayError.textContent = event.error.message;
                            displayError.style.display = 'block';
                        } else {
                            displayError.style.display = 'none';
                        }
                    }
                });
                
                const processBtn = document.getElementById('processCardPayment');
                if (processBtn) {
                    processBtn.disabled = false;
                }
            }
            
            console.log('✅ Formulaire Stripe initialisé');
        } catch (error) {
            console.error('❌ Erreur initialisation Stripe:', error);
        }
    }

    async handlePaymentMethod(method) {
        if (this.processingPayment) {
            throw new Error('Un paiement est déjà en cours');
        }
        
        this.processingPayment = true;
        
        try {
            console.log(`💳 Traitement paiement ${method}...`);
            
            if (!this.currentBooking) {
                this.currentBooking = JSON.parse(localStorage.getItem('pendingBooking')) || null;
            }
            
            if (!this.currentBooking) {
                throw new Error('Aucune réservation trouvée');
            }

            // ✅ MODIFICATION : Récupérer l'utilisateur (peut être null pour cours d'essai)
            const user = window.authManager?.getCurrentUser();
            
            // ✅ MODIFICATION : Vérifier si cours d'essai
            const isTrialCourse = this.currentBooking.courseType === 'essai';
            
            // ✅ MODIFICATION : Validation conditionnelle
            if (!isTrialCourse && (!user || !user.id)) {
                throw new Error('Vous devez être connecté pour réserver ce type de cours');
            }
            
            if (method === 'card') {
                await this.processStripePayment();
                return;
            }

            // ✅ MODIFICATION : Passer isTrialCourse au processManualPayment
            const result = await this.processManualPayment(method, user, null, isTrialCourse);
            
            if (result.success) {
                console.log(`✅ Paiement ${method} traité avec succès`);
                setTimeout(() => {
                    window.location.href = `payment-success.html?booking=${encodeURIComponent(JSON.stringify(result.bookingData))}`;
                }, 1000);
            } else {
                throw new Error(result.error || 'Erreur de traitement');
            }
        } catch (error) {
            console.error(`❌ Erreur paiement ${method}:`, error);
            throw error;
        } finally {
            this.processingPayment = false;
        }
    }

    async getSupabaseSession() {
        try {
            console.log('🔐 Tentative de récupération de session Supabase...');
            
            if (!window.supabase || !window.supabase.auth) {
                throw new Error('Supabase non initialisé');
            }
            
            const { data: { session }, error } = await window.supabase.auth.getSession();
            
            if (error) {
                console.error('❌ Erreur récupération session:', error);
                throw error;
            }
            
            if (!session) {
                console.error('❌ Aucune session active');
                throw new Error('Aucune session active. Veuillez vous reconnecter.');
            }
            
            console.log('✅ Session récupérée pour:', session.user?.email);
            
            const tokenExpiry = new Date(session.expires_at * 1000);
            const now = new Date();
            
            if (tokenExpiry < now) {
                console.log('🔄 Token expiré, tentative de rafraîchissement...');
                const { data: { session: newSession }, error: refreshError } = 
                    await window.supabase.auth.refreshSession();
                
                if (refreshError || !newSession) {
                    throw new Error('Session expirée. Veuillez vous reconnecter.');
                }
                
                console.log('✅ Session rafraîchie');
                return newSession;
            }
            
            return session;
        } catch (error) {
            console.error('❌ Erreur dans getSupabaseSession:', error);
            
            if (error.message.includes('session') || error.message.includes('expirée')) {
                setTimeout(() => {
                    if (window.location.pathname.includes('payment')) {
                        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
                    }
                }, 2000);
            }
            
            throw error;
        }
    }

    async processStripePayment() {
        try {
            if (!this.stripe || !this.cardElement) {
                throw new Error('Stripe non initialisé');
            }

            const processBtn = document.getElementById('processCardPayment');
            if (processBtn) {
                processBtn.disabled = true;
                processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement en cours...';
            }

            const session = await this.getSupabaseSession();
            
            if (!session) {
                throw new Error('Veuillez vous connecter pour payer par carte');
            }

            console.log('📡 Création PaymentIntent sur le serveur...');
            
            const intentResponse = await fetch(`${window.YOTEACHER_CONFIG.EDGE_FUNCTIONS_URL}/create-payment-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    amount: Math.round(this.currentBooking.price * 100),
                    currency: this.currentBooking.currency || 'eur',
                    metadata: {
                        bookingId: this.currentBooking.id,
                        intentId: this.currentBooking.intentId,
                        courseType: this.currentBooking.courseType,
                        packageQuantity: this.currentBooking.packageQuantity,
                        userId: session.user.id
                    }
                })
            });

            if (!intentResponse.ok) {
                const errorData = await intentResponse.json();
                throw new Error(errorData.error || 'Erreur création PaymentIntent');
            }

            const { clientSecret, paymentIntentId } = await intentResponse.json();
            
            this.clientSecret = clientSecret;
            this.paymentIntentId = paymentIntentId;

            console.log('✅ PaymentIntent créé:', paymentIntentId);
            console.log('💳 Confirmation du paiement...');

            const { error: confirmError, paymentIntent } = await this.stripe.confirmCardPayment(
                clientSecret,
                {
                    payment_method: {
                        card: this.cardElement,
                        billing_details: {
                            name: this.currentBooking.name,
                            email: this.currentBooking.email
                        }
                    }
                }
            );

            if (confirmError) {
                throw new Error(confirmError.message);
            }

            if (paymentIntent.status === 'succeeded') {
                console.log('✅ Paiement réussi:', paymentIntent.id);

                const result = await this.processManualPayment('stripe', session.user, paymentIntent.id);
                
                if (result.success) {
                    setTimeout(() => {
                        window.location.href = `payment-success.html?booking=${encodeURIComponent(JSON.stringify(result.bookingData))}`;
                    }, 1000);
                } else {
                    throw new Error(result.error || 'Erreur enregistrement paiement');
                }
            } else {
                throw new Error('Le paiement n\'a pas été confirmé');
            }

        } catch (error) {
            console.error('❌ Erreur paiement Stripe:', error);
            
            const errorElement = document.getElementById('card-errors');
            if (errorElement) {
                errorElement.textContent = error.message;
                errorElement.style.display = 'block';
            }

            const processBtn = document.getElementById('processCardPayment');
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = '<i class="fas fa-credit-card"></i> Payer par carte';
            }
            
            throw error;
        }
    }

    async processManualPayment(method, user, transactionId = null, isTrialCourse = false) {
        try {
            // ✅ MODIFICATION : Validation conditionnelle de l'utilisateur
            if (!isTrialCourse && (!user || !user.id)) {
                throw new Error('Utilisateur non authentifié requis pour les cours payants');
            }

            if (!transactionId) {
                transactionId = `${method.toUpperCase()}-${Date.now()}`;
            }

            console.log('💰 Traitement paiement manuel:', {
                method: method,
                userId: user?.id || 'anonymous',
                transactionId: transactionId,
                isTrialCourse: isTrialCourse,
                isPackage: this.currentBooking.isPackage,
                packageQuantity: this.currentBooking.packageQuantity
            });

            // ============================================================================
            // ÉTAPE 1 : CRÉER D'ABORD LA RÉSERVATION CAL.COM ET SUPABASE
            // ============================================================================
            console.log('📞 Création réservation Cal.com et Supabase...');
            
            if (!window.bookingManager) {
                throw new Error('BookingManager non disponible');
            }
            
            const bookingForCalcom = {
                startTime: this.currentBooking.startTime,
                endTime: this.currentBooking.endTime,
                eventType: this.currentBooking.courseType,
                courseType: this.currentBooking.courseType,
                duration: this.currentBooking.duration || 60,
                location: this.currentBooking.location || 'integrations:google:meet',
                name: this.currentBooking.name,
                email: this.currentBooking.email,
                notes: this.currentBooking.notes || '',
                userId: user?.id,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: 'fr',
                
                // Prix à 0 si multi-cours (sera payé par crédit)
                price: (this.currentBooking.isPackage && this.currentBooking.packageQuantity > 1) ? 0 : this.currentBooking.price,
                currency: this.currentBooking.currency,
                paymentMethod: method,
                transactionId: transactionId,
                
                // Données pour confirmer le booking
                intentId: this.currentBooking.intentId,
                status: 'pending' // Sera confirmé après création forfait
            };
            
            console.log('📤 Données Cal.com:', {
                courseType: bookingForCalcom.courseType,
                startTime: bookingForCalcom.startTime,
                duration: bookingForCalcom.duration,
                intentId: bookingForCalcom.intentId,
                userId: bookingForCalcom.userId || 'anonymous'
            });
            
            // Créer la réservation (Cal.com + Supabase)
            const bookingResult = await window.bookingManager.createBookingAfterPayment(bookingForCalcom);
            
            if (!bookingResult.success) {
                console.error('❌ Échec création réservation:', bookingResult);
                throw new Error(`Échec création réservation: ${bookingResult.error || 'Erreur inconnue'}`);
            }
            
            const supabaseBookingId = bookingResult.supabaseBookingId;
            
            console.log('✅ Réservation créée:', {
                supabase_id: supabaseBookingId,
                calcom_id: bookingResult.data?.id,
                calcom_uid: bookingResult.data?.uid,
                meeting_link: bookingResult.data?.location
            });
            
            // Mettre à jour les données locales
            this.currentBooking.calcomId = bookingResult.data?.id || bookingResult.data?.uid;
            this.currentBooking.calcomUid = bookingResult.data?.uid;
            this.currentBooking.meetingLink = bookingResult.data?.location;
            this.currentBooking.supabaseBookingId = supabaseBookingId;

            // ============================================================================
            // ÉTAPE 2 : TRAITER SELON LE TYPE DE COURS
            // ============================================================================
            
            // ✅ NOUVEAU : Gestion spécifique pour cours d'essai
            if (isTrialCourse) {
                console.log('🎫 Cours d\'essai - Confirmation directe sans forfait');
                
                // Confirmer la réservation directement
                const { error: confirmError } = await window.supabase
                    .from('bookings')
                    .update({
                        status: 'confirmed',
                        payment_status: 'completed',
                        payment_method: method,
                        transaction_id: transactionId,
                        confirmed_at: new Date().toISOString()
                    })
                    .eq('id', supabaseBookingId);
                
                if (confirmError) {
                    console.error('❌ Erreur confirmation cours d\'essai:', confirmError);
                    throw new Error('Erreur confirmation: ' + confirmError.message);
                }
                
                console.log('✅ Cours d\'essai confirmé');
                
                // Récupérer le booking_number
                const { data: bookingData, error: fetchError } = await window.supabase
                    .from('bookings')
                    .select('booking_number, status')
                    .eq('id', supabaseBookingId)
                    .single();
                
                if (bookingData?.booking_number) {
                    this.currentBooking.bookingNumber = bookingData.booking_number;
                    console.log('📋 Booking number récupéré:', bookingData.booking_number);
                }
                
                return {
                    success: true,
                    bookingData: {
                        ...this.currentBooking,
                        status: 'confirmed',
                        paymentStatus: 'completed',
                        bookingId: supabaseBookingId,
                        transactionId: transactionId
                    }
                };
            }

            // ============================================================================
            // ÉTAPE 2 (COURS PAYANTS) : CRÉER LE FORFAIT AVEC LE BOOKING_ID (si multi-cours)
            // ============================================================================
            let packageId = null;
            
            if (this.currentBooking.isPackage && this.currentBooking.packageQuantity > 1) {
                console.log(`📦 Création forfait ${this.currentBooking.packageQuantity} cours avec booking_id...`);
                
                const { data: packageResult, error: packageError } = await window.supabase
                    .rpc('create_package_from_payment', {
                        p_user_id: user.id,
                        p_course_type: this.currentBooking.courseType,
                        p_duration: this.currentBooking.duration || 60,
                        p_quantity: this.currentBooking.packageQuantity,
                        p_price_paid: this.currentBooking.price,
                        p_currency: this.currentBooking.currency,
                        p_stripe_payment_id: transactionId,
                        p_booking_id: supabaseBookingId // ✅ PASSÉ ICI : le crédit sera déduit automatiquement
                    });
                
                if (packageError) {
                    console.error('❌ Erreur création forfait:', packageError);
                    throw new Error(`Impossible de créer le forfait: ${packageError.message}`);
                }
                
                if (!packageResult || !packageResult.success) {
                    throw new Error(packageResult?.error || 'Échec création forfait');
                }
                
                packageId = packageResult.package_id;
                console.log('✅ Forfait créé avec déduction automatique du 1er crédit:', {
                    package_id: packageId,
                    total_credits: this.currentBooking.packageQuantity,
                    remaining_credits: packageResult.remaining_credits, // Devrait être quantity - 1
                    expires_at: packageResult.expires_at
                });
                
                this.currentBooking.packageId = packageId;
            }

            // ============================================================================
            // ÉTAPE 3 : CONFIRMER LE BOOKING DANS SUPABASE
            // ============================================================================
            if (supabaseBookingId) {
                console.log('✅ Confirmation du booking dans Supabase...');
                
                const { error: updateError } = await window.supabase
                    .from('bookings')
                    .update({ 
                        status: 'confirmed',
                        package_id: packageId
                    })
                    .eq('id', supabaseBookingId);
                
                if (updateError) {
                    console.warn('⚠️ Erreur confirmation booking:', updateError);
                } else {
                    console.log('✅ Booking confirmé');
                }
            }
            
            // ============================================================================
            // ÉTAPE 4 : RÉCUPÉRER LE BOOKING NUMBER DEPUIS SUPABASE
            // ============================================================================
            if (supabaseBookingId) {
                console.log('📋 Récupération booking_number depuis Supabase...');
                
                const { data: bookingData, error: fetchError } = await window.supabase
                    .from('bookings')
                    .select('booking_number, status')
                    .eq('id', supabaseBookingId)
                    .single();
                
                if (!fetchError && bookingData) {
                    this.currentBooking.bookingNumber = bookingData.booking_number;
                    console.log('✅ Booking Number:', bookingData.booking_number);
                } else {
                    console.warn('⚠️ Impossible de récupérer booking_number:', fetchError);
                    this.currentBooking.bookingNumber = `BK-${method.toUpperCase()}-${Date.now().toString().slice(-8)}`;
                }
            } else {
                this.currentBooking.bookingNumber = `BK-${method.toUpperCase()}-${Date.now().toString().slice(-8)}`;
            }

            // ============================================================================
            // ÉTAPE 5 : SAUVEGARDER ET REDIRIGER
            // ============================================================================
            const finalBookingData = {
                ...this.currentBooking,
                paymentMethod: method,
                transactionId: transactionId,
                paymentReference: `COURS-${Date.now().toString().slice(-6)}`,
                status: 'confirmed',
                confirmedAt: new Date().toISOString()
            };
            
            localStorage.setItem('confirmedBooking', JSON.stringify(finalBookingData));
            localStorage.removeItem('pendingBooking');
            
            console.log('✅ Paiement traité avec succès');
            console.log('   Méthode:', method);
            console.log('   Booking Number:', finalBookingData.bookingNumber);
            console.log('   Cal.com UID:', finalBookingData.calcomUid);
            console.log('   Meeting Link:', finalBookingData.meetingLink);
            if (packageId) {
                console.log('   Package ID:', packageId);
                console.log('   ⚠️ 1 crédit a été automatiquement déduit du forfait');
            }

            return {
                success: true,
                bookingData: finalBookingData,
                message: `Paiement ${method} confirmé`,
            };
            
        } catch (error) {
            console.error(`❌ Erreur traitement paiement ${method}:`, error);
            
            console.group('🔍 Détails erreur paiement');
            console.log('Méthode:', method);
            console.log('User ID:', user?.id || 'anonymous');
            console.log('Intent ID:', this.currentBooking?.intentId);
            console.log('Is Trial:', isTrialCourse);
            console.log('Message:', error.message);
            console.log('Stack:', error.stack);
            console.groupEnd();
            
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async savePaymentRecord(paymentData) {
        try {
            const payments = JSON.parse(localStorage.getItem('yoteacher_payments') || '[]');
            payments.push(paymentData);
            localStorage.setItem('yoteacher_payments', JSON.stringify(payments));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

window.paymentManager = new PaymentManager();

document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.pathname.includes('payment.html')) {
        console.log('💰 Initialisation du formulaire de paiement...');
        
        setTimeout(() => {
            if (window.paymentManager) {
                window.paymentManager.setupStripeForm();
            }
        }, 1000);
    }
});

console.log('✅ PaymentManager chargé (version CRÉDIT AUTO-DÉDUIT lors achat forfait)');
