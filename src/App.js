import React from "react";
import './App.css';
import SaborScene from "./components/saborScene";

export default function App() {
  return (
    <div className="App">
      <header className="App-header">
        <SaborScene />
        <p>
          Site is under constructions. <br/>Made with <code>React.js</code> and <code>Three.js</code>
        </p>
      </header>
    </div>
  )
}