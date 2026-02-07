
// ===== SUPABASE.JS - VERSION CORRIGÉE (SÉPARATION LIBRAIRIE/CLIENT) =====
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
                // Charger la LIBRAIRIE Supabase si pas déjà chargée
                if (typeof window.supabaseLib === 'undefined' || !window.supabaseLib.createClient) {
                    console.log("📦 Chargement de la librairie Supabase via CDN...");
                    
                    // Charger le script
                    await loadScript('https://unpkg.com/@supabase/supabase-js@2/dist/supabase.min.js');
                    
                    // La librairie se charge dans window.supabase, on la copie dans supabaseLib
                    if (window.supabase && window.supabase.createClient) {
                        window.supabaseLib = window.supabase;
                        console.log("✅ Librairie Supabase chargée depuis CDN");
                    } else {
                        throw new Error("La librairie Supabase n'a pas été chargée correctement");
                    }
                } else {
                    console.log("✅ Librairie Supabase déjà disponible");
                }
                
                // Créer le CLIENT Supabase
                console.log("🔨 Création du client Supabase...");
                const client = window.supabaseLib.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
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
                
                // Stocker le CLIENT dans window.supabase
                window.supabase = client;
                window.supabaseReady = true;
                
                console.log("✅ Client Supabase prêt");
                console.log("📊 window.supabaseLib:", typeof window.supabaseLib);
                console.log("📊 window.supabase:", typeof window.supabase);
                console.log("📊 window.supabase.auth:", typeof window.supabase?.auth);
                console.log("📊 window.supabase.from:", typeof window.supabase?.from);
                
                return true;
                
            } catch (error) {
                console.error("❌ Erreur initialisation Supabase:", error.message);
                console.error("❌ Stack:", error.stack);
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
        // Vérifier si le script existe déjà
        if (document.querySelector(`script[src="${src}"]`)) {
            console.log(`ℹ️ Script déjà présent: ${src}`);
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
                // La librairie existe déjà dans window.supabaseLib
                if (!window.supabaseLib || !window.supabaseLib.createClient) {
                    throw new Error("Librairie Supabase non disponible");
                }
                
                const client = window.supabaseLib.createClient(
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
