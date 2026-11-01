# 原神 / 星穹铁道 / 绝区零 抽卡记录导出工具（合并版）

一个使用 Electron 制作的小工具，需要在 Windows 64 位操作系统上运行。一个应用同时管理【原神祈愿 / 星穹铁道跃迁 / 绝区零调频】三个游戏的抽卡记录，通过左上角的游戏图标切换。

通过读取游戏日志或者代理模式获取访问游戏抽卡记录 API 所需的 authKey，然后再使用获取到的 authKey 来读取游戏抽卡记录。

本项目的三个上游本就是同一条代码谱系，合并后游戏差异全部收敛在 `src/games/<游戏>/`，主流程与上游保持同构以便跟进更新：

| 游戏 | 基于的上游 | 说明 |
|---|---|---|
| 原神 | [biuuu/genshin-wish-export](https://github.com/biuuu/genshin-wish-export) | 原型 |
| 崩坏：星穹铁道 | [biuuu/star-rail-warp-export](https://github.com/biuuu/star-rail-warp-export) | 由 genshin 版修改而来 |
| 绝区零 | [earthjasonlin/zzz-signal-search-export](https://github.com/earthjasonlin/zzz-signal-search-export) | 由 star-rail 版修改而来 |

## 特性

- 左上角三个游戏图标点击切换，各游戏的记录数据、当前账号、界面语言相互独立
- 每个游戏沿用各自上游的取数实现（日志路径、缓存解析、API 端点、卡池定义）
- Excel 导出（含 rawData 页）、[UIGF v4](https://uigf.org/) 导入/导出；导入时按 `hk4e`/`hkrpg`/`nap` 键自动分发，**支持一个 UIGF 文件里包含多个游戏的数据**
- 旧版单游戏工具 userData 根目录下的 `gacha-list-*.json` 会按内容自动识别归属游戏并迁移（旧原神数组格式自动转为对象格式）
- 多账号导出（加号按钮）、多语言、代理模式等上游功能保留

## 使用说明

1. 下载并解压工具（见下方 [Development](#development) 自行构建，或到 [Releases](https://github.com/chengwuren/gacha-export-merged/releases) 下载）
2. 点击左上角图标选择要读取的游戏
3. 打开对应游戏的抽卡详情页面
   - 原神：祈愿详情页
   - 星穹铁道：跃迁详情页
   - 绝区零：调频详情页
4. 点击工具的"加载数据"按钮

如果没出什么问题的话，你会看到正在读取数据的提示，读取完成后即可查看统计并导出。

如果需要导出多个账号的数据，可以点击旁边的加号按钮，游戏内切换到新账号再打开抽卡历史记录，工具再点击"加载数据"按钮。

> 首次拉取某个游戏的全量历史需要几分钟（页码提示会持续滚动），属正常现象。

## Development

```
# 安装模块
yarn install

# 开发模式
yarn dev

# 构建一个可以运行的程序
yarn build

# 单元测试
yarn test
```

游戏差异全部集中在 `src/games/<游戏>/`（API 端点、日志路径、卡池定义、语言包、UIGF 实现等），主流程位于 `src/main/` 与 `src/renderer/`。新增游戏只需要在 `src/games/` 下添加一个目录并注册。

## 跟进上游更新

三个上游仍在活跃维护（authKey 机制、idJson 词表等会不定期更新），本仓库采用"共享文件与上游同构 + cherry-pick"的方式跟进，具体流程见 [SYNC.md](SYNC.md)。

## 与上游的差异

- 界面以 star-rail 版为基底，新增游戏图标切换；各游戏的统计组件随游戏切换
- 原神上游的「从 Excel 恢复数据」「GitHub Gist 同步」「配套网页工具」未合并（Gist 在上游已停用）
- 原神的 UIGF v4 导出直接使用 API 返回的 item_id（上游在缺失时会请求外部服务按名称反查）
- 自动更新暂未启用

## 其它语言

修改 `src/games/<游戏>/i18n/` 目录下的 json 文件就可以翻译到对应的语言。如果觉得已有的翻译有不准确或可以改进的地方，欢迎发 Pull Request。

## License

本项目及三个上游均为 [MIT](LICENSE) 协议。感谢 [biuuu](https://github.com/biuuu) 与 [earthjasonlin](https://github.com/earthjasonlin) 的原始工作。
