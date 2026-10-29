// Demo trainee portal: records stay in memory; the single Tutori lecture runs live.
(() => {
  const roleSelector = document.getElementById('role-switcher');
  const appRoot = document.getElementById('app');
  const originalRender = render;
  const studentRole = 'المتدرب';
  const navSets = {
    'مدير إدارة المنطقة': [['الإدارة والمتابعة', [['dashboard', '▦', 'لوحة المؤشرات'], ['facilities', '⌂', 'الكليات والمنشآت'], ['departments', '⌘', 'الأقسام'], ['users', '♙', 'المستخدمون'], ['roles', '◫', 'الأدوار والصلاحيات']]], ['التدريب والمحتوى', [['courses', '▤', 'المقررات'], ['sections', '▣', 'الشعب التدريبية'], ['content', '▣', 'المحتوى والاعتماد'], ['attendance', '◷', 'الحضور والتقدم']]], ['الحوكمة', [['reports', '▥', 'التقارير والمؤشرات'], ['quality', '✓', 'الجودة وسجل التدقيق'], ['settings', '⚙', 'الإعدادات']]]],
    'نائب المحافظ للتدريب': [['المؤشرات والقيادة', [['dashboard', '▦', 'لوحة المؤشرات'], ['facilities', '⌂', 'الكليات والمنشآت'], ['reports', '▥', 'التقارير والمؤشرات']]], ['التنفيذ التدريبي', [['courses', '▤', 'المقررات'], ['sections', '▣', 'الشعب التدريبية'], ['attendance', '◷', 'الحضور والتقدم'], ['quality', '✓', 'مؤشرات الجودة']]]],
    'مشرف الكليات التقنية': [['نطاق الإشراف', [['dashboard', '▦', 'لوحة المؤشرات'], ['facilities', '⌂', 'الكليات والمنشآت'], ['departments', '⌘', 'الأقسام']]], ['التدريب والجودة', [['courses', '▤', 'المقررات'], ['sections', '▣', 'الشعب التدريبية'], ['content', '▣', 'المحتوى والاعتماد'], ['attendance', '◷', 'الحضور والتقدم'], ['reports', '▥', 'التقارير والمؤشرات'], ['quality', '✓', 'الجودة']]]],
    'عميد المنشأة/الكلية': [['إدارة المنشأة', [['dashboard', '▦', 'لوحة المؤشرات'], ['facilities', '⌂', 'منشأتي'], ['departments', '⌘', 'الأقسام'], ['users', '♙', 'المستخدمون']]], ['التدريب والمتابعة', [['courses', '▤', 'المقررات'], ['sections', '▣', 'الشعب التدريبية'], ['content', '▣', 'المحتوى والاعتماد'], ['attendance', '◷', 'الحضور والتقدم'], ['reports', '▥', 'التقارير'], ['quality', '✓', 'الجودة'], ['settings', '⚙', 'الإعدادات']]]],
    'إدارة الجودة التدريبية': [['الجودة والاعتماد', [['dashboard', '▦', 'لوحة المؤشرات'], ['content', '▣', 'مراجعة المحتوى'], ['quality', '✓', 'سجل الجودة والتدقيق'], ['reports', '▥', 'تقارير الجودة']]]],
    'رئيس القسم/مشرف القسم': [['إدارة القسم', [['dashboard', '▦', 'لوحة المؤشرات'], ['departments', '⌘', 'الأقسام'], ['courses', '▤', 'المقررات'], ['sections', '▣', 'الشعب التدريبية']]], ['متابعة التدريب', [['content', '▣', 'المحتوى'], ['attendance', '◷', 'الحضور والتقدم'], ['reports', '▥', 'تقارير القسم']]]],
    'المدرب': [['مساحة المدرب', [['dashboard', '▦', 'لوحة المؤشرات'], ['sections', '▣', 'الشعب المكلف بها'], ['courses', '▤', 'المقررات'], ['content', '▣', 'إعداد المحتوى'], ['attendance', '◷', 'الحضور'], ['quality', '✓', 'ملاحظات الجودة']]]]
  };
  const personas = {
    'مدير إدارة المنطقة': ['م. بدر عبدالواحد', 'ب'], 'نائب المحافظ للتدريب': ['د. عادل الزنيدي', 'ع'],
    'مشرف الكليات التقنية': ['م. عبدالمجيد الفدا', 'ع'], 'عميد المنشأة/الكلية': ['م. عدنان الزيادي', 'ع'],
    'إدارة الجودة التدريبية': ['م. أسامه الأزهري', 'أ'], 'رئيس القسم/مشرف القسم': ['أ. عبدالرحمن المسند', 'ع'],
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
  let searchTerm = '';
  let quizStarted = false;
  let selectedCourse = courses[0];
  let lastToast;
  const studentProgress = { completedLessons: 6 };
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
    document.querySelector('.sidebar-foot').innerHTML = `<span class="pulse"></span> ${role === studentRole ? 'جلسة المتدرب · عرض تفاعلي' : 'بيئة العرض التجريبي'}`;
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
      `<section class="student-welcome"><div><span class="student-eyebrow">قاعة حية واحدة جاهزة للعرض</span><h2>أهلًا يا سارة، ابدئي محاضرة الشبكات</h2><p>شاهدي شرحًا مولّدًا مباشرةً عن انتقال البيانات عبر الشبكة، مع سبورة تفاعلية وصوت وأسئلة متابعة. تقدم بقية الصفحات تجريبي ولا يُحفظ.</p><button class="btn primary" data-page="student-classroom">ابدئي المحاضرة الحية ←</button></div><div class="welcome-mark" aria-hidden="true">ت</div></section>` +
      `<div class="kpis student-kpis">${kpi('مقرراتي','4','الفصل الحالي')}${kpi('إكمال الدروس','82%','تقدمك الشخصي')}${kpi('الحضور','94%','هذا الشهر')}${kpi('مهام قريبة','2','قبل نهاية الأسبوع',true)}</div>` +
      `<div class="student-home-grid"><section class="student-section"><div class="student-section-head"><div><h2>تابعي التعلم</h2><p>مقرراتك مرتبة حسب آخر نشاط</p></div><button class="action-link" data-page="student-courses">كل المقررات ←</button></div><div class="student-course-grid compact-courses">${filteredCourses().slice(0, 2).map(course => courseTile(course, true)).join('') || '<div class="card">لا توجد مقررات مطابقة للبحث.</div>'}</div></section><section class="card next-session-card"><div class="student-section-head"><div><h2>جلسة العرض المتاحة</h2><p>مقرر الشبكات 101</p></div><span class="live-student-tag">● جلسة واحدة</span></div><span class="session-day">${next[2]}</span><h3>كيف تنتقل البيانات عبر الشبكة؟</h3><p>المرسل · وسيط النقل · المستقبل</p><div class="session-separator"></div><p class="muted">شرح وسبورة وصوت عبر Tutori وOpenAI API.</p><button class="btn primary" data-page="student-classroom">دخول المحاضرة الحية</button></section></div>` +
      `<div class="student-home-grid"><section class="card upcoming-card"><div class="student-section-head"><div><h2>الواجبات القادمة</h2><p>خططي لوقتك قبل موعد التسليم</p></div><button class="action-link" data-page="student-assignments">عرض الكل ←</button></div>${assignments.filter(item => item.status !== 'مكتمل').slice(0, 2).map(item => `<div class="student-list-row"><span class="row-icon">✓</span><div><strong>${item.title}</strong><small>${item.course} · التسليم ${item.due}</small></div><button class="action-link" data-page="student-assignments">فتح</button></div>`).join('')}</section><section class="card progress-summary"><div class="student-section-head"><div><h2>ملخص تقدمي</h2><p>بياناتك لهذا الشهر</p></div></div><div class="metricrow"><span>إكمال المقررات</span><strong>82%</strong></div><div class="progressbar"><span style="width:82%"></span></div><div class="metricrow"><span>حضور المحاضرات</span><strong>94%</strong></div><div class="progressbar"><span style="width:94%"></span></div><button class="btn" data-page="student-attendance">تفاصيل التقدم</button></section></div>`;
  }
  function coursesPage() {
    const data = filteredCourses();
    return pageTitle('مقرراتي', 'كل مقرراتك وشعبك ودروسك المنشورة لهذا الفصل.', '<span class="student-tag">4 مقررات مسجلة</span>') +
      `<div class="student-filter-row"><input id="student-course-search" type="search" placeholder="ابحث باسم المقرر أو الدرس…" value="${escapeHtml(searchTerm)}"><span>${data.length} مقررات</span></div><div class="student-course-grid">${data.map(course => courseTile(course)).join('') || '<div class="card">لا توجد مقررات مطابقة.</div>'}</div>`;
  }
  function courseDetailPage() {
    const course = selectedCourse;
    const liveCourse = course.id === 'NET-101';
    const modules = liveCourse ? [course.lesson] : [];
    return pageTitle(course.title, `${course.id} · ${course.category} · المدرب ${course.trainer}`, '<button class="btn" data-page="student-courses">→ العودة لمقرراتي</button>') +
      `<section class="student-course-detail-hero card"><div><span class="course-code">${course.id}</span><h2>${course.title}</h2><p>${liveCourse ? 'شعبة العرض 341 · محاضرة حية واحدة متاحة' : 'مقرر تجريبي · لا توجد له محاضرة حية في هذا العرض'}</p></div>${liveCourse ? '<button class="btn primary" data-page="student-classroom">دخول المحاضرة الحية ←</button>' : '<span class="student-tag">المحاضرة الحية المتاحة: الشبكات 101</span>'}</section><section class="card student-module-list"><div class="student-section-head"><div><h2>${liveCourse ? 'محاضرة العرض' : 'محتوى تجريبي'}</h2><p>${liveCourse ? 'توليد حي للشرح والصوت والسبورة من Tutori' : 'المحتوى التفاعلي لهذا المقرر غير متصل في هذا العرض'}</p></div>${liveCourse ? '<span class="student-tag">محاضرة واحدة</span>' : ''}</div>${liveCourse ? modules.map((module, index) => `<div class="student-list-row"><span class="module-index">0${index + 1}</span><div><strong>${module}</strong><small>جلسة ذكاء اصطناعي تفاعلية · 3 دقائق تقريبًا</small></div><span class="student-status done">متاحة الآن</span><button class="btn primary" data-page="student-classroom">ابدئي المحاضرة</button></div>`).join('') : '<p class="page-note">جرّبي المحاضرة الحية الوحيدة في مقرر الشبكات 101 من القائمة الجانبية أو الصفحة الرئيسية.</p>'}</section>`;
  }
  function schedulePage() {
    return pageTitle('الجدول التدريبي', 'المواعيد والشعب المسجلة في جدولك الشخصي.') +
      `<section class="card schedule-card"><div class="student-section-head"><div><h2>الأسبوع الحالي</h2><p>الأحد 18 صفر – الأربعاء 21 صفر · توقيت الرياض</p></div><span class="student-tag">1448هـ · الفصل الأول</span></div>${schedule.map((item, index) => `<div class="schedule-row"><div class="schedule-time"><strong>${item[0]}</strong><span>${item[1]}</span></div><div class="schedule-line"><i></i></div><div class="schedule-info"><strong>${item[2]}</strong><small>${item[3]}</small></div>${index === 0 ? '<button class="btn primary" data-page="student-classroom">دخول المحاضرة الحية</button>' : '<button class="btn" disabled title="المحاضرة الوحيدة المتصلة في هذا العرض هي الشبكات 101">غير متاحة في العرض</button>'}</div>`).join('')}</section><div class="notice student-demo-note">الموعد يعرض سيناريو تجريبيًا. المحاضرة الحية المتصلة الوحيدة هنا هي محاضرة الشبكات 101.</div>`;
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
    const tutoriUrl = 'https://tutori-gi05.onrender.com/';
    const launch = `<a class="btn primary live-lecture-launch" href="${tutoriUrl}?__theme=light" target="_blank" rel="noopener noreferrer">ابدأ المحاضرة في نافذة جديدة ↗</a>`;
    return pageTitle('قاعة المحاضرة الحية', 'الشبكات 101 · شعبة العرض 341 · محاضرة واحدة متصلة فعليًا', '<button class="btn" data-page="student-courses">العودة للمقررات ←</button>') +
      `<div class="classroom-layout live-classroom-layout"><main class="classroom-main"><section class="classroom-intro card"><div><span class="student-eyebrow">قاعة المحاضرة · NET-101</span><h2>كيف تنتقل البيانات عبر شبكة الحاسب؟</h2><p>محاضرة عربية واحدة يولّدها Tutori مباشرةً بالشرح والصوت والسبورة التفاعلية.</p></div><div class="classroom-header-actions"><span class="live-student-tag">● محاضر ذكي متصل</span>${launch}</div></section><section class="classroom-board card"><div class="board-toolbar"><strong>✎ معاينة السبورة <span>توضيحية</span></strong><span class="board-preview-label">السبورة الحية تظهر عند بدء المحاضرة في Tutori</span></div><div class="board-wrap live-board-wrap"><div class="live-board-preview" role="img" aria-label="معاينة توضيحية لمسار البيانات من الهاتف عبر الموجّه إلى خادم ويب"><div class="network-node"><small>المرسل</small><strong>هاتفك</strong><span>يبدأ الطلب</span></div><span class="network-arrow" aria-hidden="true">←</span><div class="network-node network-node-router"><small>وسيط النقل</small><strong>Wi‑Fi · موجّه</strong><span>يوجّه حزم البيانات</span></div><span class="network-arrow" aria-hidden="true">←</span><div class="network-node network-node-server"><small>المستقبل</small><strong>خادم ويب</strong><span>يرسل الاستجابة</span></div></div><span class="board-hint">رسم توضيحي لموضوع المحاضرة — الرسم التفاعلي الحقيقي يُنشأ داخل Tutori</span></div><div class="board-controls"><div><strong>محاضرة واحدة · نحو 3 دقائق</strong><small>سؤال البداية مهيأ مسبقًا في صفحة Tutori</small></div><div>${launch}</div></div></section></main><aside class="classroom-side"><section class="card trainer-card live-trainer-card"><div class="trainer-avatar">AI</div><div><h3>مدرب الشبكات الذكي</h3><p>Tutori · OpenAI API</p><span class="student-green">جاهز لبدء المحاضرة</span></div><p class="page-note">الشرح يولّد عند الطلب، ويعرض خطواته على سبورة حية. يمكنك متابعة الأسئلة بعد بدء المحاضرة.</p></section><section class="card live-launch-card"><h3>ابدأ المحاضرة</h3><p>يفتح المحاضر في نافذة مستقلة، والسؤال عن انتقال البيانات جاهز مسبقًا.</p>${launch}<small>داخل Tutori اضغط «ابدأ المحاضرة» لتوليد الشرح والصوت والرسم.</small></section><section class="card live-outline-card"><h3>خطة المحاضرة</h3><ol><li>من يرسل البيانات؟</li><li>كيف ينقلها Wi‑Fi والموجّه؟</li><li>كيف يرد خادم الويب؟</li></ol><p class="page-note">هذه محاور الدرس؛ الشرح والرسم الفعليان يُولّدان من النموذج.</p></section></aside></div><p class="live-lecture-disclaimer">توليد الشرح والصوت يستخدم OpenAI API وقد تُحتسب تكلفة. بيانات الحضور والتقدم خارج القاعة تظل تجريبية ولا تُحفظ.</p>`;
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

  function toast(message) {
    if (lastToast) lastToast.remove();
    const node = document.createElement('div'); node.className = 'toast success'; node.textContent = message;
    document.getElementById('toast-root').append(node); lastToast = node; window.setTimeout(() => node.remove(), 2600);
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
    if (action === 'submit-assignment') { submittedAssignments.add(button.dataset.assignment); render(); toast('تم تسجيل التسليم التجريبي في هذه الجلسة.'); }
    else if (action === 'assignment-details') toast('هذه حالة تجريبية؛ لا يوجد رفع ملفات أو تسليم فعلي.');
    else if (action === 'start-quiz') { quizStarted = true; render(); }
    else if (action === 'course-quiz-answer') {
      const feedback = document.getElementById('course-quiz-feedback');
      if (feedback) feedback.textContent = button.dataset.answer === 'المرسل' ? 'إجابة صحيحة — المرسل يبدأ الإرسال.' : 'ليست الإجابة الصحيحة. فكري في الجهاز الذي يبدأ الإرسال.';
    } else if (action === 'toggle-reminder') { button.classList.toggle('on'); toast('تم تحديث التفضيل في هذه الجلسة فقط.'); }
  });
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  render();
})();
