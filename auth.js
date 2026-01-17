// Gestion de l'authentification avec gestion des paiements et codes VIP - VERSION ULTIME CORRIGÉE
class AuthManager {
    constructor() {
        this.user = null;
        this.supabaseReady = false;
        this.pendingPayment = null;
        this.invitationCode = null;
        this._initializationPromise = null;
        this._sessionCheckAbortController = null; // Pour gérer l'annulation
        this.init();
    }

    async init() {
        try {
            console.log('🔧 Initialisation AuthManager...');
            
            // Vérifier code d'invitation dans l'URL
            this.checkInvitationCode();
            
            // Attendre Supabase de manière asynchrone sans bloquer
            setTimeout(() => {
                this.initializeSupabaseConnection();
            }, 100);
            
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de l\'auth:', error);
            this.setupDegradedMode();
        }
    }

    // ===== NOUVELLE APPROCHE : Initialisation non-bloquante =====
    async initializeSupabaseConnection() {
        try {
            console.log('🔄 Démarrage connexion Supabase...');
            
            // 1. D'abord vérifier si Supabase existe déjà
            if (window.supabase && window.supabase.auth) {
                console.log('✅ Supabase déjà disponible');
                this.supabaseReady = true;
                await this.checkExistingSession();
                return;
            }
            
            // 2. Si non, attendre la promesse d'initialisation
            if (window.supabaseInitPromise) {
                console.log('⏳ Attente de supabaseInitPromise...');
                try {
                    await window.supabaseInitPromise;
                    
                    if (window.supabase && window.supabase.auth) {
                        this.supabaseReady = true;
                        console.log('✅ Supabase initialisé via promesse');
                        await this.checkExistingSession();
                        return;
                    }
                } catch (promiseError) {
                    console.warn('⚠️ Erreur supabaseInitPromise:', promiseError.message);
                }
            }
            
            // 3. Vérification légère avec timeout court
            console.log('🔍 Vérification légère Supabase...');
            await this.lightCheckSupabase();
            
            if (!this.supabaseReady) {
                console.warn('Mode dégradé activé : Supabase non disponible');
                this.setupDegradedMode();
            }
            
        } catch (error) {
            console.warn('Erreur initialisation connexion:', error);
            this.setupDegradedMode();
        }
    }

    async lightCheckSupabase() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 20; // Seulement 2 secondes
            
            const check = () => {
                attempts++;
                
                if (window.supabase && window.supabase.auth) {
                    // Test léger SANS getSession() qui peut causer AbortError
                    try {
                        // Juste vérifier que l'objet existe
                        this.supabaseReady = true;
                        console.log('✅ Supabase détecté (vérification légère)');
                        
                        // Vérifier la session en arrière-plan
                        setTimeout(() => {
                            this.checkExistingSession().catch(() => {
                                // Ignorer les erreurs de session
                            });
                        }, 100);
                        
                        resolve();
                        return;
                    } catch (err) {
                        console.warn('⚠️ Supabase existe mais erreur:', err.message);
                    }
                }
                
                if (attempts >= maxAttempts) {
                    console.warn('⚠️ Supabase non détecté après 2s');
                    resolve();
                    return;
                }
                
                setTimeout(check, 100);
            };
            
            check();
        });
    }

    async checkExistingSession() {
        if (!this.supabaseReady || !window.supabase) {
            console.log('❌ Supabase non prêt pour vérification session');
            return;
        }
        
        try {
            console.log('🔍 Vérification session existante...');
            
            // Créer un AbortController pour éviter les requêtes concurrentes
            if (this._sessionCheckAbortController) {
                this._sessionCheckAbortController.abort();
            }
            this._sessionCheckAbortController = new AbortController();
            
            // Configurer un timeout pour éviter les blocages
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout vérification session')), 5000)
            );
            
            const sessionPromise = window.supabase.auth.getSession();
            
            const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
            
            if (session) {
                this.user = session.user;
                await this.loadUserProfile();
                this.updateUI();
                this.emitAuthEvent('login', this.user);
                console.log('✅ Session restaurée pour:', this.user.email);
            }
            
            // Écouter les changements d'authentification
            window.supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('Auth state changed:', event);
                if (session) {
                    this.user = session.user;
                    await this.loadUserProfile();
                    this.updateUI();
                    this.emitAuthEvent('login', this.user);
                    
                    // Appliquer code VIP si présent
                    await this.applyPendingInvitation();
                } else {
                    this.user = null;
                    this.removeUserFromStorage();
                    this.updateUI();
                    this.emitAuthEvent('logout');
                }
            });
            
        } catch (error) {
            // Ignorer spécifiquement AbortError
            if (error.name === 'AbortError') {
                console.log('ℹ️ Vérification session annulée');
                return;
            }
            
            if (error.message.includes('Timeout')) {
                console.warn('⚠️ Timeout vérification session');
                return;
            }
            
            console.warn('Erreur vérification session:', error.message);
            // Ne pas activer le mode dégradé pour les erreurs de session
        }
    }

    // ===== GESTION DES CODES D'INVITATION VIP =====
    
    checkInvitationCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
            console.log('🎟️ Code d\'invitation VIP détecté:', code);
            this.invitationCode = code;
            sessionStorage.setItem('invitation_code', code);
            this.showInvitationNotification(code);
            return code;
        }
        
        const savedCode = sessionStorage.getItem('invitation_code');
        if (savedCode) {
            console.log('🎟️ Code d\'invitation VIP en attente:', savedCode);
            this.invitationCode = savedCode;
            return savedCode;
        }
        
        return null;
    }

    showInvitationNotification(code) {
        // ... (même code que précédemment)
    }

    async applyPendingInvitation() {
        const code = this.invitationCode || sessionStorage.getItem('invitation_code');
        
        if (!code || !this.user) {
            return;
        }
        
        console.log('🎟️ Application du code d\'invitation VIP:', code);
        await this.applyInvitationCode(code);
    }

    async applyInvitationCode(code) {
        if (!this.supabaseReady || !this.user) {
            console.error('❌ Conditions non remplies pour appliquer le code');
            return { success: false };
        }
        
        try {
            console.log(`🔍 Vérification du code VIP: ${code}`);
            
            // 1. Vérifier que le code existe dans la table
            const { data: templatePrices, error: pricesError } = await supabase
                .from('vip_pricing')
                .select('*')
                .eq('invitation_code', code.toUpperCase())
                .is('user_id', null);
            
            if (pricesError) {
                console.error('❌ Erreur récupération template:', pricesError);
                return { success: false, error: pricesError.message };
            }
            
            if (!templatePrices || templatePrices.length === 0) {
                console.warn('⚠️ Code VIP invalide');
                this.showError('Code d\'invitation invalide');
                sessionStorage.removeItem('invitation_code');
                this.invitationCode = null;
                return { success: false, error: 'Code invalide' };
            }
            
            console.log(`✅ Code valide trouvé avec ${templatePrices.length} prix VIP`);
            
            // 2. Vérifier si l'utilisateur a déjà des prix VIP
            const { data: existingPrices } = await supabase
                .from('vip_pricing')
                .select('id')
                .eq('user_id', this.user.id)
                .eq('invitation_code', code.toUpperCase())
                .limit(1);
            
            if (existingPrices && existingPrices.length > 0) {
                console.log('ℹ️ Prix VIP déjà appliqués');
                sessionStorage.removeItem('invitation_code');
                this.invitationCode = null;
                return { success: true, message: 'Déjà appliqué' };
            }
            
            // 3. CRÉER OU METTRE À JOUR LE PROFIL
            console.log('🔄 Vérification/création du profil...');
            
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('id, is_vip')
                .eq('id', this.user.id)
                .maybeSingle();
            
            if (!existingProfile) {
                console.log('📝 Création du profil VIP...');
                
                const profileData = {
                    id: this.user.id,
                    full_name: this.user.user_metadata?.full_name || this.user.email.split('@')[0] || 'Utilisateur',
                    is_vip: true,
                    preferred_currency: 'EUR',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert(profileData);
                
                if (profileError) {
                    console.error('❌ Erreur création profil VIP:', profileError);
                    return { success: false, error: profileError.message };
                }
                
                console.log('✅ Profil VIP créé');
            } else {
                // Mettre à jour le profil existant
                console.log('🔄 Mise à jour du profil existant...');
                
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ 
                        is_vip: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.user.id);
                
                if (profileError) {
                    console.error('⚠️ Erreur mise à jour profil:', profileError);
                }
            }
            
            // 4. Copier les prix VIP
            const newPrices = templatePrices.map(price => ({
                user_id: this.user.id,
                course_type: price.course_type,
                duration_minutes: price.duration_minutes,
                price: price.price,
                currency: price.currency,
                invitation_code: code.toUpperCase(),
                created_at: new Date().toISOString()
            }));
            
            console.log(`📋 Insertion de ${newPrices.length} prix VIP...`);
            
            const { data: insertedPrices, error: insertError } = await supabase
                .from('vip_pricing')
                .insert(newPrices)
                .select();
            
            if (insertError) {
                console.error('❌ Erreur insertion prix VIP:', insertError);
                return { success: false, error: insertError.message };
            }
            
            console.log(`✅ ${insertedPrices.length} prix VIP copiés`);
            
            // 5. Recharger le profil
            await this.loadUserProfile();
            
            // 6. Nettoyer
            sessionStorage.removeItem('invitation_code');
            this.invitationCode = null;
            
            // 7. Afficher succès
            this.showSuccess(`🎉 Bienvenue VIP ! ${insertedPrices.length} prix préférentiels.`);
            
            window.dispatchEvent(new CustomEvent('vip:applied', {
                detail: { 
                    code: code, 
                    prices: insertedPrices,
                    nb_prix: insertedPrices.length 
                }
            }));
            
            return { 
                success: true, 
                prices: insertedPrices,
                nb_prix: insertedPrices.length 
            };
            
        } catch (error) {
            console.error('❌ Exception application code VIP:', error);
            return { success: false, error: error.message };
        }
    }

    showSuccess(message) {
        if (window.utils && window.utils.showNotification) {
            window.utils.showNotification(message, 'success');
        } else {
            alert(message);
        }
    }

    showError(message) {
        if (window.utils && window.utils.showNotification) {
            window.utils.showNotification(message, 'error');
        } else {
            alert(message);
        }
    }

    async loadUserProfile() {
        if (!this.user) {
            console.log('❌ Pas d\'utilisateur à charger');
            return;
        }
        
        console.log('📋 Chargement du profil pour:', this.user.email);
        
        if (!this.supabaseReady) {
            console.warn('⚠️ Supabase non prêt, métadonnées uniquement');
            this.saveUserToStorage();
            return;
        }
        
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', this.user.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Profil non trouvé, créer un nouveau
                    await this.createUserProfile();
                    return;
                }
                console.warn('Erreur chargement profil:', error);
                return;
            }
            
            if (profile) {
                console.log('✅ Profil chargé');
                this.user.profile = profile;
                
                // Ajouter l'email au profil pour l'interface
                if (this.user.email) {
                    this.user.profile.email = this.user.email;
                }
                
                if (profile.is_vip) {
                    console.log('👑 Utilisateur VIP');
                    // Charger les prix VIP en arrière-plan
                    setTimeout(() => {
                        this.loadVipPrices().catch(() => {
                            // Ignorer les erreurs
                        });
                    }, 500);
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
            const profileData = {
                id: this.user.id,
                full_name: this.user.user_metadata?.full_name || this.user.email.split('@')[0] || 'Utilisateur',
                is_vip: false,
                preferred_currency: 'EUR',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('profiles')
                .insert(profileData);

            if (error) {
                console.warn('Erreur création profil:', error);
                // Tentative avec structure minimale
                const minimalProfile = {
                    id: this.user.id,
                    full_name: this.user.user_metadata?.full_name || this.user.email.split('@')[0] || 'Utilisateur',
                    created_at: new Date().toISOString()
                };
                
                const { error: minimalError } = await supabase
                    .from('profiles')
                    .insert(minimalProfile);
                    
                if (minimalError) {
                    console.error('❌ Erreur structure minimale:', minimalError);
                }
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
            console.warn('Erreur événement:', error);
        }
    }

    setupDegradedMode() {
        const storedUser = localStorage.getItem('yoteacher_user');
        if (storedUser) {
            try {
                this.user = JSON.parse(storedUser);
                console.log('Mode dégradé : utilisateur restauré');
                this.updateUI();
            } catch (error) {
                console.warn('Erreur lecture stockage:', error);
                this.user = null;
            }
        }
        
        this.showDegradedModeWarning();
    }

    showDegradedModeWarning() {
        // ... (même code)
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
            created_at: this.user.created_at,
            _timestamp: Date.now()
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

            console.log('📝 Inscription pour:', email);

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
                console.error('Supabase signUp error:', error);
                throw error;
            }

            if (data.user) {
                console.log('✅ Utilisateur créé:', data.user.id);
                
                // Créer le profil
                try {
                    const profileData = {
                        id: data.user.id,
                        full_name: fullName || email.split('@')[0],
                        is_vip: false,
                        preferred_currency: 'EUR',
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };

                    await supabase
                        .from('profiles')
                        .insert(profileData);
                        
                    console.log('✅ Profil créé');
                } catch (profileErr) {
                    console.error('❌ Erreur création profil:', profileErr);
                }
                
                // Appliquer code VIP si présent
                const invitationCode = this.invitationCode || sessionStorage.getItem('invitation_code');
                
                if (invitationCode) {
                    console.log('🎟️ Code VIP détecté lors de l\'inscription');
                    
                    setTimeout(async () => {
                        try {
                            const tempUser = {
                                id: data.user.id,
                                email: email,
                                user_metadata: { full_name: fullName }
                            };
                            
                            const oldUser = this.user;
                            this.user = tempUser;
                            
                            await this.applyInvitationCode(invitationCode);
                            
                            this.user = oldUser;
                        } catch (vipError) {
                            console.warn('⚠️ Échec application code VIP:', vipError);
                        }
                    }, 1000);
                }
            }

            return { 
                success: true, 
                data,
                message: 'Compte créé ! Vérifiez votre email.'
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
                    message: 'Compte créé en mode local'
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
            
            this.emitAuthEvent('login', this.user);
            
            await this.applyPendingInvitation();
            
            return { 
                success: true, 
                data,
                redirectUrl: 'dashboard.html'
            };
        } catch (error) {
            console.error('Erreur connexion:', error);
            return { 
                success: false, 
                error: this.getUserFriendlyError(error.message) 
            };
        }
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
                            this.emitAuthEvent('login', this.user);
                            resolve({ 
                                success: true, 
                                data: { user: user },
                                redirectUrl: 'dashboard.html'
                            });
                            return;
                        }
                    } catch (error) {
                        // Continue
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
            console.log('🚪 Déconnexion...');
            
            if (this.supabaseReady && supabase && supabase.auth) {
                const { error } = await supabase.auth.signOut();
                if (error) {
                    console.warn('⚠️ Erreur déconnexion Supabase:', error);
                }
            }
            
            this.user = null;
            this.removeUserFromStorage();
            this.updateUI();
            
            this.emitAuthEvent('logout');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 300);
            
            return { success: true };
        } catch (error) {
            console.error('Erreur déconnexion:', error);
            this.user = null;
            this.removeUserFromStorage();
            this.updateUI();
            this.emitAuthEvent('logout');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 300);
            
            return { success: true };
        }
    }

    updateUI() {
        // ... (même code que précédemment)
    }

    removeLoginButtonFromHeader() {
        // ... (même code)
    }

    restoreLoginButtonInHeader() {
        // ... (même code)
    }

    updateAllButtonsForConnectedUser() {
        // ... (même code)
    }

    restoreAllButtonsForDisconnectedUser() {
        // ... (même code)
    }

    addUserAvatar() {
        // ... (même code)
    }

    getUserInitials() {
        // ... (même code)
    }

    removeUserAvatar() {
        // ... (même code)
    }

    isAuthenticated() {
        return !!this.user;
    }

    getCurrentUser() {
        return this.user;
    }

    isUserVip() {
        return this.user && this.user.profile && this.user.profile.is_vip === true;
    }

    async getVipPrice(courseType, duration) {
        try {
            if (!this.supabaseReady || !window.supabase || !this.user) {
                console.log('❌ Conditions VIP non remplies');
                return null;
            }

            const durationInt = parseInt(duration);
            
            // Chercher d'abord le prix exact
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

            if (data) {
                return {
                    price: parseFloat(data.price),
                    currency: data.currency,
                    duration: data.duration_minutes,
                    isExact: true
                };
            }

            // Si pas de prix exact, chercher 60min
            const { data: data60, error: error60 } = await supabase
                .from('vip_pricing')
                .select('price, currency')
                .eq('user_id', this.user.id)
                .eq('course_type', courseType)
                .eq('duration_minutes', 60)
                .maybeSingle();

            if (error60 || !data60) {
                return null;
            }

            const basePrice = parseFloat(data60.price);
            const adjustedPrice = basePrice * (durationInt / 60);
            
            return {
                price: adjustedPrice,
                currency: data60.currency,
                duration: durationInt,
                isExact: false,
                basePrice: basePrice,
                baseDuration: 60
            };
            
        } catch (error) {
            console.warn('Exception prix VIP:', error);
            return null;
        }
    }

    async loadVipPrices() {
        if (!this.supabaseReady || !window.supabase || !this.user) {
            return;
        }

        try {
            const { data, error } = await supabase
                .from('vip_pricing')
                .select('*')
                .eq('user_id', this.user.id);

            if (error) {
                console.warn('⚠️ Erreur chargement prix VIP:', error);
                return;
            }

            if (data && data.length > 0) {
                this.user.vipPrices = data;
                
                window.dispatchEvent(new CustomEvent('vip:loaded', { 
                    detail: { prices: data } 
                }));
            }
        } catch (error) {
            console.error('Exception chargement prix VIP:', error);
        }
    }

    getUserFriendlyError(errorMessage) {
        const errorMap = {
            'Invalid login credentials': 'Email ou mot de passe incorrect',
            'Email not confirmed': 'Veuillez confirmer votre email',
            'User already registered': 'Compte déjà existant',
            'Password should be at least 6 characters': 'Mot de passe 6 caractères minimum',
            'Unable to validate email address: invalid format': 'Email invalide',
            'Auth session missing': 'Session expirée',
            'Invalid Refresh Token': 'Session expirée',
            'Email address is invalid': 'Email invalide'
        };
        
        return errorMap[errorMessage] || errorMessage || 'Erreur';
    }
}

// Écouteurs d'événements
window.addEventListener('auth:login', function(e) {
    console.log('✅ auth:login reçu', e.detail?.user?.email || 'sans email');
});

window.addEventListener('auth:logout', function() {
    console.log('⚠️ auth:logout reçu');
});

// Initialisation avec délai raisonnable
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM chargé - Démarrage AuthManager dans 800ms...');
    
    setTimeout(() => {
        console.log('🚀 Création AuthManager...');
        window.authManager = new AuthManager();
    }, 800);
});

console.log('✅ auth.js chargé - Version ultime sans conflit');