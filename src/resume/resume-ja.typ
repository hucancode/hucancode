#import "template.typ": resume, header, resume_heading, cert_item, edu_item, exp_item, project_item, skill_item

#show: resume

#header(
  name: "Bang Nguyen Huu",
  address: "岐阜県、日本",
  email: "hucancode@gmail.com",
  site: "hucanco.de",
)

#resume_heading("技術的なスキル")
#skill_item(
  category: "言語",
  skills: "C, C++, Rust, Typescript, Java, Kotlin, SQL"
)
#skill_item(
  category: "フレームワーク",
  skills: "Qt, ReactiveX, React, Svelte, Tailwind, NestJS, Flutter, WebGPU, OpenGL"
)
#skill_item(
  category: "ツール　＆　OS",
  skills: "NodeJS, Docker, nginx, Redis, Linux (CentOS, Debian, Arch), Android, iOS, AWS, GCP"
)

#resume_heading[経歴]
#exp_item(
  role: "システムエンジニア",
  name: "NTQ Japan",
  location: "岐阜県、日本",
  date: "2022年8月～現在",
  [複雑でパフォーマンスの高い組み込みアプリケーションを構築],
)
#exp_item(
  role: "エンジニアマネージャー",
  name: "グッドクリエイト",
  location: "香川県、日本",
  date: "2020年7月～2022年8月",
  [クライアントとコミュニケーションをとり、レスポンシブで機能豊富な EC ウェブサイトを構築します],
  [Flutter、NodeJS、nginx を使用して作成されたフル機能のパフォーマンスの高いクロスプラットフォーム モバイル アプリケーションと Web バックエンドを構築],
)
#exp_item(
  role: "C++エンジニア",
  name: "FPT Software",
  location: "ハノイ、ベトナム",
  date: "2019年5月～2019年7月",
  [高性能で機能豊富な組み込みアプリケーションを開発],
)
#exp_item(
  role: "ゲームプログラマー",
  name: "Gameloft HAN",
  location: "ハノイ、ベトナム",
  date: "2014年～2016年3月、2018年4月～11月",
  [C++、OpenGL、Android NDK、Unity3D を使用し、大規模なコード ベースと複雑なビルド システムを使用してローエンド モバイル デバイス向けにゲームを開発および最適化],
  [貢献作品: Order and Chaos 2、Brothers in Arms 3、Ice Age Adventure、Shark Dash、その他多くのゲーム],
)

#resume_heading("注目案件")
#project_item(
  name: "Hi-ABT",
  skills: "Linux、Android、Java、C++、TCP/IP、Serial",
  date: "2022年8月～現在",
  [バス運賃を管理するソフトウェアシステムを構築],
  [リモート ソフトウェア アップデートの仕組みを実装],
  [TCP、シリアル、HTTPS を使用して、4 つの異なる OS を実行するデバイス間の複雑な通信を処理],
  [OSネットワーク設定手順の実装、静的IP、ルートテーブル、インターネットゲートウェイ、DNSの管理],
  [カスタマイズされた Android OS 起動手順、さまざまな修正を適用し、システムの安定性を維持],
)
#project_item(
  name: "Toxy",
  skills: "Flutter、NextJS、NestJS、Google Cloud、Fastlane、Github Actions",
  date: "2021年8月～2022年8月",
  [ユーザーの位置情報に基づいてクーポンを提供するアプリを構築しました。 NestJS を備えたスケーラブルなバックエンド サーバーを搭載し],
  [マイクロサービス アーキテクチャを設計し、Docker と Cloud Run を利用することで、潜在的なサーバー コストを削減します。 従来の方法と比較して推定約 40% の節約],
  [API キャッシュ/UI ハイドレーション メカニズムを利用し、最初の初期読み込み後の UX の読み込みが実質的に、応答性の高いアプリが実現しました],
  [Fastlane と Github Actions を使用して完全に自動化された CI パイプラインを構築],
)
#project_item(
  name: "AtCreator",
  skills: "Laravel、Fastlane、React Native、XCode CLI",
  date: "2020年7月～2022年7月",
  [ReactNative を使用したアプリ作成システムを開発し、ユーザーが技術的な前提条件なしでカスタム Android/iOS アプリケーションを構築および公開できるようにしました。 Wix に似ていますが、モバイル アプリケーション向けです],
  [Fastlane、Nodejs、XCode を使用して自動化されたアプリ構築システムを保守],
)
#project_item(
  name: "HKMC",
  skills: "Qt、Linux、IVI、組み込み",
  date: "2017年2月～2017年11月",
  [Qtを使用した自動車車載インフォテインメント (IVI) システム用のメディア再生アプリケーションの構築],
  [遅延読み込みメカニズムを実装し、少ないメモリ使用量で数千の曲を処理],
  [メモリ リークを修正し、オブジェクト コピーを削減し、システム パフォーマンスを最適化しました。 Coverity を静的解析に活用],
)
#project_item(
  name: "NSP64Bit",
  skills: "C++、マイグレーション、文字列マッチング",
  date: "2016年4月～2017年1月",
  [200万行のコードを含む大規模なコードベースでC++、メモリ管理、64ビットコーディングパターンを使用],
  [手作業の約 90% を削減できる静的アナライザーを単独で開発しました。 分析された C++ コード コンテンツ、正規表現を使用した構造化コンテンツの処理],
)

#resume_heading[学歴、証明書]
#edu_item(
  name: "フンヤン技術師範大学",
  degree: "ソフトウェアエンジニアリング学士号",
  location: "フンヤン、ベトナム",
  date: "2014"
)
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
