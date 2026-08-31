// ANALYTIC RAY/PRIMITIVE INTERSECTION — the raytracer's whole point is that a
// mech model is primitives (boxes, cylinders, spheres, ...) with affine
// instance transforms, NOT triangle soup. So a ray is pushed through the
// inverse transform into UNIT space and intersected with the closed form; the
// affine transform preserves the ray parameter t, so t is in WORLD units.
//
// Every shape here matches the unit mesh its primitives.js generator emits:
//   box               x,y,z in [-.5,.5]; top face slopes/curves toward +Z
//   cylinder          r=1, y in [0,1], base-centred
//   coneCut           base r=1 at y=0 -> top r=q at y=1
//   sphere            r=1, centred
//   hemisphere        r=1, y>=0, dome up (+Y)
//   cutHemisphere     hollow bowl: shell ri..1 over y in [0,yc] + lip + base
//   halfCylinder      r=1, y in [0,1], round side +Z, flat face z=0
//   halfCylinderBox   halfCylinder + box tail to z=-dp (the D-lug)
//   quarterCylinder   r=1, y in [0,1], arc +X..+Z, corner origin
//   gear              annulus (toothless ring) — analytic approximation
//
// intersectShape() returns the nearest positive t (Infinity = miss) and writes
// the UNIT-space normal into NORMAL (single-threaded; copy out immediately).

export const SHAPE = {
  box: 0, cylinder: 1, coneCut: 2, sphere: 3, hemisphere: 4,
  cutHemisphere: 5, halfCylinder: 6, halfCylinderBox: 7, quarterCylinder: 8, gear: 9,
};

const EPS = 1e-5;    // world-distance epsilon for a hit
const PAR = 1e-9;    // near-parallel guard for planar faces

export const NORMAL = new Float32Array(3);

// conservative unit-space AABB [minx,miny,minz, maxx,maxy,maxz]
export function localAabb(kind, p) {
  switch (kind) {
    case SHAPE.box: return [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5];
    case SHAPE.halfCylinder: return [-1, 0, 0, 1, 1, 1];
    case SHAPE.halfCylinderBox: return [-1, 0, -p[0], 1, 1, 1];
    case SHAPE.quarterCylinder: return [0, 0, 0, 1, 1, 1];
    default: return [-1, 0, -1, 1, 1, 1]; // cylinder/cone/sphere/hemi/cutHemi/gear
  }
}

let B, X, Y, Z;
function cand(t, nx, ny, nz) {
  if (t > EPS && t < B) { B = t; X = nx; Y = ny; Z = nz; }
}

