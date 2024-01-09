#import "template.typ": resume, header, resume_heading, cert_item, edu_item, exp_item, project_item, skill_item

#show: resume

#header(
  name: "Bang Nguyen Huu",
  address: "Gifu, Japan",
  email: "hucancode@gmail.com",
  site: "hucanco.de",
)

#resume_heading("Technical Skills")
#skill_item(
  category: "Languages & Frameworks",
  skills: "Rust, C++, GLSL, HLSL, Typescript, CSS, Java, Kotlin, SQL / OpenGL, nginx, NextJS, React, Vue, Svelte, ThreeJS, Tailwind, NestJS, Strapi, Flutter, MySQL, WebGPU"
)
#skill_item(
  category: "OS",
  skills: "Windows, Mac, Linux (Debian, Arch, RHEL), Android, iOS"
)
#skill_item(
  category: "Communication",
  skills: "Vietnamese (Native), Japanese (JLPT N2), English (TOEIC 945)"
)

#resume_heading("Certifications")
#cert_item(
  name: "Incentive Prize, Professional Division",
  description: "National Olympiad of Informatics",
  date: "2012"
)
#cert_item(
  name: "C++ Certified Professional Programmer",
  description: "C++ Institute",
  date: "2023"
)

#resume_heading[Experience]
#exp_item(
  role: "System Engineer",
  name: "NTQ Japan",
  location: "Gifu, Japan",
  date: "Aug. 2022 - Present",
  [Taken part in software requirements hearing, bidding, proposal activities],
  [Built complex and performant embedded applications used in buses and trains],
  
)
#exp_item(
  role: "Engineering Manager",
  name: "GoodCreate",
  location: "Kagawa, Japan",
  date: "July 2020 - Aug. 2022",
  [Communicated with clients to to build responsive rich-featured EC websites],
  [Built full-featured performant cross platform mobile applications and web backend written using Flutter, NodeJS, nginx],
)
#exp_item(
  role: "C++ Engineer",
  name: "FPT Software",
  location: "Hanoi, Vietnam",
  date: "May 2019 - July 2019",
  [Developed performant and feature-rich embedded applications],
)
#exp_item(
  role: "Game Programmer",
  name: "Gameloft HAN",
  location: "Hanoi, Vietnam",
  date: "Mar. 2014 - Mar. 2016, Apr. - Nov. 2018",
  [Developed, and optimized games for low-end mobile devices using C++, OpenGL, Android NDK, Unity3D, with large code base and complex build system],
  [Contributed in: Order and Chaos 2, Brothers in Arms 3, Ice Age Adventure, Shark Dash and many other games],
)

#resume_heading("Projects")
#project_item(
  name: "Hi-ABT",
  skills: "Linux, Android, Java, C++, TCP/IP, Serial",
  date: "July 2022 - Present",
  [Worked with bare metal devices, handled low-level signals],
  [Built software system to manage bus fare. Worked with Java, C++, embedded devices],
  [Implemented remotely controlled software update mechanics],
  [Handled TCP, socket communications, REST API. Handled complex communications between many devices using various connection strategies, including LAN, serial, LTE],
  [Maintained a customized Android OS. Tweaked system boot procedure. Customized stock applications. Performed various fixes and maintained system stabability],
)
#project_item(
  name: "Toxy",
  skills: "Flutter, NextJS, NestJS, Google Cloud, Fastlane, Github Actions",
  date: "Aug. 2021 - July 2022",
  [Built an app offering coupons based on user’s location. Powered by a scalable backend server with NestJS, built to handle 50K/100K active users with 70K￥/100K￥ monthly budget],
  [Reduce potential server cost by designing Microservice architecture and utilizing Docker and Cloud Run. Estimated saving at about 40% compared to legacy method],
  [Utilized API caching/UI hydration mechanic, resulting in highly responsive app with virtually zero loading UX after first initial load],
  [Built a fully automated CI pipeline with Fastlane and Github Actions]
)
#project_item(
  name: "AtCreator",
  skills: "Laravel, Fastlane, React Native, XCode CLI",
  date: "July 2020 - July 2022",
  [Managed an app making system, allowing users to build custom Android/iOS application with no technical prerequisite],
  [Maintained an automated app building system, using Laravel, Fastlane, Nodejs, XCode],
  [Built highly customizable React Native applications, offering 9 different themes with feature set suitable for various kind of application: restaurant, apparel shop, hotel, taxi services, and more],
  [Support HTTPS with both manual and automatic methods],
)
#project_item(
  name: "HKMC",
  skills: "Qt, Linux, IVI, Embedded",
  date: "Feb. 2017 - Nov. 2017",
  [Built media playing application for automotive in-vehicle infortainment (IVI) system using Qt],
  [Implemented lazy loading mechanic, handling thousands of song with small memory footprint],
  [Worked with large C++ code base. Utilized Coverity for static analysis]
)
#project_item(
  name: "NSP64Bit",
  skills: "C++, Migration, String Matching",
  date: "Apr. 2016 - Jan. 2017",
  [Worked with C++, memory management, 64bit coding patterns],
  [Worked with large C++ code base with 2 millions line of code],
  [Solo developed a static analyzer to help cutting about 90% of manual effort. Analyzed C++ code content, process structured content with Regular Expression]
)

#resume_heading[Education]
#edu_item(
  name: "Mizuno School of Foreign Language",
  degree: "Japanese",
  location: "Chiba, Japan",
  date: "Apr. 2018 - Apr. 2019"
)
#edu_item(
  name: "Hung Yen University of Technology and Education",
  degree: "BSc Software Engineering",
  location: "Hung Yen, Vietnam",
  date: "Sep. 2010 - June 2014"
)