const STORAGE_KEY = 'jobradar_applied_v1';
const VIEW_KEY = 'jobradar_view_v1';

let JOBS = [];
let applied = new Set();
let activeFilters = new Set();

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));
}

function loadApplied(){
  try { applied = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch(e){ applied = new Set(); }
}

function isApplied(id){ return applied.has(id); }

function buildTags(j){
  const t = [];
  const city = j.city || '';
  const company = j.company || '';
  const role = j.role || '';
  const direction = j.direction || '';
  const hay = `${company} ${role} ${direction}`;

  if(j.priority) t.push('priority');
  if(j.recent) t.push('newweek');
  if(city.includes('北京')) t.push('beijing');
  if(city.includes('上海')) t.push('shanghai');
  if(city.includes('杭州')) t.push('hangzhou');
  if(city.includes('深圳')) t.push('shenzhen');
  if(j.ai) t.push('ai');
  if(j.deadline) t.push('deadline');
  if(j.level === 'position') t.push('positiononly');
  if(j.evidence_grade === 'A') t.push('verifiedonly');
  if(j.display_status === 'watch') t.push('watchonly'); else t.push('actionable');
  if(isApplied(j.id)) t.push('appliedonly'); else t.push('notapplied');

  if(j.etype === '私企') t.push('private');
  else if(j.etype === '外企') t.push('foreign');
  else t.push('state');

  if(/音频|语音|声学|水声|信号处理|DSP|Signal Processing|阵列|声呐|GNSS/i.test(hay)) t.push('signalfit');
  if(/研究院|研究所|研究中心|实验室|科学院|TeleAI/.test(hay)) t.push('research');
  if(/汽车|蔚来|小鹏|理想|比亚迪|吉利|极氪|上汽|广汽|长安|一汽|东风|赛力斯|零跑|Momenta|地平线|小马智行|文远知行|Pony|WeRide|智能驾驶|智驾/.test(hay)) t.push('auto');
  if(/百度|腾讯|美团|快手|京东|小红书|阿里|字节|MiniMax|智谱|月之暗面|阶跃|推荐|搜索|大模型/.test(hay)) t.push('internet');
  if(/OPPO|vivo|小米|荣耀|华为|大疆|NVIDIA|英伟达|Qualcomm|高通|Intel|AMD|Arm|Apple|三星|Sony|Dolby|芯片|硬件|终端|PCB|通信/.test(hay)) t.push('hardware');
  return t;
}

function makeBadge(text, cls=''){
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

function makeCard(j){
  const cls = ['job'];
  if(j.priority) cls.push('priority');
  if(j.etype === '央国企事业单位') cls.push('state');
  if(isApplied(j.id)) cls.push('applied-job');

  const typeCls = j.etype === '私企' ? 'private' : (j.etype === '外企' ? 'foreign' : 'state');
  const verifyCls = j.evidence_grade === 'A' ? 'good' : 'warn';

  return `<article class="${cls.join(' ')}"
      data-id="${esc(j.id)}"
      data-tags="${buildTags(j).join(' ')}"
      title="${esc(j.reason || '')}">
    <button class="check" aria-label="标记已投递"></button>
    <div class="company">${esc(j.company)}</div>
    <div class="role">${esc(j.role)}</div>
    <div class="badges">
      ${makeBadge(j.etype, typeCls)}
      ${makeBadge(j.cohort || '届别待核实','good')}
      ${j.ai ? makeBadge('AI/算法','ai') : ''}
      ${makeBadge(j.level === 'position' ? '具体岗位' : '项目级', j.level === 'position' ? 'good' : 'warn')}
      ${makeBadge(`证据${j.evidence_grade || 'C'}级`, verifyCls)}
    </div>
    <div class="meta">
      <span>${esc(j.city)}</span>
      <span>截止：${esc(j.end || '待核实')}</span>
    </div>
    <div class="actions"><a class="btn" href="${esc(j.url)}" target="_blank" rel="noopener">申请 / 核验 ↗</a></div>
  </article>`;
}

function groupFor(j){
  if(j.display_status === 'watch') return 'watchJobs';
  if(j.priority) return 'priorityJobs';
  if(j.recent) return 'recentJobs';
  if(j.etype === '央国企事业单位') return 'stateJobs';
  if(j.etype === '外企') return 'foreignJobs';
  return 'otherJobs';
}

function renderJobs(){
  ['priorityJobs','recentJobs','stateJobs','foreignJobs','otherJobs','watchJobs']
    .forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML=''; });

  JOBS.forEach(j => {
    const holder = document.getElementById(groupFor(j));
    if(holder) holder.insertAdjacentHTML('beforeend', makeCard(j));
  });

  document.querySelectorAll('.job .check').forEach(btn => {
    btn.onclick = e => {
      const card = e.currentTarget.closest('.job');
      const id = card.dataset.id;
      isApplied(id) ? applied.delete(id) : applied.add(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...applied]));
      renderApplied();
      renderJobs();
      applyFilters();
    };
  });
}

