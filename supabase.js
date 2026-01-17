// ===== SUPAVRAI.JS - VERSION ULTIME SANS CONFLIT =====
// Connexion à Supabase avec gestion robuste des requêtes

console.log("🔌 Initialisation de Supabase...");

// Variables globales
window.supabaseClient = null;
window.supabase = null;
window.supabaseReady = false;
window.supabaseInitPromise = null;

async function initSupabase() {
    try {
        console.log("📦 Chargement module Supabase...");
        
        let supabaseModule;
        
        // Essayer jsdelivr d'abord
        try {
            supabaseModule = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
            console.log("✅ Module chargé depuis jsdelivr");
        } catch (cdnError) {
            console.warn("⚠️ jsdelivr échoué, tentative esm.sh...");
            try {
                supabaseModule = await import('https://esm.sh/@supabase/supabase-js@2');
                console.log("✅ Module chargé depuis esm.sh");
            } catch (esmError) {
                console.error("❌ Impossible de charger Supabase");
                return null;
            }
        }
        
        if (!supabaseModule || !supabaseModule.createClient) {
            throw new Error("Module Supabase invalide");
        }
        
        const { createClient } = supabaseModule;
        
        // Vérifier configuration
        if (!window.YOTEACHER_CONFIG) {
            console.error("❌ config.js non trouvé");
            return null;
        }
        
        const CONFIG = window.YOTEACHER_CONFIG;
        
        if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
            console.error("❌ Configuration Supabase incomplète");
            return null;
        }
        
        console.log("🔗 Connexion à Supabase...");
        
        // Créer client avec timeout
        const client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false, // IMPORTANT: Désactiver pour éviter les conflits
                storage: window.localStorage,
                storageKey: 'sb-auth'
            },
            global: {
                headers: {
                    'apikey': CONFIG.SUPABASE_ANON_KEY
                }
            }
        });
        
        // Test de connexion LÉGER (sans bloquer)
        setTimeout(async () => {
            try {
                const { data } = await client.auth.getSession();
                if (data.session) {
                    console.log(`👋 Session trouvée: ${data.session.user.email}`);
                }
            } catch (testError) {
                // Ignorer les erreurs de test
                console.log("ℹ️ Test connexion:", testError.message);
            }
        }, 1000);
        
        return client;
        
    } catch (error) {
        console.error("❌ Erreur initSupabase:", error.name, "-", error.message);
        return null;
    }
}

// Créer la promesse MAIS ne pas exécuter immédiatement
window.supabaseInitPromise = (async () => {
    console.log("🚀 Lancement initialisation Supabase...");
    
    try {
        const client = await initSupabase();
        
        if (client) {
            window.supabase = client;
            window.supabaseClient = client;
            window.supabaseReady = true;
            
            console.log("🎉 Supabase initialisé avec succès");
            
            // Émettre événement
            window.dispatchEvent(new CustomEvent('supabase:ready'));
            
            return client;
        } else {
            console.warn("⚠️ Supabase non initialisé");
            window.supabaseReady = false;
            return null;
        }
    } catch (error) {
        console.error("❌ Exception supabaseInitPromise:", error);
        window.supabaseReady = false;
        return null;
    }
})();

// Fonction helper pour attendre
window.ensureSupabaseReady = async function() {
    if (window.supabase && window.supabaseReady) {
        return window.supabase;
    }
    
    if (window.supabaseInitPromise) {
        return await window.supabaseInitPromise;
    }
    
    return null;
};

// Démarrer l'initialisation au chargement
document.addEventListener('DOMContentLoaded', function() {
    console.log("📄 DOM chargé - Supabase s'initialisera automatiquement");
    
    // L'initialisation est déjà en cours via supabaseInitPromise
});

console.log('✅ supabase.js chargé - Version robuste sans conflit');