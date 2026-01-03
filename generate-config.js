const fs = require('fs');
const path = require('path');

console.log('🔧 Génération de config.js pour Cloudflare Pages...');

// Configuration depuis les variables d'environnement Cloudflare
const config = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  CALCOM_API_KEY: process.env.CALCOM_API_KEY || '',
  CALCOM_USERNAME: process.env.CALCOM_USERNAME || 'yoann',
  CALCOM_EVENT_TYPE_ESSAI: process.env.CALCOM_EVENT_TYPE_ESSAI || '',
  CALCOM_EVENT_TYPE_CONVERSATION: process.env.CALCOM_EVENT_TYPE_CONVERSATION || '',
  CALCOM_EVENT_TYPE_CURRICULUM: process.env.CALCOM_EVENT_TYPE_CURRICULUM || '',
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

// Vérification Cal.com (avertissement seulement)
if (!config.CALCOM_API_KEY) {
  console.warn('⚠️  AVERTISSEMENT: CALCOM_API_KEY manquante - Cal.com désactivé');
} else {
  console.log('✅ Cal.com API Key configurée');
  
  // Vérifier les event types
  const missingEventTypes = [];
  if (!config.CALCOM_EVENT_TYPE_ESSAI) missingEventTypes.push('CALCOM_EVENT_TYPE_ESSAI');
  if (!config.CALCOM_EVENT_TYPE_CONVERSATION) missingEventTypes.push('CALCOM_EVENT_TYPE_CONVERSATION');
  if (!config.CALCOM_EVENT_TYPE_CURRICULUM) missingEventTypes.push('CALCOM_EVENT_TYPE_CURRICULUM');
  
  if (missingEventTypes.length > 0) {
    console.warn(`⚠️  AVERTISSEMENT: Types d'événements Cal.com manquants: ${missingEventTypes.join(', ')}`);
  } else {
    console.log('✅ Tous les types d\'événements Cal.com configurés');
  }
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