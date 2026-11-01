# 上游同步指南

本仓库与三个上游不再是 fork 关系,同步方式是"看上游改了什么,把共享逻辑的改动移植过来"。
核心原则:**共享文件(`src/main/`、`src/renderer/`)保持与上游同名、同结构;所有游戏差异只放进上游不存在的 `src/games/`**。这样上游对共享逻辑的修复基本可以干净地 cherry-pick。

## 一次性配置

在 `upstream/` 已有三个克隆(或重新添加为 remote):

```bash
git remote add genshin  https://github.com/biuuu/genshin-wish-export.git
git remote add starrail https://github.com/biuuu/star-rail-warp-export.git
git remote add zzz      https://github.com/earthjasonlin/zzz-signal-search-export.git
```

## 定期同步流程

```bash
git fetch genshin starrail zzz

# 1. 看每个上游有哪些新提交(重点是共享逻辑)
git log HEAD..starrail/main --oneline
git log HEAD..zzz/main --oneline
git log HEAD..genshin/main --oneline

# 2. 只看共享文件的改动(游戏专属改动会落在上游自己的文件里,参考价值低)
git log HEAD..starrail/main --oneline -- src/main src/renderer
git diff HEAD starrail/main -- src/main/getData.js   # 逐文件确认

# 3. 移植:能干净落上的直接 cherry-pick;有冲突的手动改到对应位置
git cherry-pick <commit>
```

## 改动落点对照(上游文件 → 本仓库)

| 上游改动内容 | 本仓库落点 |
|---|---|
| `src/main/getData.js` 中共享流程(合并、重试、代理…) | `src/main/getData.js` |
| getData 里的游戏常量(域名/路径/卡池) | `src/games/<id>/game.js` |
| `src/main/excel.js` 列/样式 | `src/main/excel.js`(游戏参数在 game.js) |
| `src/main/i18n.js` 解析逻辑 | `src/main/i18n.js`(语言包在 games/<id>/i18n/) |
| `src/main/utils.js` 通用函数 | `src/main/utils.js` |
| `src/main/UIGFJson.js` | `src/main/UIGFJson.js` + `games/<id>/uigf.js` |
| `src/renderer/App.vue` 界面逻辑 | `src/renderer/App.vue` |
| `GachaDetail.vue`/`PieChart.vue` | `src/renderer/components/games/<id>/` |
| `src/gachaType.json`、`src/idJson.json`、i18n JSON | `src/games/<id>/` 下同名文件 |
| zzz 的 `idJson` 更新提交(idmap 机器人) | `src/games/zzz/idJson.json`(tools/getIdMap.py 需自行适配路径) |

## 注意

- 上游若重构了数据格式(如原神未来改对象格式),需要评估 games/<id>/game.js 里的
  `langNormalize`/`normalizeGenshinRow` 兼容逻辑
- `config.json` 的 `currentGame`/`uidByGame` 是本仓库新增字段,上游的 config.js 改动
  合并时注意保留
- zzz 仓库同时是 star-rail 仓库的下游:zzz 对共享逻辑的改动如果 biuuu 两仓还没有,
  大概率是 zzz 专属功能,落到 games/zzz/ 或先观察
- 上游的 `idmap.yml`(idJson 自动更新机器人)已从本仓库移除:它依赖上游的 GH_PAT
  密钥和 `src/idJson.json` 旧路径。上游的 idJson 更新提交仍按上表手动合并到
  `src/games/<id>/idJson.json`
- 本地测试:`yarn test`(单元)+ `node tools/e2e-test.mjs`(合成数据全链路 E2E,
  会自动备份/恢复 dist/userData)
