import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { renderPage } from '../website/template.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'dist');
const repository = 'https://github.com/zbw911/buildploy';
const docsDirectory = 'docs';
const orderedSources = [
  'README.md', 'docs/README.md', 'docs/architecture.md', 'docs/features.md',
  'docs/showcase.md', 'docs/mobile-preview.md', 'docs/desktop.md', 'docs/enterprise.md',
  'docs/ai-native.md', 'docs/quick-start.md', 'docs/model-and-resource-access.md',
  'docs/faq.md', 'docs/roadmap.md', 'CONTRIBUTING.md',
];
const htmlPath = path => path === 'README.md' ? 'index.html'
  : path.endsWith('/README.md') ? path.slice(0, -9) + 'index.html'
    : path.replace(/\.md$/, '.html');
const relativeHref = (from, to) => posix.relative(posix.dirname(from), to) || posix.basename(to);
const external = href => /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href);
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodeEntities = text => text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity) => {
  if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? whole;
  const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
});
const plain = html => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const inlinePlain = html => decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const pages = [];
for (const sourcePath of orderedSources) {
  const source = await readFile(resolve(root, sourcePath), 'utf8');
  const parser = new Marked();
  const headings = new Set();
  const headingEntries = [];
  parser.use({ renderer: { heading({ tokens, depth }) {
    const label = this.parser.parseInline(tokens);
    const base = inlinePlain(label).toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
    let slug = base, count = 0;
    while (headings.has(slug)) slug = base + '-' + ++count;
    headings.add(slug);
    headingEntries.push({ id: slug, text: inlinePlain(label), level: depth });
    return `<h${depth} id="${slug}">${label}</h${depth}>\n`;
  } } });
  const tokens = parser.lexer(source);
  const titleToken = tokens.find(token => token.type === 'heading' && token.depth === 1);
  if (!titleToken) throw Error(sourcePath + ': missing document title');
  const title = inlinePlain(parser.parseInline(titleToken.text));
  const descriptionToken = tokens.find(token => token.type === 'paragraph');
  const description = descriptionToken ? plain(parser.parseInline(descriptionToken.text)).slice(0, 160) : title;
  pages.push({ sourcePath, outputPath: posix.join(docsDirectory, htmlPath(sourcePath)), title, description, contentHtml: parser.parser(tokens), headings: headingEntries });
}

