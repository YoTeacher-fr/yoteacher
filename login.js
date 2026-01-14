// login.js - Gestion de la page de connexion

(function() {
    // Fonctions d'aide locales
    function showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        const successDiv = document.getElementById('successMessage');
        
        if (errorText) {
            errorText.textContent = message;
        }
        if (errorDiv) {
            errorDiv.style.display = 'block';
        }
        if (successDiv) {
            successDiv.style.display = 'none';
        }
    }

    function showSuccess(message) {
        const successDiv = document.getElementById('successMessage');
        const successText = document.getElementById('successText');
        const errorDiv = document.getElementById('errorMessage');
        
        if (successText) {
            successText.textContent = message;
        }
        if (successDiv) {
            successDiv.style.display = 'block';
        }
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    function hideMessages() {
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
        if (successDiv) {
            successDiv.style.display = 'none';
        }
    }

    function preventHeaderLoginButtons() {
        const loginBtns = document.querySelectorAll('.login-btn, .mobile-login-btn-header');
        
        loginBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // Le bouton ne fait rien sur la page de connexion
                // car l'utilisateur est déjà sur la page de connexion
            });
        });
    }

    function setupLoginForm() {
        const form = document.getElementById('loginForm');
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        const errorText = document.getElementById('errorText');
        const successText = document.getElementById('successText');
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');

        // Vérifier si déjà connecté
        if (window.authManager?.isAuthenticated()) {
            window.location.href = 'dashboard.html';
        }
        
        // Empêcher le bouton du header de recharger la page
        preventHeaderLoginButtons();

        // Connexion
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // Validation basique
            if (!email || !password) {
                showError('Veuillez remplir tous les champs');
                return;
            }

            // Masquer les messages précédents
            hideMessages();

            // Afficher chargement
            const button = form.querySelector('button');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (window.translationManager?.getTranslation('login.loading') || 'Connexion en cours...');
            button.disabled = true;

            try {
                const result = await window.authManager.signIn(email, password);
                
                if (result.success) {
                    showSuccess(window.translationManager?.getTranslation('login.success') || 'Connexion réussie ! Redirection...');
                    
                    // Utiliser le redirectUrl de la réponse
                    const redirectUrl = result.redirectUrl || 'dashboard.html';
                    
                    setTimeout(() => {
                        window.location.href = redirectUrl;
                    }, 1500);
                } else {
                    showError(result.error || 'Erreur de connexion');
                    button.innerHTML = originalText;
                    button.disabled = false;
                }
            } catch (error) {
                showError('Une erreur est survenue : ' + error.message);
                button.innerHTML = originalText;
                button.disabled = false;
            }
        });

        // Mot de passe oublié
        forgotPasswordLink.addEventListener('click', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            
            if (!email) {
                showError('Veuillez entrer votre adresse email pour réinitialiser votre mot de passe');
                return;
            }

            hideMessages();
            
            try {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/reset-password.html'
                });

                if (error) throw error;
                
                showSuccess('Un email de réinitialisation a été envoyé à ' + email);
            } catch (error) {
                showError('Erreur : ' + error.message);
            }
        });
        
        // Ajouter le paramètre redirect au lien d'inscription
        const signupLink = document.querySelector('.auth-footer a[href="signup.html"]');
        if (signupLink) {
            const urlParams = new URLSearchParams(window.location.search);
            const redirectParam = urlParams.get('redirect');
            if (redirectParam) {
                const currentHref = signupLink.getAttribute('href');
                const separator = currentHref.includes('?') ? '&' : '?';
                signupLink.href = `${currentHref}${separator}redirect=${redirectParam}`;
            }
        }
    }

    // Initialisation
    function init() {
        if (window.location.pathname.includes('login.html')) {
            // Attendre que les dépendances soient chargées
            if (window.authManager && window.supabase) {
                setupLoginForm();
            } else {
                // Retry après un court délai
                setTimeout(init, 100);
            }
        }
    }

    // Démarrer l'initialisation
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

    console.log('✅ login.js chargé - Gestion de la page de connexion');
})();