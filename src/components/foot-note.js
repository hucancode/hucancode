import React from "react";

function Container(props) {
  return (
    <div
      className="container
        pb-5
        relative
        flex items-center justify-center
        max-w-screen-lg w-full
        overflow-hidden
        text-gray-500
        text-xs
        text-center"
    >
      {props.children}
    </div>
  );
}

export default function FootNote() {
  return (
    <Container>
      <p>
        Deployed with <code>Cloud Run</code>
        <br />
        Made with <code>Next.js, Three.js, TailwindCSS</code> and some other
        tools
        <br />
      </p>
    </Container>
  );
}
