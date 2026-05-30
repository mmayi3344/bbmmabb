// ==================== DATA ====================
const DATA_VERSION = 1;
const STORAGE_KEY = 'pwa_mom_baby_data';

// ==================== UTILITY ====================
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function loadData(){
  const defaults = {
    appTitle: '孕宝助手',
    dueDate: null,
    kickLog: [],
    pregWeights: [],
    appointments: [],
    feedSessions: [],
    diapers: [],
    growth: [],
    sleep: [],
    vaccines: [],
    notes: [],
    checkupRecords: [],
    hospitalBag: [],
    feedState: { left: {running:false,start:null,elapsed:0}, right: {running:false,start:null,elapsed:0} },
    kickState: { episodes:0, clicks:0, start:null, lastKickTime:0, window:3 }
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Future: migrate older data versions here.
      return Object.assign({}, defaults, parsed);
    }
  } catch (e) {
    console.warn("[Data] Failed to load, using defaults:", e);
  }
  return defaults;
}

function saveData(data){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[Data] Failed to save:", e);
  }
}

let D = loadData();

// ==================== DUE DATE ====================
function setDueDate(){
  const val = document.getElementById('dueDateInput').value;
  if(!val) return;
  D.dueDate = val;
  saveData(D);
  document.getElementById('setupCard').style.display = 'none';
  renderAll();
}

function editDueDate(){
  document.getElementById('setupCard').style.display = '';
  if(D.dueDate) document.getElementById('dueDateInput').value = D.dueDate;
}

// ==================== WEEK INFO ====================
function getPregnancyInfo(){
  if(!D.dueDate) return null;
  const due = new Date(D.dueDate + 'T00:00:00');
  const now = new Date();
  const conceived = new Date(due);
  conceived.setDate(conceived.getDate() - 280);
  const diffDays = Math.floor((now - conceived) / (1000*60*60*24));
  const week = Math.max(1, Math.min(40, Math.floor(diffDays / 7)));
  const dayInWeek = diffDays % 7;
  const daysLeft = Math.max(0, Math.floor((due - now) / (1000*60*60*24)));
  const trimester = week <= 13 ? '孕早期' : week <= 27 ? '孕中期' : '孕晚期';
  return {week, dayInWeek, daysLeft, trimester, dueDate: D.dueDate};
}

function getCheckupInterval(){
  const records = D.checkupRecords || [];
  if(records.length === 0) return {latest: null, days: 0};
  // 找最新一次产检
  let latest = records[0];
  for(let i = 1; i < records.length; i++){
    if(records[i].date > latest.date) latest = records[i];
  }
  const now = new Date();
  const checkupDate = new Date(latest.date + 'T00:00:00');
  const days = Math.floor((now - checkupDate) / (1000*60*60*24));
  return {latest, days};
}

const weekTips = {
  1: '恭喜怀孕！虽然是第一周，但身体已经在为孕育宝宝做准备了。开始补充叶酸吧。',
  4: '胚胎已经着床啦！可能会有些轻微的着床出血。保持心情愉快很重要。',
  8: '宝宝现在约有葡萄大小，心脏已经开始跳动了！本周可能有早孕反应，少食多餐能缓解。',
  10: '宝宝所有重要器官都已形成。你可能还会感到疲劳，多休息。',
  12: '早孕期快结束了！宝宝手指脚趾已经分开，开始会动了（你还感觉不到）。',
  13: '进入孕中期！很多妈妈发现精力开始恢复。宝宝现在能皱眉、做表情了。',
  16: '可能很快会感受到第一次胎动了！像蝴蝶在扇翅膀。宝宝能听到你的声音了。',
  20: '孕期过半！宝宝现在很活跃。本周可以做B超大排畸检查。别忘了补充钙和铁。',
  24: '宝宝在快速增重。你可能会感到背部酸痛，试试孕妇瑜伽或温水浴。',
  25: '宝宝开始有规律的睡眠周期。记得数胎动——每天固定时间，感受宝宝的节奏。',
  28: '进入孕晚期！从现在开始每天数胎动。宝宝能睁眼了，对光线有反应。',
  30: '宝宝大脑快速发育中。可能会有些烧心和呼吸困难，这是子宫上移的正常现象。',
  32: '宝宝通常已经头朝下了。开始准备待产包吧！',
  34: '宝宝肺部已基本成熟。每周增重约200g。注意观察是否有早产迹象。',
  36: '宝宝已经足月！随时可能发动。多休息，保持体力。你已经很棒了！',
  37: '官方足月！宝宝随时可能出生。检查待产包，确认医院路线。',
  38: '宝宝的头已经入盆了！可能会感觉呼吸顺畅了一些。',
  39: '就快见面了！注意宫缩模式。任何时间都可能是大日子。',
  40: '预产期到了！只有约5%的宝宝在预产期当天出生。宝宝会选好自己的时间。'
};

function getTip(week){
  return weekTips[week] || '每个阶段都值得珍惜。照顾好自己，聆听身体的声音。';
}

// ==================== TIMERS ====================
let feedTimers = {left:null, right:null};
let kickTimerInterval = null;

