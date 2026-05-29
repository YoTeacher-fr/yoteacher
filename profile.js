// ===== PROFILE.JS - VERSION CORRIGEE =====
// - Initiales: prenom d'abord, nom ensuite (JD pour Jean Dupont)
// - Image: detection correcte du chargement, fallback si erreur
// - Avatar URL publique permanente (bucket public Supabase)

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
    // ORDRE CORRECT: prenom puis nom (JD pour Jean Dupont)
    var fn = (firstName || '').trim();
    var ln = (lastName || '').trim();
    if (fn && ln) {
        return (fn[0] + ln[0]).toUpperCase();
    }
    if (fn) return fn.substring(0, 2).toUpperCase();
    if (ln) return ln.substring(0, 2).toUpperCase();
    var em = (email || '').trim();
    return em ? em.substring(0, 2).toUpperCase() : '??';
}

function renderAvatar(profile) {
    var avatarDiv = document.getElementById('userAvatar');
    if (!avatarDiv) return;

    var avatarUrl = profile && profile.avatar_url;
    if (!avatarUrl) {
        renderFallbackAvatar();
        return;
    }

    // URL publique permanente - pas besoin de signed URL
    var img = new Image();
    img.onload = function() {
        avatarDiv.innerHTML = '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '50%';
        avatarDiv.appendChild(img);
    };
    img.onerror = function() {
        console.log('Erreur chargement image, fallback initiales');
        renderFallbackAvatar();
    };
    img.src = avatarUrl;
}

function renderFallbackAvatar() {
    var avatarDiv = document.getElementById('userAvatar');
    if (!avatarDiv) return;

    var user = window.PROFILE_STATE.currentUser;
    var profile = (user && user.profile) || {};

    var firstName = profile.first_name || '';
    var lastName = profile.last_name || '';

    if (!firstName && !lastName && profile.full_name) {
        var parts = profile.full_name.split(' ').filter(function(n) { return n.length > 0; });
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
    }

    if (!firstName && user && user.user_metadata) {
        firstName = user.user_metadata.first_name || user.user_metadata.given_name || '';
        lastName = user.user_metadata.last_name || user.user_metadata.family_name || '';
    }

    var initials = getInitials(user && user.email, firstName, lastName);
    avatarDiv.textContent = initials;
}

// ===== SUPPRESSION ANCIEN AVATAR =====
async function deleteOldAvatar(supabaseClient, currentAvatarUrl) {
    if (!currentAvatarUrl) return;
    try {
        // Extraire le chemin depuis l'URL publique
        var urlParts = currentAvatarUrl.split('/avatars/');
        if (urlParts.length < 2) return;
        var filePath = urlParts[1].split('?')[0];
        var result = await supabaseClient.storage.from('avatars').remove([filePath]);
        if (!result.error) console.log('Ancien avatar supprime');
    } catch (e) {
        console.warn('Suppression ancien avatar:', e.message);
    }
}

