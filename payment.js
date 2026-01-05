// Gestionnaire de paiement pour YoTeacher - VERSION COMPLÈTE
class PaymentManager {
    constructor() {
        this.config = window.YOTEACHER_CONFIG || {};
        this.currentBooking = null;
        this.squarePayments = null;
        this.card = null;
        
        console.log('💳 PaymentManager initialisé');
    }
    
    async initSquare() {
        // Vérifier la configuration Square
        if (!this.config.SQUARE_APPLICATION_ID) {
            console.warn('⚠️ Square non configuré - paiements par carte désactivés');
            return false;
        }

        try {
            // Charger le SDK Square Web Payments
            if (!window.Square) {
                console.log('📦 Chargement du SDK Square...');
                await this.loadSquareScript();
            }

            // Initialiser Square Payments
            this.squarePayments = window.Square.payments(
                this.config.SQUARE_APPLICATION_ID,
                this.config.SQUARE_LOCATION_ID
            );

            console.log('✅ Square initialisé');
            return true;
        } catch (error) {
            console.error('❌ Erreur initialisation Square:', error);
            return false;
        }
    }

    loadSquareScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = this.config.SQUARE_ENVIRONMENT === 'production'
                ? 'https://web.squarecdn.com/v1/square.js'
                : 'https://sandbox.web.squarecdn.com/v1/square.js';
            
            script.onload = () => {
                console.log('✅ SDK Square chargé');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ Échec chargement SDK Square');
                reject(new Error('Échec chargement Square SDK'));
            };
            
            document.head.appendChild(script);
        });
    }

    async initializeCardPayment() {
        if (!this.squarePayments) {
            const initialized = await this.initSquare();
            if (!initialized) {
                throw new Error('Square non disponible');
            }
        }

        try {
            // Créer l'élément de carte
            this.card = await this.squarePayments.card();
            
            // Attacher à l'élément DOM
            await this.card.attach('#card-container');
            
            console.log('✅ Formulaire de carte Square prêt');
            return true;
        } catch (error) {
            console.error('❌ Erreur création formulaire carte:', error);
            throw error;
        }
    }

    // NOUVELLE MÉTHODE pour setup du formulaire
    async setupSquareForm() {
        const cardContainer = document.getElementById('card-container');
        if (!cardContainer) {
            console.error('❌ Container Square non trouvé');
            return;
        }

        try {
            console.log('🔧 Configuration formulaire Square...');
            await this.initializeCardPayment();
            
            // Activer le bouton
            const submitBtn = document.getElementById('processCardPayment');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-lock"></i> Payer par carte';
            }
        } catch (error) {
            console.error('❌ Erreur setup Square:', error);
            this.showPaymentError('Impossible de charger le formulaire de paiement');
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
        console.log('💳 Traitement carte bancaire');
        
        if (!this.card) {
            throw new Error('Formulaire de carte non initialisé');
        }

        try {
            // Tokeniser la carte
            const result = await this.card.tokenize();
            
            if (result.status === 'OK') {
                console.log('✅ Token carte reçu:', result.token);
                
                // Traiter le paiement
                await this.processSquarePayment(result.token);
            } else {
                throw new Error(result.errors?.[0]?.message || 'Erreur de tokenisation');
            }
        } catch (error) {
            console.error('❌ Erreur paiement carte:', error);
            throw error;
        }
    }
    
    async processSquarePayment(token) {
        // Vérifier si un backend existe
        const hasBackend = this.config.SQUARE_BACKEND_URL || false;
        
        if (hasBackend && this.config.ENV === 'production') {
            // En production avec backend
            try {
                const backendUrl = this.config.SQUARE_BACKEND_URL || '/api/process-payment';
                
                const response = await fetch(backendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sourceId: token,
                        amount: Math.round(this.currentBooking.price * 100),
                        currency: 'EUR',
                        booking: this.currentBooking
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Échec du traitement du paiement');
                }
                
                const result = await response.json();
                await this.completePayment('card', result.transactionId);
            } catch (error) {
                console.error('❌ Erreur API paiement:', error);
                throw error;
            }
        } else {
            // Mode simulation (pas de backend ou développement)
            console.log('🧪 Mode simulation - Token reçu:', token);
            console.log('💰 Montant:', this.currentBooking.price + '€');
            console.log('✅ Paiement simulé avec succès');
            
            // Simuler un délai réseau
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Compléter le paiement avec un ID de transaction simulé
            await this.completePayment('card', 'square_sim_' + Date.now());
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
console.log('💳 PaymentManager chargé et prêt');
