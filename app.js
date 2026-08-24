const STORAGE_KEY = 'jobradar_applied_v1';
const VIEW_KEY = 'jobradar_view_v1';
const LEAD_STORAGE_KEY = 'jobradarAppliedRecruitmentLeads';

let JOBS = [];
let RECRUITMENT_LEADS = [];
let applied = new Set();
let appliedRecruitmentLeads = new Set();
let activeFilters = new Set();
let activeLeadFilter = null;

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));
}

function loadApplied(){
  try { applied = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch(e){ applied = new Set(); }
  try { appliedRecruitmentLeads = new Set(JSON.parse(localStorage.getItem(LEAD_STORAGE_KEY) || '[]')); }
  catch(e){ appliedRecruitmentLeads = new Set(); }
}

function isApplied(id){ return applied.has(id); }

async function fetchJson(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function safeHttpUrl(value){
  try{
    const url = new URL(String(value));
    return ['http:','https:'].includes(url.protocol) ? url.href : '';
  } catch(e){
    return '';
  }
}

function validLeadDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
  const [year,month,day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month-1 && date.getUTCDate() === day
    ? value : '';
}

function latestLeadBatchDate(){
  return RECRUITMENT_LEADS.map(lead => validLeadDate(lead.discovered_at)).filter(Boolean).sort().at(-1) || '';
}

function leadIsPending(lead){
  return ['discovered','needs_role_review'].includes(lead.status);
}

function leadIsConfirmed(lead){
  return ['verified_recruitment','converted'].includes(lead.status);
}

function sortRecruitmentLeads(items){
  const urgencyRank = {high:3,medium:2,low:1};
  const dateValue = lead => {
    const dates = [lead.published_at,lead.discovered_at]
      .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x || ''));
    return dates.sort().at(-1) || '';
  };
  return [...items].sort((a,b) =>
    (urgencyRank[b.urgency] || 0) - (urgencyRank[a.urgency] || 0) ||
    Number(b.match_score || 0) - Number(a.match_score || 0) ||
    dateValue(b).localeCompare(dateValue(a))
  );
}

function leadMatchesFilter(lead,latestDate){
  if(activeLeadFilter === 'new') return !latestDate || lead.discovered_at === latestDate;
  if(activeLeadFilter === 'pending') return leadIsPending(lead);
  if(activeLeadFilter === 'confirmed') return leadIsConfirmed(lead);
  return true;
}

function renderLeadRows(list,items,{history=false}={}){
  if(!items.length){
    list.innerHTML = `<div class="empty">${history ? '暂无历史招聘事件。' : (RECRUITMENT_LEADS.length ? '当前筛选下没有招聘线索。' : '当前没有待处理的招聘线索。')}</div>`;
    return;
  }

  const statusLabels = {
    discovered:'待核验',verified_recruitment:'已确认',needs_role_review:'待拆岗位',
    converted:'已岗位化',rejected:'已排除'
  };
  const urgencyLabels = {high:'高',medium:'中',low:'低'};
  list.innerHTML = items.map(lead => {
    const url = safeHttpUrl(lead.official_url) || safeHttpUrl(lead.source_url);
    const cities = Array.isArray(lead.cities) ? lead.cities.join('/') : '';
    const directions = Array.isArray(lead.directions) ? lead.directions.join('/') : '';
    const isLeadApplied = appliedRecruitmentLeads.has(lead.id);
    return `<div class="lead-row ${isLeadApplied ? 'applied-lead' : ''}" title="${esc(lead.notes || '')}">
      <button class="lead-check" data-lead-id="${esc(lead.id)}" aria-label="${isLeadApplied ? '取消已处理或已投递标记' : '标记为已处理或已投递'}" aria-pressed="${isLeadApplied}"></button>
      <span class="lead-new ${history ? 'muted' : ''}">${history ? esc(lead.discovered_at || '历史') : 'NEW'}</span>
      <b class="lead-company">${esc(lead.company)}</b>
      <span class="lead-name">${esc(lead.recruitment_name)}</span>
      <span class="lead-cities">${esc(cities || '城市待核实')}</span>
      <span class="lead-directions">${esc(directions || '方向待核实')}</span>
      <span class="lead-grade grade-${esc(lead.evidence_grade)}">官网${esc(lead.evidence_grade)}级</span>
      <span class="lead-status">${esc(statusLabels[lead.status] || lead.status)}</span>
      <span class="lead-urgency urgency-${esc(lead.urgency)}">${esc(urgencyLabels[lead.urgency] || lead.urgency)}</span>
      ${url ? `<a class="lead-link" href="${esc(url)}" target="_blank" rel="noopener">查看 ↗</a>` : '<span class="lead-link muted">无链接</span>'}
    </div>`;
  }).join('');
}

function bindLeadAppliedButtons(){
  document.querySelectorAll('.lead-check').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.leadId;
      appliedRecruitmentLeads.has(id) ? appliedRecruitmentLeads.delete(id) : appliedRecruitmentLeads.add(id);
      localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify([...appliedRecruitmentLeads]));
      renderRecruitmentLeads();
      renderApplied();
    };
  });
}

