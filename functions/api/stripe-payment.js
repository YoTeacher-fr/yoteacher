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
    // Vérifier la clé Stripe
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY manquante');
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const body = await request.json();

    // --- Création d'un PaymentIntent ---
    if (body.amount && body.currency) {
      const { amount, currency, metadata } = body;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount), // déjà en centimes ? selon votre frontend, oui.
        currency: currency.toLowerCase(),
        metadata: metadata || {},
      });

      return new Response(
        JSON.stringify({
          success: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Confirmation d'un PaymentIntent existant (ancien comportement) ---
    const { paymentMethodId, paymentIntentId } = body;
    if (!paymentMethodId || !paymentIntentId) {
      throw new Error('Paramètres manquants : amount/currency pour création, ou paymentMethodId/paymentIntentId pour confirmation');
    }

    // Récupérer le PaymentIntent existant
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Vérifier s'il est déjà payé
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

    // Confirmer le paiement
    const confirmedPayment = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
      return_url: `${new URL(request.url).origin}/payment-success.html`,
    });

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