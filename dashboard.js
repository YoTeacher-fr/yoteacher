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

// Protection contre les appels multiples à loadDashboard
let isLoadingDashboard = false;
let dashboardLoaded = false;

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
    
    // Fonction pour obtenir les noms des forfaits selon la langue
    function getPackageNames() {
        const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
        return {
            'conversation': isFrench ? 'Conversation' : 'Conversation',
            'curriculum': isFrench ? 'Cours' : 'Course',
            'examen': isFrench ? 'Examen' : 'Exam'
        };
    }
    
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
        const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
        
        let expiryHtml = '';
        
        if (daysRemaining > 0) {
            const daysText = isFrench ? 
                `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}` :
                `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining`;
            
            const warningText = isFrench ? 
                'Expire bientôt ! Utilisez vos crédits.' :
                'Expiring soon! Use your credits.';
            
            expiryHtml = `
                <div class="package-expiry-container">
                    <div class="expiry-info">
                        <div class="expiry-date">
                            <i class="fas fa-calendar-alt expiry-icon"></i>
                            <span class="expiry-text">${isFrench ? 'Expire le' : 'Expires on'} ${formattedDate}</span>
                        </div>
                        <div class="expiry-days">
                            <i class="far fa-clock"></i>
                            <span>${daysText}</span>
                        </div>
                        ${daysRemaining <= 7 ? `
                        <div class="expiry-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>${warningText}</span>
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
                            <span class="expiry-text">${isFrench ? 'Expire aujourd\'hui !' : 'Expires today!'}</span>
                        </div>
                        <div class="expiry-warning" style="background-color: #f8d7da; border-color: #f5c6cb; color: #721c24;">
                            <i class="fas fa-exclamation-circle"></i>
                            <span>${isFrench ? 'Utilisez vos crédits aujourd\'hui !' : 'Use your credits today!'}</span>
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
                            <span>${isFrench ? 'Expiré le' : 'Expired on'} ${formattedDate}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        return expiryHtml;
    }
    
    // Fonction pour mettre à jour le message de bienvenue
    function updateWelcomeMessage(user) {
        const welcomeDiv = document.getElementById('welcomeMessage');
        if (!welcomeDiv) return;
        
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
            const vipText = window.translationManager?.getTranslation('dashboard.vip_member') || 'Membre VIP';
            welcomeHTML += ` <span class="vip-badge">
                    <i class="fas fa-crown"></i>
                    <span>${vipText}</span>
                </span>`;
        } else {
            welcomeHTML += ' 👋';
        }
        
        welcomeHTML += `</h1></div>`;
        welcomeDiv.innerHTML = welcomeHTML;
    }
    
    async function loadDashboard() {
        // Protection contre les appels multiples
        if (isLoadingDashboard || dashboardLoaded) {
            console.log('⚠️ loadDashboard déjà en cours ou complété, ignoré');
            return;
        }
        
        isLoadingDashboard = true;
        console.log('📊 Début chargement dashboard...');
        
        try {
            const user = window.authManager?.getCurrentUser();
            
            if (!user) {
                console.log('Utilisateur non trouvé');
                isLoadingDashboard = false;
                return;
            }
            
            await loadUserData(user);
            
            const loadingSection = document.getElementById('loadingSection');
            const dashboardContent = document.getElementById('dashboardContent');
            const dashboardActions = document.getElementById('dashboardActions');
            
            if (loadingSection) loadingSection.style.display = 'none';
            if (dashboardContent) dashboardContent.style.display = 'block';
            if (dashboardActions) dashboardActions.style.display = 'flex';
            
            dashboardLoaded = true;
            isLoadingDashboard = false;
            console.log('✅ Dashboard chargé avec succès');
            
        } catch (error) {
            console.error('Erreur chargement dashboard:', error);
            isLoadingDashboard = false;
            
            const loadingSection = document.getElementById('loadingSection');
            if (loadingSection) {
                loadingSection.innerHTML = `
                    <div style="color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${window.translationManager?.getTranslation('dashboard.error_loading') || 'Erreur lors du chargement du dashboard. Veuillez rafraîchir la page.'}</p>
                        <button onclick="location.reload()" style="margin-top: 15px; padding: 10px 20px; background: #3c84f6; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            ${window.translationManager?.getTranslation('dashboard.refresh') || 'Rafraîchir'}
                        </button>
                    </div>
                `;
            }
        }
    }
    
    async function loadUserData(user) {
        const welcomeDiv = document.getElementById('welcomeMessage');
        
        if (!welcomeDiv) return;
        
        // Mettre à jour le message de bienvenue
        updateWelcomeMessage(user);
        
        // Mettre à jour les informations du profil
        updateProfileInfo(user);
        
        // Attendre que le client Supabase soit réellement initialisé
        // (window.supabase peut déjà contenir le constructeur CDN avant que le client soit créé)
        if (window.supabaseInitialized) {
            await window.supabaseInitialized;
        }

        if (window.supabase && typeof window.supabase.from === 'function') {
            try {
                // Charger les forfaits
                await loadUserPackages(user.id);
                
                // Charger les réservations à venir
                await loadUpcomingLessons(user.id);
                
            } catch (error) {
                console.error('Erreur chargement données:', error);
            }
        } else {
            console.warn('⚠️ Client Supabase non prêt, données non chargées');
        }
    }
    
    // Détection de changement de timezone : vérifie toutes les 30s et met à jour l'affichage + la BDD
    let _lastDetectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setInterval(async () => {
        const currentTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (currentTz !== _lastDetectedTimezone) {
            console.log(`🌍 Timezone changée: ${_lastDetectedTimezone} → ${currentTz}`);
            _lastDetectedTimezone = currentTz;

            // Mettre à jour l'affichage immédiatement
            const user = window.authManager?.getCurrentUser();
            if (user) {
                updateProfileInfo(user);

                // Persister en BDD si Supabase est disponible
                if (window.supabase && user.id) {
                    try {
                        await window.supabase
                            .from('profiles')
                            .update({ timezone: currentTz, updated_at: new Date().toISOString() })
                            .eq('id', user.id);
                        console.log('✅ Timezone mis à jour en BDD:', currentTz);

                        // Mettre à jour le cache local
                        if (user.profile) user.profile.timezone = currentTz;
                        if (window.authManager?.saveUserToStorage) {
                            window.authManager.saveUserToStorage();
                        }
                    } catch (e) {
                        console.warn('⚠️ Impossible de sauvegarder la timezone en BDD:', e);
                    }
                }
            }
        }
    }, 30000);

    // Convertit un identifiant IANA (ex: "UTC", "Asia/Colombo") en label UTC±H:MM lisible
    function formatTimezoneLabel(ianaTimezone) {
        try {
            const now = new Date();

            // Formatter la même date en UTC et dans la timezone cible, puis calculer la diff
            const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
            const tzDate  = new Date(now.toLocaleString('en-US', { timeZone: ianaTimezone }));

            // offsetMinutes positif = en avance sur UTC (ex: Colombo = +330)
            const offsetMinutes = (tzDate - utcDate) / 60000;

            const sign       = offsetMinutes >= 0 ? '+' : '-';
            const absMinutes = Math.abs(offsetMinutes);
            const hours      = Math.floor(absMinutes / 60);
            const minutes    = absMinutes % 60;

            const offsetStr = minutes > 0
                ? `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`
                : `UTC${sign}${hours}`;

            return `${ianaTimezone} (${offsetStr})`;
        } catch (e) {
            return ianaTimezone;
        }
    }

    function updateProfileInfo(user) {
        const profileInfo = document.getElementById('profileInfo');
        if (!profileInfo) return;
        
        const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
        
        const joinDate = new Date(user.created_at).toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        // profile.timezone n'est jamais écrit en BDD → on utilise la timezone réelle du navigateur
        const rawTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || user.profile?.timezone || 'UTC';
        const timezone = formatTimezoneLabel(rawTimezone);

        // Persister la timezone en BDD si elle a changé ou n'est pas encore enregistrée
        if (window.supabase && user.id && user.profile?.timezone !== rawTimezone) {
            window.supabase
                .from('profiles')
                .update({ timezone: rawTimezone, updated_at: new Date().toISOString() })
                .eq('id', user.id)
                .then(() => {
                    if (user.profile) user.profile.timezone = rawTimezone;
                    if (window.authManager?.saveUserToStorage) window.authManager.saveUserToStorage();
                    console.log('✅ Timezone synchronisée en BDD:', rawTimezone);
                })
                .catch(e => console.warn('⚠️ Sync timezone BDD échouée:', e));
        }
        const frenchLevel = user.profile?.french_level || (isFrench ? 'Non spécifié' : 'Not specified');
        
        profileInfo.innerHTML = `
            <div class="profile-field">
                <span class="profile-label">${window.translationManager?.getTranslation('dashboard.email_label') || 'Email'}</span>
                <span class="profile-value">${user.email}</span>
            </div>
            <div class="profile-field">
                <span class="profile-label">${window.translationManager?.getTranslation('dashboard.member_since') || 'Membre depuis'}</span>
                <span class="profile-value">${joinDate}</span>
            </div>
            <div class="profile-field">
                <span class="profile-label">${window.translationManager?.getTranslation('dashboard.timezone') || 'Fuseau horaire'}</span>
                <span class="profile-value">${timezone}</span>
            </div>
            <div class="profile-field">
                <span class="profile-label">${window.translationManager?.getTranslation('dashboard.level') || 'Niveau'}</span>
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
            // Attendre que le client Supabase soit réellement initialisé
            if (window.supabaseInitialized) {
                await window.supabaseInitialized;
            }
            
            if (!window.supabase || typeof window.supabase.from !== 'function') {
                throw new Error('Client Supabase non initialisé');
            }
            
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
        if (!container) return;
        
        const packageNames = getPackageNames();
        
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
                            <span>${window.translationManager?.getTranslation('dashboard.package_30min') || '30min'}</span>
                        </div>
                        <div class="duration-credits">${typeData[30] || 0}</div>
                    </div>
                    <div class="duration-row">
                        <div class="duration-label">
                            <i class="far fa-clock"></i>
                            <span>${window.translationManager?.getTranslation('dashboard.package_45min') || '45min'}</span>
                        </div>
                        <div class="duration-credits">${typeData[45] || 0}</div>
                    </div>
                    <div class="duration-row">
                        <div class="duration-label">
                            <i class="far fa-clock"></i>
                            <span>${window.translationManager?.getTranslation('dashboard.package_60min') || '60min'}</span>
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
        try {
            // Attendre que le client Supabase soit réellement initialisé
            if (window.supabaseInitialized) {
                await window.supabaseInitialized;
            }
            
            if (!window.supabase || typeof window.supabase.from !== 'function') {
                throw new Error('Client Supabase non initialisé');
            }
            
            const { data: bookings, error } = await supabase
                .from('upcoming_bookings')
                .select('*')
                .eq('user_id', userId)
                .order('start_time', { ascending: true });
                
            if (error) throw error;
            
            // DEBUG: Vérifier si meeting_link est présent
            if (bookings && bookings.length > 0) {
                console.log('📊 Premier cours récupéré:', {
                    id: bookings[0].id,
                    booking_number: bookings[0].booking_number,
                    platform: bookings[0].platform,
                    meeting_link: bookings[0].meeting_link,
                    has_meeting_link: !!bookings[0].meeting_link
                });
            }
            
            const nextLessonContent = document.getElementById('nextLessonContent');
            const lessonNav = document.getElementById('lessonNav');
            const externalActions = document.getElementById('lessonExternalActions');
            
            if (!bookings || bookings.length === 0) {
                nextLessonContent.innerHTML = `
                    <div class="no-upcoming">
                        <i class="far fa-calendar"></i>
                        <p>${window.translationManager?.getTranslation('dashboard.no_lessons_message') || 'Aucun cours programmé'}</p>
                    </div>
                `;
                lessonNav.style.display = 'none';
                externalActions.style.display = 'none';
                return;
            }
            
            upcomingLessons = bookings;
            currentLessonIndex = 0;
            
            // CORRECTION BUG: Si meeting_link est absent, le récupérer depuis la table bookings
            // Cela peut arriver si la vue upcoming_bookings ne contient pas ce champ
            const needsMeetingLink = bookings.some(b => !b.meeting_link && b.id);
            if (needsMeetingLink) {
                console.log('⚠️ meeting_link absent dans upcoming_bookings, récupération depuis bookings...');
                
                try {
                    const bookingIds = bookings.filter(b => b.id).map(b => b.id);
                    const { data: fullBookings, error: fullError } = await supabase
                        .from('bookings')
                        .select('id, meeting_link, platform')
                        .in('id', bookingIds);
                    
                    if (!fullError && fullBookings) {
                        // Merger les meeting_link dans upcomingLessons
                        upcomingLessons = bookings.map(lesson => {
                            const fullBooking = fullBookings.find(fb => fb.id === lesson.id);
                            if (fullBooking && fullBooking.meeting_link) {
                                return { ...lesson, meeting_link: fullBooking.meeting_link };
                            }
                            return lesson;
                        });
                        console.log('✅ meeting_link récupérés depuis bookings');
                    }
                } catch (linkError) {
                    console.warn('⚠️ Impossible de récupérer meeting_link:', linkError);
                }
            }
            
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
                    <p>${window.translationManager?.getTranslation('dashboard.error_loading_lessons') || 'Erreur de chargement des cours'}</p>
                    ${error.message.includes('Failed to fetch') || error.message.includes('CORS') ? 
                        '<small>Veuillez vérifier votre connexion ou réessayer plus tard</small>' : ''}
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
        
        if (!nextLessonContent || !lessonCounter) return;
        
        // Mettre à jour le compteur
        lessonCounter.textContent = `${currentLessonIndex + 1}/${upcomingLessons.length}`;
        
        const lessonDate = new Date(lesson.start_time);
        const hoursUntilStart = calculateHoursUntilStart(lesson.start_time);
        const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
        
        // Vérifier si l'annulation est possible (plus de 24h)
        const canCancel = hoursUntilStart > 24 && lesson.status !== 'cancelled';
        
        // Mapping des plateformes pour l'affichage
        const platformNames = {
            'zoom': 'Zoom',
            'meet': isFrench ? 'Google Meet' : 'Google Meet',
            'teams': isFrench ? 'Microsoft Teams' : 'Microsoft Teams',
            'other': isFrench ? 'Autre' : 'Other'
        };
        
        const platformName = platformNames[lesson.platform] || lesson.platform || 'Zoom';
        
        nextLessonContent.innerHTML = `
            <div class="upcoming-lesson-card">
                <div class="lesson-date">
                    <i class="fas fa-calendar-alt"></i>
                    ${lessonDate.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long',
                        year: 'numeric'
                    })}
                </div>
                <div class="lesson-info">
                    <div class="lesson-info-item">
                        <span class="lesson-info-label">${window.translationManager?.getTranslation('dashboard.lesson_time') || 'Heure'}</span>
                        <span class="lesson-info-value">${lessonDate.toLocaleTimeString(isFrench ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="lesson-info-item">
                        <span class="lesson-info-label">${window.translationManager?.getTranslation('dashboard.lesson_duration') || 'Durée'}</span>
                        <span class="lesson-info-value">${lesson.duration_minutes || 60} min</span>
                    </div>
                    <div class="lesson-info-item">
                        <span class="lesson-info-label">${window.translationManager?.getTranslation('dashboard.lesson_type') || 'Type'}</span>
                        <span class="lesson-info-value">${lesson.course_type || (isFrench ? 'Cours' : 'Lesson')}</span>
                    </div>
                    <div class="lesson-info-item">
                        <span class="lesson-info-label">${window.translationManager?.getTranslation('dashboard.lesson_platform') || 'Plateforme'}</span>
                        <span class="lesson-info-value">${platformName}</span>
                    </div>
                    <div class="lesson-info-item">
                        <span class="lesson-info-label">${window.translationManager?.getTranslation('dashboard.lesson_reference') || 'Référence'}</span>
                        <span class="lesson-info-value">${lesson.booking_number || '#' + (lesson.id ? lesson.id.substring(0, 8) : '')}</span>
                    </div>
                    ${hoursUntilStart <= 24 ? `
                    <div class="lesson-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>${window.translationManager?.getTranslation('dashboard.cancel_not_allowed') || 'Annulation impossible (moins de 24h avant le cours)'}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // ============================================================================
        // AFFICHER LES BOUTONS EN DEHORS DE LA CARTE
        // ============================================================================
        if (externalActions) {
            externalActions.style.display = 'flex';
            externalActions.innerHTML = '';
            
            // Bouton d'annulation (seulement si possible)
            if (canCancel) {
                const cancelButton = document.createElement('button');
                cancelButton.className = 'btn-external btn-cancel-external';
                cancelButton.innerHTML = `<i class="fas fa-times"></i> ${window.translationManager?.getTranslation('dashboard.cancel_lesson_btn') || 'Annuler le cours'}`;
                
                // Utiliser addEventListener (plus propre que onclick)
                cancelButton.addEventListener('click', async function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    await handleCancelLesson(lesson.id);
                });
                
                externalActions.appendChild(cancelButton);
            }
            
            // Bouton de connexion (toujours visible si lien disponible)
            if (lesson.meeting_link) {
                const joinLink = document.createElement('a');
                joinLink.href = lesson.meeting_link;
                joinLink.target = '_blank';
                joinLink.className = 'btn-external btn-join-external';
                joinLink.innerHTML = `<i class="fas fa-video"></i> ${window.translationManager?.getTranslation('dashboard.join_lesson_btn') || 'Rejoindre'}`;
                externalActions.appendChild(joinLink);
            }
            
            // Si aucun bouton n'est affiché, masquer la div
            if (!canCancel && !lesson.meeting_link) {
                externalActions.style.display = 'none';
            }
        }
    }
    
    async function handleCancelLesson(bookingId) {
        const user = window.authManager?.getCurrentUser();
        if (!user) {
            alert(window.translationManager?.getTranslation('dashboard.login_required_cancel') || 'Vous devez être connecté pour annuler un cours');
            return;
        }
        
        // Vérifier que bookingCancellation est disponible
        if (!window.bookingCancellation) {
            console.error('❌ Service d\'annulation non disponible');
            
            // Fallback: essayer avec l'appel RPC direct
            await handleCancelLessonFallback(bookingId, user);
            return;
        }
        
        try {
            console.log('🔍 Récupération informations du cours...');
            
            // Récupérer les infos du cours pour affichage dans la confirmation
            const lesson = upcomingLessons.find(l => l.id === bookingId);
            if (!lesson) {
                alert(window.translationManager?.getTranslation('dashboard.lesson_not_found') || 'Cours non trouvé');
                return;
            }
            
            const lessonDate = new Date(lesson.start_time);
            const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
            const formattedDate = lessonDate.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Calculer les heures restantes
            const hoursUntilStart = (lessonDate - new Date()) / (1000 * 60 * 60);
            
            // Message de confirmation adapté
            let confirmMessage = isFrench ? 
                `Êtes-vous sûr de vouloir annuler ce cours ?\n\n📅 ${formattedDate}\n📚 ${lesson.course_type}\n⏱️ ${lesson.duration_minutes || 60}min` :
                `Are you sure you want to cancel this lesson?\n\n📅 ${formattedDate}\n📚 ${lesson.course_type}\n⏱️ ${lesson.duration_minutes || 60}min`;
            
            if (hoursUntilStart > 24) {
                const isCreditPayment = lesson.payment_method === 'credit';
                if (isCreditPayment) {
                    confirmMessage += isFrench ? 
                        '\n\n💰 Un crédit sera ajouté à votre compte' :
                        '\n\n💰 A credit will be added to your account';
                }
            } else {
                confirmMessage += isFrench ? 
                    '\n\n⚠️ Le cours commence dans moins de 24h\n❌ Aucun crédit ne sera remboursé' :
                    '\n\n⚠️ The lesson starts in less than 24 hours\n❌ No credit will be refunded';
            }
            
            if (!confirm(confirmMessage)) {
                return;
            }
            
            // Désactiver le bouton pendant le traitement
            const cancelBtn = document.querySelector('.btn-cancel-external');
            if (cancelBtn) {
                cancelBtn.disabled = true;
                cancelBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isFrench ? 'Annulation en cours...' : 'Cancelling...'}`;
            }
            
            console.log('🎫 Utilisation de bookingCancellation.cancelBooking...');
            
            // Appel via bookingCancellation.cancelBooking()
            const result = await window.bookingCancellation.cancelBooking(bookingId, user.id);
            
            console.log('📥 Résultat annulation:', result);
            
            if (result.success) {
                console.log('✅ Annulation complète réussie');
                
                let successMessage = isFrench ? '✅ Cours annulé avec succès' : '✅ Lesson cancelled successfully';
                
                // Message sur le crédit uniquement si remboursé
                if (result.creditRefunded) {
                    successMessage += isFrench ? '\n💰 1 crédit ajouté à votre compte' : '\n💰 1 credit added to your account';
                }
                
                // Afficher le message
                if (window.utils && window.utils.showNotification) {
                    window.utils.showNotification(successMessage, 'success');
                } else {
                    showDetailedAnnulationMessage(successMessage);
                }
                
                // Rafraîchir les données du dashboard
                console.log('🔄 Rafraîchissement du dashboard...');
                await loadUpcomingLessons(user.id);
                
                // Rafraîchir les forfaits si un crédit a été remboursé
                if (result.creditRefunded && window.packagesManager) {
                    console.log('🔄 Rafraîchissement des forfaits...');
                    await loadUserPackages(user.id);
                }
                
            } else {
                console.warn('⚠️ Annulation échouée ou partielle');
                
                let errorMessage = result.error || (isFrench ? 'Annulation impossible' : 'Cancellation failed');
                
                if (window.utils && window.utils.showNotification) {
                    window.utils.showNotification(errorMessage, 'error');
                } else {
                    alert((isFrench ? 'Erreur : ' : 'Error: ') + errorMessage);
                }
                
                // Rafraîchir quand même
                await loadUpcomingLessons(user.id);
            }
            
        } catch (error) {
            console.error('❌ Erreur annulation:', error);
            
            // Réactiver le bouton
            const cancelBtn = document.querySelector('.btn-cancel-external');
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.innerHTML = `<i class="fas fa-times"></i> ${window.translationManager?.getTranslation('dashboard.cancel_lesson_btn') || 'Annuler le cours'}`;
            }
            
            // Afficher message d'erreur
            let errorMessage = error.message || (isFrench ? 'Erreur lors de l\'annulation' : 'Error during cancellation');
            
            if (errorMessage.includes('moins de 24h') || errorMessage.includes('less than 24h')) {
                errorMessage = isFrench ? 'Annulation impossible : le cours commence dans moins de 24h' : 'Cancellation not possible: lesson starts in less than 24h';
            } else if (errorMessage.includes('déjà annulée') || errorMessage.includes('already cancelled') || errorMessage.includes('cancelled')) {
                errorMessage = isFrench ? 'Cette réservation est déjà annulée' : 'This booking is already cancelled';
            } else if (errorMessage.includes('non trouvée') || errorMessage.includes('not found')) {
                errorMessage = isFrench ? 'Réservation introuvable' : 'Booking not found';
            } else if (errorMessage.includes('Failed to fetch')) {
                errorMessage = isFrench ? 'Erreur de connexion au serveur. Veuillez vérifier votre connexion.' : 'Server connection error. Please check your connection.';
            }
            
            if (window.utils && window.utils.showNotification) {
                window.utils.showNotification(errorMessage, 'error');
            } else {
                showDetailedAnnulationMessage('❌ ' + errorMessage, 'error');
            }
        }
    }
    
    function showDetailedAnnulationMessage(message, type = 'success') {
        // Créer une modal pour afficher le message détaillé
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: ${type === 'error' ? '#d32f2f' : '#333'};
        `;
        
        // Convertir les retours à la ligne en <br>
        const formattedMessage = message.replace(/\n/g, '<br>');
        messageDiv.innerHTML = formattedMessage;
        
        const closeButton = document.createElement('button');
        closeButton.textContent = window.translationManager?.getTranslation('dashboard.close') || 'Fermer';
        closeButton.style.cssText = `
            margin-top: 20px;
            padding: 10px 20px;
            background: #3c84f6;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            display: block;
            margin-left: auto;
            margin-right: auto;
        `;
        
        closeButton.onclick = function() {
            document.body.removeChild(modal);
        };
        
        content.appendChild(messageDiv);
        content.appendChild(closeButton);
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Fermer en cliquant en dehors
        modal.onclick = function(e) {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };
    }
    
    async function handleCancelLessonFallback(bookingId, user) {
        // Fallback: utiliser l'appel RPC direct (ancienne méthode)
        try {
            console.log('⚠️ Utilisation du fallback RPC pour l\'annulation');
            
            // Désactiver le bouton pendant le traitement
            const cancelBtn = document.querySelector('.btn-cancel-external');
            if (cancelBtn) {
                cancelBtn.disabled = true;
                const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
                cancelBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isFrench ? 'Annulation en cours...' : 'Cancelling...'}`;
            }
            
            console.log('📞 Appel RPC cancel_booking_safe...');
            
            const { data: result, error } = await supabase
                .rpc('cancel_booking_safe', {
                    p_booking_id: bookingId
                });
            
            if (error) {
                console.error('❌ Erreur RPC:', error);
                throw new Error(error.message || (isFrench ? 'Erreur lors de l\'annulation' : 'Error during cancellation'));
            }
            
            console.log('📥 Résultat RPC:', result);
            
            if (result.success) {
                console.log('✅ Annulation DB réussie');
                
                let successMessage = isFrench ? '✅ Cours annulé avec succès' : '✅ Lesson cancelled successfully';
                
                if (result.credit_refunded) {
                    successMessage += isFrench ? '\n💰 1 crédit ajouté à votre compte' : '\n💰 1 credit added to your account';
                }
                
                showDetailedAnnulationMessage(successMessage);
                
                // Rafraîchir les données du dashboard
                await loadUpcomingLessons(user.id);
                
                // Rafraîchir les forfaits si un crédit a été remboursé
                if (result.credit_refunded && window.packagesManager) {
                    await loadUserPackages(user.id);
                }
            } else {
                showDetailedAnnulationMessage((isFrench ? 'Erreur : ' : 'Error: ') + (result.error || (isFrench ? 'Annulation impossible' : 'Cancellation failed')), 'error');
            }
            
        } catch (error) {
            console.error('❌ Erreur fallback annulation:', error);
            
            // Réactiver le bouton
            const cancelBtn = document.querySelector('.btn-cancel-external');
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.innerHTML = `<i class="fas fa-times"></i> ${window.translationManager?.getTranslation('dashboard.cancel_lesson_btn') || 'Annuler le cours'}`;
            }
            
            showDetailedAnnulationMessage('❌ ' + error.message, 'error');
        }
    }
    
    function updateLessonNavigation() {
        const prevBtn = document.getElementById('prevLessonBtn');
        const nextBtn = document.getElementById('nextLessonBtn');
        
        if (prevBtn) prevBtn.disabled = currentLessonIndex === 0;
        if (nextBtn) nextBtn.disabled = currentLessonIndex === upcomingLessons.length - 1;
    }
    
    // Gestion de la déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    const refreshBtn = document.getElementById('refreshDashboardBtn');
    const prevLessonBtn = document.getElementById('prevLessonBtn');
    const nextLessonBtn = document.getElementById('nextLessonBtn');
    
    async function handleLogout() {
        const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
        const confirmMessage = isFrench ? 
            'Voulez-vous vraiment vous déconnecter ?' : 
            'Are you sure you want to log out?';
        
        if (confirm(confirmMessage)) {
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
                const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
                this.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isFrench ? 'Actualisation...' : 'Refreshing...'}`;
                
                // Réinitialiser les flags pour permettre un nouveau chargement
                dashboardLoaded = false;
                isLoadingDashboard = false;
                
                await loadUserData(user);
                this.innerHTML = `<i class="fas fa-sync-alt"></i> ${window.translationManager?.getTranslation('dashboard.refresh') || 'Actualiser'}`;
                
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
    
    // Écouter les changements de langue
    window.addEventListener('language:changed', function() {
        console.log('🌍 Changement de langue détecté, mise à jour du dashboard...');
        
        const user = window.authManager?.getCurrentUser();
        if (user) {
            // Mettre à jour le message de bienvenue
            updateWelcomeMessage(user);
            
            // Mettre à jour les informations du profil
            updateProfileInfo(user);
            
            // Mettre à jour la carte de forfait actuelle
            if (window.packagesData && currentPackageIndex < packageTypes.length) {
                const currentType = packageTypes[currentPackageIndex];
                showPackageCard(currentType, window.packagesData[currentType] || { 30: 0, 45: 0, 60: 0, expiry: null });
            }
            
            // Mettre à jour l'affichage du cours actuel
            if (upcomingLessons.length > 0) {
                displayCurrentLesson();
            }
            
            // Mettre à jour les boutons de cours
            updateCourseButtons();
        }
    });
    
    // Fonction pour mettre à jour les boutons de cours
    function updateCourseButtons() {
        const conversationBtn = document.querySelector('[href="booking.html?type=conversation"] .course-button-title');
        const curriculumBtn = document.querySelector('[href="booking.html?type=curriculum"] .course-button-title');
        const examBtn = document.querySelector('[href="booking.html?type=examen"] .course-button-title');
        
        if (conversationBtn) {
            conversationBtn.textContent = window.translationManager?.getTranslation('dashboard.conversation_btn') || 'Conversation';
        }
        
        if (curriculumBtn) {
            curriculumBtn.textContent = window.translationManager?.getTranslation('dashboard.curriculum_btn') || 'Curriculum';
        }
        
        if (examBtn) {
            examBtn.textContent = window.translationManager?.getTranslation('dashboard.exam_btn') || 'Préparation d\'examen';
        }
    }
    
    // Initialiser le PackagesManager si nécessaire
    if (window.packagesManager && !window.packagesManager.isInitialized) {
        window.packagesManager.initialize();
    }
    
    // Exposer les fonctions globalement
    window.loadDashboard = loadDashboard;
    window.updateWelcomeMessage = updateWelcomeMessage;
    window.updateProfileInfo = updateProfileInfo;
});