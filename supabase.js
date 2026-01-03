// ===== SUPAVRAI.JS =====
// Connexion directe à Supabase

console.log("🔌 Initialisation de Supabase...");

// Vérifier la configuration
if (!window.YOTEACHER_CONFIG) {
    showConfigError("Fichier config.js non trouvé");
    throw new Error("Configuration manquante");
}

const CONFIG = window.YOTEACHER_CONFIG;

// Vérifier les valeurs
if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    showConfigError("URL ou clé Supabase manquante");
    throw new Error("Configuration Supabase incomplète");
}

// Initialiser Supabase
let supabaseClient = null;

async function initSupabase() {
    try {
        // Importer la bibliothèque
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        
        // Créer le client
        supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        });
        
        // Tester la connexion
        const { data, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.warn("⚠️ Note:", error.message);
            console.log("🔧 Cela peut être normal si vous n'avez pas encore créé les tables");
        } else {
            console.log("✅ Supabase connecté");
            
            if (data.session) {
                console.log(`👋 Bonjour ${data.session.user.email}`);
            }
        }
        
        return supabaseClient;
        
    } catch (error) {
        console.error("❌ Erreur Supabase:", error);
        showErrorToUser("Impossible de se connecter à la base de données");
        return null;
    }
}

// Fonctions d'aide
function showConfigError(message) {
    console.error("❌ ERREUR CONFIGURATION:", message);
    console.error("📋 Créez un fichier config.js avec :");
    console.error(`
window.YOTEACHER_CONFIG = {
    SUPABASE_URL: "https://votre-id.supabase.co",
    SUPABASE_ANON_KEY: "votre-cle-anon-publique",
    CALCOM_USERNAME: "yoann",
    CONTACT_EMAIL: "contact@yoteacher.com"
};`);
}

function showErrorToUser(message) {
    if (typeof document !== 'undefined') {
        // Créer une notification
        const alert = document.createElement('div');
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 9999;
            max-width: 400px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            font-family: sans-serif;
        `;
        alert.innerHTML = `
            <strong>⚠️ Erreur</strong><br>
            ${message}<br>
            <small>Vérifiez la console (F12) pour plus de détails</small>
        `;
        document.body.appendChild(alert);
        
        setTimeout(() => alert.remove(), 8000);
    }
}

// Vérifier si les tables existent
async function checkDatabaseTables() {
    if (!supabaseClient) return;
    
    try {
        // Vérifier la table profiles
        const { error: profilesError } = await supabaseClient
            .from('profiles')
            .select('count', { count: 'exact', head: true });
            
        if (profilesError) {
            console.warn("📋 Table 'profiles' manquante");
            console.warn("Exécutez ce SQL dans Supabase :");
            console.warn(`
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    is_vip BOOLEAN DEFAULT false,
    credits INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`);
        } else {
            console.log("✅ Table 'profiles' trouvée");
        }
        
        // Vérifier la table bookings
        const { error: bookingsError } = await supabaseClient
            .from('bookings')
            .select('count', { count: 'exact', head: true });
            
        if (bookingsError) {
            console.warn("📋 Table 'bookings' manquante");
            console.warn("Exécutez ce SQL dans Supabase :");
            console.warn(`
CREATE TABLE IF NOT EXISTS bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    calcom_id TEXT,
    event_type TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status TEXT DEFAULT 'confirmed',
    meet_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`);
        } else {
            console.log("✅ Table 'bookings' trouvée");
        }
        
    } catch (error) {
        // Ignorer les erreurs de vérification
    }
}

// Exposer Supabase globalement
window.supabaseInitialized = new Promise(async (resolve) => {
    try {
        const client = await initSupabase();
        
        if (client) {
            window.supabase = client;
            
            // Vérifier les tables
            await checkDatabaseTables();
            
            console.log("✨ Supabase prêt à l'emploi");
            resolve(true);
        } else {
            console.error("❌ Échec de l'initialisation de Supabase");
            resolve(false);
        }
    } catch (error) {
        console.error("❌ Erreur lors de l'initialisation:", error);
        resolve(false);
    }
});

// Fonction helper pour attendre Supabase (pour compatibilité)
window.waitForSupabase = function(callback) {
    window.supabaseInitialized.then((initialized) => {
        if (callback) callback();
    });
};

// Exporter pour utilisation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        initSupabase, 
        supabaseClient 
    };
}