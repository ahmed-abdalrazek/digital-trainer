// Enhances the static demo with client-side role views and the interactive map.
state.role = document.getElementById('role-switcher').value || 'مدير إدارة المنطقة';
roleDashboard = function () {
  const role = document.getElementById('role-switcher').value || 'مدير إدارة المنطقة';
  state.role = role;
  const profile = roleProfiles[role];
  const kpis = `<div class="kpis">${profile.kpis.map(item => kpi(...item)).join('')}</div>`;
  const hero = `<section class="role-hero"><span>لوحة ${role}</span><h2>${profile.scope}</h2><p>${profile.summary}</p></section>`;
  const vision = `<section class="vision-banner" aria-label="رسالة المدرب الرقمي"><div class="vision-step"><span class="vision-icon" aria-hidden="true">⚙</span><strong>نتدرب لنتعلم</strong></div><i class="vision-divider" aria-hidden="true"></i><div class="vision-step gold"><span class="vision-icon bulb-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M10 23c0-2.7-4-5-4-10a10 10 0 1 1 20 0c0 5-4 7.3-4 10"/><path d="M11 24h10M12 28h8M14 31h4M16 1v3M3 13h3M26 13h3M6.5 4.5l2.3 2.3M25.5 4.5l-2.3 2.3"/></svg></span><strong>ونتعلم لنتميز</strong></div><i class="vision-divider" aria-hidden="true"></i><div class="vision-step"><span class="vision-icon" aria-hidden="true">◎</span><strong>ونتميز لنحقق</strong></div></section>`;
  const roleViews = {
    'المدرب': `<div class="role-work-grid"><section class="card"><h2 class="card-title">الشعب المكلف بها</h2><p class="card-subtitle">الفصل التدريبي الأول · بيانات تجريبية</p><div class="setting-row"><div><strong>الشبكات 101 · شعبة 341</strong><p>28 متدربًا · المحاضرة القادمة الأحد 10:00</p></div>${status('نشط')}</div><div class="setting-row"><div><strong>مبادئ الأمن السيبراني · شعبة 221</strong><p>30 متدربًا · المحاضرة القادمة الثلاثاء 12:00</p></div>${status('نشط')}</div><button class="btn" data-go="courses">فتح المقررات</button></section><section class="card"><h2 class="card-title">مهام تحتاج إجراء</h2><p>• 8 إجابات اختبار تحتاج مراجعة.</p><p>• درس «إدارة كلمات المرور» بانتظار تجهيز المحتوى.</p><button class="btn primary" data-go="content">إدارة المحتوى</button></section></div>`,
    'المتدرب': `<div class="role-work-grid"><section class="card"><h2 class="card-title">جدولي القادم</h2><p class="card-subtitle">مواعيدك الشخصية · بيانات تجريبية</p><div class="setting-row"><div><strong>الشبكات 101</strong><p>الأحد · 10:00 ص · شعبة 341</p></div>${status('قادم')}</div><div class="setting-row"><div><strong>أساسيات البرمجة</strong><p>الاثنين · 11:00 ص · شعبة 122</p></div>${status('قادم')}</div><div class="setting-row"><div><strong>مبادئ الأمن السيبراني</strong><p>الثلاثاء · 12:00 م · شعبة 221</p></div>${status('قادم')}</div></section><section class="card"><h2 class="card-title">متابعة تعلمي</h2><p class="card-subtitle">تقدم شخصي، لا يعرض بيانات المتدربين الآخرين</p>${[['الشبكات 101',82],['أساسيات البرمجة',74],['الأمن السيبراني',91]].map(x=>`<div class="progress-row"><span>${x[0]}</span><div class="progress"><i style="width:${x[1]}%"></i></div><b>${x[1]}%</b></div>`).join('')}<button class="btn primary" data-go="courses">متابعة المقررات</button></section></div>`,
    'إدارة الجودة التدريبية': `<div class="role-work-grid"><section class="card"><h2 class="card-title">قائمة المراجعة</h2><p class="card-subtitle">عناصر تنتظر تدقيق الجودة</p><div class="setting-row"><div><strong>المتغيرات وأنواع البيانات</strong><p>أساسيات البرمجة · أضيف اليوم</p></div>${status('قيد المراجعة')}</div><div class="setting-row"><div><strong>إدارة كلمات المرور</strong><p>مبادئ الأمن السيبراني · ملاحظة مفتوحة</p></div>${status('قيد المراجعة')}</div><button class="btn primary" data-go="content">مراجعة المحتوى</button></section><section class="card"><h2 class="card-title">آخر أحداث التدقيق</h2><p>08:45 · إضافة ملاحظة جودة</p><p>08:18 · طلب اعتماد محتوى</p><p>أمس 14:22 · تحديث تكليف شعبة</p><button class="btn" data-go="quality">فتح سجل التدقيق</button></section></div>`,
  };
  const chart = `<div class="grid-2"><section class="card"><h2 class="card-title">تنفيذ المحاضرات والحضور</h2><p class="card-subtitle">آخر 6 أسابيع — بيانات تجريبية</p><div class="chart">${[['أ1',58,77],['أ2',64,81],['أ3',70,84],['أ4',63,79],['أ5',77,87],['أ6',82,91]].map(x=>`<div class="bar-group"><div class="bar" style="height:${x[1]}%"></div><div class="bar light" style="height:${x[2]}%"></div><small>${x[0]}</small></div>`).join('')}</div><div class="legend"><i class="dot"></i> المحاضرات المنفذة <i class="dot light"></i> نسبة الحضور</div></section><section class="card"><h2 class="card-title">تنبيهات تحتاج متابعة</h2><p>• 3 متدربين تجاوزوا حد التأخر في شعبة 341.</p><p>• درس واحد بانتظار اعتماد الجودة.</p><button class="btn" data-go="quality">فتح سجل الجودة</button></section></div>`;
  const networkRoles = ['مدير إدارة المنطقة','نائب المحافظ للتدريب','مشرف الكليات التقنية','عميد المنشأة/الكلية','رئيس القسم/مشرف القسم'];
  const network = `<div class="map-full-width">${saudiNetworkMap()}</div>`;
  const personalized = roleViews[role] || chart;
  return heading('dashboard', `<button class="btn primary" data-action="new">+ إجراء تجريبي</button>`) + (networkRoles.includes(role) ? network : '') + (networkRoles.includes(role) ? vision : '') + hero + kpis + personalized + (roleViews[role] ? chart : '');
};
dashboard = () => {
  state.role = document.getElementById('role-switcher').value || state.role || 'مدير إدارة المنطقة';
  return roleDashboard();
};
render();

