export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Halaman gagal dimuat</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #0b0d14; color: #f1efe8; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #9aa0b4; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #f0b04a; color: #231806; }
      .secondary { background: transparent; color: #f1efe8; border-color: #3a3f55; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Halaman ini gagal dimuat</h1>
      <p>Ada masalah di sisi kami. Coba muat ulang atau kembali ke beranda.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Coba lagi</button>
        <a class="secondary" href="/">Ke beranda</a>
      </div>
    </div>
  </body>
</html>`;
}
