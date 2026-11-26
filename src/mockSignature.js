// 通用模拟手写模块（mock-signature/v1）
// 同一种子永远生成同一笔迹：虚构公司 + 签署环节 → 固定签署人名 + 固定手写笔迹。
// 仅生成虚构人名与抽象笔迹路径，不模仿任何真实个人签名。

const crc32 = s => {
  let a = 0x811c9dc5;
  for (let i = 0; i < String(s).length; i++) { a ^= String(s).charCodeAt(i); a = Math.imul(a, 16777619) >>> 0; }
  return a >>> 0;
};
const seededRandom = seed => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

// 虚构签署人名词典（纯虚构，不对应真实个人）
export const SIGNER_NAMES = ['王岚', '李明哲', '陈思远', '赵启铭', '林书瑶', '周砚', '吴沛珊', '郑怀瑾', '孙沐阳', '许清如', '何静姝', '高逸飞', '罗予安', '宋知微', '唐以宁', '韩景行'];

// 同一签署主体（虚构公司/部门）+ 同一环节 → 永远同一个人名
export function signerName(subjectSeed, role) {
  return SIGNER_NAMES[crc32(`${subjectSeed}::${role}`) % SIGNER_NAMES.length];
}

export const SIGNATURE_COLORS = { navy: '#1f3a8a', black: '#1a1a1a', blueblack: '#24406e' };

// 生成手写笔迹 SVG 字符串：2~4 条贝塞尔笔画，轻微抖动与倾斜
// options.style: neat 工整 / natural 自然 / casual 潦草；options.stroke: thin 细 / medium 适中 / bold 粗；options.color: 笔画颜色
export function mockSignatureSVG(name, seedKey, options = {}) {
  const messiness = { neat: 0.55, natural: 1, casual: 1.65 }[options.style || 'natural'];
  const strokeScale = { thin: 0.7, medium: 1, bold: 1.45 }[options.stroke || 'medium'];
  const strokeColor = options.color || SIGNATURE_COLORS.navy;
  const rnd = seededRandom(crc32(`${name}::${seedKey}`));
  const strokes = 2 + Math.floor(rnd() * 3);
  const paths = [];
  let cursorX = 8 + rnd() * 6;
  for (let s = 0; s < strokes; s++) {
    const width = (18 + rnd() * 22) * (0.8 + messiness * 0.35);
    const baseY = 16 + rnd() * 14;
    const amplitude = (6 + rnd() * 9) * messiness;
    let d = `M ${cursorX.toFixed(1)} ${(baseY + rnd() * 6 - 3).toFixed(1)}`;
    const segments = 2 + Math.floor(rnd() * (2 + messiness));
    for (let i = 0; i < segments; i++) {
      const x1 = cursorX + width * (0.2 + rnd() * 0.3);
      const x2 = cursorX + width * (0.5 + rnd() * 0.3);
      const x3 = cursorX + width;
      const y1 = baseY - amplitude + rnd() * amplitude * 2;
      const y2 = baseY - amplitude + rnd() * amplitude * 2;
      const y3 = baseY + (rnd() * 8 - 4);
      d += ` C ${x1.toFixed(1)} ${y1.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}, ${x3.toFixed(1)} ${y3.toFixed(1)}`;
      cursorX = x3 - width * (0.2 + rnd() * 0.25);
    }
    cursorX += width * (0.9 + rnd() * 0.6);
    paths.push(d);
  }
  // 偶发下划长线/回锋
  if (rnd() > 0.35) {
    const y = 34 + rnd() * 6;
    paths.push(`M ${(6 + rnd() * 8).toFixed(1)} ${y.toFixed(1)} C 40 ${(y - 6 - rnd() * 4).toFixed(1)}, 70 ${(y + 4 + rnd() * 4).toFixed(1)}, ${(110 + rnd() * 30).toFixed(1)} ${(y - 2).toFixed(1)}`);
  }
  const rotate = (rnd() * (3 + messiness * 3) - (1.5 + messiness * 1.5)).toFixed(2);
  const strokeWidth = ((1.6 + rnd() * 0.9) * strokeScale).toFixed(2);
  const d = paths.map(p => `<path d="${p}" fill="none" stroke="${strokeColor}" stroke-opacity="0.88" stroke-width="${strokeWidth}" stroke-linecap="round"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 48"><g transform="rotate(${rotate} 80 24)">${d}</g></svg>`;
}

export function mockSignatureDataUri(name, seedKey, options = {}) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(mockSignatureSVG(name, seedKey, options))}`;
}

// 签署栏完整产物：打印姓名 + 手写笔迹
export function mockSignature(subjectSeed, role, options = {}) {
  const printed = signerName(subjectSeed, role);
  return { role, printed_name: printed, handwriting_svg: mockSignatureSVG(printed, subjectSeed, options), module: 'mock-signature/v1' };
}
