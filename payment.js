// payment.js - Gestion des paiements - VERSION CORRIGÉE POUR REDIRECTION
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
            console.group(`💳 TRAITEMENT PAIEMENT ${method}`);
            
            if (!this.currentBooking) {
                this.currentBooking = JSON.parse(localStorage.getItem('pendingBooking')) || null;
            }
            
            if (!this.currentBooking) {
                throw new Error('Aucune réservation trouvée');
            }

            const user = window.authManager?.getCurrentUser();
            
            // IMPORTANT: Vérifier si c'est une réservation avec crédit (ne devrait pas être ici)
            if (this.currentBooking?.isCreditBooking) {
                console.error('❌ ERREUR: Réservation crédit dans payment.js!');
                throw new Error('Flux incorrect: réservation crédit dans payment.js');
            }
            
            // Pour Stripe
            if (method === 'card') {
                const result = await this.processStripePayment();
                console.groupEnd();
                return result;
            }

            // Pour les autres méthodes
            const result = await this.processManualPayment(method, user);
            
            console.groupEnd();
            
            if (result.success) {
                console.log(`✅ Paiement ${method} traité`);
                return result;
            } else {
                throw new Error(result.error || 'Erreur de traitement');
            }
        } catch (error) {
            console.error(`❌ Erreur paiement ${method}:`, error);
            console.groupEnd();
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

            console.log('✅ Token Stripe créé');

            await this.simulateBackendPayment(token.id, this.currentBooking);

            const result = await this.processManualPayment('card', user);
            
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

    async simulateBackendPayment(tokenId, booking) {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`💰 Paiement simulé pour ${booking.price} ${booking.currency}`);
                resolve({ success: true });
            }, 1500);
        });
    }

    async processManualPayment(method, user) {
        try {
            console.group(`💳 PROCESS MANUAL PAYMENT: ${method}`);
            
            // VÉRIFICATION: Ce n'est PAS une réservation crédit
            if (this.currentBooking?.isCreditBooking) {
                console.error('❌ CRITICAL: Réservation crédit dans payment.js');
                throw new Error('Flux incorrect');
            }
            
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
            
            // CAS 1: Achat de forfait + réservation
            if (this.currentBooking?.isPackagePurchase) {
                console.log('📦 CAS 1: Achat forfait + réservation');
                return await this.processPackagePurchase(method, user, updatedBooking, transactionId, refNumber);
            }
            
            // CAS 2: Réservation simple
            console.log('📅 CAS 2: Réservation simple');
            return await this.processSingleBooking(method, user, updatedBooking, transactionId, refNumber);
            
        } catch (error) {
            console.error(`❌ Erreur traitement paiement ${method}:`, error);
            console.groupEnd();
            return { success: false, error: error.message };
        }
    }

    async processPackagePurchase(method, user, updatedBooking, transactionId, refNumber) {
        try {
            console.log('💰 Traitement achat forfait avec réservation immédiate');
            
            if (!user) {
                throw new Error('Utilisateur non connecté');
            }
            
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
            
            // ÉTAPE 3: Utiliser 1 crédit pour la réservation immédiate
            if (packageId && calcomResult?.supabaseBookingId && window.packagesManager) {
                console.log('💳 Déduction 1 crédit pour la réservation immédiate');
                
                const useResult = await window.packagesManager.useCredit(
                    user.id,
                    updatedBooking.courseType,
                    { 
                        id: calcomResult.supabaseBookingId,
                        source: 'package_purchase_immediate_reservation',
                        timestamp: Date.now()
                    }
                );
                
                if (useResult.success) {
                    console.log('✅ 1 crédit déduit avec succès');
                    updatedBooking.usedCreditForThisBooking = true;
                } else if (useResult.alreadyUsed) {
                    console.warn('⚠️ Crédit déjà déduit');
                    updatedBooking.creditAlreadyUsed = true;
                } else {
                    console.warn('⚠️ Échec déduction crédit:', useResult.error);
                    updatedBooking.creditDeductionError = useResult.error;
                }
            }
            
            // Sauvegarder localement
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
            
            // Sauvegarder la réservation et nettoyer
            localStorage.setItem('confirmedBooking', JSON.stringify(updatedBooking));
            localStorage.removeItem('pendingBooking');
            
            // Déterminer si nous avons un avertissement
            const hasWarning = updatedBooking.calcomError || !updatedBooking.calcomId;
            
            console.log('✅ Achat forfait terminé avec succès');
            console.groupEnd();
            
            // RETOURNER LE RÉSULTAT POUR REDIRECTION
            return {
                success: true,
                bookingData: updatedBooking,
                message: `Forfait ${updatedBooking.packageQuantity} cours acheté et réservation confirmée`,
                redirectTo: `payment-success.html?booking=${encodeURIComponent(JSON.stringify(updatedBooking))}&warning=${hasWarning}`
            };
            
        } catch (error) {
            console.error('❌ Erreur traitement achat forfait:', error);
            console.groupEnd();
            return { success: false, error: error.message };
        }
    }

    async processSingleBooking(method, user, updatedBooking, transactionId, refNumber) {
        try {
            console.log('📅 Traitement réservation simple');
            
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
            
            // Sauvegarder localement
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
            
            // Sauvegarder et nettoyer
            localStorage.setItem('confirmedBooking', JSON.stringify(updatedBooking));
            localStorage.removeItem('pendingBooking');
            
            // Déterminer si nous avons un avertissement
            const hasWarning = updatedBooking.calcomError || !updatedBooking.calcomId;
            
            console.log('✅ Réservation simple terminée avec succès');
            
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

console.log('✅ PaymentManager chargé - Version corrigée pour redirection');