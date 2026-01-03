// Gestion de l'authentification
class AuthManager {
    constructor() {
        this.user = null;
        this.supabaseReady = false;
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
                    this.saveUserToStorage();
                    this.updateUI();
                }

                // Écouter les changements d'authentification
                supabase.auth.onAuthStateChange((event, session) => {
                    console.log('Auth state changed:', event, session);
                    if (session) {
                        this.user = session.user;
                        this.saveUserToStorage();
                        this.updateUI();
                    } else {
                        this.user = null;
                        this.removeUserFromStorage();
                        this.updateUI();
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

    async waitForSupabase() {
        return new Promise((resolve) => {
            // Si Supabase est déjà initialisé via supabase.js
            if (window.supabase && window.supabase.auth) {
                this.supabaseReady = true;
                resolve();
                return;
            }

            // Si nous avons une promesse d'initialisation
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

            // Fallback: polling pendant 10 secondes max
            let attempts = 0;
            const maxAttempts = 100; // 100 * 100ms = 10 secondes
            
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

    // Mode dégradé (hors ligne ou Supabase indisponible)
    setupDegradedMode() {
        // Récupérer l'utilisateur depuis le stockage local
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
        
        // Afficher un avertissement discret
        this.showDegradedModeWarning();
    }

    showDegradedModeWarning() {
        // Éviter les doublons
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
        
        // Ajouter l'animation CSS si nécessaire
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
        
        // Auto-suppression après 10 secondes
        setTimeout(() => {
            if (warning.parentElement) {
                warning.style.transition = 'all 0.3s ease';
                warning.style.opacity = '0';
                warning.style.transform = 'translateX(-50%) translateY(100%)';
                setTimeout(() => warning.remove(), 300);
            }
        }, 10000);
    }

    // Sauvegarder l'utilisateur dans le stockage local
    saveUserToStorage() {
        if (!this.user) {
            localStorage.removeItem('yoteacher_user');
            return;
        }
        
        // Ne stocker que les informations essentielles
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

    // Inscription
    async signUp(email, password, fullName) {
        try {
            if (!this.supabaseReady) {
                // Mode dégradé : simuler l'inscription
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

            // Créer le profil utilisateur
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

    // Inscription simulée pour le mode dégradé
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

    // Connexion
    async signIn(email, password) {
        try {
            if (!this.supabaseReady) {
                // Mode dégradé : simuler la connexion
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
            
            // Récupérer l'URL de redirection
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

    // Récupérer l'URL de redirection
    getReturnUrl() {
        // 1. Vérifier le paramètre d'URL 'redirect'
        const urlParams = new URLSearchParams(window.location.search);
        let returnUrl = urlParams.get('redirect');
        
        if (returnUrl) {
            return decodeURIComponent(returnUrl);
        }
        
        // 2. Vérifier le paramètre 'return' (alternative)
        returnUrl = urlParams.get('return');
        if (returnUrl) {
            return decodeURIComponent(returnUrl);
        }
        
        // 3. Vérifier le référent (d'où vient l'utilisateur)
        const referrer = document.referrer;
        if (referrer && 
            !referrer.includes('login.html') && 
            !referrer.includes('signup.html') &&
            !referrer.includes('reset-password.html')) {
            return referrer;
        }
        
        // 4. Par défaut : dashboard
        return 'dashboard.html';
    }

    // Connexion simulée pour le mode dégradé
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

    // Déconnexion
    async signOut() {
        try {
            if (this.supabaseReady && supabase && supabase.auth) {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
            }
            
            this.user = null;
            this.removeUserFromStorage();
            this.updateUI();
            
            // Redirection vers index.html avec scroll en haut
            window.location.href = 'index.html#top';
            
            // Forcer le scroll en haut après chargement
            window.addEventListener('load', function() {
                window.scrollTo(0, 0);
                if (!window.location.hash) {
                    window.location.hash = 'top';
                }
            });
            
            return { success: true };
        } catch (error) {
            console.error('Erreur déconnexion:', error);
            // Forcer la déconnexion locale même en cas d'erreur
            this.user = null;
            this.removeUserFromStorage();
            this.updateUI();
            
            window.location.href = 'index.html#top';
            return { success: true };
        }
    }

    // Mettre à jour l'interface
    updateUI() {
        const user = this.user;
        
        // 1. Tous les boutons de connexion dans le header
        const loginButtons = document.querySelectorAll(
            '.login-btn, ' +
            '.mobile-login-btn-header, ' +
            '.mobile-login-btn'
        );
        
        // 2. Tous les boutons "Créer un compte" dans le contenu
        const signupButtons = document.querySelectorAll(
            '.btn-secondary[href="#about"], ' +
            '.btn-secondary[href="signup.html"], ' +
            '.btn-outline-white[href="#"], ' +
            '.btn-outline-white[href="signup.html"], ' +
            '.btn-secondary, ' +
            '.btn-outline-white'
        );
        
        // 3. Boutons "Réserver cours d'essai"
        const bookingButtons = document.querySelectorAll(
            '.btn-primary[href*="booking"], ' +
            '.btn-accent[href*="booking"], ' +
            '.mobile-course-btn'
        );
        
        if (user) {
            // ========== UTILISATEUR CONNECTÉ ==========
            
            // 1. Boutons header -> "Dashboard"
            loginButtons.forEach(btn => {
                if (btn && btn.textContent) {
                    btn.textContent = 'Dashboard';
                    btn.href = 'dashboard.html';
                    btn.classList.add('connected');
                    
                    // S'assurer que le clic fonctionne
                    btn.onclick = (e) => {
                        e.preventDefault();
                        window.location.href = 'dashboard.html';
                    };
                }
            });
            
            // 2. Boutons "Créer un compte" -> "Mon dashboard"
            signupButtons.forEach(btn => {
                if (!btn || !btn.textContent) return;
                
                const text = btn.textContent.toLowerCase();
                if (text.includes('créer') || text.includes('creer') || 
                    (btn.href && (btn.href.includes('signup.html') || btn.href === '#' || btn.href === '#about'))) {
                    btn.textContent = 'Mon dashboard';
                    btn.href = 'dashboard.html';
                    
                    // Ajuster les classes CSS
                    if (btn.classList.contains('btn-outline-white')) {
                        btn.classList.remove('btn-outline-white');
                        btn.classList.add('btn-outline');
                    } else if (btn.classList.contains('btn-secondary')) {
                        btn.classList.remove('btn-secondary');
                        btn.classList.add('btn-primary');
                    }
                    
                    // S'assurer que le clic fonctionne
                    btn.onclick = (e) => {
                        e.preventDefault();
                        window.location.href = 'dashboard.html';
                    };
                }
            });
            
            // 3. Boutons "Réserver cours" -> "Réserver un cours"
            bookingButtons.forEach(btn => {
                if (!btn || !btn.textContent) return;
                
                const text = btn.textContent.toLowerCase();
                if (text.includes('réserver') || text.includes('essayer') || text.includes('reserver')) {
                    btn.textContent = 'Réserver un cours';
                    btn.href = 'booking.html';
                }
            });
            
            // 4. Ajouter avatar
            setTimeout(() => {
                this.addUserAvatar();
            }, 100);
            
        } else {
            // ========== UTILISATEUR NON CONNECTÉ ==========
            
            // 1. Boutons header -> "Connexion"
            loginButtons.forEach(btn => {
                if (btn && btn.textContent) {
                    btn.textContent = 'Connexion';
                    
                    // Ajouter le paramètre redirect si nécessaire
                    const currentUrl = encodeURIComponent(window.location.href);
                    let href = 'login.html';
                    
                    // Ne pas ajouter redirect si on est déjà sur une page d'auth
                    if (!window.location.pathname.includes('login.html') && 
                        !window.location.pathname.includes('signup.html')) {
                        const separator = href.includes('?') ? '&' : '?';
                        href = `${href}${separator}redirect=${currentUrl}`;
                    }
                    
                    btn.href = href;
                    btn.classList.remove('connected');
                    
                    // Réinitialiser l'événement onclick
                    btn.onclick = null;
                }
            });
            
            // 2. Boutons "Mon dashboard" -> "Créer un compte gratuit"
            signupButtons.forEach(btn => {
                if (!btn || !btn.textContent) return;
                
                const text = btn.textContent.toLowerCase();
                if (text.includes('dashboard') || text.includes('mon dashboard') ||
                    (btn.href && btn.href === 'dashboard.html')) {
                    btn.textContent = 'Créer un compte gratuit';
                    btn.href = 'signup.html';
                    
                    // Ajuster les classes CSS
                    if (btn.classList.contains('btn-outline')) {
                        btn.classList.remove('btn-outline');
                        btn.classList.add('btn-outline-white');
                    } else if (btn.classList.contains('btn-primary')) {
                        btn.classList.remove('btn-primary');
                        btn.classList.add('btn-secondary');
                    }
                    
                    // Réinitialiser l'événement onclick
                    btn.onclick = null;
                }
            });
            
            // 3. Boutons "Réserver un cours" -> "Réserver un cours d'essai"
            bookingButtons.forEach(btn => {
                if (!btn || !btn.textContent) return;
                
                if (btn.textContent === 'Réserver un cours') {
                    btn.textContent = "Réserver un cours d'essai";
                    btn.href = 'booking.html?type=essai';
                }
            });
            
            // 4. Retirer avatar
            this.removeUserAvatar();
        }
    }

    addUserAvatar() {
        // Retirer l'avatar existant
        this.removeUserAvatar();
        
        if (!this.user) return;
        
        const nav = document.querySelector('.nav-menu');
        if (!nav) return;
        
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.style.position = 'relative';
        avatar.style.marginLeft = '15px';
        
        // Récupérer les initiales
        const initials = this.getUserInitials();
        
        avatar.innerHTML = `
            <div class="avatar-img" style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #3c84f6, #1e88e5); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; cursor: pointer; border: 2px solid #3c84f6;">
                ${initials}
            </div>
            <div class="user-menu" style="display: none; position: absolute; top: 100%; right: 0; background: white; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); min-width: 180px; padding: 10px 0; z-index: 1000;">
                <a href="dashboard.html" style="display: block; padding: 10px 20px; color: #333; text-decoration: none;">Mon dashboard</a>
                <a href="profile.html" style="display: block; padding: 10px 20px; color: #333; text-decoration: none;">Mon profil</a>
                <a href="#" class="logout-btn" style="display: block; padding: 10px 20px; color: #e74c3c; text-decoration: none; border-top: 1px solid #eee; margin-top: 5px;">Déconnexion</a>
            </div>
        `;
        
        nav.appendChild(avatar);
        
        // Gérer la déconnexion
        const logoutBtn = avatar.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.signOut();
            });
        }
        
        // Gérer l'affichage du menu
        const avatarImg = avatar.querySelector('.avatar-img');
        const userMenu = avatar.querySelector('.user-menu');
        
        if (avatarImg && userMenu) {
            avatarImg.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = userMenu.style.display === 'block';
                userMenu.style.display = isVisible ? 'none' : 'block';
            });
            
            // Fermer le menu en cliquant ailleurs
            document.addEventListener('click', (e) => {
                if (!avatar.contains(e.target)) {
                    userMenu.style.display = 'none';
                }
            });
            
            // Prévenir la fermeture quand on clique dans le menu
            userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // S'assurer que les liens fonctionnent
        setTimeout(() => {
            const dashboardLink = avatar.querySelector('a[href="dashboard.html"]');
            const profileLink = avatar.querySelector('a[href="profile.html"]');
            
            if (dashboardLink) {
                dashboardLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.href = 'dashboard.html';
                });
            }
            
            if (profileLink) {
                profileLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.href = 'profile.html';
                });
            }
        }, 50);
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

    // Vérifier si connecté
    isAuthenticated() {
        return !!this.user;
    }

    // Obtenir l'utilisateur actuel
    getCurrentUser() {
        return this.user;
    }

    // Réinitialiser le mot de passe
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

    // Mettre à jour le mot de passe
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

    // Rafraîchir la session
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

    // Traduire les erreurs pour l'utilisateur
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
}

// Initialiser l'authentification lorsque le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    // Vérifier si nous sommes sur une page d'authentification
    const isAuthPage = window.location.pathname.includes('login.html') || 
                      window.location.pathname.includes('signup.html');
    
    // Vérifier si nous sommes sur le dashboard
    const isDashboardPage = window.location.pathname.includes('dashboard.html') ||
                           window.location.pathname.includes('profile.html');
    
    // Attendre un peu pour laisser le temps à supabase.js de s'initialiser
    setTimeout(() => {
        window.authManager = new AuthManager();
        
        // Vérifier l'authentification pour les pages protégées
        if (isDashboardPage) {
            setTimeout(() => {
                if (!window.authManager.isAuthenticated()) {
                    const currentUrl = encodeURIComponent(window.location.href);
                    window.location.href = `login.html?redirect=${currentUrl}`;
                }
            }, 500);
        }
        
        // Ajouter le paramètre redirect aux liens de connexion
        if (!isAuthPage) {
            setTimeout(() => {
                document.querySelectorAll('a[href*="login.html"]').forEach(link => {
                    if (!link.href.includes('redirect=')) {
                        const currentUrl = encodeURIComponent(window.location.href);
                        const separator = link.href.includes('?') ? '&' : '?';
                        link.href = `${link.href}${separator}redirect=${currentUrl}`;
                    }
                });
                
                document.querySelectorAll('a[href*="signup.html"]').forEach(link => {
                    if (!link.href.includes('redirect=')) {
                        const currentUrl = encodeURIComponent(window.location.href);
                        const separator = link.href.includes('?') ? '&' : '?';
                        link.href = `${link.href}${separator}redirect=${currentUrl}`;
                    }
                });
            }, 1000);
        }
    }, 100);
});

// Exporter pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager };
}