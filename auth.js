// Gestion de l'authentification
class AuthManager {
    constructor() {
        this.user = null;
        this.supabaseReady = false;
        this.init();
    }

    async init() {
        // Attendre que Supabase soit prêt
        await this.waitForSupabase();
        
        // Vérifier la session existante
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            this.user = session.user;
            this.updateUI();
        }

        // Écouter les changements d'authentification
        supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                this.user = session.user;
                this.updateUI();
            } else {
                this.user = null;
                this.updateUI();
            }
        });
    }

    async waitForSupabase() {
        return new Promise((resolve) => {
            const checkSupabase = () => {
                if (window.supabase && window.supabase.auth) {
                    this.supabaseReady = true;
                    resolve();
                } else {
                    setTimeout(checkSupabase, 100);
                }
            };
            
            checkSupabase();
            
            // Timeout après 10 secondes
            setTimeout(() => {
                if (!this.supabaseReady) {
                    console.error('Supabase non initialisé après 10 secondes');
                    resolve();
                }
            }, 10000);
        });
    }

    // Inscription
    async signUp(email, password, fullName) {
        try {
            if (!this.supabaseReady) {
                throw new Error('Supabase non initialisé');
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        created_at: new Date().toISOString()
                    }
                }
            });

            if (error) throw error;

            // Créer le profil utilisateur
            if (data.user) {
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

                if (profileError) console.warn(profileError);
            }

            return { success: true, data };
        } catch (error) {
            console.error('Erreur inscription:', error);
            return { success: false, error: error.message };
        }
    }

    // Connexion
    async signIn(email, password) {
        try {
            if (!this.supabaseReady) {
                throw new Error('Supabase non initialisé');
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erreur connexion:', error);
            return { success: false, error: error.message };
        }
    }

    // Déconnexion
    async signOut() {
        try {
            if (!this.supabaseReady) {
                throw new Error('Supabase non initialisé');
            }

            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            this.user = null;
            this.updateUI();
            return { success: true };
        } catch (error) {
            console.error('Erreur déconnexion:', error);
            return { success: false, error: error.message };
        }
    }

    // Mettre à jour l'interface
    updateUI() {
        const user = this.user;
        
        // Mettre à jour le header
        const loginButtons = document.querySelectorAll('.login-btn, .mobile-login-btn-header');
        const dashboardLinks = document.querySelectorAll('.btn-secondary[href="#"]');
        
        if (user) {
            // Utilisateur connecté
            loginButtons.forEach(btn => {
                btn.textContent = 'Dashboard';
                btn.href = 'dashboard.html';
                btn.classList.add('connected');
            });
            
            dashboardLinks.forEach(link => {
                link.textContent = 'Mon dashboard';
                link.href = 'dashboard.html';
            });
            
            // Ajouter avatar si possible
            this.addUserAvatar();
        } else {
            // Utilisateur non connecté
            loginButtons.forEach(btn => {
                btn.textContent = 'Connexion';
                btn.href = 'login.html';
                btn.classList.remove('connected');
            });
            
            dashboardLinks.forEach(link => {
                link.textContent = 'Créer un compte gratuit';
                link.href = 'signup.html';
            });
            
            this.removeUserAvatar();
        }
    }

    addUserAvatar() {
        // Retirer l'avatar existant
        this.removeUserAvatar();
        
        const header = document.querySelector('.header-content');
        if (!header || !this.user) return;
        
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.innerHTML = `
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(this.user.email)}&background=3c84f6&color=fff" 
                 alt="Avatar" 
                 class="avatar-img">
            <div class="user-menu">
                <a href="dashboard.html">Mon dashboard</a>
                <a href="#" class="logout-btn">Déconnexion</a>
            </div>
        `;
        
        const nav = document.querySelector('.nav-menu');
        if (nav) {
            nav.appendChild(avatar);
            
            // Gérer la déconnexion
            avatar.querySelector('.logout-btn').addEventListener('click', (e) => {
                e.preventDefault();
                this.signOut().then(() => {
                    window.location.href = 'index.html';
                });
            });
        }
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
}

// Initialiser l'authentification
window.authManager = new AuthManager();