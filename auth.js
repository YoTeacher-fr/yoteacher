// Gestion de l'authentification avec gestion des paiements - ADAPTÉ AU SCHÉMA SUPABASE
class AuthManager {
    constructor() {
        this.user = null;
        this.supabaseReady = false;
        this.pendingPayment = null;
        this.init();
    }

    async init() {
        try {
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
                if (session) {
                    this.user = session.user;
                    await this.loadUserProfile();
                    this.updateUI();
                    // Événement : utilisateur déjà connecté
                    this.emitAuthEvent('login', this.user);
                }

                // Écouter les changements d'authentification
                supabase.auth.onAuthStateChange(async (event, session) => {
                    console.log('Auth state changed:', event, session);
                    if (session) {
                        this.user = session.user;
                        await this.loadUserProfile();
                        this.updateUI();
                        // Événement : connexion
                        this.emitAuthEvent('login', this.user);
                    } else {
                        this.user = null;
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
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de l\'auth:', error);
            this.setupDegradedMode();
        }
    }

    async loadUserProfile() {
        if (!this.user || !this.supabaseReady) return;
        
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', this.user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = aucun résultat
                console.warn('Erreur chargement profil:', error);
                // Créer le profil s'il n'existe pas
                if (error.code === 'PGRST116') {
                    await this.createUserProfile();
                }
            } else if (profile) {
                // Fusionner les données du profil avec l'utilisateur
                this.user.profile = profile;
		if (profile.is_vip) {
                await this.loadVipPrices();
            }
if (profile.is_vip) {
    await this.loadVipPrices();
}                
this.saveUserToStorage();
		
            }
        } catch (error) {
            console.warn('Exception chargement profil:', error);
        }
    }

