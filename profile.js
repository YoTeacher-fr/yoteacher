// ===== PROFILE.JS - VERSION BUCKET PRIVE + SIGNED URLs =====

// ===== ETAT GLOBAL =====
window.PROFILE_STATE = {
    currentUser: null,
    supabaseClient: null,
    isSavingPersonal: false,
    isSavingLanguage: false,
    isSavingPassword: false,
    initialized: false,
    eventsAttached: false
};

// ===== UTILITAIRES AVATAR =====
function getInitials(email, firstName, lastName) {
    if (firstName && lastName) {
        return (firstName[0] + lastName[0]).toUpperCase();
    }
    return email ? email.substring(0, 2).toUpperCase() : '??';
}

function renderAvatar(profile) {
    const avatarDiv = document.getElementById('userAvatar');
    if (!avatarDiv) return;
    const avatarUrl = profile?.avatar_url;
    if (avatarUrl) {
        avatarDiv.innerHTML = '<img src="' + avatarUrl + '" alt="Avatar" onerror="this.remove(); renderFallbackAvatar();">';
    } else {
        renderFallbackAvatar();
    }
}

function renderFallbackAvatar() {
    const avatarDiv = document.getElementById('userAvatar');
    if (!avatarDiv) return;
    const user = window.PROFILE_STATE.currentUser;
    const profile = user?.profile || {};
    const initials = getInitials(user?.email, profile?.first_name, profile?.last_name);
    avatarDiv.textContent = initials;
}

// ===== SUPPRESSION ANCIEN AVATAR =====
async function deleteOldAvatar(supabaseClient, currentAvatarUrl) {
    if (!currentAvatarUrl) return;
    try {
        // Extraire le chemin depuis l URL signee ou publique
        // Format signee: https://xxx.supabase.co/storage/v1/object/sign/avatars/userId/filename.jpg?token=...
        // Format publique: https://xxx.supabase.co/storage/v1/object/public/avatars/userId/filename.jpg
        let filePath = null;
        if (currentAvatarUrl.includes('/sign/')) {
            const parts = currentAvatarUrl.split('/avatars/');
            if (parts.length >= 2) {
                filePath = parts[1].split('?')[0];
            }
        } else if (currentAvatarUrl.includes('/public/')) {
            const parts = currentAvatarUrl.split('/avatars/');
            if (parts.length >= 2) {
                filePath = parts[1];
            }
        }

        if (!filePath) return;

        const { error } = await supabaseClient.storage.from('avatars').remove([filePath]);
        if (!error) {
            console.log(' Ancien avatar supprime');
        } else {
            console.warn(' Suppression ancien avatar:', error.message);
        }
    } catch (e) {
        console.warn(' Suppression ancien avatar echouee:', e);
    }
}

// ===== NETTOYAGE DOSSIER UTILISATEUR =====
async function cleanupUserAvatars(supabaseClient, userId) {
    try {
        const { data: files, error } = await supabaseClient.storage.from('avatars').list(userId + '/');
        if (error || !files || files.length <= 1) return;
        const sorted = files.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const toDelete = sorted.slice(1).map(function(f) { return userId + '/' + f.name; });
        if (toDelete.length > 0) {
            await supabaseClient.storage.from('avatars').remove(toDelete);
            console.log(' ' + toDelete.length + ' ancien(s) avatar(s) nettoye(s)');
        }
    } catch (e) {
        console.warn(' Nettoyage echoue:', e);
    }
}

