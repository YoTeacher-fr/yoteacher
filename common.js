// ===== FONCTIONS UTILITAIRES COMMUNES =====
const utils = {
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    showNotification: (message, type = 'info') => {
        // Créer les styles si nécessaire
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    padding: 15px 20px;
                    border-radius: 10px;
                    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 10000;
                    transform: translateX(120%);
                    transition: transform 0.3s ease;
                    border-left: 4px solid #1e88e5;
                    max-width: 400px;
                }
                
                .notification.show {
                    transform: translateX(0);
                }
                
                .notification-success {
                    border-left-color: #4CAF50;
                }
                
                .notification-error {
                    border-left-color: #e74c3c;
                }
                
                .notification-info {
                    border-left-color: #1e88e5;
                }
                
                .notification i {
                    font-size: 1.2rem;
                }
                
                .notification-success i {
                    color: #4CAF50;
                }
                
                .notification-error i {
                    color: #e74c3c;
                }
                
                .notification-info i {
                    color: #1e88e5;
                }
            `;
            document.head.appendChild(style);
        }
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    },
    
    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },
    
    formatTime: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    getQueryParam: (param) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },
    
    redirectToLogin: (returnUrl = null) => {
        const url = returnUrl ? `login.html?return=${encodeURIComponent(returnUrl)}` : 'login.html';
        window.location.href = url;
    }
};

// Exposer utils globalement
window.utils = utils;

// Fonction de diagnostic d'authentification
window.diagnoseAuth = function() {
    console.group('🔍 DIAGNOSTIC AUTH');
    
    // 1. Vérifier localStorage
    const storedUser = localStorage.getItem('yoteacher_user');
    console.log('1. localStorage user:', storedUser ? 'PRÉSENT' : 'ABSENT');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            console.log('   Email:', user.email);
            console.log('   Timestamp:', user._timestamp ? new Date(user._timestamp).toLocaleString() : 'N/A');
        } catch (e) {
            console.log('   ERREUR parsing:', e.message);
        }
    }
    
    // 2. Vérifier authManager
    console.log('2. authManager:', window.authManager ? 'PRÉSENT' : 'ABSENT');
    if (window.authManager) {
        console.log('   User:', window.authManager.user ? 'PRÉSENT' : 'ABSENT');
        console.log('   isAuthenticated:', typeof window.authManager.isAuthenticated);
        if (typeof window.authManager.isAuthenticated === 'function') {
            console.log('   isAuthenticated():', window.authManager.isAuthenticated());
        }
    }
    
    // 3. Vérifier sessionStorage
    const sessionCode = sessionStorage.getItem('invitation_code');
    console.log('3. Session code:', sessionCode || 'ABSENT');
    
    // 4. Vérifier URL actuelle
    console.log('4. URL actuelle:', window.location.href);
    console.log('   Path:', window.location.pathname);
    const params = new URLSearchParams(window.location.search);
    console.log('   Paramètres:', Object.fromEntries(params.entries()));
    
    // 5. Vérifier si les liens dashboard fonctionneront
    const hasLocalStorageUser = !!storedUser;
    console.log('5. Dashboard accessible:', hasLocalStorageUser ? '✅ OUI (localStorage)' : '❌ NON');
    
    console.groupEnd();
    
    return hasLocalStorageUser;
};

// Debug Supabase
window.debugSupabase = async function() {
    console.group('🔍 Debug Supabase');
    
    // Vérifier la connexion
    console.log('Supabase disponible:', !!window.supabase);
    
    if (window.supabase) {
        // Vérifier les tables
        const tables = ['profiles', 'bookings', 'packages', 'credit_transactions'];
        for (const table of tables) {
            try {
                const { data, error } = await supabase
                    .from(table)
                    .select('count', { count: 'exact', head: true });
                    
                console.log(`Table ${table}:`, error ? '❌ Erreur' : '✅ OK');
                if (error) console.log('   Erreur:', error.message);
            } catch (e) {
                console.log(`Table ${table}: ❌ Exception`);
            }
        }
        
        // Vérifier l'utilisateur courant
        if (window.authManager?.user) {
            console.log('Utilisateur connecté:', window.authManager.user.email);
            
            // Tester une insertion simple
            const testData = {
                booking_number: 'TEST' + Date.now(),
                user_id: window.authManager.user.id,
                course_type: 'conversation',
                duration_minutes: 60,
                start_time: new Date().toISOString(),
                end_time: new Date(Date.now() + 3600000).toISOString(),
                platform: 'zoom',
                status: 'pending'
            };
            
            console.log('Test insertion dans bookings:', testData);
            
            const { data, error } = await supabase
                .from('bookings')
                .insert([testData])
                .select();
                
            if (error) {
                console.log('❌ Erreur insertion test:', error);
            } else {
                console.log('✅ Insertion test réussie:', data[0].id);
                
                // Nettoyer
                await supabase
                    .from('bookings')
                    .delete()
                    .eq('id', data[0].id);
            }
        }
    }
    
    console.groupEnd();
};

// Gestionnaire d'erreur d'authentification
window.handleAuthError = function(error) {
    console.error('Erreur d\'authentification:', error);
    
    // Si l'erreur est liée à supabase non défini
    if (error.message && error.message.includes('undefined') && error.message.includes('signIn')) {
        console.error('⚠️ Supabase non initialisé. Vérifiez:');
        console.error('1. config.js est chargé');
        console.error('2. supabase.js est chargé');
        console.error('3. window.supabase existe:', !!window.supabase);
        console.error('4. window.supabase.auth existe:', !!(window.supabase && window.supabase.auth));
        
        // Rediriger vers une page d'erreur ou recharger
        if (window.location.pathname.includes('login.html')) {
            alert('Erreur système. Veuillez rafraîchir la page.');
        }
        return false;
    }
    return true;
};

// Fonction pour forcer la redirection vers dashboard (utilisée dans les liens)
window.ensureDashboardAccess = function(e) {
    if (e) e.preventDefault();
    
    const storedUser = localStorage.getItem('yoteacher_user');
    if (storedUser) {
        console.log('✅ Accès dashboard autorisé, redirection...');
        window.location.href = 'dashboard.html';
    } else {
        console.log('❌ Pas d\'utilisateur, redirection vers login...');
        const currentUrl = encodeURIComponent(window.location.href);
        window.location.href = `login.html?redirect=${currentUrl}`;
    }
};

// Fonction pour réparer l'authentification
window.fixAuth = function() {
    console.group('🔧 Réparation d\'authentification');
    
    // 1. Vérifier localStorage
    const storedUser = localStorage.getItem('yoteacher_user');
    if (storedUser) {
        console.log('✅ Utilisateur trouvé dans localStorage');
        
        // 2. Synchroniser avec authManager
        if (window.authManager) {
            try {
                const userData = JSON.parse(storedUser);
                window.authManager.user = userData;
                console.log('✅ authManager synchronisé');
                
                // 3. Émettre l'événement login
                window.dispatchEvent(new CustomEvent('auth:login', {
                    detail: { user: userData }
                }));
                
                console.log('✅ Événement auth:login émis');
                
                // 4. Rediriger vers dashboard si on est sur login/signup
                if (window.location.pathname.includes('login.html') || 
                    window.location.pathname.includes('signup.html')) {
                    console.log('🔗 Redirection vers dashboard...');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1000);
                }
                
                return true;
            } catch (error) {
                console.error('❌ Erreur synchronisation:', error);
                return false;
            }
        } else {
            console.log('⚠️ authManager non disponible');
            return false;
        }
    } else {
        console.log('❌ Aucun utilisateur dans localStorage');
        return false;
    }
    
    console.groupEnd();
};