/**
 * 多后端图床 - Cloudflare Workers 版本
 * 支持 Cloudinary 和 ImgBB
 */

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// JSON 响应
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// ============ Cloudinary 上传 ============
async function generateSignature(params, apiSecret) {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  const stringToSign = paramString + apiSecret;

  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function uploadToCloudinary(imageData, env) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder: 'imagebed', timestamp };
  const signature = await generateSignature(params, env.CLOUDINARY_API_SECRET);

  const formData = new FormData();
  formData.append('file', imageData);
  formData.append('api_key', env.CLOUDINARY_API_KEY);
  formData.append('timestamp', timestamp.toString());
  formData.append('folder', 'imagebed');
  formData.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  const result = await response.json();
  if (result.error) throw new Error(result.error.message);

  return {
    id: result.public_id,
    link: result.secure_url,
    width: result.width,
    height: result.height,
  };
}

// ============ ImgBB 上传 ============
async function uploadToImgBB(imageData, apiKey) {
  // 移除 data:image/xxx;base64, 前缀
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

  const formData = new FormData();
  formData.append('key', apiKey);
  formData.append('image', base64Data);

  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.error?.message || 'ImgBB upload failed');

  return {
    id: result.data.id,
    link: result.data.url,
    width: result.data.width,
    height: result.data.height,
    delete_url: result.data.delete_url,
  };
}

