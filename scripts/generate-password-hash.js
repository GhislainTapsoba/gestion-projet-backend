// Script pour générer le hash bcrypt du mot de passe de test
const bcrypt = require('bcryptjs');

const password = 'password123';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Erreur:', err);
    return;
  }

  console.log('\n==============================================');
  console.log('Mot de passe:', password);
  console.log('Hash bcrypt:', hash);
  console.log('==============================================\n');
  console.log('Copiez ce hash dans le fichier SQL:\n');
  console.log(`UPDATE users SET password = '${hash}' WHERE email = 'admin@example.com';`);
  console.log(`UPDATE users SET password = '${hash}' WHERE email = 'manager@example.com';`);
  console.log(`UPDATE users SET password = '${hash}' WHERE email = 'employee@example.com';`);
  console.log('\n==============================================\n');
});
