const $ = (id) => document.getElementById(id);
let timer;

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function pill(value) { return `<span class="pill ${esc(String(value).toLowerCase())}">${esc(value)}</span>`; }
function statusText(value) { return ({ queued:'排队中', analyzing:'分析中', waiting_for_deployment:'等待发布', running:'执行测试', passed:'通过', failed:'失败' }[value] || value); }

function render(review) {
  $('result-card').classList.remove('hidden');
  $('empty-state').classList.add('hidden');
  $('status').textContent = statusText(review.status);
  $('status').className = `status ${review.status === 'passed' ? 'pass' : review.status === 'failed' ? 'fail' : ''}`;
  $('result-subtitle').textContent = `${review.commitMessage || review.request.commit || review.request.remoteBranch} · ${review.request.environment}${review.resolvedCommit ? ` · ${review.resolvedCommit.slice(0, 12)}` : ''}`;
  const frontend = review.results?.find((item) => item.type === 'frontend');
  $('metrics').innerHTML = [['changedFiles','变更文件',review.changedFiles?.length || 0],['impactAreas','影响区域',review.impactAreas?.length || 0],['selectedTests','选中测试',review.testPlan?.filter((x) => x.selected).length || 0],['results','已完成',review.results?.length || 0]].map(([_,label,value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join('');
  $('page-link').classList.toggle('hidden', !review.request.frontendUrl);
  if (review.request.frontendUrl) $('page-link').href = review.request.frontendUrl;
  $('frontend-result').innerHTML = frontend ? `<div class="item"><span>${esc(frontend.details?.url || review.request.frontendUrl || '页面')}</span>${pill(frontend.status)}</div><div>${esc(frontend.output || frontend.error || '')}</div>${frontend.error ? `<div class="error">${esc(frontend.error)}</div>` : ''}` : (review.request.frontendUrl ? '页面检查等待中…' : '未配置前端页面地址');
  $('impact-list').innerHTML = review.impactAreas?.length ? review.impactAreas.map((x) => `<div class="item"><span><strong>${esc(x.name)}</strong><br><small>${esc(x.reason)}</small></span>${pill(x.risk)}</div>`).join('') : '暂无影响点';
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
  const payload = { repositoryPath: $('repositoryPath').value.trim(), commit: $('commit').value.trim(), baseCommit: $('baseCommit').value.trim() || undefined, environment: $('environment').value, testTypes, deploy: false, frontendUrl: frontendUrl || undefined, frontendCheck: { expectedTitle: $('expectedTitle').value.trim() || undefined, requiredText: requiredText.length ? requiredText : undefined }, remote: $('remote').value.trim() || undefined, remoteBranch: $('remoteBranch').value.trim() || undefined, mergeRemote: $('mergeRemote').checked };
  try { const response = await fetch('/impact-reviews', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || '创建任务失败'); clearTimeout(timer); await poll(data.id); } catch (error) { $('form-error').textContent = error.message; $('form-error').classList.remove('hidden'); }
});
