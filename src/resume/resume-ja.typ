#import "template.typ": resume, header, resume_heading, cert_item, edu_item, exp_item, project_item, skill_item

#show: resume

#header(
  name: "Bang Nguyen Huu",
  address: "千葉県 日本",
  email: "hucancode@gmail.com",
  site: "hucanco.de",
)

#resume_heading("スキル")
#skill_item(
  category: "言語",
  skills: "C, C++, Rust, Go, WebGPU, Vulkan, OpenGL"
)
#skill_item(
  category: "ツール・OS",
  skills: "Unreal Engine, RenderDoc, Linux, AWS, GCP"
)

#resume_heading("職務経歴")
#exp_item(
  role: "テクニカルリーダー",
  name: "NTQ Japan",
  location: "岐阜 / 東京",
  date: "2022/08 - 現在",
  [複雑で高性能な組込み・Webアプリ開発チームを統括],
)
#exp_item(
  role: "エンジニアリングマネージャー",
  name: "GoodCreate",
  location: "香川",
  date: "2020/07 - 2022/07",
  [顧客折衝を通じECサイトとクロスプラットフォームアプリを構築],
  [開発生産性向上の施策と社内研修を主導],
)
#exp_item(
  role: "C++プログラマ",
  name: "FPT Software",
  location: "ハノイ",
  date: "2016/04 - 2018/03",
  [車載向け組込みアプリを高機能化し性能を最適化],
)
#exp_item(
  role: "ゲームプログラマ",
  name: "Gameloft",
  location: "ハノイ",
  date: "2014/03 - 2016/03",
  [低スペック端末向けにC++とOpenGLでゲームを開発・高速化],
  [Order and Chaos 2、Brothers in Arms 3、Ice Age Adventureなどに参画],
)

#resume_heading("主なプロジェクト")
#project_item(
  name: "Mjolnir",
  skills: "Odin, Vulkan",
  date: "2025/01 - 現在",
  [OdinとVulkanでレンダリングエンジンを構築し、PBR・ポストプロセス・スキンドアニメ・遅延レンダリング・バインドレス管理を実装。github/hucancode/#link("https://github.com/hucancode/mjolnir")[mjolnir]],
  [RenderDocとXcodeで描画コールを解析・最適化],
  [Computeシェーダーでオクルージョンカリングとパーティクルシミュレーションを実現],
)
#project_item(
  name: "Raytracer",
  skills: "Rust, WebGPU",
  date: "2024/02 - 2024/05",
  [BVHレイトレーサーをRust+WebGPUで実装し10万ポリゴンをリアルタイム描画。github/hucancode/#link("https://github.com/hucancode/raytracer")[raytracer]],
)
#project_item(
  name: "Dragon",
  skills: "Rust, WebGPU",
  date: "2023/11 - 2024/02",
  [手続きアニメのドラゴン飛行シーンをWebGPUで制作。github/hucancode/#link("https://github.com/hucancode/flying-dragon")[dragon]],
)
#project_item(
  name: "Poker Simulator",
  skills: "Rust, WASM, Svelte",
  date: "2023/11 - 2023/12",
  [Rust+WASMで0.25M局/秒のポーカー勝率シミュレータを構築。お試しは #link("https://poker.lamsaoquenem.day")[こちら]],
)
#project_item(
  name: "SDA",
  skills: "Terraform, Ansible, Kubernetes, AWS, ELK, Kafka, Go, Postgres",
  date: "2024/10 - 2025/03",
  [ELKスタックでアプリログの収集・分析パイプラインを構築],
  [Go製高速プロセッサで独自バイナリデータ形式を解析],
  [t3.large 2台で日次数百万レコードを処理する運用を実現],
)
#project_item(
  name: "Hi-ABT",
  skills: "Linux, Android, μITRON, Java, C, C++, TCP, Serial",
  date: "2022/08 - 2024/07",
  [ハードウェアチームと連携し遠隔更新対応のバス運賃決済端末を開発],
  [TCP / Serial / HTTPSで3種の組込み機器間の複雑な通信を制御],
)
#project_item(
  name: "HKMC",
  skills: "Qt, Linux, Coverity, IVI",
  date: "2017/02 - 2017/11",
  [IVI向けQt製メディア再生アプリを開発],
  [遅延読み込みで数千曲を低メモリで扱えるよう最適化],
  [メモリリーク修正とオブジェクトコピー削減で性能改善。Coverityで静的解析],
)

#resume_heading("学歴・資格")
#cert_item(
  name: "インセンティブ賞 プロ部門",
  description: "全国情報学オリンピック",
  date: "2012"
)
#edu_item(
  name: "University of Technology and Education",
  degree: "ソフトウェア工学学士",
  location: "ベトナム",
  date: "2014"
)
#cert_item(
  name: "Knight レベル (上位2.13%)",
  description: "LeetCode",
  date: "2023"
)
#cert_item(
  name: "C & C++ Certified Professional Programmer",
  description: "C++ Institute",
  date: "2023"
)
#cert_item(
  name: "AWS 認定ソリューションアーキテクト アソシエイト",
  description: "Amazon Web Services",
  date: "2024"
)
