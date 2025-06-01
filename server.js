const express = require('express');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const USERS_CSV = path.join(__dirname, 'data', 'users.csv');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: 'kidSpeechSecret', resave: false, saveUninitialized: true }));
app.use(express.static(__dirname));

// Создать CSV с заголовком, если отсутствует
if (!fs.existsSync(USERS_CSV)) {
  fs.writeFileSync(USERS_CSV, 'user_id,role,name,email,password,child_name,child_age\n');
}

const ASSIGNMENTS_CSV = path.join(__dirname, 'data', 'course_assignments.csv');
const RESULTS_CSV     = path.join(__dirname, 'data', 'course_results.csv');

if (!fs.existsSync(ASSIGNMENTS_CSV)) {
  fs.writeFileSync(ASSIGNMENTS_CSV, 'parent_email,child_name,course_name,date_assigned\n');
}
if (!fs.existsSync(RESULTS_CSV)) {
  fs.writeFileSync(RESULTS_CSV, 'parent_email,child_name,course_name,date,result\n');
}


// GET маршруты
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

// Защищённые маршруты
function authRequired(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}






app.get('/children-list', (req, res) => {
  const children = [];
  fs.createReadStream('children.csv')
    .pipe(csv())
    .on('data', (row) => {
      children.push(row);
    })
    .on('end', () => {
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
              <th>Имя родителя</th>
              <th>Номер телефона</th>
            </tr>
          </thead>
          <tbody>
      `;

      for (const c of children) {
        html += `
          <tr>
            <td>${c.name || ''}</td>
            <td>${c.age || ''}</td>
            <td>${c.parent_name || ''}</td>
            <td>${c.number || c.phone || ''}</td>
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
    });
});










app.get('/parent-dashboard', authRequired, (req, res) => {
  if (req.session.user.role !== 'parent') return res.status(403).send('Доступ запрещён');
  res.sendFile(path.join(__dirname, 'parent-dashboard.html'));
});



app.get('/specialist-dashboard', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'specialist') {
    return res.status(403).send('Доступ запрещён');
  }

  const specialistEmail = req.session.user.email;
  const children = [];

  // Чтение файла children.csv и выборка всех детей, привязанных к специалисту
  fs.createReadStream('children.csv')
    .pipe(csv())
    .on('data', (row) => {
      if (row.specialist_email === specialistEmail) {
        children.push({
          name: row.name,
          age: row.age,
          parent_email: row.parent_email
        });
      }
    })
    .on('end', () => {
      let html = fs.readFileSync('specialist-dashboard.html', 'utf8');

      // Формирование списка детей для вывода
      const childRows = children.map(c =>
        `<li>${c.name} (${c.age} лет) - Родитель: ${c.parent_email}</li>`
      ).join('');

      // Вставка сгенерированного списка в HTML-шаблон
      html = html.replace('<!-- Контент подставляется сервером -->', childRows);

      res.send(html); // Отправляем готовый HTML
    });
});



app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// Регистрация (без хеширования паролей)
app.post('/api/register', (req, res) => {
  const { role, name, email, password, child_name, child_age } = req.body;

  fs.readFile('users.csv', 'utf8', (err, data) => {
    if (err) return res.status(500).send('Ошибка сервера');

    if (data.includes(email)) {
      return res.status(400).send('Пользователь с таким email уже существует');
    }

    const userLine = `${role},${name},${email},${password}\n`;
    fs.appendFile('users.csv', userLine, (err) => {
      if (err) return res.status(500).send('Не удалось сохранить пользователя');

      if (role === 'parent' && child_name && child_age) {
        const childLine = `${email},${child_name},${child_age},\n`;
        fs.appendFile('children.csv', childLine, (err) => {
          if (err) return res.status(500).send('Ребёнок не был сохранён');
          return res.redirect('/login');
        });
      } else {
        return res.redirect('/login');
      }
    });
  });
});

// Вход (проверка без хеширования)
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = [];

  fs.createReadStream('users.csv')
    .pipe(csv())
    .on('data', (row) => users.push(row))
    .on('end', () => {
      const user = users.find(
        (u) => u.email.trim() === email.trim() && u.password === password
      );

      if (user) {
        req.session.user = user;

        if (user.role === 'specialist') {
          res.redirect('/specialist-dashboard');
        } else {
          res.redirect('/parent-dashboard');
        }
      } else {
        res.status(401).send('Неверный email или пароль');
      }
    });
});


