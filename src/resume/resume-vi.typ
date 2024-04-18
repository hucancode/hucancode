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
  category: "Programming Languages & Frameworks",
  skills: "Rust, C++, C#, GLSL, Typescript, Java, Kotlin, SQL, ReactiveX, React, Svelte, Tailwind, NestJS, Flutter, Axum, WebGPU, OpenGL"
)
#skill_item(
  category: "Tools & OS",
  skills: "Mac, Linux (Debian, Arch), Android, iOS, Docker, nginx, Redis, AWS, GCP"
)

#resume_heading[Experience]
#exp_item(
  role: "System Engineer",
  name: "NTQ Japan",
  location: "Gifu, Japan",
  date: "Aug. 2022 - Present",
  [Built complex and performant embedded applications for buses and trains],
  
)
#exp_item(
  role: "Engineering Manager",
  name: "GoodCreate",
  location: "Kagawa, Japan",
  date: "July 2020 - Aug. 2022",
  [Communicated with end clients to to build responsive feature-rich EC websites],
  [Built cross platform mobile applications and web backend written using Flutter, NodeJS, nginx],
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
  name: "Gameloft",
  location: "Hanoi, Vietnam",
  date: "Mar. 2014 - 2016, Apr. - Nov. 2018",
  [Developed, and optimized games for low-end mobile devices using C++, OpenGL, Android NDK, Unity3D],
  [Contributed in: Order and Chaos 2, Brothers in Arms 3, Ice Age Adventure, Shark Dash and many other games],
)

#resume_heading("Notable Projects")
#project_item(
  name: "Hi-ABT",
  skills: "Linux, Android, Java, C++, TCP/IP, Serial",
  date: "July 2022 - Present",
  [Built software system to manage bus fare. Worked with Java, C++, Linux, embedded devices],
  [Implemented remote software update mechanics. Handled complex communications between many devices using various connection strategies, including TCP, Serial, HTTP],
  [Customized Android OS boot procedure. Performed various fixes and maintained system stabability],
)
#project_item(
  name: "Toxy",
  skills: "Flutter, NextJS, NestJS, Google Cloud, Fastlane, Github Actions",
  date: "Aug. 2021 - July 2022",
  [Built an app offering coupons based on user’s location. Powered by a scalable backend server with NestJS],
  [Reduce potential server cost by designing Microservice architecture and utilizing Docker and Cloud Run. Saved about 40% running cost compared to legacy method],
  [Utilized API caching/UI hydration mechanic, resulting in highly snappy UX after first initial load],
  [Built a fully automated CI pipeline with Fastlane and Github Actions. Done similar pipeline with Gitlab CI]
)
#project_item(
  name: "AtCreator",
  skills: "Laravel, Fastlane, React Native, XCode CLI",
  date: "July 2020 - July 2022",
  [Developed an app making system using ReactNative, allowing users to build and publish custom Android/iOS application with no technical prerequisite. Similar to Wix, but for mobile application],
  [Developed an automated app building system, using Fastlane, Nodejs, XCode]
)
#project_item(
  name: "HKMC",
  skills: "Qt, Linux, Coverity, IVI, Embedded",
  date: "Feb. 2017 - Nov. 2017",
  [Built media playing application for automotive in-vehicle infortainment (IVI) system using Qt],
  [Implemented lazy loading mechanic, handling thousands of song with small memory footprint],
  [Worked with large C++ code base. Utilized Coverity for static analysis]
)
#project_item(
  name: "NSP64Bit",
  skills: "C++, Migration, Static Analysis",
  date: "Apr. 2016 - Jan. 2017",
  [Worked with C++, memory management, 64bit coding patterns in a large code base with 2 millions line of code],
  [Solo developed a static analyzer to help cutting about 90% of manual effort. Analyzed C++ code content, process structured content with Regular Expression]
)

#resume_heading[Education & Certifications]
#edu_item(
  name: "Mizuno School of Foreign Language",
  degree: "Japanese",
  location: "Japan",
  date: "2019"
)
#edu_item(
  name: "Hung Yen University of Technology and Education",
  degree: "BSc Software Engineering",
  location: "Vietnam",
  date: "2014"
)
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