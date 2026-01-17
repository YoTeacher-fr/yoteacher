// ===== SUPAVRAI.JS - VERSION CORRIGÉE POUR COORDINATION =====
// Connexion directe à Supabase avec gestion robuste des erreurs et coordination

console.log("🔌 Initialisation de Supabase...");

// Déclarer les variables globales
window.supabaseClient = null;
window.supabase = null;
window.supabaseReady = false;
window.supabaseInitPromise = null; // NOUVEAU : Promesse d'initialisation

async function initSupabase() {
    try {
        console.log("📦 Tentative de chargement du module Supabase...");
        
        let supabaseModule;
        
        // Essayer avec différents CDNs en cas d'échec
        const cdnUrls = [
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
            'https://esm.sh/@supabase/supabase-js@2',
            'https://unpkg.com/@supabase/supabase-js@2/+esm'
        ];
        
        let lastError = null;
        
        for (const cdnUrl of cdnUrls) {
            try {
                console.log(`🔗 Tentative avec: ${cdnUrl}`);
                
                // Créer une promesse avec timeout
                const importPromise = import(cdnUrl);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Timeout chargement ${cdnUrl}`)), 8000)
                );
                
                supabaseModule = await Promise.race([importPromise, timeoutPromise]);
                console.log(`✅ Module chargé depuis: ${cdnUrl}`);
                break;
            } catch (cdnError) {
                lastError = cdnError;
                console.warn(`⚠️ Échec avec ${cdnUrl}:`, cdnError.message);
                continue;
            }
        }
        
        if (!supabaseModule || !supabaseModule.createClient) {
            throw new Error("Impossible de charger le module Supabase. Dernière erreur: " + (lastError?.message || "Inconnue"));
        }
        
        const { createClient } = supabaseModule;
        
        // Vérifier la configuration
        if (!window.YOTEACHER_CONFIG) {
            console.error("❌ Configuration non trouvée - vérifiez config.js");
            console.error("📋 Assurez-vous que config.js contient:");
            console.error(`
window.YOTEACHER_CONFIG = {
    SUPABASE_URL: "https://votre-id.supabase.co",
    SUPABASE_ANON_KEY: "votre-cle-anon-publique",
    CALCOM_USERNAME: "yoann",
    CONTACT_EMAIL: "contact@yoteacher.com"
};`);
            return null;
        }
        
        const CONFIG = window.YOTEACHER_CONFIG;
        
        if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
            console.error("❌ URL ou clé Supabase manquante dans config.js");
            console.error("   URL:", CONFIG.SUPABASE_URL || "NON DÉFINI");
            console.error("   Clé:", CONFIG.SUPABASE_ANON_KEY ? "DÉFINIE" : "NON DÉFINIE");
            return null;
        }
        
        console.log("🔗 Connexion à Supabase avec URL:", CONFIG.SUPABASE_URL.substring(0, 30) + "...");
        
        // Créer le client avec configuration robuste
        const client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: window.localStorage,
                storageKey: 'sb-' + new URL(CONFIG.SUPABASE_URL).hostname
            },
            global: {
                headers: {
                    'apikey': CONFIG.SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                }
            },
            realtime: {
                params: {
                    eventsPerSecond: 10
                }
            }
        });
        
        // Tester la connexion (avec timeout)
        try {
            const testPromise = client.auth.getSession();
            const testTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout connexion Supabase')), 5000)
            );
            
            const { data, error } = await Promise.race([testPromise, testTimeout]);
            
            if (error) {
                console.warn("⚠️ Note test session:", error.message);
                // Ne pas échouer pour cette erreur - le client peut être utilisable
            } else {
                console.log("✅ Supabase connecté avec succès");
                
                if (data.session) {
                    console.log(`👋 Session active pour: ${data.session.user.email || 'utilisateur'}`);
                }
            }
        } catch (testError) {
            console.warn("⚠️ Test de session échoué:", testError.message);
            // Continuer quand même - le client peut être partiellement fonctionnel
        }
        
        return client;
        
    } catch (error) {
        console.error("❌ Erreur fatale Supabase:", error.name, "-", error.message);
        
        // Afficher des informations de débogage
        console.group("🔍 Debug Supabase:");
        console.log("Type d'erreur:", error.name);
        console.log("Message:", error.message);
        console.log("Stack:", error.stack);
        console.log("Window.supabase existe:", !!window.supabase);
        console.log("Window.supabaseClient existe:", !!window.supabaseClient);
        console.log("Config existe:", !!window.YOTEACHER_CONFIG);
        if (window.YOTEACHER_CONFIG) {
            console.log("URL config:", window.YOTEACHER_CONFIG.SUPABASE_URL);
            console.log("Clé config présente:", !!window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY);
        }
        console.groupEnd();
        
        return null;
    }
}

// Créer la promesse d'initialisation MAIS ne pas l'exécuter immédiatement
window.supabaseInitPromise = (async () => {
    console.log("🚀 Démarrage initialisation Supabase...");
    
    try {
        const client = await initSupabase();
        
        if (client) {
            window.supabase = client;
            window.supabaseClient = client;
            window.supabaseReady = true;
            
            console.log("🎉 Supabase initialisé avec succès");
            
            // Émettre un événement global
            window.dispatchEvent(new CustomEvent('supabase:ready', { 
                detail: { client: client } 
            }));
            
            // Vérifier les tables en arrière-plan
            setTimeout(() => {
                checkDatabaseTables().catch(() => {
                    // Ignorer les erreurs de vérification
                });
            }, 1000);
            
            return client;
        } else {
            console.warn("⚠️ Échec initialisation Supabase - client null");
            window.supabaseReady = false;
            
            // Émettre un événement d'échec
            window.dispatchEvent(new CustomEvent('supabase:failed'));
            
            return null;
        }
    } catch (error) {
        console.error("❌ Exception dans supabaseInitPromise:", error);
        window.supabaseReady = false;
        
        // Émettre un événement d'échec
        window.dispatchEvent(new CustomEvent('supabase:failed', { 
            detail: { error: error.message } 
        }));
        
        return null;
    }
})();

// Fonction helper pour attendre l'initialisation
window.ensureSupabaseReady = async function() {
    if (window.supabase && window.supabaseReady) {
        return window.supabase;
    }
    
    if (window.supabaseInitPromise) {
        await window.supabaseInitPromise;
    }
    
    return window.supabase;
};

// Fonction pour vérifier les tables (non bloquante)
async function checkDatabaseTables() {
    if (!window.supabase) {
        console.warn("⚠️ Impossible de vérifier les tables: Supabase non initialisé");
        return;
    }
    
    try {
        console.log("🔍 Vérification des tables...");
        
        const tables = ['profiles', 'bookings', 'vip_pricing', 'packages'];
        
        for (const table of tables) {
            try {
                const { error } = await window.supabase
                    .from(table)
                    .select('id')
                    .limit(1);
                
                if (error && error.code === '42P01') {
                    console.warn(`📋 Table '${table}' manquante`);
                } else if (error) {
                    console.warn(`ℹ️ Note table '${table}':`, error.message);
                } else {
                    console.log(`✅ Table '${table}' accessible`);
                }
            } catch (tableError) {
                console.warn(`⚠️ Erreur vérification table '${table}':`, tableError.message);
            }
        }
        
    } catch (error) {
        console.warn("⚠️ Erreur vérification tables:", error.message);
    }
}

// Exposer des fonctions utiles pour le débogage
window.debugSupabase = function() {
    console.group('🔍 Debug Supabase');
    console.log('supabase:', window.supabase ? 'PRÉSENT' : 'ABSENT');
    console.log('supabaseReady:', window.supabaseReady);
    console.log('supabaseInitPromise:', window.supabaseInitPromise ? 'PRÉSENT' : 'ABSENT');
    console.log('YOTEACHER_CONFIG:', window.YOTEACHER_CONFIG ? 'PRÉSENT' : 'ABSENT');
    
    if (window.YOTEACHER_CONFIG) {
        console.log('URL:', window.YOTEACHER_CONFIG.SUPABASE_URL);
        console.log('Clé:', window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY ? 'DÉFINIE' : 'ABSENTE');
    }
    
    // Tester la connexion si supabase existe
    if (window.supabase) {
        window.supabase.auth.getSession().then(({ data, error }) => {
            console.log('Test session:');
            console.log('  Error:', error ? error.message : 'AUCUNE');
            console.log('  Session:', data?.session ? 'PRÉSENTE' : 'ABSENTE');
            if (data?.session?.user) {
                console.log('  User:', data.session.user.email);
            }
        }).catch(err => {
            console.log('  Erreur test:', err.message);
        });
    }
    
    console.groupEnd();
};

// Initialisation automatique au chargement
document.addEventListener('DOMContentLoaded', function() {
    console.log("📄 DOM chargé - Supabase en cours d'initialisation...");
    
    // Démarrage de l'initialisation si ce n'est pas déjà fait
    if (!window.supabaseInitPromise) {
        console.log("⚠️ supabaseInitPromise non créé, recréation...");
        window.supabaseInitPromise = (async () => {
            const client = await initSupabase();
            if (client) {
                window.supabase = client;
                window.supabaseReady = true;
                return client;
            }
            return null;
        })();
    }
    
    // Événement pour indiquer que Supabase est en cours d'initialisation
    window.dispatchEvent(new CustomEvent('supabase:initializing'));
});

// Exporter pour utilisation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        initSupabase, 
        supabaseClient: window.supabaseClient,
        ensureSupabaseReady: window.ensureSupabaseReady
    };
}

console.log('✅ supabase.js chargé avec système de promesse d\'initialisation');