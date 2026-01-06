// payment.js - Gestionnaire de paiement avec conversion devise et Interac CAD
class PaymentManager {
    constructor() {
        this.config = window.YOTEACHER_CONFIG || {};
        this.currentBooking = null;
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        
        console.log('💳 PaymentManager initialisé');
    }
    
    async initStripe() {
        if (!this.config.STRIPE_PUBLISHABLE_KEY) {
            console.error('❌ STRIPE_PUBLISHABLE_KEY non configurée');
            return false;
        }

        try {
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
            
            this.displayBookingSummary(bookingData);
            this.updatePaymentDetails();
            this.setupInteracConversion();
            
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
        
        const courseName = this.getCourseName(booking.courseType);
        const totalPrice = booking.price * (booking.quantity || 1);
        
        summaryElement.innerHTML = `
            <div class="booking-summary-card">
                <h3 style="margin-bottom: 20px;"><i class="fas fa-calendar-check"></i> Récapitulatif</h3>
                <div class="summary-details">
                    <div class="summary-item">
                        <span class="label">Type de cours:</span>
                        <span class="value">${courseName}</span>
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
                        <span class="label">Nombre de cours:</span>
                        <span class="value">${booking.quantity || 1}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Outil:</span>
                        <span class="value">${this.getMeetingToolName(booking.meetingTool)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Élève:</span>
                        <span class="value">${booking.name}</span>
                    </div>
                    <div class="summary-item total">
                        <span class="label">Total:</span>
                        <span class="value">${this.formatPrice(totalPrice)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    getCourseName(courseType) {
        const names = {
            'essai': 'Cours d\'essai',
            'conversation': 'Conversation',
            'curriculum': 'Curriculum complet'
        };
        return names[courseType] || courseType;
    }

    getMeetingToolName(tool) {
        const names = {
            'cal_video': 'Cal.com Video',
            'zoom': 'Zoom',
            'google_meet': 'Google Meet',
            'microsoft_teams': 'Microsoft Teams',
            'whereby': 'Whereby',
            'jitsi': 'Jitsi',
            'phone': 'Téléphone'
        };
        return names[tool] || tool;
    }

    formatPrice(amount) {
        if (window.currencyManager) {
            return window.currencyManager.format(amount);
        }
        return `${amount}€`;
    }

    updatePaymentDetails() {
        if (!this.currentBooking) return;
        
        const refNumber = Date.now().toString().slice(-6);
        const amount = this.currentBooking.price * (this.currentBooking.quantity || 1);
        
        // Configuration
        const config = this.config;
        const contactName = config.CONTACT_NAME || "Yoann Bourbia";
        const contactEmail = config.CONTACT_EMAIL || "yoann@yoteacher.com";
        const revolutLink = config.REVOLUT_PAYMENT_LINK || "https://revolut.me/yoann";
        const wiseLink = config.WISE_PAYMENT_LINK || "https://wise.com/pay/yoann";
        const paypalEmail = config.PAYPAL_BUSINESS_EMAIL || "yoann@yoteacher.com";
        const interacEmail = config.INTERAC_EMAIL || contactEmail;
        
        // Mettre à jour les références
        document.getElementById('revolutRefNum').textContent = refNumber;
        document.getElementById('interacRefNum').textContent = refNumber;
        
        // Mettre à jour les montants avec conversion devise
        this.updatePaymentAmounts(amount);
        
        // Mettre à jour les noms
        document.querySelectorAll('#revolutName, #wiseName, #paypalName, #interacName').forEach(el => {
            el.textContent = contactName;
        });
        
        // Mettre à jour les emails
        document.getElementById('wiseEmail').textContent = contactEmail;
        document.getElementById('paypalEmail').textContent = paypalEmail;
        document.getElementById('interacEmail').textContent = interacEmail;
        
        // Mettre à jour les liens d'affichage
        const revolutDisplay = revolutLink.replace('https://', '');
        const wiseDisplay = wiseLink.replace('https://', '');
        const paypalUsername = paypalEmail.split('@')[0];
        const paypalDisplay = `paypal.me/${paypalUsername}`;
        
        document.getElementById('revolutLinkDisplay').textContent = revolutDisplay;
        document.getElementById('wiseLinkDisplay').textContent = wiseDisplay;
        document.getElementById('paypalLinkDisplay').textContent = paypalDisplay;
        
        // Stocker les liens complets
        const currency = window.currencyManager?.getCurrentCurrency() || 'EUR';
        const revolutFullLink = `${revolutLink}?amount=${amount}&currency=${currency}&reference=COURS-${refNumber}`;
        const wiseFullLink = `${wiseLink}?amount=${amount}&currency=${currency}`;
        const paypalFullLink = `https://www.paypal.com/paypalme/${paypalUsername}/${amount}${currency}`;
        
        document.getElementById('revolutLinkItem').dataset.link = revolutFullLink;
        document.getElementById('wiseLinkItem').dataset.link = wiseFullLink;
        document.getElementById('paypalLinkItem').dataset.link = paypalFullLink;
        
        // Générer les QR codes
        this.generateQrCodes(revolutFullLink, wiseFullLink, paypalFullLink);
    }

    updatePaymentAmounts(amount) {
        if (!window.currencyManager) {
            // Fallback sans conversion
            document.querySelectorAll('#revolutAmount, #wiseAmount, #paypalAmount, #interacAmount').forEach(el => {
                el.textContent = amount + '€';
            });
            return;
        }
        
        const currency = window.currencyManager.getCurrentCurrency();
        const formattedAmount = window.currencyManager.format(amount);
        
        // Mettre à jour tous les montants sauf Interac (géré séparément)
        document.querySelectorAll('#revolutAmount, #wiseAmount, #paypalAmount').forEach(el => {
            el.textContent = formattedAmount;
        });
        
        // Interac toujours en CAD
        this.updateInteracAmount(amount, currency);
    }

    setupInteracConversion() {
        // Écouter les changements de devise pour mettre à jour Interac
        window.addEventListener('currencyChanged', () => {
            if (this.currentBooking) {
                const amount = this.currentBooking.price * (this.currentBooking.quantity || 1);
                const currency = window.currencyManager.getCurrentCurrency();
                this.updateInteracAmount(amount, currency);
            }
        });
    }

    updateInteracAmount(amount, fromCurrency) {
        const interacAmountElement = document.getElementById('interacAmount');
        if (!interacAmountElement) return;
        
        if (fromCurrency === 'CAD') {
            interacAmountElement.textContent = `${amount} CAD`;
            this.removeConversionNote();
        } else {
            // Convertir en CAD
            const cadAmount = window.currencyManager.convertToCAD(amount, fromCurrency);
            interacAmountElement.textContent = `${cadAmount.toFixed(2)} CAD`;
            this.showConversionNote(amount, fromCurrency, cadAmount);
        }
    }

    showConversionNote(originalAmount, fromCurrency, cadAmount) {
        this.removeConversionNote();
        
        const conversionNote = document.createElement('div');
        conversionNote.className = 'conversion-note';
        conversionNote.innerHTML = `
            <small>
                <i class="fas fa-exchange-alt"></i>
                Converti depuis ${window.currencyManager.format(originalAmount, fromCurrency)} 
                (taux du jour)
            </small>
        `;
        
        interacAmountElement.parentElement.appendChild(conversionNote);
    }

    removeConversionNote() {
        const existingNote = document.querySelector('.conversion-note');
        if (existingNote) {
            existingNote.remove();
        }
    }

    generateQrCodes(revolutLink, wiseLink, paypalLink) {
        // QR Code Revolut
        const revolutQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(revolutLink)}`;
        const revolutQrImg = document.getElementById('revolutQrCode');
        if (revolutQrImg) {
            revolutQrImg.src = revolutQrUrl;
            revolutQrImg.dataset.link = revolutLink;
        }
        
        // QR Code Wise
        const wiseQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(wiseLink)}`;
        const wiseQrImg = document.getElementById('wiseQrCode');
        if (wiseQrImg) {
            wiseQrImg.src = wiseQrUrl;
            wiseQrImg.dataset.link = wiseLink;
        }
        
        // QR Code PayPal
        const paypalQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(paypalLink)}`;
        const paypalQrImg = document.getElementById('paypalQrCode');
        if (paypalQrImg) {
            paypalQrImg.src = paypalQrUrl;
            paypalQrImg.dataset.link = paypalLink;
        }
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
            const amount = this.currentBooking.price * (this.currentBooking.quantity || 1);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentMethodId: paymentMethodId,
                    amount: Math.round(amount * 100),
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
                amount: this.currentBooking.price * (this.currentBooking.quantity || 1),
                transactionId: transactionId || `${method}_${Date.now()}`,
                status: 'completed',
                timestamp: new Date().toISOString(),
                booking: this.currentBooking
            };
            
            // Sauvegarder le paiement
            if (window.authManager && this.currentBooking.userId) {
                await window.authManager.savePayment(paymentData);
            }
            
            // Créer la réservation Cal.com
            let hasWarning = false;
            
            try {
                const bookingResult = await window.bookingManager.createBookingAfterPayment(this.currentBooking);
                
                if (bookingResult && bookingResult.success) {
                    console.log('✅ Réservation Cal.com créée');
                    this.currentBooking.calcomId = bookingResult.data.id;
                    this.currentBooking.status = 'confirmed';
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
console.log('💳 PaymentManager prêt avec conversion devise');

// Fonction pour mettre à jour Interac lors du chargement
document.addEventListener('DOMContentLoaded', function() {
    // Mettre à jour Interac si paymentManager est initialisé
    setTimeout(() => {
        if (window.paymentManager && window.paymentManager.currentBooking) {
            const amount = window.paymentManager.currentBooking.price * 
                (window.paymentManager.currentBooking.quantity || 1);
            const currency = window.currencyManager?.getCurrentCurrency() || 'EUR';
            window.paymentManager.updateInteracAmount(amount, currency);
        }
    }, 500);
});