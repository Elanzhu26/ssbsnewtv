function openEnglishVersion(){
  const isLocal=['127.0.0.1','localhost'].includes(location.hostname);
  const source=isLocal
    ? `https://ssbstvnews.com${location.pathname}${location.search}${location.hash}`
    : location.href;
  location.href=`https://translate.google.com/translate?sl=zh-CN&tl=en&u=${encodeURIComponent(source)}`;
}

document.querySelectorAll('[data-translate-en]').forEach(button=>{
  button.addEventListener('click',openEnglishVersion);
});
