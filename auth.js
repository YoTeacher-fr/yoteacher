// Gestion de l'authentification avec gestion des paiements et codes VIP - VERSION FINALE CORRIGÉE
class AuthManager {
    constructor() {
        this.user = null;
        this.supabaseReady = false;
        this.pendingPayment = null;
        this.invitationCode = null; // Code d'invitation VIP
        this.init();
    }

    async init() {
        try {
            // Vérifier code d'invitation dans l'URL
            this.checkInvitationCode();
            
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
                    console.log('✅ Session restaurée pour:', this.user.email);
                    // Ne PAS appliquer le code ici, c'est fait pendant signUp
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
                        
                        // Appliquer code VIP si présent
                        await this.applyPendingInvitation();
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
        const notification = document.createElement('div');
        notification.id = 'invitation-notification';
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #FFD700, #FFA500);
            color: #000;
            padding: 15px 30px;
            border-radius: 50px;
            box-shadow: 0 10px 30px rgba(255, 165, 0, 0.3);
            z-index: 10000;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideDown 0.5s ease;
        `;
        
        notification.innerHTML = `
            <i class="fas fa-crown" style="font-size: 1.2rem;"></i>
            <span>Code VIP appliqué : <strong>${code}</strong></span>
            <i class="fas fa-check-circle" style="color: #2e7d32;"></i>
        `;
        
        if (!document.getElementById('invitation-styles')) {
            const style = document.createElement('style');
            style.id = 'invitation-styles';
            style.textContent = `
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.transition = 'all 0.3s ease';
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(-50%) translateY(-100%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
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
            
            // 1. Vérifier que le code existe dans la table (au moins 1 prix template)
            const { data: templatePrices, error: pricesError } = await supabase
                .from('vip_pricing')
                .select('*')
                .eq('invitation_code', code.toUpperCase())
                .is('user_id', null);
            
            if (pricesError) {
                console.error('❌ Erreur récupération template:', pricesError);
                this.showError('Erreur lors de la vérification du code');
                return { success: false, error: pricesError.message };
            }
            
            if (!templatePrices || templatePrices.length === 0) {
                console.warn('⚠️ Code VIP invalide (aucun prix configuré)');
                this.showError('Code d\'invitation invalide');
                sessionStorage.removeItem('invitation_code');
                this.invitationCode = null;
                return { success: false, error: 'Code invalide' };
            }
            
            console.log(`✅ Code valide trouvé avec ${templatePrices.length} prix VIP`);
            
            // 2. Vérifier si l'utilisateur a déjà des prix VIP avec ce code
            const { data: existingPrices } = await supabase
                .from('vip_pricing')
                .select('id')
                .eq('user_id', this.user.id)
                .eq('invitation_code', code.toUpperCase())
                .limit(1);
            
            if (existingPrices && existingPrices.length > 0) {
                console.log('ℹ️ Prix VIP déjà appliqués pour cet utilisateur');
                sessionStorage.removeItem('invitation_code');
                this.invitationCode = null;
                return { success: true, message: 'Déjà appliqué' };
            }
            
            // 3. CRÉER OU METTRE À JOUR LE PROFIL AVANT TOUTE CHOSE
            console.log('🔄 Vérification/création du profil...');
            
            // D'abord, vérifier si le profil existe
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('id, is_vip')
                .eq('id', this.user.id)
                .maybeSingle();
            
            if (!existingProfile) {
                console.log('📝 Création du profil VIP pour l'utilisateur...');
                
                // Structure pour votre table profiles (sans colonne email)
                const profileData = {
                    id: this.user.id,
                    full_name: this.user.user_metadata?.full_name || this.user.email.split('@')[0] || 'Utilisateur',
                    is_vip: true, // DIRECTEMENT À TRUE CAR C'EST UN CODE VIP
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
                    
                    // Tentative avec structure minimale
                    const minimalProfile = {
                        id: this.user.id,
                        full_name: this.user.user_metadata?.full_name || this.user.email.split('@')[0] || 'Utilisateur',
                        is_vip: true,
                        created_at: new Date().toISOString()
                    };
                    
                    const { error: minimalError } = await supabase
                        .from('profiles')
                        .insert(minimalProfile);
                        
                    if (minimalError) {
                        console.error('❌ Erreur même avec structure minimale:', minimalError);
                        this.showError('Erreur lors de la création du profil VIP: ' + minimalError.message);
                        return { success: false, error: minimalError.message };
                    }
                    
                    console.log('✅ Profil VIP créé avec structure minimale');
                } else {
                    console.log('✅ Profil VIP créé avec succès');
                }
            } else {
                // Le profil existe, mettre à jour pour le rendre VIP
                console.log('🔄 Mise à jour du profil existant: is_vip = true');
                
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ 
                        is_vip: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.user.id);
                
                if (profileError) {
                    console.error('⚠️ Erreur mise à jour profil VIP:', profileError);
                } else {
                    console.log('✅ Profil mis à jour : is_vip = true');
                }
            }
            
            // 4. Maintenant que le profil existe, copier les prix VIP
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
                this.showError('Erreur lors de l\'application des prix VIP: ' + insertError.message);
                return { success: false, error: insertError.message };
            }
            
            console.log(`✅ ${insertedPrices.length} prix VIP copiés pour l'utilisateur`);
            
            // 5. Recharger le profil pour mettre à jour this.user
            await this.loadUserProfile();
            
            // 6. Nettoyer
            sessionStorage.removeItem('invitation_code');
            this.invitationCode = null;
            
            // 7. Afficher message de succès
            this.showSuccess(`🎉 Bienvenue en tant que membre VIP ! Vous bénéficiez de ${insertedPrices.length} prix préférentiels.`);
            
            // 8. Émettre événement
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
            this.showError('Une erreur est survenue lors de l\'application du code');
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
            console.log('❌ Pas d'utilisateur à charger');
            return;
        }
        
        console.log('📋 Chargement du profil pour:', this.user.email);
        
        if (!this.supabaseReady) {
            console.warn('⚠️ Supabase non prêt, utilisation métadonnées');
            this.saveUserToStorage();
            return;
        }
        
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', this.user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.warn('Erreur chargement profil:', error);
                if (error.code === 'PGRST116') {
                    await this.createUserProfile();
                }
            } else if (profile) {
                console.log('✅ Profil chargé:', profile);
                this.user.profile = profile;
                
                // Ajouter l'email au profil pour l'interface (colonne absente dans la table)
                if (this.user.email) {
                    this.user.profile.email = this.user.email;
                }
                
                if (profile.is_vip) {
                    console.log('👑 Utilisateur VIP');
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
            // Structure qui correspond à VOTRE table profiles (sans colonne email)
            const profileData = {
                id: this.user.id,
                full_name: this.user.user_metadata?.full_name || this.user.email.split('@')[0] || 'Utilisateur',
                // NOTE: email n'est PAS inclus car il n'existe pas dans votre table
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
                // Tentative avec structure minimale si erreur
                const minimalProfile = {
                    id: this.user.id,
                    full_name: this.user.user_metadata?.full_name || this.user.email.split('@')[0] || 'Utilisateur',
                    created_at: new Date().toISOString()
                };
                
                const { error: minimalError } = await supabase
                    .from('profiles')
                    .insert(minimalProfile);
                    
                if (minimalError) {
                    console.error('❌ Erreur même avec structure minimale:', minimalError);
                } else {
                    console.log('✅ Profil créé avec structure minimale');
                    await this.loadUserProfile();
                }
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
        console.log('⏳ Attente de Supabase...');
        
        return new Promise(async (resolve) => {
            try {
                const initialized = await window.supabaseInitialized;
                this.supabaseReady = initialized;
                
                if (initialized && window.supabase?.auth?.getSession) {
                    console.log('✅ Supabase initialisé');
                    resolve();
                    return;
                }
            } catch (error) {
                console.warn('⚠️ Erreur supabaseInitialized:', error);
            }

            let attempts = 0;
            const maxAttempts = 150;
            
            const checkSupabase = async () => {
                attempts++;
                
                if (attempts % 10 === 0) {
                    console.log(`Vérification Supabase ${attempts}/${maxAttempts}`);
                }
                
                if (window.supabase?.auth?.getSession) {
                    try {
                        await window.supabase.auth.getSession();
                        this.supabaseReady = true;
                        console.log('✅ Supabase prêt et fonctionnel');
                        resolve();
                        return;
                    } catch (err) {
                        console.warn('⚠️ Supabase existe mais erreur:', err.message);
                    }
                }
                
                if (attempts >= maxAttempts) {
                    console.warn('⚠️ Supabase non initialisé après 15s - mode dégradé');
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

            console.log('📝 Inscription en cours pour:', email);

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
                console.log('✅ Utilisateur créé dans auth.users:', data.user.id);
                
                // ÉTAPE 1 : Créer le profil IMMÉDIATEMENT (avec votre structure)
                try {
                    console.log('📋 Création du profil...');
                    
                    // Structure pour votre table profiles (sans colonne email)
                    const profileData = {
                        id: data.user.id,
                        full_name: fullName || email.split('@')[0],
                        is_vip: false,  // On met false pour l'instant
                        preferred_currency: 'EUR',
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };

                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert(profileData);

                    if (profileError) {
                        console.error('❌ Erreur création profil:', profileError);
                        
                        // Tentative avec structure minimale
                        const minimalProfile = {
                            id: data.user.id,
                            full_name: fullName || email.split('@')[0],
                            created_at: new Date().toISOString()
                        };
                        
                        const { error: minimalError } = await supabase
                            .from('profiles')
                            .insert(minimalProfile);
                            
                        if (minimalError) {
                            console.error('❌ Erreur même avec structure minimale:', minimalError);
                        } else {
                            console.log('✅ Profil créé avec structure minimale');
                        }
                    } else {
                        console.log('✅ Profil créé avec succès');
                    }
                } catch (profileErr) {
                    console.error('❌ Exception création profil:', profileErr);
                }
                
                // ÉTAPE 2 : Appliquer le code VIP si présent
                const invitationCode = this.invitationCode || sessionStorage.getItem('invitation_code');
                
                if (invitationCode) {
                    console.log('🎟️ Code VIP détecté lors de l'inscription:', invitationCode);
                    
                    // Attendre un peu que le profil soit bien créé
                    await new Promise(resolve => setTimeout(resolve, 800));
                    
                    // Créer un objet user temporaire pour applyInvitationCode
                    const tempUser = {
                        id: data.user.id,
                        email: email,
                        user_metadata: { full_name: fullName }
                    };
                    
                    // Sauvegarder temporairement
                    const oldUser = this.user;
                    this.user = tempUser;
                    
                    // Appliquer le code
                    const result = await this.applyInvitationCode(invitationCode);
                    
                    // Restaurer
                    this.user = oldUser;
                    
                    if (result.success) {
                        console.log('✅ Code VIP appliqué automatiquement lors de l'inscription');
                    } else {
                        console.warn('⚠️ Échec application code VIP:', result.error);
                    }
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
            
            // Appliquer code VIP si présent
            await this.applyPendingInvitation();
            
            const returnUrl = this.getReturnUrl();
            
            console.log('🔗 URL de redirection après login:', returnUrl);
            
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
        console.log('🔄 Détermination de l\'URL de redirection...');
        
        const urlParams = new URLSearchParams(window.location.search);
        let returnUrl = urlParams.get('redirect');
        
        if (returnUrl) {
            returnUrl = decodeURIComponent(returnUrl);
            console.log('🔍 URL de redirection brute détectée:', returnUrl);
            
            // CORRECTION IMPORTANTE : Gestion des URLs sans extension .html
            // Cette fonction corrige les URLs comme "/dashboard" en "/dashboard.html"
            
            // Vérifier si c'est une URL complète
            try {
                const urlObj = new URL(returnUrl);
                const pathname = urlObj.pathname;
                const search = urlObj.search;
                
                console.log('📊 Analyse URL complète:', {
                    origin: urlObj.origin,
                    pathname: pathname,
                    search: search
                });
                
                // Liste des chemins connus qui nécessitent .html
                const knownPaths = ['dashboard', 'profile', 'booking', 'login', 'signup', 'reset-password', 'index'];
                
                // Extraire le dernier segment du chemin
                const pathSegments = pathname.split('/').filter(segment => segment);
                const lastSegment = pathSegments[pathSegments.length - 1];
                
                console.log('📝 Dernier segment du chemin:', lastSegment);
                
                // Si le dernier segment est un chemin connu et n'a pas d'extension
                if (knownPaths.includes(lastSegment) && !lastSegment.includes('.')) {
                    // Reconstruire le chemin avec .html
                    const newPathname = pathname.endsWith('/') ? 
                        `${pathname}${lastSegment}.html` : 
                        `${pathname}.html`;
                    
                    const correctedUrl = `${urlObj.origin}${newPathname}${search}`;
                    console.log('✅ URL corrigée avec .html:', correctedUrl);
                    
                    // Vérifier si cette URL existe (optionnel, pour éviter les 404)
                    // Pour Cloudflare Pages, nous faisons confiance que le fichier existe
                    
                    return correctedUrl;
                }
                
                // Si l'URL se termine déjà par .html, la garder telle quelle
                if (pathname.endsWith('.html')) {
                    console.log('✅ URL a déjà .html, on garde:', returnUrl);
                    return returnUrl;
                }
                
            } catch (e) {
                // Ce n'est pas une URL valide, peut-être un chemin relatif
                console.log('⚠️ URL invalide ou chemin relatif:', returnUrl);
                
                // Vérifier si c'est un chemin relatif simple
                const knownPaths = ['dashboard', 'profile', 'booking', 'login', 'signup', 'reset-password', 'index'];
                
                // Si le chemin ne contient pas de point et n'a pas de slash au début
                if (!returnUrl.includes('.') && !returnUrl.startsWith('/')) {
                    if (knownPaths.includes(returnUrl)) {
                        const correctedUrl = `${returnUrl}.html`;
                        console.log('✅ Chemin relatif corrigé:', correctedUrl);
                        return correctedUrl;
                    }
                }
                
                // Si le chemin commence par / mais n'a pas d'extension
                if (returnUrl.startsWith('/') && !returnUrl.includes('.')) {
                    const lastSegment = returnUrl.split('/').pop();
                    if (knownPaths.includes(lastSegment)) {
                        const correctedUrl = `${returnUrl}.html`;
                        console.log('✅ Chemin absolu corrigé:', correctedUrl);
                        return correctedUrl;
                    }
                }
            }
            
            console.log('✅ URL gardée telle quelle (déjà correcte):', returnUrl);
            return returnUrl;
        }
        
        // Vérifier le paramètre 'return' (alternative)
        returnUrl = urlParams.get('return');
        if (returnUrl) {
            const decodedUrl = decodeURIComponent(returnUrl);
            console.log('🔍 URL de retour détectée:', decodedUrl);
            return decodedUrl;
        }
        
        // Vérifier le référent
        const referrer = document.referrer;
        if (referrer && 
            !referrer.includes('login.html') && 
            !referrer.includes('signup.html') &&
            !referrer.includes('reset-password.html')) {
            console.log('🔍 Référent détecté:', referrer);
            
            // Appliquer la même correction au référent si nécessaire
            try {
                const urlObj = new URL(referrer);
                const pathname = urlObj.pathname;
                
                // Vérifier si c'est une page connue sans .html
                const knownPaths = ['dashboard', 'profile', 'booking'];
                const pathSegments = pathname.split('/').filter(segment => segment);
                const lastSegment = pathSegments[pathSegments.length - 1];
                
                if (knownPaths.includes(lastSegment) && !lastSegment.includes('.')) {
                    const correctedPathname = pathname.endsWith('/') ? 
                        `${pathname}${lastSegment}.html` : 
                        `${pathname}.html`;
                    
                    const correctedUrl = `${urlObj.origin}${correctedPathname}`;
                    console.log('✅ Référent corrigé:', correctedUrl);
                    return correctedUrl;
                }
            } catch (e) {
                // Erreur de parsing, on garde le référent tel quel
            }
            
            return referrer;
        }
        
        // Par défaut, rediriger vers le dashboard
        const defaultUrl = 'dashboard.html';
        console.log('🔗 URL par défaut:', defaultUrl);
        return defaultUrl;
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
            console.log('🚪 Déconnexion en cours...');
            
            if (this.supabaseReady && supabase && supabase.auth) {
                const { error } = await supabase.auth.signOut();
                if (error) {
                    console.warn('⚠️ Erreur lors de la déconnexion Supabase:', error);
                    // On continue quand même avec la déconnexion locale
                }
            }
            
            this.user = null;
            this.removeUserFromStorage();
            this.updateUI();
            
            // Événement : déconnexion
            this.emitAuthEvent('logout');
            
            console.log('✅ Utilisateur déconnecté, redirection vers index.html');
            
            // Redirection vers la page d'accueil après un court délai
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 300);
            
            return { success: true };
        } catch (error) {
            console.error('Erreur déconnexion:', error);
            this.user = null;
            this.removeUserFromStorage();
            this.updateUI();
            
            // Événement : déconnexion même en cas d'erreur
            this.emitAuthEvent('logout');
            
            // Redirection même en cas d'erreur
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 300);
            
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
            
            // Chercher d'abord le prix exact pour cette durée
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
                console.log('✅ Prix VIP exact trouvé:', data);
                
                return {
                    price: parseFloat(data.price),
                    currency: data.currency,
                    duration: data.duration_minutes,
                    isExact: true
                };
            }

            // Si pas de prix exact, chercher le prix pour 60min et ajuster
            console.log(`ℹ️ Pas de prix exact pour ${durationInt}min, recherche 60min...`);
            
            const { data: data60, error: error60 } = await supabase
                .from('vip_pricing')
                .select('price, currency')
                .eq('user_id', this.user.id)
                .eq('course_type', courseType)
                .eq('duration_minutes', 60)
                .maybeSingle();

            if (error60) {
                console.warn('⚠️ Erreur recherche prix 60min:', error60);
                return null;
            }

            if (data60) {
                // Ajuster le prix selon la durée
                const basePrice = parseFloat(data60.price);
                const adjustedPrice = basePrice * (durationInt / 60);
                
                console.log(`📏 Prix ajusté: ${basePrice}${data60.currency} (60min) → ${adjustedPrice.toFixed(2)}${data60.currency} (${durationInt}min)`);
                
                return {
                    price: adjustedPrice,
                    currency: data60.currency,
                    duration: durationInt,
                    isExact: false,
                    basePrice: basePrice,
                    baseDuration: 60
                };
            }

            console.log(`ℹ️ Aucun prix VIP trouvé pour ${courseType}`);
            return null;
            
        } catch (error) {
            console.warn('Exception lors de la récupération du prix VIP:', error);
            return null;
        }
    }

    async loadVipPrices() {
        if (!this.supabaseReady || !window.supabase || !this.user) {
            return;
        }

        try {
            console.log('👑 Chargement des prix VIP pour l'utilisateur:', this.user.id);
            
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

    // MÉTHODE : Sauvegarder les données de réservation - VERSION CORRIGÉE POUR VOTRE SCHÉMA
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
            
            // STRUCTURE CORRIGÉE selon votre table 'bookings' - UNIQUEMENT les colonnes existantes
            const bookingRecord = {
                user_id: this.user.id,
                course_type: bookingData.courseType,
                duration_minutes: bookingData.duration || 60,
                start_time: bookingData.startTime,
                end_time: bookingData.endTime,
                price_paid: bookingData.price,
                currency: bookingData.currency,
                // CORRECTION : Utiliser les valeurs autorisées par la contrainte CHECK
                platform: this.getPlatformName(bookingData.location),
                status: bookingData.status || 'pending',
                booking_number: bookingNumber,
                payment_method: bookingData.paymentMethod,
                payment_reference: bookingData.transactionId,
                created_at: new Date().toISOString()
            };

            // IMPORTANT : Les colonnes suivantes n'existent PAS dans votre schéma et ont été RETIRÉES :
            // - is_vip_booking
            // - original_price
            // - original_currency
            // - package_quantity
            // - discount_percent
            
            console.log('💾 Insertion dans bookings avec structure corrigée:', bookingRecord);
            
            const { error } = await supabase
                .from('bookings')
                .insert(bookingRecord);

            if (error) {
                console.error('❌ Erreur sauvegarde réservation:', error);
                return { success: false, error: error.message };
            }

            return { success: true, booking_number: bookingNumber };
        } catch (error) {
            console.error('Exception sauvegarde réservation:', error);
            return { success: false, error: error.message };
        }
    }

    // CORRECTION : Utiliser les valeurs autorisées par la contrainte CHECK
    getPlatformName(location) {
        if (!location) return 'zoom'; // valeur par défaut
        
        // Convertir les valeurs Cal.com en valeurs autorisées par la contrainte CHECK
        if (location.includes('google')) return 'meet';      // 'meet' pour Google Meet
        if (location.includes('teams')) return 'teams';     // 'teams' pour Microsoft Teams
        if (location.includes('zoom')) return 'zoom';       // 'zoom' pour Zoom
        
        // Pour les autres plateformes ou valeurs inconnues
        return 'other'; // valeur autorisée par la contrainte
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
    console.log('✅ Événement global auth:login reçu', e.detail?.user?.email || 'sans email');
});

window.addEventListener('auth:logout', function() {
    console.log('⚠️ Événement global auth:logout reçu');
});

// Événement pour les codes VIP
window.addEventListener('vip:applied', function(e) {
    console.log('🎉 Code VIP appliqué:', e.detail.code);
});

// Fonction de diagnostic des problèmes de base de données
window.diagnoseBookingIssues = async function() {
    console.group('🔍 DIAGNOSTIC DES RÉSERVATIONS');
    
    if (!window.supabase) {
        console.error('❌ Supabase non initialisé');
        console.groupEnd();
        return;
    }
    
    const user = window.authManager?.getCurrentUser();
    if (!user) {
        console.error('❌ Utilisateur non connecté');
        console.groupEnd();
        return;
    }
    
    try {
        // Vérifier la table bookings
        const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (bookingsError) {
            console.error('❌ Erreur accès à bookings:', bookingsError.message);
        } else {
            console.log(`📋 ${bookings.length} réservation(s) trouvée(s) dans bookings:`);
            bookings.forEach((b, i) => {
                console.log(`  ${i+1}. ${b.booking_number} - ${b.course_type} - ${b.status} - ${b.price_paid} ${b.currency}`);
            });
        }
        
        // Vérifier la table packages
        const { data: packages, error: packagesError } = await supabase
            .from('packages')
            .select('*')
            .eq('user_id', user.id)
            .order('purchased_at', { ascending: false });
        
        if (packagesError) {
            console.error('❌ Erreur accès à packages:', packagesError.message);
        } else {
            console.log(`📦 ${packages.length} package(s) trouvé(s) pour l'utilisateur:`);
            packages.forEach((p, i) => {
                console.log(`  ${i+1}. ${p.course_type} - ${p.remaining_credits}/${p.total_credits} crédits - ${p.status} - Expire: ${new Date(p.expires_at).toLocaleDateString()}`);
            });
        }
        
        // Vérifier la table credit_transactions
        const { data: transactions, error: transactionsError } = await supabase
            .from('credit_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (transactionsError) {
            console.error('❌ Erreur accès à credit_transactions:', transactionsError.message);
        } else {
            console.log(`💳 ${transactions.length} transaction(s) de crédit trouvée(s):`);
            transactions.forEach((t, i) => {
                console.log(`  ${i+1}. ${t.transaction_type} - ${t.credits_change} crédits - ${t.reason}`);
            });
        }
        
        // Vérifier le profil
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (profileError) {
            console.error('❌ Erreur accès au profil:', profileError.message);
        } else {
            console.log(`👤 Profil trouvé: ${profile.full_name} - VIP: ${profile.is_vip}`);
        }
        
    } catch (error) {
        console.error('❌ Erreur diagnostic:', error);
    }
    
    console.groupEnd();
};

document.addEventListener('DOMContentLoaded', function() {
    const isAuthPage = window.location.pathname.includes('login.html') || 
                      window.location.pathname.includes('signup.html');
    
    const isDashboardPage = window.location.pathname.includes('dashboard.html') ||
                           window.location.pathname.includes('profile.html');
    
    // Délai adaptatif selon le device
    const delay = window.innerWidth <= 768 ? 500 : 100;
    
    setTimeout(() => {
        console.log('🚀 Initialisation de AuthManager...');
        window.authManager = new AuthManager();
        
        if (isDashboardPage) {
            setTimeout(() => {
                if (!window.authManager.isAuthenticated()) {
                    const currentUrl = encodeURIComponent(window.location.href);
                    window.location.href = `login.html?redirect=${currentUrl}`;
                }
            }, 1000);
        }
        
        // Lancer un diagnostic automatique après 5 secondes
        setTimeout(() => {
            console.log('🧪 Lancement du diagnostic automatique...');
            if (window.diagnoseBookingIssues) {
                window.diagnoseBookingIssues();
            }
        }, 5000);
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
                console.log(`  ✅ ${duration}min: ${price.price} ${price.currency}`);
                // Tester la conversion si currencyManager est disponible
                if (window.currencyManager) {
                    const converted = window.currencyManager.convertVIPPrice(price);
                    if (converted) {
                        console.log(`    → ${converted.display}`);
                    }
                }
            } else {
                console.log(`  ❌ ${duration}min: non trouvé`);
            }
        }
    }
    
    console.groupEnd();
};

console.log('✅ auth.js chargé avec système de codes d\'invitation VIP - Version finale corrigée pour votre schéma');