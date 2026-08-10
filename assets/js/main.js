// Unistar Website Draft V12 - page navigation script
const pages=[...document.querySelectorAll('.page')];
const links=[...document.querySelectorAll('.nav-link')];
function showPage(hash){
  const id=(hash||'#home').replace('#','');
  const page=document.getElementById(id)||document.getElementById('home');
  pages.forEach(p=>p.classList.remove('active'));
  page.classList.add('active');
  links.forEach(a=>{
    const href=(a.getAttribute('href')||'').replace('#','');
    a.classList.toggle('active',href===page.id);
  });
  window.scrollTo({top:0,behavior:'smooth'});
}
links.forEach(a=>a.addEventListener('click',e=>{
  const href=a.getAttribute('href');
  if(href&&href.startsWith('#')){e.preventDefault();history.pushState(null,'',href);showPage(href);}
}));
window.addEventListener('popstate',()=>showPage(location.hash));
showPage(location.hash||'#home');