
// ===== SUPABASE.JS - VERSION CORRIGÉE (CDN ALTERNATIF) =====
console.log("🔌 Initialisation de Supabase...");

// Vérifier la configuration
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
        // Initialisation avec CDN alternatif (unpkg au lieu de jsDelivr)
        window.supabaseInitialized = (async function() {
            try {
                // Vérifier si Supabase est déjà chargé globalement (par balise script)
                if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
                    console.log("✅ Supabase déjà disponible globalement");
                } else {
                    // Charger Supabase via CDN alternatif
                    console.log("📦 Chargement de Supabase via CDN alternatif...");
                    
                    // Utiliser unpkg au lieu de jsDelivr
                    await loadScript('https://unpkg.com/@supabase/supabase-js@2/dist/supabase.min.js');
                    console.log("✅ Supabase chargé depuis CDN");
                }
                
                // Initialiser le client
                const client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true,
                        storage: window.localStorage
                    }
                });
                
                // Tester la connexion
                try {
                    const { data: { session } } = await client.auth.getSession();
                    console.log("✅ Supabase connecté, session:", session ? "présente" : "absente");
                } catch (sessionError) {
                    // Ignorer les erreurs de session au démarrage
                    console.log("ℹ️ Supabase connecté (session non vérifiée)");
                }
                
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

// Fonction helper pour charger un script
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        
        script.onload = () => {
            console.log(`✅ Script chargé: ${src}`);
            resolve();
        };
        
        script.onerror = (error) => {
            console.error(`❌ Erreur chargement script: ${src}`, error);
            reject(new Error(`Échec chargement script: ${src}`));
        };
        
        document.head.appendChild(script);
    });
}

// Fonction helper pour compatibilité
window.waitForSupabase = function(callback) {
    if (window.supabaseInitialized) {
        window.supabaseInitialized.then(() => {
            if (callback) callback();
        });
    } else if (callback) {
        callback();
    }
};

// Fonction pour forcer la réinitialisation
window.resetSupabase = function() {
    console.log("🔄 Réinitialisation de Supabase...");
    window.supabase = null;
    window.supabaseReady = false;
    
    // Recréer la promesse d'initialisation
    if (window.YOTEACHER_CONFIG && window.YOTEACHER_CONFIG.SUPABASE_URL && window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY) {
        window.supabaseInitialized = (async function() {
            try {
                // Charger depuis CDN
                await loadScript('https://unpkg.com/@supabase/supabase-js@2/dist/supabase.min.js');
                
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
        })();
    }
};
