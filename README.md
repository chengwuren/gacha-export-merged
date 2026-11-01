# Gacha Export Merged

把三个同源的原神/星穹铁道/绝区零抽卡记录导出工具合并成一个应用:

- [biuuu/genshin-wish-export](https://github.com/biuuu/genshin-wish-export)(原型)
- [biuuu/star-rail-warp-export](https://github.com/biuuu/star-rail-warp-export)(由 genshin 版修改而来)
- [earthjasonlin/zzz-signal-search-export](https://github.com/earthjasonlin/zzz-signal-search-export)(由 star-rail 版修改而来)

三个项目 ~85% 代码同源,本仓库把"每个游戏不同的部分"收敛到 `src/games/<游戏>/`,
主流程(`src/main/`、`src/renderer/` 共享逻辑)只依赖配置层接口,一个应用管理三个游戏的抽卡记录。
三个上游均为 MIT 协议,本仓库同以 MIT 发布。(上游原 README 见 [README.upstream.md](README.upstream.md))

## 功能

- 启动后左上角切换游戏(原神 / 星穹铁道 / 绝区零),各游戏数据、当前 UID、语言相互独立
- 每个游戏沿用各自的取数方式:读游戏日志 → 缓存 → authKey → 官方 API 拉取记录
- Excel 导出(含 rawData 页)、UIGF v4 导入/导出;导入时按 `hk4e`/`hkrpg`/`nap` 键分发,
  支持一个 UIGF 文件里包含多个游戏的数据
- 旧版单游戏应用存在 `userData` 根目录的 `gacha-list-*.json` 会被按内容自动识别归属游戏并搬移
  (旧原神数组格式会自动转为对象格式)
- 代理模式、多语言、多账号、数据管理等上游功能保留

## 目录结构

```
src/
  games/               # 游戏差异层(合并的核心)
    index.js           # 注册表:getGame/setGame/getGameInfo
    genshin/           # game.js + gachaType.json + idJson? + i18n/ + uigf.js (+schema/)
    starrail/
    zzz/
  main/                # 主进程共享逻辑(文件名与上游保持一致)
    getData.js         # 取数主流程(按 game 配置参数化)
    excel.js / i18n.js / utils.js / config.js / bridge.js
    UIGFJson.js        # UIGF 调度器(按游戏键分发)
  renderer/            # 界面(SR 版为基底 + 游戏选择器)
    components/games/<id>/   # 每游戏的展示组件(GachaDetail/PieChart)
```

`game.js` 承载全部游戏差异:API 域名/路径/参数名、日志与缓存路径正则、卡池定义、
星级刻度、Excel 样式、i18n 语言包、物品类型词表、渲染层展示参数等。

## 开发

```bash
yarn install
yarn dev      # 开发(会启动 Electron 窗口)
yarn build    # 打包
yarn test     # jest 单测(mergeData)
```

仅支持 Windows 64 位(与上游一致)。

## 上游同步

见 [SYNC.md](SYNC.md)。

## 已知差异 / 未合并项

- genshin 上游的「Excel 恢复数据 / local-data 导入」「GitHub Gist 同步」「配套网页 Excel→JSON」
  未合并(Gist 在上游已被注释停用)
- genshin 的 UIGF v4 导出:上游在 item_id 缺失时会请求外部服务按名称反查;
  合并版直接使用 API 返回的 item_id,缺失则导出为空字符串
- 界面以 star-rail 版为基底,zzz 版重排过的界面样式未采用(功能已对齐:复制API地址、隐藏常驻池)
- zzz 语言包仅上游提供的 3 种(简中/繁中/英文),其他语言回退英文
- 自动更新已禁用(原更新源会把应用更新回单游戏版),待本仓库有自己的发布渠道后启用
