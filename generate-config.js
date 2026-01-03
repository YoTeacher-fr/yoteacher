// generate-config.js
const fs = require('fs');
const path = require('path');

console.log('🔧 Génération de config.js pour Cloudflare Pages...');

// Configuration depuis les variables d'environnement Cloudflare
const config = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  CALCOM_API_KEY: process.env.CALCOM_API_KEY || '',
  CALCOM_USERNAME: process.env.CALCOM_USERNAME || 'yoann',
  CONTACT_EMAIL: process.env.CONTACT_EMAIL || 'contact@yoteacher.com',
  SITE_URL: process.env.SITE_URL || '',
  ENV: process.env.NODE_ENV || 'production'
};

// Validation
if (!config.SUPABASE_URL) {
  console.error('❌ ERREUR: SUPABASE_URL manquante');
  console.error('💡 Configure-la dans Cloudflare Pages → Settings → Environment Variables');
  process.exit(1);
}

if (!config.SUPABASE_ANON_KEY) {
  console.error('❌ ERREUR: SUPABASE_ANON_KEY manquante');
  process.exit(1);
}

// Contenu du fichier
const content = `// ⚠️ FICHIER GÉNÉRÉ AUTOMATIQUEMENT - NE PAS MODIFIER MANUELLEMENT
// Généré le: ${new Date().toISOString()}
// Environnement: ${config.ENV}

window.YOTEACHER_CONFIG = ${JSON.stringify(config, null, 2)};
`;

// Écrire le fichier
fs.writeFileSync(path.join(__dirname, 'config.js'), content);
console.log('✅ config.js généré avec succès');
console.log(`📊 Mode: ${config.ENV}`);
console.log(`🌐 Site: ${config.SITE_URL}`);