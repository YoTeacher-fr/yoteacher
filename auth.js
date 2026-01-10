// Gestion de l'authentification avec gestion des paiements ET invitations VIP
class AuthManager {
    constructor() {
        this.user = null;
        this.supabaseReady = false;
        this.pendingPayment = null;
        this.vipPrices = null;
        this.userCurrency = null;
        console.log('🔐 AuthManager initialisé');
        this.init();
    }

    async init() {
        try {
            console.log('🔐 Initialisation de l\'authentification...');
            // Attendre que Supabase soit prêt
            await this.waitForSupabase();
            
            if (!this.supabaseReady) {
                console.warn('Mode dégradé activé : Supabase non disponible');
                this.setupDegradedMode();
                return;
            }

            // Vérifier la session existante
            try {
                const { data: { session } } = await supabase.auth.getSession();
                console.log('🔐 Session existante:', session ? 'Oui' : 'Non');
                if (session) {
                    this.user = session.user;
                    this.saveUserToStorage();
                    this.updateUI();
                    // Événement : utilisateur déjà connecté
                    this.emitAuthEvent('login', this.user);
                    
                    // Charger les prix VIP si l'utilisateur est VIP
                    await this.loadVipPrices(session.user.id);
                }

                // Écouter les changements d'authentification
                supabase.auth.onAuthStateChange((event, session) => {
                    console.log('Auth state changed:', event, session);
                    if (session) {
                        this.user = session.user;
                        this.saveUserToStorage();
                        this.updateUI();
                        // Événement : connexion
                        this.emitAuthEvent('login', this.user);
                        
                        // Charger les prix VIP si l'utilisateur est VIP
                        setTimeout(() => {
                            this.loadVipPrices(session.user.id);
                        }, 500);
                    } else {
                        this.user = null;
                        this.vipPrices = null;
                        this.removeUserFromStorage();
                        this.updateUI();
                        // Événement : déconnexion
                        this.emitAuthEvent('logout');
                    }
                });
            } catch (error) {
                console.warn('Erreur lors de la vérification de session:', error);
                this.setupDegradedMode();
            }
            
            // Gérer le code d'invitation si présent dans l'URL
            this.handleInvitationCode();
            
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de l\'auth:', error);
            this.setupDegradedMode();
        }
    }

    // ===== GESTION DES INVITATIONS VIP =====
    handleInvitationCode() {
        // Vérifier le code dans l'URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
            // Sauvegarder le code pour plus tard
            localStorage.setItem('invitation_code', code);
            console.log(`🎁 Code d'invitation détecté: ${code}`);
            
            // Afficher une notification
            this.showInvitationNotification(code);
        }
    }

    async applyInvitationCode(userId) {
        const code = localStorage.getItem('invitation_code');
        if (!code || !userId) return false;
        
        try {
            console.log(`🔗 Application du code ${code} pour l'utilisateur ${userId}`);
            
            // Vérifier si le code existe et n'est pas utilisé
            const { data: existing, error: checkError } = await supabase
                .from('vip_pricing')
                .select('user_id')
                .eq('invitation_code', code)
                .maybeSingle();
            
            if (checkError) throw checkError;
            
            // Si le code est déjà utilisé par quelqu'un d'autre
            if (existing && existing.user_id && existing.user_id !== userId) {
                console.warn('⚠️ Code déjà utilisé par un autre utilisateur');
                localStorage.removeItem('invitation_code');
                return false;
            }
            
            // Mettre à jour le user_id pour toutes les entrées avec ce code
            const { error: updateError } = await supabase
                .from('vip_pricing')
                .update({ user_id: userId })
                .eq('invitation_code', code)
                .is('user_id', null);
            
            if (updateError) throw updateError;
            
            // Marquer l'utilisateur comme VIP dans profiles
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ is_vip: true })
                .eq('id', userId);
            
            if (profileError) throw profileError;
            
            console.log('✅ Code d\'invitation appliqué avec succès');
            localStorage.removeItem('invitation_code');
            
            // Charger les prix VIP
            await this.loadVipPrices(userId);
            
            return true;
            
        } catch (error) {
            console.error('❌ Erreur application code:', error);
            return false;
        }
    }

    async loadVipPrices(userId) {
        if (!userId || !this.supabaseReady) {
            console.log('❌ Impossible de charger les prix VIP : userId ou supabaseReady manquant', { 
                userId, 
                supabaseReady: this.supabaseReady 
            });
            return;
        }
        
        try {
            console.log(`🔍 Chargement des prix VIP pour l'utilisateur ${userId}...`);
            
            const { data, error } = await supabase
                .from('vip_pricing')
                .select('*')
                .eq('user_id', userId);
            
            if (error) {
                console.error('❌ Erreur Supabase lors du chargement des prix VIP:', error);
                throw error;
            }
            
            console.log(`✅ Données VIP récupérées:`, data);
            
            if (data && data.length > 0) {
                // Organiser les prix par type de cours
                this.vipPrices = {};
                let userCurrency = null;
                
                data.forEach(item => {
                    if (!this.vipPrices[item.course_type]) {
                        this.vipPrices[item.course_type] = {};
                    }
                    this.vipPrices[item.course_type][item.duration_minutes] = {
                        price: item.price,
                        currency: item.currency
                    };
                    
                    // Garder la devise de l'utilisateur
                    if (!userCurrency && item.currency) {
                        userCurrency = item.currency;
                    }
                });
                
                // Stocker dans l'objet user pour accès global
                if (this.user) {
                    this.user.vipPrices = this.vipPrices;
                }
                
                this.userCurrency = userCurrency;
                
                // Mettre à jour la devise du site
                if (userCurrency && window.currencyManager) {
                    window.currencyManager.setCurrency(userCurrency, true);
                }
                
                console.log('💰 Prix VIP chargés pour l\'utilisateur:', this.vipPrices);
                
                // Mettre à jour les prix sur la page
                this.updateVipPricesOnPage();
                
                // Émettre un événement pour informer les autres composants
                window.dispatchEvent(new CustomEvent('vip:loaded', {
                    detail: { vipPrices: this.vipPrices, currency: userCurrency }
                }));
                
                // Forcer la mise à jour de l'interface sur la page de réservation
                if (window.location.pathname.includes('booking.html')) {
                    setTimeout(() => {
                        window.dispatchEvent(new Event('vip:loaded'));
                    }, 500);
                }
            } else {
                console.log('ℹ️ Aucun prix VIP trouvé pour cet utilisateur.');
                this.vipPrices = null;
                this.userCurrency = null;
            }
        } catch (error) {
            console.error('❌ Erreur chargement prix VIP:', error);
        }
    }

    getVipPrice(courseType, duration = 60) {
        console.log(`🔍 Recherche prix VIP pour ${courseType} (${duration}min)...`, this.vipPrices);
        
        if (!this.vipPrices || !this.vipPrices[courseType]) {
            console.log(`❌ Aucun prix VIP pour le type de cours ${courseType}`);
            return null;
        }
        
        // Chercher la durée exacte
        if (this.vipPrices[courseType][duration]) {
            const price = this.vipPrices[courseType][duration];
            console.log(`✅ Prix VIP trouvé (durée exacte):`, price);
            return price;
        }
        
        // Sinon, chercher la première durée disponible
        const availableDurations = Object.keys(this.vipPrices[courseType]);
        if (availableDurations.length > 0) {
            const price = this.vipPrices[courseType][availableDurations[0]];
            console.log(`✅ Prix VIP trouvé (première durée disponible):`, price);
            return price;
        }
        
        console.log(`❌ Aucun prix VIP disponible pour ${courseType}`);
        return null;
    }

    isUserVip() {
        const isVip = !!this.vipPrices && Object.keys(this.vipPrices).length > 0;
        console.log(`👑 Vérification statut VIP: ${isVip}`, this.vipPrices);
        return isVip;
    }

    updateVipPricesOnPage() {
        if (!this.isUserVip()) {
            console.log('👑 Utilisateur non VIP, pas de mise à jour des prix');
            return;
        }
        
        console.log('👑 Mise à jour des prix VIP sur la page');
        // Selon la page actuelle, mettre à jour les prix
        const path = window.location.pathname;
        
        if (path.includes('index.html') || path === '/' || path === '') {
            this.updateIndexPageVipPrices();
        }
        
        if (path.includes('booking.html')) {
            // Émettre un événement pour informer booking.js
            setTimeout(() => {
                window.dispatchEvent(new Event('vip:loaded'));
            }, 100);
        }
    }

    updateIndexPageVipPrices() {
        console.log('🏠 Mise à jour des prix VIP sur index.html');
        
        // Mettre à jour le prix du cours d'essai (toujours 5€)
        const essaiBtn = document.getElementById('essaiPriceBtn');
        if (essaiBtn && window.currencyManager) {
            const priceSpan = essaiBtn.querySelector('.price-essai');
            if (priceSpan) {
                priceSpan.textContent = window.currencyManager.formatPrice(5);
            }
        }
        
        // Mettre à jour les cartes de cours
        document.querySelectorAll('.course-card').forEach(card => {
            const courseId = card.dataset.courseId;
            if (!courseId) return;
            
            let courseType = '';
            switch(courseId) {
                case '1': courseType = 'conversation'; break;
                case '2': courseType = 'curriculum'; break;
                case '3': courseType = 'examen'; break;
            }
            
            const priceInfo = this.getVipPrice(courseType, 60);
            if (!priceInfo) return;
            
            // Ajouter une classe VIP à la carte
            card.classList.add('vip-highlight');
            
            // Mettre à jour le prix principal
            const priceMain = card.querySelector('.price-main');
            if (priceMain && window.currencyManager) {
                const displayPrice = window.currencyManager.convertAndFormat(
                    priceInfo.price,
                    priceInfo.currency,
                    window.currencyManager.currentCurrency
                );
                
                const perHourSpan = priceMain.querySelector('.price-per-hour');
                if (perHourSpan) {
                    priceMain.innerHTML = `${displayPrice}<span class="price-per-hour">/h</span>`;
                    priceMain.classList.add('vip-price');
                }
            }
            
            // Mettre à jour les prix détaillés
            card.querySelectorAll('.price-detail-item').forEach(item => {
                let duration = 60;
                let priceElement = null;
                
                if (item.querySelector('.price-30')) {
                    duration = 30;
                    priceElement = item.querySelector('.price-30');
                } else if (item.querySelector('.price-45')) {
                    duration = 45;
                    priceElement = item.querySelector('.price-45');
                } else if (item.querySelector('.price-forfait')) {
                    duration = 60;
                    priceElement = item.querySelector('.price-forfait');
                }
                
                if (priceElement) {
                    const detailPrice = this.getVipPrice(courseType, duration);
                    if (detailPrice) {
                        let price = detailPrice.price;
                        
                        // Pour le forfait : prix * 10 * 0.95
                        if (item.querySelector('.price-forfait')) {
                            price = price * 10 * 0.95;
                        }
                        
                        const displayPrice = window.currencyManager.convertAndFormat(
                            price,
                            detailPrice.currency,
                            window.currencyManager.currentCurrency
                        );
                        priceElement.textContent = displayPrice;
                        priceElement.classList.add('vip-price');
                    }
                }
            });
            
            // Ajouter un badge VIP à la carte
            const cardHeader = card.querySelector('.course-header');
            if (cardHeader && !cardHeader.querySelector('.vip-badge')) {
                const vipBadge = document.createElement('span');
                vipBadge.className = 'vip-badge';
                vipBadge.textContent = 'VIP';
                vipBadge.style.cssText = `
                    display: inline-block;
                    background: linear-gradient(135deg, #FFD700, #FFA500);
                    color: #000;
                    padding: 3px 10px;
                    border-radius: 15px;
                    font-size: 12px;
                    font-weight: bold;
                    margin-left: 10px;
                    border: 1px solid #FFA500;
                `;
                cardHeader.appendChild(vipBadge);
            }
        });
        
        console.log('✅ Prix VIP mis à jour sur index.html');
    }

    showInvitationNotification(code) {
        // Créer une notification discrète
        const notification = document.createElement('div');
        notification.id = 'invitation-notification';
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 9999;
            font-size: 14px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            animation: slideInRight 0.5s ease;
            max-width: 300px;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-gift" style="font-size: 18px;"></i>
                <div>
                    <strong>Invitation VIP détectée!</strong><br>
                    <small>Créez un compte pour activer vos tarifs spéciaux.</small>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Ajouter le CSS pour l'animation
        if (!document.querySelector('#invitation-styles')) {
            const style = document.createElement('style');
            style.id = 'invitation-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Supprimer après 8 secondes
        setTimeout(() => {
            notification.style.transition = 'all 0.5s ease';
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 500);
        }, 8000);
    }

    // Méthode pour émettre des événements d'authentification
    emitAuthEvent(eventName, user = null) {
        try {
            console.log(`Événement auth:${eventName} émis`, user ? `pour ${user.email}` : '');
            const event = new CustomEvent(`auth:${eventName}`, { 
                detail: { user: user } 
            });
            window.dispatchEvent(event);
        } catch (error) {
            console.warn('Erreur lors de l\'émission d\'événement:', error);
        }
    }

    async waitForSupabase() {
        return new Promise((resolve) => {
            if (window.supabase && window.supabase.auth) {
                this.supabaseReady = true;
                resolve();
                return;
            }

            if (window.supabaseInitialized) {
                window.supabaseInitialized.then((initialized) => {
                    this.supabaseReady = initialized && window.supabase && window.supabase.auth;
                    resolve();
                }).catch(() => {
                    this.supabaseReady = false;
                    resolve();
                });
                return;
            }

            let attempts = 0;
            const maxAttempts = 100;
            
            const checkSupabase = () => {
                attempts++;
                
                if (window.supabase && window.supabase.auth) {
                    this.supabaseReady = true;
                    resolve();
                    return;
                }
                
                if (attempts >= maxAttempts) {
                    console.warn('Supabase non initialisé après 10 secondes - mode dégradé');
                    this.supabaseReady = false;
                    resolve();
                    return;
                }
                
                setTimeout(checkSupabase, 100);
            };
            
            checkSupabase();
        });
    }

    setupDegradedMode() {
        const storedUser = localStorage.getItem('yoteacher_user');
        if (storedUser) {
            try {
                this.user = JSON.parse(storedUser);
                console.log('Mode dégradé : utilisateur restauré depuis le stockage local');
            } catch (error) {
                console.warn('Erreur lors de la lecture du stockage local:', error);
                this.user = null;
            }
        }
        
        this.updateUI();
        this.showDegradedModeWarning();
    }

    showDegradedModeWarning() {
        if (document.getElementById('degraded-mode-warning')) return;
        
        const warning = document.createElement('div');
        warning.id = 'degraded-mode-warning';
        warning.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff9800;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            z-index: 9999;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            max-width: 90%;
            animation: slideUp 0.3s ease;
        `;
        
        warning.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>Mode hors ligne - certaines fonctionnalités sont limitées</span>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;cursor:pointer;margin-left:10px;">×</button>
        `;
        
        if (!document.getElementById('degraded-mode-styles')) {
            const style = document.createElement('style');
            style.id = 'degraded-mode-styles';
            style.textContent = `
                @keyframes slideUp {
                    from { transform: translateX(-50%) translateY(100%); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(warning);
        
        setTimeout(() => {
            if (warning.parentElement) {
                warning.style.transition = 'all 0.3s ease';
                warning.style.opacity = '0';
                warning.style.transform = 'translateX(-50%) translateY(100%)';
                setTimeout(() => warning.remove(), 300);
            }
        }, 10000);
    }

    saveUserToStorage() {
        if (!this.user) {
            localStorage.removeItem('yoteacher_user');
            return;
        }
        
        const userData = {
            id: this.user.id,
            email: this.user.email,
            user_metadata: this.user.user_metadata,
            created_at: this.user.created_at
        };
        
        localStorage.setItem('yoteacher_user', JSON.stringify(userData));
    }

    removeUserFromStorage() {
        localStorage.removeItem('yoteacher_user');
    }

    async signUp(email, password, fullName) {
        try {
            if (!this.supabaseReady) {
                return this.mockSignUp(email, password, fullName);
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        created_at: new Date().toISOString()
                    },
                    emailRedirectTo: `${window.location.origin}/login.html?message=confirmed`
                }
            });

            if (error) {
                console.error('Supabase signUp error details:', {
                    message: error.message,
                    status: error.status,
                    name: error.name
                });
                throw error;
            }

            if (data.user) {
                try {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert([
                            {
                                id: data.user.id,
                                email: email,
                                full_name: fullName,
                                is_vip: false,
                                credits: 0,
                                created_at: new Date().toISOString()
                            }
                        ]);

                    if (profileError) {
                        console.warn('Erreur création profil:', profileError);
                    }
                    
                    // Appliquer le code d'invitation si présent
                    if (data.user.id) {
                        setTimeout(async () => {
                            await this.applyInvitationCode(data.user.id);
                        }, 1000);
                    }
                    
                } catch (profileErr) {
                    console.warn('Exception création profil:', profileErr);
                }
            }

            return { 
                success: true, 
                data,
                message: 'Compte créé ! Veuillez vérifier votre email pour confirmer votre compte.'
            };
        } catch (error) {
            console.error('Erreur inscription:', error);
            return { 
                success: false, 
                error: this.getUserFriendlyError(error.message),
                details: error.message
            };
        }
    }

    mockSignUp(email, password, fullName) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockUser = {
                    id: 'mock_' + Date.now(),
                    email: email,
                    user_metadata: {
                        full_name: fullName,
                        created_at: new Date().toISOString()
                    },
                    created_at: new Date().toISOString()
                };
                
                this.user = mockUser;
                this.saveUserToStorage();
                this.updateUI();
                
                resolve({ 
                    success: true, 
                    data: { user: mockUser },
                    message: 'Compte créé en mode local (données sauvegardées localement)'
                });
            }, 500);
        });
    }

    async signIn(email, password) {
        try {
            if (!this.supabaseReady) {
                return this.mockSignIn(email, password);
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            
            this.user = data.user;
            this.saveUserToStorage();
            this.updateUI();
            
            // Événement : connexion réussie
            this.emitAuthEvent('login', this.user);
            
            // Appliquer le code d'invitation si présent
            if (this.user.id) {
                setTimeout(async () => {
                    await this.applyInvitationCode(this.user.id);
                    await this.loadVipPrices(this.user.id);
                }, 500);
            }
            
            const returnUrl = this.getReturnUrl();
            
            return { 
                success: true, 
                data,
                redirectUrl: returnUrl
            };
        } catch (error) {
            console.error('Erreur connexion:', error);
            return { 
                success: false, 
                error: this.getUserFriendlyError(error.message) 
            };
        }
    }

    getReturnUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        let returnUrl = urlParams.get('redirect');
        
        if (returnUrl) {
            return decodeURIComponent(returnUrl);
        }
        
        returnUrl = urlParams.get('return');
        if (returnUrl) {
            return decodeURIComponent(returnUrl);
        }
        
        const referrer = document.referrer;
        if (referrer && 
            !referrer.includes('login.html') && 
            !referrer.includes('signup.html') &&
            !referrer.includes('reset-password.html')) {
            return referrer;
        }
        
        return 'dashboard.html';
    }

    mockSignIn(email, password) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const storedUser = localStorage.getItem('yoteacher_user');
                
                if (storedUser) {
                    try {
                        const user = JSON.parse(storedUser);
                        if (user.email === email) {
                            this.user = user;
                            this.updateUI();
                            // Événement : connexion mock
                            this.emitAuthEvent('login', this.user);
                            resolve({ 
                                success: true, 
                                data: { user: user },
                                redirectUrl: this.getReturnUrl()
                            });
                            return;
                        }
                    } catch (error) {
                        // Continue vers l'échec
                    }
                }
                
                reject({ 
                    success: false, 
                    error: 'Email ou mot de passe incorrect (mode local)' 
                });
            }, 500);
        });
    }

    async signOut() {
        try {
            if (this.supabaseReady && supabase && supabase.auth) {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
            }
            
            this.user = null;
            this.vipPrices = null;
            this.removeUserFromStorage();
            this.updateUI();
            
            // Événement : déconnexion
            this.emitAuthEvent('logout');
            
            window.location.href = 'index.html#top';
            
            window.addEventListener('load', function() {
                window.scrollTo(0, 0);
                if (!window.location.hash) {
                    window.location.hash = 'top';
                }
            });
            
            return { success: true };
        } catch (error) {
            console.error('Erreur déconnexion:', error);
            this.user = null;
            this.vipPrices = null;
            this.removeUserFromStorage();
            this.updateUI();
            
            // Événement : déconnexion même en cas d'erreur
            this.emitAuthEvent('logout');
            
            window.location.href = 'index.html#top';
            return { success: true };
        }
    }

    updateUI() {
        const user = this.user;
        const isIndexPage = window.location.pathname.includes('index.html') || 
                           window.location.pathname === '/' || 
                           window.location.pathname.endsWith('/');
        
        if (user) {
            // Sur TOUTES les pages : ajouter avatar, retirer bouton Connexion header
            this.removeLoginButtonFromHeader();
            this.addUserAvatar();
            
            // Sur index.html seulement : Ne rien changer d'autre
            if (isIndexPage) {
                return; // Sortir ici, ne pas modifier les autres boutons
            }
            
            // Sur les AUTRES pages : modifier tous les boutons
            this.updateAllButtonsForConnectedUser();
            
        } else {
            // Utilisateur non connecté
            this.removeUserAvatar();
            this.restoreLoginButtonInHeader();
            
            if (!isIndexPage) {
                this.restoreAllButtonsForDisconnectedUser();
            }
        }
    }

    removeLoginButtonFromHeader() {
        const loginButtons = document.querySelectorAll('.login-btn, .mobile-login-btn-header, .mobile-login-btn');
        loginButtons.forEach(btn => {
            if (btn && btn.parentElement) {
                btn.style.display = 'none';
            }
        });
    }

    restoreLoginButtonInHeader() {
        const loginButtons = document.querySelectorAll('.login-btn, .mobile-login-btn-header, .mobile-login-btn');
        loginButtons.forEach(btn => {
            if (btn) {
                btn.style.display = 'flex';
                
                // Ajouter le paramètre redirect si nécessaire
                if (!window.location.pathname.includes('login.html') && 
                    !window.location.pathname.includes('signup.html') &&
                    btn.href && btn.href.includes('login.html')) {
                    const currentUrl = encodeURIComponent(window.location.href);
                    const separator = btn.href.includes('?') ? '&' : '?';
                    btn.href = `${btn.href.split('?')[0]}${separator}redirect=${currentUrl}`;
                }
            }
        });
    }

    updateAllButtonsForConnectedUser() {
        // Boutons "Créer un compte" -> "Mon dashboard"
        document.querySelectorAll('.btn-secondary, .btn-outline-white').forEach(btn => {
            if (!btn || !btn.textContent) return;
            
            const text = btn.textContent.toLowerCase();
            if (text.includes('créer') || text.includes('creer') || 
                (btn.href && (btn.href.includes('signup.html') || btn.href === '#'))) {
                btn.textContent = 'Mon dashboard';
                btn.href = 'dashboard.html';
                
                if (btn.classList.contains('btn-outline-white')) {
                    btn.classList.remove('btn-outline-white');
                    btn.classList.add('btn-outline');
                } else if (btn.classList.contains('btn-secondary')) {
                    btn.classList.remove('btn-secondary');
                    btn.classList.add('btn-primary');
                }
            }
        });
    }

    restoreAllButtonsForDisconnectedUser() {
        // Boutons "Mon dashboard" -> "Créer un compte gratuit"
        document.querySelectorAll('.btn-outline, .btn-primary').forEach(btn => {
            if (!btn || !btn.textContent) return;
            
            const text = btn.textContent.toLowerCase();
            if (text.includes('dashboard') || text.includes('mon dashboard') ||
                (btn.href && btn.href === 'dashboard.html')) {
                btn.textContent = 'Créer un compte gratuit';
                btn.href = 'signup.html';
                
                if (btn.classList.contains('btn-outline')) {
                    btn.classList.remove('btn-outline');
                    btn.classList.add('btn-outline-white');
                } else if (btn.classList.contains('btn-primary')) {
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
            }
        });
    }

    addUserAvatar() {
        this.removeUserAvatar();
        
        if (!this.user) return;
        
        // Trouver le conteneur header-right-group
        const container = document.querySelector('.header-right-group');
        
        if (!container) return;
        
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        
        const initials = this.getUserInitials();
        
        // Nouveau design : Bouton Dashboard avec avatar intégré et croix de déconnexion
        avatar.innerHTML = `
            <a href="dashboard.html" class="dashboard-btn">
                <div class="avatar-img">${initials}</div>
                <span>Dashboard</span>
                <button class="logout-btn-icon" id="logoutBtnIcon" title="Déconnexion">×</button>
            </a>
        `;
        
        // Ajouter l'avatar à la fin du container
        container.appendChild(avatar);
        
        // Gestion du clic sur le bouton de déconnexion
        const logoutBtn = document.getElementById('logoutBtnIcon');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
                    this.signOut();
                }
            });
        }
        
        // Gestion du clic sur le bouton Dashboard
        const dashboardBtn = avatar.querySelector('.dashboard-btn');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', (e) => {
                // Si on clique sur la croix, ne pas rediriger
                if (e.target.id === 'logoutBtnIcon' || e.target.closest('#logoutBtnIcon')) {
                    return;
                }
                e.preventDefault();
                window.location.href = 'dashboard.html';
            });
        }
    }

    getUserInitials() {
        if (!this.user) return '?';
        
        const email = this.user.email || '';
        const fullName = this.user.user_metadata?.full_name || '';
        
        if (fullName) {
            const names = fullName.split(' ');
            if (names.length >= 2) {
                return (names[0][0] + names[1][0]).toUpperCase();
            }
            return names[0][0] ? names[0][0].toUpperCase() : '?';
        }
        
        return email.substring(0, 2).toUpperCase() || '?';
    }

    removeUserAvatar() {
        const existingAvatar = document.querySelector('.user-avatar');
        if (existingAvatar) {
            existingAvatar.remove();
        }
    }

    isAuthenticated() {
        return !!this.user;
    }

    getCurrentUser() {
        return this.user;
    }

    async resetPassword(email) {
        try {
            if (!this.supabaseReady) {
                throw new Error('Supabase non initialisé');
            }

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password.html`
            });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Erreur réinitialisation mot de passe:', error);
            return { 
                success: false, 
                error: this.getUserFriendlyError(error.message) 
            };
        }
    }

    async updatePassword(newPassword) {
        try {
            if (!this.supabaseReady) {
                throw new Error('Supabase non initialisé');
            }

            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Erreur mise à jour mot de passe:', error);
            return { 
                success: false, 
                error: this.getUserFriendlyError(error.message) 
            };
        }
    }

    async refreshSession() {
        try {
            if (!this.supabaseReady) {
                throw new Error('Supabase non initialisé');
            }

            const { data, error } = await supabase.auth.refreshSession();
            
            if (error) throw error;
            
            if (data.session) {
                this.user = data.session.user;
                this.saveUserToStorage();
                this.updateUI();
                // Événement : session rafraîchie
                this.emitAuthEvent('login', this.user);
            }
            
            return { success: true, data };
        } catch (error) {
            console.error('Erreur rafraîchissement session:', error);
            return { 
                success: false, 
                error: this.getUserFriendlyError(error.message) 
            };
        }
    }

    getUserFriendlyError(errorMessage) {
        const errorMap = {
            'Invalid login credentials': 'Email ou mot de passe incorrect',
            'Email not confirmed': 'Veuillez confirmer votre adresse email',
            'User already registered': 'Un compte existe déjà avec cette adresse email',
            'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères',
            'Unable to validate email address: invalid format': 'Format d\'email invalide',
            'Auth session missing': 'Session expirée, veuillez vous reconnecter',
            'Invalid Refresh Token': 'Session expirée, veuillez vous reconnecter',
            'Email address is invalid': 'Adresse email invalide',
            'Signup requires a valid password': 'Mot de passe requis',
            'signup not allowed for otp': 'Inscription non autorisée',
            'Signups not allowed for this instance': 'Les inscriptions sont désactivées'
        };
        
        return errorMap[errorMessage] || errorMessage || 'Une erreur est survenue';
    }

    // NOUVELLE MÉTHODE : Gestion des paiements
    async savePayment(paymentData) {
        try {
            if (!this.supabaseReady || !window.supabase) {
                // Sauvegarder localement en mode dégradé
                const payments = JSON.parse(localStorage.getItem('yoteacher_payments') || '[]');
                const paymentRecord = {
                    ...paymentData,
                    id: 'local_' + Date.now(),
                    created_at: new Date().toISOString()
                };
                payments.push(paymentRecord);
                localStorage.setItem('yoteacher_payments', JSON.stringify(payments));
                return { success: true, id: paymentRecord.id, data: paymentRecord };
            }

            const { data, error } = await supabase
                .from('payments')
                .insert([{
                    user_id: paymentData.userId || this.user?.id,
                    booking_id: paymentData.bookingId,
                    amount: paymentData.amount,
                    currency: paymentData.currency || 'EUR',
                    method: paymentData.method,
                    transaction_id: paymentData.transactionId,
                    status: paymentData.status || 'completed',
                    payment_data: paymentData.paymentData || paymentData,
                    created_at: new Date().toISOString()
                }])
                .select();

            if (error) {
                console.error('Erreur sauvegarde paiement:', error);
                return { success: false, error: error.message };
            }

            return { success: true, id: data[0].id, data: data[0] };
        } catch (error) {
            console.error('Exception sauvegarde paiement:', error);
            return { success: false, error: error.message };
        }
    }

    // NOUVELLE MÉTHODE : Mettre à jour le statut d'une réservation après paiement
    async updateBookingStatus(bookingId, status) {
        try {
            if (!this.supabaseReady || !window.supabase) {
                return { success: true, message: 'Mode local - statut mis à jour localement' };
            }

            const { error } = await supabase
                .from('bookings')
                .update({ 
                    status: status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', bookingId);

            if (error) {
                console.error('Erreur mise à jour réservation:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            console.error('Exception mise à jour réservation:', error);
            return { success: false, error: error.message };
        }
    }

    // NOUVELLE MÉTHODE : Obtenir l'historique des paiements
    async getPaymentHistory() {
        try {
            if (!this.supabaseReady || !window.supabase || !this.user) {
                // Retourner les paiements locaux
                const localPayments = JSON.parse(localStorage.getItem('yoteacher_payments') || '[]');
                return { success: true, data: localPayments };
            }

            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .eq('user_id', this.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erreur récupération historique paiements:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Exception récupération historique paiements:', error);
            return { success: false, error: error.message };
        }
    }
}

// Ajout d'écouteurs globaux pour le débogage des événements
window.addEventListener('auth:login', function(e) {
    console.log('Événement global auth:login reçu', e.detail?.user?.email || 'sans email');
});

window.addEventListener('auth:logout', function() {
    console.log('Événement global auth:logout reçu');
});

document.addEventListener('DOMContentLoaded', function() {
    const isAuthPage = window.location.pathname.includes('login.html') || 
                      window.location.pathname.includes('signup.html');
    
    const isDashboardPage = window.location.pathname.includes('dashboard.html') ||
                           window.location.pathname.includes('profile.html');
    
    // Délai adaptatif selon le device
    const delay = window.innerWidth <= 768 ? 500 : 100;
    
    setTimeout(() => {
        window.authManager = new AuthManager();
        
        if (isDashboardPage) {
            setTimeout(() => {
                if (!window.authManager.isAuthenticated()) {
                    const currentUrl = encodeURIComponent(window.location.href);
                    window.location.href = `login.html?redirect=${currentUrl}`;
                }
            }, 1000);
        }
    }, delay);
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager };
}