function toggleFeed(side){
  const state = D.feedState[side];
  if(!state.running){
    // Start
    state.running = true;
    state.start = Date.now();
    state.elapsed = 0;
    saveData(D);
    startFeedTimer(side);
  } else {
    // Stop
    state.running = false;
    const duration = Math.floor((Date.now() - state.start) / 1000);
    D.feedSessions.unshift({
      side,
      start: new Date(state.start).toISOString(),
      duration,
      time: new Date().toLocaleString('zh-CN')
    });
    state.elapsed = 0;
    state.start = null;
    if(D.feedSessions.length > 50) D.feedSessions.length = 50;
    saveData(D);
    stopFeedTimer(side);
    renderBaby();
  }
}

function startFeedTimer(side){
  const el = document.getElementById('feed' + (side==='left'?'Left':'Right') + 'Time');
  const btn = document.getElementById('feed' + (side==='left'?'Left':'Right'));
  btn.classList.add('running');
  feedTimers[side] = setInterval(() => {
    const elapsed = Math.floor((Date.now() - D.feedState[side].start) / 1000);
    const m = String(Math.floor(elapsed/60)).padStart(2,'0');
    const s = String(elapsed%60).padStart(2,'0');
    el.textContent = m + ':' + s;
  }, 200);
}

function stopFeedTimer(side){
  clearInterval(feedTimers[side]);
  const el = document.getElementById('feed' + (side==='left'?'Left':'Right') + 'Time');
  const btn = document.getElementById('feed' + (side==='left'?'Left':'Right'));
  btn.classList.remove('running');
  el.textContent = '00:00';
}

// ==================== KICK COUNTER ====================
function setKickWindow(minutes, el){
  D.kickState.window = minutes;
  saveData(D);
  document.querySelectorAll('.window-opt').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('kickWindowLabel').textContent = minutes+'分钟内多次=1次有效';
}

function countKick(){
  const now = Date.now();
  if(!D.kickState.start){
    D.kickState.start = now;
    D.kickState.episodes = 0;
    D.kickState.clicks = 0;
    D.kickState.lastKickTime = 0;
    saveData(D);
    startKickTimer();
  }
  D.kickState.clicks++;
  const windowMs = D.kickState.window * 60 * 1000;
  // New episode if first kick, or if outside the merge window
  if(D.kickState.lastKickTime === 0 || (now - D.kickState.lastKickTime) >= windowMs){
    D.kickState.episodes++;
    D.kickState.lastKickTime = now;
  }

  saveData(D);
  document.getElementById('kickEpisodes').textContent = D.kickState.episodes;
  document.getElementById('kickClickCount').textContent = D.kickState.clicks;
  updateKickStatus();
}

function updateKickStatus(){
  const e = D.kickState.episodes;
  const el = document.getElementById('kickStatus');
  if(e === 0) el.textContent = '点击按钮开始计数';
  else if(e < 3) el.textContent = '继续数，宝宝在动呢~';
  else if(e < 5) el.textContent = '宝宝挺活跃的！';
  else if(e < 8) el.textContent = '宝宝今天心情不错！';
  else if(e < 10) el.textContent = '快达标了，加油观察！';
  else el.textContent = '🎉 有效胎动达标，宝宝很健康！';
}

function startKickTimer(){
  kickTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - D.kickState.start) / 1000);
    const h = String(Math.floor(elapsed/3600)).padStart(2,'0');
    const m = String(Math.floor((elapsed%3600)/60)).padStart(2,'0');
    const s = String(elapsed%60).padStart(2,'0');
    document.getElementById('kickTimer').textContent = h + ':' + m + ':' + s;
  }, 500);
}

function endKickSession(){
  if(!D.kickState.start || D.kickState.episodes === 0){
    resetKickCounter();
    return;
  }
  const now = Date.now();
  const duration = Math.floor((now - D.kickState.start) / 1000);
  D.kickLog.unshift({
    date: new Date().toLocaleDateString('zh-CN'),
    startTime: new Date(D.kickState.start).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),
    endTime: new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),
    episodes: D.kickState.episodes,
    clicks: D.kickState.clicks,
    duration: duration,
    window: D.kickState.window
  });
  if(D.kickLog.length > 100) D.kickLog.length = 100;
  resetKickCounter();
  saveData(D);
  renderPregnancy();
}

function resetKickCounter(){
  const w = D.kickState.window;
  D.kickState = { episodes:0, clicks:0, start:null, lastKickTime:0, window: w };
  saveData(D);
  clearInterval(kickTimerInterval);
  document.getElementById('kickEpisodes').textContent = '0';
  document.getElementById('kickClickCount').textContent = '0';
  document.getElementById('kickTimer').textContent = '00:00:00';
  document.getElementById('kickStatus').textContent = '点击按钮开始计数';
}

function deleteKickLog(idx){
  D.kickLog.splice(idx,1);
  saveData(D);
  renderPregnancy();
}

