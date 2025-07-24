---
title: Creating a 3D Dynamic Dragon with Three.js
excerpt: Animate any 3D model along a curve path using GPU-accelerated techniques
date: 2024-06-27
cover: /blog/post/animated-dragon/10024398.png
categories:
  - 3d
  - threejs
---

## The Result

A dragon that smoothly flies along random curved paths, with dynamic lighting that creates an ethereal atmosphere.

{% video src="/blog/post/animated-dragon/dragon-600-20s.webm" autoplay=true loop=true muted=true /%}

## Starting Point: The Static Model

Before applying any transformations, we have a static 3D dragon model:

{% dragon style="static" /%}

The model is initially positioned along the X-axis. Our goal is to bend and animate it along arbitrary curves in 3D space.

## Implementation

### 1. Scene Setup

Basic Three.js setup with ambient and dynamic point lighting:

```js
function setupLightning() {
  // Blue ambient light for atmosphere
  ambientLight = new AmbientLight(0x003973);
  scene.add(ambientLight);

  // Dynamic white point light with visual indicator
  dynamicLight = new PointLight(0xffffff, 5, 0, 0.2);
  dynamicLight.add(
    new Mesh(
      new SphereGeometry(2, 16, 8),
      new MeshBasicMaterial({ color: 0xffffff })
    )
  );
  scene.add(dynamicLight);
}
```

### 2. Creating the Flight Path

Generate a smooth, closed curve using random control points:

```js
function makeDragon() {
  if (!model) return;

  // Generate 20 random points in 3D space
  const points = Array.from({ length: 20 }, () => ({
    x: Math.random() * 80 - 40,   // X: -40 to 40
    y: Math.random() * 80 - 40,   // Y: -40 to 40
    z: Math.random() * 160 - 80,  // Z: -80 to 80
  }));

  // Create smooth curve through points
  const curve = new CatmullRomCurve3(
    points.map(p => new Vector3(p.x, p.y, p.z))
  );
  curve.curveType = "centripetal";
  curve.closed = true;

  // Apply curve animation to dragon
  const dragon = new Flow(model);
  dragon.updateCurve(0, curve);
  scene.add(dragon.object3D);
}
```

### 3. Pipeline

The `Flow` class from Three.js's CurveModifier performs the heavy lifting:

{% mermaid %}
graph TD
    A[Curve Points] --> B[Pack into Data Texture]
    B --> C[Send to Vertex Shader]
    C --> D[Restore Curve Information]
    D --> E[Transform Vertices Along Curve]
{% /mermaid %}

#### Here is a transformed dragon using a sin-like curve

{% dragon style="curved" /%}

Notice how the dragon now follows the curve shape. This is the result of the GPU transformation without any animation.

### 4. Animation Loop

The render function updates the dragon position and creates dynamic lighting:

```js
function render() {
  time += clock.getDelta();

  // Move dragon along curve
  dragon.moveAlongCurve(0.002);

  // Animate lights for atmosphere
  if (dynamicLight) {
    dynamicLight.position.x = Math.sin(time * 0.7) * 30 + 20;
    dynamicLight.position.y = Math.cos(time * 0.5) * 40;
    dynamicLight.position.z = Math.cos(time * 0.3) * 30 + 20;

    // Cycle light colors
    dynamicLight.color.r = (Math.sin(time * 0.3) + 1.0) * 0.5;
    dynamicLight.color.g = (Math.sin(time * 0.7) + 1.0) * 0.5;
    dynamicLight.color.b = (Math.sin(time * 0.2) + 1.0) * 0.5;
  }

  renderer.render(scene, camera);
}
```

## How CurveModifier Works

### 1. Data Texture

Instead of sending curve data to the GPU every frame, CurveModifier packs the whole curve into a texture:

```js
// Create a texture to store curve data
const dataTexture = new DataTexture(
  dataArray,
  1024,        // Width: number of curve points
  4,           // Height: 4 rows of data
  RGBAFormat,  // Each pixel has RGBA channels
  HalfFloatType
);
```

### 2. Frenet Frames - Orientation Along the Curve

For each point on the curve, we calculate three vectors that define orientation:

{% mermaid %}
graph TD
    B[Tangent<br/>Forward direction]
    C[Normal<br/>Up direction]
    D[Binormal<br/>Right direction]

    B & C & D --> E[3x3 Transform Matrix]
{% /mermaid %}

```js
// Calculate orientation vectors for each curve point
const frenetFrames = curve.computeFrenetFrames(1024, true);

// Store in texture rows:
// Row 0: Position
// Row 1: Tangent (forward)
// Row 2: Normal (up)
// Row 3: Binormal (right)
```

### 3. Vertex Shader

The GPU transforms each vertex of the model based on its position along the curve:

```glsl
// Find where we are on the curve (0.0 to 1.0)
float curvePosition = (vertex.x + offset) / modelLength;

// Read curve data from texture
vec3 curvePoint = texture2D(dataTexture, vec2(curvePosition, 0.0));
vec3 forward = texture2D(dataTexture, vec2(curvePosition, 0.25));
vec3 up = texture2D(dataTexture, vec2(curvePosition, 0.5));
vec3 right = texture2D(dataTexture, vec2(curvePosition, 0.75));

// Transform the vertex
mat3 orientation = mat3(forward, up, right);
vec3 finalPosition = orientation * vertex + curvePoint;
```

## See it live!

{% dragon speed=1 color="#ffffff" /%}

## Faster rust version

I've also created a **Rust + WebGPU** version that follows the same GPU animation principles.

- [GitHub Repository](https://github.com/hucancode/flying-dragon)
- [Live Demo](/dragon-rs)

{% video src="/blog/post/animated-dragon/dragon-rust.webm" autoplay=true loop=true muted=true /%}

## Source Code

[View on GitHub](https://github.com/hucancode/hucancode/blob/master/src/lib/scenes/dragon.js)
