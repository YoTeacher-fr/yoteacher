// payment.js - Version sécurisée avec calcul serveur
class PaymentManager {
    constructor() {
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        this.currentBooking = null;
        this.paymentIntentId = null;
        this.clientSecret = null;
        console.log('💳 PaymentManager initialisé (version sécurisée)');
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

            // Pour les autres méthodes
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

            const user = window.authManager?.getCurrentUser();
            
            if (!user) {
                throw new Error('Veuillez vous connecter pour payer par carte');
            }

            // ÉTAPE 1 : Créer le PaymentIntent côté serveur (calcul sécurisé)
            console.log('📡 Création PaymentIntent sur le serveur...');
            
            const supabaseUrl = window.YOTEACHER_CONFIG?.SUPABASE_URL;
            if (!supabaseUrl) {
                throw new Error('Configuration Supabase manquante');
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('Session expirée');
            }

            const response = await fetch(`${supabaseUrl}/functions/v1/create-payment-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    courseType: this.currentBooking.courseType,
                    duration: this.currentBooking.duration || 60,
                    quantity: this.currentBooking.packageQuantity || 1,
                    email: this.currentBooking.email || user.email,
                    name: this.currentBooking.name || user.user_metadata?.full_name,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erreur création PaymentIntent');
            }

            const paymentData = await response.json();
            this.clientSecret = paymentData.clientSecret;
            this.paymentIntentId = paymentData.paymentIntentId;

            console.log('✅ PaymentIntent créé:', this.paymentIntentId);
            console.log('💰 Montant serveur:', paymentData.amount, paymentData.currency);

            // ÉTAPE 2 : Confirmer le paiement avec Stripe
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
                }
            );

            if (stripeError) {
                throw new Error(stripeError.message);
            }

            if (paymentIntent.status === 'succeeded') {
                console.log('✅ Paiement réussi !');
                
                // Traiter la réservation
                const result = await this.processManualPayment('card', user, paymentIntent.id);
                
                if (result.success) {
                    setTimeout(() => {
                        window.location.href = `payment-success.html?booking=${encodeURIComponent(JSON.stringify(result.bookingData))}`;
                    }, 1000);
                }
            }

            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = '<i class="fas fa-lock"></i> Payer par carte';
            }

        } catch (error) {
            console.error('❌ Erreur paiement Stripe:', error);
            
            const processBtn = document.getElementById('processCardPayment');
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = '<i class="fas fa-lock"></i> Payer par carte';
            }
            
            throw error;
        }
    }

    async processManualPayment(method, user, stripePaymentIntentId = null) {
        try {
            console.log(`📤 Traitement paiement manuel: ${method}`);
            
            const transactionId = stripePaymentIntentId || `TRX-${Date.now().toString().slice(-8)}-${method.toUpperCase()}`;
            const refNumber = Date.now().toString().slice(-6);
            
            // IMPORTANT : Ne pas inclure le prix dans paymentData
            // Le prix a été calculé côté serveur
            const paymentData = {
                user_id: user?.id || this.currentBooking.userId,
                method: method,
                transaction_id: transactionId,
                reference: `COURS-${refNumber}`,
                status: 'completed',
                created_at: new Date().toISOString()
            };

            const paymentResult = await this.savePaymentRecord(paymentData);
            
            if (!paymentResult.success) {
                throw new Error(paymentResult.error || 'Erreur sauvegarde paiement');
            }

            const updatedBooking = {
                ...this.currentBooking,
                status: 'confirmed',
                paymentMethod: method,
                transactionId: transactionId,
                paymentReference: `COURS-${refNumber}`,
                confirmedAt: new Date().toISOString()
            };

            // Gérer les forfaits
            let packageId = null;
            if (updatedBooking.isPackage && updatedBooking.packageQuantity > 1 && user?.id && window.packagesManager) {
                console.log(`📦 Ajout de ${updatedBooking.packageQuantity} crédits`);
                
                const creditResult = await window.packagesManager.addCredits(
                    user.id,
                    updatedBooking.courseType,
                    updatedBooking.packageQuantity,
                    updatedBooking.price,
                    updatedBooking.currency,
                    method,
                    transactionId,
                    updatedBooking
                );
                
                if (creditResult.success) {
                    packageId = creditResult.package.id;
                    updatedBooking.packageId = packageId;
                    updatedBooking.price = 0;
                }
            }

            // Créer la réservation Cal.com et Supabase
            if (window.bookingManager?.createBookingAfterPayment) {
                const bookingResult = await window.bookingManager.createBookingAfterPayment(updatedBooking);
                
                if (bookingResult.success) {
                    updatedBooking.calcomId = bookingResult.data?.id || bookingResult.data?.uid;
                    if (bookingResult.data?.location) {
                        updatedBooking.meetingLink = bookingResult.data.location;
                    }

                    // Déduire un crédit si c'est un forfait
                    if (packageId && user?.id && bookingResult.supabaseBookingId) {
                        await window.packagesManager.useCredit(
                            user.id,
                            updatedBooking.courseType,
                            { 
                                id: bookingResult.supabaseBookingId,
                                duration: updatedBooking.duration || 60
                            }
                        );
                    }
                }
            }

            localStorage.setItem('confirmedBooking', JSON.stringify(updatedBooking));
            localStorage.removeItem('pendingBooking');

            return {
                success: true,
                bookingData: updatedBooking,
                message: `Paiement ${method} confirmé`,
            };
        } catch (error) {
            console.error(`❌ Erreur traitement paiement ${method}:`, error);
            return { success: false, error: error.message };
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
        setTimeout(() => {
            window.paymentManager?.setupStripeForm();
        }, 1000);
    }
});

console.log('✅ PaymentManager chargé (version sécurisée avec calcul serveur)');
