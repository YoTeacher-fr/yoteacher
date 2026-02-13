const fs = require('fs');
const path = require('path');

console.log('🔧 DÉBUT DE LA GÉNÉRATION DE CONFIG.JS...');

// 1. Diagnostic des variables d'environnement (Visible dans les logs Cloudflare)
console.log('--- Diagnostic des variables ---');
const requiredVars = [
    'SUPABASE_URL', 
    'SUPABASE_ANON_KEY', 
    'STRIPE_PUBLISHABLE_KEY', 
    'CALCOM_API_KEY'
];

requiredVars.forEach(v => {
    const found = process.env[v] ? '✅ TROUVÉE' : '❌ MANQUANTE';
    console.log(`${v}: ${found}`);
});
console.log('-------------------------------');

// 2. Construction de l'objet de configuration
const config = {
    // Informations de génération
    GENERATED_AT: new Date().toISOString(),
    ENV: 'production',

    // Supabase
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
EDGE_FUNCTIONS_URL: process.env.EDGE_FUNCTIONS_URL || (process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace('.supabase.co', '.supabase.co/functions/v1') : ''),

    
    // Stripe
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
    STRIPE_BACKEND_URL: '/api/stripe-payment',
    
    // Cal.com
    CALCOM_API_KEY: process.env.CALCOM_API_KEY || '',
    CALCOM_USERNAME: process.env.CALCOM_USERNAME || 'yoann-bourbia-6ido9g',
    CALCOM_EVENT_TYPE_ESSAI: process.env.CALCOM_EVENT_TYPE_ESSAI || '4139074',
    CALCOM_EVENT_TYPE_CONVERSATION: process.env.CALCOM_EVENT_TYPE_CONVERSATION || '4139515',
    CALCOM_EVENT_TYPE_CURRICULUM: process.env.CALCOM_EVENT_TYPE_CURRICULUM || '4139503',
    CALCOM_EVENT_TYPE_EXAMEN: process.env.CALCOM_EVENT_TYPE_EXAMEN || '4139076',

    
    // Autres liens
    REVOLUT_PAYMENT_LINK: process.env.REVOLUT_PAYMENT_LINK || 'https://revolut.me/yoteachfr',
    WISE_PAYMENT_LINK: process.env.WISE_PAYMENT_LINK || 'https://wise.com/pay/me/yoannb127',
    PAYPAL_BUSINESS_EMAIL: process.env.PAYPAL_BUSINESS_EMAIL || 'yoann.bourbia@gmail.com'
};

// 3. Conversion en fichier JavaScript pour le navigateur
const content = `// ⚠️ FICHIER GÉNÉRÉ AUTOMATIQUEMENT - NE PAS MODIFIER MANUELLEMENT
// Généré le: ${config.GENERATED_AT}
window.YOTEACHER_CONFIG = ${JSON.stringify(config, null, 2)};`;

// 4. Écriture physique du fichier
try {
    const outputPath = path.join(process.cwd(), 'config.js');
    fs.writeFileSync(outputPath, content, 'utf8');
    
    console.log('✅ SUCCÈS : config.js a été écrit avec succès.');
    console.log('Emplacement :', outputPath);
    
    // Vérification finale de la taille
    const stats = fs.statSync(outputPath);
    console.log(`Taille du fichier : ${stats.size} octets`);
} catch (error) {
    console.error('❌ ERREUR LORS DE L\'ÉCRITURE DU FICHIER :', error);
    process.exit(1);
}