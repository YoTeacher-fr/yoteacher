// payment.js - Gestionnaire de paiement avec Stripe et gestion packages Supabase
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
        
        const platformName = this.getPlatformName(booking.location);
        
        let formattedPrice = `${booking.price}€`;
        if (window.currencyManager) {
            const amountEUR = booking.priceEUR || booking.price;
            formattedPrice = window.currencyManager.formatPrice(amountEUR);
        }
        
        summaryElement.innerHTML = `
            <div class="booking-summary-card">
                <h3 style="margin-bottom: 20px;"><i class="fas fa-calendar-check"></i> Récapitulatif</h3>
                <div class="summary-details">
                    <div class="summary-item">
                        <span class="label">Type de cours:</span>
                        <span class="value">${this.getCourseName(booking.courseType)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Nombre de cours:</span>
                        <span class="value">${booking.coursesCount || 1} cours</span>
                    </div>
                    ${booking.discountPercent > 0 ? `
                    <div class="summary-item">
                        <span class="label">Réduction:</span>
                        <span class="value">-${booking.discountPercent}%</span>
                    </div>
                    ` : ''}
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
                        <span class="value">${formattedPrice}</span>
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
            
            let amountInCents = Math.round(this.currentBooking.price * 100);
            let currency = this.currentBooking.currency || 'eur';
            
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
            const user = window.authManager?.getCurrentUser();
            
            // Créer les données de paiement
            const paymentData = {
                method: method,
                amount: this.currentBooking.priceEUR || this.currentBooking.price,
                currency: this.currentBooking.currency || 'EUR',
                transactionId: transactionId || `${method}_${Date.now()}`,
                status: 'completed',
                timestamp: new Date().toISOString(),
                booking: this.currentBooking
            };
            
            // SI PACKAGE (coursesCount > 1) : Créer le package AVANT la réservation
            let packageId = null;
            if (this.currentBooking.coursesCount > 1) {
                console.log('📦 Création package de', this.currentBooking.coursesCount, 'cours');
                packageId = await this.createPackageInSupabase(user, paymentData);
                
                if (!packageId) {
                    console.warn('⚠️ Échec création package, mais on continue');
                }
            }
            
            // Créer la réservation Cal.com
            let hasWarning = false;
            let calcomResult = null;
            
            try {
                calcomResult = await window.bookingManager.createBookingAfterPayment(this.currentBooking);
                
                if (calcomResult && calcomResult.success) {
                    console.log('✅ Réservation Cal.com créée');
                    this.currentBooking.calcomId = calcomResult.data.id;
                    this.currentBooking.calcomUid = calcomResult.data.uid;
                    this.currentBooking.supabaseId = calcomResult.supabaseId;
                    this.currentBooking.status = 'confirmed';
                    
                    // Si package créé, lier le package_id à la réservation
                    if (packageId && calcomResult.supabaseId) {
                        await this.linkPackageToBooking(calcomResult.supabaseId, packageId);
                    }
                } else {
                    throw new Error(calcomResult?.error || 'Échec Cal.com');
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
    
    // NOUVELLE MÉTHODE : Créer package dans Supabase
    async createPackageInSupabase(user, paymentData) {
        try {
            if (!window.supabase || !user) {
                console.warn('Supabase ou user non disponible');
                return null;
            }
            
            const coursesCount = this.currentBooking.coursesCount || 1;
            const discountPercent = this.currentBooking.discountPercent || 0;
            const courseType = this.currentBooking.courseType || this.currentBooking.eventType;
            const durationMinutes = parseInt(this.currentBooking.duration) || 60;
            const priceEUR = this.currentBooking.priceEUR || this.currentBooking.price;
            
            const packageRecord = {
                user_id: user.id,
                course_type: courseType,
                duration_minutes: durationMinutes,
                total_credits: coursesCount,
                remaining_credits: coursesCount,
                price_paid: priceEUR,
                currency: this.currentBooking.currency || 'EUR',
                discount_percent: discountPercent,
                purchased_at: new Date().toISOString()
                // expires_at sera calculé automatiquement par le trigger (3 mois)
            };
            
            console.log('💾 Création package Supabase:', packageRecord);
            
            const { data, error } = await supabase
                .from('packages')
                .insert([packageRecord])
                .select();
            
            if (error) {
                console.error('Erreur création package Supabase:', error);
                return null;
            }
            
            console.log('✅ Package créé avec ID:', data[0].id);
            console.log('📅 Expire le:', data[0].expires_at);
            
            // Enregistrer la transaction d'achat
            await this.recordCreditTransaction(user.id, data[0].id, coursesCount, 'purchase');
            
            return data[0].id;
            
        } catch (error) {
            console.error('Exception création package:', error);
            return null;
        }
    }
    
    // NOUVELLE MÉTHODE : Enregistrer transaction de crédits
    async recordCreditTransaction(userId, packageId, creditsChange, transactionType, bookingId = null) {
        try {
            if (!window.supabase) return;
            
            // Récupérer le package pour connaître les crédits avant/après
            const { data: pkg } = await supabase
                .from('packages')
                .select('remaining_credits')
                .eq('id', packageId)
                .single();
            
            if (!pkg) return;
            
            const creditsBefore = transactionType === 'purchase' ? 0 : pkg.remaining_credits + creditsChange;
            const creditsAfter = pkg.remaining_credits;
            
            const transaction = {
                user_id: userId,
                package_id: packageId,
                booking_id: bookingId,
                transaction_type: transactionType,
                credits_change: creditsChange,
                credits_before: creditsBefore,
                credits_after: creditsAfter,
                reason: this.getTransactionReason(transactionType, creditsChange)
            };
            
            const { error } = await supabase
                .from('credit_transactions')
                .insert([transaction]);
            
            if (error) {
                console.warn('Erreur enregistrement transaction:', error);
            } else {
                console.log('✅ Transaction crédits enregistrée');
            }
        } catch (error) {
            console.warn('Exception transaction crédits:', error);
        }
    }
    
    getTransactionReason(type, change) {
        switch(type) {
            case 'purchase':
                return `Achat de ${change} crédit(s)`;
            case 'use':
                return `Utilisation d'un crédit`;
            case 'refund':
                return `Restitution de crédit`;
            case 'expiration':
                return `Expiration de ${Math.abs(change)} crédit(s)`;
            default:
                return 'Transaction de crédits';
        }
    }
    
    // NOUVELLE MÉTHODE : Lier package à réservation
    async linkPackageToBooking(bookingId, packageId) {
        try {
            if (!window.supabase) return;
            
            const { error } = await supabase
                .from('bookings')
                .update({ package_id: packageId })
                .eq('id', bookingId);
            
            if (error) {
                console.warn('Erreur liaison package:', error);
            } else {
                console.log('✅ Package lié à la réservation');
            }
        } catch (error) {
            console.warn('Exception liaison package:', error);
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

window.paymentManager = new PaymentManager();
console.log('💳 PaymentManager prêt pour production avec gestion packages Supabase');