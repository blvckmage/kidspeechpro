const pool = require('./db');

async function resetDatabase() {
  const dropTablesSQL = `
    DROP TABLE IF EXISTS user_courses, course_videos, courses, users;
  `;

  const createTablesSQL = `
    CREATE TABLE users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(191) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('parent', 'specialist', 'admin', 'child') NOT NULL,
      name VARCHAR(255),
      surname VARCHAR(255),
      phone_number VARCHAR(32),
      grade VARCHAR(32) DEFAULT NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

    CREATE TABLE courses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      image_url VARCHAR(255),
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

    CREATE TABLE course_videos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      video_url VARCHAR(255) NOT NULL,
      video_order INT NOT NULL DEFAULT 1,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

    CREATE TABLE user_courses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      course_id INT NOT NULL,
      purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `;

  try {
    const conn = await pool.getConnection();
    await conn.query(dropTablesSQL);
    console.log('✅ Все таблицы успешно удалены.');
    if (createTablesSQL.trim()) {
      await conn.query(createTablesSQL);
      console.log('✅ Новые таблицы успешно созданы.');
    } else {
      console.log('ℹ️  Новая структура таблиц не задана.');
    }
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('❌ Ошибка при сбросе базы данных:', err.message);
    process.exit(1);
  }
}

resetDatabase(); 