// ===== REDIMENSIONNEMENT IMAGE =====
async function resizeImageAuto(file, maxSize, quality) {
    maxSize = maxSize || 300;
    quality = quality || 0.70;
    return new Promise(function(resolve, reject) {
        var img = new Image();
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
            img.onload = function() {
                var width = img.width;
                var height = img.height;
                var ratio = Math.min(maxSize / width, maxSize / height);
                if (ratio < 1) {
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                canvas.width = width;
                canvas.height = height;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(function(blob) {
                    if (!blob) {
                        reject(new Error('Echec compression'));
                        return;
                    }
                    console.log(' Avatar redimensionne: ' + (blob.size/1024).toFixed(1) + 'KB (' + width + 'x' + height + ')');
                    resolve(new File([blob], 'avatar_' + Date.now() + '.jpg', { type: 'image/jpeg' }));
                }, 'image/jpeg', quality);
            };
            img.onerror = function() { reject(new Error('Image invalide')); };
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== RECUPERER AVATAR AVEC SIGNED URL =====
async function loadAvatarWithSignedUrl(userId) {
    var supabaseClient = window.PROFILE_STATE.supabaseClient;
    if (!supabaseClient || !userId) return null;

    try {
        // Lister les fichiers dans le dossier de l utilisateur
        var { data: files, error: listError } = await supabaseClient.storage.from('avatars').list(userId + '/');
        if (listError || !files || files.length === 0) return null;

        // Prendre le fichier le plus recent
        var sorted = files.sort(function(a, b) {
            return new Date(b.created_at) - new Date(a.created_at);
        });
        var latestFile = sorted[0];
        var filePath = userId + '/' + latestFile.name;

        // Generer une signed URL valide 1 heure
        var { data, error } = await supabaseClient.storage.from('avatars').createSignedUrl(filePath, 3600);
        if (error || !data) return null;

        return data.signedUrl;
    } catch (e) {
        console.warn(' Erreur chargement avatar signe:', e);
        return null;
    }
}

// ===== UPLOAD AVATAR =====
async function uploadAvatar(file) {
    var currentUser = window.PROFILE_STATE.currentUser;
    var supabaseClient = window.PROFILE_STATE.supabaseClient;

    if (!currentUser || !supabaseClient) {
        showError('Session invalide');
        return;
    }

    var progressBar = document.getElementById('progressFill');
    var progressDiv = document.getElementById('uploadProgress');
    var uploadBtn = document.getElementById('avatarUploadBtn');

    try {
        if (progressDiv) progressDiv.style.display = 'block';
        if (uploadBtn) uploadBtn.disabled = true;
        if (progressBar) progressBar.style.width = '20%';

        // 1. Redimensionnement
        var resizedFile = await resizeImageAuto(file, 300, 0.70);
        if (progressBar) progressBar.style.width = '40%';

        // 2. Supprimer ancien avatar
        var oldAvatarUrl = currentUser.profile?.avatar_url;
        if (oldAvatarUrl) {
            await deleteOldAvatar(supabaseClient, oldAvatarUrl);
        }
        if (progressBar) progressBar.style.width = '50%';

        // 3. Upload vers bucket PRIVE
        var filePath = currentUser.id + '/avatar_' + Date.now() + '.jpg';
        var { error } = await supabaseClient.storage.from('avatars').upload(filePath, resizedFile, {
            cacheControl: '3600',
            upsert: false
        });

        if (error) throw error;
        if (progressBar) progressBar.style.width = '70%';

        // 4. Generer signed URL
        var { data: signedData, error: signedError } = await supabaseClient.storage.from('avatars').createSignedUrl(filePath, 3600);
        if (signedError || !signedData) {
            throw new Error('Impossible de generer l URL signee');
        }
        var signedUrl = signedData.signedUrl;
        if (progressBar) progressBar.style.width = '80%';

        // 5. Update base avec l URL signee
        var { error: updateError } = await supabaseClient
            .from('profiles')
            .update({
                avatar_url: signedUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);

        if (updateError) throw updateError;

        // 6. Nettoyage
        await cleanupUserAvatars(supabaseClient, currentUser.id);
        if (progressBar) progressBar.style.width = '100%';

        // 7. Update local
        if (!currentUser.profile) currentUser.profile = {};
        currentUser.profile.avatar_url = signedUrl;

        renderAvatar(currentUser.profile);
        showSuccess('Photo mise a jour !');

        if (window.authManager && window.authManager.saveUserToStorage) {
            window.authManager.saveUserToStorage();
        }

    } catch (error) {
        console.error(' Upload avatar:', error);
        showError('Erreur: ' + (error.message || 'Upload echoue'));
    } finally {
        setTimeout(function() {
            if (progressDiv) progressDiv.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
            if (uploadBtn) uploadBtn.disabled = false;
        }, 800);
    }
}

function attachAvatarEvents() {
    var avatarInput = document.getElementById('avatarInput');
    var uploadBtn = document.getElementById('avatarUploadBtn');
    var avatarDiv = document.getElementById('userAvatar');

    if (!avatarInput || !uploadBtn) return;

    uploadBtn.addEventListener('click', function() { avatarInput.click(); });
    if (avatarDiv) {
        avatarDiv.addEventListener('click', function() { avatarInput.click(); });
    }

    avatarInput.addEventListener('change', async function(e) {
        var file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showError('Veuillez selectionner une image');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showError('Image trop lourde (max 10MB)');
            return;
        }

        await uploadAvatar(file);
        avatarInput.value = '';
    });
}

// ===== FONCTIONS UTILITAIRES =====
function waitForSupabase() {
    return new Promise(function(resolve, reject) {
        var attempts = 0;
        var maxAttempts = 50;

        function check() {
            attempts++;
            if (window.supabase && typeof window.supabase.from === 'function') {
                window.PROFILE_STATE.supabaseClient = window.supabase;
                console.log(' Supabase pret pour le profil');
                resolve();
            } else if (attempts >= maxAttempts) {
                reject(new Error('Supabase non initialise'));
            } else {
                setTimeout(check, 100);
            }
        }
        check();
    });
}

function waitForAuthManager() {
    return new Promise(function(resolve) {
        var attempts = 0;
        var maxAttempts = 50;

        function check() {
            attempts++;
            if (window.authManager && window.authManager.getCurrentUser !== undefined) {
                window.PROFILE_STATE.currentUser = window.authManager.getCurrentUser();
                resolve();
            } else if (attempts >= maxAttempts) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        }
        check();
    });
}

// ===== MISE A JOUR PROFIL =====
async function updateProfileField(field, value) {
    var currentUser = window.PROFILE_STATE.currentUser;
    var supabaseClient = window.PROFILE_STATE.supabaseClient;

    if (!currentUser || !supabaseClient) {
        console.error(' Impossible de mettre a jour: utilisateur ou Supabase non disponible');
        return { success: false, error: 'Non disponible' };
    }

    try {
        var updateData = {};
        updateData[field] = value;
        updateData.updated_at = new Date().toISOString();

        console.log(' Mise a jour ' + field + ':', updateData);

        var { error } = await supabaseClient
            .from('profiles')
            .update(updateData)
            .eq('id', currentUser.id);

        if (error) {
            console.error(' Erreur mise a jour ' + field + ':', error);
            return { success: false, error: error.message };
        }

        console.log(' ' + field + ' mis a jour avec succes');
        return { success: true };

    } catch (error) {
        console.error(' Exception mise a jour ' + field + ':', error);
        return { success: false, error: error.message };
    }
}

// ===== CHARGEMENT DES DONNEES =====
async function loadProfileData() {
    console.log(' Chargement des donnees du profil...');

    var currentUser = window.PROFILE_STATE.currentUser;
    var supabaseClient = window.PROFILE_STATE.supabaseClient;

    if (!currentUser) {
        console.error(' Impossible de charger: currentUser manquant');
        return;
    }
    if (!supabaseClient) {
        console.error(' Impossible de charger: supabaseClient manquant');
        return;
    }

    try {
        // Recuperer le profil
        var { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (error) {
            console.error(' Erreur chargement profil:', error);
            return;
        }

        // Stocker le profil
        currentUser.profile = profile || {};

        // Si avatar_url est absent ou expire, essayer de regenerer une signed URL
        if (!currentUser.profile.avatar_url) {
            var signedUrl = await loadAvatarWithSignedUrl(currentUser.id);
            if (signedUrl) {
                currentUser.profile.avatar_url = signedUrl;
            }
        }

        // Remplir les formulaires
        var fullName = currentUser.profile.full_name || currentUser.user_metadata?.full_name || '';
        var nameParts = fullName.split(' ');
        var firstNameEl = document.getElementById('firstName');
        var lastNameEl = document.getElementById('lastName');
        var emailEl = document.getElementById('email');
        var frenchLevelEl = document.getElementById('frenchLevel');
        var learningGoalsEl = document.getElementById('learningGoals');

        if (firstNameEl) firstNameEl.value = nameParts[0] || '';
        if (lastNameEl) lastNameEl.value = nameParts.slice(1).join(' ') || '';
        if (emailEl) emailEl.value = currentUser.email || '';
        if (frenchLevelEl) frenchLevelEl.value = currentUser.profile.french_level || '';
        if (learningGoalsEl) learningGoalsEl.value = currentUser.profile.learning_goals || '';

        // Charger les pays
        if (window.loadCountriesIntoSelect) {
            var userCountry = currentUser.profile.country || '';
            window.loadCountriesIntoSelect('country', userCountry);
            var countryInfo = document.getElementById('countryInfo');
            if (countryInfo && window.YOTEACHER_COUNTRIES) {
                countryInfo.textContent = window.YOTEACHER_COUNTRIES.length + ' pays disponibles';
            }
        }

        console.log(' Donnees profil chargees');

    } catch (error) {
        console.error(' Exception chargement donnees:', error);
    }
}

// ===== GESTION DES BOUTONS =====
function resetButton(type, button, originalText) {
    switch(type) {
        case 'personal':
            window.PROFILE_STATE.isSavingPersonal = false;
            break;
        case 'language':
            window.PROFILE_STATE.isSavingLanguage = false;
            break;
        case 'password':
            window.PROFILE_STATE.isSavingPassword = false;
            break;
    }

    if (button && button.parentNode) {
        button.innerHTML = originalText;
        button.disabled = false;
    }

    console.log(' Bouton ' + type + ' reactive');
}

function prepareButtonForSave(type) {
    var buttonMap = {
        personal: 'personalSaveBtn',
        language: 'languageSaveBtn',
        password: 'passwordSaveBtn'
    };

    var buttonId = buttonMap[type];
    var button = document.getElementById(buttonId);

    if (!button) {
        console.error(' Bouton ' + type + ' non trouve');
        return null;
    }

    var originalText = button.innerHTML;
    var savingText = 'Sauvegarde...';
    if (window.translationManager && window.translationManager.getTranslation) {
        savingText = window.translationManager.getTranslation('profile.saving') || savingText;
    }

    window.PROFILE_STATE['isSaving' + type.charAt(0).toUpperCase() + type.slice(1)] = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + savingText;
    button.disabled = true;

    return { button: button, originalText: originalText };
}

// ===== ATTACHEMENT DES EVENEMENTS =====
function attachFormEvents() {
    if (window.PROFILE_STATE.eventsAttached) {
        console.log(' Evenements deja attaches');
        return;
    }

    console.log(' Attachement des evenements des formulaires...');

    // Gestion des onglets
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();

            document.querySelectorAll('.nav-item').forEach(function(i) {
                i.classList.remove('active');
            });
            document.querySelectorAll('.tab-content').forEach(function(tab) {
                tab.classList.remove('active');
            });

            this.classList.add('active');
            var tabId = this.dataset.tab + 'Tab';
            var tabEl = document.getElementById(tabId);
            if (tabEl) tabEl.classList.add('active');
        });
    });

    // Formulaire informations personnelles
    var personalForm = document.getElementById('personalForm');
    if (personalForm) {
        personalForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            var currentUser = window.PROFILE_STATE.currentUser;
            var buttonInfo = prepareButtonForSave('personal');
            if (!buttonInfo) return;

            var button = buttonInfo.button;
            var originalText = buttonInfo.originalText;

            var firstNameEl = document.getElementById('firstName');
            var lastNameEl = document.getElementById('lastName');
            var countryEl = document.getElementById('country');

            var firstName = firstNameEl ? firstNameEl.value.trim() : '';
            var lastName = lastNameEl ? lastNameEl.value.trim() : '';
            var fullName = firstName + ' ' + lastName;
            var country = countryEl ? countryEl.value : '';

            if (!firstName || !lastName) {
                var msg = 'Le prenom et le nom sont obligatoires';
                if (window.translationManager && window.translationManager.getTranslation) {
                    msg = window.translationManager.getTranslation('profile.error_required_fields') || msg;
                }
                showError(msg);
                resetButton('personal', button, originalText);
                return;
            }

            if (!country) {
                var msg2 = 'Veuillez selectionner un pays';
                if (window.translationManager && window.translationManager.getTranslation) {
                    msg2 = window.translationManager.getTranslation('profile.error_country') || msg2;
                }
                showError(msg2);
                resetButton('personal', button, originalText);
                return;
            }

            try {
                var result1 = await updateProfileField('full_name', fullName);
                var result2 = await updateProfileField('country', country);

                if (!result1.success || !result2.success) {
                    throw new Error('Erreur lors de la sauvegarde');
                }

                if (!currentUser.profile) currentUser.profile = {};
                currentUser.profile.full_name = fullName;
                currentUser.profile.country = country;

                if (window.authManager && window.authManager.saveUserToStorage) {
                    window.authManager.saveUserToStorage();
                    console.log(' Donnees sauvegardees localStorage');
                }

                var successMsg = 'Profil mis a jour avec succes !';
                if (window.translationManager && window.translationManager.getTranslation) {
                    successMsg = window.translationManager.getTranslation('profile.update_success') || successMsg;
                }
                showSuccess(successMsg);

            } catch (error) {
                console.error(' Erreur sauvegarde:', error);
                showError('Erreur: ' + error.message);
            } finally {
                setTimeout(function() {
                    resetButton('personal', button, originalText);
                }, 500);
            }
        });
    }

    // Formulaire niveau francais
    var languageForm = document.getElementById('languageForm');
    if (languageForm) {
        languageForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            var currentUser = window.PROFILE_STATE.currentUser;
            var buttonInfo = prepareButtonForSave('language');
            if (!buttonInfo) {
                showError('Erreur: bouton non disponible');
                return;
            }

            var button = buttonInfo.button;
            var originalText = buttonInfo.originalText;

            var frenchLevelEl = document.getElementById('frenchLevel');
            var learningGoalsEl = document.getElementById('learningGoals');

            var frenchLevel = frenchLevelEl ? frenchLevelEl.value : '';
            var learningGoals = learningGoalsEl ? learningGoalsEl.value.trim() : '';

            if (!frenchLevel) {
                var msg = 'Veuillez selectionner votre niveau';
                if (window.translationManager && window.translationManager.getTranslation) {
                    msg = window.translationManager.getTranslation('profile.error_french_level') || msg;
                }
                showError(msg);
                window.PROFILE_STATE.isSavingLanguage = false;
                button.innerHTML = originalText;
                button.disabled = false;
                return;
            }

            try {
                var result = await updateProfileField('french_level', frenchLevel);

                if (!result.success) {
                    throw new Error('Erreur lors de la sauvegarde du niveau');
                }

                if (learningGoals) {
                    var resultGoals = await updateProfileField('learning_goals', learningGoals);
                    if (!resultGoals.success) {
                        console.warn(' Erreur sauvegarde objectifs, mais niveau sauvegarde');
                    }
                }

                if (!currentUser.profile) currentUser.profile = {};
                currentUser.profile.french_level = frenchLevel;
                if (learningGoals) {
                    currentUser.profile.learning_goals = learningGoals;
                }

                if (window.authManager && window.authManager.saveUserToStorage) {
                    window.authManager.saveUserToStorage();
                }

                var successMsg = 'Niveau de francais mis a jour !';
                if (window.translationManager && window.translationManager.getTranslation) {
                    successMsg = window.translationManager.getTranslation('profile.level_update_success') || successMsg;
                }
                showSuccess(successMsg);

            } catch (error) {
                console.error(' Erreur sauvegarde niveau:', error);
                showError('Erreur: ' + error.message);
            } finally {
                window.PROFILE_STATE.isSavingLanguage = false;
                setTimeout(function() {
                    try {
                        if (button && button.parentNode) {
                            button.innerHTML = originalText;
                            button.disabled = false;
                        }
                    } catch (btnError) {
                        console.warn(' Erreur reinitialisation bouton:', btnError);
                    }
                }, 500);
            }
        });
    }

    // Formulaire mot de passe
    var passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            var supabaseClient = window.PROFILE_STATE.supabaseClient;
            var buttonInfo = prepareButtonForSave('password');
            if (!buttonInfo) return;

            var button = buttonInfo.button;
            var originalText = buttonInfo.originalText;

            var newPasswordEl = document.getElementById('newPassword');
            var confirmPasswordEl = document.getElementById('confirmPassword');

            var newPassword = newPasswordEl ? newPasswordEl.value : '';
            var confirmPassword = confirmPasswordEl ? confirmPasswordEl.value : '';

            if (newPassword.length < 8) {
                var msg = 'Le mot de passe doit contenir au moins 8 caracteres';
                if (window.translationManager && window.translationManager.getTranslation) {
                    msg = window.translationManager.getTranslation('profile.error_password_length') || msg;
                }
                showError(msg);
                resetButton('password', button, originalText);
                return;
            }

            if (newPassword !== confirmPassword) {
                var msg2 = 'Les mots de passe ne correspondent pas';
                if (window.translationManager && window.translationManager.getTranslation) {
                    msg2 = window.translationManager.getTranslation('profile.error_password_match') || msg2;
                }
                showError(msg2);
                resetButton('password', button, originalText);
                return;
            }

            try {
                if (!supabaseClient || !supabaseClient.auth) {
                    throw new Error('Supabase non disponible');
                }

                console.log(' Debut du changement de mot de passe...');

                var { error } = await supabaseClient.auth.updateUser({ password: newPassword });

                if (error) throw error;

                console.log(' Mot de passe change avec succes');
                var successMsg = 'Mot de passe mis a jour avec succes !';
                if (window.translationManager && window.translationManager.getTranslation) {
                    successMsg = window.translationManager.getTranslation('profile.password_update_success') || successMsg;
                }
                showSuccess(successMsg);
                passwordForm.reset();

                setTimeout(function() {
                    resetButton('password', button, originalText);
                }, 500);

            } catch (error) {
                console.error(' Erreur changement mot de passe:', error);
                showError('Erreur: ' + (error.message || 'Impossible de changer le mot de passe'));

                setTimeout(function() {
                    resetButton('password', button, originalText);
                }, 500);
            }
        });
    }

    window.PROFILE_STATE.eventsAttached = true;
    console.log(' Evenements attaches avec succes');
}

