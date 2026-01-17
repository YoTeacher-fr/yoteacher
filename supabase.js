// ===== SUPABASE.JS - VERSION CORRIGÉE =====
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
        // Initialisation avec gestion d'erreur améliorée
        window.supabaseInitialized = (async function() {
            try {
                // Timeout pour l'import
                const importPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Import timeout')), 10000)
                );
                
                const { createClient } = await Promise.race([importPromise, timeoutPromise]);
                
                const client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true,
                        storage: window.localStorage
                    }
                });
                
                // Test simple de connexion
                try {
                    await client.auth.getSession();
                    console.log("✅ Supabase connecté");
                    window.supabase = client;
                    window.supabaseReady = true;
                    return true;
                } catch (sessionError) {
                    console.warn("⚠️ Session error (peut être normal):", sessionError.message);
                    window.supabase = client;
                    window.supabaseReady = true;
                    return true;
                }
                
            } catch (error) {
                console.error("❌ Erreur initialisation Supabase:", error.message);
                window.supabase = null;
                window.supabaseReady = false;
                return false;
            }
        })();
    }
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