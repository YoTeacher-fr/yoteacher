// Gestion des paiements
class PaymentManager {
    constructor() {
        const config = window.YOTEACHER_CONFIG || {};
        this.squareAppId = config.SQUARE_APP_ID || 'sandbox-sq0idb-YOUR_APP_ID';
        this.squareLocationId = config.SQUARE_LOCATION_ID || 'YOUR_LOCATION_ID';
        
        this.paypalEmail = config.PAYPAL_EMAIL || 'contact@yoteacher.fr';
        this.revolutTag = config.REVOLUT_TAG || '@yoteacher';
        this.wiseEmail = config.WISE_EMAIL || 'contact@yoteacher.fr';
        this.interacEmail = config.INTERAC_EMAIL || 'contact@yoteacher.fr';
        
        this.selectedMethod = null;
        this.bookingData = null;
        this.card = null;
        this.payments = null;
    }

    async init() {
        // Récupérer les données de réservation depuis sessionStorage
        this.loadBookingData();
        
        // Afficher le résumé
        this.displayBookingSummary();
        
        // Initialiser les événements
        this.setupEventListeners();
        
        // Initialiser Square
        await this.initSquarePayments();
    }

    loadBookingData() {
        // D'abord essayer depuis l'URL (lien direct)
        const urlParams = new URLSearchParams(window.location.search);
        const bookingParam = urlParams.get('booking');
        
        if (bookingParam) {
            try {
                this.bookingData = JSON.parse(decodeURIComponent(bookingParam));
                console.log('📦 Données de réservation chargées depuis URL:', this.bookingData);
                return;
            } catch (error) {
                console.error('Erreur parsing URL booking data:', error);
            }
        }
        
        // Sinon, essayer depuis sessionStorage
        const bookingDataStr = sessionStorage.getItem('pendingBooking');
        if (bookingDataStr) {
            this.bookingData = JSON.parse(bookingDataStr);
            console.log('📦 Données de réservation chargées depuis sessionStorage:', this.bookingData);
            return;
        }
        
        // Aucune donnée trouvée
        alert('Aucune réservation en attente. Vous allez être redirigé.');
        window.location.href = 'booking.html';
    }

