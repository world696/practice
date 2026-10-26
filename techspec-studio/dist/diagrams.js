/* Render editable Mermaid blocks locally; never execute links, directives or embedded HTML. */
(function(root){
'use strict';
let queue=Promise.resolve(),counter=0,initialized=false;
function allowed(source){
 return source.length<=12000 && /^\s*(?:flowchart|graph)\s+(?:TB|TD|LR|RL|BT)\b/.test(source)
  && !/%%\{|^\s*---|\b(?:click|classDef|linkStyle|style|image)\b|@\{|https?:\/\/|javascript:|data:|<[a-z!\/]/im.test(source);
}
function prepare(html){
 const template=document.createElement('template');template.innerHTML=html;
 template.content.querySelectorAll('pre > code.language-mermaid').forEach(code=>{
  const figure=document.createElement('figure');figure.className='diagram-block';figure.dataset.source=code.textContent;
  const canvas=document.createElement('div');canvas.className='diagram-canvas';canvas.setAttribute('aria-label','方案流程图');
  const pre=document.createElement('pre');pre.className='diagram-source';pre.textContent=code.textContent;canvas.appendChild(pre);
  const caption=document.createElement('figcaption');caption.textContent='架构与流程 · Mermaid 图示';figure.append(canvas,caption);code.parentElement.replaceWith(figure);
 });
 return template.innerHTML;
}
function initialize(){
 if(initialized)return;
 root.mermaid.initialize({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true,maxTextSize:12000,maxEdges:100,theme:'base',fontFamily:'Noto Sans SC, Segoe UI, sans-serif',themeVariables:{primaryColor:'#f2ecfc',primaryTextColor:'#665076',primaryBorderColor:'#baa4dc',lineColor:'#ac91c7',secondaryColor:'#f7f3fc',tertiaryColor:'#fcfaff',fontSize:'13px'},flowchart:{htmlLabels:false,curve:'linear',useMaxWidth:true,padding:13}});
 initialized=true;
}
function fallback(node,message){node.dataset.rendered='source';node.querySelector('figcaption').textContent=message+' · 源码已保留';}
function renderAll(scope=document){
 const nodes=Array.from(scope.querySelectorAll('.diagram-block:not([data-rendered])'));
 nodes.forEach((node,index)=>{
  node.dataset.rendered='pending';
  queue=queue.catch(()=>{}).then(async()=>{
   if(!node.isConnected)return;
   const source=node.dataset.source;
   if(index>=12||!allowed(source)){fallback(node,'图表语法不在当前安全支持范围');return;}
   if(!root.mermaid||!root.DOMPurify){fallback(node,'图表组件未加载');return;}
   try{
    initialize();
    const result=await root.mermaid.render('sfdiagram'+(++counter),source);
    if(!node.isConnected)return;
    const svg=root.DOMPurify.sanitize(result.svg,{USE_PROFILES:{svg:true,svgFilters:true},ADD_TAGS:['style'],FORBID_TAGS:['a','image','foreignObject','script','iframe'],FORBID_ATTR:['href','xlink:href']});
    if(!svg.includes('<svg'))throw new Error('No diagram returned');
    node.querySelector('.diagram-canvas').innerHTML=svg;node.dataset.rendered='ready';
   }catch(error){if(node.isConnected)fallback(node,'图表暂无法绘制，可编辑源码后重试');}
  });
 });
 return queue;
}
root.SpecFlowDiagrams={prepare,renderAll,allowed};
const observer=new MutationObserver(()=>renderAll());
for(const id of ['app','modal-root']){const host=document.getElementById(id);if(host)observer.observe(host,{childList:true,subtree:true});}
})(window);