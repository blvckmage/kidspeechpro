const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const models = require('./db/models');
const bcrypt = require('bcrypt');
const pool = require('./db/db');
const multer = require('multer');
const upload = multer({ dest: 'images/courses/' });
const fs = require('fs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: 'kidSpeechSecret', resave: false, saveUninitialized: true }));
app.use(express.static(__dirname));
app.use(cookieParser());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware для локализации
function getLocale(req) {
  return req.cookies.lang || 'ru';
}

function loadLocale(lang) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'locales', lang + '.json'), 'utf8'));
  } catch (e) {
    return {};
  }
}

app.use((req, res, next) => {
  const lang = getLocale(req);
  res.locals.t = function (key) {
    const locale = loadLocale(lang);
    return key.split('.').reduce((o, i) => (o ? o[i] : undefined), locale) || key;
  };
  res.locals.lang = lang;
  next();
});

// GET маршруты
app.get('/', (req, res) => res.render('index'));
app.get('/register', (req, res) => res.render('register'));
app.get('/login', (req, res) => res.render('login'));
app.get('/chat', (req, res) => res.render('chat'));

// Защищённые маршруты
function authRequired(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

app.get('/children-list', async (req, res) => {
  try {
    const children = await models.getAllChildren();
      let html = `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <title>Список заявок — KidSpeech PRO</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background-color: #A78CE2; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          a.btn { display: inline-block; margin-top: 20px; background: #A78CE2; color: white; padding: 10px 15px; text-decoration: none; border-radius: 6px; }
        </style>
      </head>
      <body>
        <h1>Список заявок</h1>
        <table>
          <thead>
            <tr>
              <th>Имя ребёнка</th>
              <th>Возраст</th>
              <th>ID родителя</th>
            </tr>
          </thead>
          <tbody>
      `;
      for (const c of children) {
        html += `
          <tr>
            <td>${c.name || ''}</td>
            <td>${c.age || ''}</td>
          <td>${c.parent_id || ''}</td>
          </tr>
        `;
      }
      html += `
          </tbody>
        </table>
        <a href="/parent-dashboard" class="btn">Назад в кабинет</a>
      </body>
      </html>
      `;
      res.send(html);
  } catch (err) {
    res.status(500).send('Ошибка сервера');
  }
});

app.get('/parent-dashboard', authRequired, (req, res) => {
  if (req.session.user.role !== 'parent') return res.status(403).send('Доступ запрещён');
  res.render('parent/parent-dashboard');
});

app.get('/parent-settings', authRequired, (req, res) => {
  if (req.session.user.role !== 'parent') return res.status(403).send('Доступ запрещён');
  res.render('parent/parent-settings');
});

app.get('/parent-courses', authRequired, (req, res) => {
  if (req.session.user.role !== 'parent') return res.status(403).send('Доступ запрещён');
  res.render('parent/parent-courses');
});

app.get('/specialist-dashboard', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'specialist') {
    return res.status(403).send('Доступ запрещён');
  }
  res.render('specialist/specialist-dashboard');
});

app.get('/specialist-settings', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'specialist') {
    return res.status(403).send('Доступ запрещён');
  }
  res.render('specialist/specialist-settings');
});

app.get('/admin-courses', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Доступ запрещён');
  }
  res.render('admin/admin-courses');
});

app.get('/course', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'parent') {
    return res.status(403).send('Доступ только для родителей');
  }
  res.render('course/course');
});

// Новый роут: форма заявки на диагностику
app.get('/diagnosis-request', (req, res) => {
  res.render('diagnosis-request');
});

app.post('/diagnosis-request', async (req, res) => {
  const { name, surname, phone, age, problem } = req.body;
  try {
    await models.addDiagnosisRequest(name, surname, phone, age, problem);
    res.render('diagnosis-request', { success: true });
  } catch (err) {
    res.status(500).send('Ошибка при отправке заявки: ' + err.message);
  }
});

