const $ = (id) => document.getElementById(id);
let timer;

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function pill(value) { return `<span class="pill ${esc(String(value).toLowerCase())}">${esc(value)}</span>`; }
function riskPill(value) { const labels = { critical: '严重', high: '高', medium: '中', low: '低' }; return `<span class="pill risk-${esc(value)}">${labels[value] || esc(value)}</span>`; }
function statusText(value) { return ({ queued:'排队中', analyzing:'分析中', waiting_for_deployment:'等待发布', running:'执行测试', passed:'通过', failed:'失败' }[value] || value); }

function render(review) {
  $('result-card').classList.remove('hidden');
  $('empty-state').classList.add('hidden');
  $('status').textContent = statusText(review.status);
  $('status').className = `status ${review.status === 'passed' ? 'pass' : review.status === 'failed' ? 'fail' : ''}`;
  $('result-subtitle').textContent = `${review.commitMessage || review.request.commit || review.request.remoteBranch} · ${review.request.environment}${review.resolvedCommit ? ` · ${review.resolvedCommit.slice(0, 12)}` : ''}`;
  const frontend = review.results?.find((item) => item.type === 'frontend');
  $('metrics').innerHTML = [['changedFiles','变更文件',review.changedFiles?.length || 0],['impactAreas','影响区域',review.impactAreas?.length || 0],['selectedTests','选中测试',review.testPlan?.filter((x) => x.selected).length || 0],['results','已完成',review.results?.length || 0]].map(([_,label,value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join('');
  const additions = (review.changedFiles || []).reduce((sum, file) => sum + file.additions, 0);
  const deletions = (review.changedFiles || []).reduce((sum, file) => sum + file.deletions, 0);
  const highestRisk = ['critical', 'high', 'medium', 'low'].find((risk) => review.impactAreas?.some((area) => area.risk === risk));
  $('change-summary').innerHTML = `<span><b>+${additions}</b> 新增行</span><span><b>-${deletions}</b> 删除行</span><span><b>${highestRisk ? ({ critical:'严重', high:'高', medium:'中', low:'低' }[highestRisk]) : '无'}</b> 最高风险</span><span class="summary-note">影响点不是测试失败，而是这次改动需要重点验证的区域</span>`;
  $('page-link').classList.toggle('hidden', !review.request.frontendUrl);
  if (review.request.frontendUrl) $('page-link').href = review.request.frontendUrl;
  $('frontend-result').innerHTML = frontend ? `<div class="item"><span>${esc(frontend.details?.url || review.request.frontendUrl || '页面')}</span>${pill(frontend.status)}</div><div>${esc(frontend.output || frontend.error || '')}</div>${frontend.error ? `<div class="error">${esc(frontend.error)}</div>` : ''}` : (review.request.frontendUrl ? '页面检查等待中…' : '未配置前端页面地址');
  $('event-list').innerHTML = review.events?.length ? review.events.slice(-80).map((event) => `<div class="event event-${esc(event.level || 'info')}"><time>${new Date(event.at).toLocaleTimeString()}</time><span class="event-type">${esc(event.type)}</span><span>${esc(event.message)}</span></div>`).join('') : '等待浏览器启动…';
  if (review.screenshotReady) { $('screenshot').src = `/impact-reviews/${review.id}/screenshot?v=${encodeURIComponent(review.updatedAt)}`; $('screenshot').classList.remove('hidden'); }
  $('impact-count').textContent = `${review.impactAreas?.length || 0} 个区域`;
  $('impact-list').innerHTML = review.impactAreas?.length ? review.impactAreas.map((x) => `<div class="impact-item"><div class="impact-main"><span class="impact-dot risk-dot-${esc(x.risk)}"></span><div><strong>${esc(x.name)}</strong><p>${esc(x.reason)}</p><small>${x.files?.length || 0} 个相关文件 · ${(x.files || []).slice(0, 3).map(esc).join('、')}${x.files?.length > 3 ? ' 等' : ''}</small></div></div>${riskPill(x.risk)}</div>`).join('') : '<div class="no-impact">本次 diff 未命中已配置的影响规则</div>';
  $('plan-list').innerHTML = review.testPlan?.length ? review.testPlan.map((x) => `<div class="item"><span>${esc(x.type)}<br><small>${esc(x.reason)}</small></span>${x.selected ? pill('selected') : pill('skip')}</div>`).join('') : '等待生成…';
  $('file-list').innerHTML = review.changedFiles?.length ? review.changedFiles.slice(0, 30).map((x) => `<div class="item"><span>${esc(x.path)}</span><small>${x.additions}+ ${x.deletions}-</small></div>`).join('') : '等待分析…';
  $('raw-result').textContent = JSON.stringify(review, null, 2);
}

async function poll(id) {
  const review = await fetch(`/impact-reviews/${id}`).then((r) => r.json());
  render(review);
  if (!['passed','failed'].includes(review.status)) timer = setTimeout(() => poll(id), 1000);
}

$('review-form').addEventListener('submit', async (event) => {
  event.preventDefault(); $('form-error').classList.add('hidden');
  const testTypes = [...document.querySelectorAll('.check input:checked')].map((input) => input.value);
  const frontendUrl = $('frontendUrl').value.trim();
  const frontendIndex = testTypes.indexOf('frontend');
  if (!frontendUrl && frontendIndex >= 0) testTypes.splice(frontendIndex, 1);
  if (!$('commit').value.trim() && !$('remoteBranch').value.trim()) { $('form-error').textContent = '请填写 Commit，或填写远程分支'; $('form-error').classList.remove('hidden'); return; }
  const requiredText = $('requiredText').value.split(',').map((x) => x.trim()).filter(Boolean);
  const clickSelectors = $('clickSelectors').value.split(',').map((x) => x.trim()).filter(Boolean);
  const authMode = $('authMode').value;
  const authToken = $('authToken').value;
  const browserAuth = authMode === 'none' || !authToken ? undefined : { mode: authMode, token: authToken, cookieName: $('authCookieName').value.trim() || 'session', cookieValue: authMode === 'cookie' ? authToken : undefined };
  const payload = { repositoryPath: $('repositoryPath').value.trim(), commit: $('commit').value.trim(), baseCommit: $('baseCommit').value.trim() || undefined, environment: $('environment').value, testTypes, deploy: false, frontendUrl: frontendUrl || undefined, frontendCheck: { expectedTitle: $('expectedTitle').value.trim() || undefined, requiredText: requiredText.length ? requiredText : undefined, clickSelectors: clickSelectors.length ? clickSelectors : undefined }, browserAuth, remote: $('remote').value.trim() || undefined, remoteBranch: $('remoteBranch').value.trim() || undefined, mergeRemote: $('mergeRemote').checked };
  try { const response = await fetch('/impact-reviews', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || '创建任务失败'); clearTimeout(timer); await poll(data.id); } catch (error) { $('form-error').textContent = error.message; $('form-error').classList.remove('hidden'); }
});
