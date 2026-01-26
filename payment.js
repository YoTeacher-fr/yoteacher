// payment.js - Version corrigée avec CRÉATION CAL.COM OBLIGATOIRE
class PaymentManager {
    constructor() {
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        this.currentBooking = null;
        this.paymentIntentId = null;
        this.clientSecret = null;
        this.processingPayment = false;
        console.log('💳 PaymentManager initialisé (version corrigée Cal.com)');
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
            
            if (method === 'card') {
                await this.processStripePayment();
                return;
            }

            const result = await this.processManualPayment(method, user);
            
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
            
            const supabaseUrl = window.YOTEACHER_CONFIG?.SUPABASE_URL;
            if (!supabaseUrl) {
                throw new Error('Configuration Supabase manquante');
            }

            const user = window.authManager?.getCurrentUser();
            if (!user) {
                throw new Error('Utilisateur non trouvé');
            }

            const functionUrl = `${supabaseUrl}/functions/v1/create-payment`;

            const requestBody = {
                courseType: this.currentBooking.courseType,
                duration: this.currentBooking.duration || 60,
                quantity: this.currentBooking.packageQuantity || 1,
                email: this.currentBooking.email || user.email,
                name: this.currentBooking.name || user.user_metadata?.full_name,
                userId: user.id,
                isVip: this.currentBooking.isVip || false,
                vipPriceData: this.currentBooking.vipPriceData || null,
                discountPercent: this.currentBooking.discountPercent || 0,
                localPrice: this.currentBooking.price || 0,
                localCurrency: this.currentBooking.currency || 'USD'
            };

            console.log('📤 Données envoyées:', requestBody);
            
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY}`,
                    'x-user-token': session.access_token,
                    'apikey': window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erreur détaillée:', errorText);
                
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { error: errorText };
                }
                
                if (response.status === 401) {
                    try {
                        const { data: { session: newSession }, error: refreshError } = 
                            await window.supabase.auth.refreshSession();
                        
                        if (refreshError || !newSession) {
                            throw new Error('Session expirée. Veuillez vous reconnecter.');
                        }
                        
                        console.log('🔄 Réessai avec session rafraîchie...');
                        return await this.retryStripePayment(newSession);
                    } catch (refreshError) {
                        throw new Error('Erreur d\'authentification. Veuillez vous reconnecter.');
                    }
                } else if (response.status === 400) {
                    throw new Error(`Erreur de données: ${errorData.error || 'Veuillez vérifier vos informations'}`);
                } else {
                    throw new Error(errorData.error || `Erreur serveur (${response.status})`);
                }
            }

            const paymentData = await response.json();
            
            if (!paymentData.clientSecret) {
                throw new Error('ClientSecret non reçu du serveur');
            }
            
            this.clientSecret = paymentData.clientSecret;
            this.paymentIntentId = paymentData.paymentIntentId;

            console.log('✅ PaymentIntent créé:', this.paymentIntentId);

            console.log('💳 Confirmation du paiement...');

            const { error: stripeError, paymentIntent } = await this.stripe.confirmCardPayment(
                this.clientSecret,
                {
                    payment_method: {
                        card: this.cardElement,
                        billing_details: {
                            name: this.currentBooking.name || user.user_metadata?.full_name,
                            email: this.currentBooking.email || user.email,
                        },
                    },
                    return_url: `${window.location.origin}/payment-success.html`,
                }
            );

            if (stripeError) {
                console.error('❌ Erreur Stripe:', stripeError);
                throw new Error(stripeError.message);
            }

            console.log('📊 Statut PaymentIntent:', paymentIntent.status);

            if (paymentIntent.status === 'succeeded') {
                console.log('✅ Paiement Stripe réussi !');
                
                this.currentBooking.transactionId = paymentIntent.id;
                this.currentBooking.paymentMethod = 'card';
                this.currentBooking.status = 'confirmed';
                this.currentBooking.confirmedAt = new Date().toISOString();
                this.currentBooking.price = paymentData.amount;
                this.currentBooking.currency = paymentData.currency;
                
                localStorage.setItem('confirmedBooking', JSON.stringify(this.currentBooking));
                localStorage.removeItem('pendingBooking');
                
                console.log('📤 Appel processManualPayment pour finaliser...');
                
                const result = await this.processManualPayment('card', user, paymentIntent.id);
                
                if (result.success) {
                    console.log('✅ Réservation finalisée avec succès');
                    setTimeout(() => {
                        window.location.href = `payment-success.html?booking=${encodeURIComponent(JSON.stringify(result.bookingData))}`;
                    }, 1000);
                } else {
                    throw new Error('Erreur lors de la finalisation de la réservation');
                }
            } else if (paymentIntent.status === 'requires_action') {
                console.log('ℹ️ Action supplémentaire requise (3D Secure)');
            } else {
                console.warn('⚠️ Statut inattendu:', paymentIntent.status);
                throw new Error(`Statut de paiement inattendu: ${paymentIntent.status}`);
            }

        } catch (error) {
            console.error('❌ Erreur paiement Stripe:', error);
            
            const processBtn = document.getElementById('processCardPayment');
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = '<i class="fas fa-lock"></i> Payer par carte';
            }
            
            const errorDiv = document.getElementById('paymentError');
            const errorText = document.getElementById('errorText');
            if (errorDiv && errorText) {
                let userMessage = error.message;
                
                if (error.message.includes('authentification') || error.message.includes('session')) {
                    userMessage = 'Votre session a expiré. Veuillez vous reconnecter et réessayer.';
                } else if (error.message.includes('Erreur serveur')) {
                    userMessage = 'Le service de paiement est temporairement indisponible. Veuillez réessayer dans quelques instants.';
                }
                
                errorText.textContent = `Erreur de paiement: ${userMessage}`;
                errorDiv.style.display = 'block';
                errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            throw error;
        }
    }

    async retryStripePayment(session) {
        console.log('🔄 Réessai du paiement avec session rafraîchie');
        this.processingPayment = false;
        
        if (window.supabase) {
            await window.supabase.auth.setSession(session);
        }
        
        return await this.processStripePayment();
    }

    async processManualPayment(method, user, stripePaymentIntentId = null) {
        try {
            console.log(`💳 Traitement paiement manuel: ${method}`);
            
            if (!this.currentBooking) {
                this.currentBooking = JSON.parse(localStorage.getItem('pendingBooking')) || null;
            }
            
            if (!this.currentBooking) {
                throw new Error('Aucune réservation trouvée');
            }

            if (!user?.id) {
                throw new Error('Utilisateur non connecté');
            }

            const transactionId = stripePaymentIntentId || `TRX-${Date.now().toString().slice(-8)}-${method.toUpperCase()}`;
            
            console.log('📋 Données réservation:', {
                intentId: this.currentBooking.intentId,
                courseType: this.currentBooking.courseType,
                isPackage: this.currentBooking.isPackage,
                packageQuantity: this.currentBooking.packageQuantity
            });

            // ============================================================================
            // ÉTAPE 1 : CRÉER LE FORFAIT (si multi-cours)
            // ============================================================================
            let packageId = null;
            
            if (this.currentBooking.isPackage && this.currentBooking.packageQuantity > 1) {
                console.log(`📦 Création forfait ${this.currentBooking.packageQuantity} cours...`);
                
                const { data: packageResult, error: packageError } = await window.supabase
                    .rpc('create_package_from_payment', {
                        p_user_id: user.id,
                        p_course_type: this.currentBooking.courseType,
                        p_duration: this.currentBooking.duration || 60,
                        p_quantity: this.currentBooking.packageQuantity,
                        p_price_paid: this.currentBooking.price,
                        p_currency: this.currentBooking.currency,
                        p_stripe_payment_id: transactionId,
                        p_booking_id: null
                    });
                
                if (packageError) {
                    console.error('❌ Erreur création forfait:', packageError);
                    throw new Error(`Impossible de créer le forfait: ${packageError.message}`);
                }
                
                if (!packageResult || !packageResult.success) {
                    throw new Error(packageResult?.error || 'Échec création forfait');
                }
                
                packageId = packageResult.package_id;
                console.log('✅ Forfait créé:', packageId);
                this.currentBooking.packageId = packageId;
            }

            // ============================================================================
            // ÉTAPE 2 : CRÉER LA RÉSERVATION CAL.COM (OBLIGATOIRE)
            // ============================================================================
            console.log('📞 Création réservation Cal.com...');
            
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
                userId: user.id,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: 'fr',
                
                price: packageId ? 0 : this.currentBooking.price,
                currency: this.currentBooking.currency,
                paymentMethod: method,
                transactionId: transactionId,
                packageId: packageId,
                
                // ✅ AJOUT : Données pour confirmer le booking
                intentId: this.currentBooking.intentId,
                status: 'confirmed'
            };
            
            console.log('📤 Données Cal.com:', {
                courseType: bookingForCalcom.courseType,
                startTime: bookingForCalcom.startTime,
                duration: bookingForCalcom.duration,
                intentId: bookingForCalcom.intentId
            });
            
            // ✅ APPEL OBLIGATOIRE : createBookingAfterPayment
            const bookingResult = await window.bookingManager.createBookingAfterPayment(bookingForCalcom);
            
            if (!bookingResult.success) {
                console.error('❌ Échec création Cal.com:', bookingResult);
                throw new Error(`Échec création réservation Cal.com: ${bookingResult.error || 'Erreur inconnue'}`);
            }
            
            console.log('✅ Réservation Cal.com créée:', {
                calcom_id: bookingResult.data?.id,
                calcom_uid: bookingResult.data?.uid,
                meeting_link: bookingResult.data?.location
            });
            
            // Mettre à jour les données locales
            this.currentBooking.calcomId = bookingResult.data?.id || bookingResult.data?.uid;
            this.currentBooking.calcomUid = bookingResult.data?.uid;
            this.currentBooking.meetingLink = bookingResult.data?.location;
            this.currentBooking.supabaseBookingId = bookingResult.supabaseBookingId;
            
            // ============================================================================
            // ÉTAPE 3 : RÉCUPÉRER LE BOOKING NUMBER DEPUIS SUPABASE
            // ============================================================================
            if (bookingResult.supabaseBookingId) {
                console.log('📋 Récupération booking_number depuis Supabase...');
                
                const { data: bookingData, error: fetchError } = await window.supabase
                    .from('bookings')
                    .select('booking_number, status')
                    .eq('id', bookingResult.supabaseBookingId)
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
            // ÉTAPE 4 : SAUVEGARDER ET REDIRIGER
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

            return {
                success: true,
                bookingData: finalBookingData,
                message: `Paiement ${method} confirmé`,
            };
            
        } catch (error) {
            console.error(`❌ Erreur traitement paiement ${method}:`, error);
            
            console.group('🔍 Détails erreur paiement');
            console.log('Méthode:', method);
            console.log('User ID:', user?.id);
            console.log('Intent ID:', this.currentBooking?.intentId);
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

console.log('✅ PaymentManager chargé (version corrigée avec Cal.com obligatoire)');