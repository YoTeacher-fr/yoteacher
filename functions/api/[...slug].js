// Routeur pour toutes les routes API
export async function onRequest(context) {
  const { request, env, next, params } = context;
  const { slug } = params;
  
  // Récupérer le chemin
  const path = slug ? slug.join('/') : '';
  
  // Routes disponibles
  const routes = {
    'square-payment': async () => {
      // Rediriger vers la fonction spécifique
      const handler = await import('./square-payment.js');
      return handler[`onRequest${request.method}`](context);
    },
    'health': async () => {
      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          environment: env.SQUARE_ENVIRONMENT || 'development'
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

// Gérer les requêtes OPTIONS
export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}