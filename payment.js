// Gestionnaire de paiement pour YoTeacher - VERSION STRIPE
class PaymentManager {
    constructor() {
        this.config = window.YOTEACHER_CONFIG || {};
        this.currentBooking = null;
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        this.paymentIntentClientSecret = null;
        
        console.log('💳 PaymentManager (Stripe) initialisé');
    }
    
    async initStripe() {
        // Vérifier la configuration Stripe
        if (!this.config.STRIPE_PUBLISHABLE_KEY) {
            console.warn('⚠️ Stripe non configuré - paiements par carte désactivés');
            return false;
        }

        try {
            // Vérifier si Stripe.js est déjà chargé
            if (!window.Stripe) {
                console.error('❌ Stripe.js non chargé. Assurez-vous que le script est inclus dans payment.html');
                return false;
            }

            // Initialiser Stripe
            this.stripe = Stripe(this.config.STRIPE_PUBLISHABLE_KEY);
            this.elements = this.stripe.elements();
            
            console.log('✅ Stripe initialisé avec clé:', this.config.STRIPE_PUBLISHABLE_KEY.substring(0, 20) + '...');
            return true;
        } catch (error) {
            console.error('❌ Erreur initialisation Stripe:', error);
            return false;
        }
    }

    async setupStripeForm() {
        const cardElementDiv = document.getElementById('card-element');
        if (!cardElementDiv) {
            console.error('❌ Container Stripe non trouvé');
            return;
        }

        try {
            const initialized = await this.initStripe();
            if (!initialized) {
                throw new Error('Stripe non disponible');
            }

            // Style pour Stripe Elements
            const style = {
                base: {
                    fontSize: '16px',
                    color: '#32325d',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    '::placeholder': {
                        color: '#aab7c4'
                    }
                },
                invalid: {
                    color: '#fa755a',
                    iconColor: '#fa755a'
                }
            };

            // Créer l'élément de carte
            this.cardElement = this.elements.create('card', { 
                style: style,
                hidePostalCode: true
            });
            
            // Monter l'élément
            this.cardElement.mount('#card-element');

            // Gérer les erreurs de validation
            this.cardElement.on('change', (event) => {
                const displayError = document.getElementById('card-errors');
                if (event.error) {
                    displayError.textContent = event.error.message;
                    displayError.style.display = 'block';
                } else {
                    displayError.textContent = '';
                    displayError.style.display = 'none';
                }
                
                // Activer/désactiver le bouton de paiement
                const submitBtn = document.getElementById('processCardPayment');
                if (submitBtn) {
                    submitBtn.disabled = !event.complete;
                }
            });

            console.log('✅ Formulaire Stripe Elements créé');
            
            // Activer le bouton de paiement
            const submitBtn = document.getElementById('processCardPayment');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-lock"></i> Payer par carte';
            }
        } catch (error) {
            console.error('❌ Erreur setup Stripe:', error);
            this.showPaymentError('Impossible de charger le formulaire de paiement: ' + error.message);
        }
    }
    
    async processBookingPayment(bookingData) {
        try {
            this.currentBooking = bookingData;
            
            console.log('📋 Traitement paiement pour:', bookingData);
            
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
                    <div class="summary-item total">
                        <span class="label">Total:</span>
                        <span class="value">${booking.price}€</span>
                    </div>
                </div>
            </div>
        `;
    }

    getCourseName(courseType) {
        const names = {
            'essai': 'Cours d\'essai',
            'conversation': 'Conversation',
            'curriculum': 'Curriculum complet',
            'grammaire': 'Curriculum complet'
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
                    await this.processRevolutPayment();
                    break;
                case 'wise':
                    await this.processWisePayment();
                    break;
                case 'paypal':
                    await this.processPayPalPayment();
                    break;
                case 'interac':
                    await this.processInteracPayment();
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
    
    async processRevolutPayment() {
        console.log('💳 Paiement Revolut confirmé');
        await this.completePayment('revolut');
    }
    
    async processWisePayment() {
        console.log('💳 Paiement Wise confirmé');
        await this.completePayment('wise');
    }
    
    async processPayPalPayment() {
        console.log('💳 Paiement PayPal confirmé');
        await this.completePayment('paypal');
    }
    
    async processInteracPayment() {
        console.log('💳 Paiement Interac confirmé');
        await this.completePayment('interac');
    }
    
    async processCardPayment() {
        console.log('💳 Traitement carte bancaire avec Stripe');
        
        if (!this.stripe || !this.cardElement) {
            throw new Error('Formulaire Stripe non initialisé');
        }

        try {
            // Désactiver le bouton pendant le traitement
            const submitBtn = document.getElementById('processCardPayment');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement en cours...';
            }
            
            this.hidePaymentError();
            
            // Créer un PaymentMethod
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
            
            // Traiter le paiement via votre backend
            await this.processStripePayment(paymentMethod.id);
        } catch (error) {
            console.error('❌ Erreur paiement carte:', error);
            
            // Réactiver le bouton
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
            // Construire l'URL de l'API
            const apiUrl = this.config.STRIPE_BACKEND_URL || '/api/stripe-payment';
            
            // Envoyer les données au backend
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    paymentMethodId: paymentMethodId,
                    amount: Math.round(this.currentBooking.price * 100), // en centimes
                    currency: 'eur',
                    booking: this.currentBooking
                })
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Échec du paiement');
            }
            
            // Si 3D Secure est requis
            if (result.requiresAction && result.clientSecret) {
                console.log('🔒 3D Secure requis');
                
                const { error: confirmError, paymentIntent } = await this.stripe.confirmCardPayment(
                    result.clientSecret,
                    {
                        payment_method: paymentMethodId
                    }
                );
                
                if (confirmError) {
                    throw new Error(confirmError.message);
                }
                
                if (paymentIntent.status === 'succeeded') {
                    console.log('✅ Paiement 3D Secure réussi');
                    await this.completePayment('card', paymentIntent.id);
                } else {
                    throw new Error(`Statut du paiement: ${paymentIntent.status}`);
                }
            } else if (result.paymentIntentId) {
                // Paiement simple réussi
                await this.completePayment('card', result.paymentIntentId);
            } else {
                throw new Error('Réponse inattendue du serveur');
            }
        } catch (error) {
            console.error('❌ Erreur API Stripe:', error);
            throw error;
        }
    }
    
    async completePayment(method, transactionId = null) {
        console.log('✅ Finalisation paiement:', method);
        
        try {
            // 1. Créer les données de paiement
            const paymentData = {
                method: method,
                amount: this.currentBooking.price,
                transactionId: transactionId || `${method}_${Date.now()}`,
                status: 'completed',
                timestamp: new Date().toISOString(),
                booking: this.currentBooking
            };
            
            // 2. Sauvegarder le paiement
            if (window.authManager && this.currentBooking.userId) {
                await window.authManager.savePayment(paymentData);
            }
            
            localStorage.setItem('lastPayment', JSON.stringify(paymentData));
            
            // 3. Créer la réservation Cal.com
            console.log('📅 Création réservation Cal.com...');
            
            let hasWarning = false;
            
            try {
                const bookingResult = await window.bookingManager.createBookingAfterPayment(this.currentBooking);
                
                if (bookingResult && bookingResult.success) {
                    console.log('✅ Réservation Cal.com créée');
                    this.currentBooking.calcomId = bookingResult.data.id;
                    this.currentBooking.calcomData = bookingResult.data;
                    this.currentBooking.status = 'confirmed';
                } else {
                    throw new Error(bookingResult?.error || 'Échec Cal.com');
                }
            } catch (calcomError) {
                console.error('⚠️ Erreur Cal.com:', calcomError);
                hasWarning = true;
                this.currentBooking.calcomError = calcomError.message;
                this.currentBooking.status = 'payment_ok_reservation_failed';
                
                // En dev, simuler le succès
                if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                    console.warn('🧪 Dev mode: simulation réservation');
                    this.currentBooking.calcomId = 'mock_' + Date.now();
                    this.currentBooking.status = 'confirmed';
                    hasWarning = false;
                }
            }
            
            // 4. Nettoyer et rediriger
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
        console.error('❌ Erreur paiement:', message);
        
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

// Initialiser le gestionnaire
window.paymentManager = new PaymentManager();

// Debug
console.log('💳 PaymentManager (Stripe) chargé et prêt');