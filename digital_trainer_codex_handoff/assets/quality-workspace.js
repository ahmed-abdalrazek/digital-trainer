// Quality review workspace for the demo. All records are fictional and session-only.
(() => {
  const role = 'إدارة الجودة التدريبية';
  const selector = document.getElementById('role-switcher');
  const root = document.getElementById('app');
  const baseRender = render;
  const stages = ['ملاحظة مرصودة', 'توصية مرفوعة', 'إجراء تصحيحي', 'قيد المتابعة', 'مغلقة'];
  let resultsCollege = '';
  let institutionCollege = '';
  const menu = [
    ['dashboard', '▦', 'مؤشرات الجودة'], ['quality-content', '▣', 'مراجعة المحتوى'],
    ['quality-results', '◈', 'نتائج المتدربين'], ['quality-surveys', '♡', 'الاستبيانات الأسبوعية'],
    ['quality-institutions', '⌂', 'الكليات والأقسام'], ['quality-notes', '✓', 'ملاحظات الجودة'],
    ['quality-audit', '◷', 'سجل التدقيق']
  ];
  const cases = [
    { id:'Q-104', title:'انخفاض إكمال مقرر الشبكات 101', college:'الكلية التقنية بالخرج', department:'تقنية الحاسب', course:'الشبكات 101', kind:'مؤشر أداء', owner:'رئيس قسم تقنية الحاسب', stage:1, due:'1448/03/18', detail:'انخفض إكمال الدروس إلى 61% خلال أسبوعين متتاليين؛ يلزم التحقق من ملاءمة الجدول وتوفر المحتوى.' },
    { id:'Q-103', title:'ارتفاع الرسوب في أساسيات البرمجة', college:'الكلية التقنية بالأفلاج', department:'تقنية الحاسب', course:'أساسيات البرمجة', kind:'نتائج', owner:'رئيس قسم تقنية الحاسب', stage:2, due:'1448/03/20', detail:'نسبة النجاح 68% في التقييم التجريبي؛ أوصيت بمراجعة مواءمة الأنشطة مع نواتج التعلم.' },
    { id:'Q-102', title:'ملاحظات متكررة على وضوح المحتوى', college:'المعهد الصناعي بوادي الدواسر', department:'الدراسات العامة', course:'مهارات الاتصال', kind:'استبيان', owner:'منسق الجودة بالمنشأة', stage:3, due:'1448/03/22', detail:'تكررت ملاحظات صعوبة الأمثلة في الاستبيان الأسبوعي؛ نتابع تنفيذ التوصية مع الجهة المختصة.' },
    { id:'Q-101', title:'نقص مرفقات درس إدارة كلمات المرور', college:'الكلية التقنية بالأفلاج', department:'تقنية الحاسب', course:'مبادئ الأمن السيبراني', kind:'محتوى', owner:'مالك المقرر', stage:0, due:'1448/03/24', detail:'الدرس منشور في سجل العرض مع مرفق توضيحي ناقص؛ الملاحظة لا توقف النشر ولا تعدل المحتوى.' }
  ];
  const audit = [
    ['09:10','هدى الحربي','متابعة ملاحظة','Q-102 · مهارات الاتصال'],
    ['أمس 14:35','هدى الحربي','رفع توصية','Q-103 · أساسيات البرمجة'],
    ['أمس 11:20','منسق الجودة','تسجيل ملاحظة','Q-104 · الشبكات 101'],
    ['الأحد 10:05','النظام التجريبي','إنشاء سجل مراجعة','Q-101 · الأمن السيبراني']
  ];
  const collegeStats = [
    ['الكلية التقنية بالأفلاج','4','78%','68%','84%'],
    ['الكلية التقنية بالخرج','3','61%','81%','79%'],
    ['المعهد الصناعي بوادي الدواسر','2','73%','76%','71%'],
    ['الكلية التقنية بالمزاحمية','1','69%','—','82%']
  ];
  const contentRows = [
    ['الشبكات 101','نموذج OSI','الكلية التقنية بالخرج','مطابق','فهد القحطاني'],
    ['أساسيات البرمجة','المتغيرات وأنواع البيانات','الكلية التقنية بالأفلاج','يحتاج مراجعة','نورة السبيعي'],
    ['مبادئ الأمن السيبراني','إدارة كلمات المرور','الكلية التقنية بالأفلاج','مرفق ناقص','حسن الغامدي'],
    ['مهارات الاتصال','التواصل المهني','وادي الدواسر','مطابق','مها القحطاني']
  ];
  const resultsRows = [
    ['أساسيات البرمجة','الأفلاج · تقنية الحاسب','68%','18%','14%','أولوية مراجعة'],
    ['الشبكات 101','الخرج · تقنية الحاسب','84%','11%','5%','ضمن المتوقع'],
    ['مهارات الاتصال','وادي الدواسر · الدراسات العامة','79%','15%','6%','متابعة'],
    ['مبادئ الأمن السيبراني','الأفلاج · تقنية الحاسب','88%','9%','3%','ضمن المتوقع']
  ];
  const surveyRows = [
    ['الأفلاج','وضوح المحتوى','4.3 / 5','72%','«نحتاج أمثلة عملية أكثر»'],
    ['الخرج','تجربة التدريب','3.8 / 5','68%','«تأخر نشر بعض المرفقات»'],
    ['وادي الدواسر','تفاعل المدرب','4.5 / 5','81%','«الشرح واضح ومناسب»'],
    ['المزاحمية','ملاءمة الأنشطة','3.9 / 5','64%','«بعض الأنشطة أطول من الوقت»']
  ];
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const heading = (title, description, action='') => `<div class="page-heading"><div><div class="breadcrumb">الجودة التدريبية / ${title}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
  const table = (headers, rows) => `<div class="card table-card quality-table-wrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td class="empty" colspan="${headers.length}">لا توجد نتائج مطابقة.</td></tr>`}</tbody></table></div>`;
  const pill = value => `<span class="quality-pill">${esc(value)}</span>`;
  const stageStrip = current => `<div class="quality-stage-strip">${stages.map((s,i)=>`<span class="${i<current?'done':i===current?'current':''}"><i>${i<current?'✓':i+1}</i>${s}</span>`).join('')}</div>`;
  const caseCards = (items=cases) => items.map(item => `<article class="card quality-case"><div class="quality-case-top"><div><span class="quality-case-id">${item.id}</span> ${pill(item.kind)} <span class="quality-stage-tag">${stages[item.stage]}</span></div><small>موعد المتابعة ${item.due}</small></div><h3>${esc(item.title)}</h3><p>${esc(item.college)} · ${esc(item.department)} · ${esc(item.course)}</p><div class="quality-case-detail">${esc(item.detail)}</div>${stageStrip(item.stage)}<div class="quality-case-foot"><span>الجهة المعنية: ${esc(item.owner)}</span>${item.stage<stages.length-1?`<button class="btn primary" data-quality="advance" data-id="${item.id}">${item.stage===0?'رفع توصية':item.stage===1?'تسجيل إجراء تصحيحي':item.stage===2?'بدء المتابعة':'إغلاق الملاحظة'} ←</button>`:pill('أغلقت')}</div></article>`).join('');
  const dashboard = () => heading('مؤشرات الجودة','مراجعة مؤشرات المحتوى والنتائج ورضا المتدربين ومتابعة التوصيات. صلاحية الجودة رقابية ولا تعدل السجلات الأكاديمية.', '<button class="btn primary" data-quality="new">+ تسجيل ملاحظة</button>') +
    `<div class="quality-scope-note"><b>نطاق الدور:</b> عرض وتحليل وملاحظة وتوصية ومتابعة. لا يتيح هذا الدور تغيير الدرجات أو الحضور أو حذف/تحرير المحتوى.</div><div class="kpis">${kpi('ملاحظات مفتوحة',cases.filter(x=>x.stage<4).length,'في دورة المعالجة',true)}${kpi('توصيات وإجراءات','3','بانتظار متابعة')}${kpi('رضا المتدربين','4.1 / 5','متوسط الاستبيانات الأسبوعية')}${kpi('محتوى يحتاج مراجعة','2','من عينة العرض',true)}</div>`+
    `<div class="grid-2 quality-dash-grid"><section class="card"><div class="table-head"><div><h2 class="card-title">أولويات الجودة</h2><p class="card-subtitle">مؤشرات تستدعي مراجعة الجهة المختصة</p></div><button class="action-link" data-page="quality-notes">كل الملاحظات ←</button></div><div class="quality-priority"><span class="quality-alert-dot"></span><div><b>انخفاض إكمال مقرر الشبكات 101</b><small>الخرج · 61% · ملاحظة مفتوحة</small></div><button class="action-link" data-page="quality-notes">متابعة</button></div><div class="quality-priority"><span class="quality-alert-dot amber"></span><div><b>ارتفاع الرسوب في أساسيات البرمجة</b><small>الأفلاج · نجاح 68% · إجراء تصحيحي</small></div><button class="action-link" data-page="quality-results">تحليل النتائج</button></div><div class="quality-priority"><span class="quality-alert-dot"></span><div><b>مرفق ناقص في درس إدارة كلمات المرور</b><small>الأفلاج · مراجعة محتوى</small></div><button class="action-link" data-page="quality-content">مراجعة</button></div></section><section class="card"><div class="table-head"><div><h2 class="card-title">رضا المتدربين أسبوعيًا</h2><p class="card-subtitle">متوسط تقييم تجريبي من 5 · آخر 4 أسابيع</p></div><button class="action-link" data-page="quality-surveys">تفاصيل الاستبيانات ←</button></div><div class="quality-bars">${[['أسبوع 1',76],['أسبوع 2',81],['أسبوع 3',78],['أسبوع 4',82]].map(x=>`<div><span>${x[0]}</span><i><b style="width:${x[1]}%"></b></i><strong>${(x[1]/20).toFixed(1)}</strong></div>`).join('')}</div><p class="quality-insight">أكثر ملاحظة تكرارًا: الحاجة إلى أمثلة تطبيقية إضافية.</p></section></div>`+
    `<section class="card quality-recent"><div class="table-head"><div><h2 class="card-title">دورة الملاحظات النشطة</h2><p class="card-subtitle">من الرصد إلى الإغلاق مع توثيق كل انتقال</p></div><button class="btn" data-page="quality-notes">فتح سجل المتابعة</button></div>${caseCards(cases.filter(x=>x.stage<4).slice(0,2))}</section>`;
  const contentPage = () => heading('مراجعة المحتوى','فحص ملاءمة الدروس للمقرر وأهدافه ورصد النقص؛ لا يمكن تعديل المحتوى أو حذفه أو اعتماده من مساحة الجودة.', '<button class="btn primary" data-quality="new" data-kind="محتوى">+ تسجيل ملاحظة محتوى</button>') +
    `<div class="quality-scope-note">إجراء الجودة هنا: الاطلاع على النسخة المعروضة، تحديد الملاحظة، ورفع توصية لمالك المقرر. النشر والتعديل من مسؤولية الجهة المالكة.</div>${table(['المقرر','الدرس','الكلية','نتيجة المراجعة','مالك المحتوى','إجراء رقابي'],contentRows.map(r=>`<tr>${r.map(x=>`<td>${pill(x)}</td>`).join('')}<td><button class="action-link" data-quality="new" data-kind="محتوى" data-context="${esc(r[0]+' · '+r[1]+' · '+r[2])}">تسجيل ملاحظة</button></td></tr>`))}<section class="card quality-two-col"><div><h3>قائمة تحقق المراجعة</h3><p>ارتباط الدرس بالمقرر ونواتج التعلم</p><p>اكتمال الشرح والأنشطة والوسائط المشار إليها</p><p>ملاءمة مستوى المحتوى وتسلسل الموضوعات</p></div><div><h3>حدود الصلاحية</h3><p>عرض نسخة المحتوى وبيانات مالكه وحالة مراجعته.</p><p>رفع ملاحظة وتوصية ومتابعة معالجة الجهة المالكة.</p><p>لا تعديل مباشر، ولا حذف، ولا اعتماد/رفض للنشر.</p></div></section>`;
  const resultsPage = () => heading('نتائج المتدربين','تحليل توزيعات الدرجات ونسب النجاح والرسوب لرصد المقررات أو الأقسام التي تحتاج إلى تحسين؛ دون تعديل النتائج.', '') +
    `<div class="quality-filterbar"><label>الفترة <span class="quality-pill">الفصل الأول 1448هـ</span></label><label>الكلية <select data-quality-filter="results-college"><option value="" ${!resultsCollege?'selected':''}>كل الكليات</option><option value="الأفلاج" ${resultsCollege==='الأفلاج'?'selected':''}>الكلية التقنية بالأفلاج</option><option value="الخرج" ${resultsCollege==='الخرج'?'selected':''}>الكلية التقنية بالخرج</option></select></label><span>بيانات مجمعة تجريبية · ليست سجلات متدربين فردية</span></div><div class="kpis">${kpi('متوسط النجاح','80%','للمقررات المعروضة')}${kpi('مقررات تحت حد المراجعة','1','أقل من 70% نجاح',true)}${kpi('متوسط الإكمال','73%','في نطاق العينة')}${kpi('إجراءات تعديل درجات','غير متاح','صلاحية غير ممنوحة')}</div>`+
    table(['المقرر','الكلية والقسم','ناجحون','درجات متوسطة','متعثرون','قراءة الجودة','إجراء'],resultsRows.filter(r=>!resultsCollege||r[1].includes(resultsCollege)).map(r=>`<tr>${r.map((x,i)=>`<td>${i===5?pill(x):esc(x)}</td>`).join('')}<td><button class="action-link" data-quality="new" data-kind="نتائج" data-context="${esc(r[0]+' · '+r[1])}">رفع ملاحظة</button></td></tr>`)) + `<div class="notice quality-footnote">الأرقام مجمعة ومولدة للعرض فقط. الوصول إلى نتائج فعلية يتطلب نطاقًا معتمدًا وتقليل البيانات الشخصية إلى الحد اللازم.</div>`;
  const surveysPage = () => heading('الاستبيانات الأسبوعية','متابعة رضا المتدربين عن المحتوى والتجربة ورصد الأنماط المتكررة وإحالتها كتوصيات تحسين.', '<button class="btn" data-quality="new" data-kind="استبيان">+ ملاحظة من استبيان</button>') +
    `<div class="kpis">${kpi('متوسط الرضا','4.1 / 5','آخر دورة أسبوعية')}${kpi('معدل الاستجابة','71%','من العينة التجريبية')}${kpi('ملاحظات متكررة','4','تحتاج تحليلًا')}${kpi('التوصيات المفتوحة','2','مرتبطة بنتائج استبيان')}</div>${table(['الكلية','المحور','التقييم','الاستجابة','ملاحظة متكررة','المتابعة'],surveyRows.map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join('')}<td><button class="action-link" data-quality="new" data-kind="استبيان" data-context="${esc(r[0]+' · '+r[1]+' · '+r[4])}">تسجيل توصية</button></td></tr>`))}<section class="card quality-two-col"><div><h3>أنماط تستحق المتابعة</h3><p>زيادة الأمثلة التطبيقية في موضوعات البرمجة والشبكات.</p><p>تحسين توقيت إتاحة المرفقات قبل المحاضرة.</p><p>الحفاظ على وضوح الشرح والتفاعل الإيجابي.</p></div><div><h3>خصوصية الاستبيانات</h3><p>تعرض المؤشرات مجمعة حسب الكلية والمحور.</p><p>لا تعرض إجابات أو هوية متدرب بعينه في واجهة الجودة.</p><p>يُراجع اعتماد المنهجية وفترة الاحتفاظ قبل التشغيل الفعلي.</p></div></section>`;
  const institutionsPage = () => heading('تقارير الكليات والأقسام','مقارنة مؤشرات الالتزام والإكمال والنجاح والرضا لاكتشاف الانخفاضات ورفع التوصيات للجهات المسؤولة.', '') +
    `<div class="quality-filterbar"><label>نطاق العرض <select data-quality-filter="institution-college"><option value="" ${!institutionCollege?'selected':''}>منطقة الرياض · كل الكليات</option><option value="الأفلاج" ${institutionCollege==='الأفلاج'?'selected':''}>الكلية التقنية بالأفلاج</option><option value="الخرج" ${institutionCollege==='الخرج'?'selected':''}>الكلية التقنية بالخرج</option><option value="وادي الدواسر" ${institutionCollege==='وادي الدواسر'?'selected':''}>وادي الدواسر</option><option value="المزاحمية" ${institutionCollege==='المزاحمية'?'selected':''}>المزاحمية</option></select></label><span>المقارنة للمتابعة الرقابية فقط ولا تنفذ تغييرات نيابة عن الكلية.</span></div>${table(['الكلية','ملاحظات مفتوحة','إكمال التدريب','نسبة النجاح','رضا المتدربين','متابعة'],collegeStats.filter(r=>!institutionCollege||r[0].includes(institutionCollege)).map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join('')}<td><button class="action-link" data-quality="new" data-kind="التزام كلية" data-context="${esc(r[0]+' · مؤشرات الإكمال والنجاح والرضا')}">رفع توصية</button></td></tr>`))}<section class="card quality-two-col"><div><h3>مؤشرات الالتزام</h3><p>انخفاض الإكمال لأسبوعين متتاليين يستدعي مراجعة السبب مع القسم.</p><p>تكرار الملاحظة في أكثر من شعبة يرفع أولوية المتابعة.</p></div><div><h3>مسار التصعيد</h3><p>ملاحظة الجودة ← توصية للعميد/رئيس القسم ← إجراء تصحيحي موثق.</p><p>متابعة الموعد والأثر ثم إغلاق الملاحظة أو إعادة فتحها.</p></div></section>`;
  const newForm = () => `<form class="card quality-new-form" id="quality-new-form"><h2 class="card-title">تسجيل ملاحظة جودة تجريبية</h2><p class="card-subtitle">ستبقى في جلسة المتصفح الحالية، ولن تغيّر أي سجل أكاديمي أو محتوى.</p><div class="quality-form-grid"><label>عنوان الملاحظة<input name="title" required maxlength="120" placeholder="مثال: انخفاض إكمال مقرر…"></label><label>التصنيف<select name="kind"><option>محتوى</option><option>نتائج</option><option>استبيان</option><option>التزام كلية</option><option>مؤشر أداء</option></select></label><label>الكلية / القسم<input name="scope" required maxlength="100" placeholder="الكلية والقسم"></label><label>الجهة المقترح متابعتها<input name="owner" maxlength="80" value="رئيس القسم المختص"></label><label class="wide">الملاحظة والأدلة المختصرة<textarea name="detail" required maxlength="500" rows="3" placeholder="صف المؤشر أو الملاحظة دون بيانات شخصية للمتدربين"></textarea></label><label>تاريخ المتابعة<input name="due" type="date"></label></div><div class="quality-form-actions"><button class="btn primary" type="submit">حفظ الملاحظة في الجلسة</button><button class="btn" type="button" data-quality="cancel-new">إلغاء</button></div></form>`;
  const notesPage = () => heading('ملاحظات الجودة','مسار عمل واضح من الرصد إلى التوصية والإجراء التصحيحي والمتابعة ثم الإغلاق.', '<button class="btn primary" data-quality="new">+ تسجيل ملاحظة</button>') +
    `<div class="quality-workflow-banner">${stages.map((s,i)=>`<span><i>${i+1}</i>${s}</span>`).join('<b>←</b>')}</div>${newForm()}<div class="quality-case-tools"><input id="quality-case-search" placeholder="ابحث بالكلية أو المقرر أو عنوان الملاحظة…"><select id="quality-stage-filter"><option value="">كل الحالات</option>${stages.map((x,i)=>`<option value="${i}">${x}</option>`).join('')}</select></div><div id="quality-case-list">${caseCards()}</div><div class="notice">كل انتقال يسجل في سجل التدقيق التجريبي. الإغلاق لا يعني تعديلًا تلقائيًا في المحتوى أو الدرجات أو الحضور.</div>`;
  const auditPage = () => heading('سجل التدقيق','قراءة زمنية للأحداث ومراحل المعالجة. سجل العرض تجريبي داخل الذاكرة وليس سجلًا خادميًا غير قابل للتغيير.', '') +
    `<div class="quality-scope-note">سجل الإنتاج يجب أن يكون خادميًا، مؤرخًا، منسوبًا لهوية موثقة، وغير قابل للتعديل من دور الجودة.</div>${table(['الوقت','المنفذ','الحدث','النطاق'],audit.map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`))}<section class="card quality-two-col"><div><h3>ما الذي يجب تدقيقه في المنتج؟</h3><p>تسجيل الملاحظة والتوصية والجهة المسؤولة والموعد.</p><p>كل تغيير في الحالة مع الفاعل والوقت والسبب.</p><p>ربط الإجراء التصحيحي بالدليل ونتيجة التحقق.</p></div><div><h3>حدود العرض الحالي</h3><p>الأحداث ثابتة أو مولدة داخل ذاكرة الصفحة.</p><p>لا يوجد دخول موثق أو ختم زمني موثوق.</p><p>لا تُستخدم بيانات حقيقية أو نتائج تشغيلية.</p></div></section>`;
  const pageFor = page => ({dashboard, 'quality-content':contentPage, 'quality-results':resultsPage, 'quality-surveys':surveysPage, 'quality-institutions':institutionsPage, 'quality-notes':notesPage, 'quality-audit':auditPage}[page] || dashboard)();
  function setQualityNav() {
    const nav = document.getElementById('main-nav');
    nav.innerHTML = `<p class="nav-label">الجودة والرقابة التدريبية</p>${menu.map(([p,i,t])=>`<button class="nav-item" data-page="${p}">${i} <span>${t}</span></button>`).join('')}`;
    document.querySelector('.brand small').textContent = 'مراجعة الجودة';
    document.querySelector('.sidebar-foot').innerHTML = '<span class="pulse"></span> صلاحيات رقابية · بيانات تجريبية';
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === state.page));
  }
  function renderQuality() {
    if (selector.value !== role) { if (String(state.page).startsWith('quality-')) state.page='dashboard'; baseRender(); return; }
    setQualityNav();
    if (!menu.some(([p])=>p===state.page)) state.page='dashboard';
    root.innerHTML = `<div class="quality-workspace">${pageFor(state.page)}</div>`;
    if (state.page==='quality-notes') mountCaseFilters();
    root.querySelector('[data-quality-filter="results-college"]')?.addEventListener('change', event => { resultsCollege=event.target.value; renderQuality(); });
    root.querySelector('[data-quality-filter="institution-college"]')?.addEventListener('change', event => { institutionCollege=event.target.value; renderQuality(); });
  }
  function mountCaseFilters() {
    const apply = () => {
      const query = (document.getElementById('quality-case-search')?.value || '').trim().toLowerCase();
      const stage = document.getElementById('quality-stage-filter')?.value || '';
      const visible = cases.filter(c => (!stage || String(c.stage)===stage) && (!query || `${c.title} ${c.college} ${c.department} ${c.course} ${c.id} ${c.detail}`.toLowerCase().includes(query)));
      document.getElementById('quality-case-list').innerHTML = caseCards(visible) || '<div class="card empty">لا توجد ملاحظات مطابقة.</div>';
    };
    document.getElementById('quality-case-search').addEventListener('input', apply);
    document.getElementById('quality-stage-filter').addEventListener('change', apply);
  }
  render = renderQuality;
  selector.addEventListener('change', () => { if (selector.value===role) { state.page='dashboard'; renderQuality(); } });
  document.addEventListener('click', event => {
    const button=event.target.closest('[data-quality]'); if(!button || selector.value!==role) return;
    const action=button.dataset.quality;
    if(action==='new') { state.page='quality-notes'; renderQuality(); const form=document.getElementById('quality-new-form'); form?.scrollIntoView({behavior:'smooth',block:'center'}); if(button.dataset.kind) form.elements.kind.value=button.dataset.kind; if(button.dataset.context) form.elements.title.value=`مراجعة: ${button.dataset.context}`; form?.elements.title.focus(); }
    else if(action==='cancel-new') { document.getElementById('quality-new-form')?.reset(); }
    else if(action==='advance') { const item=cases.find(x=>x.id===button.dataset.id); if(item && item.stage<stages.length-1) { item.stage++; audit.unshift(['الآن','هدى الحربي',`نقل إلى «${stages[item.stage]}»`,`${item.id} · ${item.course}`]); renderQuality(); toast(`تم تسجيل «${stages[item.stage]}» في سجل العرض التجريبي.`,true); } }
  });
  document.addEventListener('submit', event => {
    if(event.target.id!=='quality-new-form' || selector.value!==role) return;
    event.preventDefault(); const data=new FormData(event.target); const due=data.get('due') ? new Date(data.get('due')).toLocaleDateString('ar-SA') : 'غير محدد';
    const item={id:`Q-${105+cases.length}`,title:String(data.get('title')).trim(),college:String(data.get('scope')).trim(),department:'نطاق المراجعة',course:'—',kind:String(data.get('kind')),owner:String(data.get('owner')||'الجهة المختصة'),stage:0,due,detail:String(data.get('detail')).trim()};
    cases.unshift(item); audit.unshift(['الآن','هدى الحربي','تسجيل ملاحظة جودة',`${item.id} · ${item.title}`]); event.target.reset(); renderQuality(); toast('أضيفت الملاحظة إلى جلسة العرض فقط.',true);
  });
  renderQuality();
})();