// Generic clear & delete helpers
function clearAll(type){
  if(!confirm('确定要清空全部记录吗？此操作不可恢复。')) return;
  const keys = {
    pregWeights:'孕期体重', kickLog:'胎动', appointments:'产检',
    feedSessions:'哺乳', diapers:'尿布', growth:'生长', sleep:'睡眠', notes:'笔记', checkupRecords:'产检记录', hospitalBag:'待产包'
  };
  D[type] = [];
  saveData(D);
  if(type==='pregWeights'||type==='kickLog'||type==='appointments'||type==='checkupRecords'){ renderPregnancy(); drawWeightChart(); }
  else if(type==='feedSessions'||type==='diapers'||type==='growth'||type==='sleep') renderBaby();
  else if(type==='hospitalBag') renderHospitalBag();
  else renderNotes();
}
function deletePregWeight(i){D.pregWeights.splice(i,1);saveData(D);renderPregnancy();drawWeightChart();}
function deleteApt(i){D.appointments.splice(i,1);saveData(D);renderPregnancy();}
function deleteFeed(i){D.feedSessions.splice(i,1);saveData(D);renderBaby();}
function deleteDiaper(i){D.diapers.splice(i,1);saveData(D);renderBaby();}
function deleteGrowth(i){D.growth.splice(i,1);saveData(D);renderBaby();}
function deleteSleep(i){D.sleep.splice(i,1);saveData(D);renderBaby();}
function clearKickHistory(){D.kickLog=[];saveData(D);renderPregnancy();}

// ==================== LOGGING ====================
function logPregWeight(){
  const w = parseFloat(document.getElementById('pregWeight').value);
  if(!w || w <= 0) return;
  D.pregWeights.unshift({date:new Date().toLocaleDateString('zh-CN'), weight:w});
  if(D.pregWeights.length > 100) D.pregWeights.length = 100;
  saveData(D);
  document.getElementById('pregWeight').value = '';
  renderPregnancy();
  drawWeightChart();
}

function addApt(){
  const name = document.getElementById('aptName').value.trim();
  const date = document.getElementById('aptDate').value;
  if(!name || !date) return;
  D.appointments.unshift({name, date, done:false});
  D.appointments.sort((a,b) => a.date.localeCompare(b.date));
  saveData(D);
  document.getElementById('aptName').value = '';
  document.getElementById('aptDate').value = '';
  renderPregnancy();
}

function toggleApt(idx){
  D.appointments[idx].done = !D.appointments[idx].done;
  saveData(D);
  renderPregnancy();
}

function logDiaper(type){
  D.diapers.unshift({time:new Date().toLocaleString('zh-CN'), type});
  if(D.diapers.length > 100) D.diapers.length = 100;
  saveData(D);
  renderBaby();
}

function logGrowth(){
  const w = parseFloat(document.getElementById('babyWeight').value);
  const h = parseFloat(document.getElementById('babyHeight').value);
  const d = document.getElementById('growthDate').value || new Date().toISOString().split('T')[0];
  if(!w && !h) return;
  D.growth.unshift({date:d, weight:w||null, height:h||null});
  D.growth.sort((a,b) => b.date.localeCompare(a.date));
  if(D.growth.length > 100) D.growth.length = 100;
  saveData(D);
  document.getElementById('babyWeight').value = '';
  document.getElementById('babyHeight').value = '';
  renderBaby();
}

function logSleep(){
  const h = parseFloat(document.getElementById('sleepHours').value);
  if(!h || h <= 0) return;
  D.sleep.unshift({date:new Date().toLocaleDateString('zh-CN'), hours:h});
  if(D.sleep.length > 100) D.sleep.length = 100;
  saveData(D);
  document.getElementById('sleepHours').value = '';
  renderBaby();
}

function addNote(){
  const text = document.getElementById('noteInput').value.trim();
  if(!text) return;
  D.notes.unshift({time:new Date().toLocaleString('zh-CN'), text});
  if(D.notes.length > 200) D.notes.length = 200;
  saveData(D);
  document.getElementById('noteInput').value = '';
  renderNotes();
}

function toggleVaccine(id){
  const idx = D.vaccines.findIndex(v => v.id === id);
  if(idx >= 0){
    D.vaccines[idx].done = !D.vaccines[idx].done;
  } else {
    D.vaccines.push({id, done:true});
  }
  saveData(D);
  renderVaccine();
}

// ==================== CHECKUP RECORDS ====================
let _editingCheckupIdx = -1;

function addCheckupRecord(){
  const date = document.getElementById('checkupDate').value;
  const item = document.getElementById('checkupItem').value.trim();
  if(!date || !item) return;
  const fileInput = document.getElementById('checkupImage');
  const file = fileInput.files[0];

  function saveRecord(record){
    if(_editingCheckupIdx >= 0){
      D.checkupRecords[_editingCheckupIdx] = record;
      cancelCheckupEdit();
    } else {
      D.checkupRecords.unshift(record);
      if(D.checkupRecords.length > 50) D.checkupRecords.length = 50;
    }
    saveData(D);
    document.getElementById('checkupItem').value = '';
    fileInput.value = '';
    renderPregnancy();
  }

  if(!file){
    saveRecord({date, item, image:(_editingCheckupIdx>=0?D.checkupRecords[_editingCheckupIdx].image:null)});
    return;
  }
  if(file.size > 5 * 1024 * 1024){
    alert('图片太大，请上传小于 5MB 的图片');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e){
    saveRecord({date, item, image:e.target.result});
  };
  reader.readAsDataURL(file);
}