app.post('/api/add-child', (req, res) => {
  const { name, age } = req.body;

  if (!req.session.user || req.session.user.role !== 'parent') {
    return res.status(403).send('Доступ запрещён');
  }

  const parentEmail = req.session.user.email;
  const newLine = `${parentEmail},${name},${age},\n`;

  const childrenPath = path.join(__dirname, 'children.csv');

  if (!fs.existsSync(childrenPath)) {
    fs.writeFileSync(childrenPath, 'parent_email,name,age,specialist_email\n');
  }

  fs.appendFile(childrenPath, newLine, (err) => {
    if (err) return res.status(500).send('Не удалось сохранить ребёнка');
    res.redirect('/parent-dashboard');
  });
});

app.get('/assign-specialist', (req, res) => {
  const currentParent = req.session.user.email;

  const children = [];
  const specialists = [];

  // Чтение детей
  fs.createReadStream('children.csv')
    .pipe(csv())
    .on('data', (row) => {
      if (row.parent_email === currentParent) {
        children.push(row); // row.name должен быть определен
      }
    })
    .on('end', () => {
      // Чтение специалистов
      fs.createReadStream('users.csv')
        .pipe(csv())
        .on('data', (user) => {
          if (user.role === 'specialist') {
            specialists.push(user);
          }
        })
        .on('end', () => {
          // Чтение HTML-шаблона
          fs.readFile('assign-specialist.html', 'utf8', (err, html) => {
            if (err) return res.status(500).send('Ошибка сервера');

            // Заменяем <!--PARENT_EMAIL--> на реальный email родителя
            html = html.replace('<!--PARENT_EMAIL-->', currentParent);

            // Заполнение списка детей
            const childOptions = children.map(c =>
              `<option value="${c.name}">${c.name} (${c.age} лет)</option>`
            ).join('');

            // Заполнение списка специалистов
            const specialistOptions = specialists.map(s =>
              `<option value="${s.email}">${s.name || s.email}</option>`
            ).join('');

            // Заменяем HTML-шаблон с данными
            html = html.replace('<!-- динамически вставим через server.js -->', childOptions);
            html = html.replace('<!-- динамически вставим через server.js -->', specialistOptions);

            // Отправляем обновлённую страницу
            res.send(html);
          });
        });
    });
});

app.post('/api/assign-specialist', (req, res) => {
  const { parent_email, child_name, specialist_email } = req.body;

  if (!parent_email || !child_name || !specialist_email) {
    return res.status(400).send('Ошибка: заполните все поля');
  }

  const updatedChildren = [];

  fs.createReadStream('children.csv')
    .pipe(csv())
    .on('data', (row) => {
      // Если имя и email родителя совпадают — обновляем специалиста
      if (row.name === child_name && row.parent_email === parent_email) {
        row.specialist_email = specialist_email;
      }
      updatedChildren.push(row);
    })
    .on('end', () => {
      const headers = 'parent_email,name,age,specialist_email\n';
      const rows = updatedChildren.map(r =>
        `${r.parent_email},${r.name},${r.age},${r.specialist_email}`
      ).join('\n');

      fs.writeFile('children.csv', headers + rows, (err) => {
        if (err) return res.status(500).send('Не удалось обновить файл');
        res.redirect('/parent-dashboard');
      });
    });
});



function renderChildPage(req, res, role, page, conditionFn) {
  const userEmail = req.session.user.email;
  const children = [];

  fs.createReadStream('children.csv')
    .pipe(csv())
    .on('data', (row) => {
      if (conditionFn(row, userEmail)) {
        children.push(row.name);
      }
    })
    .on('end', () => {
      fs.readFile(`public/${page}.html`, 'utf8', (err, html) => {
        if (err) return res.status(500).send('Ошибка сервера');
        const options = children.map(name => `<option value="${name}">${name}</option>`).join('');
        res.send(html.replace('<!--CHILD_OPTIONS-->', options));
      });
    });
}

const diagnosisResults = [
  { child_name: 'qwe', summary: 'Произношение звуков улучшается, продолжать упражнения' },
  { child_name: 'asd', summary: 'Есть затруднения с "р" и "ш", рекомендована тренировка' }
];

const progressData = [
  {
    child_name: 'qwe',
    dates: ['2024-01', '2024-02', '2024-03'],
    scores: [40, 60, 80]
  },
  {
    child_name: 'asd',
    dates: ['2024-01', '2024-02', '2024-03'],
    scores: [30, 50, 55]
  }
];

