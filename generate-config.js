const fs = require('fs');
const path = require('path');

console.log('🔧 Génération de config.js pour Cloudflare Pages...');

// Configuration depuis les variables d'environnement Cloudflare
const config = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  
  // Paiements
  REVOLUT_PAYMENT_LINK: process.env.REVOLUT_PAYMENT_LINK || 'https://revolut.me/yoann',
  WISE_PAYMENT_LINK: process.env.WISE_PAYMENT_LINK || 'https://wise.com/pay/yoann',
  PAYPAL_BUSINESS_EMAIL: process.env.PAYPAL_BUSINESS_EMAIL || 'yoann@yoteacher.com',
  
  // Square (pour cartes bancaires)
  SQUARE_APPLICATION_ID: process.env.SQUARE_APPLICATION_ID || '',
  SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID || '',
  SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN || '',
  SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT || 'sandbox',
  
  // Cal.com
  CALCOM_API_KEY: process.env.CALCOM_API_KEY || '',
  CALCOM_USERNAME: process.env.CALCOM_USERNAME || 'yoann-bourbia-6ido9g',
  CALCOM_EVENT_TYPE_ESSAI: process.env.CALCOM_EVENT_TYPE_ESSAI || '4139074',
  CALCOM_EVENT_TYPE_CONVERSATION: process.env.CALCOM_EVENT_TYPE_CONVERSATION || '',
  CALCOM_EVENT_TYPE_CURRICULUM: process.env.CALCOM_EVENT_TYPE_CURRICULUM || '',
  
  // Email
  CONTACT_EMAIL: process.env.CONTACT_EMAIL || 'contact@yoteacher.com',
  SITE_URL: process.env.SITE_URL || '',
  
  // ENV
  ENV: process.env.NODE_ENV || 'production'
};

// Validation
if (!config.SUPABASE_URL) {
  console.error('❌ ERREUR: SUPABASE_URL manquante');
  console.error('💡 Configure-la dans Cloudflare Pages → Settings → Environment Variables');
  console.error('\nVariables d\'environnement requises:');
  console.error('1. SUPABASE_URL');
  console.error('2. SUPABASE_ANON_KEY');
  console.error('3. REVOLUT_PAYMENT_LINK (optionnel pour développement)');
  console.error('4. WISE_PAYMENT_LINK (optionnel pour développement)');
  console.error('5. PAYPAL_BUSINESS_EMAIL (optionnel pour développement)');
  console.error('6. CALCOM_API_KEY (optionnel pour développement)');
  console.error('7. CONTACT_EMAIL');
  console.error('8. SITE_URL');
  process.exit(1);
}

if (!config.SUPABASE_ANON_KEY) {
  console.error('❌ ERREUR: SUPABASE_ANON_KEY manquante');
  process.exit(1);
}

// Vérification des clés de paiement
console.log('💳 Vérification des configurations de paiement...');

const paymentConfigs = [
  { key: 'REVOLUT_PAYMENT_LINK', name: 'Revolut', optional: false },
  { key: 'WISE_PAYMENT_LINK', name: 'Wise', optional: false },
  { key: 'PAYPAL_BUSINESS_EMAIL', name: 'PayPal', optional: false },
  { key: 'SQUARE_APPLICATION_ID', name: 'Square Application ID', optional: true },
  { key: 'SQUARE_LOCATION_ID', name: 'Square Location ID', optional: true },
  { key: 'SQUARE_ACCESS_TOKEN', name: 'Square Access Token', optional: true }
];

paymentConfigs.forEach(({ key, name, optional }) => {
  if (!config[key] && !optional) {
    console.warn(`⚠️  AVERTISSEMENT: ${name} non configuré (${key})`);
    console.warn(`   💡 Configurez cette variable pour activer ${name}`);
  } else if (config[key]) {
    console.log(`✅ ${name} configuré`);
  }
});

