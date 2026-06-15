#define SHOW_GRID   1
#define GRID_SIZE   1.8
#define ANIMATE     1
#define ANIM_SPEED  1.0
#define ANIM_HOLD   2.0        // seconds holding the finished glyph before looping
#define BASE_RADIUS 0.06       // brush half-width in world units at pressure 1
#define MIN_PRESS   0.05

#define SAMPLES     10         // SDF sub-segments per curve (higher = smoother)

#define INK_BLEED    0         // 1 = feathered noisy ink edge + bleed halo
#define BLEED_WIDTH  0.015     // world-space spread of the bleed halo
#define BLEED_FREQ   190.0      // edge-wiggle frequency (paper fiber scale)
#define BLEED_JITTER 0.1       // how much noise distorts the silhouette
#define BLEED_HALO   0.2       // max coverage of the diluted outer bleed
#define GRAIN       0.06       // paper grain strength (0 = off)
#define VIGNETTE    0.45       // edge darkening strength (0 = off)

const vec3 PAPER_COLOR = vec3(1.000, 0.988, 0.878);
const vec3 INK_COLOR   = vec3(0.067, 0.067, 0.067);
const vec4 GRID_COLOR  = vec4(0.784, 0.235, 0.235, 0.25);

// Each Seg is self-contained: endpoints, control, pressures, belly, timeline.
//   p1,p2   segment endpoints (world)
//   ctrl    resolved bezier control (auto Catmull-rom already applied)
//   pr1,pr2 endpoint pressures (0..1)
//   k       belly pressure value (only if hasBelly)
//   belly   parametric belly position; hasBelly 1 = use belly curve
//   t0,dur  reveal timeline (seconds); v0,v1 endpoint speeds (reveal shape)
struct Seg {
    vec2 p1; vec2 p2; vec2 ctrl;
    float pr1; float pr2; float k; float belly; int hasBelly;
    float t0; float dur; float v0; float v1;
};
// ===== BAKED data by tools =====
/*
// 永, 7 strokes

const int NSEG = 23;
const float TOTAL_TIME = 5.06502;
const Seg SEGS[NSEG] = Seg[NSEG](
    Seg(vec2(-0.06443, 0.54373), vec2(0.01342, 0.48238), vec2(-0.00245, 0.52041), 0.23, 0.71, 0.0, 0.5, 0, 0.0, 0.08906, 1.924, 0.64842),
    Seg(vec2(0.01342, 0.48238), vec2(-0.07392, 0.44551), vec2(-0.02337, 0.46293), 0.71, 0.08, 0.07, 0.43765, 1, 0.08906, 0.07681, 0.64842, 2.104),
    Seg(vec2(-0.07392, 0.44551), vec2(-0.28053, 0.33333), vec2(-0.27752, 0.37535), 0.08, 0.1, 0.08, 0.85225, 1, 0.16587, 0.1185, 2.104, 2.08),
    Seg(vec2(-0.28053, 0.33333), vec2(-0.21145, 0.29209), vec2(-0.28778, 0.23174), 0.1, 0.8, 0.0, 0.5, 0, 0.28437, 0.10903, 2.08, 1.01967),
    Seg(vec2(-0.21145, 0.29209), vec2(-0.05863, 0.37914), vec2(-0.13926, 0.33449), 0.8, 0.6, 0.29, 0.47419, 1, 0.39339, 0.15142, 1.01967, 1.31593),
    Seg(vec2(-0.05863, 0.37914), vec2(0.08927, 0.33326), vec2(0.05523, 0.38758), 0.6, 0.9, 0.0, 0.5, 0, 0.54482, 0.20679, 1.31593, 0.46973),
    Seg(vec2(0.08927, 0.33326), vec2(0.02454, 0.29351), vec2(0.06377, 0.33703), 0.9, 1.0, 0.0, 0.5, 0, 0.75161, 0.12743, 0.46973, 0.84128),
    Seg(vec2(0.02454, 0.29351), vec2(0.00766, -0.31989), vec2(0.01297, -0.00959), 1.0, 0.75, 0.42, 0.49571, 1, 0.87904, 0.58285, 0.84128, 1.29721),
    Seg(vec2(0.00766, -0.31989), vec2(0.01819, -0.44598), vec2(0.02287, -0.37305), 0.75, 0.85, 0.0, 0.5, 0, 1.46189, 0.15042, 1.29721, 0.51842),
    Seg(vec2(0.01819, -0.44598), vec2(-0.1262, -0.35494), vec2(-0.04755, -0.40951), 0.85, 0.15, 0.0, 0.5, 0, 1.61231, 0.15473, 0.51842, 2.02),
    Seg(vec2(-0.1262, -0.35494), vec2(-0.39648, 0.04497), vec2(-0.40315, -0.16278), 0.15, 0.07, 0.07, 0.62351, 1, 1.76705, 0.25281, 2.02, 2.116),
    Seg(vec2(-0.39648, 0.04497), vec2(-0.35867, -0.02615), vec2(-0.3981, -0.00523), 0.07, 0.79, 0.0, 0.5, 0, 2.01986, 0.06464, 2.116, 0.8534),
    Seg(vec2(-0.35867, -0.02615), vec2(-0.04712, 0.10494), vec2(-0.17914, 0.08196), 0.79, 0.52, 0.0, 0.61369, 1, 2.0845, 0.3762, 0.8534, 0.96467),
    Seg(vec2(-0.04712, 0.10494), vec2(-0.03312, 0.05797), vec2(-0.01263, 0.10433), 0.52, 1.0, 0.0, 0.5, 0, 2.4607, 0.08098, 0.96467, 0.84365),
    Seg(vec2(-0.03312, 0.05797), vec2(-0.38138, -0.35994), vec2(-0.16361, -0.16553), 1.0, 0.32, 0.0, 0.5, 0, 2.54169, 0.46639, 0.84365, 1.58514),
    Seg(vec2(-0.38138, -0.35994), vec2(-0.45713, -0.35961), vec2(-0.51405, -0.4519), 0.32, 0.06, 0.0, 0.5, 0, 3.00808, 0.11391, 1.58514, 2.128),
    Seg(vec2(-0.45713, -0.35961), vec2(0.3844, 0.3961), vec2(0.10691, 0.55494), 0.06, 0.22, 0.06, 0.79498, 1, 3.12199, 0.63562, 2.128, 1.936),
    Seg(vec2(0.3844, 0.3961), vec2(0.41996, 0.30093), vec2(0.4096, 0.35969), 0.22, 1.0, 0.0, 0.5, 0, 3.75761, 0.0841, 1.936, 0.7153),
    Seg(vec2(0.41996, 0.30093), vec2(0.03649, 0.06834), vec2(0.31325, 0.20418), 1.0, 0.2, 0.0, 0.5, 0, 3.84171, 0.51037, 0.7153, 1.07619),
    Seg(vec2(0.03649, 0.06834), vec2(0.02673, 0.10612), vec2(0.01227, 0.08011), 0.2, 0.12, 0.0, 0.5, 0, 4.35209, 0.05547, 1.07619, 0.77029),
    Seg(vec2(0.02673, 0.10612), vec2(0.10742, 0.04444), vec2(0.05976, 0.08794), 0.12, 0.28, 0.0, 0.5, 0, 4.40756, 0.08349, 0.77029, 1.82193),
    Seg(vec2(0.10742, 0.04444), vec2(0.27314, -0.22168), vec2(0.17574, -0.08051), 0.28, 1.0, 0.75, 0.45743, 1, 4.49104, 0.23312, 1.82193, 0.9611),
    Seg(vec2(0.27314, -0.22168), vec2(0.70268, -0.4779), vec2(0.454, -0.34071), 1.0, 0.06, 0.5, 0.43386, 1, 4.72416, 0.34086, 0.9611, 2.128)
);
*/
// 龍, 21 strokes
const int NSEG = 57;
const float TOTAL_TIME = 10.17032;
const Seg SEGS[NSEG] = Seg[NSEG](
    Seg(vec2(-0.44909, 0.45267), vec2(-0.27941, 0.34511), vec2(-0.40228, 0.4127), 0.1, 0.70122, 0.2, 0.30155, 1, 0.0, 0.15884, 2.08, 0.70146),
    Seg(vec2(-0.27941, 0.34511), vec2(-0.4011, 0.25933), vec2(-0.32812, 0.30131), 0.70122, 0.0, 0.13, 0.43751, 1, 0.15884, 0.11397, 0.70146, 2.2),
    Seg(vec2(-0.4011, 0.25933), vec2(-0.5044, 0.1186), vec2(-0.54487, 0.17664), 0.0, 0.26634, 0.0, 0.72467, 1, 0.27281, 0.10506, 2.2, 1.88039),
    Seg(vec2(-0.5044, 0.1186), vec2(-0.24321, 0.22343), vec2(-0.38597, 0.15824), 0.26634, 0.54, 0.0, 0.5, 0, 0.37787, 0.27069, 1.88039, 0.49822),
    Seg(vec2(-0.24321, 0.22343), vec2(-0.44775, 0.04038), vec2(-0.3442, 0.13161), 0.54, 0.49, 0.0, 0.49794, 1, 0.64856, 0.54706, 0.49822, 0.5053),
    Seg(vec2(-0.44775, 0.04038), vec2(-0.21714, 0.15228), vec2(-0.29355, 0.11092), 0.49, 0.30216, 0.0, 0.5, 0, 1.19562, 0.26277, 0.5053, 1.67429),
    Seg(vec2(-0.21714, 0.15228), vec2(-0.17532, 0.14042), vec2(-0.18232, 0.13945), 0.30216, 0.46, 0.0, 0.5, 0, 1.45839, 0.03953, 1.67429, 0.68908),
    Seg(vec2(-0.17532, 0.14042), vec2(-0.66554, -0.17395), vec2(-0.41746, -0.01766), 0.46, 0.38405, 0.0, 0.4974, 1, 1.49792, 0.55542, 0.68908, 1.51539),
    Seg(vec2(-0.66554, -0.17395), vec2(-0.69516, -0.16427), vec2(-0.70192, -0.18101), 0.38405, 0.25184, 0.0, 0.5, 0, 2.05334, 0.04575, 1.51539, 0.64875),
    Seg(vec2(-0.69516, -0.16427), vec2(-0.66771, -0.1931), vec2(-0.70628, -0.18866), 0.25184, 0.25668, 0.0, 0.5, 0, 2.09909, 0.05708, 0.64875, 1.45479),
    Seg(vec2(-0.66771, -0.1931), vec2(-0.10098, 0.05606), vec2(-0.32057, -0.0156), 0.25668, 0.63, 0.1, 0.62674, 1, 2.15617, 0.7177, 1.45479, 0.46025),
    Seg(vec2(-0.10098, 0.05606), vec2(-0.1949, -0.0302), vec2(-0.1664, 0.00621), 0.63, 0.11, 0.0, 0.5, 0, 2.87387, 0.11976, 0.46025, 2.068),
    Seg(vec2(-0.1949, -0.0302), vec2(-0.44421, -0.12617), vec2(-0.35133, -0.23003), 0.11, 0.06, 0.06, 0.66713, 1, 2.99363, 0.16641, 2.068, 2.128),
    Seg(vec2(-0.44421, -0.12617), vec2(-0.41046, -0.15566), vec2(-0.42597, -0.14738), 0.06, 0.23, 0.0, 0.5, 0, 3.16004, 0.02369, 2.128, 1.70965),
    Seg(vec2(-0.41046, -0.15566), vec2(-0.39811, -0.54328), vec2(-0.40397, -0.34847), 0.23, 0.58263, 0.0, 0.5, 0, 3.18373, 0.24567, 1.70965, 1.45436),
    Seg(vec2(-0.39811, -0.54328), vec2(-0.37192, -0.5967), vec2(-0.39682, -0.57349), 0.58263, 0.0, 0.54, 0.46945, 1, 3.42941, 0.03474, 1.45436, 2.2),
    Seg(vec2(-0.37192, -0.5967), vec2(-0.34349, -0.12343), vec2(-0.35458, -0.61286), 0.0, 0.1, 0.0, 0.02076, 1, 3.46415, 0.22846, 2.2, 2.08),
    Seg(vec2(-0.34349, -0.12343), vec2(-0.24419, -0.06428), vec2(-0.31299, -0.08836), 0.1, 0.43, 0.0, 0.5, 0, 3.69261, 0.06955, 2.08, 1.36401),
    Seg(vec2(-0.24419, -0.06428), vec2(-0.20347, -0.08974), vec2(-0.21851, -0.07577), 0.43, 0.47, 0.0, 0.5, 0, 3.76216, 0.03502, 1.36401, 1.40205),
    Seg(vec2(-0.20347, -0.08974), vec2(-0.16791, -0.56947), vec2(-0.18278, -0.32866), 0.47, 0.29398, 0.0, 0.5, 0, 3.79718, 0.30848, 1.40205, 1.72834),
    Seg(vec2(-0.16791, -0.56947), vec2(-0.1969, -0.61761), vec2(-0.17861, -0.61567), 0.29398, 0.31139, 0.0, 0.5, 0, 4.10566, 0.04555, 1.72834, 1.05716),
    Seg(vec2(-0.1969, -0.61761), vec2(-0.25245, -0.56619), vec2(-0.22357, -0.59604), 0.31139, 0.06, 0.0, 0.5, 0, 4.15121, 0.04951, 1.05716, 2.128),
    Seg(vec2(-0.25245, -0.56619), vec2(-0.35885, -0.27778), vec2(-0.45547, -0.35627), 0.06, 0.17, 0.06, 0.72483, 1, 4.20072, 0.1827, 2.128, 1.996),
    Seg(vec2(-0.35885, -0.27778), vec2(-0.26753, -0.23879), vec2(-0.30452, -0.25028), 0.17, 0.35, 0.26, 0.61423, 1, 4.38342, 0.08482, 1.996, 0.61521),
    Seg(vec2(-0.26753, -0.23879), vec2(-0.3842, -0.39196), vec2(-0.3305, -0.31847), 0.35, 0.30952, 0.0, 0.52834, 1, 4.46824, 0.31653, 0.61521, 0.60154),
    Seg(vec2(-0.3842, -0.39196), vec2(-0.18163, -0.27862), vec2(-0.26361, -0.32748), 0.30952, 0.18, 0.12, 0.58991, 1, 4.78477, 0.20041, 0.60154, 1.984),
    Seg(vec2(-0.18163, -0.27862), vec2(-0.00055, 0.31608), vec2(-0.07764, -0.21665), 0.18, 0.13, 0.13, 0.17618, 1, 4.98518, 0.31963, 1.984, 2.044),
    Seg(vec2(-0.00055, 0.31608), vec2(0.01021, 0.36331), vec2(0.00376, 0.34589), 0.13, 0.36, 0.0, 0.5, 0, 5.30481, 0.02797, 2.044, 1.46336),
    Seg(vec2(0.01021, 0.36331), vec2(0.16257, 0.41185), vec2(0.08531, 0.38805), 0.36, 0.26, 0.0, 0.5, 0, 5.33278, 0.09786, 1.46336, 1.8175),
    Seg(vec2(0.16257, 0.41185), vec2(0.19928, 0.44777), vec2(0.19107, 0.42266), 0.26, 0.09, 0.0, 0.5, 0, 5.43064, 0.02816, 1.8175, 2.092),
    Seg(vec2(0.19928, 0.44777), vec2(-0.04296, 0.59657), vec2(0.28326, 0.70446), 0.09, 0.04, 0.04, 0.4249, 1, 5.4588, 0.2395, 2.092, 2.152),
    Seg(vec2(-0.04296, 0.59657), vec2(0.01131, 0.54036), vec2(-0.06075, 0.57085), 0.04, 0.63466, 0.0, 0.5, 0, 5.6983, 0.05797, 2.152, 1.29803),
    Seg(vec2(0.01131, 0.54036), vec2(0.0123, 0.14242), vec2(0.0075, 0.33673), 0.63466, 0.42222, 0.15, 0.50876, 1, 5.75627, 0.38256, 1.29803, 0.81929),
    Seg(vec2(0.0123, 0.14242), vec2(0.20637, 0.24774), vec2(0.11511, 0.1878), 0.42222, 0.40475, 0.0, 0.5, 0, 6.13883, 0.31587, 0.81929, 0.59393),
    Seg(vec2(0.20637, 0.24774), vec2(0.06881, 0.02461), vec2(0.14725, 0.14219), 0.40475, 0.21, 0.0, 0.5, 0, 6.4547, 0.23116, 0.59393, 1.93236),
    Seg(vec2(0.06881, 0.02461), vec2(0.03116, -0.01444), vec2(0.03714, -0.00843), 0.21, 0.54102, 0.0, 0.5, 0, 6.68586, 0.05182, 1.93236, 0.48472),
    Seg(vec2(0.03116, -0.01444), vec2(0.20201, 0.08681), vec2(0.11104, 0.03224), 0.54102, 0.42158, 0.0, 0.5, 0, 6.73767, 0.20549, 0.48472, 1.69409),
    Seg(vec2(0.20201, 0.08681), vec2(0.29744, 0.14226), vec2(0.24388, 0.1096), 0.42158, 0.16, 0.0, 0.5, 0, 6.94316, 0.05978, 1.69409, 2.008),
    Seg(vec2(0.29744, 0.14226), vec2(-0.04103, -0.02386), vec2(0.31354, 0.15207), 0.16, 0.09, 0.09, 0.01586, 1, 7.00294, 0.18996, 2.008, 2.092),
    Seg(vec2(-0.04103, -0.02386), vec2(0.01172, -0.07007), vec2(-0.01255, -0.02883), 0.09, 0.62, 0.0, 0.5, 0, 7.1929, 0.04493, 2.092, 1.28403),
    Seg(vec2(0.01172, -0.07007), vec2(0.01401, -0.55157), vec2(0.00879, -0.30749), 0.62, 1.0, 0.84, 0.49478, 1, 7.23784, 0.45124, 1.28403, 0.87624),
    Seg(vec2(0.01401, -0.55157), vec2(0.16445, -0.67779), vec2(0.07394, -0.63569), 1.0, 0.68569, 0.0, 0.5, 0, 7.68908, 0.19121, 0.87624, 1.24472),
    Seg(vec2(0.16445, -0.67779), vec2(0.53383, -0.6551), vec2(0.33689, -0.71769), 0.68569, 0.72, 0.94, 0.46279, 1, 7.88029, 0.30177, 1.24472, 1.26606),
    Seg(vec2(0.53383, -0.6551), vec2(0.65431, -0.56993), vec2(0.60975, -0.62696), 0.72, 0.45953, 0.0, 0.5, 0, 8.18206, 0.11376, 1.26606, 1.3957),
    Seg(vec2(0.65431, -0.56993), vec2(0.64735, -0.2006), vec2(0.66555, -0.41435), 0.45953, 0.14, 0.24, 0.41746, 1, 8.29582, 0.21848, 1.3957, 2.032),
    Seg(vec2(0.64735, -0.2006), vec2(0.03072, -0.14439), vec2(0.59747, 0.38551), 0.14, 0.05, 0.05, 0.41545, 1, 8.5143, 0.53967, 2.032, 2.14),
    Seg(vec2(0.03072, -0.14439), vec2(0.04987, -0.19023), vec2(0.01187, -0.18129), 0.05, 0.49787, 0.0, 0.5, 0, 9.05397, 0.04518, 2.14, 1.08836),
    Seg(vec2(0.04987, -0.19023), vec2(0.26656, -0.12022), vec2(0.19953, -0.14264), 0.49787, 0.57, 0.54, 0.68713, 1, 9.09915, 0.17697, 1.08836, 1.50785),
    Seg(vec2(0.26656, -0.12022), vec2(0.32995, -0.11148), vec2(0.30464, -0.1133), 0.57, 0.14, 0.58, 0.60122, 1, 9.27612, 0.03646, 1.50785, 2.032),
    Seg(vec2(0.32995, -0.11148), vec2(0.02676, -0.30285), vec2(0.34783, -0.1102), 0.14, 0.17, 0.14, 0.01762, 1, 9.31258, 0.18389, 2.032, 1.996),
    Seg(vec2(0.02676, -0.30285), vec2(0.05973, -0.32526), vec2(0.03469, -0.31788), 0.17, 0.48, 0.0, 0.5, 0, 9.49647, 0.02482, 1.996, 1.41739),
    Seg(vec2(0.05973, -0.32526), vec2(0.29811, -0.25571), vec2(0.17797, -0.29116), 0.48, 0.56, 0.44, 0.49667, 1, 9.52129, 0.17101, 1.41739, 1.48731),
    Seg(vec2(0.29811, -0.25571), vec2(0.35389, -0.2618), vec2(0.33361, -0.2556), 0.56, 0.17, 0.38, 0.62555, 1, 9.6923, 0.03267, 1.48731, 1.996),
    Seg(vec2(0.35389, -0.2618), vec2(0.03422, -0.40271), vec2(0.37059, -0.2669), 0.17, 0.12, 0.12, 0.01885, 1, 9.72496, 0.17798, 1.996, 2.056),
    Seg(vec2(0.03422, -0.40271), vec2(0.0535, -0.44516), vec2(0.03415, -0.42825), 0.12, 0.46, 0.0, 0.5, 0, 9.90295, 0.03145, 2.056, 1.17945),
    Seg(vec2(0.0535, -0.44516), vec2(0.30579, -0.38411), vec2(0.1818, -0.41296), 0.46, 0.59665, 0.5, 0.50718, 1, 9.9344, 0.19732, 1.17945, 1.4617),
    Seg(vec2(0.30579, -0.38411), vec2(0.37518, -0.38806), vec2(0.34811, -0.38338), 0.59665, 0.0, 0.49, 0.60306, 1, 10.13172, 0.03859, 1.4617, 2.2)
);
// ===== end baked data =====