    displayBookingSummary() {
        if (!this.bookingData) return;

        // Type de cours
        const courseTypes = {
            'essai': 'Cours d\'essai',
            'conversation': 'Conversation anglaise',
            'curriculum': 'Cours sur curriculum'
        };
        
        const eventType = this.bookingData.eventType || this.bookingData.courseType;
        document.getElementById('course-type').textContent = 
            courseTypes[eventType] || eventType;

        // Date - gérer différents formats
        const startTime = this.bookingData.startTime || this.bookingData.calcomData?.start;
        const date = new Date(startTime);
        document.getElementById('course-date').textContent = 
            date.toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

        // Heure
        document.getElementById('course-time').textContent = 
            date.toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });

        // Durée
        const duration = this.bookingData.duration || 
                        this.bookingData.lengthInMinutes || 
                        this.bookingData.calcomData?.duration ||
                        this.getDefaultDuration(eventType);
        document.getElementById('course-duration').textContent = `${duration} minutes`;

        // Montant
        const price = parseFloat(this.bookingData.price) || 
                     parseFloat(this.bookingData.calcomData?.metadata?.price) ||
                     this.calculatePrice(eventType, duration);
        document.getElementById('total-amount').textContent = `${price}€`;
        document.getElementById('payment-amount').textContent = `${price}€`;

        // Générer référence de paiement
        const reference = this.generatePaymentReference();
        document.querySelectorAll('#payment-reference, #revolut-reference, #wise-reference, #interac-reference')
            .forEach(el => el.textContent = reference);

        // Mettre à jour les emails
        document.getElementById('paypal-email').textContent = this.paypalEmail;
        document.getElementById('revolut-tag').textContent = this.revolutTag;
        document.getElementById('wise-email').textContent = this.wiseEmail;
        document.getElementById('interac-email').textContent = this.interacEmail;
    }

    getDefaultDuration(eventType) {
        switch(eventType) {
            case 'essai': return 15;
            case 'conversation': return 60;
            case 'curriculum': return 60;
            default: return 60;
        }
    }

    calculatePrice(eventType, duration) {
        // Prix par défaut selon le type de cours
        const basePrices = {
            'essai': 0, // Gratuit
            'conversation': 25, // 25€/heure
            'curriculum': 30  // 30€/heure
        };

        const basePrice = basePrices[eventType] || 25;
        
        // Calculer le prix proportionnel à la durée
        if (eventType === 'essai') return 0;
        return Math.round((basePrice / 60) * duration);
    }

    generatePaymentReference() {
        const date = new Date();
        const timestamp = date.getTime().toString().slice(-6);
        const eventType = (this.bookingData.eventType || this.bookingData.courseType || 'course');
        const type = eventType.substring(0, 3).toUpperCase();
        return `YT-${type}-${timestamp}`;
    }

    setupEventListeners() {
        // Sélection des méthodes de paiement
        document.querySelectorAll('.payment-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const method = option.getAttribute('data-method');
                this.selectPaymentMethod(method);
            });
        });
    }

    selectPaymentMethod(method) {
        console.log('💳 Méthode de paiement sélectionnée:', method);
        
        // Retirer la sélection précédente
        document.querySelectorAll('.payment-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // Masquer toutes les instructions
        document.querySelectorAll('.payment-instructions').forEach(inst => {
            inst.classList.remove('active');
        });

        // Masquer le formulaire de carte
        document.getElementById('card-container').classList.remove('active');

        // Sélectionner la nouvelle option
        const selectedOption = document.querySelector(`[data-method="${method}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }

        this.selectedMethod = method;

        // Afficher les instructions ou le formulaire approprié
        switch(method) {
            case 'card':
                document.getElementById('card-container').classList.add('active');
                break;
            case 'paypal':
                document.getElementById('paypal-instructions').classList.add('active');
                this.processManualPayment('PayPal');
                break;
            case 'revolut':
                document.getElementById('revolut-instructions').classList.add('active');
                this.processManualPayment('Revolut');
                break;
            case 'wise':
                document.getElementById('wise-instructions').classList.add('active');
                this.processManualPayment('Wise');
                break;
            case 'interac':
                document.getElementById('interac-instructions').classList.add('active');
                this.processManualPayment('Interac');
                break;
        }
    }

    async initSquarePayments() {
        if (!window.Square) {
            console.warn('⚠️ Square SDK non chargé');
            this.showSquareFallback();
            return;
        }

        // Vérifier la configuration
        if (!this.squareAppId || this.squareAppId === 'sandbox-sq0idb-YOUR_APP_ID') {
            console.warn('⚠️ Square APP ID non configuré');
            this.showSquareFallback();
            return;
        }

        try {
            this.payments = window.Square.payments(this.squareAppId, this.squareLocationId);
            this.card = await this.payments.card();
            await this.card.attach('#card-element');

            console.log('✅ Square Payments initialisé');

            // Événement de paiement
            document.getElementById('card-button').addEventListener('click', async (e) => {
                await this.handleCardPayment(e);
            });

        } catch (error) {
            console.error('❌ Erreur initialisation Square:', error);
            this.showSquareFallback();
        }
    }

    showSquareFallback() {
        const cardContainer = document.getElementById('card-container');
        if (!cardContainer) return;
        
        cardContainer.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #ff9800;">
                <i class="fas fa-exclamation-triangle" style="font-size: 40px; margin-bottom: 10px;"></i>
                <p><strong>Configuration Square requise</strong></p>
                <p style="font-size: 14px; margin-top: 10px;">
                    Pour activer le paiement par carte, configurez SQUARE_APP_ID et SQUARE_LOCATION_ID dans config.js
                </p>
                ${this.isDevelopment() ? `
                    <button id="mock-card-payment" style="
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        margin-top: 15px;
                        font-size: 14px;
                        font-weight: 600;
                    ">
                        <i class="fas fa-flask"></i> Simuler le paiement (mode dev)
                    </button>
                ` : ''}
                <p style="font-size: 12px; color: #666; margin-top: 15px;">
                    En attendant, vous pouvez utiliser les autres moyens de paiement ci-dessus.
                </p>
            </div>
        `;

        if (this.isDevelopment()) {
            document.getElementById('mock-card-payment')?.addEventListener('click', () => {
                this.mockCardPayment();
            });
        }
    }

    isDevelopment() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname.includes('127.0.0.1') ||
               window.location.hostname.includes('.local');
    }

    async handleCardPayment(event) {
        event.preventDefault();

        const cardButton = document.getElementById('card-button');
        const loading = document.getElementById('loading');

        try {
            cardButton.disabled = true;
            loading.classList.add('active');

            // Tokeniser la carte
            const result = await this.card.tokenize();
            if (result.status === 'OK') {
                console.log('✅ Token de carte généré:', result.token);

                // Envoyer le token à votre backend pour traiter le paiement
                await this.processCardPayment(result.token);
            } else {
                console.error('❌ Erreur tokenisation:', result.errors);
                alert('Erreur lors du traitement de votre carte. Veuillez vérifier vos informations.');
            }

        } catch (error) {
            console.error('❌ Erreur paiement carte:', error);
            alert('Une erreur est survenue lors du paiement.');
        } finally {
            cardButton.disabled = false;
            loading.classList.remove('active');
        }
    }

    async processCardPayment(token) {
        // TODO: Implémenter l'appel à votre backend pour traiter le paiement Square
        console.log('💳 Traitement du paiement avec token:', token);

        const price = this.bookingData.price || this.calculatePrice(
            this.bookingData.eventType, 
            this.bookingData.lengthInMinutes || this.getDefaultDuration(this.bookingData.eventType)
        );

        // Simuler l'appel API (à remplacer par votre vraie API)
        const paymentData = {
            sourceId: token,
            amountMoney: {
                amount: price * 100, // Montant en centimes
                currency: 'EUR'
            },
            locationId: this.squareLocationId,
            idempotencyKey: this.generateIdempotencyKey()
        };

        console.log('📤 Données de paiement:', paymentData);

        // Ici, vous devriez appeler votre backend qui appellera Square
        // const response = await fetch('/api/process-payment', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(paymentData)
        // });

        // Simuler un succès pour le développement
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Enregistrer le paiement et finaliser la réservation
        await this.finalizeBooking('card', token);
    }

    async mockCardPayment() {
        const loading = document.getElementById('loading');
        loading.classList.add('active');

        await new Promise(resolve => setTimeout(resolve, 2000));

        loading.classList.remove('active');
        await this.finalizeBooking('card', 'mock_token_dev');
    }

    async processManualPayment(method) {
        console.log(`💰 Instructions de paiement affichées pour ${method}`);
        
        // Afficher un message de confirmation après quelques secondes
        setTimeout(() => {
            const confirm = window.confirm(
                `Avez-vous effectué le paiement via ${method} ?\n\n` +
                `Si oui, votre réservation sera confirmée une fois le paiement vérifié (généralement sous 24h).`
            );

            if (confirm) {
                this.finalizeBooking(method.toLowerCase(), 'pending_verification');
            }
        }, 3000);
    }

    async finalizeBooking(paymentMethod, paymentToken) {
        console.log('🎉 Finalisation de la réservation...');

        try {
            const eventType = this.bookingData.eventType || this.bookingData.courseType;
            const duration = this.bookingData.duration || 
                            this.bookingData.lengthInMinutes || 
                            this.bookingData.calcomData?.duration ||
                            this.getDefaultDuration(eventType);
            
            // Si la réservation Cal.com existe déjà, on enregistre juste le paiement
            const calcomId = this.bookingData.calcomId || this.bookingData.calcomData?.id;
            
            if (!calcomId && window.bookingManager) {
                // Créer la réservation Cal.com si elle n'existe pas encore
                const bookingResult = await window.bookingManager.createCalcomBooking(this.bookingData, 
                    window.authManager?.getCurrentUser());

                if (!bookingResult.success) {
                    throw new Error('Erreur lors de la création de la réservation Cal.com');
                }
                
                this.bookingData.calcomId = bookingResult.booking?.id || bookingResult.booking?.uid;
                this.bookingData.calcomData = bookingResult.booking;
            }

            // Enregistrer les informations de paiement dans Supabase
            if (window.supabase && window.authManager) {
                const user = window.authManager.getCurrentUser();
                
                const paymentRecord = {
                    user_id: user?.id || null,
                    booking_id: this.bookingData.calcomId || 
                               this.bookingData.calcomData?.id || 
                               this.bookingData.calcomData?.uid,
                    amount: parseFloat(this.bookingData.price) || 
                           parseFloat(this.bookingData.calcomData?.metadata?.price) ||
                           this.calculatePrice(eventType, duration),
                    currency: 'EUR',
                    payment_method: paymentMethod,
                    payment_token: paymentToken,
                    status: paymentMethod === 'card' ? 'completed' : 'pending',
                    payment_reference: this.generatePaymentReference(),
                    created_at: new Date().toISOString()
                };

                const { error } = await supabase
                    .from('payments')
                    .insert([paymentRecord]);

                if (error) {
                    console.warn('⚠️ Erreur enregistrement paiement:', error);
                } else {
                    console.log('✅ Paiement enregistré dans Supabase');
                }
            }

            // Nettoyer le sessionStorage
            sessionStorage.removeItem('pendingBooking');

            // Rediriger vers la page de confirmation
            const bookingId = this.bookingData.calcomData?.uid || 
                            this.bookingData.calcomData?.id || 
                            this.bookingData.calcomId || 
                            'pending';
            window.location.href = `confirmation.html?booking=${bookingId}`;

        } catch (error) {
            console.error('❌ Erreur finalisation:', error);
            alert('Une erreur est survenue lors de la finalisation de votre réservation. Veuillez contacter le support.');
        }
    }

    generateIdempotencyKey() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Initialisation
window.paymentManager = new PaymentManager();

document.addEventListener('DOMContentLoaded', async () => {
    await window.paymentManager.init();
});