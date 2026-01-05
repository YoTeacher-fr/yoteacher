import Stripe from 'stripe';

export async function onRequest(context) {
  const { request, env } = context;
  
  // Configuration des headers CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // 1. Gérer les requêtes OPTIONS (Pré-vérification CORS)
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  try {
    // 2. Vérification de la clé secrète
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY est manquante dans les variables Cloudflare');
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const body = await request.json();
    const { paymentMethodId, amount, currency = 'eur', booking } = body;

    // 3. Création du PaymentIntent
    // Note : On multiplie par 100 et on arrondit pour éviter les erreurs de virgule flottante
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency,
      payment_method: paymentMethodId,
      confirm: true,
      description: `Réservation YoTeacher - ${booking?.email || 'Client'}`,
      // Obligatoire pour les cartes européennes (SCA)
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never' 
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        requiresAction: paymentIntent.status === 'requires_action',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erreur Stripe Server:', error.message);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}