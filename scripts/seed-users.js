const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  console.error('URL:', supabaseUrl);
  console.error('Key:', supabaseKey ? 'present' : 'missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const users = [
  {
    name: 'Admin Principal',
    email: 'admin@tdr.com',
    password: '$2a$10$abcdefghijklmnopqrstuvwxyz123456', // Hash fictif
    role: 'admin'
  },
  {
    name: 'Jean Dupont',
    email: 'jean.dupont@tdr.com',
    password: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    role: 'manager'
  },
  {
    name: 'Marie Martin',
    email: 'marie.martin@tdr.com',
    password: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    role: 'manager'
  },
  {
    name: 'Pierre Bernard',
    email: 'pierre.bernard@tdr.com',
    password: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    role: 'user'
  },
  {
    name: 'Sophie Dubois',
    email: 'sophie.dubois@tdr.com',
    password: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    role: 'user'
  },
  {
    name: 'Thomas Petit',
    email: 'thomas.petit@tdr.com',
    password: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    role: 'user'
  },
  {
    name: 'Laura Moreau',
    email: 'laura.moreau@tdr.com',
    password: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    role: 'user'
  }
];

async function seedUsers() {
  console.log('Seeding users...');

  try {
    // Vérifier si des utilisateurs existent déjà
    const { data: existingUsers } = await supabase
      .from('users')
      .select('email');

    const existingEmails = new Set(existingUsers?.map(u => u.email) || []);

    // Filtrer les utilisateurs qui n'existent pas encore
    const newUsers = users.filter(u => !existingEmails.has(u.email));

    if (newUsers.length === 0) {
      console.log('All users already exist!');
      return;
    }

    // Insérer les nouveaux utilisateurs
    const { data, error } = await supabase
      .from('users')
      .insert(newUsers)
      .select();

    if (error) {
      console.error('Error inserting users:', error);
      return;
    }

    console.log(`Successfully created ${data.length} users:`);
    data.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - ${user.role}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

seedUsers();
