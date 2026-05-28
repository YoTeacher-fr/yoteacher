// ===== SUPABASE.JS - VERSION LOCAL PRIORITAIRE =====
console.log("🔌 Initialisation de Supabase...");

if (!window.YOTEACHER_CONFIG) {
    console.error("❌ Configuration manquante");
    window.supabase = null;
    window.supabaseReady = false;
    window.supabaseInitialized = Promise.resolve(false);
} else {
    const CONFIG = window.YOTEACHER_CONFIG;

    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
        console.error("❌ URL ou clé Supabase manquante");
        window.supabase = null;
        window.supabaseReady = false;
        window.supabaseInitialized = Promise.resolve(false);
    } else {
        window.supabaseInitialized = (async function() {
            try {
                // 1. PRIORITÉ : Supabase déjà chargé globalement (balise script locale)
                if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
                    console.log("✅ Supabase déjà disponible globalement (local v2.106.1)");
                } else {
                    // 2. Essayer de charger le local supabase.min.js (même dossier)
                    try {
                        console.log("📦 Tentative chargement local supabase.min.js...");
                        await loadScript('supabase.min.js');
                        console.log("✅ Supabase chargé depuis fichier local");
                    } catch (localErr) {
                        console.warn("⚠️ Local non trouvé, fallback CDN jsDelivr v2.106.1:", localErr.message);
                        const cdnUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.1/dist/umd/supabase.min.js';
                        await loadScript(cdnUrl);
                        console.log("✅ Supabase chargé depuis CDN (fallback)");
                    }
                }

                // 3. Créer le client
                const client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true,
                        storage: window.localStorage
                    },
                    realtime: {
                        timeout: 20000
                    }
                });

                console.log("✅ Supabase client créé");

                window.supabase = client;
                window.supabaseReady = true;
                return true;

            } catch (error) {
                console.error("❌ Erreur initialisation Supabase:", error.message);
                window.supabase = null;
                window.supabaseReady = false;
                return false;
            }
        })();
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Échec chargement script: ${src}`));
        document.head.appendChild(script);
    });
}

window.waitForSupabase = function(callback) {
    if (window.supabaseInitialized) {
        window.supabaseInitialized.then(() => { if (callback) callback(); });
    } else if (callback) {
        callback();
    }
};

// Réinitialisation : local prioritaire, CDN fallback
window.resetSupabase = async function() {
    console.log("🔄 Réinitialisation de Supabase...");
    window.supabase = null;
    window.supabaseReady = false;

    if (!window.YOTEACHER_CONFIG?.SUPABASE_URL || !window.YOTEACHER_CONFIG?.SUPABASE_ANON_KEY) {
        console.error("❌ Config manquante pour reset");
        return false;
    }

    try {
        // Essayer local d'abord
        try {
            await loadScript('supabase.min.js');
            console.log("✅ Reset : local chargé");
        } catch (localErr) {
            console.warn("⚠️ Reset : local échoué, fallback CDN");
            const cdnUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.1/dist/umd/supabase.min.js';
            await loadScript(cdnUrl);
        }

        const client = window.supabase.createClient(
            window.YOTEACHER_CONFIG.SUPABASE_URL, 
            window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY, 
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storage: window.localStorage
                }
            }
        );

        window.supabase = client;
        window.supabaseReady = true;
        console.log("✅ Supabase réinitialisé avec succès");
        return true;
    } catch (error) {
        console.error("❌ Échec réinitialisation:", error);
        return false;
    }
};