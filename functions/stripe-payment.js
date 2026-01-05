// functions/stripe-payment.js - API Stripe pour Cloudflare Pages Functions
export async function onRequest(context) {
  const { request, env } = context;
  
  // Gérer les requêtes OPTIONS (CORS)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  
  // Seulement POST autorisé
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const body = await request.json();
    const { paymentMethodId, amount, currency = 'eur', booking } = body;
    
    console.log('💳 Traitement paiement Stripe:', { 
      amount, 
      bookingId: booking?.id 
    });
    
    // Vérifier la clé Stripe
    if (!env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY manquante');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuration Stripe manquante' 
        }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }
    
    // Appeler l'API Stripe directement
    const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: Math.round(amount).toString(),
        currency: currency,
        payment_method: paymentMethodId,
        confirm: 'true',
        description: `YoTeacher - ${booking?.courseType || 'Cours'}`,
        metadata: JSON.stringify({
          booking_id: booking?.id || '',
          user_email: booking?.email || '',
          course_type: booking?.courseType || ''
        })
      }).toString()
    });
    
    const result = await stripeResponse.json();
    
    if (!stripeResponse.ok) {
      console.error('❌ Erreur Stripe:', result);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error?.message || 'Erreur de paiement' 
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }
    
    // Si 3D Secure est requis
    if (result.status === 'requires_action') {
      return new Response(
        JSON.stringify({
          success: true,
          requiresAction: true,
          clientSecret: result.client_secret,
          paymentIntentId: result.id
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    } 
    // Si le paiement a réussi
    else if (result.status === 'succeeded') {
      return new Response(
        JSON.stringify({
          success: true,
          requiresAction: false,
          paymentIntentId: result.id,
          message: 'Paiement réussi'
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    } 
    // Autres statuts
    else {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Statut inattendu: ${result.status}`
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
  } catch (error) {
    console.error('❌ Erreur serveur:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erreur interne du serveur' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}