#import "template.typ": resume, header, resume_heading, cert_item, edu_item, exp_item, project_item, skill_item

#show: resume

#header(
  name: "Bang Nguyen Huu",
  address: "Chiba, Japan",
  email: "hucancode@gmail.com",
  site: "hucanco.de",
)

#resume_heading("Skills")
#skill_item(
  category: "Languages",
  skills: "C, C++, Rust, Go, Odin, WebGPU, Vulkan, OpenGL"
)
#skill_item(
  category: "Tools & OS",
  skills: "Unreal Engine, RenderDoc, perf, Linux, AWS"
)

#resume_heading[Experience]
#exp_item(
  role: "Technical Leader",
  name: "NTQ Japan",
  location: "Gifu/Tokyo",
  date: "2022/08 - Present",
  [Lead teams building complex and performant embedded and web applications],
)
#exp_item(
  role: "Senior Software Developer",
  name: "GoodCreate",
  location: "Kagawa",
  date: "2020/07 - 2022/07",
  [Communicated with end clients to build responsive feature-rich EC websites, cross platform mobile applications],
  [In charge of engineering productivity. Conducted various training activity],
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
  name: "Mjolnir",
  skills: "Vulkan, PBR, Bindless, IK, Physics, Procedural Animation, SIMD, perf",
  date: "2025/01 - Present",
  [Built a game engine from scratch using Vulkan featuring: PBR, Post Processing, Skinned Animation, IK/FK, Deferred Rendering, Bindless Rendering, Occlusion Culling, 2D Sprite, UI System, Physics Simulation, Procedural Animation. See more: github/hucancode/#link("https://github.com/hucancode/mjolnir")[mjolnir]],
  [Utilized XCode/RenderDoc to analyze and optimize render calls, perf to analyze and optimize physics engine],
  [Utilized compute shader to build occlusion culling and particle simulation engine],
)
#project_item(
  name: "Raytracer",
  skills: "Rust, WebGPU",
  date: "2024/02 - 2024/05",
  [Built a Raytracer with BVH that can handle 100K triangles in realtime. See more: github/hucancode/#link("https://github.com/hucancode/raytracer")[raytracer]],
)
#project_item(
  name: "Dragon",
  skills: "Rust, WebGPU",
  date: "2023/11 - 2024/02",
  [Built a procedurally animated dragon flying scene using WebGPU. See more: github/hucancode/#link("https://github.com/hucancode/flying-dragon")[dragon]],
)
#project_item(
  name: "Poker Simulator",
  skills: "Rust, WASM, Svelte",
  date: "2023/11 - 2023/12",
  [Built a winning odds calculator for poker game (0.25M game per second). Try it #link("https://poker.lamsaoquenem.day")[live]],
)
#project_item(
  name: "SDA",
  skills: "Terraform, Ansible, Kubernetes, AWS, ELK, Kafka, Go, Postgres",
  date: "2024/10 - 2025/03",
  [Leveraged ELK stack to ingress and analyze application logs data],
  [Built a fast data processor using Go to analyze proprietary dynamic binary data format],
  [Processed millions of new record daily, on just 2  t3.large AWS EC2 nodes],
)
#project_item(
  name: "Hi-ABT",
  skills: "Linux, Android, μITRON, Java, C, C++, TCP, Serial",
  date: "2022/08 - 2024/07",
  [Closely work with hardware team building bus fare payment system with remote software update],
  [Handled complex communications between many embedded devices of 3 types, using TCP, Serial, HTTPS],
)
#project_item(
  name: "HKMC",
  skills: "Qt, Linux, Coverity, IVI",
  date: "2017/02 - 2017/11",
  [Built media playing application for automotive in-vehicle infotainment (IVI) system using Qt],
  [Implemented lazy loading mechanic, optimized to handling thousands of songs with small memory footprint],
  [Fixed memory leaks, reduced object copy, optimized system performance. Utilized Coverity for static analysis]
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
  name: "Knight level (Top 2.13%)",
  description: "Leetcode",
  date: "2023"
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
