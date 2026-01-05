export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { paymentMethodId, amount, currency = 'eur', booking } = body;
    
    console.log('💰 Traitement paiement Stripe:', { amount, currency, bookingId: booking?.id });
    
    // Vérifier les variables d'environnement
    if (!env.STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuration Stripe manquante' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Initialiser Stripe
    const stripe = require('stripe')(env.STRIPE_SECRET_KEY);
    
    try {
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
          course_type: booking?.courseType || ''
        }
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
            headers: { 'Content-Type': 'application/json' } 
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
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      } else {
        throw new Error(`Statut du paiement non supporté: ${paymentIntent.status}`);
      }
      
    } catch (error) {
      console.error('❌ Erreur Stripe:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
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
        error: 'Erreur interne du serveur',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
