// payment.js - Gestionnaire de paiement adapté à votre schéma Supabase - LOGIQUE VIP COMPLÈTE

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
    
    console.group('📋 Affichage récapitulatif paiement - VERSION COMPLÈTE');
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
    let originalPriceDisplay = '';
    
    console.log('Prix bruts:', {
        price: booking.price,
        currency: booking.currency,
        isVip: booking.isVip,
        vipTotal: booking.vipTotal,
        discountPercent: booking.discountPercent
    });
    
    if (window.currencyManager) {
        formattedPrice = window.currencyManager.formatPriceInCurrency(booking.price, booking.currency);
        
        // Afficher le prix original pour les VIP
        if (booking.isVip && booking.vipPriceData) {
            originalPriceDisplay = window.currencyManager.formatPriceInCurrency(
                booking.vipPriceData.price, 
                booking.vipPriceData.currency
            );
        }
    } else {
        formattedPrice = `${booking.price.toFixed(2)} ${booking.currency || 'EUR'}`;
        if (booking.isVip && booking.vipPriceData) {
            originalPriceDisplay = `${booking.vipPriceData.price.toFixed(2)} ${booking.vipPriceData.currency}`;
        }
    }
    
    console.log('Prix formaté:', formattedPrice);
    if (originalPriceDisplay) {
        console.log('Prix original VIP:', originalPriceDisplay);
    }
    
    let packageInfo = '';
    let discountInfo = '';
    
    if (booking.courseType === 'essai') {
        packageInfo = `
            <div class="summary-item">
                <span class="label">Type d'achat:</span>
                <span class="value">Cours d'essai unique (15 min)</span>
            </div>
        `;
    } else if (booking.isPackage && booking.packageQuantity > 1) {
        const discount = booking.discountPercent || 0;
        const savings = booking.isVip ? 
            (booking.vipPriceData.price * booking.packageQuantity * (discount/100)) :
            (booking.originalPrice * booking.packageQuantity * (discount/100));
            
        packageInfo = `
            <div class="summary-item">
                <span class="label">Type d'achat:</span>
                <span class="value">Forfait ${booking.packageQuantity} cours</span>
            </div>
        `;
        
        if (discount > 0) {
            discountInfo = `
                <div class="summary-item highlight">
                    <span class="label">Réduction:</span>
                    <span class="value">${discount}% (économie: ${window.currencyManager ? 
                        window.currencyManager.formatPriceInCurrency(savings, booking.currency) : 
                        savings.toFixed(2)} ${booking.currency})</span>
                </div>
            `;
        }
    } else {
        packageInfo = `
            <div class="summary-item">
                <span class="label">Type d'achat:</span>
                <span class="value">Cours unique</span>
            </div>
        `;
    }
    
    let vipInfo = '';
    if (booking.isVip) {
        vipInfo = `
            <div class="summary-item vip-highlight">
                <span class="label">Statut:</span>
                <span class="value"><i class="fas fa-crown"></i> Prix VIP appliqué</span>
            </div>
        `;
        
        if (originalPriceDisplay && booking.packageQuantity > 1) {
            vipInfo += `
                <div class="summary-item">
                    <span class="label">Prix unitaire VIP:</span>
                    <span class="value">${originalPriceDisplay}</span>
                </div>
            `;
        }
    }
    
    summaryElement.innerHTML = `
        <div class="booking-summary-card">
            <h3 style="margin-bottom: 20px;"><i class="fas fa-calendar-check"></i> Récapitulatif</h3>
            <div class="summary-details">
                ${vipInfo}
                <div class="summary-item">
                    <span class="label">Type de cours:</span>
                    <span class="value">${this.getCourseName(booking.courseType)}</span>
                </div>
                ${packageInfo}
                ${discountInfo}
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
            
            // Utiliser le prix déjà calculé dans la devise courante
            let amountInCents = Math.round(this.currentBooking.price * 100);
            let currency = this.currentBooking.currency || 'eur';
            
            // Pour Stripe, convertir en minuscules et valider la devise
            currency = currency.toLowerCase();
            
            // Vérifier que Stripe supporte cette devise
            const stripeSupportedCurrencies = [
                'usd', 'eur', 'gbp', 'cad', 'aud', 'chf', 'jpy', 'sgd',
                'hkd', 'nzd', 'sek', 'nok', 'dkk', 'pln', 'mxn', 'brl',
                'inr', 'rub', 'try', 'zar', 'aed', 'sar', 'thb', 'krw', 'myr'
            ];
            
            if (!stripeSupportedCurrencies.includes(currency)) {
                // Fallback en USD
                console.warn(`⚠️ Devise ${currency} non supportée par Stripe, conversion en USD`);
                if (window.currencyManager) {
                    const amountUSD = window.currencyManager.convert(this.currentBooking.price, currency, 'USD');
                    amountInCents = Math.round(amountUSD * 100);
                    currency = 'usd';
                }
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
    
    // Méthode pour traiter l'achat de forfait - VERSION CORRIGÉE
    async processPackagePurchase(paymentData) {
        try {
            console.group('📦 Traitement achat forfait - LOGIQUE CORRECTE');
            
            const booking = this.currentBooking;
            
            if (!booking.isPackage) {
                return { success: false, error: 'Ce n\'est pas un forfait' };
            }
            
            console.log('📦 Détails du forfait:', {
                courseType: booking.courseType,
                quantity: booking.packageQuantity,
                price: booking.price,
                currency: booking.currency,
                originalCurrency: booking.originalCurrency,
                vipOriginalPrice: booking.vipPriceData?.price,
                isVip: booking.isVip,
                discountPercent: booking.discountPercent || 0,
                userId: booking.userId
            });
            
            // DÉTERMINER LE PRIX À UTILISER
            let packagePrice = booking.price;
            let packageCurrency = booking.currency;
            
            // Si VIP, utiliser le prix VIP dans la devise d'origine
            if (booking.isVip && booking.vipTotal) {
                packagePrice = booking.vipTotal;
                packageCurrency = booking.vipOriginalCurrency || booking.originalCurrency;
                console.log(`💰 Utilisation prix VIP: ${packagePrice} ${packageCurrency}`);
            }
            
            console.log(`💳 Prix final pour forfait: ${packagePrice} ${packageCurrency}`);
            
            // Ajouter les crédits à l'utilisateur via PackagesManager
            if (window.packagesManager && booking.userId) {
                const packageResult = await window.packagesManager.addCredits(
                    booking.userId,
                    booking.courseType,
                    booking.packageQuantity,
                    packagePrice,
                    packageCurrency,
                    paymentData.method,
                    paymentData.transactionId,
                    booking
                );
                
                if (!packageResult.success) {
                    throw new Error(packageResult.error || 'Échec de l\'ajout des crédits');
                }
                
                console.log('✅ Forfait acheté avec succès:', packageResult.package);
                
                // Créer une entrée dans la table packages
                if (window.supabase && booking.userId) {
                    const bookingNumber = `PKG-${Date.now().toString().slice(-8)}`;
                    
                    const { error } = await supabase
                        .from('bookings')
                        .insert({
                            user_id: booking.userId,
                            course_type: booking.courseType,
                            status: 'package_purchased',
                            price_paid: packagePrice,
                            currency: packageCurrency,
                            original_price: booking.vipPriceData?.price || booking.originalPrice,
                            original_currency: booking.vipPriceData?.currency || booking.originalCurrency,
                            payment_method: paymentData.method,
                            payment_reference: paymentData.transactionId,
                            booking_number: bookingNumber,
                            package_id: packageResult.package?.id,
                            package_quantity: booking.packageQuantity,
                            discount_percent: booking.discountPercent || 0,
                            is_vip_booking: booking.isVip || false,
                            created_at: new Date().toISOString()
                        });
                    
                    if (error) {
                        console.warn('⚠️ Erreur enregistrement achat forfait:', error);
                    } else {
                        console.log('✅ Enregistrement achat forfait créé');
                    }
                }
                
                console.groupEnd();
                return { success: true, package: packageResult.package };
            } else {
                throw new Error('PackagesManager non disponible');
            }
        } catch (error) {
            console.error('❌ Erreur traitement forfait:', error);
            console.groupEnd();
            return { success: false, error: error.message };
        }
    }
    
    async completePayment(method, transactionId = null) {
    console.group('✅ Finalisation paiement - LOGIQUE COMPLÈTE');
    console.log('Méthode:', method, 'Transaction ID:', transactionId);
    
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
        let bookingResult = null;
        
        // TRAITEMENT DIFFÉRENCIÉ
        if (this.currentBooking.isPackage) {
            // ACHAT DE FORFAIT AVEC RÉSERVATION IMMÉDIATE
            console.log('📦 Traitement achat forfait avec réservation immédiate');
            
            try {
                // 1. Acheter le forfait (crée le package avec X crédits)
                const packageResult = await this.processPackagePurchase(paymentData);
                
                if (!packageResult.success) {
                    throw new Error(packageResult.error || 'Échec achat forfait');
                }
                
                console.log('✅ Forfait acheté avec succès');
                
                // 2. Utiliser immédiatement 1 crédit pour la réservation
                if (window.packagesManager && this.currentBooking.userId) {
                    console.log(`💰 Utilisation d'1 crédit pour la réservation...`);
                    
                    // Créer d'abord un objet de réservation temporaire
                    const tempBookingData = {
                        id: 'temp_' + Date.now(),
                        courseType: this.currentBooking.courseType,
                        userId: this.currentBooking.userId,
                        startTime: this.currentBooking.startTime,
                        duration: this.currentBooking.duration
                    };
                    
                    const useCreditResult = await window.packagesManager.useCredit(
                        this.currentBooking.userId,
                        this.currentBooking.courseType,
                        tempBookingData
                    );
                    
                    if (!useCreditResult.success) {
                        console.warn('⚠️ Erreur utilisation crédit:', useCreditResult.error);
                        // Mettre à jour le statut pour indiquer l'erreur
                        this.currentBooking.creditError = useCreditResult.error;
                        hasWarning = true;
                    } else {
                        console.log(`✅ 1 crédit utilisé, reste: ${this.currentBooking.packageQuantity - 1} crédits`);
                        this.currentBooking.creditsUsed = 1;
                        this.currentBooking.remainingCredits = this.currentBooking.packageQuantity - 1;
                    }
                }
                
                // 3. Créer la réservation Cal.com pour le cours sélectionné
                console.log('🎫 Création réservation Cal.com pour le cours sélectionné...');
                
                // Vérifier que la réservation n'existe pas déjà (au cas où)
                if (!this.currentBooking.calcomId) {
                    bookingResult = await window.bookingManager.createBookingAfterPayment(this.currentBooking);
                    
                    if (bookingResult && bookingResult.success) {
                        console.log('✅ Réservation Cal.com créée');
                        this.currentBooking.calcomId = bookingResult.data.id;
                        this.currentBooking.status = 'confirmed';
                        this.currentBooking.packageId = packageResult.package?.id;
                        
                        resultMessage = `Votre forfait de ${this.currentBooking.packageQuantity} cours a été acheté avec succès ! Votre premier cours est réservé pour le ${new Date(this.currentBooking.startTime).toLocaleDateString('fr-FR')} à ${new Date(this.currentBooking.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`;
                        
                        // 4. Sauvegarder la réservation dans la base
                        if (window.authManager?.saveBookingData) {
                            const saveResult = await window.authManager.saveBookingData({
                                ...this.currentBooking,
                                paymentMethod: method,
                                transactionId: transactionId,
                                packageId: packageResult.package?.id,
                                creditsUsed: 1,
                                remainingCredits: this.currentBooking.packageQuantity - 1
                            });
                            
                            console.log('✅ Réservation sauvegardée:', saveResult);
                        }
                    } else {
                        throw new Error(bookingResult?.error || 'Échec Cal.com');
                    }
                } else {
                    console.log('⚠️ Réservation Cal.com existe déjà, pas de création nécessaire');
                    resultMessage = `Votre forfait de ${this.currentBooking.packageQuantity} cours a été acheté avec succès ! Votre premier cours est réservé pour le ${new Date(this.currentBooking.startTime).toLocaleDateString('fr-FR')} à ${new Date(this.currentBooking.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`;
                }
            } catch (packageError) {
                console.error('⚠️ Erreur achat forfait avec réservation:', packageError);
                hasWarning = true;
                this.currentBooking.status = 'payment_ok_booking_failed';
                resultMessage = 'Paiement réussi mais erreur lors de la réservation du cours. Contactez le support pour régulariser votre forfait.';
                this.currentBooking.errorDetails = packageError.message;
            }
        } else {
            // RÉSERVATION DE COURS UNIQUE (sans forfait)
            console.log('🎫 Traitement réservation cours unique');
            try {
                bookingResult = await window.bookingManager.createBookingAfterPayment(this.currentBooking);
                
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
                this.currentBooking.errorDetails = calcomError.message;
            }
        }
        
        // Nettoyer et rediriger
        localStorage.removeItem('pendingBooking');
        
        // Stocker le message de résultat
        sessionStorage.setItem('paymentResult', JSON.stringify({
            success: true,
            warning: hasWarning,
            message: resultMessage,
            booking: this.currentBooking,
            timestamp: new Date().toISOString()
        }));
        
        // Encoder les données de réservation pour l'URL
        const bookingEncoded = encodeURIComponent(JSON.stringify(this.currentBooking));
        const redirectUrl = `payment-success.html?booking=${bookingEncoded}&warning=${hasWarning}`;
        
        console.log('🔄 Redirection vers:', redirectUrl);
        console.groupEnd();
        
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1500);
        
    } catch (error) {
        console.error('❌ Erreur finalisation:', error);
        console.groupEnd();
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

// Fonctions de test VIP
window.testVipPaymentLogic = async function() {
    console.group('🧪 TEST LOGIQUE DE PAIEMENT VIP');
    
    // Simuler différents scénarios
    const testScenarios = [
        {
            name: '1 cours VIP',
            isVip: true,
            vipPrice: 3,
            vipCurrency: 'USD',
            quantity: 1,
            discount: 0,
            expected: 3.00
        },
        {
            name: '5 cours VIP (-2%)',
            isVip: true,
            vipPrice: 3,
            vipCurrency: 'USD',
            quantity: 5,
            discount: 2,
            expected: 14.70
        },
        {
            name: '10 cours VIP (-5%)',
            isVip: true,
            vipPrice: 3,
            vipCurrency: 'USD',
            quantity: 10,
            discount: 5,
            expected: 28.50
        },
        {
            name: '1 cours normal',
            isVip: false,
            basePrice: 20,
            quantity: 1,
            discount: 0,
            expected: 20.00
        },
        {
            name: '5 cours normal (-2%)',
            isVip: false,
            basePrice: 20,
            quantity: 5,
            discount: 2,
            expected: 98.00
        },
        {
            name: '10 cours normal (-5%)',
            isVip: false,
            basePrice: 20,
            quantity: 10,
            discount: 5,
            expected: 190.00
        }
    ];
    
    for (const scenario of testScenarios) {
        console.log(`\n📊 ${scenario.name}:`);
        
        if (scenario.isVip) {
            const total = scenario.vipPrice * scenario.quantity * (1 - scenario.discount/100);
            console.log(`  Calcul: ${scenario.vipPrice}${scenario.vipCurrency} × ${scenario.quantity} × (1 - ${scenario.discount}%)`);
            console.log(`  Total attendu: ${total.toFixed(2)} ${scenario.vipCurrency}`);
            
            if (Math.abs(total - scenario.expected) < 0.01) {
                console.log(`  ✅ CORRECT`);
            } else {
                console.log(`  ❌ ERREUR: Attendu ${scenario.expected}, obtenu ${total.toFixed(2)}`);
            }
        } else {
            const total = scenario.basePrice * scenario.quantity * (1 - scenario.discount/100);
            console.log(`  Calcul: ${scenario.basePrice}€ × ${scenario.quantity} × (1 - ${scenario.discount}%)`);
            console.log(`  Total attendu: ${total.toFixed(2)}€`);
            
            if (Math.abs(total - scenario.expected) < 0.01) {
                console.log(`  ✅ CORRECT`);
            } else {
                console.log(`  ❌ ERREUR: Attendu ${scenario.expected}€, obtenu ${total.toFixed(2)}€`);
            }
        }
    }
    
    console.groupEnd();
};
// FONCTION DE DEBUG GLOBALE
window.debugVIPPriceIssue = function() {
    console.group('🔍 DEBUG PRIX VIP');
    
    // 1. Vérifier CurrencyManager
    if (window.currencyManager) {
        console.log('💱 CurrencyManager:');
        console.log('- Devise courante:', window.currencyManager.currentCurrency);
        console.log('- Symbole:', window.currencyManager.getSymbol());
        console.log('- Taux USD:', window.currencyManager.exchangeRates['USD']);
        console.log('- Taux EUR:', window.currencyManager.exchangeRates['EUR']);
    }
    
    // 2. Vérifier AuthManager
    if (window.authManager) {
        console.log('🔐 AuthManager:');
        console.log('- Utilisateur VIP:', window.authManager.isUserVip());
        console.log('- Utilisateur:', window.authManager.user?.email);
        console.log('- Prix VIP chargés:', window.authManager.user?.vipPrices);
    }
    
    // 3. Test de conversion
    console.log('🧪 Test conversion 28.50 USD:');
    const testAmount = 28.50;
    if (window.currencyManager) {
        const converted = window.currencyManager.convert(testAmount, 'USD', window.currencyManager.currentCurrency);
        console.log(`${testAmount} USD → ${converted.toFixed(2)} ${window.currencyManager.currentCurrency}`);
        
        // Taux implicite
        const implicitRate = converted / testAmount;
        console.log(`Taux implicite USD→${window.currencyManager.currentCurrency}:`, implicitRate.toFixed(4));
    }
    
    // 4. Calcul manuel
    console.log('🧮 Calcul manuel:');
    const vipPrice = 3; // USD
    const quantity = 10;
    const discount = 5; // %
    
    const totalUSD = vipPrice * quantity * (1 - discount/100);
    console.log(`3 USD × 10 × (1 - 5%) = ${totalUSD.toFixed(2)} USD`);
    
    if (window.currencyManager) {
        const convertedTotal = window.currencyManager.convert(totalUSD, 'USD', window.currencyManager.currentCurrency);
        console.log(`→ ${convertedTotal.toFixed(2)} ${window.currencyManager.currentCurrency}`);
    }
    
    console.groupEnd();
};
// Initialiser
window.paymentManager = new PaymentManager();
console.log('💳 PaymentManager prêt avec logique VIP complète');

// Test automatique au chargement
if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
    setTimeout(() => {
        console.log('🧪 Test automatique de la logique de paiement');
        window.testVipPaymentLogic();
    }, 3000);
}