// Vérification Cal.com (avertissement seulement)
if (!config.CALCOM_API_KEY) {
  console.warn('⚠️  AVERTISSEMENT: CALCOM_API_KEY manquante - Cal.com désactivé');
  console.warn('   💡 Les créneaux seront simulés en mode développement');
} else {
  console.log('✅ Cal.com API Key configurée');
  
  // Vérifier les event types
  const missingEventTypes = [];
  if (!config.CALCOM_EVENT_TYPE_ESSAI) missingEventTypes.push('CALCOM_EVENT_TYPE_ESSAI');
  if (!config.CALCOM_EVENT_TYPE_CONVERSATION) missingEventTypes.push('CALCOM_EVENT_TYPE_CONVERSATION');
  if (!config.CALCOM_EVENT_TYPE_CURRICULUM) missingEventTypes.push('CALCOM_EVENT_TYPE_CURRICULUM');
  
  if (missingEventTypes.length > 0) {
    console.warn(`⚠️  AVERTISSEMENT: Types d'événements Cal.com manquants: ${missingEventTypes.join(', ')}`);
    console.warn('   💡 Ces types de cours ne seront pas disponibles pour la réservation');
  } else {
    console.log('✅ Tous les types d\'événements Cal.com configurés');
  }
}

// Vérifier l'email de contact
if (!config.CONTACT_EMAIL) {
  console.warn('⚠️  AVERTISSEMENT: CONTACT_EMAIL non configuré');
} else {
  console.log('✅ Email de contact configuré');
}

// Contenu du fichier
const content = `// ⚠️ FICHIER GÉNÉRÉ AUTOMATIQUEMENT - NE PAS MODIFIER MANUELLEMENT
// Généré le: ${new Date().toISOString()}
// Environnement: ${config.ENV}

window.YOTEACHER_CONFIG = ${JSON.stringify(config, null, 2)};
`;

// Écrire le fichier
fs.writeFileSync(path.join(__dirname, 'config.js'), content);
console.log('\n✅ config.js généré avec succès');
console.log(`📊 Mode: ${config.ENV}`);
console.log(`🌐 Site: ${config.SITE_URL || 'Non configuré'}`);
console.log('\n📋 Résumé de la configuration:');
console.log(`- Supabase: ${config.SUPABASE_URL ? '✅ Connecté' : '❌ Non configuré'}`);
console.log(`- Paiements: ${config.REVOLUT_PAYMENT_LINK && config.WISE_PAYMENT_LINK && config.PAYPAL_BUSINESS_EMAIL ? '✅ Configurés' : '⚠️ Partiellement configurés'}`);
console.log(`- Cal.com: ${config.CALCOM_API_KEY ? '✅ Connecté' : '❌ Mode simulation'}`);
console.log(`- Square: ${config.SQUARE_APPLICATION_ID ? '✅ Configuré' : '❌ Non configuré (cartes désactivées)'}`);

console.log('\n🔧 Pour configurer Square:');
console.log('1. Créez un compte sur https://squareup.com');
console.log('2. Allez dans Square Developer Portal: https://developer.squareup.com');
console.log('3. Créez une nouvelle application');
console.log('4. Obtenez votre Application ID et Location ID');
console.log('5. Générez un Access Token');
console.log('6. Ajoutez ces variables dans Cloudflare Pages:');
console.log('   SQUARE_APPLICATION_ID=votre-id');
console.log('   SQUARE_LOCATION_ID=votre-location-id');
console.log('   SQUARE_ACCESS_TOKEN=votre-token');
console.log('   SQUARE_ENVIRONMENT=sandbox (ou production)');

console.log('\n🔧 Pour configurer Revolut et Wise:');
console.log('1. Revolut: Créez un lien Revolut.me sur https://revolut.me');
console.log('2. Wise: Créez un lien de paiement sur https://wise.com');
console.log('3. PayPal: Utilisez votre email professionnel PayPal');

console.log('\n🚀 Pour tester en local (sans clés API):');
console.log('1. Le système fonctionnera en mode simulation');
console.log('2. Les créneaux et paiements seront simulés');
console.log('3. Pour le mode production, configurez toutes les variables');