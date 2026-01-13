async function handleCancelLesson(bookingId) {
    const user = window.authManager?.getCurrentUser();
    if (!user) {
        showErrorMessage('Vous devez être connecté pour annuler un cours');
        return;
    }
    
    // Fonction utilitaire pour afficher des messages d'erreur
    function showErrorMessage(message) {
        if (window.utils && window.utils.showNotification) {
            window.utils.showNotification(message, 'error');
        } else {
            alert(message);
        }
    }
    
    // Vérification améliorée de la disponibilité
    if (!window.bookingCancellation) {
        console.log('⚠️ BookingCancellation non trouvé, tentative de réinitialisation...');
        
        // Essayer de réinitialiser
        if (window.reinitializeBookingCancellation) {
            const reinitialized = window.reinitializeBookingCancellation();
            if (!reinitialized) {
                showErrorMessage('Le système d\'annulation n\'est pas disponible. Veuillez rafraîchir la page et réessayer.');
                return;
            }
        } else {
            showErrorMessage('Le système d\'annulation n\'est pas disponible. Veuillez rafraîchir la page.');
            return;
        }
    }
    
    // Vérifier que la méthode cancelBooking existe
    if (typeof window.bookingCancellation.cancelBooking !== 'function') {
        console.error('❌ Méthode cancelBooking non disponible');
        showErrorMessage('Le système d\'annulation n\'est pas disponible. Veuillez rafraîchir la page.');
        return;
    }
    
    // Trouver la leçon pour afficher des infos dans la confirmation
    const lesson = upcomingLessons.find(l => l.id === bookingId);
    if (!lesson) {
        showErrorMessage('Cours non trouvé');
        return;
    }
    
    const lessonDate = new Date(lesson.start_time);
    const formattedDate = lessonDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Confirmation détaillée
    if (!confirm(`Êtes-vous sûr de vouloir annuler ce cours ?\n\n📅 ${formattedDate}\n📚 ${lesson.course_type}\n⏱️ ${lesson.duration_minutes || 60}min\n\nUn crédit sera ajouté à votre compte.`)) {
        return;
    }
    
    // Désactiver le bouton pendant le traitement
    const cancelBtn = document.querySelector(`.btn-cancel-external[onclick*="${bookingId}"]`);
    if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Annulation en cours...';
    }
    
    try {
        const result = await window.bookingCancellation.cancelBooking(bookingId, user.id);
        
        if (result.success) {
            // Afficher un message de succès
            const successMessage = `✅ Cours annulé avec succès !`;
            const creditMessage = result.creditRefunded ? '\n💰 1 crédit a été ajouté à votre compte (valable 90 jours).' : '';
            const calcomMessage = result.calcomCancelled ? '\n📅 Annulation Cal.com effectuée.' : '';
            
            showErrorMessage(successMessage + creditMessage + calcomMessage);
            
            // Rafraîchir les données du dashboard
            await loadUpcomingLessons(user.id);
            
            // Rafraîchir les forfaits si un crédit a été remboursé
            if (result.creditRefunded && window.packagesManager) {
                await loadUserPackages(user.id);
            }
        } else {
            throw new Error(result.error || 'Échec de l\'annulation');
        }
    } catch (error) {
        console.error('Erreur annulation:', error);
        
        // Réactiver le bouton
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.innerHTML = '<i class="fas fa-times"></i> Annuler le cours';
        }
        
        // Afficher message d'erreur
        let errorMessage = error.message || 'Erreur lors de l\'annulation';
        
        // Messages d'erreur plus clairs
        if (errorMessage.includes('24h')) {
            errorMessage = 'Annulation impossible : le cours commence dans moins de 24h';
        } else if (errorMessage.includes('déjà annulée')) {
            errorMessage = 'Cette réservation est déjà annulée';
        }
        
        showErrorMessage(errorMessage);
    }
}