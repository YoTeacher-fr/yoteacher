export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // Récupérer les données de la requête
    const body = await request.json();
    const { sourceId, amount, currency = 'EUR', booking } = body;
    
    console.log('💰 Traitement paiement Square:', { amount, currency, bookingId: booking?.id });
    
    // Vérifier les variables d'environnement
    if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuration Square manquante' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Vérifier les données requises
    if (!sourceId || !amount) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Données de paiement manquantes' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Préparer les données pour l'API Square
    const paymentData = {
      source_id: sourceId,
      idempotency_key: booking?.id || `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount_money: {
        amount: Math.round(amount * 100), // Convertir en centimes
        currency: currency
      },
      location_id: env.SQUARE_LOCATION_ID,
      note: `YoTeacher - ${booking?.courseType || 'Cours'} - ${booking?.name || 'Client'}`,
      buyer_email_address: booking?.email || null
    };
    
    console.log('📤 Envoi à Square:', JSON.stringify(paymentData, null, 2));
    
    // Déterminer l'environnement Square
    const squareDomain = env.SQUARE_ENVIRONMENT === 'production' 
      ? 'connect.squareup.com' 
      : 'connect.squareupsandbox.com';
    
    // Appeler l'API Square
    const response = await fetch(`https://${squareDomain}/v2/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });
    
    const data = await response.json();
    
    console.log('📥 Réponse Square:', response.status, JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      const errorMessage = data.errors?.[0]?.detail || 'Erreur lors du traitement du paiement';
      console.error('❌ Erreur Square:', errorMessage);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          details: data.errors
        }),
        { 
          status: response.status, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Succès
    console.log('✅ Paiement Square réussi:', data.payment?.id);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        transactionId: data.payment?.id,
        payment: data.payment,
        message: 'Paiement effectué avec succès'
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        } 
      }
    );
    
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

// Gérer les requêtes OPTIONS pour CORS
export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}