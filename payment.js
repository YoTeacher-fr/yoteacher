// payment.js - Gestion des paiements uniquement - VERSION CORRIGÉE CONTRE DOUBLE DÉDUCTION
class PaymentManager {
    constructor() {
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        this.currentBooking = null;
        console.log('💳 PaymentManager initialisé - Version corrigée');
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
            
            // 🔴 CAS 1: Réservation avec crédit → NE DEVRAIT JAMAIS ARRIVER ICI
            if (this.currentBooking?.isCreditBooking) {
                console.error('❌ ERREUR CRITIQUE: Réservation crédit dans payment.js!');
                console.error('Cette réservation devrait être traitée directement dans booking.js');
                throw new Error('Flux incorrect: réservation crédit dans payment.js');
            }
            
            // 🔴 CAS 2: Achat de forfait + réservation
            if (this.currentBooking?.isPackagePurchase) {
                console.log('📦 CAS 2: Achat forfait + réservation immédiate');
                return await this.processPackagePurchase(method, user);
            }
            
            // 🔴 CAS 3: Réservation simple (payer maintenant)
            console.log('📅 CAS 3: Réservation simple');
            return await this.processSingleBooking(method, user);
            
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

            const processBtn = document.getElementById('processCardPayment');
            if (processBtn) {
                processBtn.disabled = true;
                processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement en cours...';
            }

            const user = window.authManager?.getCurrentUser();
            const name = this.currentBooking.name || (user?.user_metadata?.full_name || 'Client');
            const email = this.currentBooking.email || (user?.email || '');

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

            await this.simulateBackendPayment(token.id, this.currentBooking);

            const result = await this.handlePaymentMethod('card');
            
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = '<i class="fas fa-lock"></i> Payer par carte';
            }

            return result;
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

