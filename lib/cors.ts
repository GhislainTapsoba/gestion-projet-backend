import { NextRequest, NextResponse } from 'next/server';

// Configuration CORS
const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  process.env.NEXT_PUBLIC_FRONTEND_URL,
].filter(Boolean) as string[];

export function setCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');

  // Vérifier si l'origine est autorisée
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Pour les requêtes sans origine (comme curl), autoriser tout
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  return response;
}

// Helper pour gérer les requêtes OPTIONS (preflight)
export function handleCorsOptions(request: NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response, request);
}

// Helper pour créer une réponse avec CORS
export function corsResponse(
  data: any,
  request: NextRequest,
  options: { status?: number } = {}
): NextResponse {
  const response = NextResponse.json(data, options);
  return setCorsHeaders(response, request);
}