// Degenerate-cubic bezier (both handles = c) == quadratic through p1,c,p2.
vec2 bez(vec2 p1, vec2 c, vec2 p2, float t) {
    float u = 1.0 - t;
    return u * u * u * p1 + (3.0 * u * u * t + 3.0 * u * t * t) * c + t * t * t * p2;
}

// Pressure along a segment at arc progress s. Belly curve = quadratic value
// curve through (belly,k) with endpoints (0,A),(1,B): solve bezier_x(t)=s for t,
// return bezier_y(t).  (mirrors engine.js pressureAt)
float pressureAt(float A, float B, float k, float s, float bellyX) {
    float cx = clamp(bellyX, 0.0, 1.0);
    float a = 1.0 - 2.0 * cx, b = 2.0 * cx, c = -s;
    float t;
    if (abs(a) < 1e-6) {
        t = b > 1e-6 ? -c / b : s;
    } else {
        float disc = max(0.0, b * b - 4.0 * a * c);
        t = (-b + sqrt(disc)) / (2.0 * a);
    }
    t = clamp(t, 0.0, 1.0);
    float u = 1.0 - t;
    return u * u * A + 2.0 * u * t * k + t * t * B;
}

// Revealed arc fraction at time-fraction tp, exact inverse of the engine's
// auto-timing (velocity linear in ARC: travelTime uses ∫ds/v -> log). Solving
// for arc at time τ=tp·dur gives  r = v0·(ratio^tp - 1)/(v1 - v0),  ratio=v1/v0.
// (v0==v1 -> linear r=tp). Matches engine.js sampleStroke exactly.
float revealArc(float tp, float v0, float v1) {
    float dv = v1 - v0;
    if (abs(dv) < 1e-5) return clamp(tp, 0.0, 1.0);
    float ratio = v1 / v0;
    return clamp(v0 * (pow(ratio, tp) - 1.0) / dv, 0.0, 1.0);
}

