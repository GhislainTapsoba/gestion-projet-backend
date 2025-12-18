/**
 * Script de debug pour vérifier pourquoi l'admin ne voit pas les projets
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Charger manuellement les variables d'environnement depuis .env ou .env.local
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envPath = fs.existsSync(envLocalPath) ? envLocalPath : path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        // Ignorer les lignes vides et les commentaires
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"]|['"]$/g, '');
            if (key && !process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables d\'environnement manquantes');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓' : '✗');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAdminProjects() {
    console.log('🔍 Début du debug...\n');

    // 1. Vérifier les utilisateurs et leurs rôles
    console.log('📋 1. Vérification des utilisateurs:');
    console.log('─'.repeat(60));
    const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, name, role')
        .order('created_at', { ascending: false });

    if (usersError) {
        console.error('❌ Erreur lors de la récupération des utilisateurs:', usersError);
        return;
    }

    if (!users || users.length === 0) {
        console.log('⚠️  Aucun utilisateur trouvé dans la base de données');
    } else {
        console.log(`✓ ${users.length} utilisateur(s) trouvé(s):\n`);
        users.forEach(user => {
            console.log(`   ID: ${user.id}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Nom: ${user.name || 'N/A'}`);
            console.log(`   Rôle: ${user.role} ${user.role === 'ADMIN' ? '👑' : ''}`);
            console.log('');
        });
    }

    // 2. Vérifier les projets
    console.log('📋 2. Vérification des projets:');
    console.log('─'.repeat(60));
    const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, status, created_by_id, manager_id')
        .order('created_at', { ascending: false });

    if (projectsError) {
        console.error('❌ Erreur lors de la récupération des projets:', projectsError);
        return;
    }

    if (!projects || projects.length === 0) {
        console.log('⚠️  Aucun projet trouvé dans la base de données');
    } else {
        console.log(`✓ ${projects.length} projet(s) trouvé(s):\n`);
        projects.forEach(project => {
            console.log(`   ID: ${project.id}`);
            console.log(`   Titre: ${project.title}`);
            console.log(`   Status: ${project.status}`);
            console.log(`   Créé par: ${project.created_by_id || 'N/A'}`);
            console.log(`   Manager: ${project.manager_id || 'N/A'}`);
            console.log('');
        });
    }

    // 3. Vérifier project_members
    console.log('📋 3. Vérification des membres de projets:');
    console.log('─'.repeat(60));
    const { data: members, error: membersError } = await supabase
        .from('project_members')
        .select('project_id, user_id, role');

    if (membersError) {
        console.error('❌ Erreur lors de la récupération des membres:', membersError);
    } else if (!members || members.length === 0) {
        console.log('⚠️  Aucun membre de projet trouvé');
    } else {
        console.log(`✓ ${members.length} membre(s) de projet trouvé(s):\n`);
        members.forEach(member => {
            console.log(`   Projet: ${member.project_id}`);
            console.log(`   Utilisateur: ${member.user_id}`);
            console.log(`   Rôle: ${member.role}`);
            console.log('');
        });
    }

    // 4. Vérifier RLS (Row Level Security)
    console.log('📋 4. Vérification des policies RLS:');
    console.log('─'.repeat(60));
    console.log('⚠️  Vérification RLS ignorée (nécessite des permissions spéciales)');
    console.log('   → Si vous avez des erreurs d\'accès, vérifiez les policies RLS dans Supabase Dashboard');

    // 5. Tester une requête comme le ferait l'API
    console.log('📋 5. Test d\'une requête de récupération de projets (comme l\'API):');
    console.log('─'.repeat(60));
    const adminUser = users?.find(u => u.role === 'ADMIN');
    if (!adminUser) {
        console.log('⚠️  Aucun utilisateur ADMIN trouvé');
        console.log('   → Créez un utilisateur avec le rôle "ADMIN" pour résoudre le problème');
    } else {
        console.log(`✓ Utilisateur ADMIN trouvé: ${adminUser.email}`);
        console.log(`   Test de récupération de tous les projets...\n`);

        const { data: testProjects, error: testError } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (testError) {
            console.error('❌ Erreur lors du test:', testError);
        } else {
            console.log(`✓ Test réussi: ${testProjects?.length || 0} projet(s) récupéré(s)`);
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🔍 Debug terminé');
    console.log('═'.repeat(60));
}

debugAdminProjects().catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
});