function editCheckupRecord(idx){
  const r = D.checkupRecords[idx];
  document.getElementById('checkupDate').value = r.date;
  document.getElementById('checkupItem').value = r.item;
  document.getElementById('checkupImage').value = '';
  _editingCheckupIdx = idx;
  document.getElementById('checkupSaveBtn').textContent = '✏️ 保存修改';
  document.getElementById('checkupCancelBtn').style.display = '';
  window.scrollTo({top: document.getElementById('checkupCard').offsetTop - 80, behavior: 'smooth'});
}

function cancelCheckupEdit(){
  _editingCheckupIdx = -1;
  document.getElementById('checkupDate').value = '';
  document.getElementById('checkupItem').value = '';
  document.getElementById('checkupImage').value = '';
  document.getElementById('checkupSaveBtn').textContent = '📝 保存';
  document.getElementById('checkupCancelBtn').style.display = 'none';
}

function deleteCheckupRecord(idx){
  D.checkupRecords.splice(idx,1);
  saveData(D);
  renderPregnancy();
}

function openCheckupImage(src){
  const modal = document.getElementById('imageModal');
  document.getElementById('modalImage').src = src;
  modal.style.display = 'flex';
}

function closeModal(){
  document.getElementById('imageModal').style.display = 'none';
}

// ==================== HOSPITAL BAG ====================
function addBagItem(){
  const name = document.getElementById('bagItemName').value.trim();
  const qty = parseInt(document.getElementById('bagItemQty').value) || 1;
  const price = parseFloat(document.getElementById('bagItemPrice').value) || 0;
  if(!name) return;
  D.hospitalBag.push({name, qty, price});
  if(D.hospitalBag.length > 200) D.hospitalBag.length = 200;
  saveData(D);
  document.getElementById('bagItemName').value = '';
  document.getElementById('bagItemQty').value = '1';
  document.getElementById('bagItemPrice').value = '';
  renderHospitalBag();
}

function deleteBagItem(idx){
  D.hospitalBag.splice(idx,1);
  saveData(D);
  renderHospitalBag();
}

function renderHospitalBag(){
  const div = document.getElementById('bagList');
  const totalCard = document.getElementById('bagTotalCard');
  const totalEl = document.getElementById('bagTotalPrice');
  if(D.hospitalBag.length === 0){
    div.innerHTML = '<div class="empty mt-12">🎒 待产包还是空的，开始添加物品吧</div>';
    totalCard.style.display = 'none';
    return;
  }
  let total = 0;
  div.innerHTML = '<div class="flex-between mb-8"><span class="text-sm">共 '+D.hospitalBag.length+' 项</span><button class="btn-clear" onclick="clearAll(\'hospitalBag\')">🗑 清空全部</button></div>' +
    D.hospitalBag.map((item,i) => {
      const sub = (item.qty * item.price);
      total += sub;
      return '<div class="log-item" style="position:relative">'+
        '<div><span class="fw-600">'+item.name+'</span><span class="text-sm" style="margin-left:8px">×'+item.qty+(item.price>0?' · ¥'+item.price.toFixed(2)+'/个':'')+'</span></div>'+
        '<span><span class="fw-600 text-primary">¥'+sub.toFixed(2)+'</span>'+
        '<span style="cursor:pointer;font-size:.75rem;color:var(--danger);margin-left:8px" onclick="deleteBagItem('+i+')">✕</span></span>'+
        '</div>';
    }).join('');
  totalCard.style.display = '';
  totalEl.textContent = '¥'+total.toFixed(2);
}

function switchSubTab(sub, el){
  const page = el.closest('.page') || document;
  page.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  page.querySelectorAll('.sub-page').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('sub-'+sub).classList.add('active');
  if(sub === 'notes') renderNotes();
  else if(sub === 'bag') renderHospitalBag();
  else if(sub === 'weight-chart') drawWeightChart();
}

// ==================== SETTINGS ====================
function openSettings(){
  document.getElementById('settingsModal').style.display = 'flex';
}
function closeSettings(){
  document.getElementById('settingsModal').style.display = 'none';
}

function saveTitle(){
  const t = document.getElementById('appTitle').textContent.trim();
  if(!t) return;
  D.appTitle = t;
  saveData(D);
  updateDocTitle(t);
}

function updateDocTitle(title){
  const suffix = ' · 孕期 & 新生儿';
  document.getElementById('docTitle').textContent = title + suffix;
  const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if(meta) meta.content = title;
}

// Debounced version for input events
const debouncedSaveTitle = debounce(saveTitle, 500);
function exportData(){
  const raw = localStorage.getItem(STORAGE_KEY) || '{}';
  const blob = new Blob([raw], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '孕宝助手备份_' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
function importData(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const data = JSON.parse(e.target.result);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      D = loadData();
      closeSettings();
      renderAll();
      alert('✅ 数据导入成功！所有记录已恢复。');
    } catch(err){
      alert('❌ 文件格式错误，请选择正确的备份文件。');
    }
  };
  reader.readAsText(file);
}
function renderAll(){
  renderHome();
  renderPregnancy();
  renderBaby();
  renderVaccine();
  renderNotes();
  renderHospitalBag();
  // Restore running timers
  if(D.feedState.left.running) startFeedTimer('left');
  if(D.feedState.right.running) startFeedTimer('right');
  if(D.kickState.start && D.kickState.start > 0) startKickTimer();
}