    async processPackagePurchase(method, user) {
        try {
            console.log('💰 Traitement achat forfait avec réservation immédiate');
            
            if (!user) {
                throw new Error('Utilisateur non connecté');
            }
            
            const transactionId = `PKG-${Date.now()}`;
            const refNumber = Date.now().toString().slice(-6);
            
            const updatedBooking = {
                ...this.currentBooking,
                paymentMethod: method,
                transactionId: transactionId,
                paymentReference: `COURS-${refNumber}`,
                status: 'confirmed',
                confirmedAt: new Date().toISOString()
            };
            
            // ÉTAPE 1: Ajouter les crédits du forfait
            let packageId = null;
            if (window.packagesManager) {
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
                    console.log(`✅ ${updatedBooking.packageQuantity} crédits ajoutés`);
                } else {
                    console.error('❌ Échec ajout crédits:', creditResult.error);
                    throw new Error(`Échec ajout crédits: ${creditResult.error}`);
                }
            }
            
            // ÉTAPE 2: Créer la réservation Cal.com
            let calcomResult = null;
            if (window.bookingManager) {
                calcomResult = await window.bookingManager.createBookingAfterPayment(updatedBooking);
                
                if (calcomResult.success) {
                    updatedBooking.calcomId = calcomResult.data?.id || calcomResult.data?.uid;
                    updatedBooking.meetingLink = calcomResult.data?.location;
                    updatedBooking.supabaseBookingId = calcomResult.supabaseBookingId;
                    console.log('✅ Réservation Cal.com créée');
                } else {
                    console.warn('⚠️ Réservation Cal.com échouée:', calcomResult.error);
                    updatedBooking.calcomError = true;
                    updatedBooking.calcomErrorMessage = calcomResult.error;
                }
            }
            
            // 🔴 ÉTAPE 3: Déduire 1 crédit pour la réservation immédiate (UNIQUEMENT ICI)
            // C'est la SEULE déduction pour le flux 2 (achat forfait)
            if (packageId && calcomResult?.supabaseBookingId && window.packagesManager) {
                console.log('💳 Déduction 1 crédit pour la réservation immédiate');
                const useResult = await window.packagesManager.useCredit(
                    user.id,
                    updatedBooking.courseType,
                    { 
                        id: calcomResult.supabaseBookingId,
                        type: 'package_purchase_reservation',
                        bookingData: updatedBooking
                    }
                );
                
                if (useResult.success) {
                    console.log('✅ 1 crédit déduit pour la réservation immédiate');
                    updatedBooking.usedCreditForThisBooking = true;
                } else {
                    console.warn('⚠️ Échec déduction crédit:', useResult.error);
                }
            }
            
            // Sauvegarder
            localStorage.setItem('confirmedBooking', JSON.stringify(updatedBooking));
            localStorage.removeItem('pendingBooking');
            
            // Déterminer si nous avons un avertissement
            const hasWarning = updatedBooking.calcomError || !updatedBooking.calcomId;
            
            return {
                success: true,
                bookingData: updatedBooking,
                message: `Forfait ${updatedBooking.packageQuantity} cours acheté et réservation confirmée`,
                redirectTo: `payment-success.html?booking=${encodeURIComponent(JSON.stringify(updatedBooking))}&warning=${hasWarning}`
            };
            
        } catch (error) {
            console.error('❌ Erreur traitement achat forfait:', error);
            return { success: false, error: error.message };
        }
    }

    async processSingleBooking(method, user) {
        try {
            console.log('📅 Traitement réservation simple');
            
            const transactionId = `TRX-${Date.now().toString().slice(-8)}-${method.toUpperCase()}`;
            const refNumber = Date.now().toString().slice(-6);
            
            const updatedBooking = {
                ...this.currentBooking,
                paymentMethod: method,
                transactionId: transactionId,
                paymentReference: `COURS-${refNumber}`,
                status: 'confirmed',
                confirmedAt: new Date().toISOString()
            };
            
            // Créer la réservation Cal.com
            let calcomResult = null;
            if (window.bookingManager) {
                calcomResult = await window.bookingManager.createBookingAfterPayment(updatedBooking);
                
                if (calcomResult.success) {
                    updatedBooking.calcomId = calcomResult.data?.id || calcomResult.data?.uid;
                    updatedBooking.meetingLink = calcomResult.data?.location;
                    console.log('✅ Réservation Cal.com créée');
                } else {
                    console.warn('⚠️ Réservation Cal.com échouée:', calcomResult.error);
                    updatedBooking.calcomError = true;
                    updatedBooking.calcomErrorMessage = calcomResult.error;
                }
            }
            
            // 🔴 IMPORTANT: PAS DE DÉDUCTION DE CRÉDIT ICI !
            // C'est une réservation payante simple, pas de crédit impliqué
            
            // Sauvegarder localement (pas de table payments dans votre schéma)
            this.savePaymentToLocalStorage({
                user_id: user?.id || updatedBooking.userId,
                method: method,
                amount: updatedBooking.price,
                currency: updatedBooking.currency,
                transaction_id: transactionId,
                reference: `COURS-${refNumber}`,
                booking_data: updatedBooking,
                status: 'completed',
                created_at: new Date().toISOString()
            });
            
            // Sauvegarder la réservation
            localStorage.setItem('confirmedBooking', JSON.stringify(updatedBooking));
            localStorage.removeItem('pendingBooking');
            
            // Déterminer si nous avons un avertissement
            const hasWarning = updatedBooking.calcomError || !updatedBooking.calcomId;
            
            return {
                success: true,
                bookingData: updatedBooking,
                message: `Paiement ${method} confirmé`,
                redirectTo: `payment-success.html?booking=${encodeURIComponent(JSON.stringify(updatedBooking))}&warning=${hasWarning}`
            };
            
        } catch (error) {
            console.error('❌ Erreur traitement réservation simple:', error);
            return { success: false, error: error.message };
        }
    }

    async simulateBackendPayment(tokenId, booking) {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`💰 Paiement simulé pour ${booking.price} ${booking.currency}`);
                console.log(`📋 Token: ${tokenId}`);
                resolve({ success: true });
            }, 1500);
        });
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
}

// Initialisation
window.paymentManager = new PaymentManager();

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    if (window.paymentManager) {
        if (window.location.pathname.includes('payment.html')) {
            setTimeout(() => {
                if (window.paymentManager.setupStripeForm) {
                    window.paymentManager.setupStripeForm();
                }
            }, 1000);
        }
    }
});

console.log('✅ PaymentManager chargé - Version corrigée contre double déduction');