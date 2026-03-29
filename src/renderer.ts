import { vertexSource, fragmentSource } from './shaders';
import type { RenderParams } from './types';

const UNIFORM_NAMES = [
  'u_resolution',
  'u_time',
  'u_lightPos',
  'u_pillX',
  'u_pillWidth',
  'u_pillHeight',
  'u_navRadius',
  'u_transitionVel',
  'u_pressAmt',
  'u_tintColor',
] as const;

export class LiquidGlassRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private uniforms: Record<string, WebGLUniformLocation | null>;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: true,
      alpha: true,
      antialias: true,
    });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

    const vs = this.compile(gl.VERTEX_SHADER, vertexSource);
    const fs = this.compile(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Link failed: ' + gl.getProgramInfoLog(program));
    }
    this.program = program;

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    this.uniforms = {};
    for (const name of UNIFORM_NAMES) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    const canvas = this.gl.canvas as HTMLCanvasElement;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    this.gl.viewport(0, 0, canvas.width, canvas.height);
  }

  render(params: RenderParams): void {
    const { gl, uniforms } = this;
    const dpr = window.devicePixelRatio || 1;

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform2f(uniforms.u_resolution!, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(uniforms.u_time!, params.time);
    gl.uniform2f(uniforms.u_lightPos!, params.lightPos[0], params.lightPos[1]);
    gl.uniform1f(uniforms.u_pillX!, params.pillX * dpr);
    gl.uniform1f(uniforms.u_pillWidth!, params.pillWidth * dpr);
    gl.uniform1f(uniforms.u_pillHeight!, params.pillHeight * dpr);
    gl.uniform1f(uniforms.u_navRadius!, params.navRadius * dpr);
    gl.uniform1f(uniforms.u_transitionVel!, params.transitionVel);
    gl.uniform1f(uniforms.u_pressAmt!, params.pressAmt);
    gl.uniform3f(
      uniforms.u_tintColor!,
      params.tintColor[0],
      params.tintColor[1],
      params.tintColor[2],
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  destroy(): void {
    this.gl.deleteProgram(this.program);
    const ext = this.gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }

  private compile(type: number, source: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile: ' + info);
    }
    return shader;
  }
}
