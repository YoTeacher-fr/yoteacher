const fs = require('fs');
const path = require('path');

console.log('🔧 Génération de config.js pour Cloudflare Pages...');

// Configuration depuis les variables d'environnement Cloudflare
const config = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  
  // Paiements
  REVOLUT_PAYMENT_LINK: process.env.REVOLUT_PAYMENT_LINK || 'https://revolut.me/yoteachfr',
  WISE_PAYMENT_LINK: process.env.WISE_PAYMENT_LINK || 'https://wise.com/pay/me/yoannb127',
  PAYPAL_BUSINESS_EMAIL: process.env.PAYPAL_BUSINESS_EMAIL || 'yoann.bourbia@gmail.com',
  
  // Stripe (pour cartes bancaires)
STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
STRIPE_BACKEND_URL: '/api/stripe-payment',
  
  // Cal.com
  CALCOM_API_KEY: process.env.CALCOM_API_KEY || '',
  CALCOM_USERNAME: process.env.CALCOM_USERNAME || 'yoann-bourbia-6ido9g',
  CALCOM_EVENT_TYPE_ESSAI: process.env.CALCOM_EVENT_TYPE_ESSAI || '4139074',
  CALCOM_EVENT_TYPE_CONVERSATION: process.env.CALCOM_EVENT_TYPE_CONVERSATION || '',
  CALCOM_EVENT_TYPE_CURRICULUM: process.env.CALCOM_EVENT_TYPE_CURRICULUM || '',
  
  // Email
  CONTACT_EMAIL: process.env.CONTACT_EMAIL || 'contact@yoteacher.com',
  SITE_URL: process.env.SITE_URL || 'yoteach.fr',
  
  // ENV
  ENV: process.env.NODE_ENV || 'production'
};

// ... le reste du fichier reste inchangé ...