// Exact 2D signed distance to a round cone (capsule with linearly-varying
// radius r1->r2). Round caps + round joins, true taper. (Inigo Quilez.)
// https://iquilezles.org/articles/distfunctions/
float sdRoundedCone(vec2 p, vec2 a, vec2 b, float r1, float r2) {
    vec2 ba = b - a;
    float l2 = dot(ba, ba);
    if (l2 < 1e-12) return length(p - a) - r1;     // degenerate: a==b
    float rr = r1 - r2;
    float a2 = l2 - rr * rr;
    float il2 = 1.0 / l2;
    vec2 pa = p - a;
    float y = dot(pa, ba);
    float z = y - l2;
    vec2 xv = pa * l2 - ba * y;
    float x2 = dot(xv, xv);
    float y2 = y * y * l2;
    float z2 = z * z * l2;
    float k = sign(rr) * rr * rr * x2;
    if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
    if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}


float lineCover(vec2 p, vec2 a, vec2 b, float halfW, float aa) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    float d = length(pa - ba * h);
    return 1.0 - smoothstep(halfW - aa, halfW + aa, d);
}

float komeGrid(vec2 w, float aa) {
    float hw = GRID_SIZE * 0.5;
    vec2 bl = vec2(-hw, -hw), br = vec2(hw, -hw);
    vec2 tr = vec2(hw, hw),   tl = vec2(-hw, hw);
    float lw = aa * 0.9;                       // line half-width
    float g = 0.0;
    // outer square
    g = max(g, lineCover(w, bl, br, lw, aa));
    g = max(g, lineCover(w, br, tr, lw, aa));
    g = max(g, lineCover(w, tr, tl, lw, aa));
    g = max(g, lineCover(w, tl, bl, lw, aa));
    // center cross + diagonals
    g = max(g, lineCover(w, vec2(-hw, 0.0), vec2(hw, 0.0), lw, aa));
    g = max(g, lineCover(w, vec2(0.0, -hw), vec2(0.0, hw), lw, aa));
    g = max(g, lineCover(w, bl, tr, lw, aa));
    g = max(g, lineCover(w, br, tl, lw, aa));
    return g;
}


