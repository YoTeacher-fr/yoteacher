// payment.js - Gestionnaire de paiement production avec Stripe
class PaymentManager {
    constructor() {
        this.config = window.YOTEACHER_CONFIG || {};
        this.currentBooking = null;
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        
        console.log('💳 PaymentManager initialisé pour production');
    }
    
    async initStripe() {
        if (!this.config.STRIPE_PUBLISHABLE_KEY) {
            console.error('❌ STRIPE_PUBLISHABLE_KEY non configurée');
            return false;
        }

        try {
            // Stripe.js est déjà chargé via <script> dans payment.html
            if (!window.Stripe) {
                console.error('❌ Stripe.js non chargé');
                return false;
            }

            this.stripe = Stripe(this.config.STRIPE_PUBLISHABLE_KEY);
            console.log('✅ Stripe initialisé');
            return true;
        } catch (error) {
            console.error('❌ Erreur Stripe:', error);
            return false;
        }
    }

    async setupStripeForm() {
        try {
            await this.initStripe();
            
            // Créer les éléments Stripe
            this.elements = this.stripe.elements();
            
            const style = {
                base: {
                    fontSize: '16px',
                    color: '#32325d',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    '::placeholder': { color: '#aab7c4' }
                },
                invalid: { color: '#fa755a', iconColor: '#fa755a' }
            };

            this.cardElement = this.elements.create('card', { style });
            this.cardElement.mount('#card-element');

            // Gérer les erreurs
            this.cardElement.on('change', (event) => {
                const displayError = document.getElementById('card-errors');
                if (event.error) {
                    displayError.textContent = event.error.message;
                    displayError.style.display = 'block';
                } else {
                    displayError.textContent = '';
                    displayError.style.display = 'none';
                }
            });

            console.log('✅ Formulaire Stripe prêt');
            
            // Activer le bouton
            const submitBtn = document.getElementById('processCardPayment');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-lock"></i> Payer par carte';
            }
        } catch (error) {
            console.error('❌ Erreur setup Stripe:', error);
            this.showPaymentError('Impossible de charger le formulaire de paiement');
        }
    }
    
    async processBookingPayment(bookingData) {
        try {
            this.currentBooking = bookingData;
            
            // Afficher le récapitulatif
            this.displayBookingSummary(bookingData);
            
            // Sauvegarder dans localStorage
            localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
            
            return { success: true, booking: bookingData };
        } catch (error) {
            console.error('❌ Erreur traitement paiement:', error);
            return { success: false, error: error.message };
        }
    }
    
    displayBookingSummary(booking) {
        const summaryElement = document.getElementById('paymentSummary');
        if (!summaryElement) return;
        
        const bookingDate = new Date(booking.startTime);
        const formattedDate = bookingDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const formattedTime = bookingDate.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Obtenir le nom de la plateforme
        const platformName = this.getPlatformName(booking.location);
        
        summaryElement.innerHTML = `
            <div class="booking-summary-card">
                <h3 style="margin-bottom: 20px;"><i class="fas fa-calendar-check"></i> Récapitulatif</h3>
                <div class="summary-details">
                    <div class="summary-item">
                        <span class="label">Type de cours:</span>
                        <span class="value">${this.getCourseName(booking.courseType)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Date:</span>
                        <span class="value">${formattedDate}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Heure:</span>
                        <span class="value">${formattedTime}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Durée:</span>
                        <span class="value">${booking.duration} min</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Élève:</span>
                        <span class="value">${booking.name}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Plateforme:</span>
                        <span class="value">${platformName}</span>
                    </div>
                    <div class="summary-item total">
                        <span class="label">Total:</span>
                        <span class="value">${booking.price}€</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    getPlatformName(location) {
        if (!location) return 'À définir';
        if (location.includes('zoom')) return 'Zoom';
        if (location.includes('google')) return 'Google Meet';
        if (location.includes('teams')) return 'Microsoft Teams';
        return 'À définir';
    }

    getCourseName(courseType) {
        const names = {
            'essai': 'Cours d\'essai',
            'conversation': 'Conversation',
            'curriculum': 'Curriculum complet'
        };
        return names[courseType] || courseType;
    }
    
    async handlePaymentMethod(methodId) {
        console.log('💳 Traitement paiement:', methodId);
        
        if (!this.currentBooking) {
            this.showPaymentError('Aucune réservation en cours');
            return;
        }
        
        try {
            switch(methodId) {
                case 'revolut':
                case 'wise':
                case 'paypal':
                case 'interac':
                    // Méthodes de paiement externes
                    await this.completePayment(methodId);
                    break;
                case 'card':
                    await this.processCardPayment();
                    break;
                default:
                    throw new Error('Méthode de paiement non reconnue');
            }
        } catch (error) {
            console.error(`❌ Erreur paiement ${methodId}:`, error);
            this.showPaymentError(error.message);
        }
    }
    
    async processCardPayment() {
        console.log('💳 Traitement carte bancaire');
        
        if (!this.stripe || !this.cardElement) {
            throw new Error('Formulaire Stripe non initialisé');
        }

        try {
            const submitBtn = document.getElementById('processCardPayment');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement...';
            }
            
            this.hidePaymentError();
            
            // Créer PaymentMethod
            const { error: createError, paymentMethod } = await this.stripe.createPaymentMethod({
                type: 'card',
                card: this.cardElement,
                billing_details: {
                    name: this.currentBooking.name,
                    email: this.currentBooking.email
                }
            });

            if (createError) {
                throw new Error(createError.message);
            }

            console.log('✅ PaymentMethod créé:', paymentMethod.id);
            
            // Traiter le paiement via l'API
            await this.processStripePayment(paymentMethod.id);
            
        } catch (error) {
            console.error('❌ Erreur paiement carte:', error);
            
            const submitBtn = document.getElementById('processCardPayment');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-lock"></i> Payer par carte';
            }
            
            throw error;
        }
    }
    
    async processStripePayment(paymentMethodId) {
        try {
            const apiUrl = this.config.STRIPE_BACKEND_URL || '/api/stripe-payment';
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentMethodId: paymentMethodId,
                    amount: Math.round(this.currentBooking.price * 100),
                    currency: 'eur',
                    booking: this.currentBooking
                })
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Échec du paiement');
            }
            
            // Si 3D Secure requis
            if (result.requiresAction && result.clientSecret) {
                const { error: confirmError, paymentIntent } = await this.stripe.confirmCardPayment(
                    result.clientSecret
                );
                
                if (confirmError) {
                    throw new Error(confirmError.message);
                }
                
                if (paymentIntent.status === 'succeeded') {
                    await this.completePayment('card', paymentIntent.id);
                } else {
                    throw new Error(`Statut: ${paymentIntent.status}`);
                }
            } else if (result.paymentIntentId) {
                await this.completePayment('card', result.paymentIntentId);
            } else {
                throw new Error('Réponse inattendue');
            }
        } catch (error) {
            console.error('❌ Erreur API Stripe:', error);
            throw error;
        }
    }
    
    async completePayment(method, transactionId = null) {
        console.log('✅ Finalisation paiement:', method);
        
        try {
            // Créer les données de paiement
            const paymentData = {
                method: method,
                amount: this.currentBooking.price,
                transactionId: transactionId || `${method}_${Date.now()}`,
                status: 'completed',
                timestamp: new Date().toISOString(),
                booking: this.currentBooking
            };
            
            // Sauvegarder dans Supabase
            if (window.authManager && this.currentBooking.userId) {
                try {
                    await window.authManager.savePayment(paymentData);
                } catch (saveError) {
                    console.warn('⚠️ Erreur sauvegarde paiement:', saveError);
                }
            }
            
            // Créer la réservation Cal.com
            let hasWarning = false;
            
            try {
                const bookingResult = await window.bookingManager.createBookingAfterPayment(this.currentBooking);
                
                if (bookingResult && bookingResult.success) {
                    console.log('✅ Réservation Cal.com créée');
                    this.currentBooking.calcomId = bookingResult.data.id;
                    this.currentBooking.status = 'confirmed';
                    
                    // Sauvegarder la réservation dans Supabase
                    if (window.authManager?.saveBookingData) {
                        await window.authManager.saveBookingData(this.currentBooking);
                    }
                } else {
                    throw new Error(bookingResult?.error || 'Échec Cal.com');
                }
            } catch (calcomError) {
                console.error('⚠️ Erreur Cal.com:', calcomError);
                hasWarning = true;
                this.currentBooking.status = 'payment_ok_reservation_failed';
            }
            
            // Nettoyer et rediriger
            localStorage.removeItem('pendingBooking');
            
            const redirectUrl = `payment-success.html?booking=${encodeURIComponent(JSON.stringify(this.currentBooking))}`;
            
            setTimeout(() => {
                window.location.href = hasWarning ? redirectUrl + '&warning=true' : redirectUrl;
            }, 1000);
            
        } catch (error) {
            console.error('❌ Erreur finalisation:', error);
            throw error;
        }
    }
    
    showPaymentError(message) {
        const errorDiv = document.getElementById('paymentError');
        const errorText = document.getElementById('errorText');
        
        if (errorDiv && errorText) {
            errorText.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            alert('Erreur: ' + message);
        }
    }
    
    hidePaymentError() {
        const errorDiv = document.getElementById('paymentError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }
}

// Initialiser
window.paymentManager = new PaymentManager();
console.log('💳 PaymentManager prêt pour production');