// Fonction pour forcer la synchronisation de l'utilisateur
window.forceUserSync = function() {
    const storedUser = localStorage.getItem('yoteacher_user');
    if (storedUser) {
        try {
            const userData = JSON.parse(storedUser);
            console.log('🔄 Synchronisation utilisateur depuis localStorage');
            
            if (window.authManager) {
                window.authManager.user = userData;
                console.log('✅ authManager mis à jour');
            }
            
            // Émettre l'événement login pour que le dashboard se charge
            window.dispatchEvent(new CustomEvent('auth:login', {
                detail: { user: userData }
            }));
            
            return true;
        } catch (error) {
            console.error('❌ Erreur synchronisation:', error);
            return false;
        }
    }
    return false;
};

document.addEventListener('DOMContentLoaded', () => {
    // Code du premier bloc <script>
    document.body.style.opacity = '0';
    document.body.style.visibility = 'hidden';
    
    // Gestionnaire d'erreur global pour le dashboard
    window.addEventListener('error', function(e) {
        console.error('Erreur globale dashboard:', e.error);
    });

    // Vérifier l'état de l'authentification au chargement
    window.addEventListener('auth:login', function() {
        console.log('✅ Événement auth:login reçu, dashboard prêt');
        if (window.loadDashboard) {
            window.loadDashboard();
        }
    });

    window.addEventListener('auth:logout', function() {
        console.log('⚠️ Événement auth:logout reçu, redirection...');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    });
    
    function checkAuthentication() {
        console.log('🔐 Vérification de l\'authentification...');
        
        // 1. Vérifier d'abord localStorage (le plus fiable)
        const storedUser = localStorage.getItem('yoteacher_user');
        
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                console.log('✅ Utilisateur trouvé dans localStorage:', userData.email);
                
                // Forcer l'initialisation de authManager si nécessaire
                if (!window.authManager) {
                    window.authManager = {
                        user: userData,
                        isAuthenticated: () => true,
                        getCurrentUser: () => userData
                    };
                } else if (!window.authManager.user) {
                    window.authManager.user = userData;
                }
                
                // Afficher le dashboard
                document.body.classList.add('loaded');
                document.body.style.opacity = '1';
                document.body.style.visibility = 'visible';
                
                setTimeout(() => {
                    if (window.loadDashboard) {
                        console.log('📊 Chargement du dashboard...');
                        window.loadDashboard();
                    }
                }, 100);
                
                return;
            } catch (error) {
                console.error('❌ Erreur lecture localStorage:', error);
            }
        }
        
        // 2. Si pas dans localStorage, vérifier authManager
        let attempts = 0;
        const maxAttempts = 30;
        
        function checkAuthManager() {
            attempts++;
            
            if (window.authManager && typeof window.authManager.isAuthenticated === 'function') {
                if (window.authManager.isAuthenticated()) {
                    console.log('✅ Utilisateur authentifié via authManager');
                    document.body.classList.add('loaded');
                    document.body.style.opacity = '1';
                    document.body.style.visibility = 'visible';
                    
                    setTimeout(() => {
                        if (window.loadDashboard) {
                            window.loadDashboard();
                        }
                    }, 100);
                } else {
                    console.log('❌ AuthManager dit non authentifié');
                    redirectToLogin();
                }
            } else if (attempts >= maxAttempts) {
                console.log('⚠️ AuthManager non initialisé après 3s');
                redirectToLogin();
            } else {
                console.log(`⏳ Attente authManager (${attempts}/${maxAttempts})`);
                setTimeout(checkAuthManager, 100);
            }
        }
        
        function redirectToLogin() {
            console.log('🔄 Redirection vers login...');
            const currentUrl = encodeURIComponent(window.location.href);
            window.location.replace(`login.html?redirect=${currentUrl}`);
        }
        
        setTimeout(checkAuthManager, 200);
    }
    
    setTimeout(checkAuthentication, 200);

    // Variables pour la navigation des cours
    let upcomingLessons = [];
    let currentLessonIndex = 0;
    
    // Variables pour la navigation des forfaits
    let currentPackageIndex = 0;
    const packageTypes = ['conversation', 'curriculum', 'examen'];
    const packageNames = {
        'conversation': 'Conversation',
        'curriculum': 'Cours', 
        'examen': 'Examen'
    };
    const packageColors = {
        'conversation': '#ff9800',
        'curriculum': '#4caf50',
        'examen': '#9c27b0'
    };
    const packageIcons = {
        'conversation': 'fas fa-comments',
        'curriculum': 'fas fa-book',
        'examen': 'fas fa-graduation-cap'
    };
    
    // Fonction utilitaire pour calculer les heures restantes
    function calculateHoursUntilStart(startTime) {
        const now = new Date();
        const lessonDate = new Date(startTime);
        const hoursUntilStart = (lessonDate - now) / (1000 * 60 * 60);
        return hoursUntilStart;
    }
    
    // Fonction pour calculer les jours restants avant expiration
    function calculateDaysRemaining(expiryDate) {
        if (!expiryDate) return null;
        
        const expiry = new Date(expiryDate);
        const now = new Date();
        const timeDiff = expiry.getTime() - now.getTime();
        return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    }
    
    // Fonction pour formater la date d'expiration avec les jours restants
    function formatExpiryInfo(expiryDate) {
        if (!expiryDate) return '';
        
        const formattedDate = new Date(expiryDate).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        
        const daysRemaining = calculateDaysRemaining(expiryDate);
        
        let expiryHtml = '';
        
        if (daysRemaining > 0) {
            expiryHtml = `
                <div class="package-expiry-container">
                    <div class="expiry-info">
                        <div class="expiry-date">
                            <i class="fas fa-calendar-alt expiry-icon"></i>
                            <span class="expiry-text">Expire le ${formattedDate}</span>
                        </div>
                        <div class="expiry-days">
                            <i class="far fa-clock"></i>
                            <span><span class="days-count">${daysRemaining}</span> jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}</span>
                        </div>
                        ${daysRemaining <= 7 ? `
                        <div class="expiry-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>Expire bientôt ! Utilisez vos crédits.</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        } else if (daysRemaining === 0) {
            expiryHtml = `
                <div class="package-expiry-container">
                    <div class="expiry-info">
                        <div class="expiry-date">
                            <i class="fas fa-calendar-alt expiry-icon"></i>
                            <span class="expiry-text">Expire aujourd'hui !</span>
                        </div>
                        <div class="expiry-warning" style="background-color: #f8d7da; border-color: #f5c6cb; color: #721c24;">
                            <i class="fas fa-exclamation-circle"></i>
                            <span>Utilisez vos crédits aujourd'hui !</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            expiryHtml = `
                <div class="package-expiry-container">
                    <div class="expiry-info">
                        <div class="expiry-date" style="color: #dc3545;">
                            <i class="fas fa-calendar-times"></i>
                            <span>Expiré le ${formattedDate}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        return expiryHtml;
    }
    
    async function loadDashboard() {
        try {
            const user = window.authManager?.getCurrentUser();
            
            if (!user) {
                console.log('Utilisateur non trouvé');
                return;
            }
            
            await loadUserData(user);
            
            const loadingSection = document.getElementById('loadingSection');
            const dashboardContent = document.getElementById('dashboardContent');
            const dashboardActions = document.getElementById('dashboardActions');
            
            if (loadingSection) loadingSection.style.display = 'none';
            if (dashboardContent) dashboardContent.style.display = 'block';
            if (dashboardActions) dashboardActions.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur chargement dashboard:', error);
            const loadingSection = document.getElementById('loadingSection');
            if (loadingSection) {
                loadingSection.innerHTML = `
                    <div style="color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erreur lors du chargement du dashboard. Veuillez rafraîchir la page.</p>
                        <button onclick="location.reload()" style="margin-top: 15px; padding: 10px 20px; background: #3c84f6; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            Rafraîchir
                        </button>
                    </div>
                `;
            }
        }
    }
    
async function loadUserData(user) {
    const welcomeDiv = document.getElementById('welcomeMessage');
    const userName = user.profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
    const now = new Date();
    const hour = now.getHours();
    
    let greeting;
    if (window.translationManager?.getCurrentLanguage() === 'en') {
        greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    } else {
        greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    }
    
    // Construire le HTML du message d'accueil
    let welcomeHTML = `
        <div class="welcome-message">
            <h1>${greeting} ${userName} !`;
    
    // Ajouter le badge VIP si l'utilisateur est VIP, sinon ajouter l'émoji
    if (user.profile?.is_vip) {
        welcomeHTML += ` <span class="vip-badge">
                <i class="fas fa-crown"></i>
                <span>Membre VIP</span>
            </span>`;
    } else {
        welcomeHTML += ' 👋';
    }
    
    welcomeHTML += `</h1>
            <p>Voici un aperçu de votre tableau de bord</p>
        </div>
    `;
                    
    welcomeDiv.innerHTML = welcomeHTML;
    
    // Mettre à jour les informations du profil
    updateProfileInfo(user);
    
    if (window.supabase) {
        try {
            // Charger les forfaits
            await loadUserPackages(user.id);
            
            // Charger les réservations à venir
            await loadUpcomingLessons(user.id);
            
        } catch (error) {
            console.error('Erreur chargement données:', error);
        }
    }
}
    
    function updateProfileInfo(user) {
        const profileInfo = document.getElementById('profileInfo');
        const joinDate = new Date(user.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        const timezone = user.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const frenchLevel = user.profile?.french_level || 'Non spécifié';
        
        profileInfo.innerHTML = `
            <div class="profile-field">
                <span class="profile-label">Email</span>
                <span class="profile-value">${user.email}</span>
            </div>
            <div class="profile-field">
                <span class="profile-label">Membre depuis</span>
                <span class="profile-value">${joinDate}</span>
            </div>
            <div class="profile-field">
                <span class="profile-label">Fuseau horaire</span>
                <span class="profile-value">${timezone}</span>
            </div>
            <div class="profile-field">
                <span class="profile-label">Niveau</span>
                <span class="profile-value">${frenchLevel}</span>
            </div>
        `;
    }
    
    async function loadUserPackages(userId) {
        const container = document.getElementById('packagesContainer');
        
        if (!window.packagesManager) {
            // Afficher seulement la carte Conversation par défaut
            showPackageCard('conversation', { 30: 0, 45: 0, 60: 0, expiry: null });
            return;
        }
        
        try {
            // Charger les forfaits actifs
            const packages = await window.packagesManager.getUserActivePackages(userId);
            
            // Organiser les forfaits par type et par durée
            const packagesByType = {
                conversation: { 30: 0, 45: 0, 60: 0, expiry: null },
                curriculum: { 30: 0, 45: 0, 60: 0, expiry: null },
                examen: { 30: 0, 45: 0, 60: 0, expiry: null }
            };
            
            packages.forEach(pkg => {
                const type = pkg.course_type;
                const duration = pkg.duration_minutes || 60;
                const remainingCredits = pkg.remaining_credits || 0;
                
                if (packagesByType[type]) {
                    // Ajouter les crédits pour la durée appropriée
                    if (duration === 30) {
                        packagesByType[type][30] += remainingCredits;
                    } else if (duration === 45) {
                        packagesByType[type][45] += remainingCredits;
                    } else {
                        packagesByType[type][60] += remainingCredits;
                    }
                    
                    // Mettre à jour la date d'expiration la plus proche
                    const expiryDate = new Date(pkg.expires_at);
                    if (!packagesByType[type].expiry || expiryDate < new Date(packagesByType[type].expiry)) {
                        packagesByType[type].expiry = pkg.expires_at;
                    }
                }
            });
            
            // Stocker les données pour la navigation
            window.packagesData = packagesByType;
            
            // Afficher la carte Conversation par défaut
            showPackageCard('conversation', packagesByType.conversation);
            
        } catch (error) {
            console.error('Erreur chargement forfaits:', error);
            // Afficher la carte Conversation avec message d'erreur
            showPackageCard('conversation', { 30: 0, 45: 0, 60: 0, expiry: null });
        }
    }
    
    function showPackageCard(type, typeData) {
        const container = document.getElementById('packagesContainer');
        
        // Générer l'affichage de la date d'expiration avec jours restants
        const expiryHtml = formatExpiryInfo(typeData.expiry);
        
        container.innerHTML = `
            <div class="package-internal-card">
                <div class="package-internal-header">
                    <div class="package-internal-icon" style="background: ${packageColors[type]};">
                        <i class="${packageIcons[type]}"></i>
                    </div>
                    <div class="package-internal-title">${packageNames[type]}</div>
                    <div class="package-nav-internal">
                        <button class="package-nav-arrow-internal" id="packagePrevBtnInternal" ${currentPackageIndex === 0 ? 'disabled' : ''}>
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button class="package-nav-arrow-internal" id="packageNextBtnInternal" ${currentPackageIndex === packageTypes.length - 1 ? 'disabled' : ''}>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
                <div class="package-durations">
                    <div class="duration-row">
                        <div class="duration-label">
                            <i class="far fa-clock"></i>
                            <span>30min</span>
                        </div>
                        <div class="duration-credits">${typeData[30] || 0}</div>
                    </div>
                    <div class="duration-row">
                        <div class="duration-label">
                            <i class="far fa-clock"></i>
                            <span>45min</span>
                        </div>
                        <div class="duration-credits">${typeData[45] || 0}</div>
                    </div>
                    <div class="duration-row">
                        <div class="duration-label">
                            <i class="far fa-clock"></i>
                            <span>60min</span>
                        </div>
                        <div class="duration-credits">${typeData[60] || 0}</div>
                    </div>
                </div>
                ${expiryHtml}
            </div>
        `;
        
        // Ajouter les écouteurs d'événements pour les flèches internes
        const prevBtnInternal = document.getElementById('packagePrevBtnInternal');
        const nextBtnInternal = document.getElementById('packageNextBtnInternal');
        
        if (prevBtnInternal) {
            prevBtnInternal.addEventListener('click', navigateToPrevPackage);
        }
        
        if (nextBtnInternal) {
            nextBtnInternal.addEventListener('click', navigateToNextPackage);
        }
    }
    
    function navigateToNextPackage() {
        if (currentPackageIndex < packageTypes.length - 1) {
            currentPackageIndex++;
            const nextType = packageTypes[currentPackageIndex];
            if (window.packagesData) {
                showPackageCard(nextType, window.packagesData[nextType] || { 30: 0, 45: 0, 60: 0, expiry: null });
            }
        }
    }
    
    function navigateToPrevPackage() {
        if (currentPackageIndex > 0) {
            currentPackageIndex--;
            const prevType = packageTypes[currentPackageIndex];
            if (window.packagesData) {
                showPackageCard(prevType, window.packagesData[prevType] || { 30: 0, 45: 0, 60: 0, expiry: null });
            }
        }
    }
    
    async function loadUpcomingLessons(userId) {
        if (!window.supabase) return;
        
        try {
            const { data: bookings, error } = await supabase
                .from('upcoming_bookings')
                .select('*')
                .eq('user_id', userId)
                .order('start_time', { ascending: true });
                
            if (error) throw error;
            
            const nextLessonContent = document.getElementById('nextLessonContent');
            const lessonNav = document.getElementById('lessonNav');
            const externalActions = document.getElementById('lessonExternalActions');
            
            if (!bookings || bookings.length === 0) {
                nextLessonContent.innerHTML = `
                    <div class="no-upcoming">
                        <i class="far fa-calendar"></i>
                        <p>Aucun cours programmé</p>
                    </div>
                `;
                lessonNav.style.display = 'none';
                externalActions.style.display = 'none';
                return;
            }
            
            upcomingLessons = bookings;
            currentLessonIndex = 0;
            
            // Afficher la navigation si plus d'un cours
            if (bookings.length > 1) {
                lessonNav.style.display = 'flex';
                updateLessonNavigation();
            } else {
                lessonNav.style.display = 'none';
            }
            
            displayCurrentLesson();
            
        } catch (error) {
            console.error('Erreur chargement cours:', error);
            document.getElementById('nextLessonContent').innerHTML = `
                <div class="no-upcoming">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erreur de chargement des cours</p>
                </div>
            `;
        }
    }
    
    function displayCurrentLesson() {
        if (upcomingLessons.length === 0) return;
        
        const lesson = upcomingLessons[currentLessonIndex];
        const nextLessonContent = document.getElementById('nextLessonContent');
        const lessonCounter = document.getElementById('lessonCounter');
        const externalActions = document.getElementById('lessonExternalActions');
        
        // Mettre à jour le compteur
        lessonCounter.textContent = `${currentLessonIndex + 1}/${upcomingLessons.length}`;
        
        const lessonDate = new Date(lesson.start_time);
        const hoursUntilStart = calculateHoursUntilStart(lesson.start_time);
        
        // Vérifier si l'annulation est possible (plus de 24h)
        const canCancel = hoursUntilStart > 24 && lesson.status !== 'cancelled';
        
        // Mapping des plateformes pour l'affichage
        const platformNames = {
            'zoom': 'Zoom',
            'meet': 'Google Meet',
            'teams': 'Microsoft Teams',
            'other': 'Autre'
        };
        
        const platformName = platformNames[lesson.platform] || lesson.platform || 'Zoom';
        
        nextLessonContent.innerHTML = `
            <div class="upcoming-lesson-card">
                <div class="lesson-date">
                    <i class="fas fa-calendar-alt"></i>
                    ${lessonDate.toLocaleDateString('fr-FR', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long',
                        year: 'numeric'
                    })}
                </div>
                <div class="lesson-info">
                    <div class="lesson-info-item">
                        <span class="lesson-info-label">Heure</span>
                        <span class="lesson-info-value">${lessonDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="lesson-info-item">
                        <span class="lesson-info-label">Durée</span>
                        <span class="lesson-info-value">${lesson.duration_minutes || 60} min</span>
                    </div>
                    <div class="lesson-info-item">
                        <span class="lesson-info-label">Type</span>
                        <span class="lesson-info-value">${lesson.course_type || 'Cours'}</span>
                    </div>
                    <div class="lesson-info-item">
                        <span class="lesson-info-label">Plateforme</span>
                        <span class="lesson-info-value">${platformName}</span>
                    </div>
                    <div class="lesson-info-item">
                        <span class="lesson-info-label">Référence</span>
                        <span class="lesson-info-value">${lesson.booking_number || '#' + (lesson.id ? lesson.id.substring(0, 8) : '')}</span>
                    </div>
                    <!-- Affichage conditionnel pour annulation impossible -->
                    ${hoursUntilStart <= 24 ? `
                    <div class="lesson-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>Annulation impossible (moins de 24h avant le cours)</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Afficher les boutons en dehors de la carte
        externalActions.style.display = 'flex';
        externalActions.innerHTML = '';
        
        // Bouton d'annulation (seulement si possible)
        if (canCancel) {
            // Créer un bouton avec un écouteur d'événement plutôt qu'avec onclick
            const cancelButton = document.createElement('button');
            cancelButton.className = 'btn-external btn-cancel-external';
            cancelButton.innerHTML = '<i class="fas fa-times"></i> Annuler le cours';
            cancelButton.addEventListener('click', function() {
                handleCancelLesson(lesson.id);
            });
            externalActions.appendChild(cancelButton);
        }
        
        // Bouton de connexion (toujours visible si lien disponible)
        if (lesson.meeting_link) {
            const joinLink = document.createElement('a');
            joinLink.href = lesson.meeting_link;
            joinLink.target = '_blank';
            joinLink.className = 'btn-external btn-join-external';
            joinLink.innerHTML = '<i class="fas fa-video"></i> Rejoindre';
            externalActions.appendChild(joinLink);
        }
        
        // Si aucun bouton n'est affiché, masquer la div
        if (!canCancel && !lesson.meeting_link) {
            externalActions.style.display = 'none';
        }
    }
    
    async function handleCancelLesson(bookingId) {
        const user = window.authManager?.getCurrentUser();
        if (!user) {
            alert('Vous devez être connecté pour annuler un cours');
            return;
        }
        
        // Vérifier si le système d'annulation est disponible
        if (!window.bookingCancellation) {
            alert('Le système d\'annulation n\'est pas disponible. Veuillez rafraîchir la page.');
            return;
        }
        
        // Trouver la leçon pour afficher des infos dans la confirmation
        const lesson = upcomingLessons.find(l => l.id === bookingId);
        if (!lesson) {
            alert('Cours non trouvé');
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
        if (!confirm(`Êtes-vous sûr de vouloir annuler ce cours ?\n\n📅 ${formattedDate}\n📚 ${lesson.course_type}\n⏱️ ${lesson.duration_minutes || 60}min\n\nUn crédit sera ajouté à votre compte`)) {
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
                const creditMessage = result.creditRefunded ? '\n💰 1 crédit a été ajouté à votre compte.' : '';
                
                if (window.utils && window.utils.showNotification) {
                    window.utils.showNotification(successMessage + creditMessage, 'success');
                } else {
                    alert(successMessage + creditMessage);
                }
                
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
            
            if (window.utils && window.utils.showNotification) {
                window.utils.showNotification(errorMessage, 'error');
            } else {
                alert(errorMessage);
            }
        }
    }
    
    function updateLessonNavigation() {
        const prevBtn = document.getElementById('prevLessonBtn');
        const nextBtn = document.getElementById('nextLessonBtn');
        
        prevBtn.disabled = currentLessonIndex === 0;
        nextBtn.disabled = currentLessonIndex === upcomingLessons.length - 1;
    }
    
    // Gestion de la déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    const refreshBtn = document.getElementById('refreshDashboardBtn');
    const prevLessonBtn = document.getElementById('prevLessonBtn');
    const nextLessonBtn = document.getElementById('nextLessonBtn');
    
    async function handleLogout() {
        if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
            try {
                await window.authManager.signOut();
                // signOut() redirige déjà vers index.html
            } catch (error) {
                console.error('Erreur lors de la déconnexion:', error);
            }
        }
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            await handleLogout();
        });
    }
    
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            await handleLogout();
        });
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function() {
            const user = window.authManager?.getCurrentUser();
            if (user) {
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualisation...';
                await loadUserData(user);
                this.innerHTML = '<i class="fas fa-sync-alt"></i> Actualiser';
                
                // Animation de fade in pour les nouvelles cartes
                document.querySelectorAll('.fade-in').forEach(card => {
                    card.style.animation = 'none';
                    setTimeout(() => {
                        card.style.animation = 'fadeIn 0.5s ease forwards';
                    }, 10);
                });
            }
        });
    }
    
    if (prevLessonBtn) {
        prevLessonBtn.addEventListener('click', function() {
            if (currentLessonIndex > 0) {
                currentLessonIndex--;
                displayCurrentLesson();
                updateLessonNavigation();
            }
        });
    }
    
    if (nextLessonBtn) {
        nextLessonBtn.addEventListener('click', function() {
            if (currentLessonIndex < upcomingLessons.length - 1) {
                currentLessonIndex++;
                displayCurrentLesson();
                updateLessonNavigation();
            }
        });
    }
    
    // Initialiser le PackagesManager si nécessaire
    if (window.packagesManager && !window.packagesManager.isInitialized) {
        window.packagesManager.initialize();
    }
    
    // Exposer la fonction de chargement globalement
    window.loadDashboard = loadDashboard;
    
    // Exposer la fonction handleCancelLesson globalement pour qu'elle soit accessible
    window.handleCancelLesson = handleCancelLesson;
    
    // Fonction de débogage pour tester l'annulation
    window.testCancellation = async function(bookingId) {
        const user = window.authManager?.getCurrentUser();
        if (!user) {
            console.error('❌ Utilisateur non connecté');
            return;
        }
        
        console.group('🧪 Test d\'annulation');
        console.log('Booking ID:', bookingId);
        console.log('User ID:', user.id);
        
        try {
            // Vérifier l'état avant
            const { data: booking } = await supabase
                .from('bookings')
                .select('*')
                .eq('id', bookingId)
                .single();
                
            console.log('État avant:', booking);
            
            // Vérifier si annulation possible
            const hoursUntilStart = calculateHoursUntilStart(booking.start_time);
            console.log('Heures restantes:', hoursUntilStart);
            console.log('Peut être annulé:', hoursUntilStart > 24);
            
        } catch (error) {
            console.error('Erreur test:', error);
        }
        
        console.groupEnd();
    };
});

// Vérification directe au chargement
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 Vérification rapide de l\'authentification...');
    
    // Vérifier immédiatement dans localStorage
    const storedUser = localStorage.getItem('yoteacher_user');
    
    if (storedUser) {
        console.log('✅ Utilisateur trouvé dans localStorage');
        // Forcer l'opacité du body
        document.body.style.opacity = '1';
        document.body.style.visibility = 'visible';
        
        // Attendre que le dashboard se charge
        setTimeout(function() {
            if (window.loadDashboard) {
                window.loadDashboard();
            } else if (window.forceUserSync) {
                window.forceUserSync();
            }
        }, 500);
    } else {
        console.log('❌ Pas d\'utilisateur dans localStorage');
        // Masquer le contenu mais ne pas rediriger immédiatement
        // La fonction checkAuthentication() se chargera de la redirection
    }
});