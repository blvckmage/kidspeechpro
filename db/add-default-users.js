const pool = require('./db');
const bcrypt = require('bcrypt');

async function addDefaultUsers() {
  const users = [
    {
      username: 'admin',
      password: await bcrypt.hash('admin', 10),
      role: 'admin',
      name: 'Admin',
      surname: 'User',
      phone_number: '+70000000001',
      grade: null
    },
    {
      username: 'spec',
      password: await bcrypt.hash('spec', 10),
      role: 'specialist',
      name: 'Spec',
      surname: 'User',
      phone_number: '+70000000002',
      grade: null
    },
      {
      username: 'zxc',
      password: await bcrypt.hash('zxc', 10),
      role: 'parent',
      name: 'Parent',
      surname: 'User',
      phone_number: '+70000000003',
      grade: null
    },
  ];

  for (const user of users) {
    await pool.query(
      'INSERT INTO users (username, password, role, name, surname, phone_number, grade) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user.username, user.password, user.role, user.name, user.surname, user.phone_number, user.grade]
    );
    console.log(`Пользователь ${user.username} добавлен.`);
  }
  process.exit(0);
}

addDefaultUsers(); 