export function intersectShape(kind, p, ox, oy, oz, dx, dy, dz) {
  B = Infinity; X = 0; Y = 0; Z = 0;

  switch (kind) {
    case SHAPE.box: {
      const s = p[0], k = p[1];
      const A = 0.5 - 0.5 * s + 0.25 * s * k;
      const Bc = -s, Cc = -s * k;
      const topY = (z) => A + Bc * z + Cc * z * z;
      // +X / -X walls
      if (Math.abs(dx) > PAR) {
        let t = (0.5 - ox) / dx; let y = oy + dy * t, z = oz + dz * t;
        if (y >= -0.5 && y <= topY(z) && z >= -0.5 && z <= 0.5) cand(t, 1, 0, 0);
        t = (-0.5 - ox) / dx; y = oy + dy * t; z = oz + dz * t;
        if (y >= -0.5 && y <= topY(z) && z >= -0.5 && z <= 0.5) cand(t, -1, 0, 0);
      }
      // bottom
      if (Math.abs(dy) > PAR) {
        let t = (-0.5 - oy) / dy; let x = ox + dx * t, z = oz + dz * t;
        if (x >= -0.5 && x <= 0.5 && z >= -0.5 && z <= 0.5) cand(t, 0, -1, 0);
      }
      // back / front
      if (Math.abs(dz) > PAR) {
        let t = (-0.5 - oz) / dz; let x = ox + dx * t, y = oy + dy * t;
        if (x >= -0.5 && x <= 0.5 && y >= -0.5 && y <= topY(-0.5)) cand(t, 0, 0, -1);
        t = (0.5 - oz) / dz; x = ox + dx * t; y = oy + dy * t;
        if (x >= -0.5 && x <= 0.5 && y >= -0.5 && y <= topY(0.5)) cand(t, 0, 0, 1);
      }
      // top surface: y = topY(z), a quadric in z extruded along x
      {
        const Q = Cc * dz * dz;
        const P = Bc * dz + 2 * Cc * oz * dz - dy;
        const R = A + Bc * oz + Cc * oz * oz - oy;
        if (Math.abs(Q) < PAR) {
          if (Math.abs(P) > PAR) {
            const t = -R / P; const x = ox + dx * t, z = oz + dz * t;
            if (x >= -0.5 && x <= 0.5 && z >= -0.5 && z <= 0.5 && oy + dy * t >= -0.5) {
              const nz = -(Bc + 2 * Cc * z); const il = 1 / Math.hypot(1, nz);
              cand(t, 0, il, nz * il);
            }
          }
        } else {
          const disc = P * P - 4 * Q * R;
          if (disc >= 0) {
            const sq = Math.sqrt(disc);
            for (let i = 0; i < 2; i++) {
              const t = i === 0 ? (-P - sq) / (2 * Q) : (-P + sq) / (2 * Q);
              const x = ox + dx * t, z = oz + dz * t;
              if (x >= -0.5 && x <= 0.5 && z >= -0.5 && z <= 0.5 && oy + dy * t >= -0.5) {
                const nz = -(Bc + 2 * Cc * z); const il = 1 / Math.hypot(1, nz);
                cand(t, 0, il, nz * il);
              }
            }
          }
        }
      }
      break;
    }

    case SHAPE.cylinder: {
      const a = dx * dx + dz * dz;
      if (a > PAR) {
        const b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - 1;
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const sq = Math.sqrt(disc);
          for (let i = 0; i < 2; i++) {
            const t = i === 0 ? (-b - sq) / (2 * a) : (-b + sq) / (2 * a);
            const y = oy + dy * t;
            if (y >= 0 && y <= 1) cand(t, ox + dx * t, 0, oz + dz * t);
          }
        }
      }
      if (Math.abs(dy) > PAR) {
        let t = -oy / dy; let x = ox + dx * t, z = oz + dz * t;
        if (x * x + z * z <= 1) cand(t, 0, -1, 0);
        t = (1 - oy) / dy; x = ox + dx * t; z = oz + dz * t;
        if (x * x + z * z <= 1) cand(t, 0, 1, 0);
      }
      break;
    }

    case SHAPE.coneCut: {
      const k = p[0] - 1;                       // radius at y: 1 + k*y
      const a = dx * dx + dz * dz - k * k * dy * dy;
      const b = 2 * (ox * dx + oz * dz) - 2 * k * dy * (1 + k * oy);
      const c = ox * ox + oz * oz - (1 + k * oy) * (1 + k * oy);
      if (Math.abs(a) > PAR) {
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const sq = Math.sqrt(disc);
          for (let i = 0; i < 2; i++) {
            const t = i === 0 ? (-b - sq) / (2 * a) : (-b + sq) / (2 * a);
            const y = oy + dy * t;
            if (y >= 0 && y <= 1) {
              const nx = ox + dx * t, nz = oz + dz * t;
              const ny = -k * (1 + k * y);
              const il = 1 / Math.hypot(nx, ny, nz);
              cand(t, nx * il, ny * il, nz * il);
            }
          }
        }
      } else if (Math.abs(b) > PAR) {
        const t = -c / b; const y = oy + dy * t;
        if (y >= 0 && y <= 1) {
          const nx = ox + dx * t, nz = oz + dz * t;
          const ny = -k * (1 + k * y);
          const il = 1 / Math.hypot(nx, ny, nz);
          cand(t, nx * il, ny * il, nz * il);
        }
      }
      if (Math.abs(dy) > PAR) {
        let t = -oy / dy; let x = ox + dx * t, z = oz + dz * t;
        if (x * x + z * z <= 1) cand(t, 0, -1, 0);
        if (p[0] > 1e-6) {
          t = (1 - oy) / dy; x = ox + dx * t; z = oz + dz * t;
          if (x * x + z * z <= p[0] * p[0]) cand(t, 0, 1, 0);
        }
      }
      break;
    }

    case SHAPE.sphere: {
      const a = dx * dx + dy * dy + dz * dz;
      const b = 2 * (ox * dx + oy * dy + oz * dz);
      const c = ox * ox + oy * oy + oz * oz - 1;
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        for (let i = 0; i < 2; i++) {
          const t = i === 0 ? (-b - sq) / (2 * a) : (-b + sq) / (2 * a);
          cand(t, ox + dx * t, oy + dy * t, oz + dz * t);   // unit sphere: point == normal
        }
      }
      break;
    }

    case SHAPE.hemisphere: {
      const a = dx * dx + dy * dy + dz * dz;
      const b = 2 * (ox * dx + oy * dy + oz * dz);
      const c = ox * ox + oy * oy + oz * oz - 1;
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        for (let i = 0; i < 2; i++) {
          const t = i === 0 ? (-b - sq) / (2 * a) : (-b + sq) / (2 * a);
          if (oy + dy * t >= 0) cand(t, ox + dx * t, oy + dy * t, oz + dz * t);
        }
      }
      if (Math.abs(dy) > PAR) {
        const t = -oy / dy; const x = ox + dx * t, z = oz + dz * t;
        if (x * x + z * z <= 1) cand(t, 0, -1, 0);
      }
      break;
    }

    case SHAPE.cutHemisphere: {
      const ri = p[0], yc = p[1];
      // outer shell (r=1)
      let a = dx * dx + dy * dy + dz * dz;
      let b = 2 * (ox * dx + oy * dy + oz * dz);
      let c = ox * ox + oy * oy + oz * oz - 1;
      let disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        for (let i = 0; i < 2; i++) {
          const t = i === 0 ? (-b - sq) / (2 * a) : (-b + sq) / (2 * a);
          const y = oy + dy * t;
          if (y >= 0 && y <= yc) cand(t, ox + dx * t, y, oz + dz * t);
        }
      }
      // inner cavity (r=ri), normals inward
      c = ox * ox + oy * oy + oz * oz - ri * ri;
      disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        for (let i = 0; i < 2; i++) {
          const t = i === 0 ? (-b - sq) / (2 * a) : (-b + sq) / (2 * a);
          const y = oy + dy * t;
          if (y >= 0 && y <= yc) {
            const x = ox + dx * t, z = oz + dz * t;
            cand(t, -x, -y, -z);
          }
        }
      }
      if (Math.abs(dy) > PAR) {
        let t = (yc - oy) / dy; let x = ox + dx * t, z = oz + dz * t, r2 = x * x + z * z;
        if (r2 >= ri * ri && r2 <= 1) cand(t, 0, 1, 0);        // lip
        t = -oy / dy; x = ox + dx * t; z = oz + dz * t; r2 = x * x + z * z;
        if (r2 >= ri * ri && r2 <= 1) cand(t, 0, -1, 0);       // base ring
      }
      break;
    }

    case SHAPE.halfCylinder: {
      const a = dx * dx + dz * dz;
      if (a > PAR) {
        const b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - 1;
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const sq = Math.sqrt(disc);
          for (let i = 0; i < 2; i++) {
            const t = i === 0 ? (-b - sq) / (2 * a) : (-b + sq) / (2 * a);
            const y = oy + dy * t, z = oz + dz * t;
            if (y >= 0 && y <= 1 && z >= 0) cand(t, ox + dx * t, 0, z);
          }
        }
      }
      if (Math.abs(dz) > PAR) {
        const t = -oz / dz; const x = ox + dx * t, y = oy + dy * t;
        if (x >= -1 && x <= 1 && y >= 0 && y <= 1) cand(t, 0, 0, -1);
      }
      if (Math.abs(dy) > PAR) {
        let t = -oy / dy; let x = ox + dx * t, z = oz + dz * t;
        if (x * x + z * z <= 1 && z >= 0) cand(t, 0, -1, 0);
        t = (1 - oy) / dy; x = ox + dx * t; z = oz + dz * t;
        if (x * x + z * z <= 1 && z >= 0) cand(t, 0, 1, 0);
      }
      break;
    }

    case SHAPE.halfCylinderBox: {
      const dp = p[0];
      const a = dx * dx + dz * dz;
      if (a > PAR) {
        const b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - 1;
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const sq = Math.sqrt(disc);
          for (let i = 0; i < 2; i++) {
            const t = i === 0 ? (-b - sq) / (2 * a) : (-b + sq) / (2 * a);
            const y = oy + dy * t, z = oz + dz * t;
            if (y >= 0 && y <= 1 && z >= 0) cand(t, ox + dx * t, 0, z);
          }
        }
      }
      if (Math.abs(dz) > PAR) {
        const t = (-dp - oz) / dz; const x = ox + dx * t, y = oy + dy * t;
        if (x >= -1 && x <= 1 && y >= 0 && y <= 1) cand(t, 0, 0, -1);
      }
      if (Math.abs(dx) > PAR) {
        let t = (1 - ox) / dx; let y = oy + dy * t, z = oz + dz * t;
        if (y >= 0 && y <= 1 && z >= -dp && z <= 0) cand(t, 1, 0, 0);
        t = (-1 - ox) / dx; y = oy + dy * t; z = oz + dz * t;
        if (y >= 0 && y <= 1 && z >= -dp && z <= 0) cand(t, -1, 0, 0);
      }
      if (Math.abs(dy) > PAR) {
        const inD = (x, z) => (x * x + z * z <= 1 && z >= 0) || (x >= -1 && x <= 1 && z >= -dp && z <= 0);
        let t = -oy / dy; let x = ox + dx * t, z = oz + dz * t;
        if (inD(x, z)) cand(t, 0, -1, 0);
        t = (1 - oy) / dy; x = ox + dx * t; z = oz + dz * t;
        if (inD(x, z)) cand(t, 0, 1, 0);
      }
      break;
    }

    case SHAPE.quarterCylinder: {
      const a = dx * dx + dz * dz;
      if (a > PAR) {
        const b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - 1;
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const sq = Math.sqrt(disc);
          for (let i = 0; i < 2; i++) {
            const t = i === 0 ? (-b - sq) / (2 * a) : (-b + sq) / (2 * a);
            const y = oy + dy * t, x = ox + dx * t, z = oz + dz * t;
            if (y >= 0 && y <= 1 && x >= 0 && z >= 0) cand(t, x, 0, z);
          }
        }
      }
      if (Math.abs(dx) > PAR) {
        const t = -ox / dx; const y = oy + dy * t, z = oz + dz * t;
        if (y >= 0 && y <= 1 && z >= 0 && z <= 1) cand(t, -1, 0, 0);
      }
      if (Math.abs(dz) > PAR) {
        const t = -oz / dz; const y = oy + dy * t, x = ox + dx * t;
        if (y >= 0 && y <= 1 && x >= 0 && x <= 1) cand(t, 0, 0, -1);
      }
      if (Math.abs(dy) > PAR) {
        const inQ = (x, z) => x * x + z * z <= 1 && x >= 0 && z >= 0;
        let t = -oy / dy; let x = ox + dx * t, z = oz + dz * t;
        if (inQ(x, z)) cand(t, 0, -1, 0);
        t = (1 - oy) / dy; x = ox + dx * t; z = oz + dz * t;
        if (inQ(x, z)) cand(t, 0, 1, 0);
      }
      break;
    }

    case SHAPE.gear: {
      // toothless annulus approximation: outer r=1, hole r=GEAR_HOLE (0.55)
      const ri = 0.55;
      const a = dx * dx + dz * dz;
      if (a > PAR) {
        const b = 2 * (ox * dx + oz * dz);
        let c = ox * ox + oz * oz - 1;
        let disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const sq = Math.sqrt(disc);
          for (let i = 0; i < 2; i++) {
            const t = i === 0 ? (-b - sq) / (2 * a) : (-b + sq) / (2 * a);
            const y = oy + dy * t;
            if (y >= 0 && y <= 1) cand(t, ox + dx * t, 0, oz + dz * t);
          }
        }
        c = ox * ox + oz * oz - ri * ri;
        disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const sq = Math.sqrt(disc);
          for (let i = 0; i < 2; i++) {
            const t = i === 0 ? (-b - sq) / (2 * a) : (-b + sq) / (2 * a);
            const y = oy + dy * t;
            if (y >= 0 && y <= 1) {
              const x = ox + dx * t, z = oz + dz * t;
              cand(t, -x, 0, -z);
            }
          }
        }
      }
      if (Math.abs(dy) > PAR) {
        const ring = (x, z) => { const r2 = x * x + z * z; return r2 >= ri * ri && r2 <= 1; };
        let t = -oy / dy; let x = ox + dx * t, z = oz + dz * t;
        if (ring(x, z)) cand(t, 0, -1, 0);
        t = (1 - oy) / dy; x = ox + dx * t; z = oz + dz * t;
        if (ring(x, z)) cand(t, 0, 1, 0);
      }
      break;
    }
  }

  NORMAL[0] = X; NORMAL[1] = Y; NORMAL[2] = Z;
  return B;
}