// Родитель: Диагностика
app.get('/parent-diagnosis', authRequired, (req, res) => {
  if (req.session.user.role !== 'parent') return res.status(403).send('Запрещено');
  const userEmail = req.session.user.email;
  const selected = req.query.child_name || null;
  const children = [];

  fs.createReadStream('children.csv')
    .pipe(csv())
    .on('data', row => {
      if (row.parent_email === userEmail) children.push(row.name);
    })
    .on('end', () => {
      fs.readFile('public/parent-diagnosis.html', 'utf8', (err, html) => {
        if (err) return res.status(500).send('Ошибка');

        const options = children.map(n => `<option value="${n}" ${selected === n ? 'selected' : ''}>${n}</option>`).join('');
        const diag = diagnosisResults.find(d => d.child_name === selected);
        const result = diag ? `<p><strong>Результат:</strong> ${diag.summary}</p>` : '';

        res.send(html.replace('<!--CHILD_OPTIONS-->', options).replace('<!--DIAGNOSIS_RESULT-->', result));
      });
    });
});

// Специалист: Диагностика
app.get('/specialist-diagnosis', authRequired, (req, res) => {
  if (req.session.user.role !== 'specialist') return res.status(403).send('Запрещено');
  const email = req.session.user.email;
  const selected = req.query.child_name || null;
  const children = [];

  fs.createReadStream('children.csv')
    .pipe(csv())
    .on('data', row => {
      if (row.specialist_email === email) children.push(row.name);
    })
    .on('end', () => {
      fs.readFile('public/specialist-diagnosis.html', 'utf8', (err, html) => {
        if (err) return res.status(500).send('Ошибка');

        const options = children.map(n => `<option value="${n}" ${selected === n ? 'selected' : ''}>${n}</option>`).join('');
        const diag = diagnosisResults.find(d => d.child_name === selected);
        const result = diag ? `<p><strong>Результат:</strong> ${diag.summary}</p>` : '';

        res.send(html.replace('<!--CHILD_OPTIONS-->', options).replace('<!--DIAGNOSIS_RESULT-->', result));
      });
    });
});

// Родитель: Игры
app.get('/parent-games', authRequired, (req, res) => {
  if (req.session.user.role !== 'parent') return res.status(403).send('Запрещено');
  const email = req.session.user.email;
  const selected = req.query.child_name || null;
  const children = [];

  fs.createReadStream('children.csv')
    .pipe(csv())
    .on('data', row => {
      if (row.parent_email === email) children.push(row.name);
    })
    .on('end', () => {
      fs.readFile('public/parent-games.html', 'utf8', (err, html) => {
        if (err) return res.status(500).send('Ошибка');

        const options = children.map(n => `<option value="${n}" ${selected === n ? 'selected' : ''}>${n}</option>`).join('');
        const result = selected ? `<p>Вы можете запустить игровое упражнение для <strong>${selected}</strong>.</p>` : '';

        res.send(html.replace('<!--CHILD_OPTIONS-->', options).replace('<!--GAMES_RESULT-->', result));
      });
    });
});

// Специалист: Игры
app.get('/specialist-games', authRequired, (req, res) => {
  if (req.session.user.role !== 'specialist') return res.status(403).send('Запрещено');
  const email = req.session.user.email;
  const selected = req.query.child_name || null;
  const children = [];

  fs.createReadStream('children.csv')
    .pipe(csv())
    .on('data', row => {
      if (row.specialist_email === email) children.push(row.name);
    })
    .on('end', () => {
      fs.readFile('public/specialist-games.html', 'utf8', (err, html) => {
        if (err) return res.status(500).send('Ошибка');

        const options = children.map(n => `<option value="${n}" ${selected === n ? 'selected' : ''}>${n}</option>`).join('');
        const result = selected ? `<p>Игровое упражнение доступно для <strong>${selected}</strong>.</p>` : '';

        res.send(html.replace('<!--CHILD_OPTIONS-->', options).replace('<!--GAMES_RESULT-->', result));
      });
    });
});


// Пример: родительский мониторинг
app.get('/parent-monitoring', authRequired, (req, res) => {
  if (req.session.user.role !== 'parent') return res.status(403).send('Запрещено');

  const userEmail = req.session.user.email;
  const selectedChild = req.query.child_name || null;
  const children = [];

  fs.createReadStream('children.csv')
    .pipe(csv())
    .on('data', (row) => {
      if (row.parent_email === userEmail) children.push(row.name);
    })
    .on('end', () => {
      fs.readFile('public/parent-monitoring.html', 'utf8', (err, html) => {
        if (err) return res.status(500).send('Ошибка');
        const options = children.map(name =>
          `<option value="${name}" ${selectedChild === name ? 'selected' : ''}>${name}</option>`
        ).join('');

        const resultBlock = selectedChild ? getProgressForChild(selectedChild) : '';
        res.send(
          html
            .replace('<!--CHILD_OPTIONS-->', options)
            .replace('<!--MONITORING_RESULT-->', resultBlock)
        );
      });
    });
});