function renderHome(){
  const info = getPregnancyInfo();
  const setup = document.getElementById('setupCard');
  const display = document.getElementById('homeDisplay');
  const sub = document.getElementById('headerSub');

  if(!info){
    setup.style.display = '';
    display.style.display = 'none';
    sub.textContent = '设置预产期以开始';
    if(D.dueDate) document.getElementById('dueDateInput').value = D.dueDate;
    return;
  }

  display.style.display = '';
  display.style.display = '';
  sub.textContent = '孕 ' + info.week + '周+' + info.dayInWeek + '天 · ' + info.trimester;

  document.getElementById('countdown').textContent = info.daysLeft + ' 天';
  document.getElementById('dueDateShow').textContent = info.dueDate;
  document.getElementById('weekBadge').textContent = '孕 ' + info.week + ' 周+' + info.dayInWeek + '天';
  document.getElementById('trimesterBadge').textContent = info.trimester;

  // Checkup interval
  const interval = getCheckupInterval();
  const ciDays = document.getElementById('checkupIntervalDays');
  const ciLabel = document.getElementById('checkupIntervalLabel');
  const ciItem = document.getElementById('checkupIntervalItem');
  if(interval.latest){
    ciDays.textContent = interval.days + ' 天';
    ciLabel.textContent = '距离上次产检';
    ciItem.textContent = interval.latest.date + (interval.latest.item ? ' · ' + interval.latest.item : '');
  } else {
    ciDays.textContent = '--';
    ciLabel.textContent = '暂无产检记录';
    ciItem.textContent = '去孕期页添加吧';
  }

  // Week grid
  const grid = document.getElementById('weekGrid');
  grid.innerHTML = '';
  for(let w=1; w<=40; w++){
    const dot = document.createElement('div');
    dot.className = 'week-dot';
    if(w < info.week) dot.classList.add('past');
    else if(w === info.week) dot.classList.add('current');
    else dot.classList.add('future');
    dot.textContent = w;
    grid.appendChild(dot);
  }
  document.getElementById('elapsedWeeks').textContent = info.week;
  document.getElementById('weekTip').textContent = getTip(info.week);
}

function drawWeightChart(){
  const canvas = document.getElementById('weightChartCanvas');
  const empty = document.getElementById('weightChartEmpty');
  if(D.pregWeights.length < 2){
    canvas.style.display = 'none';
    empty.style.display = 'block';
    if(D.pregWeights.length === 1){
      empty.innerHTML = '<span class="icon">📊</span>再记录一次体重，趋势图就会自动生成';
    }
    return;
  }
  canvas.style.display = 'block';
  empty.style.display = 'none';

  // Sort by date ascending
  const sorted = [...D.pregWeights].sort((a,b) => new Date(a.date) - new Date(b.date));

  // Group by ISO week
  function getWeek(dStr){
    const d = new Date(dStr);
    const dayNum = (d.getDay() + 6) % 7; // Monday=0
    d.setDate(d.getDate() - dayNum + 3); // Thursday of same week
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7);
    return d.getFullYear() + '-W' + String(weekNum).padStart(2,'0');
  }

  const weeks = {};
  sorted.forEach(r => {
    const w = getWeek(r.date);
    if(!weeks[w]) weeks[w] = [];
    weeks[w].push(r.weight);
  });

  const weekLabels = Object.keys(weeks).sort();
  const weekAvgs = weekLabels.map(w => {
    const vals = weeks[w];
    return vals.reduce((a,b)=>a+b,0) / vals.length;
  });

  // Set canvas dimensions (2x for retina)
  const card = canvas.closest('.card');
  const cardRect = card ? card.getBoundingClientRect() : null;
  const availW = cardRect && cardRect.width > 0 ? cardRect.width - 40 : Math.min(window.innerWidth - 48, 400);
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(availW, 280);
  const h = Math.round(w * 0.55);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pad = {top:20, bottom:36, left:44, right:16};
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  // Find Y range with some padding
  const allWeights = sorted.map(r => r.weight);
  let yMin = Math.floor(Math.min(...allWeights));
  let yMax = Math.ceil(Math.max(...allWeights));
  if(yMax - yMin < 2){ yMin -= 1; yMax += 1; }
  const yRange = yMax - yMin || 1;

  // Clear
  ctx.clearRect(0,0,w,h);

  // Axis lines
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  // Grid lines
  const gridLines = 4;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = '#999';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for(let i=0;i<=gridLines;i++){
    const y = pad.top + plotH * (1 - i/gridLines);
    const val = yMin + (yRange/gridLines)*i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w-pad.right, y);
    ctx.stroke();
    ctx.fillText(val.toFixed(1), pad.left-6, y);
  }

  if(weekLabels.length < 2) return;

  // X positions
  const stepX = plotW / (weekLabels.length - 1);
  const pts = weekLabels.map((l,i) => ({
    x: pad.left + i * stepX,
    y: pad.top + plotH * (1 - (weekAvgs[i] - yMin) / yRange),
    label: l,
    val: weekAvgs[i]
  }));

  // Fill area under line
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pad.top + plotH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length-1].x, pad.top + plotH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top+plotH);
  grad.addColorStop(0, 'rgba(232,146,165,0.3)');
  grad.addColorStop(1, 'rgba(232,146,165,0.02)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
  ctx.strokeStyle = '#E892A5';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Points
  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI*2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#E892A5';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // X labels
  ctx.fillStyle = '#999';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  pts.forEach(p => {
    ctx.fillText(p.label, p.x, pad.top + plotH + 8);
    // Value above point
    ctx.fillStyle = '#666';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(p.val.toFixed(1)+'kg', p.x, p.y - 8);
    ctx.fillStyle = '#999';
    ctx.font = '11px -apple-system, sans-serif';
  });

  // Weekly change indicators (arrows between consecutive points)
  ctx.font = '12px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  for(let i=1;i<pts.length;i++){
    const diff = weekAvgs[i] - weekAvgs[i-1];
    const mx = (pts[i-1].x + pts[i].x) / 2;
    const my = (pts[i-1].y + pts[i].y) / 2 - 16;
    if(diff > 0){
      ctx.fillStyle = '#E53935';
      ctx.fillText('▲ +'+diff.toFixed(1), mx, my);
    }else if(diff < 0){
      ctx.fillStyle = '#43A047';
      ctx.fillText('▼ '+diff.toFixed(1), mx, my);
    }else{
      ctx.fillStyle = '#999';
      ctx.fillText('— 0', mx, my);
    }
  }
}

