// dashboard.js – version corrigée (écran blanc résolu)
console.log("📊 dashboard.js chargé");

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

let isLoadingDashboard = false;
let dashboardLoaded = false;

// Fonction pour forcer l'affichage du body
function forceShowBody() {
    document.body.classList.add('loaded');
    document.body.style.opacity = '1';
    document.body.style.visibility = 'visible';
}

document.addEventListener('DOMContentLoaded', () => {
    // Masquer le body au départ (pour l'effet de chargement)
    document.body.style.opacity = '0';
    document.body.style.visibility = 'hidden';
    
    window.addEventListener('error', function(e) {
        console.error('Erreur globale dashboard:', e.error);
    });

    window.addEventListener('auth:login', function() {
        console.log('✅ Événement auth:login reçu, dashboard prêt');
        forceShowBody(); // Afficher immédiatement
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
        const storedUser = localStorage.getItem('yoteacher_user');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                console.log('✅ Utilisateur trouvé dans localStorage:', userData.email);
                if (!window.authManager) {
                    window.authManager = {
                        user: userData,
                        isAuthenticated: () => true,
                        getCurrentUser: () => userData
                    };
                } else if (!window.authManager.user) {
                    window.authManager.user = userData;
                }
                forceShowBody(); // Afficher immédiatement
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
        
        let attempts = 0;
        const maxAttempts = 30;
        function checkAuthManager() {
            attempts++;
            if (window.authManager && typeof window.authManager.isAuthenticated === 'function') {
                if (window.authManager.isAuthenticated()) {
                    console.log('✅ Utilisateur authentifié via authManager');
                    forceShowBody(); // Afficher immédiatement
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
        'conversation': '#2d8de2',
        'curriculum': '#636dcd',
        'examen': '#135cb7'
    };
    const packageIcons = {
        'conversation': 'fas fa-comments',
        'curriculum': 'fas fa-book',
        'examen': 'fas fa-graduation-cap'
    };
    
    // Variables pour l'historique des cours
    let lessonHistory = [];
    let currentHistoryPage = 0;
    const HISTORY_PER_PAGE = 5;
    
    function getPackageNames() {
        const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
        return {
            'conversation': isFrench ? 'Conversation' : 'Conversation',
            'curriculum': isFrench ? 'Cours' : 'Course',
            'examen': isFrench ? 'Examen' : 'Exam'
        };
    }
    
    function calculateHoursUntilStart(startTime) {
        const now = new Date();
        const lessonDate = new Date(startTime);
        const hoursUntilStart = (lessonDate - now) / (1000 * 60 * 60);
        return hoursUntilStart;
    }
    
    function calculateDaysRemaining(expiryDate) {
        if (!expiryDate) return null;
        const expiry = new Date(expiryDate);
        const now = new Date();
        const timeDiff = expiry.getTime() - now.getTime();
        return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    }
    
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
            greeting = hour < 18 ? 'Bonjour' : 'Bonsoir';
        }
        let welcomeHTML = `
            <div class="welcome-message">
                <h1>${greeting} ${userName} !`;
        if (user.profile?.is_vip) {
            const vipText = window.translationManager?.getTranslation('dashboard.vip_member') || 'Membre VIP';
            welcomeHTML += ` <span class="vip-badge"><i class="fas fa-crown"></i><span>${vipText}</span></span>`;
        } else {
            welcomeHTML += ' 👋';
        }
        welcomeHTML += `</h1></div>`;
        welcomeDiv.innerHTML = welcomeHTML;
    }
    
    async function loadDashboard() {
        if (isLoadingDashboard || dashboardLoaded) {
            console.log('⚠️ loadDashboard déjà en cours ou complété, ignoré');
            return;
        }
        isLoadingDashboard = true;
        console.log('📊 Début chargement dashboard...');

        function _showDashboardContent() {
            const loadingSection = document.getElementById('loadingSection');
            const dashboardContent = document.getElementById('dashboardContent');
            const dashboardActions = document.getElementById('dashboardActions');
            if (loadingSection) loadingSection.style.display = 'none';
            if (dashboardContent) dashboardContent.style.display = 'block';
            if (dashboardActions) dashboardActions.style.display = 'flex';
        }

        // Timeout de sécurité absolu : afficher le contenu après 12s quoi qu'il arrive
        const safetyTimer = setTimeout(() => {
            console.warn('⚠️ Safety timeout déclenché, forçage affichage dashboard');
            _showDashboardContent();
            dashboardLoaded = true;
            isLoadingDashboard = false;
        }, 12000);

        try {
            const user = window.authManager?.getCurrentUser();
            if (!user) {
                console.log('Utilisateur non trouvé');
                isLoadingDashboard = false;
                clearTimeout(safetyTimer);
                return;
            }
            await loadUserData(user);
            clearTimeout(safetyTimer);
            _showDashboardContent();
            dashboardLoaded = true;
            isLoadingDashboard = false;
            console.log('✅ Dashboard chargé avec succès');
        } catch (error) {
            clearTimeout(safetyTimer);
            console.error('Erreur chargement dashboard:', error);
            isLoadingDashboard = false;
            // Afficher le dashboard quand même
            _showDashboardContent();
            const loadingSection = document.getElementById('loadingSection');
            if (loadingSection) {
                loadingSection.style.display = 'block';
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
    
    function withTimeout(promise, ms, label) {
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)
        );
        return Promise.race([promise, timeout]);
    }

    async function loadUserData(user) {
        const welcomeDiv = document.getElementById('welcomeMessage');
        if (!welcomeDiv) return;
        updateWelcomeMessage(user);
        updateProfileInfo(user);

        // Attendre Supabase avec timeout de sécurité (5s max)
        if (window.supabaseInitialized) {
            try {
                await withTimeout(window.supabaseInitialized, 5000, 'supabaseInitialized');
            } catch (e) {
                console.warn('⚠️ Supabase init timeout, tentative de continuer...', e.message);
            }
        }

        if (window.supabase && typeof window.supabase.from === 'function') {
            try {
                // Chargements en parallèle avec timeout global de 10 secondes
                await withTimeout(
                    Promise.allSettled([
                        loadUserPackages(user.id),
                        loadUpcomingLessons(user.id),
                        loadLessonHistory(user.id),
                    ]),
                    10000,
                    'chargement données dashboard'
                );
            } catch (error) {
                // Timeout global atteint : afficher le dashboard quand même avec ce qui est chargé
                console.warn('⚠️ Timeout chargement données, affichage partiel:', error.message);
                const nextLessonContent = document.getElementById('nextLessonContent');
                if (nextLessonContent && !nextLessonContent.innerHTML.trim()) {
                    nextLessonContent.innerHTML = `<div class="no-upcoming"><i class="fas fa-wifi"></i><p>Impossible de charger les données. Vérifiez votre connexion et <button onclick="location.reload()" style="background:none;border:none;color:#3c84f6;cursor:pointer;text-decoration:underline">rafraîchissez</button>.</p></div>`;
                }
            }
        } else {
            console.warn('⚠️ Client Supabase non prêt, données non chargées');
            const nextLessonContent = document.getElementById('nextLessonContent');
            if (nextLessonContent) {
                nextLessonContent.innerHTML = `<div class="no-upcoming"><i class="fas fa-exclamation-triangle"></i><p>Connexion à la base de données impossible. <button onclick="location.reload()" style="background:none;border:none;color:#3c84f6;cursor:pointer;text-decoration:underline">Rafraîchir</button></p></div>`;
            }
        }
    }
    
    let _lastDetectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setInterval(async () => {
        const currentTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (currentTz !== _lastDetectedTimezone) {
            console.log(`🌍 Timezone changée: ${_lastDetectedTimezone} → ${currentTz}`);
            _lastDetectedTimezone = currentTz;
            const user = window.authManager?.getCurrentUser();
            if (user) {
                updateProfileInfo(user);
                if (window.supabase && user.id) {
                    try {
                        await window.supabase
                            .from('profiles')
                            .update({ timezone: currentTz, updated_at: new Date().toISOString() })
                            .eq('id', user.id);
                        console.log('✅ Timezone mis à jour en BDD:', currentTz);
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
    
    function formatTimezoneLabel(ianaTimezone) {
        try {
            const now = new Date();
            const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
            const tzDate  = new Date(now.toLocaleString('en-US', { timeZone: ianaTimezone }));
            const offsetMinutes = (tzDate - utcDate) / 60000;
            const sign = offsetMinutes >= 0 ? '+' : '-';
            const absMinutes = Math.abs(offsetMinutes);
            const hours = Math.floor(absMinutes / 60);
            const minutes = absMinutes % 60;
            const offsetStr = minutes > 0 ? `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}` : `UTC${sign}${hours}`;
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
        const rawTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || user.profile?.timezone || 'UTC';
        const timezone = formatTimezoneLabel(rawTimezone);
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
            showPackageCard('conversation', { 30: 0, 45: 0, 60: 0, expiry: null });
            return;
        }
        try {
            if (window.supabaseInitialized) await window.supabaseInitialized;
            if (!window.supabase || typeof window.supabase.from !== 'function') {
                throw new Error('Client Supabase non initialisé');
            }
            const packages = await window.packagesManager.getUserActivePackages(userId);
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
                    if (duration === 30) packagesByType[type][30] += remainingCredits;
                    else if (duration === 45) packagesByType[type][45] += remainingCredits;
                    else packagesByType[type][60] += remainingCredits;
                    const expiryDate = new Date(pkg.expires_at);
                    if (!packagesByType[type].expiry || expiryDate < new Date(packagesByType[type].expiry)) {
                        packagesByType[type].expiry = pkg.expires_at;
                    }
                }
            });
            window.packagesData = packagesByType;
            showPackageCard('conversation', packagesByType.conversation);
        } catch (error) {
            console.error('Erreur chargement forfaits:', error);
            showPackageCard('conversation', { 30: 0, 45: 0, 60: 0, expiry: null });
        }
    }
    
    function showPackageCard(type, typeData) {
        const container = document.getElementById('packagesContainer');
        if (!container) return;
        const packageNames = getPackageNames();
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
                        <div class="duration-label"><i class="far fa-clock"></i><span>${window.translationManager?.getTranslation('dashboard.package_30min') || '30min'}</span></div>
                        <div class="duration-credits">${typeData[30] || 0}</div>
                    </div>
                    <div class="duration-row">
                        <div class="duration-label"><i class="far fa-clock"></i><span>${window.translationManager?.getTranslation('dashboard.package_45min') || '45min'}</span></div>
                        <div class="duration-credits">${typeData[45] || 0}</div>
                    </div>
                    <div class="duration-row">
                        <div class="duration-label"><i class="far fa-clock"></i><span>${window.translationManager?.getTranslation('dashboard.package_60min') || '60min'}</span></div>
                        <div class="duration-credits">${typeData[60] || 0}</div>
                    </div>
                </div>
                ${expiryHtml}
            </div>
        `;
        const prevBtnInternal = document.getElementById('packagePrevBtnInternal');
        const nextBtnInternal = document.getElementById('packageNextBtnInternal');
        if (prevBtnInternal) prevBtnInternal.addEventListener('click', navigateToPrevPackage);
        if (nextBtnInternal) nextBtnInternal.addEventListener('click', navigateToNextPackage);
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
            if (window.supabaseInitialized) await window.supabaseInitialized;
            if (!window.supabase || typeof window.supabase.from !== 'function') {
                throw new Error('Client Supabase non initialisé');
            }
            const { data: bookings, error } = await supabase
                .from('upcoming_bookings')
                .select('*')
                .eq('user_id', userId)
                .order('start_time', { ascending: true });
            if (error) throw error;
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
                    ${error.message.includes('Failed to fetch') || error.message.includes('CORS') ? '<small>Veuillez vérifier votre connexion ou réessayer plus tard</small>' : ''}
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
        lessonCounter.textContent = `${currentLessonIndex + 1}/${upcomingLessons.length}`;
        const lessonDate = new Date(lesson.start_time);
        const hoursUntilStart = calculateHoursUntilStart(lesson.start_time);
        const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
        const canCancel = hoursUntilStart > 24 && lesson.status !== 'cancelled';
        const platformNames = {
            'zoom': 'Zoom',
            'meet': isFrench ? 'Google Meet' : 'Google Meet',
            'teams': isFrench ? 'Microsoft Teams' : 'Microsoft Teams',
            'other': isFrench ? 'Autre' : 'Other'
        };
        const platformName = platformNames[lesson.platform] || lesson.platform || 'Zoom';
        nextLessonContent.innerHTML = `
            <div class="upcoming-lesson-card">
                <div class="lesson-date"><i class="fas fa-calendar-alt"></i>${lessonDate.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div class="lesson-info">
                    <div class="lesson-info-item"><span class="lesson-info-label">${window.translationManager?.getTranslation('dashboard.lesson_time') || 'Heure'}</span><span class="lesson-info-value">${lessonDate.toLocaleTimeString(isFrench ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span></div>
                    <div class="lesson-info-item"><span class="lesson-info-label">${window.translationManager?.getTranslation('dashboard.lesson_duration') || 'Durée'}</span><span class="lesson-info-value">${lesson.duration_minutes || 60} min</span></div>
                    <div class="lesson-info-item"><span class="lesson-info-label">${window.translationManager?.getTranslation('dashboard.lesson_type') || 'Type'}</span><span class="lesson-info-value">${lesson.course_type || (isFrench ? 'Cours' : 'Lesson')}</span></div>
                    <div class="lesson-info-item"><span class="lesson-info-label">${window.translationManager?.getTranslation('dashboard.lesson_platform') || 'Plateforme'}</span><span class="lesson-info-value">${platformName}</span></div>
                    <div class="lesson-info-item"><span class="lesson-info-label">${window.translationManager?.getTranslation('dashboard.lesson_reference') || 'Référence'}</span><span class="lesson-info-value">${lesson.booking_number || '#' + (lesson.id ? lesson.id.substring(0, 8) : '')}</span></div>
                    ${hoursUntilStart <= 24 ? `<div class="lesson-warning"><i class="fas fa-exclamation-triangle"></i><span>${window.translationManager?.getTranslation('dashboard.cancel_not_allowed') || 'Annulation impossible (moins de 24h avant le cours)'}</span></div>` : ''}
                </div>
            </div>
        `;
        if (externalActions) {
            externalActions.style.display = 'flex';
            externalActions.innerHTML = '';
            if (canCancel) {
                const cancelButton = document.createElement('button');
                cancelButton.className = 'btn-external btn-cancel-external';
                cancelButton.innerHTML = `<i class="fas fa-times"></i> ${window.translationManager?.getTranslation('dashboard.cancel_lesson_btn') || 'Annuler le cours'}`;
                cancelButton.addEventListener('click', async function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    await handleCancelLesson(lesson.id);
                });
                externalActions.appendChild(cancelButton);
            }
            if (lesson.meeting_link) {
                const joinLink = document.createElement('a');
                joinLink.href = lesson.meeting_link;
                joinLink.target = '_blank';
                joinLink.className = 'btn-external btn-join-external';
                joinLink.innerHTML = `<i class="fas fa-video"></i> ${window.translationManager?.getTranslation('dashboard.join_lesson_btn') || 'Rejoindre'}`;
                externalActions.appendChild(joinLink);
            }
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
        if (!window.bookingCancellation) {
            console.error('❌ Service d\'annulation non disponible');
            await handleCancelLessonFallback(bookingId, user);
            return;
        }
        try {
            console.log('🔍 Récupération informations du cours...');
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
            const hoursUntilStart = (lessonDate - new Date()) / (1000 * 60 * 60);
            let confirmMessage = isFrench ? 
                `Êtes-vous sûr de vouloir annuler ce cours ?\n\n📅 ${formattedDate}\n📚 ${lesson.course_type}\n⏱️ ${lesson.duration_minutes || 60}min` :
                `Are you sure you want to cancel this lesson?\n\n📅 ${formattedDate}\n📚 ${lesson.course_type}\n⏱️ ${lesson.duration_minutes || 60}min`;
            if (hoursUntilStart > 24) {
                const isCreditPayment = lesson.payment_method === 'credit';
                if (isCreditPayment) {
                    confirmMessage += isFrench ? '\n\n💰 Un crédit sera ajouté à votre compte' : '\n\n💰 A credit will be added to your account';
                }
            } else {
                confirmMessage += isFrench ? '\n\n⚠️ Le cours commence dans moins de 24h\n❌ Aucun crédit ne sera remboursé' : '\n\n⚠️ The lesson starts in less than 24 hours\n❌ No credit will be refunded';
            }
            if (!confirm(confirmMessage)) return;
            const cancelBtn = document.querySelector('.btn-cancel-external');
            if (cancelBtn) {
                cancelBtn.disabled = true;
                cancelBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isFrench ? 'Annulation en cours...' : 'Cancelling...'}`;
            }
            console.log('🎫 Utilisation de bookingCancellation.cancelBooking...');
            const result = await window.bookingCancellation.cancelBooking(bookingId, user.id);
            console.log('📥 Résultat annulation:', result);
            if (result.success) {
                console.log('✅ Annulation complète réussie');
                let successMessage = isFrench ? '✅ Cours annulé avec succès' : '✅ Lesson cancelled successfully';
                if (result.creditRefunded) {
                    successMessage += isFrench ? '\n💰 1 crédit ajouté à votre compte' : '\n💰 1 credit added to your account';
                }
                if (window.utils && window.utils.showNotification) {
                    window.utils.showNotification(successMessage, 'success');
                } else {
                    showDetailedAnnulationMessage(successMessage);
                }
                console.log('🔄 Rafraîchissement du dashboard...');
                await loadUpcomingLessons(user.id);
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
                await loadUpcomingLessons(user.id);
            }
        } catch (error) {
            console.error('❌ Erreur annulation:', error);
            const cancelBtn = document.querySelector('.btn-cancel-external');
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.innerHTML = `<i class="fas fa-times"></i> ${window.translationManager?.getTranslation('dashboard.cancel_lesson_btn') || 'Annuler le cours'}`;
            }
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
        const modal = document.createElement('div');
        modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;`;
        const content = document.createElement('div');
        content.style.cssText = `background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.3);`;
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `font-family: Arial, sans-serif; line-height: 1.6; color: ${type === 'error' ? '#d32f2f' : '#333'};`;
        const formattedMessage = message.replace(/\n/g, '<br>');
        messageDiv.innerHTML = formattedMessage;
        const closeButton = document.createElement('button');
        closeButton.textContent = window.translationManager?.getTranslation('dashboard.close') || 'Fermer';
        closeButton.style.cssText = `margin-top: 20px; padding: 10px 20px; background: #3c84f6; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; display: block; margin-left: auto; margin-right: auto;`;
        closeButton.onclick = function() { document.body.removeChild(modal); };
        content.appendChild(messageDiv);
        content.appendChild(closeButton);
        modal.appendChild(content);
        document.body.appendChild(modal);
        modal.onclick = function(e) { if (e.target === modal) document.body.removeChild(modal); };
    }
    
    async function handleCancelLessonFallback(bookingId, user) {
        try {
            console.log('⚠️ Utilisation du fallback RPC pour l\'annulation');
            const cancelBtn = document.querySelector('.btn-cancel-external');
            if (cancelBtn) {
                cancelBtn.disabled = true;
                const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
                cancelBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isFrench ? 'Annulation en cours...' : 'Cancelling...'}`;
            }
            console.log('📞 Appel RPC cancel_booking_safe...');
            const { data: result, error } = await supabase.rpc('cancel_booking_safe', { p_booking_id: bookingId });
            if (error) throw new Error(error.message);
            console.log('📥 Résultat RPC:', result);
            if (result.success) {
                let successMessage = isFrench ? '✅ Cours annulé avec succès' : '✅ Lesson cancelled successfully';
                if (result.credit_refunded) successMessage += isFrench ? '\n💰 1 crédit ajouté à votre compte' : '\n💰 1 credit added to your account';
                showDetailedAnnulationMessage(successMessage);
                await loadUpcomingLessons(user.id);
                if (result.credit_refunded && window.packagesManager) await loadUserPackages(user.id);
            } else {
                showDetailedAnnulationMessage((isFrench ? 'Erreur : ' : 'Error: ') + (result.error || 'Annulation impossible'), 'error');
            }
        } catch (error) {
            console.error('❌ Erreur fallback annulation:', error);
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
    
    // ========== HISTORIQUE DES COURS AVEC DOCUMENTS ==========
    async function loadLessonHistory(userId) {
        const container = document.getElementById('historyContent');
        if (!container) return;
        try {
            if (window.supabaseInitialized) await window.supabaseInitialized;
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from('bookings')
                .select(`id, start_time, duration_minutes, course_type, status, payment_method, booking_number, meeting_link, created_at`)
                .eq('user_id', userId)
                .lt('start_time', now)
                .order('start_time', { ascending: false });
            if (error) throw error;
            
            // OPTIMISATION : 1 requête .in() au lieu de N requêtes .eq()
            // Avant : 12 appels × ~350ms = ~3500ms
            // Après : 1 appel = ~150ms
            let docsByBookingId = {};
            if ((data || []).length > 0) {
                const bookingIds = (data || []).map(b => b.id);
                const { data: allDocs } = await supabase
                    .from('booking_documents')
                    .select('*')
                    .in('booking_id', bookingIds);
                for (const doc of allDocs || []) {
                    if (!docsByBookingId[doc.booking_id]) docsByBookingId[doc.booking_id] = [];
                    docsByBookingId[doc.booking_id].push(doc);
                }
            }
            const bookingsWithDocs = (data || []).map(b => ({
                ...b,
                documents: docsByBookingId[b.id] || [],
            }));
            
            lessonHistory = bookingsWithDocs;
            if (lessonHistory.length === 0) {
                container.innerHTML = `<div class="no-upcoming"><i class="far fa-calendar-alt"></i><p>${window.translationManager?.getTranslation('dashboard.no_history') || 'Aucun cours passé'}</p></div>`;
                const historyNav = document.getElementById('historyNav');
                if (historyNav) historyNav.style.display = 'none';
                return;
            }
            const historyNav = document.getElementById('historyNav');
            if (lessonHistory.length > HISTORY_PER_PAGE) {
                historyNav.style.display = 'flex';
            } else {
                historyNav.style.display = 'none';
            }
            currentHistoryPage = 0;
            renderHistoryPage();
        } catch (error) {
            console.error('Erreur chargement historique:', error);
            container.innerHTML = `<div class="no-upcoming"><i class="fas fa-exclamation-triangle"></i><p>${window.translationManager?.getTranslation('dashboard.error_loading_history') || 'Erreur lors du chargement de l\'historique'}</p></div>`;
        }
    }
    
    function renderHistoryPage() {
        const container = document.getElementById('historyContent');
        const counterSpan = document.getElementById('historyCounter');
        if (!container) return;
        const start = currentHistoryPage * HISTORY_PER_PAGE;
        const end = start + HISTORY_PER_PAGE;
        const pageItems = lessonHistory.slice(start, end);
        const totalPages = Math.ceil(lessonHistory.length / HISTORY_PER_PAGE);
        if (counterSpan) counterSpan.textContent = `${currentHistoryPage + 1}/${totalPages}`;
        
        const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
        const itemsHtml = pageItems.map(booking => {
            const lessonDate = new Date(booking.start_time);
            const formattedDate = lessonDate.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            let statusText = '', statusClass = '';
            switch (booking.status) {
                case 'confirmed': statusText = isFrench ? 'Confirmé' : 'Confirmed'; statusClass = 'badge-confirmed'; break;
                case 'completed': statusText = isFrench ? 'Terminé' : 'Completed'; statusClass = 'badge-completed'; break;
                case 'cancelled': statusText = isFrench ? 'Annulé' : 'Cancelled'; statusClass = 'badge-cancelled'; break;
                default: statusText = booking.status || '—'; statusClass = '';
            }
            const courseTypeLabel = booking.course_type ? booking.course_type.charAt(0).toUpperCase() + booking.course_type.slice(1) : (isFrench ? 'Cours' : 'Lesson');
            
            const docs = booking.documents || [];
            const iconsHtml = docs.map(doc => {
                let iconClass = 'fa-file';
                if (doc.document_type === 'pdf') iconClass = 'fa-file-pdf';
                else if (doc.document_type === 'image') iconClass = 'fa-file-image';
                else if (doc.document_type === 'text') iconClass = 'fa-paperclip';
                else if (doc.document_type === 'link') iconClass = 'fa-globe';
                return `<button class="btn-view-doc" data-doc='${JSON.stringify(doc)}' title="${escapeHtml(doc.document_name)}"><i class="fas ${iconClass}"></i></button>`;
            }).join('');
            
            return `
                <div class="history-item ${booking.status === 'cancelled' ? 'history-item-cancelled' : ''}">
                    <div class="history-header">
                        <div class="history-date"><i class="far fa-calendar-alt"></i> ${formattedDate}</div>
                        <div class="history-badge ${statusClass}">${statusText}</div>
                    </div>
                    <div class="history-details">
                        <span><i class="fas fa-chalkboard-user"></i> ${courseTypeLabel}</span>
                        <span><i class="far fa-clock"></i> ${booking.duration_minutes || 60} min</span>
                        <span><i class="fas fa-tag"></i> ${booking.booking_number || '#' + booking.id.substring(0,8)}</span>
                        ${iconsHtml ? `<span class="document-icons">${iconsHtml}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `
            <div class="history-list">${itemsHtml}</div>
            ${totalPages > 1 ? `
            <div class="history-pagination">
                <button id="historyPrevPageBtn" ${currentHistoryPage === 0 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> ${isFrench ? 'Précédent' : 'Previous'}</button>
                <button id="historyNextPageBtn" ${currentHistoryPage === totalPages-1 ? 'disabled' : ''}>${isFrench ? 'Suivant' : 'Next'} <i class="fas fa-chevron-right"></i></button>
            </div>
            ` : ''}
        `;
        
        document.getElementById('historyPrevPageBtn')?.addEventListener('click', () => { if (currentHistoryPage > 0) { currentHistoryPage--; renderHistoryPage(); } });
        document.getElementById('historyNextPageBtn')?.addEventListener('click', () => { if (currentHistoryPage < totalPages - 1) { currentHistoryPage++; renderHistoryPage(); } });
        
        container.querySelectorAll('.btn-view-doc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const doc = JSON.parse(btn.dataset.doc);
                openDocument(doc);
            });
        });
    }
    
    function escapeHtml(str) {
        return (str || '').replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]));
    }
    
    function openDocument(doc) {
    const url = doc.document_url;
    const type = doc.document_type;
    const name = doc.document_name;

    // 🔧 GOOGLE DRIVE : convertir en preview si c'est un lien /view ou /open
    let previewUrl = url;
    if (url.includes('drive.google.com/file/d/')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) previewUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
    } else if (url.includes('drive.google.com/open?id=')) {
        const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match) previewUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
    }

    // 🔧 Décision : modal (même onglet) vs nouvel onglet
    const isExternalLink = type === 'link' && !url.includes('drive.google.com');
    const isDirectImage = type === 'image' && !url.includes('drive.google.com');
    const isGoogleDrive = url.includes('drive.google.com');

    if (isExternalLink) {
        // 🔗 Lien externe (YouTube, HuggingFace, etc.) → nouvel onglet
        window.open(url, '_blank');
        return;
    }

    if (isDirectImage) {
        // 🖼️ Image directe (URL se terminant par .jpg, .png, etc.) → modal image
        createModal(`<<img src="${url}" alt="${escapeHtml(name)}" style="max-width:100%; max-height:80vh; display:block; margin:0 auto;">`);
        return;
    }

    if (isGoogleDrive) {
        // 📁 Google Drive (image, PDF, texte, tout) → iframe preview
        createModal(`<<iframe src="${previewUrl}" style="width:100%; height:100%; border:none;" allow="autoplay; encrypted-media"></iframe>`, '90vw', '90vh');
        return;
    }

    if (type === 'pdf' || url.match(/\.pdf$/i)) {
        // 📄 PDF direct → iframe
        createModal(`<<iframe src="${url}" style="width:100%; height:100%; border:none;"></iframe>`, '90vw', '90vh');
        return;
    }

    if (type === 'text' || url.match(/\.txt$/i)) {
        // 📝 Texte → iframe (Google Doc preview ou lien direct)
        createModal(`<<iframe src="${previewUrl}" style="width:100%; height:100%; border:none;"></iframe>`, '90vw', '90vh');
        return;
    }

    // Fallback : lien externe par défaut
    window.open(url, '_blank');
}

function createModal(contentHtml, width = '80vw', height = '80vh') {
    // Supprimer un modal existant
    const existing = document.querySelector('.doc-preview-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'doc-preview-modal';
    modal.innerHTML = `
        <div class="modal-content" style="width:${width}; height:${height}; position:relative;">
            <span class="close" style="position:absolute; top:12px; right:16px; font-size:28px; font-weight:bold; cursor:pointer; color:white; background:rgba(0,0,0,0.5); width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; z-index:10;">&times;</span>
            <div style="width:100%; height:100%; padding-top:50px; box-sizing:border-box;">
                ${contentHtml}
            </div>
        </div>`;
    
    document.body.appendChild(modal);
    
    // Fermeture
    modal.querySelector('.close').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    // Escape key
    const escHandler = (e) => { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
    
    return modal;
}
    
    // Gestion de la déconnexion, refresh, navigation
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    const refreshBtn = document.getElementById('refreshDashboardBtn');
    const prevLessonBtn = document.getElementById('prevLessonBtn');
    const nextLessonBtn = document.getElementById('nextLessonBtn');
    
    async function handleLogout() {
        const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
        const confirmMessage = isFrench ? 'Voulez-vous vraiment vous déconnecter ?' : 'Are you sure you want to log out?';
        if (confirm(confirmMessage)) {
            try {
                await window.authManager.signOut();
            } catch (error) {
                console.error('Erreur lors de la déconnexion:', error);
            }
        }
    }
    
    if (logoutBtn) logoutBtn.addEventListener('click', async (e) => { e.preventDefault(); await handleLogout(); });
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', async (e) => { e.preventDefault(); await handleLogout(); });
    if (refreshBtn) refreshBtn.addEventListener('click', async function() {
        const user = window.authManager?.getCurrentUser();
        if (user) {
            const isFrench = window.translationManager?.getCurrentLanguage() === 'fr';
            this.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isFrench ? 'Actualisation...' : 'Refreshing...'}`;
            dashboardLoaded = false;
            isLoadingDashboard = false;
            await loadUserData(user);
            this.innerHTML = `<i class="fas fa-sync-alt"></i> ${window.translationManager?.getTranslation('dashboard.refresh') || 'Actualiser'}`;
            document.querySelectorAll('.fade-in').forEach(card => {
                card.style.animation = 'none';
                setTimeout(() => { card.style.animation = 'fadeIn 0.5s ease forwards'; }, 10);
            });
        }
    });
    if (prevLessonBtn) prevLessonBtn.addEventListener('click', () => { if (currentLessonIndex > 0) { currentLessonIndex--; displayCurrentLesson(); updateLessonNavigation(); } });
    if (nextLessonBtn) nextLessonBtn.addEventListener('click', () => { if (currentLessonIndex < upcomingLessons.length - 1) { currentLessonIndex++; displayCurrentLesson(); updateLessonNavigation(); } });
    
    window.addEventListener('language:changed', function() {
        console.log('🌍 Changement de langue détecté, mise à jour du dashboard...');
        const user = window.authManager?.getCurrentUser();
        if (user) {
            updateWelcomeMessage(user);
            updateProfileInfo(user);
            if (window.packagesData && currentPackageIndex < packageTypes.length) {
                const currentType = packageTypes[currentPackageIndex];
                showPackageCard(currentType, window.packagesData[currentType] || { 30: 0, 45: 0, 60: 0, expiry: null });
            }
            if (upcomingLessons.length > 0) displayCurrentLesson();
            updateCourseButtons();
            if (lessonHistory.length > 0) renderHistoryPage();
        }
    });
    
    function updateCourseButtons() {
        const conversationBtn = document.querySelector('[href="booking.html?type=conversation"] .course-button-title');
        const curriculumBtn = document.querySelector('[href="booking.html?type=curriculum"] .course-button-title');
        const examBtn = document.querySelector('[href="booking.html?type=examen"] .course-button-title');
        if (conversationBtn) conversationBtn.textContent = window.translationManager?.getTranslation('dashboard.conversation_btn') || 'Conversation';
        if (curriculumBtn) curriculumBtn.textContent = window.translationManager?.getTranslation('dashboard.curriculum_btn') || 'Curriculum';
        if (examBtn) examBtn.textContent = window.translationManager?.getTranslation('dashboard.exam_btn') || 'Préparation d\'examen';
    }
    
    if (window.packagesManager && !window.packagesManager.isInitialized) {
        window.packagesManager.initialize();
    }
    
    window.loadDashboard = loadDashboard;
    window.updateWelcomeMessage = updateWelcomeMessage;
    window.updateProfileInfo = updateProfileInfo;
});