app.get('/specialist-monitoring', authRequired, (req, res) => {
  if (req.session.user.role !== 'specialist') return res.status(403).send('Доступ запрещён');
  renderChildPage(req, res, 'specialist', 'specialist-monitoring', (row, email) => row.specialist_email === email);
});



function getDiagnosisForChild(childName) {
  return diagnosisData
    .filter(d => d.child_name === childName)
    .map(d => `<p><b>${d.date}:</b> ${d.result}</p>`)
    .join('');
}

function getProgressForChild(childName) {
  const child = progressData.find(p => p.child_name === childName);
  if (!child) return '<p>Нет данных</p>';

  let output = '<ul>';
  for (let i = 0; i < child.dates.length; i++) {
    output += `<li>${child.dates[i]} — Уровень: ${child.scores[i]}%</li>`;
  }
  output += '</ul>';
  return output;
}


// Рендер страниц с CHILD_OPTIONS
function renderWithChildren(req, res, page) {
  const parentEmail = req.session.user.email;
  const children = [];
  fs.createReadStream('children.csv')
    .pipe(csv())
    .on('data', r => { if (r.parent_email === parentEmail) children.push(r.name); })
    .on('end', () => {
      const opts = children.map(n => `<option>${n}</option>`).join('');
      const html = fs.readFileSync(`public/${page}.html`, 'utf8')
                     .replace(/<!-- CHILD_OPTIONS -->/g, opts);
      res.send(html);
    });
}

// Курсы
app.get('/parent-courses', authRequired, (req, res) => {
  if (req.session.user.role !== 'parent') return res.status(403).send('Запрещено');
  const parentEmail = req.session.user.email;
  const children = [], assignments = [];

  // читаем kids
  fs.createReadStream('children.csv').pipe(csv())
    .on('data', row => { if (row.parent_email === parentEmail) children.push(row.name); })
    .on('end', () => {
      // читаем уже назначенные курсы
      fs.createReadStream(ASSIGNMENTS_CSV).pipe(csv())
        .on('data', row => {
          if (row.parent_email === parentEmail) assignments.push(row);
        })
        .on('end', () => {
          let html = fs.readFileSync('public/parent-courses.html', 'utf8');
          const opts = children.map(n => `<option>${n}</option>`).join('');
          html = html.replace(/<!-- CHILD_OPTIONS -->/g, opts);

          // добавим таблицу назначений
          let table = `<h2>Ваши назначения</h2><table border="1" cellpadding="6">
                       <tr><th>Ребёнок</th><th>Курс</th><th>Дата</th></tr>`;
          assignments.forEach(a => {
            table += `<tr><td>${a.child_name}</td><td>${a.course_name}</td><td>${a.date_assigned}</td></tr>`;
          });
          table += '</table>';
          html = html.replace('<!-- ASSIGNMENTS_TABLE -->', table);

          res.send(html);
        });
    });
});


// Обработчик привязки курса (заглушка)
// Маршрут привязки курса (POST /api/assign-course)
app.post('/api/assign-course', authRequired, (req, res) => {
  const parent_email = req.session.user.email;
  const { child_name, course } = req.body;
  const date_assigned = new Date().toISOString().split('T')[0];

  const line = `${parent_email},${child_name},${course},${date_assigned}\n`;
  fs.appendFile(ASSIGNMENTS_CSV, line, err => {
    if (err) return res.status(500).send('Ошибка при сохранении привязки');
    res.redirect('/parent-courses');
  });
});


