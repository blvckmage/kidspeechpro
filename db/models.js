const pool = require('./db');

// USERS
async function getAllUsers() {
  const [rows] = await pool.query('SELECT * FROM users');
  return rows;
}
async function addUser(username, password, role, name, surname, phone_number, grade) {
  await pool.query(
    'INSERT INTO users (username, password, role, name, surname, phone_number, grade) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, password, role, name, surname, phone_number, grade]
  );
}

// Вспомогательная функция для добавления пользователя с любыми полями
async function addUserFull({username, password, role, name, surname, phone_number, grade}) {
  await pool.query(
    'INSERT INTO users (username, password, role, name, surname, phone_number, grade) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, password, role, name, surname, phone_number, grade]
  );
}

// CHILDREN
async function getAllChildren() {
  const [rows] = await pool.query('SELECT * FROM children');
  return rows;
}
async function addChild(name, age, parent_id) {
  await pool.query('INSERT INTO children (name, age, parent_id) VALUES (?, ?, ?)', [name, age, parent_id]);
}

// COURSES
async function getAllCourses() {
  const [rows] = await pool.query('SELECT * FROM courses');
  return rows;
}
async function addCourse(name, description, image_url, price) {
  return await pool.query(
    'INSERT INTO courses (name, description, image_url, price) VALUES (?, ?, ?, ?)',
    [name, description, image_url, price]
  );
}
async function updateCourse(id, name, description, image_url, price) {
  let sql = 'UPDATE courses SET name=?, description=?, price=?';
  const params = [name, description, price];
  if (image_url) {
    sql += ', image_url=?';
    params.push(image_url);
  }
  sql += ' WHERE id=?';
  params.push(id);
  return await pool.query(sql, params);
}
async function deleteCourse(id) {
  return await pool.query('DELETE FROM courses WHERE id=?', [id]);
}

// COURSE VIDEOS
async function addCourseVideo(course_id, video_url, video_order) {
  return await pool.query(
    'INSERT INTO course_videos (course_id, video_url, video_order) VALUES (?, ?, ?)',
    [course_id, video_url, video_order]
  );
}
async function deleteCourseVideo(video_id) {
  return await pool.query('DELETE FROM course_videos WHERE id=?', [video_id]);
}

// COURSE ASSIGNMENTS
async function getAllAssignments() {
  const [rows] = await pool.query('SELECT * FROM course_assignments');
  return rows;
}
async function assignCourse(child_id, course_id, assigned_by) {
  await pool.query('INSERT INTO course_assignments (child_id, course_id, assigned_by) VALUES (?, ?, ?)', [child_id, course_id, assigned_by]);
}

// COURSE RESULTS
async function getAllResults() {
  const [rows] = await pool.query('SELECT * FROM course_results');
  return rows;
}
async function addResult(child_id, course_id, result, date) {
  await pool.query('INSERT INTO course_results (child_id, course_id, result, date) VALUES (?, ?, ?, ?)', [child_id, course_id, result, date]);
}

// DIAGNOSIS
async function getAllDiagnosis() {
  const [rows] = await pool.query('SELECT * FROM diagnosis');
  return rows;
}
async function addDiagnosis(child_id, diagnosis, date) {
  await pool.query('INSERT INTO diagnosis (child_id, diagnosis, date) VALUES (?, ?, ?)', [child_id, diagnosis, date]);
}

// PROGRESS
async function getAllProgress() {
  const [rows] = await pool.query('SELECT * FROM progress');
  return rows;
}
async function addProgress(child_id, course_id, progress, last_update) {
  await pool.query('INSERT INTO progress (child_id, course_id, progress, last_update) VALUES (?, ?, ?, ?)', [child_id, course_id, progress, last_update]);
}

async function getCourseById(id) {
  return await pool.query('SELECT * FROM courses WHERE id=?', [id]);
}
async function getCourseVideos(course_id) {
  return await pool.query('SELECT * FROM course_videos WHERE course_id=? ORDER BY video_order', [course_id]);
}

module.exports = {
  getAllUsers, addUser,
  getAllChildren, addChild,
  getAllCourses, addCourse,
  getAllAssignments, assignCourse,
  getAllResults, addResult,
  getAllDiagnosis, addDiagnosis,
  getAllProgress, addProgress,
  getCourseById, getCourseVideos
}; 