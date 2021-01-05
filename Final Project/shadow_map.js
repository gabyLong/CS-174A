import {defs, tiny} from './examples/common.js';
import {Shape_From_File} from './examples/obj-file-demo.js';
const {
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Matrix, Mat4, Light, Shape, Material, Scene, Shader, Texture
} = tiny;

export class Phong_Shader_Shadow extends defs.Phong_Shader {
  constructor(shadow_map) {
      super();
      this.shadow_map = shadow_map;
  }

  shared_glsl_code() {
      return super.shared_glsl_code() + `
          varying vec4 shadow_coord;
          `;
  }

  vertex_glsl_code() {
      return this.shared_glsl_code() + `
          attribute vec3 position, normal;
          // Position is expressed in object coordinates.
          
          uniform mat4 model_transform;
          uniform mat4 projection_camera_model_transform;
          uniform mat4 light_pcm_matrix;

          void main() {
              // The vertex's final resting place (in NDCS):
              gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
              // The vertex's position on the shadow buffer texture
              shadow_coord = light_pcm_matrix * vec4(position, 1.0);
              // The final normal vector in screen space.
              N = normalize( mat3( model_transform ) * normal / squared_scale);
              vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
          }`;
  }

  fragment_glsl_code() {
      return this.shared_glsl_code() + `
          uniform sampler2D shadow_map;

          void main() {
              float shadow_depth = texture2D( shadow_map, shadow_coord.xy ).r;

              // Check if the shadow coordinate is inside the shadow texture range
              // If dark regions appear elsewhere in the scene, add lower bound check
              bool inside_shadow_map = shadow_coord.y < 1.0 && shadow_coord.x < 1.0;

              float shadow_intensity = light_attenuation_factors[0] > 0.1 ? min(1.0, light_attenuation_factors[0] + 0.1) : 0.1;
              vec3 lightDir = light_positions_or_vectors[0].xyz - light_positions_or_vectors[0].w * vertex_worldspace;
              float bias = max(0.05 * (1.0 - dot(N, lightDir)), 0.01);
              float visibility = inside_shadow_map && shadow_depth < shadow_coord.z - bias ? shadow_intensity : 1.0;
              // Why ".r"? It selects the red channel, which is the only channel in our depth texture

              // gl_FragColor = vec4(visibility * vec3(1.0, 1.0, 1.0), 1.0); // Debug code; see which areas are in shadow

              // Compute an initial (ambient) color:
              gl_FragColor = vec4( shape_color.xyz * ambient, shape_color.w );
              // Compute the final color with contributions from lights:
              gl_FragColor.xyz += visibility * phong_model_lights( normalize( N ), vertex_worldspace );
          }`;
  }

  update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
      super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);

      const bias = Matrix.of([0.5, 0, 0, 0.5], [0, 0.5, 0, 0.5], [0, 0, 0.5, 0.5], [0, 0, 0, 1]);
      const light_PCM_matrix = bias.times(this.shadow_map.PM_matrix.times(model_transform));
      context.uniformMatrix4fv(gpu_addresses.light_pcm_matrix, false, Matrix.flatten_2D_to_1D(light_PCM_matrix.transposed()));

      // Use texture unit 0 for the shadow map
      context.uniform1i(gpu_addresses.shadow_map, 0);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, this.shadow_map.depth_buffer);
  }
}

export class Textured_Phong_Shader_Shadow extends Phong_Shader_Shadow {
  vertex_glsl_code() {
      return this.shared_glsl_code() + `
          varying vec2 f_tex_coord;
          attribute vec3 position, normal;
          // Position is expressed in object coordinates.
          attribute vec2 texture_coord;

          uniform mat4 model_transform;
          uniform mat4 projection_camera_model_transform;
          uniform mat4 light_pcm_matrix;

          void main() { 
              // The vertex's final resting place (in NDCS):
              gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
              // The vertex's position on the shadow buffer texture
              shadow_coord = light_pcm_matrix * vec4(position, 1.0);
              // The final normal vector in screen space.
              N = normalize( mat3( model_transform ) * normal / squared_scale);
              vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
              // Turn the per-vertex texture coordinate into an interpolated variable.
              f_tex_coord = texture_coord;
      }`;
  }

