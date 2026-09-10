/* Adapt the published QRCode.js browser API to the canvas API used by this app. */
'use strict';
(function (root) {
  function install() {
    const Constructor = root.QRCode;
    if (typeof Constructor !== 'function' || Constructor.toCanvas) return;
    Constructor.toCanvas = async function (canvas, text, options = {}) {
      if (!canvas?.getContext) throw new Error('El lienzo QR no esta disponible.');
      const size = Math.min(1024, Math.max(128, Number(options.width) || 280));
      const margin = Math.max(8, (Number(options.margin) || 2) * 4);
      const holder = document.createElement('div');
      // QRCode.js renders synchronously into a canvas on supported browsers.
      new Constructor(holder, { text: String(text), width: size - margin * 2, height: size - margin * 2,
        colorDark: options.color?.dark || '#111111', colorLight: options.color?.light || '#ffffff',
        correctLevel: Constructor.CorrectLevel?.[options.errorCorrectionLevel || 'M'] ?? 0 });
      const source = holder.querySelector('canvas');
      if (!source) throw new Error('Este navegador no permite generar el QR.');
      canvas.width = size; canvas.height = size;
      const context = canvas.getContext('2d');
      context.fillStyle = options.color?.light || '#ffffff'; context.fillRect(0, 0, size, size);
      context.drawImage(source, margin, margin);
    };
  }
  root.KioscoQr = Object.freeze({ install });
  install();
})(globalThis);