document.getElementById('role-switcher').addEventListener('change', (event) => {
  state.role = event.target.value;
  document.getElementById('active-role-label').textContent = state.role;
  state.page = 'dashboard';
  render();
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
  toast(`تم تبديل العرض إلى دور «${state.role}»`, true);
});

document.addEventListener('click', (event) => {
  const point = event.target.closest('[data-location]');
  if (!point) return;
  const location = point.dataset.location;
  const descriptions = {
    الرياض: 'نقطة الربط الرئيسية — 6 منشآت في نطاق العرض.',
    الأفلاج: 'الكلية التقنية بالأفلاج — 684 متدربًا تجريبيًا.',
    الخرج: 'الكلية التقنية بالخرج — 412 متدربًا تجريبيًا.',
    'وادي الدواسر': 'المعهد الصناعي بوادي الدواسر — حالة متابعة.',
    المزاحمية: 'الكلية التقنية بالمزاحمية — قيد التجهيز.',
    'المنطقة الشرقية': 'نقطة توضيحية خارج نطاق العرض.'
  };
  const insight = document.getElementById('map-insight');
  if (insight) insight.innerHTML = `<strong>${location}</strong><span>${descriptions[location] || 'نقطة اتصال تجريبية.'}</span>`;
});

function makeMapPointsAccessible() {
  document.querySelectorAll('.map-location').forEach((point) => {
    point.setAttribute('role', 'button');
    point.setAttribute('tabindex', '0');
    point.setAttribute('aria-label', `عرض منشأة ${point.dataset.location}`);
    point.onclick = () => {
      const location = point.dataset.location;
      const descriptions = {
        الرياض: 'نقطة الربط الرئيسية — 6 منشآت في نطاق العرض.',
        الأفلاج: 'الكلية التقنية بالأفلاج — 684 متدربًا تجريبيًا.',
        الخرج: 'الكلية التقنية بالخرج — 412 متدربًا تجريبيًا.',
        'وادي الدواسر': 'المعهد الصناعي بوادي الدواسر — حالة متابعة.',
        المزاحمية: 'الكلية التقنية بالمزاحمية — قيد التجهيز.',
        'المنطقة الشرقية': 'نقطة توضيحية خارج نطاق العرض.'
      };
      const insight = document.getElementById('map-insight');
      if (insight) insight.innerHTML = `<strong>${location}</strong><span>${descriptions[location] || 'نقطة اتصال تجريبية.'}</span>`;
    };
  });
  const map = document.querySelector('.map-panel');
  if (!map) return;
  const svg = map.querySelector('.saudi-map');
  if (!svg) return;
  const svgRect = svg.getBoundingClientRect();
  const panelRect = map.getBoundingClientRect();
  if (!svgRect.width || !svgRect.height || !panelRect.width || !panelRect.height) return;
  const scale = Math.min(svgRect.width / 700, svgRect.height / 520);
  const padX = (svgRect.width - 700 * scale) / 2;
  const padY = (svgRect.height - 520 * scale) / 2;
  const locations = [
    ['الأفلاج',422,322],['وادي الدواسر',340,397],['المزاحمية',382,252],
    ['الخرج',422,262],['الرياض',402,244],['المنطقة الشرقية',514,189]
  ];
  locations.forEach(([name,x,y]) => {
    let hit = map.querySelector(`[data-map-hit="${name}"]`);
    if (!hit) {
      hit = document.createElement('button');
      hit.type = 'button';
      hit.className = 'map-hit';
      hit.dataset.mapHit = name;
      hit.dataset.location = name;
      hit.setAttribute('aria-label', `عرض ${name} على الخريطة`);
      map.append(hit);
    }
    const localX = svgRect.left - panelRect.left + padX + x * scale;
    const localY = svgRect.top - panelRect.top + padY + y * scale;
    hit.style.left = `${localX / panelRect.width * 100}%`;
    hit.style.top = `${localY / panelRect.height * 100}%`;
  });
}
makeMapPointsAccessible();
new MutationObserver(makeMapPointsAccessible).observe(document.getElementById('app'), {childList:true,subtree:true});
window.addEventListener('resize', makeMapPointsAccessible);
document.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('.map-location')) {
    event.preventDefault();
    event.target.closest('.map-location').dispatchEvent(new MouseEvent('click', {bubbles:true}));
  }
});