  fragment_glsl_code() {
      return this.shared_glsl_code() + `
          varying vec2 f_tex_coord;
          uniform sampler2D texture;
          uniform sampler2D shadow_map;
  
          void main() {
              float shadow_depth = texture2D( shadow_map, shadow_coord.xy ).r;
              bool inside_shadow_map = shadow_coord.y < 1.0 && shadow_coord.x < 1.0 && shadow_coord.y > 0.0 && shadow_coord.x > 0.0;
              float shadow_intensity = light_attenuation_factors[0] > 0.1 ? min(1.0, light_attenuation_factors[0] + 0.1) : 0.1;
              float visibility = inside_shadow_map && shadow_depth < shadow_coord.z - 0.005 ? shadow_intensity : 1.0;

              // Sample the texture image in the correct place:
              vec4 tex_color = texture2D( texture, f_tex_coord );
              if( tex_color.w < .01 ) discard;
              // Compute an initial (ambient) color:
              gl_FragColor = vec4( visibility * ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
              // Compute the final color with contributions from lights:
              gl_FragColor.xyz += visibility * phong_model_lights( normalize( N ), vertex_worldspace );
          }`;
  }

  update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
      // update_GPU(): Add a little more to the base class's version of this method.
      super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);

      if (material.texture && material.texture.ready) {
          const texture_unit = 1;
          // Select texture unit for the fragment shader Sampler2D uniform called "texture":
          context.uniform1i(gpu_addresses.texture, texture_unit);
          // For this draw, use the texture image from correct the GPU buffer:
          material.texture.activate(context, texture_unit);
      }
  }
}

// Things that can still be worked on
//  * Calculate bias using slope to avoid shadow acne on angled geometry
//  * Calculate projection matrix based on what the viewer can see
//  * Make a "coordinate_in_shadow_map" function and add it to the shared glsl code
export class Shadow_Map {
  constructor(frame_size = 2048) {
      this.old_viewport_size = null;
      this.program = null;
      this.frame_buffer_id = null;
      this.depth_buffer_color_texture = null;
      this.depth_buffer = null;
      this.PM_matrix = null;

      this.uniforms = {};
      this.projection_matrix = Mat4.orthographic(-20,20,-20,20,0,100);
      this.initialized = false;
      this.frame_size = frame_size;
  }

  initialize(gl) {
      const ext = gl.getExtension("WEBGL_depth_texture");
      this.createShaders(gl);
      // Save old viewport size for when we need to reset it
      this.old_viewport_size = gl.getParameter(gl.VIEWPORT);


      this.frame_buffer_id = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.frame_buffer_id);
      
