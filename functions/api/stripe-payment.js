// functions/api/stripe-payment.js
import Stripe from 'stripe';

export async function onRequest(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Gérer OPTIONS
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
    // Vérifier la clé
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY manquante');
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const body = await request.json();

    // SÉCURITÉ : Ne jamais faire confiance au montant du client
    // Le montant doit venir du PaymentIntent créé par l'Edge Function
    const { paymentMethodId, paymentIntentId } = body;

    if (!paymentMethodId || !paymentIntentId) {
      throw new Error('paymentMethodId et paymentIntentId requis');
    }

    // Récupérer le PaymentIntent existant
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Vérifier que le PaymentIntent n'est pas déjà payé
    if (paymentIntent.status === 'succeeded') {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyPaid: true,
          paymentIntentId: paymentIntent.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Confirmer le paiement avec la méthode de paiement
    const confirmedPayment = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
      return_url: `${new URL(request.url).origin}/payment-success.html`,
    });

    console.log('✅ Paiement confirmé:', confirmedPayment.id, confirmedPayment.status);

    return new Response(
      JSON.stringify({
        success: true,
        requiresAction: confirmedPayment.status === 'requires_action',
        clientSecret: confirmedPayment.client_secret,
        paymentIntentId: confirmedPayment.id,
        status: confirmedPayment.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erreur Stripe:', error.message);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}