// ===== INITIALISATION PRINCIPALE =====
async function initProfilePage() {
    console.log(' Initialisation de la page profil...');

    if (window.PROFILE_STATE.initialized) {
        console.log(' Page deja initialisee');
        return;
    }

    try {
        // Attendre Supabase ET authManager
        await Promise.all([waitForSupabase(), waitForAuthManager()]);

        var currentUser = window.PROFILE_STATE.currentUser;

        if (!currentUser) {
            console.error(' Aucun utilisateur trouve');
            showError('Aucun utilisateur trouve. Veuillez vous reconnecter.');
            return;
        }

        console.log(' Initialisation reussie pour:', currentUser.email);

        // Initialiser l avatar (avec signed URL si disponible, sinon initiales)
        if (currentUser.profile && currentUser.profile.avatar_url) {
            renderAvatar(currentUser.profile);
        } else {
            // Essayer de charger une signed URL
            var signedUrl = await loadAvatarWithSignedUrl(currentUser.id);
            if (signedUrl) {
                if (!currentUser.profile) currentUser.profile = {};
                currentUser.profile.avatar_url = signedUrl;
                renderAvatar(currentUser.profile);
            } else {
                renderFallbackAvatar();
            }
        }

        attachAvatarEvents();

        // Charger les donnees
        await loadProfileData();

        // Attacher les evenements (une seule fois)
        attachFormEvents();

        // Initialiser le systeme de traduction
        if (window.translationManager) {
            console.log(' Initialisation du systeme de traduction dans le profil...');
            window.translationManager.applyTranslations();

            // Attacher l evenement au bouton de langue desktop
            var langSwitcherDesktop = document.getElementById('languageSwitcherDesktop');
            if (langSwitcherDesktop) {
                var newSwitcher = langSwitcherDesktop.cloneNode(true);
                langSwitcherDesktop.parentNode.replaceChild(newSwitcher, langSwitcherDesktop);

                document.getElementById('languageSwitcherDesktop').addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(' Clic sur le selecteur de langue desktop dans profile.html');
                    window.translationManager.toggleLanguage();
                });
                console.log(' Bouton de langue desktop du profil initialise');
            }

            // Attacher l evenement au bouton de langue mobile
            var langSwitcherMobile = document.getElementById('languageSwitcherMobile');
            if (langSwitcherMobile) {
                var newSwitcherMobile = langSwitcherMobile.cloneNode(true);
                langSwitcherMobile.parentNode.replaceChild(newSwitcherMobile, langSwitcherMobile);

                document.getElementById('languageSwitcherMobile').addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(' Clic sur le selecteur de langue mobile dans profile.html');
                    window.translationManager.toggleLanguage();
                });
                console.log(' Bouton de langue mobile du profil initialise');
            }

            // Ecouter les changements de langue
            window.addEventListener('language:changed', function() {
                console.log(' Langue changee, mise a jour du profil...');
                setTimeout(function() {
                    if (window.loadProfileData) {
                        window.loadProfileData();
                    }
                }, 100);
            });
        } else {
            console.warn(' translationManager non disponible pour le profil');
        }

        window.PROFILE_STATE.initialized = true;
        console.log(' Page profil initialisee avec succes');

    } catch (error) {
        console.error(' Erreur initialisation:', error);
        showError('Erreur lors de l initialisation: ' + error.message);
    }
}

