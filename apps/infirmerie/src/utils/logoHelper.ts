/**
 * Utility to generate and provide the school logo as a PNG Data URL
 * for both browser UI and jsPDF document generation.
 */

let cachedLogoDataUrl: string | null = null;

export async function getSchoolLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) {
    return cachedLogoDataUrl;
  }

  // Generate a sharp, high-DPI raster representation of the institution logo
  try {
    const width = 400;
    const height = 464;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    // Draw the exact logo vectors on the canvas
    // 1. Blue orbital rings (sphere)
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(200, 190, 160, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0284c7';

    // Ellipses for latitude/longitude orbits
    const drawEllipse = (x: number, y: number, rx: number, ry: number, rot: number, color: string, w: number, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.globalAlpha = alpha;
      ctx.stroke();
      ctx.restore();
    };

    drawEllipse(200, 190, 155, 45, -0.26, '#0284c7', 3.5, 0.85);
    drawEllipse(200, 195, 145, 40, 0.38, '#38bdf8', 3, 0.8);
    drawEllipse(200, 185, 130, 32, -0.6, '#0ea5e9', 3, 0.8);
    drawEllipse(200, 190, 120, 155, -0.44, '#0284c7', 3.5, 0.85);
    drawEllipse(200, 190, 90, 150, 0.3, '#38bdf8', 3, 0.75);
    drawEllipse(200, 190, 50, 145, -0.15, '#0ea5e9', 3, 0.75);

    // Swirling arcs
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(65, 150);
    ctx.bezierCurveTo(98, 60, 260, 50, 345, 140);
    ctx.bezierCurveTo(385, 190, 350, 290, 300, 320);
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 3.5;
    ctx.globalAlpha = 0.9;
    ctx.stroke();
    ctx.restore();

    // 2. Rising Pentecost / Spirit Flames in the Center
    const flameGrad = ctx.createLinearGradient(200, 360, 200, 20);
    flameGrad.addColorStop(0, '#fed7aa');
    flameGrad.addColorStop(0.25, '#fb923c');
    flameGrad.addColorStop(0.65, '#f97316');
    flameGrad.addColorStop(1, '#ea580c');

    const innerGrad = ctx.createLinearGradient(200, 360, 200, 100);
    innerGrad.addColorStop(0, '#fef08a');
    innerGrad.addColorStop(0.4, '#f59e0b');
    innerGrad.addColorStop(1, '#dc2626');

    // Flame outer base
    ctx.save();
    ctx.fillStyle = flameGrad;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(190, 360);
    ctx.bezierCurveTo(175, 310, 185, 260, 192, 230);
    ctx.bezierCurveTo(200, 260, 212, 305, 205, 360);
    ctx.closePath();
    ctx.fill();

    // Flame inner base
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.moveTo(196, 360);
    ctx.bezierCurveTo(184, 325, 176, 275, 196, 220);
    ctx.bezierCurveTo(208, 270, 220, 320, 202, 360);
    ctx.closePath();
    ctx.fill();

    // Middle flame tongues
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(198, 285);
    ctx.bezierCurveTo(188, 235, 192, 185, 200, 130);
    ctx.bezierCurveTo(210, 170, 216, 230, 202, 285);
    ctx.closePath();
    ctx.fill();

    // Upper flame tip
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(202, 160);
    ctx.bezierCurveTo(198, 110, 200, 60, 203, 16);
    ctx.bezierCurveTo(207, 56, 212, 105, 204, 160);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. "Grandir Ensemble" Cursive Script
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.font = 'italic 500 48px "Brush Script MT", "Dancing Script", "Caveat", "Segoe Script", cursive, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Grandir Ensemble', 200, 420);
    ctx.restore();

    cachedLogoDataUrl = canvas.toDataURL('image/png');
    return cachedLogoDataUrl;
  } catch (err) {
    console.error('Logo generation fallback error:', err);
    return '';
  }
}
