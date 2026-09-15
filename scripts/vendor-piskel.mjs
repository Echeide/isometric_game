// Copy a pinned, separately compiled Piskel into our static files. No runtime service.
import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve, join} from 'node:path';
const revision = 'a6b9c02daefceb10093f71e92d52d16920ccb16e';
const source = resolve(process.argv[2] ?? '');
if (!process.argv[2] || execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim() !== revision) {
  throw new Error(`Pass a built Piskel checkout at ${revision}. See vendor/piskel/README.md.`);
}
const build = join(source, 'dest/prod'), target = resolve('static/tools/piskel');
let html = await readFile(join(build, 'index.html'), 'utf8');
if (!html.includes('pskl.app.init();')) throw new Error('Unexpected Piskel boot code.');
html = html.replace('<head>', '<head>\n<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:; worker-src \'self\' blob:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">\n<script src="bridge.js"></script>')
  .replace('pskl.app.init();', 'window.isometricoBeforePiskelInit();\n    pskl.app.init();')
  .replace(/<\/body>\s*<\/html>\s*$/, '<link rel="stylesheet" href="embed.css">\n</body>\n</html>');
await mkdir(target, {recursive:true});
// This directory contains only generated, vendored assets.
await rm(target, {recursive:true}); await mkdir(target, {recursive:true});
for (const name of ['img', 'css', 'logo.png']) await cp(join(build,name), join(target,name), {recursive:true});
await mkdir(join(target,'js'), {recursive:true});
for (const name of await readdir(join(build,'js'))) {
  if (name.startsWith('piskel-packaged-min') && name.endsWith('.js')) {
    const js = (await readFile(join(build,'js',name),'utf8')).replace(/\/\/# sourceMappingURL=.*$/m,'');
    await writeFile(join(target,'js',name),js);
  }
}
await writeFile(join(target,'index.html'),html);
await cp(join(source,'LICENSE'),join(target,'LICENSE'));
await cp('vendor/piskel/bridge.js',join(target,'bridge.js'));
await cp('vendor/piskel/embed.css',join(target,'embed.css'));
// Preserve upstream bundled license notices in a readable, distributed copy.
const scriptList = await readFile(join(source,'src/piskel-script-list.js'),'utf8');
const paths = [...scriptList.matchAll(/["'](js\/lib\/[^"']+\.js)["']/g)].map(m=>m[1]);
const notices = [];
for (const path of paths) {
  const js = await readFile(join(source,'src',path),'utf8');
  const comments = [...js.matchAll(/\/\*[\s\S]*?\*\//g)].map(m=>m[0]).filter(c=>/copyright|license|licensed/i.test(c));
  if (comments.length) notices.push(`${path}\n${comments.join('\n')}`);
}
await writeFile(join(target,'THIRD-PARTY-NOTICES.txt'),notices.join('\n\n'));
await writeFile(join(target,'NOTICE.txt'),`Piskel — https://github.com/piskelapp/piskel\nCopyright 2017 Julian Descottes. Apache-2.0; see LICENSE.\nSource revision: ${revision}\nModified for Isométrico: local message adapter, fixed-image UI and workshop-owned persistence.\nSee THIRD-PARTY-NOTICES.txt for bundled libraries.\n`);
console.log(`Vendored Piskel ${revision} into ${target}`);
