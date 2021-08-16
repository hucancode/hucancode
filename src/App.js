import React from "react";
import './App.css';
import Navbar from "./components/navBar";
import SaborScene from "./components/saborScene";

export default function App() {
  return (
    <div className="App">
      <header className="App-header">
        <Navbar />
        <p>
          Site is under constructions. <br/>Made with <code>React.js</code> and <code>Three.js</code>
        </p>
        <SaborScene />
      </header>
    </div>
  )
}