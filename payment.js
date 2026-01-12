// payment.js - Gestion des paiements uniquement

class PaymentManager {
    constructor() {
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        this.currentBooking = null;
        console.log('💳 PaymentManager initialisé');
    }

    async setupStripeForm() {
        try {
            const config = window.YOTEACHER_CONFIG || {};
            const stripeKey = config.STRIPE_PUBLIC_KEY;
            
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
            
            // Créer l'élément de carte
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
                
                // Gérer les erreurs de carte
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
                
                // Activer le bouton de paiement
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
            
            // Pour Stripe (carte bancaire)
            if (method === 'card') {
                await this.processStripePayment();
                return;
            }

            // Pour les autres méthodes (Revolut, Wise, Interac, PayPal)
            const result = await this.processManualPayment(method, user);
            
            if (result.success) {
                console.log(`✅ Paiement ${method} traité avec succès`);
                
                // Rediriger vers la page de confirmation
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

            const cardContainer = document.getElementById('card-element');
            if (!cardContainer) {
                throw new Error('Élément de carte non trouvé');
            }

            // Désactiver le bouton de paiement
            const processBtn = document.getElementById('processCardPayment');
            if (processBtn) {
                processBtn.disabled = true;
                processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement en cours...';
            }

            // Récupérer les informations de facturation
            const user = window.authManager?.getCurrentUser();
            const name = this.currentBooking.name || (user?.user_metadata?.full_name || 'Client');
            const email = this.currentBooking.email || (user?.email || '');

            // Créer un token de paiement
            const { token, error } = await this.stripe.createToken(this.cardElement, {
                name: name,
                email: email,
                address_line1: '',
                address_city: '',
                address_state: '',
                address_zip: '',
                address_country: 'FR'
            });

            if (error) {
                console.error('Erreur token Stripe:', error);
                throw new Error(error.message);
            }

            console.log('✅ Token Stripe créé:', token.id);

            // Simuler le traitement du paiement (à remplacer par un appel à votre backend)
            // Ici, on simule un paiement réussi
            await this.simulateBackendPayment(token.id, this.currentBooking);

            // Traiter la réservation après paiement
            const result = await this.processManualPayment('card', user);
            
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = '<i class="fas fa-lock"></i> Payer par carte';
            }

            return result;
        } catch (error) {
            console.error('❌ Erreur paiement Stripe:', error);
            
            // Réactiver le bouton
            const processBtn = document.getElementById('processCardPayment');
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = '<i class="fas fa-lock"></i> Payer par carte';
            }
            
            throw error;
        }
    }

    async simulateBackendPayment(tokenId, booking) {
        // Simulation de l'appel à votre backend
        // En production, vous devrez appeler votre serveur pour créer un PaymentIntent Stripe
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`💰 Paiement simulé pour ${booking.price} ${booking.currency}`);
                console.log(`📋 Token: ${tokenId}`);
                resolve({ success: true });
            }, 1500);
        });
    }

    async processManualPayment(method, user) {
        try {
            console.log(`📤 Traitement paiement manuel: ${method}`);
            
            // Préparer les données de transaction
            const transactionId = `TRX-${Date.now().toString().slice(-8)}-${method.toUpperCase()}`;
            const refNumber = Date.now().toString().slice(-6);
            
            const paymentData = {
                user_id: user?.id || this.currentBooking.userId,
                method: method,
                amount: this.currentBooking.price,
                currency: this.currentBooking.currency,
                transaction_id: transactionId,
                reference: `COURS-${refNumber}`,
                booking_data: this.currentBooking,
                status: 'completed',
                created_at: new Date().toISOString()
            };

            // Sauvegarder le paiement
            const paymentResult = await this.savePaymentRecord(paymentData);
            
            if (!paymentResult.success) {
                throw new Error(paymentResult.error || 'Erreur sauvegarde paiement');
            }

            // Mettre à jour la réservation
            const updatedBooking = {
                ...this.currentBooking,
                status: 'confirmed',
                paymentMethod: method,
                transactionId: transactionId,
                paymentReference: `COURS-${refNumber}`,
                confirmedAt: new Date().toISOString()
            };

            // Sauvegarder la réservation dans Supabase
            if (window.bookingManager && typeof window.bookingManager.createBookingAfterPayment === 'function') {
                const bookingResult = await window.bookingManager.createBookingAfterPayment(updatedBooking);
                
                if (!bookingResult.success) {
                    console.warn('⚠️ Réservation Cal.com échouée:', bookingResult.error);
                    // Continuer malgré l'erreur Cal.com
                }
            }

            // Sauvegarder localement
            localStorage.setItem('confirmedBooking', JSON.stringify(updatedBooking));
            localStorage.removeItem('pendingBooking');

            return {
                success: true,
                bookingData: updatedBooking,
                paymentData: paymentData,
                message: `Paiement ${method} confirmé`
            };
        } catch (error) {
            console.error(`❌ Erreur traitement paiement ${method}:`, error);
            return { success: false, error: error.message };
        }
    }

    async savePaymentRecord(paymentData) {
        try {
            // Tenter de sauvegarder dans Supabase
            if (window.supabase && window.supabaseReady) {
                const { error } = await window.supabase
                    .from('payments')
                    .insert([paymentData]);

                if (error) {
                    console.warn('⚠️ Table payments non disponible, sauvegarde locale');
                    return this.savePaymentToLocalStorage(paymentData);
                }

                console.log('✅ Paiement sauvegardé dans Supabase');
                return { success: true };
            }

            // Sauvegarde locale
            return this.savePaymentToLocalStorage(paymentData);
        } catch (error) {
            console.warn('⚠️ Erreur sauvegarde paiement:', error);
            return this.savePaymentToLocalStorage(paymentData);
        }
    }

    savePaymentToLocalStorage(paymentData) {
        try {
            const payments = JSON.parse(localStorage.getItem('yoteacher_payments') || '[]');
            payments.push(paymentData);
            localStorage.setItem('yoteacher_payments', JSON.stringify(payments));
            console.log('✅ Paiement sauvegardé localement');
            return { success: true };
        } catch (error) {
            console.error('❌ Erreur sauvegarde locale:', error);
            return { success: false, error: error.message };
        }
    }

    formatAmount(amount, currency) {
        if (window.currencyManager) {
            return window.currencyManager.formatPrice(amount);
        }
        
        const formatter = new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency || 'EUR',
            minimumFractionDigits: 2
        });
        
        return formatter.format(amount);
    }

    async refundPayment(transactionId, reason = '') {
        // Implémentation de remboursement
        console.log(`🔄 Remboursement transaction: ${transactionId}`);
        // À implémenter avec votre backend
        return { success: true, message: 'Remboursement simulé' };
    }
}

// Initialisation
window.paymentManager = new PaymentManager();

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    if (window.paymentManager) {
        // Si on est sur la page de paiement, initialiser Stripe
        if (window.location.pathname.includes('payment.html')) {
            setTimeout(() => {
                if (window.paymentManager.setupStripeForm) {
                    window.paymentManager.setupStripeForm();
                }
            }, 1000);
        }
    }
});

console.log('✅ PaymentManager chargé');