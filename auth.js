// ===== AUTH MANAGER - VERSION DÉTERMINISTE =====
// Principe : UN SEUL état, UN SEUL point de rendu, ZÉRO manipulation directe du DOM

class AuthManager {
    constructor() {
        this.user = null;
        this.supabaseReady = false;
        this.pendingPayment = null;
        this.invitationCode = null;
        this.init();
    }

    async init() {
        console.log('🔍 Initialisation AuthManager...');
        
        try {
            this.checkInvitationCode();
            
            // Synchroniser avec localStorage
            this.syncFromLocalStorage();
            
            // Rendre l'UI initiale
            this.render();
            
            // Attendre Supabase
            await this.waitForSupabase();
            
            if (!this.supabaseReady) {
                console.warn('⚠️ Mode dégradé : Supabase non disponible');
                return;
            }

            console.log('✅ Supabase prêt');
            
            // Vérifier la session
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
                console.warn('⚠️ Erreur getSession:', error.message);
            }
            
            if (session) {
                this.user = session.user;
                await this.loadUserProfile();
                this.saveUserToStorage();
                this.render();
                this.emitAuthEvent('login', this.user);
                console.log('✅ Session restaurée:', this.user.email);
            } else {
                console.log('ℹ️ Aucune session active');
            }

            // Écouter les changements d'état
            supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('🔄 Auth state changed:', event);
                
                if (session) {
                    this.user = session.user;
                    await this.loadUserProfile();
                    this.saveUserToStorage();
                    this.render();
                    this.emitAuthEvent('login', this.user);
                    await this.applyPendingInvitation();
                } else {
                    this.user = null;
                    this.removeUserFromStorage();
                    this.render();
                    this.emitAuthEvent('logout');
                }
            });
            
        } catch (error) {
            console.error('❌ Erreur init auth:', error);
        }
    }

    // ===== MÉTHODE CENTRALE DE RENDU =====
    // Cette méthode est LA SEULE à modifier l'UI
    render() {
        const isAuthenticated = this.isAuthenticated();
        const isDashboardPage = window.location.pathname.includes('dashboard.html');
        
        console.log('🎨 Render auth buttons - Authenticated:', isAuthenticated);
        
        // Ajouter/retirer la classe globale sur le body
        if (isAuthenticated) {
            document.body.classList.add('user-authenticated');
            document.body.classList.remove('user-not-authenticated');
        } else {
            document.body.classList.add('user-not-authenticated');
            document.body.classList.remove('user-authenticated');
        }
        
        // Mettre à jour les boutons
        if (isAuthenticated) {
            this.renderAuthenticatedState(isDashboardPage);
        } else {
            this.renderUnauthenticatedState();
        }
        
        // Mettre à jour les autres éléments de l'UI
        this.updatePageButtons();
    }

    renderAuthenticatedState(isDashboardPage) {
        // Desktop : remplacer bouton login par avatar/dashboard
        const desktopLoginBtn = document.querySelector('.header-right-group .login-btn');
        if (desktopLoginBtn && !isDashboardPage) {
            // Vérifier si l'avatar existe déjà
            if (!document.querySelector('.header-right-group .user-avatar')) {
                this.createUserAvatar(desktopLoginBtn);
            }
        }
        
        // Mobile : remplacer bouton login par dashboard
        const mobileLoginBtn = document.querySelector('.mobile-header-right-group .mobile-login-btn-header');
        if (mobileLoginBtn && !isDashboardPage) {
            // Vérifier si le bouton dashboard existe déjà
            if (!document.querySelector('.mobile-header-right-group .mobile-dashboard-btn')) {
                this.createMobileDashboardBtn(mobileLoginBtn);
            }
        }
    }

    renderUnauthenticatedState() {
        // Desktop : restaurer le bouton login
        const userAvatar = document.querySelector('.header-right-group .user-avatar');
        if (userAvatar) {
            this.removeUserAvatar();
        }
        
        // Mobile : restaurer le bouton login
        const mobileDashboardBtn = document.querySelector('.mobile-header-right-group .mobile-dashboard-btn');
        if (mobileDashboardBtn) {
            this.removeMobileDashboardBtn();
        }
    }

    // ===== CRÉATION DES ÉLÉMENTS UI =====
    createUserAvatar(loginBtn) {
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        
        const initials = this.getUserInitials();
        
        avatar.innerHTML = `
            <a href="dashboard.html" class="dashboard-btn">
                <div class="avatar-img">${initials}</div>
                <span>Dashboard</span>
                <button class="logout-btn-icon" type="button" title="Déconnexion">×</button>
            </a>
        `;
        
        // Remplacer le bouton login par l'avatar
        loginBtn.replaceWith(avatar);
        
        // Attacher les événements
        const logoutBtn = avatar.querySelector('.logout-btn-icon');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
                    this.signOut();
                }
            });
        }
        
        const dashboardBtn = avatar.querySelector('.dashboard-btn');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', (e) => {
                if (e.target.closest('.logout-btn-icon')) {
                    return;
                }
                e.preventDefault();
                window.location.href = 'dashboard.html';
            });
        }
    }

    removeUserAvatar() {
        const avatar = document.querySelector('.header-right-group .user-avatar');
        if (avatar) {
            // Recréer le bouton login
            const loginBtn = document.createElement('a');
            loginBtn.href = 'login.html';
            loginBtn.className = 'login-btn';
            loginBtn.textContent = 'Connexion';
            loginBtn.setAttribute('data-i18n', 'header.login');
            
            avatar.replaceWith(loginBtn);
        }
    }

    createMobileDashboardBtn(loginBtn) {
        const dashboardBtn = document.createElement('a');
        dashboardBtn.href = 'dashboard.html';
        dashboardBtn.className = 'mobile-dashboard-btn';
        
        const initials = this.getUserInitials();
        dashboardBtn.innerHTML = `
            <div class="avatar-img">${initials}</div>
            <span>Dashboard</span>
        `;
        
        // Remplacer le bouton login
        loginBtn.replaceWith(dashboardBtn);
    }

    removeMobileDashboardBtn() {
        const dashboardBtn = document.querySelector('.mobile-header-right-group .mobile-dashboard-btn');
        if (dashboardBtn) {
            // Recréer le bouton login
            const loginBtn = document.createElement('a');
            loginBtn.href = 'login.html';
            loginBtn.className = 'mobile-login-btn-header';
            loginBtn.textContent = 'Connexion';
            loginBtn.setAttribute('data-i18n', 'header.login');
            
            dashboardBtn.replaceWith(loginBtn);
        }
    }

    // ===== MISE À JOUR DES BOUTONS DE PAGE =====
    updatePageButtons() {
        const isIndexPage = window.location.pathname.includes('index.html') || 
                           window.location.pathname === '/' || 
                           window.location.pathname.endsWith('/');
        const isDashboardPage = window.location.pathname.includes('dashboard.html');
        
        // Ne pas modifier les boutons sur index.html et dashboard.html
        if (isIndexPage || isDashboardPage) {
            return;
        }
        
        // Mettre à jour les boutons "Créer un compte" -> "Dashboard"
        if (this.isAuthenticated()) {
            this.updateAllButtonsForConnectedUser();
        } else {
            this.restoreAllButtonsForDisconnectedUser();
        }
    }

    updateAllButtonsForConnectedUser() {
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

    // ===== UTILITAIRES =====
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

    isAuthenticated() {
        return !!this.user;
    }

    getCurrentUser() {
        return this.user;
    }

    // ===== SYNCHRONISATION LOCALSTORAGE =====
    syncFromLocalStorage() {
        const storedUser = localStorage.getItem('yoteacher_user');
        if (storedUser && !this.user) {
            try {
                this.user = JSON.parse(storedUser);
                console.log('✅ Utilisateur synchronisé depuis localStorage');
            } catch (error) {
                console.error('❌ Erreur synchronisation:', error);
            }
        }
    }

    saveUserToStorage() {
        if (this.user) {
            const userToSave = {
                ...this.user,
                _timestamp: Date.now()
            };
            localStorage.setItem('yoteacher_user', JSON.stringify(userToSave));
            console.log('💾 Utilisateur sauvegardé');
        }
    }

    removeUserFromStorage() {
        localStorage.removeItem('yoteacher_user');
        console.log('🗑️ Utilisateur supprimé');
    }

    // ===== AUTHENTIFICATION =====
    async signIn(email, password) {
        try {
            if (!this.supabaseReady || !window.supabase) {
                return { success: false, error: 'Service indisponible' };
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('❌ Erreur signIn:', error);
                return { success: false, error: error.message };
            }

            if (data.user) {
                this.user = data.user;
                await this.loadUserProfile();
                this.saveUserToStorage();
                this.render();
                this.emitAuthEvent('login', this.user);
                
                return { 
                    success: true, 
                    user: data.user,
                    redirectUrl: 'dashboard.html'
                };
            }

            return { success: false, error: 'Connexion échouée' };
            
        } catch (error) {
            console.error('❌ Exception signIn:', error);
            return { success: false, error: error.message };
        }
    }

    async signUp(email, password, fullName) {
        try {
            if (!this.supabaseReady || !window.supabase) {
                return { success: false, error: 'Service indisponible' };
            }

            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) {
                console.error('❌ Erreur signUp:', error);
                return { success: false, error: error.message };
            }

            if (data.user) {
                this.user = data.user;
                await this.createUserProfile(fullName);
                this.saveUserToStorage();
                this.render();
                this.emitAuthEvent('login', this.user);
                
                return { 
                    success: true, 
                    user: data.user 
                };
            }

            return { success: false, error: 'Inscription échouée' };
            
        } catch (error) {
            console.error('❌ Exception signUp:', error);
            return { success: false, error: error.message };
        }
    }

    async signOut() {
        try {
            if (this.supabaseReady && window.supabase) {
                await supabase.auth.signOut();
            }
            
            this.user = null;
            this.removeUserFromStorage();
            this.render();
            this.emitAuthEvent('logout');
            
            console.log('✅ Déconnexion réussie');
            
            // Rediriger vers la page d'accueil
            if (!window.location.pathname.includes('index.html')) {
                window.location.href = 'index.html';
            }
            
        } catch (error) {
            console.error('❌ Erreur signOut:', error);
        }
    }

    // ===== GESTION DU PROFIL =====
    async loadUserProfile() {
        if (!this.supabaseReady || !window.supabase || !this.user) {
            return;
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', this.user.id)
                .maybeSingle();

            if (error) {
                console.warn('⚠️ Erreur chargement profil:', error);
                return;
            }

            if (data) {
                this.user.profile = data;
                console.log('✅ Profil chargé');
            }
        } catch (error) {
            console.error('❌ Exception profil:', error);
        }
    }

    async createUserProfile(fullName) {
        if (!this.supabaseReady || !window.supabase || !this.user) {
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .insert({
                    id: this.user.id,
                    full_name: fullName,
                    email: this.user.email,
                    is_vip: false,
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.warn('⚠️ Erreur création profil:', error);
            } else {
                console.log('✅ Profil créé');
            }
        } catch (error) {
            console.error('❌ Exception création profil:', error);
        }
    }

    // ===== ÉVÉNEMENTS =====
    emitAuthEvent(eventName, data = null) {
        const event = new CustomEvent(`auth:${eventName}`, { detail: data });
        window.dispatchEvent(event);
    }

    // ===== ATTENTE SUPABASE =====
    async waitForSupabase() {
        if (window.supabaseInitialized) {
            const ready = await window.supabaseInitialized;
            this.supabaseReady = ready;
            return ready;
        }
        
        // Fallback : attendre 3 secondes max
        let attempts = 0;
        while (!window.supabase && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        this.supabaseReady = !!window.supabase;
        return this.supabaseReady;
    }

    // ===== CODES VIP =====
    checkInvitationCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
            console.log('🎟️ Code VIP détecté:', code);
            this.invitationCode = code;
            sessionStorage.setItem('invitation_code', code);
            this.showInvitationNotification(code);
            return code;
        }
        
        const savedCode = sessionStorage.getItem('invitation_code');
        if (savedCode) {
            console.log('🎟️ Code VIP en attente:', savedCode);
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
        
        console.log('🎟️ Application code VIP:', code);
        await this.applyInvitationCode(code);
    }

    async applyInvitationCode(code) {
        if (!this.supabaseReady || !window.supabase || !this.user) {
            console.warn('⚠️ Impossible d\'appliquer le code VIP : Supabase ou utilisateur non disponible');
            return { success: false, error: 'Service non disponible' };
        }

        try {
            console.log('🎟️ Application du code VIP:', code);

            // 1. Vérifier que le code existe dans vip_pricing avec user_id = NULL (templates)
            const { data: vipTemplates, error: templateError } = await supabase
                .from('vip_pricing')
                .select('id, course_type, duration_minutes, price, currency, invitation_code')
                .is('user_id', null)
                .eq('invitation_code', code);

            if (templateError) {
                console.error('❌ Erreur recherche code VIP:', templateError);
                return { success: false, error: 'Erreur lors de la vérification du code' };
            }

            if (!vipTemplates || vipTemplates.length === 0) {
                console.warn('⚠️ Code VIP invalide:', code);
                return { success: false, error: 'Code VIP invalide' };
            }

            console.log('✅ Code VIP valide trouvé avec', vipTemplates.length, 'tarifs');

            // 2. Vérifier si l'utilisateur a déjà un code VIP appliqué
            const { data: existingVipPrices, error: checkError } = await supabase
                .from('vip_pricing')
                .select('id, invitation_code')
                .eq('user_id', this.user.id);

            if (checkError) {
                console.error('❌ Erreur vérification tarifs existants:', checkError);
                return { success: false, error: 'Erreur lors de la vérification' };
            }

            if (existingVipPrices && existingVipPrices.length > 0) {
                console.warn('⚠️ L\'utilisateur a déjà des tarifs VIP:', existingVipPrices[0].invitation_code);
                return { 
                    success: false, 
                    error: `Vous avez déjà un code VIP appliqué (${existingVipPrices[0].invitation_code || 'code inconnu'})` 
                };
            }

            // 3. METTRE À JOUR (UPDATE) les templates VIP en assignant l'user_id
            // C'est la correction principale : UPDATE au lieu de INSERT
            const { error: updateError } = await supabase
                .from('vip_pricing')
                .update({ user_id: this.user.id })
                .is('user_id', null)
                .eq('invitation_code', code);

            if (updateError) {
                console.error('❌ Erreur mise à jour tarifs VIP:', updateError);
                return { success: false, error: 'Erreur lors de l\'application du code VIP' };
            }

            console.log('✅ Tarifs VIP mis à jour avec user_id:', this.user.id);

            // 4. Mettre à jour le profil utilisateur pour le marquer comme VIP
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ is_vip: true })
                .eq('id', this.user.id);

            if (profileError) {
                console.error('❌ Erreur mise à jour profil VIP:', profileError);
                return { success: false, error: 'Erreur lors de l\'activation du statut VIP' };
            }

            console.log('✅ Profil utilisateur marqué comme VIP');

            // 5. Recharger le profil et nettoyer le code en attente
            await this.loadUserProfile();
            sessionStorage.removeItem('invitation_code');
            this.invitationCode = null;

            console.log('🎉 Code VIP appliqué avec succès !');
            
            return { success: true };

        } catch (error) {
            console.error('❌ Exception lors de l\'application du code VIP:', error);
            return { success: false, error: error.message };
        }
    }

    // Méthode de compatibilité
    isUserVip() {
        return this.user && this.user.profile && this.user.profile.is_vip === true;
    }
}

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initialisation AuthManager...');
    window.authManager = new AuthManager();
});

// ===== ÉCOUTEURS GLOBAUX =====
window.addEventListener('auth:login', function(e) {
    console.log('✅ Login:', e.detail?.user?.email || 'sans email');
});

window.addEventListener('auth:logout', function() {
    console.log('⚠️ Logout');
});

console.log('✅ auth.js chargé - Version déterministe');
