// Vérifier l'état d'authentification
console.log('Utilisateur:', window.authManager?.getCurrentUser());

// Tester les événements
window.debugAuthEvents();

// Tester manuellement un événement
window.testAuthEvent('login');
window.testAuthEvent('logout');

// Écouter les événements
window.addEventListener('auth:login', (e) => {
    console.log('Login détecté!', e.detail);
});