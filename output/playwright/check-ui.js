async (page) => {
  const url = "http://127.0.0.1:3000";

  async function canvasStats() {
    return page.locator("canvas").first().evaluate((canvas) => {
      const target = canvas;
      const gl = target.getContext("webgl2") || target.getContext("webgl");
      if (!gl) {
        return { ok: false, reason: "No WebGL context" };
      }

      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let samples = 0;
      let lit = 0;
      const bins = new Set();
      const step = Math.max(4, Math.floor(Math.min(width, height) / 80));

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const index = (y * width + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const a = pixels[index + 3];
          samples += 1;
          if (a > 0 && r + g + b > 48) {
            lit += 1;
          }
          bins.add(`${Math.floor(r / 32)}-${Math.floor(g / 32)}-${Math.floor(b / 32)}-${Math.floor(a / 64)}`);
        }
      }

      return {
        ok: width > 0 && height > 0 && lit > samples * 0.08 && bins.size > 8,
        width,
        height,
        samples,
        lit,
        colorBins: bins.size
      };
    });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 30000 });
  await page.waitForTimeout(1800);
  const desktopCanvas = await canvasStats();
  await page.screenshot({ path: "output/playwright/desktop-modeling.png", fullPage: false });

  await page.getByRole("button", { name: "装修报告" }).click();
  await page.waitForTimeout(500);
  const reportVisible = await page.getByText("装修建议与报告").isVisible();
  await page.screenshot({ path: "output/playwright/desktop-renovation.png", fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobileCanvas = await canvasStats();
  await page.screenshot({ path: "output/playwright/mobile-renovation.png", fullPage: false });

  return {
    desktopCanvas,
    mobileCanvas,
    reportVisible,
    viewport: await page.viewportSize(),
    title: await page.title()
  };
}
