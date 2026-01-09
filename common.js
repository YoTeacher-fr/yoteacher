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
// Ajoutez dans common.js ou dans un nouveau fichier
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

// Pour tester, appelez window.debugSupabase() dans la console