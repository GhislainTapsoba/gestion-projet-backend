import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/verifyAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { handleCorsOptions, corsResponse } from '@/lib/cors';

// Gérer les requêtes OPTIONS (preflight CORS)
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

// POST /api/documents/upload - Upload un fichier vers Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return corsResponse({ error: 'Unauthorized' }, request, { status: 401 });
    }

    // Récupérer le fichier depuis FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return corsResponse(
        { error: 'Aucun fichier fourni' },
        request,
        { status: 400 }
      );
    }

    // Vérifier la taille du fichier (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return corsResponse(
        { error: 'Le fichier est trop volumineux (max 10MB)' },
        request,
        { status: 400 }
      );
    }

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}_${randomString}.${fileExtension}`;

    // Convertir le fichier en ArrayBuffer puis en Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload vers Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Supabase Storage error:', error);

      // Si le bucket n'existe pas, donner des instructions
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return corsResponse(
          {
            error: 'Le bucket "documents" n\'existe pas dans Supabase Storage. Veuillez le créer.',
            details: 'Allez dans Supabase Dashboard > Storage > Create a new bucket > Name: "documents" > Public bucket: Yes'
          },
          request,
          { status: 500 }
        );
      }

      return corsResponse(
        { error: 'Erreur lors de l\'upload du fichier', details: error.message },
        request,
        { status: 500 }
      );
    }

    // Obtenir l'URL publique
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('documents')
      .getPublicUrl(fileName);

    return corsResponse(
      {
        success: true,
        file_url: publicUrlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: data.path,
      },
      request,
      { status: 200 }
    );
  } catch (error) {
    console.error('POST /api/documents/upload error:', error);
    return corsResponse(
      { error: 'Erreur serveur', details: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500 }
    );
  }
}
