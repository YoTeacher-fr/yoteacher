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