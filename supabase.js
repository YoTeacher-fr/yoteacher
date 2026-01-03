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
let supabase = null;

async function initSupabase() {
    try {
        // Importer la bibliothèque
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        
        // Créer le client
        supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        });
        
        // Tester la connexion
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
            console.warn("⚠️ Note:", error.message);
            console.log("🔧 Cela peut être normal si vous n'avez pas encore créé les tables");
        } else {
            console.log("✅ Supabase connecté");
            
            if (data.session) {
                console.log(`👋 Bonjour ${data.session.user.email}`);
            }
        }
        
        return supabase;
        
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

// Exposer Supabase globalement
(async function() {
    window.supabase = await initSupabase();
    
    if (window.supabase) {
        console.log("✨ Supabase prêt à l'emploi");
        
        // Vérifier les tables nécessaires
        checkDatabaseTables();
    }
})();

// Vérifier si les tables existent
async function checkDatabaseTables() {
    if (!window.supabase) return;
    
    try {
        // Vérifier la table profiles
        const { error: profilesError } = await window.supabase
            .from('profiles')
            .select('count', { count: 'exact', head: true });
            
        if (profilesError) {
            console.warn("📋 Table 'profiles' manquante");
            console.warn("Exécutez ce SQL dans Supabase :");
            console.warn(`
CREATE TABLE profiles (
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
        const { error: bookingsError } = await window.supabase
            .from('bookings')
            .select('count', { count: 'exact', head: true });
            
        if (bookingsError) {
            console.warn("📋 Table 'bookings' manquante");
        } else {
            console.log("✅ Table 'bookings' trouvée");
        }
        
    } catch (error) {
        // Ignorer les erreurs de vérification
    }
}

// Exporter pour utilisation
if (typeof module !== 'undefined') {
    module.exports = { initSupabase };
}