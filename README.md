# 图床中转

支持多后端的图床服务，可部署到 **Cloudflare Pages** 和 **Vercel**。

## ✨ 功能

- 📤 拖拽 / 点击 / 粘贴上传
- 🔗 一键复制直链、Markdown、HTML
- ☁️ 支持 Cloudinary 和 ImgBB 双后端
- 🎨 精美深色界面

## 🚀 一键部署

### Cloudflare Pages

1. **Fork 本仓库**

2. **登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)**

3. **创建 Pages 项目**：
   - 进入 **Workers & Pages** → **Create**
   - 选择 **Pages** → **Connect to Git**
   - 选择你 fork 的仓库
   - 构建设置：
     - **Root directory**: `cloudflare-pages`
     - **Build command**: 留空
     - **Build output directory**: `public`

4. **设置环境变量**（Settings → Environment Variables）：
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `IMGBB_API_KEY`

5. **重新部署**

---

### Vercel

1. **Fork 本仓库**

2. **在 [Vercel](https://vercel.com/) 导入项目**
   - Root Directory 选择 `vercel`

3. **设置环境变量**：
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `IMGBB_API_KEY`

4. **部署**

---

### 本地 Workers 开发

```bash
cd cloudflare-workers
cp wrangler.example.toml wrangler.toml
# 编辑 wrangler.toml 填入密钥
npx wrangler dev
```

## 🔑 获取 API 密钥

| 服务 | 获取地址 |
|------|---------|
| Cloudinary | https://cloudinary.com/ (Dashboard) |
| ImgBB | https://api.imgbb.com/ |

## 📁 项目结构

```
├── cloudflare-pages/      # CF Pages 部署（推荐）
│   ├── functions/upload.js
│   └── public/index.html
├── cloudflare-workers/    # CF Workers 本地开发
│   ├── src/index.js
│   └── wrangler.example.toml
├── vercel/                # Vercel 部署
│   ├── api/upload.js
│   ├── public/index.html
│   └── vercel.json
└── README.md
```

## 📝 License

MIT
