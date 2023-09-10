const canvas = document.body.appendChild(document.createElement("canvas"));
const gl = canvas.getContext("webgl2");
gl.viewport(0, 0, (canvas.width = window.innerWidth), (canvas.height = window.innerHeight));
canvas.style.cssText =
  "pointer-events: none; position: absolute; width: 100%; height: 100%; z-index: -1; top: 0; left: 0;";

const program = createProgram(
  `#version 300 es

        precision highp float;

        void main(void) {
            float x = float((gl_VertexID & 1) << 2);
            float y = float((gl_VertexID & 2) << 1);
            gl_Position = vec4(x - 1.0, y - 1.0, 0, 1);
        }`,
  `#version 300 es
        
        precision highp float;

        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;

        out vec4 fragmentColor;

        #define PI 3.14159265

        highp float random1d(float dt) {
            highp float c = 43758.5453;
            highp float sn = mod(dt, 3.14);
            return fract(sin(sn) * c);
        }

        vec2 random_drop_pos(float val, vec2 screen_dim, vec2 velocity) {
            float max_x_move = velocity.x * abs(screen_dim.y / velocity.y);
            float x = -max_x_move * step(0.0, max_x_move) + (screen_dim.x + abs(max_x_move)) * random1d(val);
            float y = (1.0 + 0.05 * random1d(1.234 * val)) * screen_dim.y;

            return vec2(x, y);
        }

        vec3 trail_color(vec2 pixel, vec2 pos, vec2 velocity_dir, float width, float size) {
            vec2 pixel_dir = pixel - pos;
            float projected_dist = dot(pixel_dir, -velocity_dir);
            float tanjential_dist_sq = dot(pixel_dir, pixel_dir) - pow(projected_dist, 2.0);
            float width_sq = pow(width, 2.0);

            float line = step(0.0, projected_dist) * (1.0 - smoothstep(width_sq / 2.0, width_sq, tanjential_dist_sq));
            float dashed_line = line * step(0.5, cos(0.3 * projected_dist - PI / 3.0));
            float fading_dashed_line = dashed_line * (1.0 - smoothstep(size / 5.0, size, projected_dist));

            return vec3(fading_dashed_line);
        }

        vec3 wave_color(vec2 pixel, vec2 pos, float size, float time) {
            vec2 pixel_dir = pixel - pos;
            float distorted_dist = length(pixel_dir * vec2(1.0, 3.5));

            float inner_radius = (0.05 + 0.8 * time) * size;
            float outer_radius = inner_radius + 0.25 * size;

            float ring = smoothstep(inner_radius, inner_radius + 5.0, distorted_dist)
                    * (1.0 - smoothstep(outer_radius, outer_radius + 5.0, distorted_dist));
            float fading_ring = ring * (1.0 - smoothstep(0.0, 0.7, time));

            return vec3(fading_ring);
        }

        vec3 background_color(vec2 pixel, vec2 screen_dim, float time) {
            return vec3(0.0, 0.0, 1.0 - smoothstep(-1.0, 0.8 + 0.2 * cos(0.5 * time), pixel.y / screen_dim.y));
        }

        void main() {
            const float n_drops = 20.0;
            float trail_width = 2.0;
            float trail_size = 70.0;
            float wave_size = 20.0;
            float fall_time = 0.7;
            float life_time = fall_time + 0.5;

            vec2 velocity = vec2(u_mouse.x - 0.5 * u_resolution.x, -0.9 * u_resolution.y) / fall_time;
            vec2 velocity_dir = normalize(velocity);
            vec3 pixel_color = vec3(0.0);

            for (float i = 0.0; i < n_drops; ++i) {
                float time = u_time + life_time * (i + i / n_drops);
                float ellapsed_time = mod(time, life_time);
                vec2 initial_pos = random_drop_pos(i + floor(time / life_time - i) * n_drops, u_resolution, velocity);

                if (ellapsed_time < fall_time) {
                    vec2 current_pos = initial_pos + ellapsed_time * velocity;
                    pixel_color += trail_color(gl_FragCoord.xy, current_pos, velocity_dir, trail_width, trail_size);
                } else {
                    vec2 final_pos = initial_pos + fall_time * velocity;
                    pixel_color += wave_color(gl_FragCoord.xy, final_pos, wave_size, ellapsed_time - fall_time);
                }
            }

            pixel_color += background_color(gl_FragCoord.xy, u_resolution, u_time);
            fragmentColor = vec4(pixel_color, 1.0);
        }`
);

const time = program.createUniform("1f", "u_time");
const resolution = program.createUniform("2f", "u_resolution");
const mouse = program.createUniform("2f", "u_mouse");
gl.useProgram(program);

function createShader(source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function createProgram(vertex, fragment) {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(vertex, gl.VERTEX_SHADER));
  gl.attachShader(program, createShader(fragment, gl.FRAGMENT_SHADER));
  gl.linkProgram(program);

  program.createUniform = function (type, name) {
    const location = gl.getUniformLocation(program, name);
    return function (v1, v2, v3, v4) {
      gl["uniform" + type](location, v1, v2, v3, v4);
    };
  };

  return program;
}

document.onmousemove = (e) => {
  mouse(e.clientX, e.clientY);
};

function frame(t) {
  resolution(canvas.width, canvas.height);
  time(t / 1000);
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