function renderApplied(){
  const companyList = document.getElementById('companyList');
  const roleList = document.getElementById('roleList');
  const empty = document.getElementById('companyEmpty');
  if(!companyList || !roleList || !empty) return;

  companyList.innerHTML = '';
  roleList.innerHTML = '';

  const selected = JOBS.filter(j => isApplied(j.id));
  const counts = {};
  selected.forEach(j => counts[j.company] = (counts[j.company] || 0) + 1);

  Object.entries(counts).forEach(([company, n]) => {
    companyList.insertAdjacentHTML('beforeend',
      `<span class="company-chip">${esc(company)}<small>${n}岗</small></span>`);
  });

  selected.forEach(j => {
    roleList.insertAdjacentHTML('beforeend',
      `<span class="role-chip"><b>${esc(j.company)}</b> · ${esc(j.role)}</span>`);
  });

  empty.style.display = selected.length ? 'none' : 'block';
}

function renderStats(){
  const set = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  set('totalCount', JOBS.length);
  set('priorityCount', JOBS.filter(j=>j.priority).length);
  set('recentCount', JOBS.filter(j=>j.recent).length);
  set('stateCount', JOBS.filter(j=>j.etype==='央国企事业单位').length);
  set('foreignCount', JOBS.filter(j=>j.etype==='外企').length);
  set('verifiedCount', JOBS.filter(j=>j.evidence_grade==='A').length);
  set('actionableCount', JOBS.filter(j=>j.display_status!=='watch').length);
  set('watchCount', JOBS.filter(j=>j.display_status==='watch').length);
  set('visibleTotal', JOBS.length);

  const top = JOBS.filter(j=>j.priority && j.display_status!=='watch').slice(0,5);
  const topGrid = document.getElementById('topGrid');
  if(topGrid){
    topGrid.innerHTML = top.map((j,i)=>
      `<div class="top"><span class="rank">${i+1}</span><div class="c">${esc(j.company)}</div><div class="r">${esc(j.role)}</div></div>`
    ).join('');
  }
}

function applyFilters(){
  let visible = 0;
  document.querySelectorAll('.job').forEach(card => {
    const tags = (card.dataset.tags || '').split(/\s+/);
    const ok = [...activeFilters].every(f => tags.includes(f));
    card.classList.toggle('hidden', !ok);
    if(ok) visible++;
  });
  const c = document.getElementById('visibleCount');
  if(c) c.textContent = visible;

  ['priorityGroup','recentGroup','stateGroup','foreignGroup','otherGroup','watchOnlyGroup']
    .forEach(gid => {
      const g = document.getElementById(gid);
      if(!g) return;
      const any = [...g.querySelectorAll('.job')].some(x => !x.classList.contains('hidden'));
      g.classList.toggle('hidden', !any);
    });
}

function initFilters(){
  document.querySelectorAll('.filter').forEach(btn => {
    btn.onclick = () => {
      const f = btn.dataset.filter;
      activeFilters.has(f) ? activeFilters.delete(f) : activeFilters.add(f);
      btn.classList.toggle('active');
      applyFilters();
    };
  });
}

function initViewToggle(){
  const saved = localStorage.getItem(VIEW_KEY) || 'cards';
  document.body.classList.toggle('list-mode', saved === 'list');
  document.querySelectorAll('.view-btn').forEach(x =>
    x.classList.toggle('active', x.dataset.view === saved)
  );
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.onclick = () => {
      const mode = btn.dataset.view;
      localStorage.setItem(VIEW_KEY, mode);
      document.body.classList.toggle('list-mode', mode === 'list');
      document.querySelectorAll('.view-btn').forEach(x =>
        x.classList.toggle('active', x.dataset.view === mode)
      );
    };
  });
}

async function renderWatch(){
  const grid = document.getElementById('watchGrid');
  if(!grid) return;
  try{
    const res = await fetch('company_watch.json');
    const items = await res.json();
    grid.innerHTML = items.map(x => `<div class="watch-card">
      <div class="wc">${esc(x.company)} · ${esc(x.city)}</div>
      <div class="ws">${esc(x.status)}</div>
      <div class="wn">${esc(x.note)}</div>
      <div style="margin-top:4px"><a href="${esc(x.url)}" target="_blank" rel="noopener">官方入口 / 监控页 ↗</a></div>
    </div>`).join('');
  } catch(e){
    grid.innerHTML = '<div class="empty">监控列表加载失败，请以主岗位库为准。</div>';
  }
}

async function init(){
  loadApplied();
  const res = await fetch('jobs.json');
  JOBS = await res.json();
  renderStats();
  renderJobs();
  renderApplied();
  initFilters();
  initViewToggle();
  renderWatch();
  applyFilters();
}

init();
async function renderChanges(){
  const box=document.getElementById('changeList');
  if(!box)return;
  try{
    const res=await fetch('changes.json?ts='+Date.now());
    const items=await res.json();
    const counts={new:0,updated:0,closed:0};
    items.forEach(x=>counts[x.type]=(counts[x.type]||0)+1);
    document.getElementById('changeNew').textContent=counts.new||0;
    document.getElementById('changeUpdated').textContent=counts.updated||0;
    document.getElementById('changeClosed').textContent=counts.closed||0;
    const labels={new:'新增',updated:'更新',closed:'下架'};
    if(!items.length){box.innerHTML='<div class="empty">当前没有检测到新增、更新或下架变化。</div>';return;}
    box.innerHTML=items.slice(0,20).map(x=>`<div class="change-row"><span class="ctype">${labels[x.type]||x.type}</span><span><b>${esc(x.company)}</b> · ${esc(x.role)}</span>${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener">查看 ↗</a>`:''}</div>`).join('');
  }catch(e){box.innerHTML='<div class="empty">变化记录暂时无法加载。</div>';}
}
window.addEventListener('load',renderChanges);
