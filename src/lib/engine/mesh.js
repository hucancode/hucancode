// Load + prepare the 3D dragon mesh for the path-deform shader.
// Tiny OBJ parser (positions + normals + triangulated faces). The mesh is
// aligned along its longest axis -> X, X span remapped to [0, bodyLen] (path
// units) so position.x parameterises the path; y,z stay native (scaled by
// uGirth). Normals are reordered to match and renormalised (for Phong).

function parseObj(text) {
  const verts = []; // [x,y,z]
  const norms = []; // [x,y,z]
  const triV = []; // position indices (0-based), 3 per triangle
  const triN = []; // normal indices (0-based) or -1
  const lines = text.split("\n");
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const c0 = line.charCodeAt(0), c1 = line.charCodeAt(1), c2 = line.charCodeAt(2);
    if (c0 === 118 && c1 === 32) {
      // "v "
      const p = line.split(/\s+/);
      verts.push([parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3])]);
    } else if (c0 === 118 && c1 === 110 && c2 === 32) {
      // "vn "
      const p = line.split(/\s+/);
      norms.push([parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3])]);
    } else if (c0 === 102 && c1 === 32) {
      // "f " - tokens v, v/vt, v//vn, v/vt/vn. Triangulate fan.
      const p = line.split(/\s+/);
      const vidx = [], nidx = [];
      for (let i = 1; i < p.length; i++) {
        if (!p[i]) continue;
        const parts = p[i].split("/");
        const vi = parseInt(parts[0], 10);
        const ni = parts.length > 2 && parts[2] ? parseInt(parts[2], 10) : 0;
        vidx.push(vi > 0 ? vi - 1 : verts.length + vi);
        nidx.push(ni > 0 ? ni - 1 : ni < 0 ? norms.length + ni : -1);
      }
      for (let i = 1; i + 1 < vidx.length; i++) {
        triV.push(vidx[0], vidx[i], vidx[i + 1]);
        triN.push(nidx[0], nidx[i], nidx[i + 1]);
      }
    }
  }
  return { verts, norms, triV, triN };
}

export async function loadDragonMesh(url, bodyLen) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("dragon obj fetch failed: " + res.status);
  const text = await res.text();
  const { verts, norms, triV, triN } = parseObj(text);

  // bbox to find the longest axis
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) {
    for (let a = 0; a < 3; a++) {
      if (v[a] < min[a]) min[a] = v[a];
      if (v[a] > max[a]) max[a] = v[a];
    }
  }
  const span = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  let longAxis = 0;
  if (span[1] > span[longAxis]) longAxis = 1;
  if (span[2] > span[longAxis]) longAxis = 2;
  const a1 = (longAxis + 1) % 3;
  const a2 = (longAxis + 2) % 3;
  const xScale = bodyLen / (span[longAxis] || 1);

  const n = triV.length;
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = verts[triV[i]];
    positions[i * 3 + 0] = (v[longAxis] - min[longAxis]) * xScale; // longest axis -> X
    positions[i * 3 + 1] = v[a1];
    positions[i * 3 + 2] = v[a2];
    // normal: reorder axes the same way, renormalise (no scale)
    const nm = triN[i] >= 0 ? norms[triN[i]] : null;
    let nx = nm ? nm[longAxis] : 0, ny = nm ? nm[a1] : 0, nz = nm ? nm[a2] : 1;
    const l = Math.hypot(nx, ny, nz) || 1;
    normals[i * 3 + 0] = nx / l;
    normals[i * 3 + 1] = ny / l;
    normals[i * 3 + 2] = nz / l;
  }
  return { positions, normals, vertexCount: n };
}