const sourceMap = new Map(pages.map(page => [page.sourcePath, page]));
function sameSiteLink(href) {
  if (!href.startsWith('https://www.buildploy.com/')) return null;
  const url = new URL(href);
  if (url.origin !== 'https://www.buildploy.com') return null;
  if (url.pathname === '/') return { destination: 'index.html', suffix: url.search + url.hash };
  if (url.pathname !== '/docs' && !url.pathname.startsWith('/docs/')) return null;
  let destination = url.pathname.slice(1);
  if (destination === 'docs' || destination.endsWith('/')) destination += destination.endsWith('/') ? 'index.html' : '/index.html';
  return { destination, suffix: url.search + url.hash };
}
function convertContentLinks(html, page) {
  return html.replace(/\b(href|src)=("([^"]*)"|'([^']*)')/g, (whole, attribute, quoted, double, single) => {
    const href = decodeEntities(double ?? single);
    if (!href || href.startsWith('#') || href.startsWith('?')) return whole;
    const siteLink = sameSiteLink(href);
    if (external(href) && !siteLink) return whole;
    let destination, suffix;
    if (siteLink) ({ destination, suffix } = siteLink);
    else {
      const match = href.match(/^([^?#]*)([?#].*)?$/);
      const path = decodeURIComponent(decodeEntities(match[1]));
      suffix = match[2] || '';
      const sourceTarget = posix.normalize(path.startsWith('/') ? path.slice(1) : posix.join(posix.dirname(page.sourcePath), path));
      if (sourceTarget.startsWith('../')) throw Error(page.sourcePath + ': link leaves public site: ' + href);
      destination = sourceMap.get(sourceTarget)?.outputPath || posix.join(docsDirectory, sourceTarget);
    }
    const converted = relativeHref(page.outputPath, destination) + suffix;
    return attribute + '="' + converted.replaceAll('&', '&amp;').replaceAll('"', '&quot;') + '"';
  });
}

const website = resolve(root, 'website');
const home = resolve(website, 'home');
await readFile(resolve(home, 'index.html'));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(home, output, { recursive: true });
await cp(resolve(root, 'assets'), resolve(output, docsDirectory, 'assets'), { recursive: true });
await mkdir(resolve(output, docsDirectory, 'site-assets'), { recursive: true });
for (const entry of await readdir(website, { withFileTypes: true })) {
  if (entry.isFile() && ['.css', '.js', '.svg', '.png', '.ico', '.webp', '.woff2'].includes(extname(entry.name))) {
    await cp(resolve(website, entry.name), resolve(output, docsDirectory, 'site-assets', entry.name));
  }
}
for (const original of pages) {
  const page = {
    ...original,
    rootHref: relativeHref(original.outputPath, posix.join(docsDirectory, 'index.html')),
    siteRootHref: relativeHref(original.outputPath, 'index.html'),
    assetBase: relativeHref(original.outputPath, posix.join(docsDirectory, 'site-assets')) + '/',
    sourceUrl: repository + '/blob/main/' + original.sourcePath,
  };
  const navigation = pages.map(item => ({
    sourcePath: item.sourcePath, outputPath: item.outputPath, title: item.title, description: item.description,
    href: relativeHref(page.outputPath, item.outputPath), current: item.sourcePath === page.sourcePath,
  }));
  const html = renderPage({ contentHtml: convertContentLinks(page.contentHtml, page), page, navigation, pages: navigation });
  const target = resolve(output, page.outputPath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
await writeFile(resolve(output, docsDirectory, 'search-index.json'), JSON.stringify(pages.map(page => ({
  title: page.title, path: posix.relative(docsDirectory, page.outputPath), sourcePath: page.sourcePath, text: plain(page.contentHtml),
}))));

// Validate final HTML so template navigation and raw Markdown HTML share the same check.
const htmlByPath = new Map(await Promise.all(pages.map(async page => [page.outputPath, await readFile(resolve(output, page.outputPath), 'utf8')])));
htmlByPath.set('index.html', await readFile(resolve(output, 'index.html'), 'utf8'));
const anchorByPath = new Map([...htmlByPath].map(([path, html]) => [path, new Set([...html.matchAll(/\bid=(?:"([^"]*)"|'([^']*)')/g)].map(match => decodeEntities(match[1] ?? match[2])))]));
let checkedReferences = 0;
for (const [path, html] of htmlByPath) {
  for (const match of html.matchAll(/\b(?:href|src)=(?:"([^"]*)"|'([^']*)')/g)) {
    const href = decodeEntities(match[1] ?? match[2]);
    if (!href || external(href)) continue;
    if (href.startsWith('/')) throw Error(path + ': root-relative link cannot be hosted under a subdirectory: ' + href);
    const parts = href.match(/^([^?#]*)(?:\?[^#]*)?(?:#(.*))?$/);
    if (!parts) throw Error(path + ': invalid link ' + href);
    let target = parts[1] ? posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(parts[1]))) : path;
    if (target.endsWith('/')) target += 'index.html';
    if (target.startsWith('../')) throw Error(path + ': link leaves output: ' + href);
    await readFile(resolve(output, target));
    if (parts[2] && target.endsWith('.html') && !anchorByPath.get(target)?.has(decodeURIComponent(parts[2]))) {
      throw Error(path + ': unknown anchor ' + href);
    }
    checkedReferences++;
  }
}
console.log(JSON.stringify({ pages: htmlByPath.size, documentPages: pages.length, checkedReferences, output: 'dist', homepage: 'index.html', docsDirectory, subdirectorySafe: true }));