// Родитель: только просмотр
app.get('/parent-results', (req, res) => {
  const parentEmail = req.session.user.email;
  const selectedChild = req.query.child_name;
  const children = [];

  // Сначала получим всех детей родителя
  fs.createReadStream('children.csv')
    .pipe(csv())
    .on('data', row => {
      if (row.parent_email === parentEmail) children.push(row.name);
    })
    .on('end', () => {
      // Генерация <option>
      const options = children.map(name => {
        const selected = name === selectedChild ? 'selected' : '';
        return `<option value="${name}" ${selected}>${name}</option>`;
      }).join('');

      let resultsTable = '';

      // Если ребёнок выбран — загрузить его результаты
      if (selectedChild) {
        const results = [];

        fs.createReadStream('data/course_results.csv')
          .pipe(csv())
          .on('data', row => {
            if (row.parent_email === parentEmail && row.child_name === selectedChild) {
              results.push(row);
            }
          })
          .on('end', () => {
            if (results.length > 0) {
              resultsTable = `<h2>Результаты для: ${selectedChild}</h2><table>
                <tr><th>Курс</th><th>Дата</th><th>Оценка</th></tr>`;
              for (const r of results) {
                resultsTable += `<tr><td>${r.course_name}</td><td>${r.date}</td><td>${r.result}%</td></tr>`;
              }
              resultsTable += '</table>';
            } else {
              resultsTable = `<p>Нет результатов для ${selectedChild}</p>`;
            }

            // Отображаем HTML
            renderPage(options, resultsTable, res);
          });
      } else {
        // Без выбранного ребёнка — просто форма
        renderPage(options, '', res);
      }
    });

  function renderPage(optionsHtml, tableHtml, res) {
    let html = fs.readFileSync('public/parent-results.html', 'utf8');
    html = html.replace('<!-- CHILD_OPTIONS -->', optionsHtml);
    html = html.replace('<!-- RESULTS_TABLE -->', tableHtml);
    res.send(html);
  }
});

// Специалист: просмотр + редактирование
app.get('/specialist-results', authRequired, (req, res) => {
  if (req.session.user.role !== 'specialist') return res.status(403).send('Доступ запрещён');

  const spec = req.session.user.email;
  const selected = req.query.child_name || '';
  const children = [];

fs.createReadStream('children.csv').pipe(csv())
  .on('data', r => {
    if (r.specialist_email === spec) children.push(r.name);
  })
  .on('end', () => {
    const actualSelected = selected || children[0] || '';
    const htmlTemplate = fs.readFileSync('public/specialist-results.html', 'utf8');
    const opts = children.map(n => `<option ${n === actualSelected ? 'selected' : ''}>${n}</option>`).join('');
    let html = htmlTemplate
      .replace('<!-- CHILD_OPTIONS -->', opts)
      .replace('<!-- SELECTED_CHILD -->', actualSelected);

    const assignedCourses = [];
    fs.createReadStream(ASSIGNMENTS_CSV).pipe(csv())
      .on('data', r => {
        if (r.child_name === actualSelected) assignedCourses.push(r.course_name);
      })
      .on('end', () => {
        const courseOpts = assignedCourses.length > 0
          ? assignedCourses.map(c => `<option>${c}</option>`).join('')
          : '<option disabled>Нет назначенных курсов</option>';

        html = html.replace('<!-- COURSE_OPTIONS -->', courseOpts);

        let table = `<h2>Результаты для ${actualSelected}</h2><table>
                       <tr><th>Курс</th><th>Дата</th><th>Оценка</th></tr>`;
        fs.createReadStream(RESULTS_CSV).pipe(csv())
          .on('data', r => {
            if (r.child_name === actualSelected) {
              table += `<tr><td>${r.course_name}</td><td>${r.date}</td><td>${r.result}%</td></tr>`;
            }
          })
          .on('end', () => {
            table += '</table>';
            res.send(html.replace('<!-- RESULTS_TABLE -->', table));
          });
      });
  });

});



app.post('/api/add-result', authRequired, (req, res) => {
  if (req.session.user.role !== 'specialist') return res.status(403).send('Доступ запрещён');

  const spec = req.session.user.email;
  const { parent_email, child_name, course_name, result } = req.body;

  let isValidChild = false;
  let isCourseAssigned = false;

  // Проверка 1: ребёнок принадлежит специалисту
  fs.createReadStream('children.csv').pipe(csv())
    .on('data', r => {
      if (r.name === child_name && r.specialist_email === spec) {
        isValidChild = true;
      }
    })
    .on('end', () => {
      if (!isValidChild) return res.status(403).send('Ребёнок не прикреплён к вам');

      // Проверка 2: курс назначен этому ребёнку
      fs.createReadStream(ASSIGNMENTS_CSV).pipe(csv())
        .on('data', r => {
          if (r.child_name === child_name && r.course_name === course_name) {
            isCourseAssigned = true;
          }
        })
        .on('end', () => {
          if (!isCourseAssigned) return res.status(400).send('Курс не назначен ребёнку');

          // Добавление результата
          const date = new Date().toISOString().split('T')[0];
          const line = `${parent_email},${child_name},${course_name},${date},${result}\n`;

          fs.appendFile(RESULTS_CSV, line, err => {
            if (err) return res.status(500).send('Ошибка при сохранении');
            res.redirect(`/specialist-results?child_name=${encodeURIComponent(child_name)}`);
          });
        });
    });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));