import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture,
} = tiny;

const {Cube, Axis_Arrows, Textured_Phong} = defs

export class Assignment4 extends Scene {
    /**
     *  **Base_scene** is a Scene that can be added to any display canvas.
     *  Setup the shapes, materials, camera, and lighting here.
     */
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // TODO:  Create two cubes, including one with the default texture coordinates (from 0 to 1), and one with the modified
        //        texture coordinates as required for cube #2.  You can either do this by modifying the cube code or by modifying
        //        a cube instance's texture_coords after it is already created.
        this.shapes = {
            box_1: new Cube(),
            box_2: new Cube(),
            axis: new Axis_Arrows(),
            ecPoly: new newShape()
        }
        console.log(this.shapes.box_1.arrays.texture_coord)
        this.shapes.box_2.arrays.texture_coord.forEach(v => v.scale_by(2));
        this.pre_shape1 = Mat4.identity().times(Mat4.translation(-2, 0, 0));
        this.pre_shape2 = Mat4.identity().times(Mat4.translation(2, 0, 0));

        // TODO:  Create the materials required to texture both cubes with the correct images and settings.
        //        Make each Material from the correct shader.  Phong_Shader will work initially, but when
        //        you get to requirements 6 and 7 you will need different ones.
        this.materials = {
            phong: new Material(new Textured_Phong(), {
                color: hex_color("#ffffff"),
            }),
            texture: new Material(new Textured_Phong(), {
                color: hex_color("#ffffff"),
                ambient: .5, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/stars.png")
            }),

            texture_1: new Material(new Texture_Rotate(), {
                color: hex_color("#ffffff"),
                ambient: .5, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/reindeer.jpg", "NEAREST")
            }),

            texture_2: new Material(new Texture_Scroll_X(), {
                color: hex_color("#ffffff"),
                ambient: .5, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/snowman.jpg", "LINEAR_MIPMAP_LINEAR")
            }),

            texture_ec: new Material(new Texture_Scroll_X(), {
                color: hex_color("#ffffff"),
                ambient: .5, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/christmastree.jpg", "LINEAR_MIPMAP_LINEAR")
            }),
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
    }

    make_control_panel() {
        // TODO:  Implement requirement #5 using a key_triggered_button that responds to the 'c' key.
        this.key_triggered_button("start/stop rotating", ["c"], () => {
            this.Rotation ^= true;

        });



    }

    display(context, program_state) {
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(Mat4.translation(0, 0, -5));
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);

        const light_position = vec4(10, 10, 10, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        let t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        let model_transform = Mat4.identity();

        // TODO:  Draw the required boxes. Also update their stored matrices.
        //this.shapes.axis.draw(context, program_state, model_transform, this.materials.phong.override({color: hex_color("#ffff00")}));
        const angle = 30*2*Math.PI/60;

        let shape_1 = this.pre_shape1;
        if(this.Rotation)
            shape_1 = shape_1.times(Mat4.rotation(angle*t, 1,0, 0));
        this.shapes.box_1.draw(context, program_state, shape_1, this.materials.texture_1);
        this.pre_shape1 = shape_1;

        const angle_2 = 20*2*Math.PI/60;

        let shape_2 = this.pre_shape2;
        if(this.Rotation)
            shape_2 = shape_2.times(Mat4.rotation(angle_2*t, 0,1, 0));
        this.shapes.box_2.draw(context, program_state, shape_2, this.materials.texture_2);
        this.pre_shape2 = shape_2;
    }
}


class Texture_Scroll_X extends Textured_Phong {
    // TODO:  Modify the shader below (right now it's just the same fragment shader as Textured_Phong) for requirement #6.
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float animation_time;
            
            void main(){
                // Sample the texture image in the correct place:
                vec2 current_coord = f_tex_coord + 2.0*animation_time;
                
                vec4 tex_color = texture2D( texture, current_coord);
                if( tex_color.w < .01 ) discard;
                                                                         // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }
}

//around 1:30 for ec
class Texture_Rotate extends Textured_Phong {
    // TODO:  Modify the shader below (right now it's just the same fragment shader as Textured_Phong) for requirement #7.
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float animation_time;
            void main(){
                // Sample the texture image in the correct place:
                float PI = 3.14159265358979323846;
                
                /*
                float theta = 15.0 * 2.0 * PI * animation_time/(60.0);
                mat2 Rotation = mat2(cos(theta), -sin(theta), cos(theta), sin(theta));
                vec2 current_coord = f_tex_coord - vec2(0.5,0.5);
                
                current_coord = Rotation * current_coord;
                current_coord = current_coord + vec2(0.5,0.5);
                vec4 tex_color = texture2D( texture, current_coord );
                if( tex_color.w < .01 ) discard;
                */
                
                vec2 current_coord = f_tex_coord; 
                vec2 temp_coord = vec2(current_coord);
                mat2 rotation = mat2(cos(mod(0.25 * 6.28318530718 * animation_time, 44.0 * PI)), 
                    sin(mod(0.25 * 6.28318530718 * animation_time, 44.0 * PI)), 
                    -sin(mod(0.25 * 6.28318530718 * animation_time, 44.0 * PI)), 
                    cos(mod(0.25 * 6.28318530718 * animation_time, 44.0 * PI)));
                 
                temp_coord = temp_coord + vec2(-.5, -.5);
                temp_coord = rotation * temp_coord; 
                temp_coord = temp_coord + vec2(.5, .5);
                vec4 tex_color = texture2D(texture, temp_coord.xy); 
                                                                         // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }
}

const newShape = defs.newShape =
    class newShape extends Shape {
        constructor() {
            super("position", "normal", "texture_coord");
            // Loop 3 times (for each axis), and inside loop twice (for opposing cube sides):
            for (let i = 0; i < 3; i++)
                for (let j = 0; j < 2; j++) {
                    const square_transform = Mat4.rotation(i == 0 ? Math.PI / 2 : 0, 1, 0, 0)
                        .times(Mat4.rotation(Math.PI * j - (i == 1 ? Math.PI / 2 : 0), 0, 1, 0))
                        .times(Mat4.translation(0, 0, 1));
                    // Calling this function of a Square (or any Shape) copies it into the specified
                    // Shape (this one) at the specified matrix offset (square_transform):
                    Cube.insert_transformed_copy_into(this, [], square_transform);
                }
        }
    }