function renderPregnancy(){
  // Kick counter
  document.getElementById('kickEpisodes').textContent = D.kickState.episodes;
  document.getElementById('kickClickCount').textContent = D.kickState.clicks;
  updateKickStatus();
  // Window selector
  document.querySelectorAll('.window-opt').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.w) === D.kickState.window);
  });
  document.getElementById('kickWindowLabel').textContent = D.kickState.window+'分钟内多次=1次有效';
  // Kick history
  const klog = document.getElementById('kickLogView');
  if(D.kickLog.length === 0){
    klog.innerHTML = '<div class="empty">暂无记录 · 结束计数后自动保存</div>';
  } else {
    klog.innerHTML = '<div class="flex-between mb-8"><span></span><button class="btn-clear" onclick="clearKickHistory()">🗑 清空全部</button></div>' +
      D.kickLog.slice(0,20).map((k,i) => {
        const durMin = Math.floor(k.duration/60);
        const durSec = k.duration%60;
        const durStr = durMin>0 ? durMin+'分'+durSec+'秒' : durSec+'秒';
        return '<div class="log-item" style="position:relative">'+
          '<div><span class="fw-600">'+k.episodes+'次有效</span> <span class="text-sm">/'+k.clicks+'次点击</span><br>'+
          '<span class="log-time">'+k.date+' '+k.startTime+' → '+k.endTime+' · '+durStr+' · '+k.window+'分钟窗口</span></div>'+
          '<span style="cursor:pointer;font-size:.8rem;color:var(--danger)" onclick="deleteKickLog('+i+')">🗑</span>'+
          '</div>';
      }).join('');
  }

  // Weights
  const wDiv = document.getElementById('pregWeightLogs');
  if(D.pregWeights.length === 0){
    wDiv.innerHTML = '<div class="empty">暂无记录</div>';
  } else {
    wDiv.innerHTML = '<div class="flex-between mb-8"><span></span><button class="btn-clear" onclick="clearAll(\'pregWeights\')">🗑 清空全部</button></div>' +
      D.pregWeights.slice(0,10).map((w,i) =>
        '<div class="log-item" style="position:relative"><span>'+w.date+'</span><span><span class="fw-600">'+w.weight+' kg</span> <span style="cursor:pointer;font-size:.75rem;color:var(--danger);margin-left:8px" onclick="deletePregWeight('+i+')">✕</span></span></div>'
      ).join('');
  }

  // Appointments
  const aDiv = document.getElementById('aptList');
  if(D.appointments.length === 0){
    aDiv.innerHTML = '<div class="empty">暂无产检安排</div>';
  } else {
    aDiv.innerHTML = '<div class="flex-between mb-8"><span></span><button class="btn-clear" onclick="clearAll(\'appointments\')">🗑 清空全部</button></div>' +
      D.appointments.map((a,i) =>
        '<div class="log-item" style="position:relative"><div style="display:flex;align-items:center;gap:8px">' +
        '<span style="cursor:pointer;font-size:1.1rem" onclick="toggleApt('+i+')">'+(a.done?'✅':'⭕')+'</span>' +
        '<span style="'+(a.done?'text-decoration:line-through;color:var(--text-light)':'')+'">'+a.name+'</span>' +
        '</div><span><span class="log-time">'+a.date+'</span> <span style="cursor:pointer;font-size:.75rem;color:var(--danger);margin-left:8px" onclick="deleteApt('+i+')">✕</span></span></div>'
      ).join('');
  }

  // Checkup records
  const cl = document.getElementById('checkupList');
  if(D.checkupRecords.length === 0){
    cl.innerHTML = '<div class="empty">暂无记录 · 拍照保存您的产检报告</div>';
  } else {
    cl.innerHTML = '<div class="flex-between mb-8"><span class="text-sm">共 '+D.checkupRecords.length+' 条</span><button class="btn-clear" onclick="clearAll(\'checkupRecords\')">🗑 清空全部</button></div>' +
      D.checkupRecords.map((r,i) =>
        '<div class="checkup-record" style="position:relative">' +
        (r.image ? '<img class="checkup-thumb" src="'+r.image+'" onclick="openCheckupImage(\''+r.image+'\')">' : '<div style="width:60px;height:60px;border-radius:8px;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:1.3rem">📄</div>') +
        '<div style="flex:1"><div class="fw-600">'+r.item+'</div><div class="text-sm">'+r.date+'</div></div>' +
        '<span><span style="cursor:pointer;font-size:.75rem;color:var(--primary);margin-right:8px" onclick="editCheckupRecord('+i+')">✏️</span>' +
        '<span style="cursor:pointer;font-size:.75rem;color:var(--danger)" onclick="deleteCheckupRecord('+i+')">✕</span></span>' +
        '</div>'
      ).join('');
  }
  drawWeightChart();
}