function renderRecruitmentLeads(){
  const list = document.getElementById('leadList');
  const archiveList = document.getElementById('leadArchiveList');
  if(!list || !archiveList) return;

  const set = (id,value) => {
    const el = document.getElementById(id);
    if(el) el.textContent = value;
  };
  const latestDate = latestLeadBatchDate();
  const latestBatch = latestDate
    ? RECRUITMENT_LEADS.filter(lead => lead.discovered_at === latestDate)
    : [...RECRUITMENT_LEADS];
  const olderLeads = latestDate
    ? RECRUITMENT_LEADS.filter(lead => lead.discovered_at !== latestDate)
    : [];
  const urgencyRank = {high:3,medium:2,low:1};
  const olderSorted = [...olderLeads].sort((a,b) =>
    validLeadDate(b.discovered_at).localeCompare(validLeadDate(a.discovered_at)) ||
    (urgencyRank[b.urgency] || 0) - (urgencyRank[a.urgency] || 0) ||
    Number(b.match_score || 0) - Number(a.match_score || 0)
  );

  set('leadBatchCount', latestBatch.length);
  set('leadPendingCount', latestBatch.filter(leadIsPending).length);
  set('leadConfirmedCount', latestBatch.filter(leadIsConfirmed).length);
  set('leadAppliedCount', latestBatch.filter(lead => appliedRecruitmentLeads.has(lead.id)).length);

  renderLeadRows(list,sortRecruitmentLeads(latestBatch).filter(lead => leadMatchesFilter(lead,latestDate)));
  renderLeadRows(archiveList,olderSorted,{history:true});
  document.getElementById('leadArchiveGroup')?.classList.toggle('hidden',!olderLeads.length);
  bindLeadAppliedButtons();
}

function initLeadFilters(){
  document.querySelectorAll('.lead-filter').forEach(btn => {
    btn.onclick = () => {
      activeLeadFilter = activeLeadFilter === btn.dataset.leadFilter ? null : btn.dataset.leadFilter;
      document.querySelectorAll('.lead-filter').forEach(x =>
        x.classList.toggle('active', x.dataset.leadFilter === activeLeadFilter)
      );
      renderRecruitmentLeads();
    };
  });
}

async function loadRecruitmentLeads(){
  const list = document.getElementById('leadList');
  if(!list) return;
  try{
    const items = await fetchJson('recruitment_leads.json');
    if(!Array.isArray(items)) throw new Error('招聘线索数据格式无效');
    RECRUITMENT_LEADS = items;
    renderRecruitmentLeads();
    renderApplied();
  } catch(e){
    RECRUITMENT_LEADS = [];
    list.innerHTML = '<div class="empty">招聘线索加载失败，请稍后刷新页面。</div>';
    const archiveList = document.getElementById('leadArchiveList');
    if(archiveList) archiveList.innerHTML = '<div class="empty">近期招聘事件加载失败。</div>';
  }
}

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
  const selectedLeads = RECRUITMENT_LEADS.filter(lead => appliedRecruitmentLeads.has(lead.id));
  const counts = {};
  selected.forEach(j => counts[j.company] = (counts[j.company] || 0) + 1);
  selectedLeads.forEach(lead => counts[lead.company] = (counts[lead.company] || 0) + 1);

  Object.entries(counts).forEach(([company, n]) => {
    companyList.insertAdjacentHTML('beforeend',
      `<span class="company-chip">${esc(company)}<small>${n}项</small></span>`);
  });

  selected.forEach(j => {
    roleList.insertAdjacentHTML('beforeend',
      `<span class="role-chip"><b>${esc(j.company)}</b> · ${esc(j.role)}</span>`);
  });
  selectedLeads.forEach(lead => {
    roleList.insertAdjacentHTML('beforeend',
      `<span class="role-chip lead-role-chip"><b>${esc(lead.company)}</b> · ${esc(lead.recruitment_name)}<small>招聘项目</small></span>`);
  });

  empty.style.display = selected.length || selectedLeads.length ? 'none' : 'block';
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
    const items = await fetchJson('company_watch.json');
    if(!Array.isArray(items)) throw new Error('监控数据格式无效');
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
  initFilters();
  initViewToggle();
  initLeadFilters();
  loadRecruitmentLeads();

  const errorBox = document.getElementById('jobsLoadError');
  try{
    const items = await fetchJson('jobs.json');
    if(!Array.isArray(items)) throw new Error('岗位数据格式无效');
    JOBS = items;
  } catch(e){
    JOBS = [];
    if(errorBox){
      errorBox.textContent = '岗位数据加载失败，请稍后刷新页面。';
      errorBox.classList.remove('hidden');
    }
  }

  renderStats();
  renderJobs();
  renderApplied();
  renderWatch();
  applyFilters();
}

init();
