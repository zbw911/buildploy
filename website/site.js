(() => {
  const menu = document.querySelector('.menu-toggle'), sidebar = document.querySelector('.sidebar'), backdrop = document.querySelector('.nav-backdrop');
  function closeMenu() { sidebar.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); backdrop.hidden = true; }
  menu.addEventListener('click', () => { const open = !sidebar.classList.contains('open'); sidebar.classList.toggle('open', open); menu.setAttribute('aria-expanded', String(open)); backdrop.hidden = !open; });
  backdrop.addEventListener('click', closeMenu);
  sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  const imageDialog = document.querySelector('.image-dialog'), preview = imageDialog.querySelector('img');
  let imageTrigger;
  document.querySelectorAll('.markdown-body img').forEach(img => {
    img.tabIndex = 0; img.setAttribute('role', 'button'); img.setAttribute('aria-label', '放大查看：' + img.alt);
    const show = event => { event.preventDefault(); imageTrigger = img; preview.src = img.src; preview.alt = img.alt; imageDialog.querySelector('.image-caption').textContent = img.alt; imageDialog.showModal(); };
    img.addEventListener('click', show); img.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') show(event); });
  });
  imageDialog.querySelector('[data-close-image]').addEventListener('click', () => imageDialog.close());
  imageDialog.addEventListener('click', event => { if (event.target === imageDialog) imageDialog.close(); });
  imageDialog.addEventListener('close', () => { preview.removeAttribute('src'); imageTrigger?.focus({preventScroll:true}); });

  const dialog = document.querySelector('.search-dialog'), input = dialog.querySelector('input'), results = dialog.querySelector('.search-results'), message = dialog.querySelector('.search-message');
  const root = new URL(document.body.dataset.rootHref, location.href); root.pathname = root.pathname.replace(/index\.html$/, ''); root.hash = ''; root.search = '';
  let indexPromise;
  const loadIndex = () => indexPromise ||= fetch(new URL('search-index.json', root)).then(response => { if (!response.ok) throw Error('Search unavailable'); return response.json(); }).catch(error => { indexPromise = undefined; throw error; });
  const openSearch = () => { if (!dialog.open) dialog.showModal(); input.focus(); loadIndex().catch(() => { message.textContent = '搜索暂时不可用，请通过文档导航查找。'; }); };
  document.querySelector('.search-trigger').addEventListener('click', openSearch);
  dialog.querySelector('[data-close-search]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); } });
  let searchVersion = 0;
  input.addEventListener('input', async () => {
    const version = ++searchVersion, query = input.value.trim().toLocaleLowerCase(); results.replaceChildren();
    if (!query) { message.textContent = '输入关键词，查找文档中的相关内容。'; return; }
    try {
      const terms = query.split(/\s+/), index = await loadIndex(); if (version !== searchVersion) return;
      const hits = index.map(item => ({...item, score:terms.reduce((score, term) => score + (item.title.toLocaleLowerCase().includes(term) ? 5 : 0) + (item.text.toLocaleLowerCase().includes(term) ? 1 : 0), 0)})).filter(item => terms.every(term => (item.title + ' ' + item.text).toLocaleLowerCase().includes(term))).sort((a,b) => b.score - a.score).slice(0,8);
      message.textContent = hits.length ? '找到 ' + hits.length + ' 篇相关文档' : '没有找到相关内容，试试其他关键词。';
      for (const item of hits) {
        const link = document.createElement('a'), title = document.createElement('strong'), snippet = document.createElement('p'); link.href = new URL(item.path, root).href; title.textContent = item.title;
        const start = Math.max(0, item.text.toLocaleLowerCase().indexOf(terms[0]) - 24); snippet.textContent = (start ? '…' : '') + item.text.slice(start, start + 120) + '…'; link.append(title, snippet); results.append(link);
      }
    } catch { message.textContent = '搜索暂时不可用，请通过文档导航查找。'; }
  });
  const tocLinks = [...document.querySelectorAll('.toc a')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { tocLinks.forEach(link => link.classList.toggle('active', decodeURIComponent(link.hash.slice(1)) === entry.target.id)); break; } }, {rootMargin:'-80px 0px -65% 0px'});
    document.querySelectorAll('.markdown-body h2,.markdown-body h3').forEach(heading => observer.observe(heading));
  }
})();