function renderBaby(){
  // Feeding log
  const flog = document.getElementById('feedLog');
  if(D.feedSessions.length === 0){
    flog.innerHTML = '<div class="empty mt-12">暂无哺乳记录</div>';
  } else {
    flog.innerHTML = '<div class="mt-12"><div class="flex-between mb-8"><span></span><button class="btn-clear" onclick="clearAll(\'feedSessions\')">🗑 清空全部</button></div>' +
      D.feedSessions.slice(0,10).map((f,i) => {
        const m = Math.floor(f.duration/60);
        const s = f.duration%60;
        const dur = m>0 ? m+'分'+s+'秒' : s+'秒';
        return '<div class="log-item" style="position:relative"><span>'+(f.side==='left'?'🤱 左侧':'🤱 右侧')+'</span><span><span class="fw-600">'+dur+'</span> <span class="log-time">'+f.time+'</span> <span style="cursor:pointer;font-size:.75rem;color:var(--danger);margin-left:6px" onclick="deleteFeed('+i+')">✕</span></span></div>';
      }).join('') + '</div>';
  }

  // Diapers
  const dlog = document.getElementById('diaperLog');
  if(D.diapers.length === 0){
    dlog.innerHTML = '<div class="empty">暂无记录</div>';
  } else {
    const today = new Date().toLocaleDateString('zh-CN');
    const todayCount = D.diapers.filter(d => d.time.startsWith(today)).length;
    dlog.innerHTML = '<div class="flex-between mb-8"><span class="text-sm">今日：<span class="fw-600 text-primary">'+todayCount+'</span> 次</span><button class="btn-clear" onclick="clearAll(\'diapers\')">🗑 清空全部</button></div>' +
      D.diapers.slice(0,10).map((d,i) =>
        '<div class="log-item" style="position:relative"><span>'+d.type+'</span><span><span class="log-time">'+d.time+'</span> <span style="cursor:pointer;font-size:.75rem;color:var(--danger);margin-left:6px" onclick="deleteDiaper('+i+')">✕</span></span></div>'
      ).join('');
  }

  // Growth
  const glog = document.getElementById('growthLogs');
  if(D.growth.length === 0){
    glog.innerHTML = '<div class="empty">暂无记录</div>';
  } else {
    glog.innerHTML = '<div class="flex-between mb-8"><span></span><button class="btn-clear" onclick="clearAll(\'growth\')">🗑 清空全部</button></div>' +
      D.growth.slice(0,10).map((g,i) =>
        '<div class="growth-record" style="position:relative"><span>'+g.date+'</span><span><span>'+(g.weight?g.weight+'kg':'')+' '+(g.height?g.height+'cm':'')+'</span> <span style="cursor:pointer;font-size:.75rem;color:var(--danger);margin-left:6px" onclick="deleteGrowth('+i+')">✕</span></span></div>'
      ).join('');
  }

  // Sleep
  const slog = document.getElementById('sleepLogs');
  if(D.sleep.length === 0){
    slog.innerHTML = '<div class="empty">暂无记录</div>';
  } else {
    slog.innerHTML = '<div class="flex-between mb-8"><span></span><button class="btn-clear" onclick="clearAll(\'sleep\')">🗑 清空全部</button></div>' +
      D.sleep.slice(0,10).map((s,i) =>
        '<div class="log-item" style="position:relative"><span>'+s.date+'</span><span><span class="fw-600">'+s.hours+' 小时</span> <span style="cursor:pointer;font-size:.75rem;color:var(--danger);margin-left:6px" onclick="deleteSleep('+i+')">✕</span></span></div>'
      ).join('');
  }
}