// cheap hash -> [-1,1] grain per pixel
float grainNoise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) * 2.0 - 1.0;
}

// gradient noise (from the enso brush) for ink bleed + bristle texture
vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float vnoise(vec2 p) {
    const float K1 = 0.366025404, K2 = 0.211324865;
    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;
    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
    vec3 n = h * h * h * h * vec3(dot(a, hash2(i)), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));
    return dot(n, vec3(70.0));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 w = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    float px = 2.0 / iResolution.y;
    float aa = 1.5 * px;

    vec3 col = PAPER_COLOR;

#if SHOW_GRID
    float g = komeGrid(w, aa);
    col = mix(col, GRID_COLOR.rgb, g * GRID_COLOR.a);
#endif

#if ANIMATE
    float T = mod(iTime * ANIM_SPEED, TOTAL_TIME + ANIM_HOLD);
#endif

    // accumulate the nearest signed distance to the variable-width ink tube
    float dmin = 1e9;
    for (int i = 0; i < NSEG; i++) {
        Seg s = SEGS[i];
        vec2 p1 = s.p1, p2 = s.p2, c = s.ctrl;
        float pa = s.pr1, pb = s.pr2;

        // reveal: how much of this segment's arc is drawn at time T
#if ANIMATE
        float tp = clamp((T - s.t0) / s.dur, 0.0, 1.0);
        if (tp <= 0.0) continue;                           // not started yet
        float r = revealArc(tp, s.v0, s.v1);
#else
        float r = 1.0;                                     // fully drawn
#endif

        // cheap reject: bezier lives inside hull of {p1,c,p2}. If the pixel is
        // farther than (hull radius + max brush radius + aa) it can never be
        // the nearest ink edge — skip the whole sample walk.
        vec2 cen = (p1 + p2) * 0.5;
        float hullR = max(length(p1 - cen), length(c - cen));
        if (length(w - cen) - hullR - BASE_RADIUS > aa + BLEED_WIDTH) continue;

        // walk the revealed portion [0, r] as round-cone sub-segments
        vec2 prevPos = bez(p1, c, p2, 0.0);
        float prevRad = BASE_RADIUS * max(MIN_PRESS, pa);
        for (int k = 1; k <= SAMPLES; k++) {
            float t = (float(k) / float(SAMPLES)) * r;
            float pr = (s.hasBelly == 1)
                ? pressureAt(pa, pb, s.k, t, s.belly)
                : mix(pa, pb, t);
            vec2 pos = bez(p1, c, p2, t);
            float rad = BASE_RADIUS * max(MIN_PRESS, pr);
            dmin = min(dmin, sdRoundedCone(w, prevPos, pos, prevRad, rad));
            prevPos = pos;
            prevRad = rad;
        }
    }

#if INK_BLEED
    float eN   = vnoise(w * BLEED_FREQ);
    float edge = dmin + eN * BLEED_WIDTH * BLEED_JITTER;
    float core = smoothstep(aa, -aa, edge);
    float halo = smoothstep(BLEED_WIDTH, -aa, edge);   // diluted outer spread
    float ink  = max(core, halo * BLEED_HALO);
#else
    float ink = smoothstep(aa, -aa, dmin);             // single clean AA edge
#endif

    col = mix(col, INK_COLOR, ink);
    float n = grainNoise(fragCoord) * GRAIN;
    col *= 1.0 + n * (1.0 - 0.5 * ink);
    vec2 uv = fragCoord / iResolution.xy;
    float vig = 1.0 - VIGNETTE * dot(uv - 0.5, uv - 0.5) * 2.0;
    col *= vig;

    fragColor = vec4(col, 1.0);
}
