// payment.js - Gestionnaire de paiement adapté à votre schéma Supabase
class PaymentManager {
    constructor() {
        this.config = window.YOTEACHER_CONFIG || {};
        this.currentBooking = null;
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        
        console.log('💳 PaymentManager initialisé pour schéma Supabase');
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
    
    console.group('📋 Affichage récapitulatif paiement');
    console.log('Booking reçu:', booking);
    
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
    
    const platformName = this.getPlatformName(booking.location);
    
    let formattedPrice = '';
    
    console.log('Prix bruts:', {
        price: booking.price,
        priceEUR: booking.priceEUR,
        currency: booking.currency
    });
    
    if (window.currencyManager) {
        formattedPrice = window.currencyManager.formatPrice(
            booking.price,
            booking.currency || window.currencyManager.currentCurrency
        );
    } else {
        formattedPrice = `${booking.price.toFixed(2)} ${booking.currency || 'EUR'}`;
    }
    
    console.log('Prix formaté:', formattedPrice);
    
    let packageInfo = '';
    
    if (booking.courseType === 'essai') {
        packageInfo = `
            <div class="summary-item">
                <span class="label">Type d'achat:</span>
                <span class="value">Cours d'essai unique (15 min)</span>
            </div>
        `;
    } else if (booking.isPackage && booking.packageQuantity > 1) {
        const discount = booking.discountPercent || 0;
        packageInfo = `
            <div class="summary-item">
                <span class="label">Type d'achat:</span>
                <span class="value">Forfait ${booking.packageQuantity} cours ${discount > 0 ? `(-${discount}%)` : ''}</span>
            </div>
        `;
    } else {
        packageInfo = `
            <div class="summary-item">
                <span class="label">Type d'achat:</span>
                <span class="value">Cours unique</span>
            </div>
        `;
    }
    
    summaryElement.innerHTML = `
        <div class="booking-summary-card">
            <h3 style="margin-bottom: 20px;"><i class="fas fa-calendar-check"></i> Récapitulatif</h3>
            <div class="summary-details">
                <div class="summary-item">
                    <span class="label">Type de cours:</span>
                    <span class="value">${this.getCourseName(booking.courseType)}</span>
                </div>
                ${packageInfo}
                <div class="summary-item">
                    <span class="label">Date:</span>
                    <span class="value">${formattedDate}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Heure:</span>
                    <span class="value">${formattedTime}</span>
                </div>
                ${booking.courseType !== 'essai' && !booking.isPackage ? `
                <div class="summary-item">
                    <span class="label">Durée:</span>
                    <span class="value">${booking.duration || 60} min</span>
                </div>
                <div class="summary-item">
                    <span class="label">Plateforme:</span>
                    <span class="value">${platformName}</span>
                </div>
                ` : ''}
                ${booking.courseType === 'essai' ? `
                <div class="summary-item">
                    <span class="label">Durée:</span>
                    <span class="value">15 min</span>
                </div>
                <div class="summary-item">
                    <span class="label">Plateforme:</span>
                    <span class="value">${platformName}</span>
                </div>
                ` : ''}
                <div class="summary-item">
                    <span class="label">Élève:</span>
                    <span class="value">${booking.name}</span>
                </div>
                <div class="summary-item total">
                    <span class="label">Total:</span>
                    <span class="value">${formattedPrice}</span>
                </div>
            </div>
        </div>
    `;
    
    console.log('✅ Récapitulatif affiché');
    console.groupEnd();
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
            'curriculum': 'Curriculum complet',
            'examen': 'Préparation d\'examen'
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
            
            // Convertir le prix en centimes pour Stripe
            let amountInCents = Math.round(this.currentBooking.price * 100);
            let currency = this.currentBooking.currency || 'eur';
            
            // Si le CurrencyManager est disponible, utiliser la conversion
            if (window.currencyManager) {
                const amountEUR = this.currentBooking.priceEUR || this.currentBooking.price;
                const convertedAmount = window.currencyManager.convert(amountEUR, 'EUR', window.currencyManager.currentCurrency);
                amountInCents = Math.round(convertedAmount * 100);
                currency = window.currencyManager.currentCurrency.toLowerCase();
            }
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentMethodId: paymentMethodId,
                    amount: amountInCents,
                    currency: currency,
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
    
    // Méthode pour traiter l'achat de forfait
    async processPackagePurchase(paymentData) {
        try {
            console.log('📦 Traitement achat forfait...');
            
            const booking = this.currentBooking;
            
            if (!booking.isPackage) {
                return { success: false, error: 'Ce n\'est pas un forfait' };
            }
            
            console.log('📦 Détails du forfait:', {
                courseType: booking.courseType,
                quantity: booking.packageQuantity,
                price: booking.price,
                currency: booking.currency,
                userId: booking.userId
            });
            
            // Ajouter les crédits à l'utilisateur via PackagesManager
            if (window.packagesManager && booking.userId) {
                const packageResult = await window.packagesManager.addCredits(
                    booking.userId,
                    booking.courseType,
                    booking.packageQuantity,
                    booking.price,
                    booking.currency,
                    paymentData.method,
                    paymentData.transactionId,
			booking
                );
                
                if (!packageResult.success) {
                    throw new Error(packageResult.error || 'Échec de l\'ajout des crédits');
                }
                
                console.log('✅ Forfait acheté avec succès:', packageResult.package);
                
                // Créer une réservation pour enregistrer l'achat
                if (window.supabase && booking.userId) {
                    const bookingNumber = `PKG-${Date.now().toString().slice(-8)}`;
                    
                    const { error } = await supabase
                        .from('bookings')
                        .insert({
                            user_id: booking.userId,
                            course_type: booking.courseType,
                            status: 'package_purchased',
                            price_paid: booking.price,
                            currency: booking.currency,
                            payment_method: paymentData.method,
                            payment_reference: paymentData.transactionId,
                            booking_number: bookingNumber,
                            package_id: packageResult.package?.id,
                            created_at: new Date().toISOString()
                        });
                    
                    if (error) {
                        console.warn('⚠️ Erreur enregistrement achat forfait:', error);
                    }
                }
                
                return { success: true, package: packageResult.package };
            } else {
                throw new Error('PackagesManager non disponible');
            }
        } catch (error) {
            console.error('❌ Erreur traitement forfait:', error);
            return { success: false, error: error.message };
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
            
            // Sauvegarder le paiement via AuthManager
            if (window.authManager && this.currentBooking.userId) {
                try {
                    const paymentResult = await window.authManager.savePayment(paymentData);
                    console.log('✅ Paiement enregistré:', paymentResult);
                } catch (saveError) {
                    console.warn('⚠️ Erreur sauvegarde paiement:', saveError);
                }
            }
            
            let hasWarning = false;
            let resultMessage = '';
            
            // Traiter différemment selon le type d'achat
            if (this.currentBooking.isPackage) {
                // ACHAT DE FORFAIT VIP
                console.log('📦 Traitement achat forfait VIP');
                try {
                    const packageResult = await this.processPackagePurchase(paymentData);
                    
                    if (packageResult.success) {
                        console.log('✅ Forfait VIP acheté avec succès');
                        this.currentBooking.status = 'package_purchased';
                        resultMessage = 'Votre forfait a été acheté avec succès. Les crédits ont été ajoutés à votre compte.';
                        
                        // Envoyer un email de confirmation de forfait
                        this.sendPackageConfirmationEmail();
                    } else {
                        throw new Error(packageResult.error || 'Échec achat forfait');
                    }
                } catch (packageError) {
                    console.error('⚠️ Erreur achat forfait:', packageError);
                    hasWarning = true;
                    this.currentBooking.status = 'payment_ok_package_failed';
                    resultMessage = 'Paiement réussi mais erreur lors de l\'ajout des crédits. Contactez le support.';
                }
            } else {
                // RÉSERVATION DE COURS UNIQUE
                console.log('🎫 Traitement réservation cours unique');
                try {
                    const bookingResult = await window.bookingManager.createBookingAfterPayment(this.currentBooking);
                    
                    if (bookingResult && bookingResult.success) {
                        console.log('✅ Réservation Cal.com créée');
                        this.currentBooking.calcomId = bookingResult.data.id;
                        this.currentBooking.status = 'confirmed';
                        resultMessage = 'Votre réservation a été confirmée. Vous recevrez un email avec le lien de la visioconférence.';
                        
                        // Mettre à jour la réservation avec les infos de paiement
                        if (window.authManager?.saveBookingData) {
                            await window.authManager.saveBookingData({
                                ...this.currentBooking,
                                paymentMethod: method,
                                transactionId: transactionId
                            });
                        }
                    } else {
                        throw new Error(bookingResult?.error || 'Échec Cal.com');
                    }
                } catch (calcomError) {
                    console.error('⚠️ Erreur Cal.com:', calcomError);
                    hasWarning = true;
                    this.currentBooking.status = 'payment_ok_reservation_failed';
                    resultMessage = 'Paiement réussi mais erreur lors de la création de la réservation. Contactez le support.';
                }
            }
            
            // Nettoyer et rediriger
            localStorage.removeItem('pendingBooking');
            
            // Stocker le message de résultat
            sessionStorage.setItem('paymentResult', JSON.stringify({
                success: true,
                warning: hasWarning,
                message: resultMessage,
                booking: this.currentBooking
            }));
            const bookingEncoded = encodeURIComponent(JSON.stringify(this.currentBooking));
const redirectUrl = `payment-success.html?booking=${bookingEncoded}&warning=${hasWarning}`;

setTimeout(() => {
    window.location.href = redirectUrl;
}, 1000);
            
        } catch (error) {
            console.error('❌ Erreur finalisation:', error);
            this.showPaymentError('Erreur lors de la finalisation du paiement: ' + error.message);
        }
    }

    // Méthode pour envoyer un email de confirmation de forfait
    async sendPackageConfirmationEmail() {
        try {
            if (!window.supabase || !this.currentBooking) return;
            
            const { error } = await supabase.functions.invoke('send-package-confirmation', {
                body: {
                    booking: this.currentBooking,
                    timestamp: new Date().toISOString()
                }
            });
            
            if (!error) {
                console.log('📧 Email de confirmation de forfait envoyé');
            }
        } catch (error) {
            console.warn('⚠️ Erreur envoi email:', error);
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
console.log('💳 PaymentManager prêt pour schéma Supabase');