// ===== NETTOYAGE DOSSIER =====
async function cleanupUserAvatars(supabaseClient, userId) {
    try {
        var result = await supabaseClient.storage.from('avatars').list(userId + '/');
        var files = result.data;
        var error = result.error;
        if (error || !files || files.length <= 1) return;
        var sorted = files.sort(function(a, b) {
            return new Date(b.created_at) - new Date(a.created_at);
        });
        var toDelete = sorted.slice(1).map(function(f) { return userId + '/' + f.name; });
        if (toDelete.length > 0) {
            await supabaseClient.storage.from('avatars').remove(toDelete);
            console.log('' + toDelete.length + ' ancien(s) nettoye(s)');
        }
    } catch (e) {
        console.warn('Nettoyage:', e.message);
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
                var w = img.width;
                var h = img.height;
                var ratio = Math.min(maxSize / w, maxSize / h);
                if (ratio < 1) { w = Math.round(w * ratio); h = Math.round(h * ratio); }
                canvas.width = w;
                canvas.height = h;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob(function(blob) {
                    if (!blob) { reject(new Error('Echec compression')); return; }
                    console.log('Avatar: ' + (blob.size/1024).toFixed(1) + 'KB (' + w + 'x' + h + ')');
                    resolve(new File([blob], 'avatar_' + Date.now() + '.jpg', { type: 'image/jpeg' }));
                }, 'image/jpeg', quality);
            };
            img.onerror = function() { reject(new Error('Image invalide')); };
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== UPLOAD AVATAR =====
async function uploadAvatar(file) {
    var currentUser = window.PROFILE_STATE.currentUser;
    var supabaseClient = window.PROFILE_STATE.supabaseClient;

    if (!currentUser || !supabaseClient) {
        showError('Session invalide');
        return;
    }
    if (!currentUser.id) {
        showError('ID utilisateur manquant');
        return;
    }

    var progressBar = document.getElementById('progressFill');
    var progressDiv = document.getElementById('uploadProgress');
    var uploadBtn = document.getElementById('avatarUploadBtn');

    try {
        if (progressDiv) progressDiv.style.display = 'block';
        if (uploadBtn) uploadBtn.disabled = true;
        if (progressBar) progressBar.style.width = '10%';

        // 1. Redimensionnement
        var resizedFile = await resizeImageAuto(file, 300, 0.70);
        if (progressBar) progressBar.style.width = '30%';

        // 2. Supprimer ancien
        var oldAvatarUrl = currentUser.profile && currentUser.profile.avatar_url;
        if (oldAvatarUrl) {
            await deleteOldAvatar(supabaseClient, oldAvatarUrl);
        }
        if (progressBar) progressBar.style.width = '40%';

        // 3. Upload
        var filePath = currentUser.id + '/avatar_' + Date.now() + '.jpg';
        console.log('Upload vers:', filePath);

        var uploadResult = await supabaseClient.storage.from('avatars').upload(filePath, resizedFile, {
            cacheControl: '3600',
            upsert: false
        });

        if (uploadResult.error) {
            console.error('Erreur upload:', uploadResult.error);
            throw uploadResult.error;
        }

        console.log('Upload reussi');
        if (progressBar) progressBar.style.width = '60%';

        // 4. URL PUBLIQUE PERMANENTE (bucket public)
        var publicUrlResult = supabaseClient.storage.from('avatars').getPublicUrl(filePath);
        var avatarUrl = publicUrlResult.data && publicUrlResult.data.publicUrl;

        if (!avatarUrl) {
            throw new Error('Impossible de generer l URL publique');
        }

        console.log('URL publique:', avatarUrl);
        if (progressBar) progressBar.style.width = '80%';

        // 5. Update base
        var updateResult = await supabaseClient
            .from('profiles')
            .update({
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);

        if (updateResult.error) {
            console.error('Erreur update base:', updateResult.error);
            throw updateResult.error;
        }

        // 6. Nettoyage
        await cleanupUserAvatars(supabaseClient, currentUser.id);
        if (progressBar) progressBar.style.width = '100%';

        // 7. Update local et afficher
        if (!currentUser.profile) currentUser.profile = {};
        currentUser.profile.avatar_url = avatarUrl;

        renderAvatar(currentUser.profile);
        showSuccess('Photo mise a jour !');

        if (window.authManager && window.authManager.saveUserToStorage) {
            window.authManager.saveUserToStorage();
        }

    } catch (error) {
        console.error('Upload avatar:', error);
        showError('Erreur: ' + (error.message || error.statusCode || 'Inconnue'));
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
                console.log('Supabase pret');
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
        return { success: false, error: 'Non disponible' };
    }

    try {
        var updateData = {};
        updateData[field] = value;
        updateData.updated_at = new Date().toISOString();

        var result = await supabaseClient
            .from('profiles')
            .update(updateData)
            .eq('id', currentUser.id);

        if (result.error) {
            return { success: false, error: result.error.message };
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== CHARGEMENT DES DONNEES =====
async function loadProfileData() {
    console.log('Chargement profil...');

    var currentUser = window.PROFILE_STATE.currentUser;
    var supabaseClient = window.PROFILE_STATE.supabaseClient;

    if (!currentUser) {
        console.error('currentUser manquant');
        return;
    }
    if (!supabaseClient) {
        console.error('supabaseClient manquant');
        return;
    }

    try {
        var result = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (result.error) {
            console.error('Erreur chargement:', result.error);
            return;
        }

        currentUser.profile = result.data || {};

        var fullName = (currentUser.profile && currentUser.profile.full_name) || '';
        var nameParts = fullName.split(' ').filter(function(n) { return n.length > 0; });

        var firstNameEl = document.getElementById('firstName');
        var lastNameEl = document.getElementById('lastName');
        var emailEl = document.getElementById('email');
        var frenchLevelEl = document.getElementById('frenchLevel');
        var learningGoalsEl = document.getElementById('learningGoals');

        if (firstNameEl) firstNameEl.value = nameParts[0] || '';
        if (lastNameEl) lastNameEl.value = nameParts.slice(1).join(' ') || '';
        if (emailEl) emailEl.value = currentUser.email || '';
        if (frenchLevelEl) frenchLevelEl.value = (currentUser.profile && currentUser.profile.french_level) || '';
        if (learningGoalsEl) learningGoalsEl.value = (currentUser.profile && currentUser.profile.learning_goals) || '';

        if (window.loadCountriesIntoSelect) {
            var userCountry = (currentUser.profile && currentUser.profile.country) || '';
            window.loadCountriesIntoSelect('country', userCountry);
            var countryInfo = document.getElementById('countryInfo');
            if (countryInfo && window.YOTEACHER_COUNTRIES) {
                countryInfo.textContent = window.YOTEACHER_COUNTRIES.length + ' pays disponibles';
            }
        }

        console.log('Profil charge');

    } catch (error) {
        console.error('Exception:', error);
    }
}

// ===== GESTION DES BOUTONS =====
function resetButton(type, button, originalText) {
    switch(type) {
        case 'personal': window.PROFILE_STATE.isSavingPersonal = false; break;
        case 'language': window.PROFILE_STATE.isSavingLanguage = false; break;
        case 'password': window.PROFILE_STATE.isSavingPassword = false; break;
    }
    if (button && button.parentNode) {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

function prepareButtonForSave(type) {
    var buttonMap = { personal: 'personalSaveBtn', language: 'languageSaveBtn', password: 'passwordSaveBtn' };
    var button = document.getElementById(buttonMap[type]);
    if (!button) return null;
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
    if (window.PROFILE_STATE.eventsAttached) return;

    // Onglets
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(function(i) { i.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function(tab) { tab.classList.remove('active'); });
            this.classList.add('active');
            var tabId = this.dataset.tab + 'Tab';
            var tabEl = document.getElementById(tabId);
            if (tabEl) tabEl.classList.add('active');
        });
    });

    // Formulaire personnel
    var personalForm = document.getElementById('personalForm');
    if (personalForm) {
        personalForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var currentUser = window.PROFILE_STATE.currentUser;
            var buttonInfo = prepareButtonForSave('personal');
            if (!buttonInfo) return;
            var button = buttonInfo.button;
            var originalText = buttonInfo.originalText;

            var firstName = document.getElementById('firstName').value.trim();
            var lastName = document.getElementById('lastName').value.trim();
            var fullName = firstName + ' ' + lastName;
            var country = document.getElementById('country').value;

            if (!firstName || !lastName) {
                showError('Le prenom et le nom sont obligatoires');
                resetButton('personal', button, originalText);
                return;
            }
            if (!country) {
                showError('Veuillez selectionner un pays');
                resetButton('personal', button, originalText);
                return;
            }

            try {
                var r1 = await updateProfileField('full_name', fullName);
                var r2 = await updateProfileField('country', country);
                if (!r1.success || !r2.success) throw new Error('Erreur sauvegarde');

                if (!currentUser.profile) currentUser.profile = {};
                currentUser.profile.full_name = fullName;
                currentUser.profile.country = country;
                currentUser.profile.first_name = firstName;
                currentUser.profile.last_name = lastName;

                if (window.authManager && window.authManager.saveUserToStorage) {
                    window.authManager.saveUserToStorage();
                }

                renderFallbackAvatar();

                showSuccess('Profil mis a jour !');
            } catch (error) {
                showError('Erreur: ' + error.message);
            } finally {
                setTimeout(function() { resetButton('personal', button, originalText); }, 500);
            }
        });
    }

    // Formulaire langue
    var languageForm = document.getElementById('languageForm');
    if (languageForm) {
        languageForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var currentUser = window.PROFILE_STATE.currentUser;
            var buttonInfo = prepareButtonForSave('language');
            if (!buttonInfo) { showError('Erreur: bouton non disponible'); return; }
            var button = buttonInfo.button;
            var originalText = buttonInfo.originalText;

            var frenchLevel = document.getElementById('frenchLevel').value;
            var learningGoals = document.getElementById('learningGoals').value.trim();

            if (!frenchLevel) {
                showError('Veuillez selectionner votre niveau');
                window.PROFILE_STATE.isSavingLanguage = false;
                button.innerHTML = originalText;
                button.disabled = false;
                return;
            }

            try {
                var result = await updateProfileField('french_level', frenchLevel);
                if (!result.success) throw new Error('Erreur sauvegarde niveau');

                if (learningGoals) {
                    var rGoals = await updateProfileField('learning_goals', learningGoals);
                    if (!rGoals.success) console.warn('Erreur objectifs');
                }

                if (!currentUser.profile) currentUser.profile = {};
                currentUser.profile.french_level = frenchLevel;
                if (learningGoals) currentUser.profile.learning_goals = learningGoals;

                if (window.authManager && window.authManager.saveUserToStorage) {
                    window.authManager.saveUserToStorage();
                }
                showSuccess('Niveau mis a jour !');
            } catch (error) {
                showError('Erreur: ' + error.message);
            } finally {
                window.PROFILE_STATE.isSavingLanguage = false;
                setTimeout(function() {
                    if (button && button.parentNode) { button.innerHTML = originalText; button.disabled = false; }
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

            var newPassword = document.getElementById('newPassword').value;
            var confirmPassword = document.getElementById('confirmPassword').value;

            if (newPassword.length < 8) {
                showError('Minimum 8 caracteres');
                resetButton('password', button, originalText);
                return;
            }
            if (newPassword !== confirmPassword) {
                showError('Les mots de passe ne correspondent pas');
                resetButton('password', button, originalText);
                return;
            }

            try {
                if (!supabaseClient || !supabaseClient.auth) throw new Error('Supabase non disponible');
                var result = await supabaseClient.auth.updateUser({ password: newPassword });
                if (result.error) throw result.error;
                showSuccess('Mot de passe mis a jour !');
                passwordForm.reset();
            } catch (error) {
                showError('Erreur: ' + (error.message || 'Impossible de changer'));
            } finally {
                setTimeout(function() { resetButton('password', button, originalText); }, 500);
            }
        });
    }

    window.PROFILE_STATE.eventsAttached = true;
    console.log('Formulaires attaches');
}

// ===== INITIALISATION =====
async function initProfilePage() {
    console.log('Init profil...');
    if (window.PROFILE_STATE.initialized) { console.log('Deja init'); return; }

    try {
        await Promise.all([waitForSupabase(), waitForAuthManager()]);

        var currentUser = window.PROFILE_STATE.currentUser;
        if (!currentUser) { showError('Aucun utilisateur'); return; }

        console.log('Init pour:', currentUser.email);

        await loadProfileData();

        if (currentUser.profile && currentUser.profile.avatar_url) {
            renderAvatar(currentUser.profile);
        } else {
            renderFallbackAvatar();
        }

        attachAvatarEvents();
        attachFormEvents();

        if (window.translationManager) {
            window.translationManager.applyTranslations();
            var ld = document.getElementById('languageSwitcherDesktop');
            if (ld) {
                var nld = ld.cloneNode(true);
                ld.parentNode.replaceChild(nld, ld);
                document.getElementById('languageSwitcherDesktop').addEventListener('click', function(e) {
                    e.preventDefault(); e.stopPropagation();
                    window.translationManager.toggleLanguage();
                });
            }
            var lm = document.getElementById('languageSwitcherMobile');
            if (lm) {
                var nlm = lm.cloneNode(true);
                lm.parentNode.replaceChild(nlm, lm);
                document.getElementById('languageSwitcherMobile').addEventListener('click', function(e) {
                    e.preventDefault(); e.stopPropagation();
                    window.translationManager.toggleLanguage();
                });
            }
            window.addEventListener('language:changed', function() {
                setTimeout(function() { if (window.loadProfileData) window.loadProfileData(); }, 100);
            });
        }

        window.PROFILE_STATE.initialized = true;
        console.log('Profil init OK');
    } catch (error) {
        console.error('Erreur init:', error);
        showError('Erreur init: ' + error.message);
    }
}

// ===== MESSAGES =====
function showError(message) {
    var errorDiv = document.getElementById('errorMessage');
    var errorText = document.getElementById('errorText');
    var successDiv = document.getElementById('successMessage');
    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.style.display = 'flex';
        if (successDiv) successDiv.style.display = 'none';
        setTimeout(function() { if (errorDiv) errorDiv.style.display = 'none'; }, 5000);
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
        setTimeout(function() { if (successDiv) successDiv.style.display = 'none'; }, 3000);
    }
}

// ===== MISE A JOUR DONNEES =====
window.updateProfileData = async function() {
    console.log('Update profil...');
    if (window.authManager && window.authManager.getCurrentUser) {
        window.PROFILE_STATE.currentUser = window.authManager.getCurrentUser();
    }
    await loadProfileData();
    var user = window.PROFILE_STATE.currentUser;
    if (user && user.profile && user.profile.avatar_url) {
        renderAvatar(user.profile);
    } else {
        renderFallbackAvatar();
    }
};

// Exposer
window.initProfilePage = initProfilePage;
window.loadProfileData = loadProfileData;
window.renderAvatar = renderAvatar;
window.renderFallbackAvatar = renderFallbackAvatar;