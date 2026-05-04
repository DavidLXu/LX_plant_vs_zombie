# Garden Defense

一个用 Vite、TypeScript 和 Phaser 写的静态网页塔防小游戏。玩法灵感来自经典草坪塔防：收集阳光、放置植物、抵御分路进攻，并在防线被突破前守住花园。

## 在线部署

这个项目可以直接部署到 GitHub Pages。当前仓库名是 `LX_plant_vs_zombie`，生产构建的静态资源路径已经在 `vite.config.ts` 中配置为：

```ts
base: '/LX_plant_vs_zombie/'
```

推送到 `main` 后，GitHub Actions 会自动构建并发布 `dist` 到 GitHub Pages。

部署完成后，页面地址通常是：

```text
https://davidlxu.github.io/LX_plant_vs_zombie/
```

如果第一次使用 GitHub Pages，需要在仓库的 `Settings -> Pages` 中确认 Source 选择 `GitHub Actions`。

## 本地运行

```bash
npm install
npm run dev
```

打开终端输出的本地地址，例如：

```text
http://127.0.0.1:5173/
```

## 构建

```bash
npm run build
```

构建产物会生成在 `dist/` 目录。`dist/` 不需要手动提交，GitHub Actions 会在部署时自动生成。

## 游戏操作

- 点击植物卡牌，再点击草坪格子进行种植。
- 点击阳光可以收集资源。
- 点击铲子可以移除已有植物。
- 空格键暂停或继续游戏。
- `R` 键重新开始。

## 技术栈

- Vite
- TypeScript
- Phaser
- GitHub Actions
- GitHub Pages
