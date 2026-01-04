// Gestionnaire de paiement pour YoTeacher
class PaymentManager {
    constructor() {
        this.config = window.YOTEACHER_CONFIG || {};
        this.currentBooking = null;
        this.paymentMethods = [
            { id: 'revolut', name: 'Revolut', icon: 'fa-bank', color: '#FF5F00' },
            { id: 'wise', name: 'Wise', icon: 'fa-globe', color: '#9C5BDE' },
            { id: 'paypal', name: 'PayPal', icon: 'fa-paypal', color: '#003087' },
            { id: 'card', name: 'Carte bancaire (Square)', icon: 'fa-credit-card', color: '#3D5B96' },
            { id: 'interac', name: 'Interac', icon: 'fa-exchange-alt', color: '#E41E26' }
        ];
        
        // Initialiser Square si disponible
        if (this.config.SQUARE_APPLICATION_ID) {
            this.initSquare();
        }
    }
    
    initSquare() {
        // Charger le SDK Square uniquement si nécessaire
        if (typeof SqPaymentForm === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://sandbox.web.squarecdn.com/v1/square.js';
            script.onload = () => this.setupSquarePaymentForm();
            document.head.appendChild(script);
        } else {
            this.setupSquarePaymentForm();
        }
    }
    
    setupSquarePaymentForm() {
        if (!this.config.SQUARE_APPLICATION_ID || !this.config.SQUARE_LOCATION_ID) {
            console.warn('Configuration Square manquante');
            return;
        }
        
        try {
            this.squarePaymentForm = new SqPaymentForm({
                applicationId: this.config.SQUARE_APPLICATION_ID,
                locationId: this.config.SQUARE_LOCATION_ID,
                inputClass: 'sq-input',
                autoBuild: false,
                cardNumber: {
                    elementId: 'sq-card-number',
                    placeholder: '•••• •••• •••• ••••'
                },
                cvv: {
                    elementId: 'sq-cvv',
                    placeholder: 'CVV'
                },
                expirationDate: {
                    elementId: 'sq-expiration-date',
                    placeholder: 'MM/AA'
                },
                postalCode: {
                    elementId: 'sq-postal-code',
                    placeholder: 'Code postal'
                },
                callbacks: {
                    methodsSupported: (methods) => {
                        if (methods.card) {
                            console.log('✅ Square: Carte supportée');
                        }
                    },
                    createPaymentRequest: () => {
                        if (!this.currentBooking) {
                            return { error: 'Aucune réservation trouvée' };
                        }
                        return {
                            requestShippingAddress: false,
                            requestBillingContact: false,
                            currencyCode: 'EUR',
                            countryCode: 'FR',
                            total: {
                                amount: this.currentBooking.price.toString(),
                                label: this.currentBooking.courseName
                            }
                        };
                    },
                    cardNonceResponseReceived: (errors, nonce, cardData) => {
                        if (errors) {
                            console.error('Square erreur:', errors);
                            this.showPaymentError(errors[0]?.message || 'Erreur de carte');
                            return;
                        }
                        
                        console.log('✅ Nonce Square reçu:', nonce);
                        this.processSquarePayment(nonce);
                    },
                    paymentFormLoaded: () => {
                        console.log('✅ Formulaire Square chargé');
                        document.getElementById('processCardPayment').disabled = false;
                    }
                }
            });
            
            this.squarePaymentForm.build();
            
        } catch (error) {
            console.error('Erreur configuration Square:', error);
        }
    }
    
    async processBookingPayment(bookingData) {
        try {
            this.currentBooking = bookingData;
            
            // Afficher le récapitulatif
            this.displayBookingSummary(bookingData);
            
            // Sauvegarder la réservation dans localStorage pour persistance
            localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
            
            return { success: true, booking: bookingData };
            
        } catch (error) {
            console.error('Erreur traitement paiement:', error);
            return { success: false, error: error.message };
        }
    }
    
