import React from "react";
import styled from "styled-components";

const Canvas = styled.canvas`
  width: 100%;
`;
const Video = styled.video`
  width: 100%;
`;
const Container = styled.div`
  width: 80%;
  height: 100%;
`;

export default class Canvas3D extends React.Component {
  constructor(props) {
    super(props);
    this.state = { isInCamera: false, videoURL: "" };
    this.canvasRef = React.createRef();
    this.videoRef = React.createRef();
    this.frameID = 0;
  }
  componentDidMount() {
    this.init();
    this.observer = new IntersectionObserver(([entry]) => {
      this.setState((state) => {
        return { ...state, isInCamera: entry.isIntersecting };
      });
    });
    if (this.canvasRef.current) {
      this.observer.observe(this.canvasRef.current);
    }
    setTimeout(() => this.startRecording(), 5000);
  }
  componentWillUnmount() {
    this.observer.disconnect();
  }
  componentDidUpdate() {
    if (this.state.isInCamera) {
      const scope = this;
      const renderLoop = function () {
        scope.frameID = requestAnimationFrame(renderLoop);
        scope.animate();
      };
      renderLoop();
    } else {
      cancelAnimationFrame(this.frameID);
    }
  }

  startRecording() {
    console.log("startRecording");
    if (!this.videoRef.current || !this.canvasRef.current) {
      let scope = this;
      setTimeout(() => scope.startRecording(), 500);
      return;
    }
    const chunks = []; // here we will store our recorded media chunks (Blobs)
    const rec = new MediaRecorder(this.canvasRef.current.captureStream()); // init the recorder
    // every time the recorder has new data, we will store it in our array
    rec.ondataavailable = (e) => chunks.push(e.data);
    // only when the recorder stops, we construct a complete Blob from all the chunks
    rec.onstop = (e) => {
      let blob = new Blob(chunks, { type: "video/webm" });
      this.setState((state) => {
        return { ...state, videoURL: URL.createObjectURL(blob) };
      });
    };
    rec.start();
    setTimeout(() => {
      rec.stop();
      console.log("stopRecording");
    }, 20000); // stop recording in 10s
  }
  render() {
    return (
      <Container>
        <Canvas id={this.canvasID} ref={this.canvasRef} />
        <Video ref={this.videoRef} controls loop src={this.state.videoURL} />
      </Container>
    );
  }
}
