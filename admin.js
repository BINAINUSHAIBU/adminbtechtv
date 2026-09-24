"use strict";
(function(){
  if(sessionStorage.getItem("btech_super_admin_auth")!=="1"){
    window.location.href="index.html"; return;
  }
  const $=id=>document.getElementById(id);
  const read=(key)=>{try{return localStorage.getItem(key)}catch(e){return null}};
  const parse=(key)=>{try{return JSON.parse(read(key)||"null")}catch(e){return null}};
  const fmt=n=>Number(n||0).toLocaleString();
  const date=v=>v?new Date(v).toLocaleString():"—";

  function packageConfig(){
    try{
      const raw=localStorage.getItem("btech_admin_packages");
      if(raw)return JSON.parse(raw);
    }catch(e){}
    return Array.isArray(window.BTECH_CONFIG?.packages)?window.BTECH_CONFIG.packages:[];
  }

  function getCurrentSubscription(){
    return parse("btech_active_package") || parse("btech_tv_subscription_v5");
  }

  function records(){
    const list=parse("btech_admin_subscriptions");
    if(Array.isArray(list)) return list;
    const current=getCurrentSubscription();
    return current?[current]:[];
  }

  function status(pkg){
    if(!pkg)return "inactive";
    const exp=Number(pkg.expiryDate||pkg.expiresAt);
    return exp>Date.now()?"active":"expired";
  }

  function renderOverview(){
    const subs=records();
    const active=subs.filter(x=>status(x)==="active");
    $("metricCustomers").textContent=fmt(new Set(subs.map(x=>x.customer?.email).filter(Boolean)).size || (subs.length?subs.length:0));
    $("metricActive").textContent=fmt(active.length);
    $("metricPackages").textContent=fmt(packageConfig().length);
    $("metricChannels").textContent=fmt(Number(localStorage.getItem("btech_tv_channel_limit")||window.BTECH_CONFIG?.maxChannels||0));
    $("lastRefresh").textContent=new Date().toLocaleString();
    const tbody=$("recentSubscriptions");
    tbody.innerHTML=subs.slice(-10).reverse().map(x=>`<tr><td>${esc(x.customer?.name||"—")}</td><td>${esc(x.name||((x.channels||0)+" Channels"))}</td><td>${fmt(x.channels||x.channelLimit)}</td><td><span class="badge ${status(x)==="active"?"ok":"warn"}">${status(x)}</span></td><td>${date(x.expiryDate||x.expiresAt)}</td></tr>`).join("") || emptyRow(5,"No subscription records in this browser.");
  }

  function renderCustomers(){
    const q=($("customerSearch").value||"").toLowerCase();
    const unique={};
    records().forEach(x=>{const c=x.customer||{};const k=c.email||c.phone||c.name||x.id;if(!unique[k])unique[k]={...x}});
    const rows=Object.values(unique).filter(x=>JSON.stringify(x.customer||{}).toLowerCase().includes(q));
    $("customerTable").innerHTML=rows.map(x=>`<tr><td>${esc(x.customer?.name||"—")}</td><td>${esc(x.customer?.email||"—")}</td><td>${esc(x.customer?.phone||"—")}</td><td>${esc(x.name||"—")}</td><td><span class="badge ${status(x)==="active"?"ok":"warn"}">${status(x)}</span></td></tr>`).join("")||emptyRow(5,"No customers found.");
  }

  function renderSubscriptions(){
    $("subscriptionTable").innerHTML=records().slice().reverse().map(x=>`<tr><td>${esc(x.id||"—")}</td><td>${esc(x.customer?.name||"—")}</td><td>${fmt(x.channels||x.channelLimit)}</td><td>${esc((x.currency||"USD")+" "+Number(x.price||0).toFixed(2))}</td><td>${date(x.activationDate||x.activatedAt)}</td><td>${date(x.expiryDate||x.expiresAt)}</td><td><span class="badge ${status(x)==="active"?"ok":"warn"}">${status(x)}</span></td></tr>`).join("")||emptyRow(7,"No subscription records.");
  }

  function renderPackages(){
    const list=packageConfig();
    $("packageTable").innerHTML=list.map(x=>`<tr><td>${esc(x.id)}</td><td>${fmt(x.channels)}</td><td>${Number(x.price||0).toFixed(2)}</td><td>${esc(x.currency||"USD")}</td><td>${fmt(window.BTECH_CONFIG?.packageValidityDays||30)} Days</td></tr>`).join("")||emptyRow(5,"No packages configured.");
  }

  function renderChannels(){
    $("channelMax").textContent=fmt(window.BTECH_CONFIG?.maxChannels||0);
    $("loadedChannels").textContent=Array.isArray(window.BTECH_CHANNELS)?fmt(window.BTECH_CHANNELS.length):"Managed by channel engine";
    $("currentLimit").textContent=fmt(localStorage.getItem("btech_tv_channel_limit")||0);
  }

  function emptyRow(cols,msg){return `<tr><td colspan="${cols}" class="muted">${msg}</td></tr>`}
  function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

  window.refreshAll=function(){renderOverview();renderCustomers();renderSubscriptions();renderPackages();renderChannels()};
  window.clearDemoSubscription=function(){
    ["btech_active_package","btech_tv_subscription_v5","btech_tv_premium","btech_tv_package","btech_tv_channel_limit","btech_tv_package_expires"].forEach(k=>localStorage.removeItem(k));
    refreshAll();
  };

  document.querySelectorAll(".nav button").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav button").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.view).classList.add("active");
    $("pageTitle").textContent=btn.textContent.replace(/^[^\w]+/,"").trim();
  }));
  $("customerSearch").addEventListener("input",renderCustomers);
  $("logoutBtn").addEventListener("click",()=>{
    sessionStorage.removeItem("btech_super_admin_auth");
    sessionStorage.removeItem("btech_super_admin_login");
    window.location.href="index.html";
  });

  /* Import the main app's config/channels where possible. */
  const s1=document.createElement("script"); s1.src="../js/config.js"; s1.onload=refreshAll; document.head.appendChild(s1);
  const s2=document.createElement("script"); s2.src="../data/channels.js"; document.head.appendChild(s2);
  refreshAll();
})();
