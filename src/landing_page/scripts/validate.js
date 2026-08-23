#!/usr/bin/env node
/* RAAHAT landing v3 — build/validate step (spec §4.1)
   Validates assets, the frozen contract, the new design system (tokens, rail,
   shields, three container styles), and the no-fabrication rules. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LANDING = path.join(ROOT, 'landing');
const fails = [];
const ok = (m) => console.log('  \u2713 ' + m);
const check = (cond, msg) => { if (!cond) fails.push(msg); };

const INDEX = fs.readFileSync(path.join(LANDING, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(LANDING, 'css', 'styles.css'), 'utf8');
const JS = fs.readFileSync(path.join(LANDING, 'js', 'app.js'), 'utf8');

console.log('RAAHAT landing v3 — build validation\n');

// 1. assets
['index.html','css/styles.css','js/app.js'].forEach(f => check(fs.existsSync(path.join(LANDING,f)), f+' missing'));
ok('static assets present');

// 2. JS syntax
try { execSync('node --check '+path.join(LANDING,'js','app.js'),{stdio:'pipe'}); ok('app.js syntax valid'); }
catch(e){ fails.push('app.js syntax error'); }

// 3. sections present + ordered + shielded (01..08)
const ids = ['hero','problem','solution','demo','features','how','offline','team'];
let last=-1; ids.forEach(id=>{const i=INDEX.indexOf('id="'+id+'"'); check(i>-1,'missing #'+id); if(i>-1){if(i<last)fails.push('order wrong at '+id); last=i;}});
ok('8 content sections present and ordered');

// 4. mile-marker rail + shields + progress bar
check(INDEX.indexOf('class="rail"')>-1,'rail missing');
check(INDEX.indexOf('rail-fill')>-1,'rail fill missing');
check(INDEX.indexOf('progress-top')>-1,'mobile progress bar missing');
const shields=(INDEX.match(/class="shield">/g)||[]).length;
check(shields===8,'expected 8 route-shields, found '+shields);
check(JS.indexOf('initRail')>-1,'rail scroll logic missing');
ok('mile-marker rail + '+shields+' shields + mobile progress bar');

// 5. design tokens (new palette)
['--paper','--ink','--asphalt','--hazard','--route','--reflect','--go','--line'].forEach(t=>check(CSS.indexOf(t)>-1,'missing token '+t));
ok('new design tokens present');

// 6. typography (three faces)
['Barlow Condensed','IBM Plex Mono','Inter'].forEach(f=>check(INDEX.indexOf(f)>-1||CSS.indexOf(f)>-1,'missing typeface '+f));
ok('three typefaces (display / mono / body)');

// 7. three distinct container styles
check(CSS.indexOf('.ledger')>-1,'ledger list style missing');
check(CSS.indexOf('.console')>-1,'asphalt console style missing');
check(CSS.indexOf('.featgrid')>-1,'bordered feature grid missing');
ok('three distinct container treatments (ledger / console / grid)');

// 8. frozen contract
check(JS.indexOf('/api/v1')>-1,'api base path missing');
check(JS.indexOf('/health')>-1,'health endpoint missing');
check(JS.indexOf('/emergency-assistance')>-1,'emergency endpoint missing');
check(/body\.success|body\.data|res\.body/.test(JS),'envelope not read');
ok('API contract endpoints + envelope');

// 9. no-fabrication rules
check(/Availability unknown/.test(JS),'availability-unknown handling missing');
check(JS.indexOf('requires_confirmation')>-1,'confirmation UI missing');
check(/is_cached/.test(JS),'is_cached handling missing');
check(/source/.test(JS),'source-driven readout missing');
check(/ERROR /.test(JS)&&/Retry/.test(JS),'error code + retry missing');
ok('no-fabrication rendering rules');

// 10. no hardcoded provider assumption in client
check(!/Geoapify/.test(JS),'hardcoded Geoapify found');
ok('no hardcoded provider assumptions');

// 11. light theme only; asphalt is an accent surface, not a dark toggle
check(!/prefers-color-scheme:\s*dark/.test(CSS),'dark-mode media query found');
ok('light theme only (asphalt = accent surface)');

// 12. motion + reduced motion
['is-loaded','laneDrift','rail-fill','prefers-reduced-motion: reduce'].forEach(t=>check((CSS+JS).indexOf(t)>-1,'motion/reduced-motion element missing: '+t));
ok('choreographed motion + reduced-motion handled');

console.log('\n'+(fails.length?('\u2717 BUILD FAILED:\n'+fails.map(f=>'   - '+f).join('\n')):'\u2713 BUILD PASSED — all checks green.'));
process.exit(fails.length?1:0);