    async createUserProfile() {
        if (!this.user || !this.supabaseReady) return;
        
        try {
            const { error } = await supabase
                .from('profiles')
                .insert({
                    id: this.user.id,
                    email: this.user.email,
                    full_name: this.user.user_metadata?.full_name || '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    is_vip: false,
                    preferred_currency: 'EUR',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                });

            if (error) {
                console.warn('Erreur création profil:', error);
            } else {
                console.log('✅ Profil créé dans Supabase');
                await this.loadUserProfile();
            }
        } catch (error) {
            console.warn('Exception création profil:', error);
        }
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
        return new Promise(async (resolve) => {
            try {
                const initialized = await window.supabaseInitialized;
                this.supabaseReady = initialized;
            } catch (error) {
                console.warn('Erreur initialisation Supabase:', error);
                this.supabaseReady = false;
            }

            let attempts = 0;
            const maxAttempts = 100;
            
            const checkSupabase = async () => {
                attempts++;
                
                if (window.supabase?.auth?.getSession) {
                    try {
                        await window.supabase.auth.getSession();
                        this.supabaseReady = true;
                        resolve();
                        return;
                    } catch (err) {
                        this.supabaseReady = false;
                        resolve();
                        return;
                    }
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
            profile: this.user.profile,
vipPrices: this.user.vipPrices,
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
                // Créer le profil dans la table profiles
                try {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert({
                            id: data.user.id,
                            email: email,
                            full_name: fullName,
                            is_vip: false,
                            preferred_currency: 'EUR',
                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });

                    if (profileError) {
                        console.warn('Erreur création profil:', profileError);
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
                    profile: {
                        full_name: fullName,
                        is_vip: false,
                        preferred_currency: 'EUR'
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
            await this.loadUserProfile();
	if (this.user.profile?.is_vip) {
    await this.loadVipPrices();
}
            this.updateUI();
            
            // Événement : connexion réussie
            this.emitAuthEvent('login', this.user);
            
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
        
        const fullName = this.user.profile?.full_name || this.user.user_metadata?.full_name || '';
        const email = this.user.email || '';
        
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

    // MÉTHODE : Vérifier si l'utilisateur est VIP
    isUserVip() {
        return this.user && this.user.profile && this.user.profile.is_vip === true;
    }

    // MÉTHODE : Obtenir le prix VIP pour un type de cours et une durée
    async getVipPrice(courseType, duration) {
    try {
        if (!this.supabaseReady || !window.supabase || !this.user) {
            console.log('❌ Conditions VIP non remplies');
            return null;
        }

        const durationInt = parseInt(duration);
        console.log(`🔍 Recherche prix VIP pour ${courseType} - ${durationInt}min, user: ${this.user.id}`);
        
        const { data, error } = await supabase
            .from('vip_pricing')
            .select('price, currency, duration_minutes')
            .eq('user_id', this.user.id)
            .eq('course_type', courseType)
            .eq('duration_minutes', durationInt)
            .maybeSingle();

        if (error) {
            console.warn('⚠️ Erreur requête prix VIP:', error);
            return null;
        }

        if (!data) {
            console.log(`ℹ️ Aucun prix VIP trouvé pour ${courseType} ${durationInt}min`);
            return null;
        }

        console.log('✅ Prix VIP trouvé:', data);
        
        // Retourner les données brutes, la conversion sera faite plus tard
        return {
            price: parseFloat(data.price),
            currency: data.currency,
            duration: data.duration_minutes
        };
    } catch (error) {
        console.warn('Exception lors de la récupération du prix VIP:', error);
        return null;
    }
}

// AJOUTER après la méthode getVipPrice :
async loadVipPrices() {
    if (!this.supabaseReady || !window.supabase || !this.user) {
        return;
    }

    try {
        console.log('👑 Chargement des prix VIP pour l\'utilisateur:', this.user.id);
        
        const { data, error } = await supabase
            .from('vip_pricing')
            .select('*')
            .eq('user_id', this.user.id);

        if (error) {
            console.warn('⚠️ Erreur chargement prix VIP:', error);
            return;
        }

        if (data && data.length > 0) {
            console.log(`✅ ${data.length} prix VIP chargés:`, data);
            
            // Stocker les prix VIP dans l'objet user
            this.user.vipPrices = data;
            
            // Émettre un événement pour informer que les prix VIP sont chargés
            window.dispatchEvent(new CustomEvent('vip:loaded', { 
                detail: { prices: data } 
            }));
        } else {
            console.log('ℹ️ Aucun prix VIP configuré pour cet utilisateur');
        }
    } catch (error) {
        console.error('Exception chargement prix VIP:', error);
    }
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
                await this.loadUserProfile();
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

    // MÉTHODE : Gestion des paiements
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

            // Note: Votre schéma n'a pas de table 'payments', nous utiliserons bookings avec payment_method
            // Si vous avez besoin d'une table payments, vous devrez la créer
            console.log('⚠️ Table payments non trouvée dans le schéma');
            
            // Enregistrer dans localStorage comme fallback
            const payments = JSON.parse(localStorage.getItem('yoteacher_payments') || '[]');
            const paymentRecord = {
                ...paymentData,
                id: 'local_' + Date.now(),
                created_at: new Date().toISOString()
            };
            payments.push(paymentRecord);
            localStorage.setItem('yoteacher_payments', JSON.stringify(payments));
            
            return { success: true, id: paymentRecord.id, data: paymentRecord };
        } catch (error) {
            console.error('Exception sauvegarde paiement:', error);
            return { success: false, error: error.message };
        }
    }

    // MÉTHODE : Mettre à jour le statut d'une réservation
    async updateBookingStatus(bookingId, status) {
        try {
            if (!this.supabaseReady || !window.supabase) {
                return { success: true, message: 'Mode local - statut mis à jour localement' };
            }

            const updateData = { 
                status: status,
                updated_at: new Date().toISOString()
            };

            // Ajouter completed_at si le statut est 'completed'
            if (status === 'completed') {
                updateData.completed_at = new Date().toISOString();
            }
            // Ajouter cancelled_at si le statut est 'cancelled'
            else if (status === 'cancelled') {
                updateData.cancelled_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('bookings')
                .update(updateData)
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

    // MÉTHODE : Obtenir l'historique des réservations
    async getBookingHistory() {
        try {
            if (!this.supabaseReady || !window.supabase || !this.user) {
                // Retourner les réservations locales
                const localBookings = JSON.parse(localStorage.getItem('yoteacher_bookings') || '[]');
                return { success: true, data: localBookings };
            }

            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('user_id', this.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erreur récupération historique réservations:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Exception récupération historique réservations:', error);
            return { success: false, error: error.message };
        }
    }

    // MÉTHODE : Sauvegarder les données de réservation
    async saveBookingData(bookingData) {
        try {
            if (!this.supabaseReady || !window.supabase || !this.user) {
                // Sauvegarder localement
                const bookings = JSON.parse(localStorage.getItem('yoteacher_bookings') || '[]');
                bookings.push(bookingData);
                localStorage.setItem('yoteacher_bookings', JSON.stringify(bookings));
                return { success: true };
            }

            // Générer un numéro de réservation
            const bookingNumber = `BK-${Date.now().toString().slice(-8)}`;
            
            const { error } = await supabase
                .from('bookings')
                .insert({
                    user_id: this.user.id,
                    course_type: bookingData.courseType,
                    duration_minutes: bookingData.duration || 60,
                    start_time: bookingData.startTime,
                    end_time: bookingData.endTime,
                    price_paid: bookingData.price,
                    currency: bookingData.currency,
                    platform: this.getPlatformName(bookingData.location),
                    status: bookingData.status || 'pending',
                    booking_number: bookingNumber,
                    payment_method: bookingData.paymentMethod,
                    payment_reference: bookingData.transactionId,
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error('Erreur sauvegarde réservation:', error);
                return { success: false, error: error.message };
            }

            return { success: true, booking_number: bookingNumber };
        } catch (error) {
            console.error('Exception sauvegarde réservation:', error);
            return { success: false, error: error.message };
        }
    }

    getPlatformName(location) {
        if (!location) return 'zoom';
        if (location.includes('google')) return 'google_meet';
        if (location.includes('teams')) return 'microsoft_teams';
        if (location.includes('zoom')) return 'zoom';
        return location;
    }

    // MÉTHODE : Obtenir les statistiques de l'utilisateur
    async getUserStatistics() {
        try {
            if (!this.supabaseReady || !window.supabase || !this.user) {
                return { success: false, error: 'Utilisateur non connecté' };
            }

            const { data, error } = await supabase
                .from('user_statistics')
                .select('*')
                .eq('user_id', this.user.id)
                .single();

            if (error) {
                console.warn('Erreur récupération statistiques:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Exception statistiques:', error);
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
window.debugVipPrices = async function() {
    const authMgr = window.authManager;
    
    if (!authMgr || !authMgr.user) {
        console.error('❌ Utilisateur non connecté');
        return;
    }
    
    console.group('🔍 Debug Prix VIP');
    console.log('User ID:', authMgr.user.id);
    console.log('Est VIP:', authMgr.isUserVip());
    console.log('Profile:', authMgr.user.profile);
    
    if (authMgr.user.vipPrices) {
        console.log('Prix VIP chargés:', authMgr.user.vipPrices);
    } else {
        console.log('⚠️ Aucun prix VIP chargé dans user.vipPrices');
    }
    
    // Tester la récupération des prix
    const courseTypes = ['conversation', 'curriculum', 'examen'];
    const durations = [30, 45, 60];
    
    for (const courseType of courseTypes) {
        console.log(`\n📚 ${courseType}:`);
        for (const duration of durations) {
            const price = await authMgr.getVipPrice(courseType, duration);
            if (price) {
                console.log(`  ✅ ${duration}min: ${price.price}${price.currency}`);
            } else {
                console.log(`  ❌ ${duration}min: non trouvé`);
            }
        }
    }
    
    console.groupEnd();
};