// API: Получить все заявки на диагностику (для админа)
app.get('/api/diagnosis-requests', async (req, res) => {
  try {
    const requests = await models.getAllDiagnosisRequests();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Регистрация (только родитель, с новыми полями)
app.post('/api/register', async (req, res) => {
  const { name, surname, phone_number, email, password } = req.body;
  const role = 'parent';
  try {
    const users = await models.getAllUsers();
    if (users.find(u => u.username === email)) {
      return res.status(400).send('Пользователь с таким email уже существует');
    }
    const hash = await bcrypt.hash(password, 10);
    await models.addUser(email, hash, role, name, surname, phone_number, null);
    return res.redirect('/login');
  } catch (err) {
    return res.status(500).send('Ошибка сервера');
  }
});

// Вход (через MySQL, с поддержкой хэшированных паролей, username или email)
app.post('/api/login', async (req, res) => {
  const { login, password } = req.body;
  try {
    const users = await models.getAllUsers();
    // Поиск по username или email
    const user = users.find(u => u.username === login || u.email === login);
    if (!user) return res.redirect('/login?error=1');
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.redirect('/login?error=1');
    req.session.user = { id: user.id, role: user.role, email: user.username };
    if (user.role === 'specialist') return res.redirect('/specialist-dashboard');
    if (user.role === 'parent') return res.redirect('/parent-dashboard');
    if (user.role === 'admin') return res.redirect('/admin-courses');
    return res.redirect('/');
  } catch (err) {
    return res.status(500).send('Ошибка сервера');
  }
});

// Получение курсов (пример API)
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await models.getAllCourses();
    res.json(courses);
  } catch (err) {
    res.status(500).send('Ошибка сервера');
  }
});

// Получение результатов (пример API)
app.get('/api/results', async (req, res) => {
  try {
    const results = await models.getAllResults();
    res.json(results);
  } catch (err) {
    res.status(500).send('Ошибка сервера');
  }
});

// Получение диагнозов (пример API)
app.get('/api/diagnosis', async (req, res) => {
  try {
    const diagnosis = await models.getAllDiagnosis();
    res.json(diagnosis);
  } catch (err) {
    res.status(500).send('Ошибка сервера');
  }
});

// Получение прогресса (пример API)
app.get('/api/progress', async (req, res) => {
  try {
    const progress = await models.getAllProgress();
    res.json(progress);
  } catch (err) {
    res.status(500).send('Ошибка сервера');
  }
});

// API: Загрузка изображения курса
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Нет файла' });
  // Можно добавить проверку типа файла и переименование
  res.json({ imageUrl: `/images/courses/${req.file.filename}` });
});

// API: Создать курс
app.post('/api/courses', upload.single('image'), async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Доступ запрещён');
  const { name, description, price, videos } = req.body;
  let image_url = null;
  if (req.file) image_url = `/images/courses/${req.file.filename}`;
  try {
    const [result] = await models.addCourse(name, description, image_url, price);
    const courseId = result.insertId;
    if (Array.isArray(videos)) {
      for (let i = 0; i < videos.length; i++) {
        await models.addCourseVideo(courseId, videos[i], i + 1);
      }
    }
    res.json({ success: true, courseId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Редактировать курс
app.put('/api/courses/:id', upload.single('image'), async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Доступ запрещён');
  const { name, description, price } = req.body;
  let image_url = null;
  if (req.file) image_url = `/images/courses/${req.file.filename}`;
  try {
    await models.updateCourse(req.params.id, name, description, image_url, price);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Удалить курс
app.delete('/api/courses/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Доступ запрещён');
  try {
    await models.deleteCourse(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Добавить видео к курсу
app.post('/api/courses/:id/videos', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Доступ запрещён');
  const { video_url, video_order } = req.body;
  try {
    await models.addCourseVideo(req.params.id, video_url, video_order);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Удалить видео из курса
app.delete('/api/courses/:courseId/videos/:videoId', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Доступ запрещён');
  try {
    await models.deleteCourseVideo(req.params.videoId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Получить детали курса и видео
app.get('/api/courses/:id', async (req, res) => {
  try {
    const [courseRows] = await models.getCourseById(req.params.id);
    if (!courseRows.length) return res.status(404).json({ error: 'Курс не найден' });
    const course = courseRows[0];
    const [videos] = await models.getCourseVideos(req.params.id);
    res.json({ course, videos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Проверка подключения к базе данных перед запуском сервера
pool.getConnection()
  .then(conn => {
    console.log('✅ Успешное подключение к базе данных MySQL!');
    conn.release();
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ Ошибка подключения к базе данных MySQL:', err.message);
    process.exit(1);
  });