// ===== FONCTIONS D AFFICHAGE DES MESSAGES =====
function showError(message) {
    var errorDiv = document.getElementById('errorMessage');
    var errorText = document.getElementById('errorText');
    var successDiv = document.getElementById('successMessage');

    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.style.display = 'flex';
        if (successDiv) successDiv.style.display = 'none';

        setTimeout(function() {
            if (errorDiv) errorDiv.style.display = 'none';
        }, 5000);
    }
}

function showSuccess(message) {
    var successDiv = document.getElementById('successMessage');
    var successText = document.getElementById('successText');
    var errorDiv = document.getElementById('errorMessage');

    if (successDiv && successText) {
        successText.textContent = message;
        successDiv.style.display = 'flex';
        if (errorDiv) errorDiv.style.display = 'none';

        setTimeout(function() {
            if (successDiv) successDiv.style.display = 'none';
        }, 3000);
    }
}

// ===== MISE A JOUR DES DONNEES (appelee par auth:login) =====
window.updateProfileData = async function() {
    console.log(' Mise a jour des donnees du profil...');

    if (window.authManager && window.authManager.getCurrentUser) {
        window.PROFILE_STATE.currentUser = window.authManager.getCurrentUser();
    }

    await loadProfileData();
};

// Exposer l initialisation
window.initProfilePage = initProfilePage;
window.loadProfileData = loadProfileData;
window.renderAvatar = renderAvatar;
window.renderFallbackAvatar = renderFallbackAvatar;