    displayBookingSummary(booking) {
        const summaryElement = document.getElementById('paymentSummary');
        if (!summaryElement) return;
        
        // Formater la date
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
                <h3><i class="fas fa-calendar-check"></i> Récapitulatif de réservation</h3>
                <div class="summary-details">
                    <div class="summary-item">
                        <span class="label">Type de cours:</span>
                        <span class="value">${booking.courseType === 'essai' ? 'Cours d\'essai' : 
                                          booking.courseType === 'conversation' ? 'Conversation' : 'Curriculum complet'}</span>
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
                        <span class="label">Email:</span>
                        <span class="value">${booking.email}</span>
                    </div>
                    <div class="summary-item total">
                        <span class="label">Total à payer:</span>
                        <span class="value">${booking.price}€</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    async handlePaymentMethod(methodId) {
        if (!this.currentBooking) {
            this.showPaymentError('Aucune réservation en cours');
            return;
        }
        
        try {
            // Afficher un indicateur de chargement
            this.showPaymentLoading(methodId);
            
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
                case 'card':
                    this.showCardPaymentForm();
                    break;
                case 'interac':
                    await this.processInteracPayment();
                    break;
                default:
                    throw new Error('Méthode de paiement non reconnue');
            }
            
        } catch (error) {
            console.error(`Erreur paiement ${methodId}:`, error);
            this.showPaymentError(error.message);
        }
    }
    
    async processRevolutPayment() {
        if (!this.config.REVOLUT_PAYMENT_LINK) {
            throw new Error('Lien Revolut non configuré');
        }
        
        const paymentLink = `${this.config.REVOLUT_PAYMENT_LINK}?amount=${this.currentBooking.price}&currency=EUR`;
        
        // Ouvrir dans un nouvel onglet
        window.open(paymentLink, '_blank');
        
        // En mode développement, simuler le succès
        if (this.config.ENV === 'development') {
            setTimeout(() => {
                this.completePayment('revolut');
            }, 2000);
        }
    }
    
    async processWisePayment() {
        if (!this.config.WISE_PAYMENT_LINK) {
            throw new Error('Lien Wise non configuré');
        }
        
        const paymentLink = `${this.config.WISE_PAYMENT_LINK}?amount=${this.currentBooking.price}&currency=EUR`;
        
        window.open(paymentLink, '_blank');
        
        if (this.config.ENV === 'development') {
            setTimeout(() => {
                this.completePayment('wise');
            }, 2000);
        }
    }
    
    async processPayPalPayment() {
        if (!this.config.PAYPAL_BUSINESS_EMAIL) {
            throw new Error('Email PayPal non configuré');
        }
        
        // Créer un lien PayPal avec les détails
        const paypalLink = `https://www.paypal.com/paypalme/${this.config.PAYPAL_BUSINESS_EMAIL}/${this.currentBooking.price}EUR`;
        
        window.open(paypalLink, '_blank');
        
        if (this.config.ENV === 'development') {
            setTimeout(() => {
                this.completePayment('paypal');
            }, 2000);
        }
    }
    
    showCardPaymentForm() {
        // Afficher le formulaire de carte
        document.getElementById('cardPaymentSection').style.display = 'block';
        
        // Scroller vers le formulaire
        document.getElementById('cardPaymentSection').scrollIntoView({ behavior: 'smooth' });
    }
    
