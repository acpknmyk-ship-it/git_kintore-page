// 自作の線画（SVG）を作る。部品（頭・胴・ダンベル・矢印）をそろえて、絵柄をそろえる。
// 使い方: node make_line.mjs <出力フォルダ>
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
const INK = '#333', BODY = '#e7f0fb', TOOL = '#555', MOVE = '#d6336c', GHOST = '#aab';

const head = (x, y, r = 30) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`;
// 横から見た胴：太い線を 2 本重ねて、ふちのあるカプセルにする
const torso = (x1, y1, x2, y2, w = 40) =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" stroke-width="${w}"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${BODY}" stroke-width="${w - 14}"/>`;
const limb = (...pts) => `<path d="M${pts.map((p) => p.join(' ')).join(' L')}"/>`;
// 横向きのダンベル（中心 x,y）
const dumbbell = (x, y, ghost = false) => {
  const c = ghost ? GHOST : TOOL;
  const a = ghost ? ` stroke="${GHOST}" stroke-width="4" stroke-dasharray="2 9" fill="none"` : ` stroke="${TOOL}" stroke-width="5" fill="${c}"`;
  return `<g${a}><rect x="${x - 26}" y="${y - 15}" width="11" height="30" rx="3"/><rect x="${x + 15}" y="${y - 15}" width="11" height="30" rx="3"/><path d="M${x - 15} ${y} H${x + 15}"/></g>`;
};
// 矢印（a から b へ）。both なら両向き
const arrow = (x1, y1, x2, y2, both = false) => {
  const ang = Math.atan2(y2 - y1, x2 - x1), L = 16;
  const tip = (x, y, t) => `<path d="M${(x - L * Math.cos(t - 0.5)).toFixed(1)} ${(y - L * Math.sin(t - 0.5)).toFixed(1)} L${x} ${y} L${(x - L * Math.cos(t + 0.5)).toFixed(1)} ${(y - L * Math.sin(t + 0.5)).toFixed(1)}"/>`;
  return `<g stroke="${MOVE}" stroke-width="5"><path d="M${x1} ${y1} L${x2} ${y2}"/>${tip(x2, y2, ang)}${both ? tip(x1, y1, ang + Math.PI) : ''}</g>`;
};
// 曲がった矢印（a から c を通って b へ）。q は曲がりの目安の点。both なら両向き
const curve = (x1, y1, qx, qy, x2, y2, both = false) => {
  const L = 16;
  const tip = (x, y, t) => `<path d="M${(x - L * Math.cos(t - 0.5)).toFixed(1)} ${(y - L * Math.sin(t - 0.5)).toFixed(1)} L${x} ${y} L${(x - L * Math.cos(t + 0.5)).toFixed(1)} ${(y - L * Math.sin(t + 0.5)).toFixed(1)}"/>`;
  return `<g stroke="${MOVE}" stroke-width="5"><path d="M${x1} ${y1} Q${qx} ${qy} ${x2} ${y2}"/>${tip(x2, y2, Math.atan2(y2 - qy, x2 - qx))}${both ? tip(x1, y1, Math.atan2(y1 - qy, x1 - qx)) : ''}</g>`;
};
// 縦向きのダンベル（胸の前で持つとき）
const dumbbellV = (x, y) => `<g transform="rotate(90 ${x} ${y})">${dumbbell(x, y)}</g>`;
const ghost = (inner) => `<g stroke="${GHOST}" stroke-width="5" stroke-dasharray="2 12">${inner}</g>`;
const floor = (y = 345) => `<path d="M40 ${y} H360" stroke="#c5cad1" stroke-width="4"/>`;
const svg = (title, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">\n  <!-- ${title}（自作の線画。make_line.mjs で作る） -->\n  ${inner.join('\n  ')}\n</svg>\n`;
// 前から見た胴
const frontTorso = (y) => `<path d="M158 ${y} H242 Q252 ${y} 250 ${y + 12} L236 ${y + 112} H164 L150 ${y + 12} Q148 ${y} 158 ${y} Z" fill="${BODY}"/>`;
const bench = (x1, x2, y) =>
  `<g stroke="${TOOL}" stroke-width="6"><rect x="${x1}" y="${y}" width="${x2 - x1}" height="16" rx="6" fill="#d9dde3"/><path d="M${x1 + 22} ${y + 16} V345 M${x2 - 22} ${y + 16} V345"/></g>`;

const pics = {
  // ベンチにあお向け、ダンベルを真上に押し上げる（横から）
  dumbbell_press: svg('ダンベルプレス：あお向けでダンベルを胸の上に押し上げる', [
    floor(), bench(70, 300, 262),
    ghost(limb([170, 232], [205, 262], [200, 205]) + ''), dumbbell(200, 196, true),
    limb([255, 245], [315, 250], [322, 340], [345, 342]),
    torso(140, 240, 255, 240),
    head(100, 232),
    limb([170, 232], [172, 175], [172, 122]),
    dumbbell(172, 108),
    arrow(250, 195, 250, 105, true),
  ]),
  // あお向けで腕を横に開いて閉じる（頭の側から）
  dumbbell_fly: svg('ダンベルフライ：あお向けで腕を横に開き、胸の上で閉じる', [
    floor(),
    `<g stroke="${TOOL}" stroke-width="6"><rect x="150" y="262" width="100" height="16" rx="6" fill="#d9dde3"/><path d="M200 278 V345 M165 345 H235"/></g>`,
    ghost(limb([170, 238], [182, 170], [188, 118]) + limb([230, 238], [218, 170], [212, 118])),
    `<ellipse cx="200" cy="245" rx="52" ry="24" fill="${BODY}"/>`,
    head(200, 228, 28),
    limb([165, 242], [112, 240], [62, 212]),
    limb([235, 242], [288, 240], [338, 212]),
    `<g stroke="${TOOL}" stroke-width="5" fill="${TOOL}"><rect x="42" y="190" width="30" height="11" rx="3"/><rect x="42" y="217" width="30" height="11" rx="3"/><rect x="328" y="190" width="30" height="11" rx="3"/><rect x="328" y="217" width="30" height="11" rx="3"/></g>`,
    `<g stroke="${MOVE}" stroke-width="5"><path d="M80 170 Q110 95 165 88"/><path d="M149 80 L166 88 L152 100"/><path d="M320 170 Q290 95 235 88"/><path d="M251 80 L234 88 L248 100"/></g>`,
  ]),
  // 片手と片ひざをベンチについて、ダンベルをわき腹へ引く（横から）
  dumbbell_row: svg('ダンベルロウ：片手と片ひざをベンチにつき、ダンベルをわき腹へ引き上げる', [
    floor(), bench(60, 270, 262),
    ghost(limb([165, 205], [168, 300])), dumbbell(168, 312, true),
    limb([262, 200], [300, 268], [318, 340], [345, 342]),
    limb([255, 205], [238, 256], [150, 256]),
    limb([145, 200], [140, 256]),
    torso(140, 190, 258, 190),
    head(100, 180, 28),
    limb([165, 192], [205, 150], [200, 215]),
    dumbbell(200, 230),
    arrow(300, 215, 300, 150),
  ]),
  // バーにぶら下がり、体を引き上げる（前から）
  pullup: svg('懸垂：バーにぶら下がり、あごがバーを越えるまで体を引き上げる', [
    `<path d="M70 62 H330" stroke="${TOOL}" stroke-width="10"/>`,
    ghost(limb([150, 250], [140, 150], [135, 70]) + limb([250, 250], [260, 150], [265, 70]) + `<circle cx="200" cy="215" r="30"/>`),
    frontTorso(118),
    limb([182, 230], [178, 320], [165, 350]),
    limb([218, 230], [222, 320], [235, 350]),
    limb([156, 130], [118, 118], [135, 64]),
    limb([244, 130], [282, 118], [265, 64]),
    head(200, 62, 32),
    arrow(335, 300, 335, 170),
  ]),
  // バーベルを肩にかついでしゃがむ（横から）
  barbell_squat: svg('バーベルスクワット：バーベルを肩にかつぎ、しゃがんで立ち上がる', [
    floor(),
    limb([165, 248], [250, 258], [205, 338], [250, 340]),
    torso(165, 245, 212, 150),
    `<circle cx="205" cy="148" r="34" fill="${TOOL}" stroke="${TOOL}"/><circle cx="205" cy="148" r="7" fill="#fff" stroke="#fff"/>`,
    head(238, 108, 28),
    limb([212, 160], [240, 190], [218, 156]),
    arrow(320, 120, 320, 230, true),
  ]),
  // 片足を前に踏み出して腰を落とす（横から）
  lunge: svg('ランジ：片足を大きく前に踏み出して腰を落とし、戻る', [
    floor(),
    limb([190, 222], [150, 300], [85, 322], [70, 340]),
    limb([195, 222], [275, 228], [275, 338], [305, 340]),
    torso(192, 215, 192, 118),
    head(192, 68, 28),
    limb([192, 125], [215, 170], [200, 212]),
    arrow(335, 110, 335, 205, true),
  ]),
  // 平行なバーに手をついて体を沈め、押し戻す（前から）
  dips: svg('ディップス：平行なバーに手をつき、ひじを曲げて体を沈め、押し戻す', [
    floor(),
    `<g stroke="${TOOL}" stroke-width="9"><path d="M118 188 V345 M282 188 V345 M100 188 H136 M264 188 H300"/></g>`,
    frontTorso(100),
    limb([182, 212], [178, 270], [165, 305]),
    limb([218, 212], [222, 270], [235, 305]),
    limb([156, 112], [122, 140], [118, 184]),
    limb([244, 112], [278, 140], [282, 184]),
    head(200, 56, 32),
    arrow(345, 80, 345, 170, true),
  ]),
  // あお向けで手足を伸ばして浮かせ、背中を丸めたまま前後にゆれる（横から）
  hollow_rock: svg('ホローロック：あお向けで手足を浮かせ、体を丸めたまま前後にゆれる', [
    floor(),
    limb([228, 322], [290, 290], [348, 250]),
    torso(145, 300, 228, 324),
    head(108, 282, 28),
    limb([150, 296], [100, 258], [55, 225]),
    dumbbell(48, 218),
    curve(130, 215, 200, 180, 270, 215, true),
  ]),
  // ダンベルを片手に持ち、上体を真横に倒して戻す（前から）
  side_bend: svg('サイドベント：ダンベルを片手に持ち、上体を真横に倒して起こす', [
    floor(),
    ghost(`<circle cx="200" cy="80" r="30"/>`),
    limb([182, 228], [180, 338], [165, 340]),
    limb([218, 228], [220, 338], [235, 340]),
    `<g transform="rotate(-18 200 230)">${frontTorso(124)}${limb([156, 136], [146, 190], [144, 242])}${dumbbell(144, 256)}${limb([244, 136], [274, 176], [246, 208])}${head(200, 80, 30)}</g>`,
    curve(290, 70, 230, 10, 120, 40),
  ]),
  // 座って足を浮かせ、上体を少し後ろに倒したまま左右にひねる（横から）
  russian_twist: svg('ロシアンツイスト：座って足を浮かせ、上体を左右にひねる', [
    floor(),
    limb([205, 330], [268, 272], [330, 296]),
    torso(205, 328, 152, 240),
    head(130, 200, 28),
    limb([160, 252], [205, 290], [228, 268]),
    dumbbellV(238, 262),
    curve(175, 175, 225, 145, 280, 180, true),
  ]),
  // ダンベルを握って腕立ての姿勢になり、片手ずつダンベルをわき腹へ引く（横から）
  plank_row: svg('プランクロウ：ダンベルを握った腕立ての姿勢で、片手ずつわき腹へ引く', [
    floor(),
    ghost(limb([158, 240], [160, 318])), dumbbell(160, 330, true),
    limb([250, 252], [340, 326], [352, 340]),
    torso(130, 232, 250, 252),
    head(90, 218, 28),
    limb([135, 238], [135, 318]),
    dumbbell(135, 330),
    limb([155, 240], [205, 200], [178, 248]),
    dumbbell(178, 258),
    arrow(225, 320, 225, 225),
  ]),
  // あお向けで手足を上げ、反対の手と足を床すれすれまで伸ばして戻す（横から）
  dead_bug: svg('デッドバグ：あお向けで手足を上げ、反対の手と足を伸ばして戻す', [
    floor(),
    ghost(limb([150, 300], [150, 200]) + limb([250, 312], [252, 238], [312, 238])),
    limb([250, 312], [250, 238], [310, 238]),
    limb([250, 316], [305, 312], [358, 318]),
    torso(140, 318, 250, 318),
    head(100, 310, 28),
    limb([150, 302], [150, 200]),
    dumbbell(150, 192),
    limb([145, 304], [95, 300], [58, 306]),
    dumbbell(46, 306),
    curve(80, 250, 105, 205, 145, 185, true),
    curve(355, 285, 345, 245, 320, 220, true),
  ]),
  // ダンベル 1 個を胸の前で縦に持ってしゃがむ（横から）
  goblet_squat: svg('ゴブレットスクワット：ダンベル 1 個を胸の前で持ち、しゃがんで立ち上がる', [
    floor(),
    limb([165, 248], [250, 258], [205, 338], [250, 340]),
    torso(165, 245, 212, 150),
    head(238, 108, 28),
    limb([210, 162], [236, 222], [250, 186]),
    dumbbellV(258, 186),
    arrow(330, 120, 330, 230, true),
  ]),
  // 足を大きく開き、片足に体重をのせて深くしゃがむ。反対の足はまっすぐ伸ばす（前から）
  cossack_squat: svg('ダンベルコサックスクワット：足を大きく開き、片足ずつ深くしゃがむ', [
    floor(),
    limb([132, 242], [88, 288], [108, 338], [88, 340]),
    limb([168, 242], [325, 336], [334, 314]),
    `<g transform="translate(-50 0)">${frontTorso(130)}</g>`,
    limb([108, 144], [118, 205], [142, 196]),
    limb([192, 144], [182, 205], [158, 196]),
    dumbbell(150, 196),
    head(150, 86, 30),
    arrow(240, 150, 345, 150, true),
  ]),
};

for (const [name, text] of Object.entries(pics)) writeFileSync(join(out, `${name}.svg`), text, 'utf8');
console.log(Object.keys(pics).join(' '));
