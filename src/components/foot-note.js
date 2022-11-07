import React from "react";

function Container(props) {
  return (
    <div
      className="container
        relative
        flex
        w-full max-w-screen-lg items-center
        justify-center overflow-hidden
        pb-5
        text-center
        text-xs
        text-gray-500"
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
