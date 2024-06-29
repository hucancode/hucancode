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
  skills: "NodeJS, Docker, nginx, Redis, Linux (CentOS, Debian, Arch), Android, iOS, AWS, GCP"
)

#resume_heading[Experience]
#exp_item(
  role: "Software Engineer",
  name: "NTQ Japan",
  location: "Gifu, JP",
  date: "Aug 2022 - Present",
  [Built complex and performant embedded applications],
)
#exp_item(
  role: "Engineering Manager",
  name: "GoodCreate",
  location: "Kagawa, JP",
  date: "Jul 2020 - Aug 2022",
  [Communicated with end clients to build responsive feature-rich EC websites],
  [Built cross platform mobile applications and web backend written using Flutter, NodeJS, nginx],
  [In charge of engineering productivity. Conducted HTML/CSS/JS, Flutter, iOS training activity],
)
#exp_item(
  role: "C++ Engineer",
  name: "FPT Software",
  location: "Hanoi, VN",
  date: "May 2019 - Jul 2019",
  [Developed performant and feature-rich embedded applications],
)
#exp_item(
  role: "Game Programmer",
  name: "Gameloft",
  location: "Hanoi, VN",
  date: "Mar 2014 - 2016, Apr - Nov 2018",
  [Developed, and optimized games for low-end mobile devices using C++, OpenGL, Unity3D],
  [Contributed in: Order and Chaos 2, Brothers in Arms 3, Ice Age Adventure, Disney Magic Kingdom, Shark Dash and other games],
)

#resume_heading("Notable Projects")
#project_item(
  name: "Hi-ABT",
  skills: "Linux, Android, μITRON, Java, C, C++, TCP, Serial",
  date: "Aug 2022 - Present",
  [Built software system to manage bus fare],
  [Implemented remote software update mechanics],
  [Handled complex communications between devices running 4 different OS, using TCP, Serial, HTTPS],
  [Implemented OS network setup procedure, managing static IP, route table, internet gateway, DNS],
  [Customized Android OS boot procedure, applied various fixes and maintained system stability],
)
#project_item(
  name: "Toxy",
  skills: "Flutter, NextJS, NestJS, Google Cloud, Fastlane, Github Actions",
  date: "Aug 2021 - Jul 2022",
  [Collect requirements, design and built a location-based coupon offering app with Flutter, NextJS, NestJS],
  [Optimized server cost with Cloud Run. Reduced about 40% running cost compared to on-premise method],
  [Utilized API caching/UI hydration mechanic, resulting in highly snappy UX after first load],
  [Built a fully automated CI pipeline with Fastlane and Github Actions/Gitlab CI]
)
#project_item(
  name: "AtCreator",
  skills: "Laravel, Fastlane, React Native, XCode CLI",
  date: "Jul 2020 - Jul 2022",
  [Developed an app making system using ReactNative, allowing users to build and publish custom Android/iOS application with no technical prerequisite. Similar to Wix, but for mobile application],
  [Developed an automated app building system, using Fastlane, NodeJS, XCode CLI]
)
#project_item(
  name: "HKMC",
  skills: "Qt, Linux, Coverity, IVI, Embedded",
  date: "Feb 2017 - Nov 2017",
  [Built media playing application for automotive in-vehicle infotainment (IVI) system using Qt],
  [Implemented lazy loading mechanic, optimized to handling thousands of songs with small memory footprint],
  [Fixed memory leaks, reduced object copy, optimized system performance. Utilized Coverity for static analysis]
)
#project_item(
  name: "NSP64Bit",
  skills: "C++, Migration, Static Analysis",
  date: "Apr 2016 - Jan 2017",
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
  location: "Hungyen, VN",
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