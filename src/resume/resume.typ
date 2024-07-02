#import "template.typ": resume, header, resume_heading, cert_item, edu_item, exp_item, project_item, skill_item

#show: resume

#header(
  name: "Bang Nguyen Huu",
  address: "Gifu, Japan",
  email: "hucancode@gmail.com",
  site: "hucanco.de",
)

#resume_heading("Skills")
#skill_item(
  category: "Languages",
  skills: "C, C++, Rust, Typescript, Java, Kotlin, SQL / Qt, React, Svelte, NestJS, Flutter, WebGPU, OpenGL"
)
#skill_item(
  category: "Tools & OS",
  skills: "NodeJS, Docker, nginx, Redis, Linux, Android, iOS, AWS, GCP, Unreal Engine"
)

#resume_heading[Experience]
#exp_item(
  role: "Onsite Leader",
  name: "NTQ Japan",
  location: "Gifu",
  date: "2022/08 - Present",
  [Built complex and performant embedded applications],
)
#exp_item(
  role: "Engineering Manager",
  name: "GoodCreate",
  location: "Kagawa",
  date: "2020/07 - 2022/07",
  [Communicated with end clients to build responsive feature-rich EC websites, cross platform mobile applications],
  [In charge of engineering productivity. Conducted NodeJS, Flutter, iOS training activity],
)
#exp_item(
  role: "C++ Programmer",
  name: "FPT Software",
  location: "Hanoi",
  date: "2016/04 - 2018/03",
  [Developed performant and feature-rich embedded applications],
)
#exp_item(
  role: "Game Programmer",
  name: "Gameloft",
  location: "Hanoi",
  date: "2014/03 - 2016/03",
  [Developed, and optimized games for low-end mobile devices using C++, OpenGL],
  [Contributed in: Order and Chaos 2, Brothers in Arms 3, Ice Age Adventure, and many other games],
)

#resume_heading("Notable Projects")
#project_item(
  name: "Hi-ABT",
  skills: "Linux, Android, μITRON, Java, C, C++, TCP, Serial",
  date: "2022/08 - Present",
  [Built software system to manage bus fare, with remote software update mechanics],
  [Handled complex communications between many embedded devices of 3 types, using TCP, Serial, HTTPS],
  [Customized Android OS boot procedure, applied various fixes and maintained system stability],
)
#project_item(
  name: "Poker Simulator",
  skills: "Rust, WASM, Svelte",
  date: "2023/11 - 2023/12",
  [Built a tool to calculate winning odds in a poker game *fast*. Try it #link("https://poker.lamsaoquenem.day")[live]],
)
#project_item(
  name: "Rubik & Dragon",
  skills: "Rust, WebGPU",
  date: "2023/11 - 2024/02",
  [Built complex animated scene using WebGPU. See more: github/hucancode/#link("https://github.com/hucancode/rubik")[rubik] and #link("https://github.com/hucancode/flying-dragon")[dragon]],
)
#project_item(
  name: "Toxy",
  skills: "Flutter, NextJS, NestJS, Google Cloud, Fastlane, Github Actions",
  date: "2021/08 - 2022/07",
  [Collect requirements, design and built a location-based coupon offering app with Flutter, NextJS, NestJS],
  [Optimized 40% server cost by migrating to Cloud Run. Built a fully automated CI pipeline with Fastlane],
  [Utilized caching/UI hydration mechanic, resulting in highly snappy UX after first load],
)
#project_item(
  name: "AtCreator",
  skills: "Laravel, Fastlane, React Native, XCode CLI",
  date: "2020/07 - 2022/07",
  [Developed an app making system using ReactNative, allowing users to build and publish custom Android/iOS application with no technical prerequisite. Similar to Wix, but for mobile application],
  [Developed an automated app building system, using Fastlane, NodeJS, XCode CLI]
)
#project_item(
  name: "HKMC",
  skills: "Qt, Linux, Coverity, IVI, Embedded",
  date: "2017/02 - 2017/11",
  [Built media playing application for automotive in-vehicle infotainment (IVI) system using Qt],
  [Implemented lazy loading mechanic, optimized to handling thousands of songs with small memory footprint],
  [Fixed memory leaks, reduced object copy, optimized system performance. Utilized Coverity for static analysis]
)
#project_item(
  name: "NSP64Bit",
  skills: "C++, Migration, Static Analysis",
  date: "2016/04 - 2017/01",
  [Worked with C++, memory management, 64bit coding patterns in a large code base with 2M LOC],
  [Developed a static analyzer to help cutting about 90% of human effort. Analyzed C++ code content, process structured content with Regular Expression]
)

#resume_heading[Education & Certifications]
#cert_item(
  name: "Incentive Prize, Professional Division",
  description: "National Olympiad of Informatics",
  date: "2012"
)
#edu_item(
  name: "University of Technology and Education",
  degree: "BSc Software Engineering",
  location: "Vietnam",
  date: "2014"
)
#cert_item(
  name: "C & C++ Certified Professional Programmer",
  description: "C++ Institute",
  date: "2023"
)
#cert_item(
  name: "Certified Solution Architect Associate",
  description: "Amazon Web Services",
  date: "2024"
)