// payment-ui.js - Version corrigée
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initialisation page paiement...');
    
    // Variables globales
    let currentBooking = null;
    let currentCurrency = 'EUR';
    
    // Récupérer la réservation depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const bookingParam = urlParams.get('booking');
    
    if (bookingParam) {
        try {
            currentBooking = JSON.parse(decodeURIComponent(bookingParam));
            console.log('📋 Réservation récupérée depuis URL:', currentBooking);
            currentCurrency = currentBooking.currency || 'EUR';
        } catch (error) {
            console.error('❌ Erreur parsing booking:', error);
            showPaymentError('Réservation invalide. Veuillez réessayer.');
            return;
        }
    } else {
        const storedBooking = localStorage.getItem('pendingBooking');
        if (storedBooking) {
            try {
                currentBooking = JSON.parse(storedBooking);
                console.log('📋 Réservation récupérée depuis localStorage:', currentBooking);
                currentCurrency = currentBooking.currency || 'EUR';
            } catch (error) {
                console.error('❌ Erreur parsing stored booking:', error);
            }
        }
    }
    
    if (!currentBooking) {
        showPaymentError('Aucune réservation trouvée. Veuillez retourner à la page de réservation.');
        setTimeout(() => {
            window.location.href = 'booking.html';
        }, 3000);
        return;
    }
    
    // Initialiser le menu mobile
    function initMobileMenu() {
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const closeMenuBtn = document.getElementById('closeMenuBtn');
        const mobileMenu = document.getElementById('mobileMenu');
        
        if (hamburgerBtn && mobileMenu) {
            hamburgerBtn.addEventListener('click', () => {
                mobileMenu.classList.add('active');
            });
        }
        
        if (closeMenuBtn && mobileMenu) {
            closeMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.remove('active');
            });
        }
        
        if (mobileMenu) {
            mobileMenu.addEventListener('click', (e) => {
                if (e.target === mobileMenu) {
                    mobileMenu.classList.remove('active');
                }
            });
        }
    }
    
    // Initialiser les sélecteurs de devise
    function initCurrencySelectors() {
        // Initialiser les sélecteurs quand CurrencyManager est prêt
        const initSelectors = () => {
            if (!window.currencyManager) {
                console.warn('CurrencyManager non disponible');
                return;
            }
            
            const currencyManager = window.currencyManager;
            currentCurrency = currencyManager.currentCurrency;
            
            // Initialiser le sélecteur desktop
            const desktopSelector = document.getElementById('currencySelector');
            if (desktopSelector) {
                desktopSelector.innerHTML = '';
                
                currencyManager.supportedCurrencies.forEach(currency => {
                    const option = document.createElement('option');
                    option.value = currency;
                    const symbol = currencyManager.currencySymbols[currency] || currency;
                    option.textContent = `${symbol} ${currency}`;
                    
                    if (currency === currentCurrency) {
                        option.selected = true;
                    }
                    
                    desktopSelector.appendChild(option);
                });
                
                desktopSelector.addEventListener('change', (e) => {
                    const newCurrency = e.target.value;
                    console.log(`💱 Changement devise: ${currentCurrency} → ${newCurrency}`);
                    
                    if (currencyManager.setCurrency(newCurrency)) {
                        currentCurrency = newCurrency;
                        updatePaymentDisplay();
                    }
                });
            }
            
            // Initialiser le sélecteur mobile
            const mobileSelector = document.getElementById('currencySelectorMobile');
            if (mobileSelector) {
                mobileSelector.innerHTML = '';
                
                currencyManager.supportedCurrencies.forEach(currency => {
                    const option = document.createElement('option');
                    option.value = currency;
                    const symbol = currencyManager.currencySymbols[currency] || currency;
                    option.textContent = `${symbol} ${currency}`;
                    
                    if (currency === currentCurrency) {
                        option.selected = true;
                    }
                    
                    mobileSelector.appendChild(option);
                });
                
                mobileSelector.addEventListener('change', (e) => {
                    const newCurrency = e.target.value;
                    console.log(`💱 Changement devise mobile: ${currentCurrency} → ${newCurrency}`);
                    
                    if (currencyManager.setCurrency(newCurrency)) {
                        currentCurrency = newCurrency;
                        updatePaymentDisplay();
                        
                        // Fermer le menu mobile
                        const mobileMenu = document.getElementById('mobileMenu');
                        if (mobileMenu) {
                            mobileMenu.classList.remove('active');
                        }
                    }
                });
            }
            
            // Mettre à jour l'affichage des paiements
            updatePaymentDisplay();
        };
        
        // Attendre que CurrencyManager soit prêt
        if (window.currencyManager && window.currencyManager.exchangeRates) {
            initSelectors();
        } else {
            // Écouter l'événement de prêt
            window.addEventListener('currency:ready', initSelectors);
            window.addEventListener('currency:changed', initSelectors);
            
            // Fallback: vérifier périodiquement
            setTimeout(() => {
                if (window.currencyManager) {
                    initSelectors();
                }
            }, 1000);
        }
    }
    
    // Mettre à jour l'interface utilisateur
    function updateUserInterface() {
        const user = window.authManager?.getCurrentUser();
        const isLoggedIn = !!user;
        
        const userAvatar = document.getElementById('userAvatar');
        const loginBtn = document.getElementById('loginBtn');
        const avatarInitials = document.getElementById('avatarInitials');
        
        if (isLoggedIn && user) {
            if (userAvatar) userAvatar.style.display = 'block';
            if (loginBtn) loginBtn.style.display = 'none';
            
            if (avatarInitials && user.user_metadata?.full_name) {
                const name = user.user_metadata.full_name;
                avatarInitials.textContent = name.charAt(0).toUpperCase();
            } else if (avatarInitials && user.email) {
                avatarInitials.textContent = user.email.charAt(0).toUpperCase();
            }
            
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    try {
                        await window.authManager.signOut();
                        window.location.href = 'index.html';
                    } catch (error) {
                        console.error('Erreur déconnexion:', error);
                    }
                });
            }
            
            // Ajouter un badge VIP si l'utilisateur est VIP
            if (window.authManager?.isUserVip()) {
                const paymentTitle = document.querySelector('.payment-title');
                if (paymentTitle && !paymentTitle.querySelector('.vip-badge-payment')) {
                    const vipBadge = document.createElement('span');
                    vipBadge.className = 'vip-badge-payment';
                    vipBadge.textContent = 'VIP';
                    vipBadge.style.cssText = `
                        display: inline-block;
                        background: linear-gradient(135deg, #FFD700, #FFA500);
                        color: #000;
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 14px;
                        font-weight: bold;
                        margin-left: 15px;
                        border: 1px solid #FFA500;
                        vertical-align: middle;
                    `;
                    paymentTitle.appendChild(vipBadge);
                }
            }
        } else {
            if (userAvatar) userAvatar.style.display = 'none';
            if (loginBtn) loginBtn.style.display = 'block';
        }
    }
    
    // Mettre à jour l'affichage des paiements
    function updatePaymentDisplay() {
        if (!currentBooking) return;
        
        console.log('🔄 Mise à jour affichage paiement avec devise:', currentCurrency);
        
        updatePaymentDetails(currentBooking);
        updatePaymentSummary(currentBooking);
    }
    
    // Mettre à jour les détails de paiement
    function updatePaymentDetails(booking) {
        // Calculer le montant dans la devise courante
        let amountToDisplay = booking.price;
        let currencyToDisplay = currentCurrency;
        
        // Si la devise a changé, recalculer le prix
        if (window.currencyManager && currentCurrency !== booking.currency) {
            console.log(`💱 Conversion nécessaire: ${booking.currency} → ${currentCurrency}`);
            
            // Déterminer la devise et le montant d'origine
            let originalAmount, originalCurrency;
            
            if (booking.isVip && booking.vipPriceData) {
                // Pour les VIP, le prix d'origine est dans la devise VIP
                originalAmount = booking.vipPriceData.price * (booking.packageQuantity || 1);
                originalCurrency = booking.vipPriceData.currency || 'USD';
                
                // Appliquer la réduction si applicable
                if (booking.discountPercent && booking.discountPercent > 0) {
                    originalAmount = originalAmount * (1 - (booking.discountPercent / 100));
                }
            } else {
                // Pour les non-VIP, le prix d'origine est en EUR
                originalAmount = booking.originalPrice || booking.priceEUR || booking.price;
                originalCurrency = booking.originalCurrency || 'EUR';
            }
            
            // Convertir dans la devise courante
            amountToDisplay = window.currencyManager.convert(
                originalAmount,
                originalCurrency,
                currentCurrency
            );
            
            console.log(`💱 Converti: ${originalAmount} ${originalCurrency} → ${amountToDisplay} ${currentCurrency}`);
        }
        
        const config = window.YOTEACHER_CONFIG || {};
        
        const contactName = config.CONTACT_NAME || "Yoann Bourbia";
        const contactEmail = config.CONTACT_EMAIL || "yoannbourbia@gmail.com";
        const revolutLink = config.REVOLUT_PAYMENT_LINK || "https://revolut.me/yoann";
        const wiseLink = config.WISE_PAYMENT_LINK || "https://wise.com/pay/yoann";
        const paypalEmail = config.PAYPAL_BUSINESS_EMAIL || "yoann.bourbia@gmail.com";
        const interacEmail = config.INTERAC_EMAIL || contactEmail;
        
        // Formater le montant
        let formattedAmount;
        if (window.currencyManager) {
            formattedAmount = window.currencyManager.formatPriceInCurrency(amountToDisplay, currencyToDisplay);
        } else {
            formattedAmount = `${amountToDisplay.toFixed(2)} ${currencyToDisplay}`;
        }
        
        document.querySelectorAll('#revolutAmount, #wiseAmount, #paypalAmount, #interacAmount').forEach(el => {
            if (el) el.textContent = formattedAmount;
        });
        
        // Mettre à jour les noms de bénéficiaire
        const revolutNameElement = document.getElementById('revolutName');
        if (revolutNameElement) revolutNameElement.textContent = contactName;
        
        const wiseNameElement = document.getElementById('wiseName');
        if (wiseNameElement) wiseNameElement.textContent = contactName;
        
        const interacNameElement = document.getElementById('interacName');
        if (interacNameElement) interacNameElement.textContent = contactName;
        
        const paypalEmailElement = document.getElementById('paypalEmail');
        if (paypalEmailElement) paypalEmailElement.textContent = paypalEmail;
        
        const interacEmailElement = document.getElementById('interacEmail');
        if (interacEmailElement) interacEmailElement.textContent = interacEmail;
        
        const revolutDisplay = revolutLink.replace('https://', '');
        const wiseDisplay = wiseLink.replace('https://', '');
        const paypalUsername = 'yoannbourbia';
        const paypalDisplay = `paypal.me/${paypalUsername}`;
        
        const revolutLinkDisplay = document.getElementById('revolutLinkDisplay');
        if (revolutLinkDisplay) revolutLinkDisplay.textContent = revolutDisplay;
        
        const wiseLinkDisplay = document.getElementById('wiseLinkDisplay');
        if (wiseLinkDisplay) wiseLinkDisplay.textContent = wiseDisplay;
        
        const paypalLinkDisplay = document.getElementById('paypalLinkDisplay');
        if (paypalLinkDisplay) paypalLinkDisplay.textContent = paypalDisplay;
        
        // Générer les liens de paiement avec le bon montant
        const revolutAmountInCents = Math.round(amountToDisplay * 100);
        const revolutFullLink = `${revolutLink}?amount=${revolutAmountInCents}&currency=${currencyToDisplay}`;
        const wiseFullLink = `${wiseLink}?amount=${amountToDisplay}&currency=${currencyToDisplay}`;
        const paypalFullLink = `https://www.paypal.com/paypalme/${paypalUsername}/${amountToDisplay}${currencyToDisplay}`;
        
        // Mettre à jour les données des liens
        const revolutQrCode = document.getElementById('revolutQrCode');
        const revolutLinkItem = document.getElementById('revolutLinkItem');
        const wiseQrCode = document.getElementById('wiseQrCode');
        const wiseLinkItem = document.getElementById('wiseLinkItem');
        const paypalQrCode = document.getElementById('paypalQrCode');
        const paypalLinkItem = document.getElementById('paypalLinkItem');
        
        if (revolutQrCode) revolutQrCode.dataset.link = revolutFullLink;
        if (revolutLinkItem) revolutLinkItem.dataset.link = revolutFullLink;
        if (wiseQrCode) wiseQrCode.dataset.link = wiseFullLink;
        if (wiseLinkItem) wiseLinkItem.dataset.link = wiseFullLink;
        if (paypalQrCode) paypalQrCode.dataset.link = paypalFullLink;
        if (paypalLinkItem) paypalLinkItem.dataset.link = paypalFullLink;
    }
    
    // Mettre à jour le récapitulatif
    function updatePaymentSummary(booking) {
        const summaryContainer = document.getElementById('paymentSummary');
        if (!summaryContainer) return;
        
        // Calculer le montant dans la devise courante
        let amountToDisplay = booking.price;
        
        if (window.currencyManager && currentCurrency !== booking.currency) {
            // Déterminer la devise et le montant d'origine
            let originalAmount, originalCurrency;
            
            if (booking.isVip && booking.vipPriceData) {
                // Pour les VIP, le prix d'origine est dans la devise VIP
                originalAmount = booking.vipPriceData.price * (booking.packageQuantity || 1);
                originalCurrency = booking.vipPriceData.currency || 'USD';
                
                // Appliquer la réduction si applicable
                if (booking.discountPercent && booking.discountPercent > 0) {
                    originalAmount = originalAmount * (1 - (booking.discountPercent / 100));
                }
            } else {
                // Pour les non-VIP, le prix d'origine est en EUR
                originalAmount = booking.originalPrice || booking.priceEUR || booking.price;
                originalCurrency = booking.originalCurrency || 'EUR';
            }
            
            // Convertir dans la devise courante
            amountToDisplay = window.currencyManager.convert(
                originalAmount,
                originalCurrency,
                currentCurrency
            );
        }
        
        const formattedPrice = window.currencyManager ? 
            window.currencyManager.formatPriceInCurrency(amountToDisplay, currentCurrency) : 
            `${amountToDisplay.toFixed(2)} ${currentCurrency}`;
        
        const startDate = new Date(booking.startTime);
        const formattedDate = startDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const formattedTime = startDate.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let courseName = '';
        switch(booking.courseType) {
            case 'essai':
                courseName = window.translationManager?.getTranslation('courses.trial') || 'Cours d\'essai';
                break;
            case 'conversation':
                courseName = window.translationManager?.getTranslation('courses.conversation') || 'Conversation';
                break;
            case 'curriculum':
                courseName = window.translationManager?.getTranslation('courses.curriculum') || 'Curriculum complet';
                break;
            case 'examen':
                courseName = window.translationManager?.getTranslation('courses.exam') || 'Préparation d\'examen';
                break;
            default:
                courseName = booking.courseType;
        }
        
        let platform = 'Zoom';
        if (booking.location && booking.location.includes('google')) {
            platform = 'Google Meet';
        } else if (booking.location && booking.location.includes('teams')) {
            platform = 'Microsoft Teams';
        }
        
        const courseLabel = window.translationManager?.getTranslation('payment.course_type') || 'Type de cours:';
        const dateLabel = window.translationManager?.getTranslation('payment.date') || 'Date:';
        const timeLabel = window.translationManager?.getTranslation('payment.time') || 'Heure:';
        const durationLabel = window.translationManager?.getTranslation('payment.duration') || 'Durée:';
        const platformLabel = window.translationManager?.getTranslation('payment.platform') || 'Plateforme:';
        const totalLabel = window.translationManager?.getTranslation('payment.total') || 'Total à payer:';
        
        // Ajouter des informations VIP si applicable
        let vipInfo = '';
        if (booking.isVip) {
            vipInfo = `
                <div class="summary-item" style="background: #fff8e1; border-radius: 8px; padding: 10px; margin-bottom: 10px;">
                    <span class="label" style="color: #ff8f00;"><i class="fas fa-crown"></i> Statut:</span>
                    <span class="value" style="color: #ff8f00; font-weight: 600;">Prix VIP appliqué</span>
                </div>
            `;
        }
        
        // Ajouter des informations sur le forfait si applicable
        let packageInfo = '';
        if (booking.isPackage && booking.packageQuantity > 1) {
            const discount = booking.discountPercent || 0;
            packageInfo = `
                <div class="summary-item">
                    <span class="label">Forfait:</span>
                    <span class="value">${booking.packageQuantity} cours</span>
                </div>
                ${discount > 0 ? `
                <div class="summary-item" style="background: #e8f5e9; border-radius: 8px; padding: 10px; margin: 5px 0;">
                    <span class="label" style="color: #2e7d32;">Réduction:</span>
                    <span class="value" style="color: #2e7d32; font-weight: 600;">${discount}%</span>
                </div>
                ` : ''}
            `;
        }
        
        summaryContainer.innerHTML = `
            <div class="booking-summary-card">
                <h3 style="margin-bottom: 20px; color: #333;" data-i18n="payment.booking_details">Détails de votre réservation</h3>
                <div class="summary-details">
                    ${vipInfo}
                    <div class="summary-item">
                        <span class="label">${courseLabel}</span>
                        <span class="value">${courseName}</span>
                    </div>
                    ${packageInfo}
                    <div class="summary-item">
                        <span class="label">${dateLabel}</span>
                        <span class="value">${formattedDate}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">${timeLabel}</span>
                        <span class="value">${formattedTime}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">${durationLabel}</span>
                        <span class="value">${booking.duration || '15'} min</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">${platformLabel}</span>
                        <span class="value">${platform}</span>
                    </div>
                    <div class="summary-item total">
                        <span class="label">${totalLabel}</span>
                        <span class="value">${formattedPrice}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Gestion des boutons de méthode de paiement
    function setupPaymentMethodButtons() {
        document.querySelectorAll('.payment-method-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const method = this.getAttribute('data-method');
                
                togglePaymentMethod(method);
                
                // Gestion spéciale pour Interac
                if (method === 'interac' && window.currencyManager) {
                    const interacNotice = document.getElementById('interacCurrencyNotice');
                    
                    console.log(`💱 Sélection Interac détectée. Devise actuelle: ${currentCurrency}`);
                    
                    if (currentCurrency !== 'CAD') {
                        if (interacNotice) {
                            interacNotice.style.display = 'block';
                        }
                        
                        try {
                            console.log('💱 Forçage de la devise CAD pour Interac...');
                            
                            // Sauvegarder la devise précédente
                            const previousCurrency = currentCurrency;
                            localStorage.setItem('previousCurrency', previousCurrency);
                            
                            // Changer la devise en CAD
                            if (window.currencyManager.setCurrency('CAD')) {
                                currentCurrency = 'CAD';
                                console.log('✅ Devise changée en CAD avec succès');
                                
                                // Mettre à jour l'affichage
                                updatePaymentDisplay();
                            } else {
                                console.error('❌ Échec du changement de devise en CAD');
                            }
                        } catch (error) {
                            console.error('❌ Erreur lors du forçage CAD:', error);
                        }
                    } else {
                        if (interacNotice) {
                            interacNotice.style.display = 'none';
                        }
                        console.log('✅ Déjà en CAD, pas de changement nécessaire');
                    }
                } else {
                    const interacNotice = document.getElementById('interacCurrencyNotice');
                    if (interacNotice) {
                        interacNotice.style.display = 'none';
                    }
                    
                    // Restaurer la devise précédente si on quitte Interac
                    if (method !== 'interac') {
                        const previousCurrency = localStorage.getItem('previousCurrency');
                        if (previousCurrency && previousCurrency !== currentCurrency && window.currencyManager) {
                            console.log(`💱 Restauration devise précédente: ${previousCurrency}`);
                            if (window.currencyManager.setCurrency(previousCurrency)) {
                                currentCurrency = previousCurrency;
                                updatePaymentDisplay();
                                localStorage.removeItem('previousCurrency');
                            }
                        }
                    }
                }
            });
        });
    }
    
    // Gestion des clics sur les QR codes et liens cliquables
    function setupClickableElements() {
        document.querySelectorAll('.qr-code-img').forEach(img => {
            img.addEventListener('click', function() {
                const link = this.dataset.link;
                if (link) {
                    window.open(link, '_blank', 'noopener,noreferrer');
                } else {
                    const method = this.id.replace('QrCode', '').toLowerCase();
                    if (method === 'revolut') {
                        window.open('https://revolut.me/yoann', '_blank', 'noopener,noreferrer');
                    } else if (method === 'wise') {
                        window.open('https://wise.com/pay/yoann', '_blank', 'noopener,noreferrer');
                    } else if (method === 'paypal') {
                        window.open('https://paypal.me/yoannbourbia', '_blank', 'noopener,noreferrer');
                    }
                }
            });
            
            img.addEventListener('error', function() {
                console.warn(`⚠️ Image QR code non trouvée: ${this.src}`);
                this.style.display = 'none';
                const placeholder = document.createElement('div');
                placeholder.className = 'qr-code-placeholder';
                placeholder.innerHTML = `
                    <i class="fas fa-qrcode" style="font-size: 60px; color: #666;"></i>
                    <p style="font-size: 0.8rem; margin-top: 5px; color: #666;" data-i18n="payment.qr_code">QR Code</p>
                `;
                placeholder.dataset.link = this.dataset.link;
                placeholder.style.cursor = 'pointer';
                placeholder.style.textAlign = 'center';
                placeholder.addEventListener('click', function() {
                    const link = this.dataset.link;
                    if (link) window.open(link, '_blank', 'noopener,noreferrer');
                });
                this.parentNode.appendChild(placeholder);
            });
        });
        
        document.querySelectorAll('.info-item.clickable').forEach(item => {
            item.addEventListener('click', function() {
                const link = this.dataset.link;
                if (link) {
                    window.open(link, '_blank', 'noopener,noreferrer');
                }
            });
        });
    }
    
    // Basculer entre les méthodes de paiement
    function togglePaymentMethod(method) {
        document.querySelectorAll('.payment-method-details').forEach(details => {
            details.style.display = 'none';
        });
        
        document.querySelectorAll('.payment-method-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const detailsId = method + 'Details';
        const detailsElement = document.getElementById(detailsId);
        const buttonElement = document.querySelector(`[data-method="${method}"]`);
        
        if (detailsElement && buttonElement) {
            const isAlreadyOpen = detailsElement.style.display === 'block';
            
            if (!isAlreadyOpen) {
                detailsElement.style.display = 'block';
                buttonElement.classList.add('active');
                
                if (method === 'card' && window.paymentManager && typeof window.paymentManager.setupStripeForm === 'function') {
                    setTimeout(() => {
                        window.paymentManager.setupStripeForm();
                    }, 100);
                }
                
                if (window.innerWidth <= 768) {
                    setTimeout(() => {
                        detailsElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                }
            } else {
                detailsElement.style.display = 'none';
                buttonElement.classList.remove('active');
            }
        }
    }
    
    // Gestion des boutons de confirmation de paiement
    function setupPaymentConfirmationButtons() {
        document.querySelectorAll('.btn-confirm-payment').forEach(button => {
            button.addEventListener('click', async function() {
                if (this.disabled) return;
                
                const method = this.getAttribute('data-method');
                console.log('💳 Confirmation paiement:', method);
                
                // Validation pour Interac
                if (method === 'interac' && window.currencyManager && !window.currencyManager.isInteracCurrency()) {
                    showPaymentError('Les paiements Interac doivent être effectués en dollars canadiens (CAD). Veuillez sélectionner CAD comme devise.');
                    return;
                }
                
                const originalText = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (window.translationManager?.getTranslation('payment.processing') || 'Traitement en cours...');
                this.disabled = true;
                
                hidePaymentError();
                
                try {
                    // Vérifier que le gestionnaire de paiement existe
                    if (!window.paymentManager) {
                        throw new Error('Système de paiement non disponible');
                    }
                    
                    // Définir la réservation actuelle
                    window.paymentManager.currentBooking = currentBooking;
                    
                    // Traiter le paiement
                    await window.paymentManager.handlePaymentMethod(method);
                    
                } catch (error) {
                    console.error('❌ Erreur paiement:', error);
                    
                    let errorMessage = error.message;
                    
                    // Messages d'erreur plus conviviaux
                    if (error.message.includes('authentification') || error.message.includes('session')) {
                        errorMessage = 'Votre session a expiré. Veuillez vous reconnecter et réessayer.';
                    } else if (error.message.includes('Erreur serveur')) {
                        errorMessage = 'Le service de paiement est temporairement indisponible. Veuillez réessayer dans quelques instants.';
                    } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                        errorMessage = 'Erreur de connexion. Veuillez vérifier votre connexion internet et réessayer.';
                    }
                    
                    showPaymentError('Erreur lors du traitement : ' + errorMessage);
                    
                    this.innerHTML = originalText;
                    this.disabled = false;
                }
            });
        });
    }
    
    // Afficher une erreur de paiement
    function showPaymentError(message) {
        const errorDiv = document.getElementById('paymentError');
        const errorText = document.getElementById('errorText');
        
        if (errorDiv && errorText) {
            errorText.textContent = message;
            errorDiv.style.display = 'block';
            
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Fallback
            const fallbackDiv = document.createElement('div');
            fallbackDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #dc3545;
                color: white;
                padding: 15px 25px;
                border-radius: 10px;
                z-index: 9999;
                max-width: 400px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            `;
            fallbackDiv.innerHTML = `
                <strong>⚠️ Erreur</strong><br>
                ${message}
            `;
            document.body.appendChild(fallbackDiv);
            
            setTimeout(() => fallbackDiv.remove(), 8000);
        }
    }
    
    // Cacher l'erreur de paiement
    function hidePaymentError() {
        const errorDiv = document.getElementById('paymentError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }
    
    // Fermer les menus en cliquant en dehors
    function setupOutsideClickHandlers() {
        document.addEventListener('click', function(event) {
            if (!event.target.closest('.payment-method-btn') && !event.target.closest('.payment-method-details')) {
                document.querySelectorAll('.payment-method-details').forEach(details => {
                    details.style.display = 'none';
                });
                
                document.querySelectorAll('.payment-method-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
            }
        });
    }
    
    // Initialiser toutes les fonctionnalités
    function initializeAll() {
        console.log('🔧 Initialisation des fonctionnalités...');
        
        initMobileMenu();
        initCurrencySelectors();
        updateUserInterface();
        setupPaymentMethodButtons();
        setupClickableElements();
        setupPaymentConfirmationButtons();
        setupOutsideClickHandlers();
        
        // Écouter les événements d'authentification
        window.addEventListener('auth:login', updateUserInterface);
        window.addEventListener('auth:logout', updateUserInterface);
        
        // Écouter les changements de devise
        window.addEventListener('currency:changed', function(e) {
            console.log('💱 Événement currency:changed reçu', e.detail);
            currentCurrency = window.currencyManager.currentCurrency;
            updatePaymentDisplay();
        });
        
        // Écouter les événements VIP
        window.addEventListener('vip:loaded', function() {
            console.log('🎁 Événement VIP chargé dans payment.html');
            updateUserInterface();
        });
        
        console.log('✅ Page paiement complètement initialisée');
    }
    
    // Démarrer l'initialisation
    initializeAll();
});