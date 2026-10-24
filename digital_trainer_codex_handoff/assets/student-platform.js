// Personal trainee portal for the demo. All records and progress remain in memory.
(() => {
  const roleSelector = document.getElementById('role-switcher');
  const appRoot = document.getElementById('app');
  const originalRender = render;
  const studentRole = 'المتدرب';
  const navSets = {
    'مدير إدارة المنطقة': [['الإدارة والمتابعة', [['dashboard', '▦', 'لوحة المؤشرات'], ['facilities', '⌂', 'الكليات والمنشآت'], ['departments', '⌘', 'الأقسام'], ['users', '♙', 'المستخدمون'], ['roles', '◫', 'الأدوار والصلاحيات']]], ['التدريب والمحتوى', [['courses', '▤', 'المقررات والشعب'], ['content', '▣', 'المحتوى والاعتماد'], ['attendance', '◷', 'الحضور والتقدم']]], ['الحوكمة', [['reports', '▥', 'التقارير والمؤشرات'], ['quality', '✓', 'الجودة وسجل التدقيق'], ['settings', '⚙', 'الإعدادات']]]],
    'نائب المحافظ للتدريب': [['المؤشرات والقيادة', [['dashboard', '▦', 'لوحة المؤشرات'], ['facilities', '⌂', 'الكليات والمنشآت'], ['reports', '▥', 'التقارير والمؤشرات']]], ['التنفيذ التدريبي', [['courses', '▤', 'المقررات والشعب'], ['attendance', '◷', 'الحضور والتقدم'], ['quality', '✓', 'مؤشرات الجودة']]]],
    'مشرف الكليات التقنية': [['نطاق الإشراف', [['dashboard', '▦', 'لوحة المؤشرات'], ['facilities', '⌂', 'الكليات والمنشآت'], ['departments', '⌘', 'الأقسام']]], ['التدريب والجودة', [['courses', '▤', 'المقررات والشعب'], ['content', '▣', 'المحتوى والاعتماد'], ['attendance', '◷', 'الحضور والتقدم'], ['reports', '▥', 'التقارير والمؤشرات'], ['quality', '✓', 'الجودة']]]],
    'عميد المنشأة/الكلية': [['إدارة المنشأة', [['dashboard', '▦', 'لوحة المؤشرات'], ['facilities', '⌂', 'منشأتي'], ['departments', '⌘', 'الأقسام'], ['users', '♙', 'المستخدمون']]], ['التدريب والمتابعة', [['courses', '▤', 'المقررات والشعب'], ['content', '▣', 'المحتوى والاعتماد'], ['attendance', '◷', 'الحضور والتقدم'], ['reports', '▥', 'التقارير'], ['quality', '✓', 'الجودة'], ['settings', '⚙', 'الإعدادات']]]],
    'إدارة الجودة التدريبية': [['الجودة والاعتماد', [['dashboard', '▦', 'لوحة المؤشرات'], ['content', '▣', 'مراجعة المحتوى'], ['quality', '✓', 'سجل الجودة والتدقيق'], ['reports', '▥', 'تقارير الجودة']]]],
    'رئيس القسم/مشرف القسم': [['إدارة القسم', [['dashboard', '▦', 'لوحة المؤشرات'], ['departments', '⌘', 'الأقسام'], ['courses', '▤', 'مقررات وشعب القسم']]], ['متابعة التدريب', [['content', '▣', 'المحتوى'], ['attendance', '◷', 'الحضور والتقدم'], ['reports', '▥', 'تقارير القسم']]]],
    'المدرب': [['مساحة المدرب', [['dashboard', '▦', 'لوحة المؤشرات'], ['courses', '▤', 'شعبي ومقرراتي'], ['content', '▣', 'إعداد المحتوى'], ['attendance', '◷', 'الحضور'], ['quality', '✓', 'ملاحظات الجودة']]]]
  };
  const personas = {
    'مدير إدارة المنطقة': ['أحمد العتيبي', 'أ'], 'نائب المحافظ للتدريب': ['عبدالله السبيعي', 'ع'],
    'مشرف الكليات التقنية': ['خالد الدوسري', 'خ'], 'عميد المنشأة/الكلية': ['نورة الغامدي', 'ن'],
    'إدارة الجودة التدريبية': ['هدى الحربي', 'هـ'], 'رئيس القسم/مشرف القسم': ['سالم المطيري', 'س'],
    'المدرب': ['فهد القحطاني', 'ف'], 'المتدرب': ['سارة الغامدي', 'س']
  };
  const courses = [
    { id: 'NET-101', title: 'الشبكات 101', category: 'تقنية الحاسب', trainer: 'فهد القحطاني', progress: 82, lesson: 'كيف تنتقل البيانات عبر الشبكة؟', next: 'الأحد · 10:00 ص' },
    { id: 'PRO-110', title: 'أساسيات البرمجة', category: 'تقنية الحاسب', trainer: 'نورة السبيعي', progress: 74, lesson: 'الشروط واتخاذ القرار', next: 'الاثنين · 11:00 ص' },
    { id: 'SEC-105', title: 'مبادئ الأمن السيبراني', category: 'تقنية الحاسب', trainer: 'حسن الغامدي', progress: 91, lesson: 'إدارة كلمات المرور', next: 'الثلاثاء · 12:00 م' },
    { id: 'MGT-120', title: 'إدارة المشاريع', category: 'مهارات إدارية', trainer: 'مها القحطاني', progress: 58, lesson: 'تخطيط نطاق المشروع', next: 'الأربعاء · 09:00 ص' }
  ];
  const assignments = [
    { id: 'A-341', title: 'تطبيق عملي: نموذج OSI', course: 'الشبكات 101', due: 'الأحد 18 صفر · 11:59 م', status: 'مفتوح' },
    { id: 'A-122', title: 'تمرين الشروط البرمجية', course: 'أساسيات البرمجة', due: 'الاثنين 19 صفر · 10:00 م', status: 'مفتوح' },
    { id: 'A-221', title: 'مراجعة ممارسات كلمات المرور', course: 'مبادئ الأمن السيبراني', due: 'مكتمل · رُصدت الدرجة', status: 'مكتمل' }
  ];
  const schedule = [
    ['الأحد', '10:00 ص', 'الشبكات 101', 'قاعة افتراضية · شعبة 341'],
    ['الاثنين', '11:00 ص', 'أساسيات البرمجة', 'مختبر الحاسب · شعبة 122'],
    ['الثلاثاء', '12:00 م', 'مبادئ الأمن السيبراني', 'قاعة افتراضية · شعبة 221'],
    ['الأربعاء', '09:00 ص', 'إدارة المشاريع', 'مبنى التدريب · قاعة 2']
  ];
  const attendanceLog = [
    ['الأحد · 11 صفر', 'الشبكات 101', 'حاضر', '100%'], ['الاثنين · 12 صفر', 'أساسيات البرمجة', 'حاضر', '100%'],
    ['الثلاثاء · 13 صفر', 'الأمن السيبراني', 'متأخر', '88%'], ['الأربعاء · 14 صفر', 'إدارة المشاريع', 'حاضر', '100%']
  ];
  const lessonSteps = [
    { title: '1. الفكرة الأساسية', sub: 'نتعرف على أدوار انتقال البيانات', text: 'أهلًا بك. لنتعرف إلى كيفية انتقال البيانات ببساطة. لدينا مُرسِل، ووسيط تنتقل البيانات من خلاله، ومستقبِل يتلقاها.' },
    { title: '2. من المرسل إلى الوسيط', sub: 'المرسل يجهز البيانات ويرسلها عبر المسار', text: 'يبدأ الجهاز المُرسِل العملية، ثم تنتقل البيانات عبر وسيط النقل. وقد يكون هذا الوسيط كابلًا شبكيًا أو اتصالًا لاسلكيًا.' },
    { title: '3. وصول البيانات', sub: 'المستقبل يستقبل البيانات المرسلة', text: 'بعد عبور وسيط النقل، تصل البيانات إلى الجهاز المُستقبِل. وتتضمن الشبكات تفاصيل أخرى، مثل العناوين والتحقق من سلامة البيانات.' },
    { title: '4. راجع فهمك', sub: 'اختبر نفسك قبل الانتقال إلى الدرس التالي', text: 'من يبدأ إرسال البيانات؟ المُرسِل. وما دور وسيط النقل؟ نقل البيانات بين الأجهزة. أحسنت، هذه هي الفكرة الأساسية.' }
  ];
  let searchTerm = '';
  let classroomStep = 0;
  let drawing = false;
  let eraseMode = false;
  let classroomQuizAnswer = '';
  let classroomQuestion = '';
  let quizStarted = false;
  let selectedCourse = courses[0];
  let lastToast;
  let speechRequest = 0;
  const studentProgress = { completedLessons: 6, saved: false };
  const submittedAssignments = new Set();
  const categoryLabel = role => role === 'المتدرب' ? 'منصة المتدرب' : role === 'المدرب' ? 'مساحة المدرب' : 'منطقة الرياض';

  function setNavigation(role) {
    const nav = document.getElementById('main-nav');
    const studentLinks = [['student-home', '▦', 'الرئيسية'], ['student-courses', '▤', 'مقرراتي'], ['student-schedule', '◷', 'الجدول التدريبي'], ['student-classroom', '▣', 'قاعة المحاضرة'], ['student-assignments', '✓', 'الواجبات والاختبارات'], ['student-results', '◈', 'نتائجي'], ['student-attendance', '◷', 'الحضور والتقدم'], ['student-profile', '♙', 'ملفي الشخصي']];
    const groups = role === studentRole ? [['منصتي التعليمية', studentLinks]] : (navSets[role] || navSets['مدير إدارة المنطقة']);
    nav.innerHTML = groups.map(([label, links]) => `<p class="nav-label">${label}</p>${links.map(([page, icon, title]) => `<button class="nav-item" data-page="${page}">${icon} <span>${title}</span></button>`).join('')}`).join('');
    const brand = document.querySelector('.brand');
    brand.querySelector('.brand-mark').textContent = role === studentRole ? 'ت' : 'م';
    brand.querySelector('strong').textContent = role === studentRole ? 'المدرب الرقمي' : 'المدرب الرقمي';
    brand.querySelector('small').textContent = categoryLabel(role);
    document.querySelector('.sidebar-foot').innerHTML = `<span class="pulse"></span> ${role === studentRole ? 'مساحة تعلم شخصية · تجريبية' : 'بيئة العرض التجريبي'}`;
    const [name, initial] = personas[role] || personas['مدير إدارة المنطقة'];
    document.querySelector('#profile-btn .avatar').textContent = initial;
    document.querySelector('#profile-btn strong').textContent = name;
    document.getElementById('active-role-label').textContent = role;
    const search = document.getElementById('global-search');
    search.placeholder = role === studentRole ? 'ابحث في مقرراتك ودروسك…' : 'بحث سريع في بيانات العرض…';
    search.oninput = () => {
      if (role !== studentRole) {
        const value = search.value.trim();
        if (value.length > 2) toast(`البحث عن «${value}» متاح داخل القسم المناسب.`);
        return;
      }
      searchTerm = search.value.trim().toLowerCase();
      if (state.page === 'student-courses' || state.page === 'student-home') render();
    };
  }

  function pageTitle(title, description, action = '') {
    return `<div class="student-page-head"><div><div class="breadcrumb">منصة المتدرب / ${title}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
  }
  function courseTile(course, compact = false) {
    return `<article class="card student-course-card"><div class="course-card-top"><span class="course-code">${course.id}</span><span class="student-tag">${course.category}</span></div><h3>${course.title}</h3><p>المدرب: ${course.trainer}</p><div class="student-progress-meta"><span>إكمال المقرر</span><strong>${course.progress}%</strong></div><div class="progress"><i style="width:${course.progress}%"></i></div><p class="next-lesson"><span>الدرس التالي</span><b>${course.lesson}</b></p><button class="btn ${compact ? '' : 'primary'}" data-student-course="${course.id}">${compact ? 'عرض المقرر' : 'متابعة التعلم'} ←</button></article>`;
  }
  function filteredCourses() {
    return courses.filter(course => !searchTerm || `${course.title} ${course.id} ${course.category} ${course.lesson}`.toLowerCase().includes(searchTerm));
  }
  function homePage() {
    const next = schedule[0];
    return pageTitle('الرئيسية', 'مساحتك الشخصية للتعلم والمتابعة — الفصل التدريبي الأول 1448هـ') +
      `<section class="student-welcome"><div><span class="student-eyebrow">مساحة تعلمك الشخصية</span><h2>أهلًا يا سارة، كمّلي من حيث توقفتِ</h2><p>لديك محاضرة قريبة وواجبان بانتظار التسليم. تقدمك هنا خاص بحسابك التجريبي.</p><button class="btn primary" data-page="student-classroom">استكمال محاضرة الشبكات ←</button></div><div class="welcome-mark" aria-hidden="true">ت</div></section>` +
      `<div class="kpis student-kpis">${kpi('مقرراتي','4','الفصل الحالي')}${kpi('إكمال الدروس','82%','تقدمك الشخصي')}${kpi('الحضور','94%','هذا الشهر')}${kpi('مهام قريبة','2','قبل نهاية الأسبوع',true)}</div>` +
      `<div class="student-home-grid"><section class="student-section"><div class="student-section-head"><div><h2>تابعي التعلم</h2><p>مقرراتك مرتبة حسب آخر نشاط</p></div><button class="action-link" data-page="student-courses">كل المقررات ←</button></div><div class="student-course-grid compact-courses">${filteredCourses().slice(0, 2).map(course => courseTile(course, true)).join('') || '<div class="card">لا توجد مقررات مطابقة للبحث.</div>'}</div></section><section class="card next-session-card"><div class="student-section-head"><div><h2>موعدك القادم</h2><p>الأسبوع التدريبي الحالي</p></div><span class="live-student-tag">● قريبًا</span></div><span class="session-day">${next[0]} · ${next[1]}</span><h3>${next[2]}</h3><p>${next[3]}</p><div class="session-separator"></div><p class="muted">قاعة المحاضرة التفاعلية · يبدأ الدرس بموعده</p><button class="btn" data-page="student-schedule">عرض الجدول</button></section></div>` +
      `<div class="student-home-grid"><section class="card upcoming-card"><div class="student-section-head"><div><h2>الواجبات القادمة</h2><p>خططي لوقتك قبل موعد التسليم</p></div><button class="action-link" data-page="student-assignments">عرض الكل ←</button></div>${assignments.filter(item => item.status !== 'مكتمل').slice(0, 2).map(item => `<div class="student-list-row"><span class="row-icon">✓</span><div><strong>${item.title}</strong><small>${item.course} · التسليم ${item.due}</small></div><button class="action-link" data-page="student-assignments">فتح</button></div>`).join('')}</section><section class="card progress-summary"><div class="student-section-head"><div><h2>ملخص تقدمي</h2><p>بياناتك لهذا الشهر</p></div></div><div class="metricrow"><span>إكمال المقررات</span><strong>82%</strong></div><div class="progressbar"><span style="width:82%"></span></div><div class="metricrow"><span>حضور المحاضرات</span><strong>94%</strong></div><div class="progressbar"><span style="width:94%"></span></div><button class="btn" data-page="student-attendance">تفاصيل التقدم</button></section></div>`;
  }
  function coursesPage() {
    const data = filteredCourses();
    return pageTitle('مقرراتي', 'كل مقرراتك وشعبك ودروسك المنشورة لهذا الفصل.', '<span class="student-tag">4 مقررات مسجلة</span>') +
      `<div class="student-filter-row"><input id="student-course-search" type="search" placeholder="ابحث باسم المقرر أو الدرس…" value="${escapeHtml(searchTerm)}"><span>${data.length} مقررات</span></div><div class="student-course-grid">${data.map(course => courseTile(course)).join('') || '<div class="card">لا توجد مقررات مطابقة.</div>'}</div>`;
  }
  function courseDetailPage() {
    const course = selectedCourse;
    const modules = [course.lesson, 'المفاهيم الأساسية والمصطلحات', 'تطبيق عملي قصير', 'مراجعة الوحدة واختبارها'];
    return pageTitle(course.title, `${course.id} · ${course.category} · المدرب ${course.trainer}`, '<button class="btn" data-page="student-courses">→ العودة لمقرراتي</button>') +
      `<section class="student-course-detail-hero card"><div><span class="course-code">${course.id}</span><h2>${course.title}</h2><p>شعبة 341 · الفصل التدريبي الأول · تقدمك ${course.progress}%</p></div><button class="btn primary" data-page="student-classroom">دخول الدرس الحالي ←</button></section><section class="card student-module-list"><div class="student-section-head"><div><h2>محتوى المقرر</h2><p>الدروس المتاحة لك بالترتيب</p></div><span class="student-tag">${course.progress}% مكتمل</span></div>${modules.map((module, index) => `<div class="student-list-row"><span class="module-index">${String(index + 1).padStart(2, '0')}</span><div><strong>${module}</strong><small>${index === 0 ? 'قاعة تفاعلية · 18 دقيقة' : 'درس · 12 دقيقة'}</small></div>${index < 2 ? '<span class="student-status done">متاح</span>' : '<span class="student-status">قريبًا</span>'}<button class="btn" data-page="student-classroom">${index === 0 ? 'ابدئي' : 'عرض'}</button></div>`).join('')}</section>`;
  }
  function schedulePage() {
    return pageTitle('الجدول التدريبي', 'المواعيد والشعب المسجلة في جدولك الشخصي.') +
      `<section class="card schedule-card"><div class="student-section-head"><div><h2>الأسبوع الحالي</h2><p>الأحد 18 صفر – الأربعاء 21 صفر · توقيت الرياض</p></div><span class="student-tag">1448هـ · الفصل الأول</span></div>${schedule.map((item, index) => `<div class="schedule-row"><div class="schedule-time"><strong>${item[0]}</strong><span>${item[1]}</span></div><div class="schedule-line"><i></i></div><div class="schedule-info"><strong>${item[2]}</strong><small>${item[3]}</small></div><button class="btn ${index === 0 ? 'primary' : ''}" data-page="student-classroom">${index === 0 ? 'دخول القاعة' : 'تفاصيل'}</button></div>`).join('')}</section><div class="notice student-demo-note">المواعيد تجريبية. لا توجد خدمة تقويم أو رابط اجتماع متصل.</div>`;
  }
  function assignmentsPage() {
    return pageTitle('الواجبات والاختبارات', 'تابعي مواعيد التسليم ومحاولاتك ونتائج التقييمات.') +
      `<div class="kpis student-kpis">${kpi('واجبات مفتوحة','2','تحتاج تسليمًا',true)}${kpi('اختبارات قادمة','1','اختبار الوحدة الأولى')}${kpi('متوسط درجاتي','88%','نتيجة تجريبية')}${kpi('تسليمات مكتملة','6','هذا الفصل')}</div><section class="card assignments-list"><div class="student-section-head"><div><h2>قائمة المهام</h2><p>تُحدّث الحالة داخل جلسة العرض فقط</p></div></div>${assignments.map(item => { const submitted = submittedAssignments.has(item.id) || item.status === 'مكتمل'; return `<div class="student-list-row assignment-row"><span class="row-icon">${submitted ? '✓' : '◷'}</span><div><strong>${item.title}</strong><small>${item.course} · ${item.due}</small></div><span class="student-status ${submitted ? 'done' : 'pending'}">${submitted ? 'مُسلّم تجريبيًا' : item.status}</span><button class="btn ${submitted ? '' : 'primary'}" data-student-action="${submitted ? 'assignment-details' : 'submit-assignment'}" data-assignment="${item.id}">${submitted ? 'عرض الحالة' : 'تسليم تجريبي'}</button></div>`; }).join('')}</section><section class="card student-quiz-card"><div class="student-section-head"><div><h2>اختبار الوحدة الأولى</h2><p>الشبكات 101 · 5 أسئلة · محاولة تدريبية</p></div><span class="student-tag">موعده الأحد</span></div><p>اختبار قصير لمراجعة المرسل ووسيط النقل والمستقبل.</p>${quizStarted ? `<div class="mini-quiz"><strong>أي جزء يبدأ إرسال البيانات؟</strong><div class="quiz-options"><button class="btn" data-student-action="course-quiz-answer" data-answer="وسيط النقل">وسيط النقل</button><button class="btn" data-student-action="course-quiz-answer" data-answer="المرسل">المرسل</button><button class="btn" data-student-action="course-quiz-answer" data-answer="المستقبل">المستقبل</button></div><p id="course-quiz-feedback" aria-live="polite"></p></div>` : '<button class="btn" data-student-action="start-quiz">عرض سؤال تدريبي</button>'}</section>`;
  }
  function resultsPage() {
    return pageTitle('نتائجي', 'درجاتك وملاحظاتك التعليمية في المقررات المسجلة.') +
      `<div class="kpis student-kpis">${kpi('المعدل الحالي','88%','من التقييمات المرصودة')}${kpi('تقييمات مكتملة','8','من أصل 10')}${kpi('مقررات ناجحة','4','هذا الفصل')}${kpi('تحتاج مراجعة','1','ملاحظة من المدرب',true)}</div><section class="card results-card"><h2 class="card-title">ملخص أداء المقررات</h2><div class="results-table"><div class="result-head"><span>المقرر</span><span>الأعمال</span><span>الاختبارات</span><span>المجموع الحالي</span><span>ملاحظة</span></div>${courses.map((course, i) => `<div class="result-row"><strong>${course.title}</strong><span>${[92,84,96,78][i]}%</span><span>${[86,80,91,82][i]}%</span><strong>${[89,82,94,80][i]}%</strong><span>${i === 2 ? 'أداء ممتاز' : i === 3 ? 'راجعي آخر درس' : 'مستمر'}</span></div>`).join('')}</div><p class="page-note">النتائج للعرض التجريبي، ولا تمثل سجلًا أكاديميًا معتمدًا.</p></section>`;
  }
  function attendancePage() {
    return pageTitle('الحضور والتقدم', 'سجل حضورك ونسب إكمال الدروس حسب المقرر.') +
      `<div class="kpis student-kpis">${kpi('نسبة الحضور','94%','هذا الشهر')}${kpi('محاضرات حضرتها','15','من أصل 16')}${kpi('دروس مكتملة',String(studentProgress.completedLessons),'من أصل 8')}${kpi('غياب مسجل','0','لا توجد حالات')}</div><section class="card"><div class="student-section-head"><div><h2>سجل الحضور الأخير</h2><p>عرض شخصي لا يتضمن بيانات متدربين آخرين</p></div></div><div class="results-table"><div class="result-head attendance-head"><span>التاريخ</span><span>المقرر</span><span>الحالة</span><span>مدة المشاركة</span></div>${attendanceLog.map(row => `<div class="result-row attendance-row"><span>${row[0]}</span><strong>${row[1]}</strong><span>${status(row[2])}</span><span>${row[3]}</span></div>`).join('')}</div></section><section class="card progress-courses"><div class="student-section-head"><div><h2>إكمال المحتوى</h2><p>تقدم شخصي في مقرراتك</p></div></div>${courses.map(course => `<div class="student-progress-row"><span>${course.title}</span><div class="progress"><i style="width:${course.progress}%"></i></div><strong>${course.progress}%</strong></div>`).join('')}</section>`;
  }
  function profilePage() {
    return pageTitle('ملفي الشخصي', 'بيانات الحساب والتفضيلات الشخصية في العرض التجريبي.') +
      `<div class="student-home-grid"><section class="card profile-summary"><div class="student-profile-avatar">س</div><h2>سارة الغامدي</h2><p>متدربة · تقنية الحاسب</p><span class="student-tag">الكلية التقنية بالأفلاج</span><div class="profile-contact"><div><small>الرقم التدريبي</small><strong>1448•••27</strong></div><div><small>الشعبة الأساسية</small><strong>341</strong></div><div><small>حالة الحساب</small><strong class="student-green">نشط تجريبيًا</strong></div></div></section><section class="card"><h2 class="card-title">تفضيلات المنصة</h2><div class="setting-row"><div><strong>لغة المحتوى</strong><p>العربية</p></div><span class="student-tag">RTL</span></div><div class="setting-row"><div><strong>تذكيرات الواجبات</strong><p>إشعارات داخل العرض فقط</p></div><button class="switch on" data-student-action="toggle-reminder" aria-label="تبديل تذكيرات الواجبات"><i></i></button></div><div class="setting-row"><div><strong>الخصوصية</strong><p>تعرض هذه المساحة بيانات الحساب التجريبي فقط</p></div></div><p class="page-note">يمكن تعديل هذه التفضيلات محليًا في الجلسة؛ لا يوجد حساب أو حفظ دائم.</p></section></div>`;
  }
  function classroomPage() {
    const lesson = lessonSteps[classroomStep];
    const progress = Math.round((classroomStep + 1) * 25);
    return pageTitle('قاعة المحاضرة الحية', 'الشبكات 101 · الوحدة الأولى · قاعة تفاعلية تجريبية', '<button class="btn" data-page="student-course-detail">← العودة للمقرر</button>') +
      `<div class="classroom-layout"><main class="classroom-main"><section class="classroom-intro card"><div><span class="student-eyebrow">قاعة المحاضرة · شعبة 341</span><h2>كيف تنتقل البيانات عبر الشبكة؟</h2><p>المحاضرة 1 من 4 · المدرب يشرح على السبورة أمامك</p></div><div class="classroom-header-actions"><span class="live-student-tag">● محاضرة مباشرة تجريبية</span><button class="btn" data-student-action="restart-lesson">↺ إعادة الشرح</button></div></section><section class="classroom-board card"><div class="board-toolbar"><strong>✎ السبورة التفاعلية <span id="board-state">المدرب يشرح</span></strong><div class="board-tools"><button class="tool selected" data-student-action="board-pen">✎ قلمك</button><button class="tool" data-student-action="board-erase">⌫ مسح</button><button class="tool" data-student-action="board-clear">مسح السبورة</button></div></div><div class="board-wrap"><canvas id="student-board" aria-label="سبورة المحاضرة التفاعلية"></canvas><span class="board-hint">الشرح يتقدم مع صوت المدرب · يمكنك الرسم على السبورة</span></div><div class="board-controls"><div><strong id="lesson-phase">${lesson.title}</strong><small id="lesson-subtitle">${lesson.sub}</small></div><div><button class="btn" data-student-action="lesson-prev">→ السابق</button><button class="btn primary" data-student-action="lesson-next">الخطوة التالية ←</button><button class="btn" data-student-action="lesson-speak">▶ اسمع الشرح</button><button class="btn" data-student-action="lesson-pause">Ⅱ إيقاف الصوت</button></div></div></section><div class="lesson-step-cards">${['المرسل: يبدأ إرسال البيانات','وسيط النقل: يحمل البيانات بين الجهازين','المستقبل: يستقبل البيانات'].map((text, i) => `<article class="card"><small>الخطوة 0${i + 1}</small><strong>${text.split(':')[0]}</strong><span>${text.split(':')[1]}</span></article>`).join('')}</div></main><aside class="classroom-side"><section class="card trainer-card"><div class="trainer-avatar">ف</div><div><h3>فهد القحطاني</h3><p>مدرب مقرر أساسيات الشبكات</p><span class="student-green" id="trainer-speaking">جاهز للشرح والتفاعل</span></div><p class="page-note">يشرح الفكرة ويرسمها، ثم يتوقف ليستمع لسؤالك.</p></section><section class="card live-chat-card"><h3>💬 الحوار مع المدرب</h3><div class="classroom-transcript" id="classroom-transcript" aria-live="polite">المدرب: أهلًا بك. لنتعرف إلى كيفية انتقال البيانات ببساطة. لدينا مُرسِل، ووسيط تنتقل البيانات من خلاله، ومُستقبِل يتلقاها.</div><div class="student-question-row"><input id="classroom-question" placeholder="اسألي المدرب عن نقطة…" aria-label="سؤالك للمدرب"><button class="btn primary" data-student-action="ask-trainer">إرسال</button></div><div class="classroom-shortcuts"><button class="btn" data-student-action="quick-question" data-question="مش فاهم الفكرة، اشرح تاني">اشرح تاني</button><button class="btn" data-student-action="quick-question" data-question="اديني مثال من الواقع">مثال واقعي</button><button class="btn" data-student-action="quick-question" data-question="اختبر فهمي بسؤال">اختبر فهمي</button><button class="btn" data-student-action="voice-question">🎙 تحدث</button></div><small class="page-note">الحوار الصوتي والإجابات نسخة عرض؛ لا يوجد نموذج ذكاء اصطناعي متصل.</small></section><section class="card"><h3>تقدم المحاضرة</h3><div class="metricrow"><span>إكمال الدرس</span><strong id="classroom-percent">${progress}%</strong></div><div class="progressbar"><span id="classroom-progress" style="width:${progress}%"></span></div><div class="metricrow"><span>الخطوة الحالية</span><strong id="classroom-step-count">${classroomStep + 1} / 4</strong></div><div class="metricrow"><span>فهمك المبدئي</span><strong id="classroom-understanding">${classroomQuizAnswer ? 'تم التفاعل' : 'بانتظار إجابتك'}</strong></div><button class="btn" data-student-action="save-progress">حفظ تقدم الجلسة</button></section><section class="card"><h3>سؤال مراجعة</h3><p>أي جزء يبدأ إرسال البيانات؟</p><div class="answer-list"><button class="btn" data-student-action="classroom-answer" data-answer="وسيط النقل">وسيط النقل</button><button class="btn" data-student-action="classroom-answer" data-answer="المرسل">المرسل</button><button class="btn" data-student-action="classroom-answer" data-answer="المستقبل">المستقبل</button></div><p class="page-note" id="classroom-quiz-feedback" aria-live="polite"></p></section></aside></div>`;
  }
  function renderStudentPage(page) {
    const renderers = {
      'student-home': homePage, 'student-courses': coursesPage, 'student-course-detail': courseDetailPage,
      'student-schedule': schedulePage, 'student-classroom': classroomPage, 'student-assignments': assignmentsPage,
      'student-results': resultsPage, 'student-attendance': attendancePage, 'student-profile': profilePage
    };
    return `<div class="student-portal">${(renderers[page] || homePage)()}</div>`;
  }
  function renderRoleShell(role) {
    setNavigation(role);
    document.body.classList.toggle('student-mode', role === studentRole);
    if (role === studentRole) {
      if (!String(state.page).startsWith('student-')) state.page = 'student-home';
      document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === state.page));
      state.filters = {};
      appRoot.innerHTML = renderStudentPage(state.page);
      const courseSearch = document.getElementById('student-course-search');
      courseSearch?.addEventListener('input', event => { const caret = event.target.selectionStart; searchTerm = event.target.value.trim().toLowerCase(); render(); const updated = document.getElementById('student-course-search'); updated?.focus(); updated?.setSelectionRange(caret, caret); });
      if (state.page === 'student-classroom') mountClassroom();
      return;
    }
    if (String(state.page).startsWith('student-')) state.page = 'dashboard';
    originalRender();
  }
  render = function roleAwareRender() {
    const role = roleSelector.value || 'مدير إدارة المنطقة';
    state.role = role;
    renderRoleShell(role);
  };

  function drawLesson() {
    const canvas = document.getElementById('student-board');
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(box.width * dpr));
    canvas.height = Math.max(1, Math.floor(box.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = box.width, h = box.height, lesson = lessonSteps[classroomStep];
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a211f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8f6f1'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = '700 24px Tajawal, Tahoma, sans-serif'; ctx.fillText(['انتقال البيانات عبر الشبكة','المرسل يبعث البيانات','البيانات تصل للمستقبل','راجع الفكرة الأساسية'][classroomStep], w / 2, 24);
    const centerY = h * .44, nodeW = Math.min(150, w * .24), nodeH = 68;
    const xs = [w * .12, w * .41, w * .70];
    const labels = ['المرسل', 'وسيط النقل', 'المستقبل'];
    const colors = ['#40d8bd', '#4ab6d0', '#70d7ad'];
    const drawBox = (x, label, color) => {
      ctx.fillStyle = '#11342f'; ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, centerY, nodeW, nodeH, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8f6f1'; ctx.font = '700 17px Tajawal, Tahoma, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + nodeW / 2, centerY + nodeH / 2);
    };
    const arrow = (x1, x2, color) => {
      if (classroomStep < (x1 < xs[1] ? 1 : 2)) return;
      const y = centerY + nodeH / 2;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2 - 11, y - 7); ctx.lineTo(x2 - 11, y + 7); ctx.closePath(); ctx.fill();
    };
    drawBox(xs[0], labels[0], colors[0]); drawBox(xs[1], labels[1], colors[1]); drawBox(xs[2], labels[2], colors[2]);
    arrow(xs[0] + nodeW + 10, xs[1] - 10, colors[0]); arrow(xs[1] + nodeW + 10, xs[2] - 10, colors[2]);
    ctx.fillStyle = '#9bb7ad'; ctx.font = '15px Tajawal, Tahoma, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(lesson.sub, w / 2, centerY + nodeH + 38);
    const phase = document.getElementById('lesson-phase'); if (phase) phase.textContent = lesson.title;
    const subtitle = document.getElementById('lesson-subtitle'); if (subtitle) subtitle.textContent = lesson.sub;
    const percent = document.getElementById('classroom-percent'); if (percent) percent.textContent = `${(classroomStep + 1) * 25}%`;
    const bar = document.getElementById('classroom-progress'); if (bar) bar.style.width = `${(classroomStep + 1) * 25}%`;
    const stepCount = document.getElementById('classroom-step-count'); if (stepCount) stepCount.textContent = `${classroomStep + 1} / 4`;
  }
  function mountClassroom() {
    drawLesson();
    const canvas = document.getElementById('student-board');
    canvas?.addEventListener('pointerdown', event => {
      drawing = true; canvas.setPointerCapture(event.pointerId);
      const rect = canvas.getBoundingClientRect(), ctx = canvas.getContext('2d');
      ctx.beginPath(); ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top);
    });
    canvas?.addEventListener('pointermove', event => {
      if (!drawing) return;
      const rect = canvas.getBoundingClientRect(), ctx = canvas.getContext('2d');
      ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top);
      ctx.strokeStyle = eraseMode ? '#0a211f' : '#43d8bd'; ctx.lineWidth = eraseMode ? 24 : 3; ctx.lineCap = 'round'; ctx.stroke();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(name => canvas?.addEventListener(name, () => { drawing = false; }));
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('المتصفح لا يدعم قراءة النص صوتيًا.'); return; }
    const synth = window.speechSynthesis;
    const request = ++speechRequest;
    synth.cancel();
    const statusEl = document.getElementById('trainer-speaking');
    if (request !== speechRequest) return;
    // Start synchronously in the click handler. Some mobile browsers block speech
    // if it is deferred until the asynchronous `voiceschanged` event.
    const voices = synth.getVoices();
    const voice = voices.find(item => /^ar[-_]SA$/i.test(item.lang))
      || voices.find(item => /^ar([_-]|$)/i.test(item.lang) && !/^ar[-_]EG$/i.test(item.lang));
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang || 'ar-SA';
    if (voice) utterance.voice = voice;
    utterance.rate = .92;
    if (statusEl) statusEl.textContent = voice && /^ar[-_]SA$/i.test(voice.lang)
      ? 'يشرح المدرب باللغة العربية الفصحى…'
      : 'يشرح المدرب باللغة العربية…';
    utterance.onend = () => { const el = document.getElementById('trainer-speaking'); if (el) el.textContent = 'جاهز للشرح بصوت عربي'; };
    utterance.onerror = event => {
      const el = document.getElementById('trainer-speaking');
      if (el) el.textContent = 'تعذر تشغيل الصوت العربي';
      if (event.error === 'voice-unavailable' || event.error === 'language-unavailable') {
        toast('الجهاز لا يوفر صوتًا عربيًا للمتصفح. فعّل الصوت العربي من إعدادات الجهاز ثم أعد المحاولة.');
      }
    };
    synth.speak(utterance);
  }
  function toast(message) {
    if (lastToast) lastToast.remove();
    const node = document.createElement('div'); node.className = 'toast success'; node.textContent = message;
    document.getElementById('toast-root').append(node); lastToast = node; window.setTimeout(() => node.remove(), 2600);
  }
  function answerFor(question) {
    if (question.includes('تاني') || question.includes('مش فاهم')) return 'لنتأمل مثالًا بسيطًا: عندما ترسلين رسالة إلى صديقتك، يكون جهازك هو المُرسِل، وتكون شبكة الاتصال وسيط النقل، ويكون جهاز صديقتك هو المُستقبِل.';
    if (question.includes('مثال')) return 'عندما ترسلين صورة، يرسل جهازك البيانات، وتنقلها الشبكة، ثم يستقبلها الجهاز الآخر.';
    if (question.includes('اختبر')) return 'إليك سؤالًا: إذا أرسل الحاسوب ملفًا إلى الطابعة، فما الجهاز الذي يبدأ الإرسال؟';
    if (question.includes('وسيط')) return 'وسيط النقل هو المسار الذي تسلكه البيانات، مثل كابل الشبكة أو الاتصال اللاسلكي.';
    if (question.includes('مرسل')) return 'المُرسِل هو الجهاز الذي يبدأ عملية إرسال البيانات.';
    return 'يمكنني في هذا العرض توضيح المفهوم الأساسي: يُرسِل المُرسِل البيانات، وينقلها وسيط النقل، ثم يستقبلها المُستقبِل. لا يتصل هذا العرض بنموذج ذكاء اصطناعي.';
  }
  function sendQuestion(question) {
    if (!question.trim()) return;
    const transcript = document.getElementById('classroom-transcript');
    if (transcript) transcript.textContent = `أنتِ: ${question}\n\nالمدرب: ${answerFor(question)}`;
    const understanding = document.getElementById('classroom-understanding'); if (understanding) understanding.textContent = 'تم التفاعل';
    classroomQuestion = question; speak(answerFor(question));
  }
  document.addEventListener('click', event => {
    const courseButton = event.target.closest('[data-student-course]');
    if (courseButton) {
      selectedCourse = courses.find(course => course.id === courseButton.dataset.studentCourse) || courses[0];
      state.page = 'student-course-detail'; render(); return;
    }
    const button = event.target.closest('[data-student-action]');
    if (!button) return;
    const action = button.dataset.studentAction;
    if (action === 'lesson-next' || action === 'lesson-prev' || action === 'restart-lesson') {
      classroomStep = action === 'restart-lesson' ? 0 : Math.max(0, Math.min(lessonSteps.length - 1, classroomStep + (action === 'lesson-next' ? 1 : -1)));
      drawLesson();
    } else if (action === 'lesson-speak') speak(lessonSteps[classroomStep].text);
    else if (action === 'lesson-pause') {
      if (window.speechSynthesis?.speaking) { window.speechSynthesis.pause(); toast('تم إيقاف الشرح مؤقتًا. اضغطي اسمع الشرح للمتابعة.'); }
      else toast('ابدئي الشرح أولًا من زر اسمع الشرح.');
    } else if (action === 'board-pen') { eraseMode = false; document.querySelector('[data-student-action="board-pen"]')?.classList.add('selected'); document.querySelector('[data-student-action="board-erase"]')?.classList.remove('selected'); }
    else if (action === 'board-erase') { eraseMode = true; document.querySelector('[data-student-action="board-erase"]')?.classList.add('selected'); document.querySelector('[data-student-action="board-pen"]')?.classList.remove('selected'); }
    else if (action === 'board-clear') drawLesson();
    else if (action === 'ask-trainer') { const input = document.getElementById('classroom-question'); sendQuestion(input.value); input.value = ''; }
    else if (action === 'quick-question') sendQuestion(button.dataset.question || '');
    else if (action === 'voice-question') {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition) toast('التعرف على الصوت غير مدعوم هنا؛ اكتبي سؤالك في الحقل.');
      else { const recognition = new Recognition(); recognition.lang = 'ar-SA'; recognition.onresult = result => sendQuestion(result.results[0][0].transcript); recognition.onerror = () => toast('تعذر سماع السؤال؛ حاولي مرة أخرى.'); recognition.start(); }
    } else if (action === 'classroom-answer') {
      classroomQuizAnswer = button.dataset.answer || '';
      const feedback = document.getElementById('classroom-quiz-feedback');
      const correct = classroomQuizAnswer === 'المرسل';
      if (feedback) feedback.textContent = correct ? 'إجابة صحيحة! المرسل هو الذي يبدأ الإرسال. أحسنتِ.' : 'فكري في الجهاز الذي يبدأ إرسال البيانات، ثم حاولي مرة أخرى.';
      const understanding = document.getElementById('classroom-understanding'); if (understanding) understanding.textContent = correct ? 'ممتاز ✓' : 'نراجع الفكرة';
      if (correct) { studentProgress.completedLessons = Math.min(8, studentProgress.completedLessons + 1); toast('إجابة صحيحة، أحسنتِ!'); }
    } else if (action === 'save-progress') { studentProgress.saved = true; toast('تم تحديث تقدمك في جلسة العرض الحالية فقط.'); }
    else if (action === 'submit-assignment') { submittedAssignments.add(button.dataset.assignment); render(); toast('تم تسجيل التسليم التجريبي في هذه الجلسة.'); }
    else if (action === 'assignment-details') toast('هذه حالة تجريبية؛ لا يوجد رفع ملفات أو تسليم فعلي.');
    else if (action === 'start-quiz') { quizStarted = true; render(); }
    else if (action === 'course-quiz-answer') {
      const feedback = document.getElementById('course-quiz-feedback');
      if (feedback) feedback.textContent = button.dataset.answer === 'المرسل' ? 'إجابة صحيحة — المرسل يبدأ الإرسال.' : 'ليست الإجابة الصحيحة. فكري في الجهاز الذي يبدأ الإرسال.';
    } else if (action === 'toggle-reminder') { button.classList.toggle('on'); toast('تم تحديث التفضيل في هذه الجلسة فقط.'); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.id === 'classroom-question') { event.preventDefault(); document.querySelector('[data-student-action="ask-trainer"]')?.click(); }
  });
  window.addEventListener('resize', () => { if (roleSelector.value === studentRole && state.page === 'student-classroom') drawLesson(); });
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  render();
})();
