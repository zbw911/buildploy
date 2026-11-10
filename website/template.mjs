const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const groups = [
  ['了解 Buildploy', ['README.md', 'docs/architecture.md', 'docs/features.md', 'docs/showcase.md', 'docs/mobile-preview.md', 'docs/desktop.md', 'docs/enterprise.md', 'docs/ai-native.md']],
  ['开始使用', ['docs/quick-start.md', 'docs/model-and-resource-access.md', 'docs/wechat-miniapp-configuration.md', 'docs/faq.md']],
  ['参与和反馈', ['docs/roadmap.md', 'CONTRIBUTING.md', 'docs/README.md']],
];
const labels = { 'README.md': '产品概览', 'docs/architecture.md': '整体架构', 'docs/features.md': '功能全景', 'docs/showcase.md': '核心功能 UI', 'docs/mobile-preview.md': '小程序与 Android', 'docs/desktop.md': '桌面版支持', 'docs/enterprise.md': '企业应用与 AI', 'docs/ai-native.md': '关于 AI Native', 'docs/quick-start.md': '快速入门', 'docs/model-and-resource-access.md': '模型与资源接入', 'docs/wechat-miniapp-configuration.md': '小程序配置', 'docs/faq.md': '常见问题', 'docs/roadmap.md': '路线图', 'CONTRIBUTING.md': '反馈与贡献', 'docs/README.md': '全部文档' };

export function renderPage({contentHtml, page, pages}) {
  const items = new Map(pages.map(item => [item.sourcePath, item]));
  const ordered = groups.flatMap(([, paths]) => paths).map(path => items.get(path)).filter(Boolean);
  const currentIndex = ordered.findIndex(item => item.sourcePath === page.sourcePath);
  const side = groups.map(([title, paths]) => `<section class="nav-group"><h2>${title}</h2>${paths.map(path => {
    const item = items.get(path); if (!item) return '';
    return `<a href="${escape(item.href)}" ${item.current ? 'aria-current="page"' : ''}>${escape(labels[path] || item.title)}</a>`;
  }).join('')}</section>`).join('');
  const title = labels[page.sourcePath] || page.title;
  const headings = (page.headings || []).filter(heading => heading.level === 2 || heading.level === 3);
  const toc = headings.map(heading => `<a class="toc-level-${heading.level}" href="#${escape(heading.id)}">${escape(heading.text)}</a>`).join('');
  const previous = ordered[currentIndex - 1], next = ordered[currentIndex + 1];
  const adjacent = (item, direction) => item ? `<a class="page-next ${direction}" href="${escape(item.href)}"><small>${direction === 'previous' ? '← 上一篇' : '下一篇 →'}</small><strong>${escape(labels[item.sourcePath] || item.title)}</strong></a>` : '<span></span>';
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escape(page.description)}"><meta name="color-scheme" content="light"><title>${escape(title)} · Buildploy 文档</title><link rel="icon" href="${escape(page.assetBase)}favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${escape(page.assetBase)}styles.css"><script src="${escape(page.assetBase)}site.js" defer></script></head>
<body data-root-href="${escape(page.rootHref)}"><a class="skip-link" href="#content">跳到正文</a>
<header class="site-header"><div class="header-inner"><button class="menu-toggle" type="button" aria-label="展开文档导航" aria-expanded="false" aria-controls="sidebar">☰</button><a class="brand" href="${escape(page.siteRootHref)}" aria-label="Buildploy 官网首页"><span class="brand-mark" aria-hidden="true">B</span><strong>Buildploy</strong><span class="brand-docs">文档</span></a><button class="search-trigger" type="button" aria-label="搜索文档"><span>搜索文档</span><kbd>Ctrl K</kbd></button><nav class="header-links" aria-label="产品入口"><a class="github-icon" href="https://github.com/zbw911/buildploy/tree/main/docs" target="_blank" rel="noopener" aria-label="在 GitHub 查看文档" title="在 GitHub 查看文档"><img src="${escape(page.assetBase)}github.svg" width="20" height="20" alt="" aria-hidden="true"></a><a class="workspace-link" href="https://code.buildploy.com/" target="_blank" rel="noopener">进入工作台 ↗</a></nav></div></header>
<div class="layout"><aside id="sidebar" class="sidebar" aria-label="文档导航"><div class="sidebar-title">产品与使用指南</div>${side}<a class="sidebar-website" href="${escape(page.siteRootHref)}">返回官网首页 →</a></aside><button class="nav-backdrop" type="button" aria-label="收起文档导航" hidden></button>
<main id="content" class="main-content"><div class="article-meta"><span>文档 / ${escape(title)}</span><a href="${escape(page.sourceUrl)}" target="_blank" rel="noopener">在 GitHub 查看 ↗</a></div><article class="markdown-body">${contentHtml}</article><nav class="page-navigation" aria-label="上下篇文档">${adjacent(previous, 'previous')}${adjacent(next, 'next')}</nav><footer class="page-footer"><span>Buildploy · 从想法到可运行的应用</span><a href="https://github.com/zbw911/buildploy/issues/new/choose">反馈文档问题 ↗</a></footer></main>
<aside class="toc" aria-label="本页目录"><div>本页内容</div>${toc || '<span>阅读本页正文</span>'}</aside></div>
<dialog class="search-dialog" aria-label="搜索文档"><div class="search-top"><label class="sr-only" for="doc-search">搜索关键词</label><input id="doc-search" type="search" placeholder="搜索功能、使用方式或部署…" autocomplete="off"><button type="button" data-close-search aria-label="关闭搜索">Esc</button></div><p class="search-message" aria-live="polite">输入关键词，查找文档中的相关内容。</p><div class="search-results"></div></dialog>
<dialog class="image-dialog" aria-label="图片预览"><div class="image-toolbar"><span class="image-caption"></span><button type="button" data-close-image aria-label="关闭图片预览">关闭 ×</button></div><img alt=""></dialog>
</body></html>`;
}
