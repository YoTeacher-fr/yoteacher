// payment.js - Version OPTIMALE utilisant Cloudflare Function stripe-payment.js
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

            const user = window.authManager?.getCurrentUser();
            
            const isTrialCourse = this.currentBooking.courseType === 'essai';
            
            if (!isTrialCourse && (!user || !user.id)) {
                throw new Error('Vous devez être connecté pour réserver ce type de cours');
            }
            
            if (method === 'card') {
                await this.processStripePayment();
                return;
            }

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

            // ========================================================================
            // ÉTAPE 1 : CRÉER LE PAYMENTINTENT via Edge Function Supabase
            // ========================================================================
            console.log('📡 Création PaymentIntent sur le serveur Supabase...');
            
            const edgeFunctionUrl = `${window.YOTEACHER_CONFIG.EDGE_FUNCTIONS_URL}/create-payment-intent`;
            
            const requestBody = {
                courseType: this.currentBooking.courseType,
                duration: this.currentBooking.duration || 60,
                quantity: this.currentBooking.packageQuantity || 1,
                email: this.currentBooking.studentEmail || session.user.email,
                name: this.currentBooking.studentName || session.user.user_metadata?.full_name || session.user.email,
                userId: session.user.id,
                startTime: this.currentBooking.dateTime,
                endTime: new Date(new Date(this.currentBooking.dateTime).getTime() + (this.currentBooking.duration || 60) * 60000).toISOString(),
                location: 'integrations:google:meet'
            };

            console.log('📤 Données envoyées à Edge Function:', requestBody);

            const intentResponse = await fetch(edgeFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'x-user-token': session.access_token
                },
                body: JSON.stringify(requestBody)
            });

            if (!intentResponse.ok) {
                const errorText = await intentResponse.text();
                console.error('❌ Erreur serveur Supabase:', intentResponse.status, errorText);
                
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    throw new Error(`Erreur serveur (${intentResponse.status}): ${errorText}`);
                }
                
                throw new Error(errorData.error || 'Erreur création PaymentIntent');
            }

            const intentData = await intentResponse.json();
            
            console.log('📥 Réponse Edge Function:', intentData);

            const { clientSecret, paymentIntentId, intentId } = intentData;
            
            if (!clientSecret || !paymentIntentId) {
                throw new Error('Réponse invalide du serveur');
            }

            this.clientSecret = clientSecret;
            this.paymentIntentId = paymentIntentId;
            
            if (intentId) {
                this.currentBooking.intentId = intentId;
            }

            console.log('✅ PaymentIntent créé:', paymentIntentId);

            // ========================================================================
            // ÉTAPE 2 : CRÉER LA PAYMENTMETHOD avec Stripe.js
            // ========================================================================
            console.log('💳 Création méthode de paiement...');
            
            const { paymentMethod, error: pmError } = await this.stripe.createPaymentMethod({
                type: 'card',
                card: this.cardElement,
                billing_details: {
                    name: this.currentBooking.studentName || session.user.user_metadata?.full_name,
                    email: this.currentBooking.studentEmail || session.user.email
                }
            });

            if (pmError) {
                throw new Error(pmError.message);
            }

            console.log('✅ Méthode de paiement créée:', paymentMethod.id);

            // ========================================================================
            // ÉTAPE 3 : CONFIRMER LE PAIEMENT via Cloudflare Function
            // ========================================================================
            console.log('🔐 Confirmation paiement via Cloudflare Function...');
            
            const confirmUrl = '/functions/api/stripe-payment';
            
            const confirmResponse = await fetch(confirmUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    paymentMethodId: paymentMethod.id,
                    paymentIntentId: this.paymentIntentId
                })
            });

            if (!confirmResponse.ok) {
                const errorText = await confirmResponse.text();
                console.error('❌ Erreur confirmation Cloudflare:', confirmResponse.status, errorText);
                
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    throw new Error(`Erreur confirmation (${confirmResponse.status}): ${errorText}`);
                }
                
                throw new Error(errorData.error || 'Erreur confirmation paiement');
            }

            const confirmation = await confirmResponse.json();
            
            console.log('📥 Réponse Cloudflare Function:', confirmation);

            if (!confirmation.success) {
                throw new Error(confirmation.error || 'Erreur confirmation paiement');
            }

            // ========================================================================
            // ÉTAPE 4 : GÉRER 3D SECURE si nécessaire
            // ========================================================================
            if (confirmation.requiresAction && confirmation.clientSecret) {
                console.log('🔐 Action supplémentaire requise (3D Secure)...');
                
                const { error: actionError } = await this.stripe.handleCardAction(
                    confirmation.clientSecret
                );

                if (actionError) {
                    throw new Error(actionError.message);
                }
                
                console.log('✅ 3D Secure complété');
            }

            // Vérifier le statut final
            if (confirmation.status === 'succeeded' || confirmation.alreadyPaid) {
                console.log('✅ Paiement confirmé avec succès');

                // ========================================================================
                // ÉTAPE 5 : ENREGISTRER DANS SUPABASE
                // ========================================================================
                const result = await this.processManualPayment('stripe', session.user, this.paymentIntentId, false);
                
                if (result.success) {
                    setTimeout(() => {
                        window.location.href = `payment-success.html?booking=${encodeURIComponent(JSON.stringify(result.bookingData))}`;
                    }, 1000);
                } else {
                    throw new Error(result.error || 'Erreur enregistrement paiement');
                }
            } else {
                throw new Error(`Paiement non confirmé. Statut: ${confirmation.status}`);
            }

        } catch (error) {
            console.error('❌ Erreur paiement Stripe:', error);
            
            const processBtn = document.getElementById('processCardPayment');
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = '<i class="fas fa-lock"></i> Payer par carte';
            }
            
            const errorDiv = document.getElementById('card-errors');
            if (errorDiv) {
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
            }
            
            throw error;
        }
    }

    async processManualPayment(method, user, transactionId = null, isTrialCourse = false) {
        try {
            console.log(`💰 Traitement paiement ${method}...`);
            
            if (!transactionId) {
                transactionId = `${method.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }

            let supabaseBookingId = null;
            
            if (this.currentBooking.intentId) {
                console.log('📋 Création booking dans Supabase avec intent_id...');
                
                const bookingInsert = {
                    intent_id: this.currentBooking.intentId,
                    student_email: this.currentBooking.studentEmail || user?.email,
                    course_type: this.currentBooking.courseType,
                    duration: this.currentBooking.duration || 60,
                    scheduled_at: this.currentBooking.dateTime,
                    price: this.currentBooking.price,
                    currency: this.currentBooking.currency,
                    payment_method: method,
                    status: isTrialCourse ? 'confirmed' : 'pending',
                    calcom_uid: this.currentBooking.calcomUid || null,
                    meeting_link: this.currentBooking.meetingLink || null
                };

                if (user && user.id) {
                    bookingInsert.user_id = user.id;
                }

                const { data: bookingData, error: bookingError } = await window.supabase
                    .from('bookings')
                    .insert(bookingInsert)
                    .select('id')
                    .single();
                
                if (bookingError) {
                    console.error('❌ Erreur création booking:', bookingError);
                    throw new Error(`Impossible de créer la réservation: ${bookingError.message}`);
                }
                
                supabaseBookingId = bookingData.id;
                console.log('✅ Booking créé avec ID:', supabaseBookingId);
            }

            if (isTrialCourse) {
                console.log('🎓 Traitement cours d\'essai - Pas de création de forfait');
                
                if (supabaseBookingId) {
                    const { error: updateError } = await window.supabase
                        .from('bookings')
                        .update({ status: 'confirmed' })
                        .eq('id', supabaseBookingId);
                    
                    if (updateError) {
                        console.warn('⚠️ Erreur confirmation cours d\'essai:', updateError);
                    }
                }
                
                console.log('✅ Cours d\'essai confirmé');
                
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
                
                return {
                    success: true,
                    bookingData: {
                        ...this.currentBooking,
                        status: 'confirmed',
                        bookingId: supabaseBookingId,
                        transactionId: transactionId
                    }
                };
            }

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
                        p_booking_id: supabaseBookingId
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
                    remaining_credits: packageResult.remaining_credits,
                    expires_at: packageResult.expires_at
                });
                
                this.currentBooking.packageId = packageId;
            }

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

console.log('✅ PaymentManager chargé (version OPTIMALE avec Cloudflare Function)');