// ============ 主处理函数 ============
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 根路径返回前端页面
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(getHtmlPage(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // 上传接口
    if (url.pathname === '/upload' && request.method === 'POST') {
      try {
        const contentType = request.headers.get('Content-Type') || '';
        let imageData, backend = 'cloudinary';

        if (contentType.includes('application/json')) {
          const body = await request.json();
          imageData = body.image;
          backend = body.backend || 'cloudinary';
        }

        if (!imageData) {
          return jsonResponse({ success: false, error: 'No image provided' }, 400);
        }

        let result;
        if (backend === 'imgbb') {
          if (!env.IMGBB_API_KEY) {
            return jsonResponse({ success: false, error: 'ImgBB API key not configured' }, 500);
          }
          result = await uploadToImgBB(imageData, env.IMGBB_API_KEY);
        } else {
          if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
            return jsonResponse({ success: false, error: 'Cloudinary credentials not configured' }, 500);
          }
          result = await uploadToCloudinary(imageData, env);
        }

        return jsonResponse({ success: true, data: result });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    return jsonResponse({ success: false, error: 'Not found' }, 404);
  },
};

// ============ 前端页面 ============
function getHtmlPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>图床中转</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' style='stop-color:%233448c5'/><stop offset='100%25' style='stop-color:%236b7fd4'/></linearGradient></defs><rect width='32' height='32' rx='6' fill='url(%23g)'/><rect x='6' y='8' width='20' height='16' rx='2' fill='white' opacity='0.95'/><circle cx='11' cy='13' r='2' fill='%233448c5'/><path d='M8 20 L13 15 L16 18 L20 13 L24 18 L24 22 L8 22 Z' fill='%233448c5' opacity='0.7'/></svg>">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --bg-primary: #0f0f23;
      --bg-secondary: #1a1a2e;
      --bg-card: #16213e;
      --accent: #3448c5;
      --accent-glow: rgba(52, 72, 197, 0.3);
      --text: #eee;
      --text-muted: #888;
      --border: rgba(255,255,255,0.1);
      --success: #00d26a;
    }
    
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
      min-height: 100vh;
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .container { width: 100%; max-width: 520px; }
    
    h1 {
      text-align: center;
      margin-bottom: 24px;
      font-weight: 600;
      background: linear-gradient(90deg, var(--accent), #6b7fd4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-size: 2rem;
    }
    
    .backend-selector {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      justify-content: center;
    }
    
    .backend-btn {
      padding: 8px 20px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--text-muted);
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 13px;
    }
    
    .backend-btn:hover { border-color: var(--accent); }
    .backend-btn.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }
    
    .upload-zone {
      background: var(--bg-card);
      border: 2px dashed var(--border);
      border-radius: 16px;
      padding: 48px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .upload-zone:hover, .upload-zone.dragover {
      border-color: var(--accent);
      box-shadow: 0 0 30px var(--accent-glow);
      transform: translateY(-2px);
    }
    
    .upload-zone.uploading { pointer-events: none; opacity: 0.7; }
    .upload-icon { font-size: 48px; margin-bottom: 16px; }
    .upload-text { color: var(--text-muted); font-size: 14px; }
    .upload-hint { color: var(--text-muted); font-size: 12px; margin-top: 8px; }
    #fileInput { display: none; }
    
    .result {
      margin-top: 20px;
      background: var(--bg-card);
      border-radius: 12px;
      padding: 16px;
      display: none;
    }
    .result.show { display: block; animation: fadeIn 0.3s ease; }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .result-image {
      width: 100%;
      max-height: 200px;
      object-fit: contain;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    
    .result-links { display: flex; flex-direction: column; gap: 8px; }
    .link-row { display: flex; gap: 8px; align-items: center; }
    .link-label { min-width: 80px; font-size: 12px; color: var(--text-muted); }
    
    .link-input {
      flex: 1;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 12px;
      color: var(--text);
      font-size: 12px;
      font-family: 'Consolas', monospace;
    }
    
    .copy-btn {
      background: var(--accent);
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      color: white;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }
    .copy-btn:hover { opacity: 0.9; transform: scale(1.05); }
    .copy-btn.copied { background: var(--success); }
    
    .error {
      background: rgba(255, 107, 107, 0.1);
      border: 1px solid #ff6b6b;
      border-radius: 8px;
      padding: 12px;
      margin-top: 16px;
      color: #ff6b6b;
      font-size: 14px;
      display: none;
    }
    .error.show { display: block; }
    
    .progress {
      height: 4px;
      background: var(--bg-secondary);
      border-radius: 2px;
      margin-top: 16px;
      overflow: hidden;
      display: none;
    }
    .progress.show { display: block; }
    
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), #6b7fd4);
      width: 0%;
      animation: loading 1.5s ease-in-out infinite;
    }
    
    @keyframes loading {
      0% { width: 0%; }
      50% { width: 70%; }
      100% { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>图床中转</h1>
    
    <div class="backend-selector">
      <button class="backend-btn active" data-backend="cloudinary">☁️ Cloudinary</button>
      <button class="backend-btn" data-backend="imgbb">📦 ImgBB</button>
    </div>
    
    <div class="upload-zone" id="uploadZone">
      <div class="upload-icon">📤</div>
      <div class="upload-text">拖拽图片到这里，或点击选择</div>
      <div class="upload-hint">支持 Ctrl+V 粘贴 · PNG/JPG/GIF/WEBP</div>
      <input type="file" id="fileInput" accept="image/*">
    </div>
    
    <div class="progress" id="progress"><div class="progress-bar"></div></div>
    <div class="error" id="error"></div>
    
    <div class="result" id="result">
      <img class="result-image" id="resultImage" alt="Uploaded image">
      <div class="result-links">
        <div class="link-row">
          <span class="link-label">直链</span>
          <input class="link-input" id="linkUrl" readonly>
          <button class="copy-btn" data-target="linkUrl">复制</button>
        </div>
        <div class="link-row">
          <span class="link-label">Markdown</span>
          <input class="link-input" id="linkMd" readonly>
          <button class="copy-btn" data-target="linkMd">复制</button>
        </div>
        <div class="link-row">
          <span class="link-label">HTML</span>
          <input class="link-input" id="linkHtml" readonly>
          <button class="copy-btn" data-target="linkHtml">复制</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentBackend = 'cloudinary';
    
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const progress = document.getElementById('progress');
    const error = document.getElementById('error');
    const result = document.getElementById('result');

    // 后端选择
    document.querySelectorAll('.backend-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.backend-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBackend = btn.dataset.backend;
      });
    });

    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) uploadFile(e.target.files[0]);
    });

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
    });

    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          uploadFile(item.getAsFile());
          break;
        }
      }
    });

    async function uploadFile(file) {
      if (!file.type.startsWith('image/')) { showError('请选择图片文件'); return; }
      if (file.size > 10 * 1024 * 1024) { showError('图片大小不能超过 10MB'); return; }

      showProgress();
      
      try {
        const base64 = await fileToBase64(file);
        const response = await fetch('/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, backend: currentBackend }),
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Upload failed');
        showResult(data.data);
      } catch (err) {
        showError(err.message);
      }
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function showProgress() {
      error.classList.remove('show');
      result.classList.remove('show');
      progress.classList.add('show');
      uploadZone.classList.add('uploading');
    }

    function showError(msg) {
      progress.classList.remove('show');
      uploadZone.classList.remove('uploading');
      error.textContent = '❌ ' + msg;
      error.classList.add('show');
    }

    function showResult(data) {
      progress.classList.remove('show');
      uploadZone.classList.remove('uploading');
      
      document.getElementById('resultImage').src = data.link;
      document.getElementById('linkUrl').value = data.link;
      document.getElementById('linkMd').value = '![image](' + data.link + ')';
      document.getElementById('linkHtml').value = '<img src="' + data.link + '" alt="image">';
      
      result.classList.add('show');
    }

    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const input = document.getElementById(btn.dataset.target);
        await navigator.clipboard.writeText(input.value);
        btn.textContent = '✓';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('copied'); }, 1500);
      });
    });
  </script>
</body>
</html>`;
}
