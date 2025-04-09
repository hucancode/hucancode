#import "template.typ": resume, header, resume_heading, cert_item, edu_item, exp_item, project_item, skill_item

#show: resume

#header(
  name: "Bang Nguyen Huu",
  address: "千葉",
  email: "hucancode@gmail.com",
  site: "hucanco.de",
)

#resume_heading("スキル")
#skill_item(
  category: "言語",
  skills: "C, C++, Rust, Go, Typescript, Java, Kotlin, SQL / Qt, React, Svelte, NestJS, Flutter"
)
#skill_item(
  category: "ツール & OS",
  skills: "Docker, K8S, Terraform, Kafka, nginx, Redis, Linux, Android, iOS, AWS, GCP"
)

#resume_heading[職歴]
#exp_item(
  role: "Technical Leader",
  name: "NTQ Japan",
  location: "岐阜/東京",
  date: "2022/08～現在",
  [複雑で高性能な組み込みアプリケーションを開発],
)
#exp_item(
  role: "Engineering Manager",
  name: "GoodCreate",
  location: "香川",
  date: "2020/07～2022/07",
  [顧客と相談してレスポンシブで機能豊富なECウェブサイト、多プラットフォーム携帯アプリを構築],
  [エンジニアリングの生産性向上を担当。NodeJS、Flutter、iOSのトレーニング活動を実施],
)
#exp_item(
  role: "C++ Programmer",
  name: "FPT Software",
  location: "ハノイ",
  date: "2016/04～2018/03",
  [高性能で機能豊富な組み込みアプリケーションを開発],
)
#exp_item(
  role: "Game Programmer",
  name: "Gameloft",
  location: "ハノイ",
  date: "2014/03～2016/03",
  [C++、OpenGLを使用して低スペックのモバイルデバイス向けにゲームを開発、最適化],
  [Order and Chaos 2, Brothers in Arms 3, Ice Age Adventureなどの多くのゲームに貢献],
)

#resume_heading("注目のプロジェクト")
#project_item(
  name: "SDA",
  skills: "Terraform, Ansible, Kubernetes, Kafka, Go, Postgres, AWS",
  date: "2024/10～現在",
  [Leveraged ELK stack to ingress and analyze application logs data],
  [Built a fast data processor using Go to analyze proprietary dynamic binary data format],
  [Utilized Kafka Connect to support data ingress from Oracle, MSSQL, CSV, JSON],
  [Processed millions of new record daily, on just 2 medium AWS EC2 nodes],
)
#project_item(
  name: "Hi-ABT",
  skills: "Linux, Android, μITRON, Java, C, C++, TCP, シリアル",
  date: "2022/08～2024/07",
  [バス料金管理ソフトウェアシステムを構築し、リモートソフトウェア更新機構を提供],
  [TCP、シリアル、HTTPSを使用して、3種類の多くの組み込みデバイス間の複雑な通信を処理],
  [Android OSのブート手順をカスタマイズし、さまざまな修正を適用してシステムの安定性を維持],
)
#project_item(
  name: "Poker Simulator",
  skills: "Rust, WASM, Svelte",
  date: "2023/11～2023/12",
  [ポーカーゲームの勝利率計算機を作成しました（1秒あたり0.25Mゲーム）。#link("https://poker.lamsaoquenem.day")[poker]をお試しください ],
)
#project_item(
  name: "Rubik & Dragon",
  skills: "Rust, WebGPU",
  date: "2023/11～2024/02",
  [WebGPUを使用して複雑なアニメーションシーンを構築。詳細はこちら: github/hucancode/#link("https://github.com/hucancode/rubik")[rubik]と#link("https://github.com/hucancode/flying-dragon")[dragon]],
)
#project_item(
  name: "Toxy",
  skills: "Flutter, NextJS, NestJS, Google Cloud, Fastlane, Github Actions",
  date: "2021/08～2022/07",
  [要求を収集し、設計し、Flutter、NextJS、NestJSを使用して位置ベースのクーポン提供アプリを構築],
  [Cloud Runへの移行でコスト4割を減少。Fastlaneを使用して完全に自動化されたCIパイプラインを構築],
  [キャッシング/UIハイドレーションメカニズムを活用し、初回ロード後のUXを非常にスナッピーに],
)
#project_item(
  name: "AtCreator",
  skills: "Laravel, Fastlane, React Native, XCode CLI",
  date: "2020/07～2022/07",
  [ReactNativeを使用してアプリ作成システムを開発し、技術的な前提条件なしでカスタムAndroid/iOSアプリケーションを構築および公開できるようにしました。Wixのように、モバイルアプリケーション用],
  [Fastlane、NodeJS、XCode CLIを使用して自動化されたアプリ構築システムを開発]
)
#project_item(
  name: "HKMC",
  skills: "Qt, Linux, Coverity, IVI, 組み込み",
  date: "2017/02～2017/11",
  [Qtを使用して自動車の車載インフォテインメント(IVI)システム向けのメディア再生アプリケーションを構築],
  [レイジーローディングメカニズムを実装し、少ないメモリフットプリントで数千の曲を扱うように最適化],
  [メモリリークを修正し、オブジェクトコピーを減らし、システムパフォーマンスを最適化。Coverityを使用して静的解析を実施]
)
#project_item(
  name: "NSP64Bit",
  skills: "C++, マイグレーション, 静的解析",
  date: "2016/04～2017/01",
  [C++ の 200 万行のコードを 32 ビットから 64 ビット環境に移行しました],
  [C++ソースコード用の正規表現ベースの静的アナライザーを構築し、人間労力の約90%を自動化しました]
)

#resume_heading[学歴と資格]
#cert_item(
  name: "インセンティブ賞、プロフェッショナル部門",
  description: "全国情報学オリンピック",
  date: "2012"
)
#edu_item(
  name: "技術師範大学",
  degree: "ソフトエンジニアリング学士",
  location: "ベトナム",
  date: "2014"
)
#cert_item(
  name: "認定C & C++プロフェッショナルプログラマー",
  description: "C++ Institute",
  date: "2023"
)
#cert_item(
  name: "認定ソリューションアーキテクトアソシエイト",
  description: "Amazon Web Services",
  date: "2024"
)
