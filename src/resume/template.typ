#let resume(body) = {
  set list(indent: 1em)
  show list: set text(size: 0.92em)
  show link: underline
  show link: set underline(offset: 3pt)

  set page(
    paper: "us-letter",
    margin: (x: 0.5in, y: 0.3in)
  )

  set text(
    size: 11pt,
      font: ("New Computer Modern", "Hina Mincho"),
  )

  body
}

#let name_header(name) = {
  set text(size: 1.5em)
  [*#name*]
}

#let header(
  name: "John Doe",
  address: "Somewhere, Japan",
  email: "john@doe.com",
  site: "linked.in",
) = {
  grid(
    columns: (1fr, 1fr),
    align(left)[
      #name_header(name) ///#address
    ],
    align(right)[
      #link("mailto:" + email)[#email] /
      #link("https://" + site)[#site]
    ]
  )
  v(5pt)
}

#let resume_heading(txt) = {
  show heading: set text(size: 0.82em, weight: "regular")

  block[
    = #smallcaps(txt)
    #v(-4pt)
    #line(length: 100%, stroke: 1pt + black)
  ]
}

#let cert_item(
  name: "Sample Certification",
  description: "",
  date: "2001"
) = {
  set block(above: 0.7em, below: 1em)
  pad(left: 1em, right: 0.5em, grid(
    columns: (3fr, 1fr),
    align(left)[
      *#name* _#description _
    ],
    align(right)[
      *#date*
    ]
  ))
}

#let edu_item(
  name: "Sample University",
  degree: "B.S in Bullshit",
  location: "Foo, BA",
  date: "Aug. 1600 - May 1750"
) = {
  set block(above: 0.7em, below: 1em)
  pad(left: 1em, right: 0.5em, grid(
    columns: (9fr, 1fr),
    align(left)[
      *#name*
      _#degree _
    ],
    align(right)[
      *#date*
    ]
  ))
}

#let exp_item(
  name: "Sample Workplace",
  role: "Worker",
  date: "June 1837 - May 1845",
  location: "Foo, BA",
  ..points
) = {
    set block(above: 0.7em, below: 1em)
    pad(left: 1em, right: 0.5em, box[
      #grid(
        columns: (2fr, 2fr),
        align(left)[
          *#role*・*#name*
        ],
        align(right)[
          *#date*
        ]
      )
      #list(..points)
    ])
}

#let project_item(
  name: "Example Project",
  skills: "Programming Language 1, Database3",
  date: "May 1234 - June 4321",
  ..points
) = {
  set block(above: 0.7em, below: 1em)
  pad(left: 1em, right: 0.5em, box[
    *#name* _#skills _ #h(1fr) *#date*
    #list(..points)
  ])
}

#let skill_item(
  category: "Skills",
  skills: "Balling, Yoga, Valorant",
) = {
  set block(above: 0.7em)
  set text(size: 0.91em)
  pad(left: 1em, right: 0.5em, block[*#category*: #skills])
}
