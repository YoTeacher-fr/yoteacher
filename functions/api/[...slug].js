// Routeur pour toutes les routes API
export async function onRequest(context) {
  const { request, env, next, params } = context;
  const { slug } = params;
  
  // Récupérer le chemin
  const path = slug ? slug.join('/') : '';
  
  // Routes disponibles
  const routes = {
    'stripe-payment': async () => {
      // Rediriger vers la fonction de traitement Stripe
      return handleStripePayment(context);
    },
    'stripe-webhook': async () => {
      // Gérer les webhooks Stripe
      return handleStripeWebhook(context);
    },
    'health': async () => {
      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          environment: env.NODE_ENV || 'development'
        }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' 
          } 
        }
      );
    }
  };
  
  // Vérifier si la route existe
  if (routes[path]) {
    return await routes[path]();
  }
  
  // Route non trouvée
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: 'Route API non trouvée',
      availableRoutes: Object.keys(routes)
    }),
    { 
      status: 404, 
      headers: { 'Content-Type': 'application/json' } 
    }
  );
}

// Fonction pour gérer les paiements Stripe
async function handleStripePayment(context) {
  const { request, env } = context;
  
  // Vérifier la méthode HTTP
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Méthode non autorisée. Utilisez POST.' 
      }),
      { 
        status: 405, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
  
  try {
    // Récupérer les données de la requête
    const body = await request.json();
    const { paymentMethodId, amount, currency = 'eur', booking } = body;
    
    console.log('💰 Traitement paiement Stripe:', { 
      amount, 
      currency, 
      bookingId: booking?.id 
    });
    
    // Vérifier les variables d'environnement
    if (!env.STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuration Stripe manquante. Vérifiez STRIPE_SECRET_KEY.' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Vérifier les données requises
    if (!paymentMethodId || !amount) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Données de paiement manquantes' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Initialiser Stripe
    const stripe = require('stripe')(env.STRIPE_SECRET_KEY);
    
    // Créer un PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      description: `YoTeacher - ${booking?.courseType || 'Cours'} - ${booking?.name || 'Client'}`,
      metadata: {
        booking_id: booking?.id || '',
        user_email: booking?.email || '',
        course_type: booking?.courseType || '',
        user_id: booking?.userId || ''
      },
      // Pour les paiements en une seule fois
      capture_method: 'automatic',
      // Retourner l'URL de redirection
      return_url: `${env.SITE_URL || 'https://yoteach.fr'}/payment-success.html`,
    });
    
    console.log('📊 PaymentIntent créé:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      client_secret: paymentIntent.client_secret ? '***' : 'none'
    });
    
    // Vérifier si une action supplémentaire est requise (3D Secure)
    if (paymentIntent.status === 'requires_action' && 
        paymentIntent.next_action.type === 'use_stripe_sdk') {
      return new Response(
        JSON.stringify({
          success: true,
          requiresAction: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          } 
        }
      );
    } else if (paymentIntent.status === 'succeeded') {
      return new Response(
        JSON.stringify({
          success: true,
          requiresAction: false,
          paymentIntentId: paymentIntent.id,
          message: 'Paiement réussi'
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          } 
        }
      );
    } else {
      console.error('❌ Statut du paiement non supporté:', paymentIntent.status);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Statut du paiement non supporté: ${paymentIntent.status}`
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
  } catch (error) {
    console.error('❌ Erreur traitement paiement Stripe:', error);
    
    // Messages d'erreur conviviaux
    let errorMessage = error.message;
    if (error.type === 'StripeCardError') {
      errorMessage = `Erreur de carte: ${error.message}`;
    } else if (error.type === 'StripeInvalidRequestError') {
      errorMessage = 'Requête invalide. Veuillez réessayer.';
    } else if (error.type === 'StripeAPIError') {
      errorMessage = 'Erreur du service de paiement. Veuillez réessayer.';
    } else if (error.type === 'StripeConnectionError') {
      errorMessage = 'Problème de connexion. Vérifiez votre connexion internet.';
    } else if (error.type === 'StripeAuthenticationError') {
      errorMessage = 'Erreur d\'authentification. Contactez le support.';
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Fonction pour gérer les webhooks Stripe
async function handleStripeWebhook(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { status: 405 }
    );
  }
  
  try {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature');
    
    if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Signature ou secret manquant' }),
        { status: 400 }
      );
    }
    
    // Initialiser Stripe
    const stripe = require('stripe')(env.STRIPE_SECRET_KEY);
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('❌ Erreur vérification webhook:', err.message);
      return new Response(
        JSON.stringify({ error: `Webhook Error: ${err.message}` }),
        { status: 400 }
      );
    }
    
    // Gérer les différents types d'événements
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('✅ Paiement réussi:', paymentIntent.id);
        // Ici, vous pouvez mettre à jour votre base de données
        // et/ou envoyer un email de confirmation
        break;
        
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.error('❌ Paiement échoué:', failedPayment.id);
        break;
        
      default:
        console.log(`🔔 Événement non géré: ${event.type}`);
    }
    
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200 }
    );
    
  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur' }),
      { status: 500 }
    );
  }
}

// Gérer les requêtes OPTIONS pour CORS
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

// Fonction helper pour les routes
async function handleStripeCheckout(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { status: 405 }
    );
  }
  
  try {
    const body = await request.json();
    const { amount, currency = 'eur', booking } = body;
    
    if (!env.STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Configuration Stripe manquante' }),
        { status: 500 }
      );
    }
    
    const stripe = require('stripe')(env.STRIPE_SECRET_KEY);
    
    // Créer une session de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: `Cours YoTeacher - ${booking?.courseType || 'Cours de français'}`,
              description: booking?.notes || 'Cours particulier de français',
            },
            unit_amount: amount, // en centimes
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${env.SITE_URL || 'https://yoteach.fr'}/payment-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.SITE_URL || 'https://yoteach.fr'}/payment.html`,
      metadata: {
        booking_id: booking?.id || '',
        user_email: booking?.email || '',
      },
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionId: session.id,
        url: session.url 
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('❌ Erreur checkout Stripe:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}