      // Create depth buffer
      this.depth_buffer = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.depth_buffer); // Make the texture a 2D texture
      // Set the various options for the depth buffer texture
      gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.DEPTH_COMPONENT,
          this.frame_size,
          this.frame_size,
          0,
          gl.DEPTH_COMPONENT,
          gl.UNSIGNED_INT,
          null);

      // Set texture to use nearest neighbor scaling
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      // Set texture coordinates to clamp as opposed to wrap around
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // Attach a texture to a frame buffer
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depth_buffer, 0);
      
      // From https://webglfundamentals.org/webgl/lessons/webgl-shadows.html
      // See: https://webglfundamentals.org/webgl/lessons/webgl-shadows.html#attachment-combinations
      // Create a color texture of the same size as the depth texture
      this.depth_buffer_color_texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.depth_buffer_color_texture);
      gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          this.frame_size,
          this.frame_size,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      
      // attach it to the framebuffer
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER,        // target
          gl.COLOR_ATTACHMENT0,  // attachment point
          gl.TEXTURE_2D,         // texture target
          this.depth_buffer_color_texture,    // texture
          0);                    // mip level

      this.getUniform(gl, 'projection_camera_matrix');


      switch(gl.checkFramebufferStatus(gl.FRAMEBUFFER)){
          case gl.FRAMEBUFFER_COMPLETE: break;
          case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT: console.log("FRAMEBUFFER_INCOMPLETE_ATTACHMENT"); break;
          case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: console.log("FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT"); break;
          case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS: console.log("FRAMEBUFFER_INCOMPLETE_DIMENSIONS"); break;
          case gl.FRAMEBUFFER_UNSUPPORTED: console.log("FRAMEBUFFER_UNSUPPORTED"); break;
          case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE: console.log("FRAMEBUFFER_INCOMPLETE_MULTISAMPLE"); break;
          case gl.RENDERBUFFER_SAMPLES: console.log("RENDERBUFFER_SAMPLES"); break;
      }

      //Cleanup
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.useProgram(null);
      this.initialized = true;
      this.ready = true;
  }

  getUniform(gl, name) {
      const location = gl.getUniformLocation(this.program, name);
      this.uniforms[name]= location;
  }

  createShaders(gl) {
      const vertex_shader_program = `
      attribute vec3 position; // This is an attribute, it gets pulled in automatically
      uniform mat4 projection_camera_matrix; // We need to set this before we call the shader
                                             // This sets the camera to an orthographic projection
                                             //  from the position of the light source
      uniform mat4 shape_transform; // This is the model transform of whatever shape we're drawing
                                    //  onto the scene

      void main() {
          gl_Position = projection_camera_matrix * vec4(position, 1.0);
      }
      `;
      const vertex_shader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertex_shader, vertex_shader_program);
      gl.compileShader(vertex_shader);



      //Get Error data if shader failed compiling
      if(!gl.getShaderParameter(vertex_shader, gl.COMPILE_STATUS)){
          console.error("Error compiling shader", gl.getShaderInfoLog(vertex_shader));
          throw 'Vertex shader failed to compile.';
      }

      const fragment_shader_program = `
      void main (void) {
          gl_FragColor = vec4((gl_FragCoord.z) * vec3(1.0, 1.0, 1.0), 1.0);
          // gl_Position = gl_FragCoord.z; // This is implied
      }
      `;
      const fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragment_shader, fragment_shader_program);
      gl.compileShader(fragment_shader);


      //Get Error data if shader failed compiling
      if(!gl.getShaderParameter(fragment_shader, gl.COMPILE_STATUS)){
          console.error("Error compiling shader", gl.getShaderInfoLog(fragment_shader));
          throw 'Fragment shader failed to compile.';
      }
      // Create the program
      this.program = gl.createProgram();
      gl.attachShader(this.program, vertex_shader);
      gl.attachShader(this.program, fragment_shader);
      gl.linkProgram(this.program);

      // Once they're linked, we can detach the shaders
      // Might be unnecessary, might cause issues
      gl.detachShader(this.program, vertex_shader);
      gl.detachShader(this.program, fragment_shader);
      gl.deleteShader(vertex_shader);
      gl.deleteShader(fragment_shader);
  }

  render(webgl_manager, shapes_list, light) {
      const gl = webgl_manager.context;
      if(!this.initialized) {
          this.initialize(gl);
      }

      const camera_matrix = Mat4.look_at(light.position.to3(), vec3(0, 0, 0), vec3(0, 1, 0));
      
      // Resize Viewport and Bind Framebuffer
      gl.viewport(0, 0, this.frame_size, this.frame_size);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.frame_buffer_id);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Solve some Peter-panning
      gl.cullFace(gl.FRONT);

      // Load shader
      gl.useProgram(this.program);

      this.PM_matrix = this.projection_matrix.times(camera_matrix); // This is the world from the light's perspective

      // gl.enable(gl.DEPTH_TEST); // Already enabled by tiny-graphics.js
      gl.disable(gl.BLEND); // Need to re-enable before rendering scene

      // RENDER SHAPES HERE
      shapes_list.forEach(({shape, model_transform, shadow}) => {
          if(!shadow) return;
          if(shape instanceof Shape_From_File && !shape.ready) return;
          const gpu_instance = shape.activate(gl);

          // Pass in PCM matrix
          const PCM = this.PM_matrix.times(model_transform);
          gl.uniformMatrix4fv(this.uniforms.projection_camera_matrix, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

          // Pass in the shape's vertex positions
          gl.enableVertexAttribArray(0);
          gl.bindBuffer(gl.ARRAY_BUFFER, gpu_instance.webGL_buffer_pointers.position);
          gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

          // Pass in indicies and draw
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpu_instance.index_buffer);
          gl.drawElements(gl.TRIANGLES, shape.indices.length, gl.UNSIGNED_INT, 0);
      });
      
      // Reset stuff
      gl.viewport(...this.old_viewport_size);
      gl.enable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.cullFace(gl.BACK);
  }

  // Activate this as a texture
  activate(gl, texture_unit = 0) {
      gl.activeTexture(gl["TEXTURE" + texture_unit]);
      gl.bindTexture(gl.TEXTURE_2D, this.depth_buffer_color_texture);
  }
}