    async processSquarePayment(nonce) {
        try {
            // En production, envoyer le nonce à votre backend
            if (this.config.ENV === 'production') {
                const response = await fetch('/api/process-payment', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.config.SQUARE_ACCESS_TOKEN}`
                    },
                    body: JSON.stringify({
                        sourceId: nonce,
                        amount: (this.currentBooking.price * 100), // En centimes
                        currency: 'EUR',
                        booking: this.currentBooking
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Échec du traitement du paiement');
                }
                
                const result = await response.json();
                this.completePayment('card', result.transactionId);
                
            } else {
                // En développement, simuler le succès
                console.log('Paiement Square simulé avec nonce:', nonce);
                setTimeout(() => {
                    this.completePayment('card', 'mock_' + Date.now());
                }, 1500);
            }
            
        } catch (error) {
            console.error('Erreur paiement Square:', error);
            this.showPaymentError('Échec du paiement par carte');
        }
    }
    
    async processInteracPayment() {
        // Pour Interac, on affiche les coordonnées bancaires
        this.showInteracDetails();
    }
    
    showInteracDetails() {
        const interacSection = document.getElementById('interacSection');
        if (!interacSection) return;
        
        interacSection.innerHTML = `
            <div class="interac-details">
                <h3><i class="fas fa-university"></i> Paiement Interac</h3>
                <p>Veuillez effectuer un virement Interac aux coordonnées suivantes :</p>
                
                <div class="bank-details">
                    <div class="detail-item">
                        <span class="label">Nom:</span>
                        <span class="value">Yoann Bourbia</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Email Interac:</span>
                        <span class="value">yoann@yoteacher.com</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Montant:</span>
                        <span class="value">${this.currentBooking.price}€</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Référence:</span>
                        <span class="value">Cours-${Date.now().toString().slice(-6)}</span>
                    </div>
                </div>
                
                <p class="instruction">
                    <i class="fas fa-info-circle"></i> Une fois le virement effectué, votre réservation sera confirmée automatiquement.
                </p>
                
                <div class="interac-actions">
                    <button id="confirmInterac" class="btn btn-primary">
                        <i class="fas fa-check"></i> J'ai effectué le virement
                    </button>
                    <button onclick="document.getElementById('interacSection').style.display='none'" 
                            class="btn btn-secondary">
                        <i class="fas fa-times"></i> Annuler
                    </button>
                </div>
            </div>
        `;
        
        interacSection.style.display = 'block';
        
        // Gestion de la confirmation Interac
        document.getElementById('confirmInterac')?.addEventListener('click', () => {
            this.completePayment('interac');
        });
    }
    
    async completePayment(method, transactionId = null) {
        try {
            // 1. Sauvegarder le paiement d'abord
            const paymentData = {
                method: method,
                amount: this.currentBooking.price,
                transactionId: transactionId || 'manual_' + Date.now(),
                status: 'completed',
                timestamp: new Date().toISOString(),
                booking: this.currentBooking
            };
            
            // Sauvegarder dans Supabase si disponible
            if (window.supabase && this.currentBooking.userId) {
                await this.savePaymentToSupabase(paymentData);
            }
            
            // Sauvegarder localement
            localStorage.setItem('lastPayment', JSON.stringify(paymentData));
            
            // 2. Maintenant créer la réservation sur Cal.com
            console.log('🔄 Création de la réservation sur Cal.com...');
            
            const bookingResult = await window.bookingManager.createBookingAfterPayment(this.currentBooking);
            
            if (!bookingResult.success) {
                throw new Error('Échec de la création de la réservation sur Cal.com');
            }
            
            console.log('✅ Réservation Cal.com créée avec succès');
            
            // 3. Mettre à jour les données de réservation avec l'ID Cal.com
            this.currentBooking.calcomId = bookingResult.data.id;
            this.currentBooking.calcomData = bookingResult.data;
            this.currentBooking.status = 'confirmed';
            
            // 4. Nettoyer le localStorage
            localStorage.removeItem('pendingBooking');
            
            // 5. Rediriger vers la page de succès
            setTimeout(() => {
                window.location.href = `payment-success.html?booking=${encodeURIComponent(JSON.stringify(this.currentBooking))}`;
            }, 1000);
            
        } catch (error) {
            console.error('Erreur finalisation paiement:', error);
            
            // En cas d'erreur Cal.com, on garde quand même le paiement comme validé
            // mais on montre un avertissement
            this.showPaymentError('Paiement accepté mais problème avec la réservation. Nous vous contacterons.');
            
            // Sauvegarder l'erreur
            this.currentBooking.calcomError = error.message;
            this.currentBooking.status = 'payment_ok_reservation_failed';
            
            localStorage.setItem('failedBooking', JSON.stringify(this.currentBooking));
            localStorage.removeItem('pendingBooking');
            
            // Rediriger quand même vers le succès mais avec avertissement
            setTimeout(() => {
                window.location.href = `payment-success.html?booking=${encodeURIComponent(JSON.stringify(this.currentBooking))}&warning=true`;
            }, 3000);
        }
    }
    
    async savePaymentToSupabase(paymentData) {
        try {
            if (!window.supabase) return false;
            
            const { error } = await supabase
                .from('payments')
                .insert([{
                    user_id: paymentData.booking.userId,
                    booking_id: paymentData.booking.id,
                    amount: paymentData.amount,
                    currency: 'EUR',
                    method: paymentData.method,
                    transaction_id: paymentData.transactionId,
                    status: paymentData.status,
                    payment_data: paymentData,
                    created_at: new Date().toISOString()
                }]);
            
            if (error) {
                console.warn('Erreur sauvegarde paiement:', error);
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('Exception sauvegarde paiement:', error);
            return false;
        }
    }
    
    showPaymentLoading(methodId) {
        const button = document.querySelector(`[data-method="${methodId}"]`);
        if (button) {
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement en cours...';
            button.disabled = true;
            
            // Restaurer après 10 secondes max
            setTimeout(() => {
                if (button.disabled) {
                    button.innerHTML = originalHTML;
                    button.disabled = false;
                }
            }, 10000);
        }
    }
    
    showPaymentError(message) {
        // Afficher une notification d'erreur
        const errorDiv = document.getElementById('paymentError');
        if (errorDiv) {
            errorDiv.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${message}</span>
                </div>
            `;
            errorDiv.style.display = 'block';
            
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        } else {
            alert(`Erreur: ${message}`);
        }
    }
}

// Initialiser le gestionnaire de paiement
window.paymentManager = new PaymentManager();