const vaccineSchedule = [
  {age:'出生', name:'乙肝疫苗 (第1剂)', id:'hbv1'},
  {age:'出生', name:'卡介苗', id:'bcg'},
  {age:'1月龄', name:'乙肝疫苗 (第2剂)', id:'hbv2'},
  {age:'2月龄', name:'脊灰疫苗 (第1剂)', id:'ipv1'},
  {age:'3月龄', name:'脊灰疫苗 (第2剂)', id:'ipv2'},
  {age:'3月龄', name:'百白破 (第1剂)', id:'dtap1'},
  {age:'4月龄', name:'脊灰疫苗 (第3剂)', id:'ipv3'},
  {age:'4月龄', name:'百白破 (第2剂)', id:'dtap2'},
  {age:'5月龄', name:'百白破 (第3剂)', id:'dtap3'},
  {age:'6月龄', name:'乙肝疫苗 (第3剂)', id:'hbv3'},
  {age:'8月龄', name:'麻腮风疫苗', id:'mmr'},
  {age:'8月龄', name:'乙脑疫苗 (第1剂)', id:'je1'},
  {age:'18月龄', name:'百白破 (第4剂)', id:'dtap4'},
  {age:'18月龄', name:'麻腮风 (第2剂)', id:'mmr2'},
  {age:'18月龄', name:'甲肝疫苗', id:'hav'},
  {age:'2岁', name:'乙脑疫苗 (第2剂)', id:'je2'},
  {age:'3岁', name:'流脑A+C (第1剂)', id:'men1'},
  {age:'6岁', name:'白破疫苗', id:'dt'},
  {age:'6岁', name:'流脑A+C (第2剂)', id:'men2'},
];

function renderVaccine(){
  const div = document.getElementById('vacList');
  let lastAge = '';
  let html = '';
  vaccineSchedule.forEach(v => {
    if(v.age !== lastAge){
      if(lastAge) html += '<div style="height:8px"></div>';
      html += '<div class="text-sm fw-600 text-primary mb-8">📌 '+v.age+'</div>';
      lastAge = v.age;
    }
    const done = D.vaccines.find(vx => vx.id === v.id);
    html += '<div class="vac-item">' +
      '<div class="vac-check'+(done&&done.done?' done':'')+'" onclick="toggleVaccine(\''+v.id+'\')">'+(done&&done.done?'✓':'')+'</div>' +
      '<div class="vac-name">'+v.name+'</div>' +
      '</div>';
  });
  div.innerHTML = html;
}

function renderNotes(){
  const div = document.getElementById('noteList');
  if(D.notes.length === 0){
    div.innerHTML = '<div class="empty mt-12">📖 还没有笔记，开始记录吧</div>';
  } else {
    div.innerHTML = '<div class="flex-between mb-8"><span class="text-sm">共 '+D.notes.length+' 条</span><button class="btn-clear" onclick="clearAll(\'notes\')">🗑 清空全部</button></div>' +
      D.notes.map((n,i) =>
        '<div class="card" style="position:relative">' +
        '<div class="flex-between mb-8"><span class="text-sm">'+n.time+'</span>' +
        '<span style="cursor:pointer;font-size:.75rem;color:var(--danger)" onclick="deleteNote('+i+')">🗑</span></div>' +
        '<p style="white-space:pre-wrap;font-size:.9rem">'+n.text+'</p></div>'
      ).join('');
  }
}

function deleteNote(idx){
  D.notes.splice(idx,1);
  saveData(D);
  renderNotes();
}

// ==================== TABS ====================
function switchTab(pageName) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('active');
    t.removeAttribute('aria-current');
  });
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const tab = document.querySelector('.tab[data-page="' + pageName + '"]');
  if (tab) {
    tab.classList.add('active');
    tab.setAttribute('aria-current', 'page');
  }
  const page = document.getElementById('page-' + pageName);
  if (page) page.classList.add('active');
  // Re-render relevant page
  if (pageName === 'home') renderHome();
  else if (pageName === 'pregnancy') renderPregnancy();
  else if (pageName === 'baby') renderBaby();
  else if (pageName === 'vaccine') renderVaccine();
  else if (pageName === 'other') { renderNotes(); renderHospitalBag(); }
}

document.addEventListener('DOMContentLoaded', function() {
  // Delegate tab clicks
  document.querySelector('.tab-bar').addEventListener('click', function(e) {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    switchTab(tab.dataset.page);
  });
});

// ==================== SERVICE WORKER ====================
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ==================== INIT ====================
renderAll();
if(D.dueDate){
  document.getElementById('dueDateInput').value = D.dueDate;
}
document.getElementById('growthDate').value = new Date().toISOString().split('T')[0];
document.getElementById('checkupDate').value = new Date().toISOString().split('T')[0];

// Custom title
if(D.appTitle){
  document.getElementById('appTitle').textContent = D.appTitle;
  updateDocTitle(D.appTitle);
  // title set by updateDocTitle above
}
function saveTitle(){
  const t = document.getElementById('appTitle').textContent.trim();
  if(!t) return;
  D.appTitle = t;
  saveData(D);
  document.getElementById('docTitle').textContent = t + ' · 孕期 & 新生儿';
  document.querySelector('meta[name="apple-mobile-web-app-title"]').content = t;
}

// Resume timers on load
if(D.feedState.left.running && D.feedState.left.start){
  D.feedState.left.running = true;
  startFeedTimer('left');
}
if(D.feedState.right.running && D.feedState.right.start){
  D.feedState.right.running = true;
  startFeedTimer('right');
}
if(D.kickState.start && D.kickState.start > 0){
  startKickTimer();
  document.getElementById('kickEpisodes').textContent = D.kickState.episodes;
  document.getElementById('kickClickCount').textContent = D.kickState.clicks;
  updateKickStatus();
}






