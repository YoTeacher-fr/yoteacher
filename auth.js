// Gestion de l'authentification avec gestion des paiements et codes VIP
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
            
            // 3. Copier TOUS les prix VIP template pour cet utilisateur
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
                this.showError('Erreur lors de l\'application des prix VIP');
                return { success: false, error: insertError.message };
            }
            
            console.log(`✅ ${insertedPrices.length} prix VIP copiés pour l'utilisateur`);
            
            // 4. Mettre à jour le profil → is_vip = true
            console.log('🔄 Mise à jour du profil : is_vip = true');
            
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
            console.log('❌ Pas d\'utilisateur à charger');
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
                
                // ÉTAPE 1 : Créer le profil IMMÉDIATEMENT
                try {
                    console.log('📋 Création du profil...');
                    
                    const { error: profile