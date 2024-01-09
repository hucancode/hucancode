#import "template.typ": resume, header, resume_heading, cert_item, edu_item, exp_item, project_item, skill_item

#show: resume

#header(
  name: "Bang Nguyen Huu",
  address: "岐阜、日本",
  email: "hucancode@gmail.com",
  site: "hucanco.de",
)

#resume_heading("技術的なスキル")
#skill_item(
  category: "言語、フレームワーク",
  skills: "Rust、C++、GLSL、HLSL、Typescript、CSS、Java、Kotlin、SQL　・　OpenGL、nginx、NextJS, React、Vue、Svelte、ThreeJS、Tailwind、NestJS、Strapi、Flutter、MySQL、WebGPU"
)
#skill_item(
  category: "OS",
  skills: "Windows、Mac、Linux (Debian、Arch、RHEL)、Android、iOS"
)
#skill_item(
  category: "コミュニケーション",
  skills: "ベトナム語（母国語）・日本語（JLPT N2）・英語（TOEIC 945）"
)

#resume_heading("証明書")
#cert_item(
  name: "プロフェッショナル部門 奨励賞",
  description: "全国情報オリンピック",
  date: "2012"
)
#cert_item(
  name: "C++ 認定プロフェッショナル プログラマー",
  description: "C++ Institute",
  date: "2023"
)

#resume_heading[経験]
#exp_item(
  role: "システムエンジニア",
  name: "NTQ Japan",
  location: "岐阜、日本",
  date: "2022年8月～現在",
  [バスや電車で使用される複雑で高性能な組み込みアプリケーションを構築],
  [Vue、Django を使用してフルスタック Web アプリケーションを保守],
  [ソフトウェア要件のヒアリング、入札、提案活動に参加],
)
#exp_item(
  role: "エンジニアマネージャー",
  name: "グッドクリエイト",
  location: "香川、日本",
  date: "2020年7月～2022年8月",
  [クライアントとコミュニケーションをとり、レスポンシブで機能豊富な EC ウェブサイトを構築します],
  [ネットワーキング、Linux、HTML/CSS、React、Flutter に関するトレーニングを受け、チーム メンバーを育成します],
  [フル機能を備えたパフォーマンスの高いクロスプラットフォーム モバイル アプリケーションを構築],
  [最新の HTML/CSS を利用して、審美性に優れた EC Web アプリケーションを構築],
  [Laravel、NodeJS、nginx で書かれた Web バックエンドを維持。 手動と自動の両方の方法で HTTPS をサポートする],
)
#exp_item(
  role: "C++エンジニア",
  name: "FPT Software",
  location: "ハノイ、ベトナム",
  date: "2019年5月～2019年7月",
  [大規模な C++ コードベースで作業しました。 Coverity を使用して静的解析を実行しました],
  [高性能で機能豊富な組み込みアプリケーションを開発],
)
#exp_item(
  role: "ゲームプログラマー",
  name: "Gameloft HAN",
  location: "ハノイ、ベトナム",
  date: "2014年3月～2016年3月、2018年4月～11月",
  [C++、OpenGL、GLSL、HLSL、Android NDK、Box2D、Unity3D でゲームを動作],
  [ローエンドのモバイル デバイスで実行できるように分析され、最適化された複雑なゲーム],
  [大規模で複雑な C++ プロジェクトとビルド システムを扱う],
  [貢献作品: Order and Chaos 2、Brothers in Arms 3、Ice Age Adventure、Shark Dash、その他多くのゲーム],
)

#resume_heading("案件")
#project_item(
  name: "Hi-ABT",
  skills: "Linux、Android、Java、C++、TCP/IP、Serial",
  date: "2022年3月～現在",
  [ベアメタルデバイスを操作し、低レベル信号を処理しました],
  [バス運賃を管理するソフトウェアシステムを構築。 Java、C++、組み込みデバイスで動作],
  [リモート制御によるソフトウェア更新メカニズムの実装],
  [TCP、ソケット通信、REST APIを扱いました。 LAN、シリアル、LTE などのさまざまな接続戦略を使用して、多くのデバイス間の複雑な通信を処理します],
  [カスタマイズされたAndroid OSを維持。 システムの起動手順を調整しました。 カスタマイズされたストックアプリケーション。 さまざまな修正を実行し、システムの安定性を維持しました],
)
#project_item(
  name: "Toxy",
  skills: "Flutter、NextJS、NestJS、Google Cloud、Fastlane、Github Actions",
  date: "2021年8月～2022年8月",
  [ユーザーの位置情報に基づいてクーポンを提供するアプリを構築しました。 NestJS を備えたスケーラブルなバックエンド サーバーを搭載し、月額 7万円/10万円のアクティブ ユーザー 5万/10万人を処理できるように構築されています],
  [マイクロサービス アーキテクチャを設計し、Docker と Cloud Run を利用することで、潜在的なサーバー コストを削減します。 従来の方法と比較して推定約 40% の節約],
  [API キャッシュ/UI ハイドレーション メカニズムを利用し、最初の初期読み込み後の UX の読み込みが実質的にゼロで、応答性の高いアプリが実現しました],
  [Fastlane と Github Actions を使用して完全に自動化された CI パイプラインを構築],
)
#project_item(
  name: "AtCreator",
  skills: "Laravel、Fastlane、React Native、XCode CLI",
  date: "2020年7月～2022年7月",
  [アプリ作成システムを管理し、ユーザーが技術的な前提条件なしでカスタム Android/iOS アプリケーションを構築できるようにしました],
  [Laravel、Fastlane、Nodejs、XCode を使用した自動アプリ構築システムを保守],
  [高度にカスタマイズ可能な React Native アプリケーションを構築し、レストラン、アパレル ショップ、ホテル、タクシー サービスなど、さまざまな種類のアプリケーションに適した機能セットを備えた 9 つの異なるテーマを提供します],
)
#project_item(
  name: "HKMC",
  skills: "Qt、Linux、IVI、組み込み",
  date: "2017年2月～2017年11月",
  [#emph("Qt") を使用した自動車車載インフォテインメント (IVI) システム用のメディア再生アプリケーションの構築],
  [遅延読み込みメカニズムを実装し、少ないメモリ使用量で数千の曲を処理],
  [大規模な C++ コード ベースで動作しました。Coverity を静的解析に活用],
)
#project_item(
  name: "NSP64Bit",
  skills: "C++、移行、文字列マッチング",
  date: "2016年4月～2017年1月",
  [C++、メモリ管理、64 ビットコーディングパターンを使用],
  [200万行のコードを含む大規模なC++コードベースで作業しました],
  [Solo は、手作業の約 90% を削減する静的アナライザーを開発しました。 分析された C++ コード コンテンツ、正規表現を使用した構造化コンテンツの処理],
)

#resume_heading[Education]
#edu_item(
  name: "フンヤン技術師範大学",
  degree: "ソフトウェアエンジニアリング学士号",
  location: "フンヤン、ベトナム",
  date: "2010年9月～2014年6月"
)
#edu_item(
  name: "水野外語学院",
  degree: "日本語",
  location: "千葉、日本",
  date: "2018年4月～2019年4月"
)