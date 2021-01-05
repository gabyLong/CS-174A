import { defs, tiny } from './examples/common.js';
import { Movement_Controls } from './collider_movement_ctrls.js'
import { Shape_From_File } from './examples/obj-file-demo.js'
import { Phong_Shader_Shadow, Textured_Phong_Shader_Shadow, Shadow_Map } from './shadow_map.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;
const { Subdivision_Sphere } = defs

/**
 * @typedef {Object} ModelProps
 * @property {Shape} shape
 * @property {Matrix} model_transform
 * @property {boolean} collision
 * @property {boolean} shadow
 */

export class MountainScene extends Scene {
    constructor() {
        super();
        this.hover = this.swarm = false;

        this.shadow_map = new Shadow_Map(8192);

        this.shapes = {
            mountain: new Shape_From_File('./assets/updated_mountain.obj'),
            tree: new Shape_From_File('./assets/tree.obj'),
            cloud: new Shape_From_File('./assets/cloud.obj'),
            skybox: new defs.Cube(),
            ground: new defs.Square(),
            shadow_box: new defs.Square(),
            torus: new defs.Torus(66, 8),
            depth_texture_debug: new defs.Square(),
        };
        this.shapes.skybox.arrays.texture_coord.forEach(v => {
            v.scale_by(0);
        });

        // Create texture coordinates for skybox
        const texture_box_order = [2, 4, 3, 5];
        for(let i = 0; i < 4; i++) {
            const offset = 4 * texture_box_order[i];
            const x_offset = 0.25 * i;
            this.shapes.skybox.arrays.texture_coord[0 + offset] = Vector.create(x_offset, 0);
            this.shapes.skybox.arrays.texture_coord[1 + offset] = Vector.create(x_offset + 0.25, 0);
            this.shapes.skybox.arrays.texture_coord[2 + offset] = Vector.create(x_offset, 0.25);
            this.shapes.skybox.arrays.texture_coord[3 + offset] = Vector.create(x_offset + 0.25, 0.25);
        }

        // color: color( 0.0, 0.0, 0.0, 0.3 )

        this.shapes.ground.arrays.texture_coord.forEach(v => {
            v.scale_by(100);
        });


        this.materials = {
            ground: new Material(new Phong_Shader_Shadow(this.shadow_map),
                { ambient: 0.5, diffusivity: 0.8, specularity: 0, color: hex_color("#5e3614") }),

            tree: new Material(new Phong_Shader_Shadow(this.shadow_map),
                { ambient: 0.3, diffusivity: 1, specularity: 0.2, color: hex_color("#005c1e") }),
            //{ambient: 0.3, diffusivity: 1, specularity: 0.2 , color:color( 0.0, 0.0, 0.0, 0.3 )}),

            cloud: new Material(new defs.Phong_Shader(),
                { ambient: 0.5, diffusivity: 0.8, specularity: 0.2, color: hex_color("#96e3ff") }),

            sky_color: new Material(new defs.Phong_Shader(),
                { ambient: 1, diffusivity: 0.8, specularity: 0, color: hex_color("#acf5fb") }),

            night_color: new Material(new defs.Textured_Phong(),
                { ambient: 0.8, diffusivity: 0, specularity: 0, color: hex_color("#000000"), texture: new Texture('./assets/night_sky_panorama.jpg') }),

            grass_texture: new Material(new Textured_Phong_Shader_Shadow(this.shadow_map),
                { ambient: 1, diffusivity: 0.8, specularity: 0, color: hex_color("000000"), texture: new Texture('./assets/grass.jpg') }
            ),
            shadow_box: new Material(new defs.Phong_Shader(),
                //{ ambient: 0.5, diffusivity: 0.8, specularity: 1, color: color( 0.0, 0.0, 0.0, 0.5 ) }),
                { ambient: 0.5, diffusivity: 0.8, specularity: 1, color: hex_color("#434345") }),
            depth_texture_debug: new Material(new defs.Textured_Phong(),
                { ambient: 1, diffusivity: 0, color: hex_color("#000000"), specularity: 0,
                texture: this.shadow_map }),
        };

        this.materials.depth_texture_debug.shader.fixed = true;

        //this.initial_camera_location = Mat4.look_at(vec3(5, 5, 20), vec3(0, 0, 0), vec3(0, 1, 0));
        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 25), vec3(0, 0, 0), vec3(0, 1, 0));
        /**
         * @type {{ptr: ModelProps[]}} modelPtr
         */
        this.modelPtr = {ptr: []}
        this.movementControls = new Movement_Controls(this.modelPtr)
    }

    make_control_panel() {
        this.key_triggered_button("Show depth buffer", ["q"], () => {this.show_depth_buffer = !this.show_depth_buffer;});
    }

    display(context, program_state) {
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = this.movementControls);
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        // Preload night sky texture
        if(!this.night_sky_copied_onto_gpu &&
            this.materials.night_color.texture.ready) {
            this.materials.night_sky_copied_onto_gpu = true;
            this.materials.night_color.texture.activate(context.context, 1);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 0.1, 1000);

        //point light
        program_state.lights = [
            new Light(vec4(10, 10, 30, 1), color(1, 1, 1, 1), 200 ** 3)
        ];

        /**
         * @type {ModelProps[]}
         */
        const all_models = [];

        let mountain_transform = Mat4.identity().times(Mat4.scale(10, 10, 10));
        all_models.push({
            shape: this.shapes.mountain, model_transform: mountain_transform,
            material: this.materials.ground, collision: true, shadow: true
        });

        const tree_scale = 0.5;
        let tree_1 = Mat4.identity().times(Mat4.translation(5, -0.15, 10))
            .times(Mat4.scale(tree_scale, tree_scale, tree_scale))
            .times(Mat4.rotation(14, 0, 1, 0));

        let shadow_box1 = Mat4.identity().times(Mat4.translation(5, -1.00, 9.8))
            .times(Mat4.rotation(190, 30, -10, -4))
            .times(Mat4.scale(tree_scale, tree_scale, tree_scale));

        //this.shapes.torus.draw(context, program_state, shadow_box1, this.materials.shadow_box);

        let shadow_tree1 = Mat4.identity().times(Mat4.translation(5, -.83, 9.0))
            .times(Mat4.rotation(350.31, 1, 0, 0))
            .times(Mat4.scale(tree_scale, tree_scale + .6, 0));
        // all_models.push({
        //     shape: this.shapes.tree, model_transform: shadow_tree1,
        //     material: this.materials.shadow_box, collision: false, shadow: false
        // });

        let tree_2 = Mat4.identity().times(Mat4.translation(-2, .125, 5))
            .times(Mat4.scale(.7, .7, tree_scale))
            .times(Mat4.rotation(14, 0, 1, 0));

        let shadow_tree2 = Mat4.identity().times(Mat4.translation(-1, -.83, 4.0))
            .times(Mat4.rotation(350.31, 1, 0, 0))
            .times(Mat4.scale(tree_scale, tree_scale + .6, 0));

        // all_models.push({
        //     shape: this.shapes.tree, model_transform: shadow_tree2,
        //     material: this.materials.shadow_box, collision: false, shadow: false
        // });
        let tree_3 = Mat4.identity().times(Mat4.translation(-10, .125, 7))
            .times(Mat4.scale(tree_scale + .4, .7, tree_scale + .4))
            .times(Mat4.rotation(14, 0, 1, 0));

        let shadow_tree3 = Mat4.identity().times(Mat4.translation(-10, -.83, 6.0))
            .times(Mat4.rotation(350.31, 1, 0, 0))
            .times(Mat4.scale(tree_scale, tree_scale + .3, 0));

        // all_models.push({
        //     shape: this.shapes.tree, model_transform: shadow_tree3,
        //     material: this.materials.shadow_box, collision: false, shadow: false
        // });
        let tree_4 = Mat4.identity().times(Mat4.translation(-16, .5, 11))
            .times(Mat4.scale(tree_scale + .6, 1, tree_scale + .6))
            .times(Mat4.rotation(14, 0, 1, 0));

        let shadow_tree4 = Mat4.identity().times(Mat4.translation(-16, -.83, 10.0))
            .times(Mat4.rotation(350.31, 1, 0, 0))
            .times(Mat4.scale(tree_scale, tree_scale + .6, 0));

        // all_models.push({
        //     shape: this.shapes.tree, model_transform: shadow_tree4,
        //     material: this.materials.shadow_box, collision: false, shadow: true
        // });
        let tree_5 = Mat4.identity().times(Mat4.translation(12, -0.15, 9))
            .times(Mat4.scale(tree_scale, tree_scale, tree_scale))
            .times(Mat4.rotation(14, 0, 1, 0));

        let shadow_tree5 = Mat4.identity().times(Mat4.translation(12, -.83, 8.0))
            .times(Mat4.rotation(350.31, 1, 0, 0))
            .times(Mat4.scale(tree_scale, tree_scale + .6, 0));

        // all_models.push({
        //     shape: this.shapes.tree, model_transform: shadow_tree5,
        //     material: this.materials.shadow_box, collision: false, shadow: false
        // });
        let tree_6 = Mat4.identity().times(Mat4.translation(-6, .125, 9.5))
            .times(Mat4.scale(tree_scale + .4, .7, tree_scale + .4))
            .times(Mat4.rotation(40, 0, 1, 0));
        let shadow_tree6 = Mat4.identity().times(Mat4.translation(-6, -.83, 8.6))
            .times(Mat4.rotation(350.31, 1, 0, 0))
            .times(Mat4.scale(tree_scale, tree_scale + .6, 0));

        // all_models.push({
        //     shape: this.shapes.tree, model_transform: shadow_tree6,
        //     material: this.materials.shadow_box, collision: false, shadow: false
        // });
        all_models.push({
            shape: this.shapes.tree, model_transform: tree_1,
            material: this.materials.tree, collision: true, shadow: true
        });
        all_models.push({
            shape: this.shapes.tree, model_transform: tree_2,
            material: this.materials.tree, collision: true, shadow: true
        });
        all_models.push({
            shape: this.shapes.tree, model_transform: tree_3,
            material: this.materials.tree, collision: true, shadow: true
        });
        all_models.push({
            shape: this.shapes.tree, model_transform: tree_4,
            material: this.materials.tree, collision: true, shadow: true
        });
        all_models.push({
            shape: this.shapes.tree, model_transform: tree_5,
            material: this.materials.tree, collision: true, shadow: true
        });
        all_models.push({
            shape: this.shapes.tree, model_transform: tree_6,
            material: this.materials.tree, collision: true, shadow: true
        });

        // this.shapes.shadow_box.draw(context, program_state, shadow_box1, this.materials.shadow_box);

        let model_transform = Mat4.identity();
        const t = program_state.animation_time / 2000, dt = program_state.animation_delta_time / 2000;
        const angle = t;
        const light_x = Math.max(-20, (40 / 14 * ((t + 8) % 20)) - (520 / 14));
        const light_y = 10 * Math.max(-0.6, Math.sin(2 * Math.PI * t / 20)) + 10;
        const light_z = light_x;

        const light_intesity = (Math.max(-0.6, Math.sin(2 * Math.PI * t / 20)) + 0.6) / 1.6;
        program_state.lights = [
            // new Light(vec4(20, 20, 20, 1), color(1, 1, 1, 1), 200 ** 3),
            new Light(vec4(light_x, light_y, light_z, 1), color(1, 1, 1, 1), 10 ** (10 * light_intesity)),
            new Light(vec4(10, 10, 30, 1), color(1, 1, 1, 1), 10 ** (10 * light_intesity)),

        ];
        const ambient_modifier = light_intesity * 0.8 + 0.2;
        this.materials.grass_texture.ambient = ambient_modifier;
        this.materials.tree.ambient = 0.3 * ambient_modifier;
        this.materials.ground.ambient = 0.5 * ambient_modifier;
        this.materials.cloud.ambient = 0.5 * ambient_modifier;

        let sky_material;
        const sky_noon = hex_color("#acf5fb");
        const sky_night = hex_color("#324054");
        const black = hex_color("#222222");
        if(light_intesity > 0.1) {
            sky_material = this.materials.sky_color;
            this.materials.sky_color.ambient = Math.min(1, (light_intesity - 0.1) * 8);
            this.materials.sky_color.color = sky_noon.mix(sky_night, 1 - Math.min(1, (light_intesity - 0.1) * 1.5));
        } else {
            sky_material = this.materials.night_color;
            this.materials.night_color.ambient = Math.min(0.4, (0.1 - light_intesity) * 8);
            this.materials.night_color.color = sky_noon.mix(sky_night, 1 - Math.min(1, (light_intesity - 0.1) * 1.5));
        }

        let cloud_1 = model_transform
            .times(Mat4.identity())
            .times(Mat4.rotation(angle / 2, 0, 1, 0))
            .times(Mat4.translation(0, 5, 3));
        let cloud_2 = model_transform
            .times(Mat4.identity())
            .times(Mat4.rotation(angle / 2, 0, 1, 0))
            .times(Mat4.translation(8, 7.5, 0));
        let cloud_3 = model_transform
            .times(Mat4.identity())
            .times(Mat4.rotation(angle / 5, 0, 1, 0)
                .times(Mat4.translation(12, 4, 5)));
        let cloud_4 = model_transform
            .times(Mat4.identity())
            .times(Mat4.rotation(angle / 3, 0, 1, 0)
                .times(Mat4.translation(14, 6, 7)));
        let cloud_5 = model_transform
            .times(Mat4.identity())
            .times(Mat4.rotation(angle / 3, 0, 1, 0)
                .times(Mat4.translation(5, 7, -9)));
        let cloud_6 = model_transform
            .times(Mat4.identity())
            .times(Mat4.rotation(angle / 8, 0, 1, 0)
                .times(Mat4.translation(12, 8, -5)));
        let cloud_7 = model_transform
            .times(Mat4.identity())
            .times(Mat4.rotation(angle / 4, 0, 1, 0)
                .times(Mat4.translation(-10, 6, -7)));
        all_models.push({
            shape: this.shapes.cloud, model_transform: cloud_1,
            material: this.materials.cloud, collision: false, shadow: true
        });
        all_models.push({
            shape: this.shapes.cloud, model_transform: cloud_2,
            material: this.materials.cloud, collision: false, shadow: true
        });
        all_models.push({
            shape: this.shapes.cloud, model_transform: cloud_3,
            material: this.materials.cloud, collision: false, shadow: true
        });
        all_models.push({
            shape: this.shapes.cloud, model_transform: cloud_4,
            material: this.materials.cloud, collision: false, shadow: true
        });
        all_models.push({
            shape: this.shapes.cloud, model_transform: cloud_5,
            material: this.materials.cloud, collision: false, shadow: true
        });
        all_models.push({
            shape: this.shapes.cloud, model_transform: cloud_6,
            material: this.materials.cloud, collision: false, shadow: true
        });
        all_models.push({
            shape: this.shapes.cloud, model_transform: cloud_7,
            material: this.materials.cloud, collision: false, shadow: true
        });
        const skybox_size = 100;
        const sky_transform = Mat4.scale(skybox_size, skybox_size, skybox_size);
        all_models.push({
            shape: this.shapes.skybox, model_transform: sky_transform,
            material: sky_material, collision: false, shadow: false
        });
        const ground_size = 100;
        const ground_transform = Mat4.translation(0, -0.85, 0)
            .times(Mat4.rotation(0.5 * Math.PI, 1, 0, 0))
            .times(Mat4.scale(ground_size, ground_size, ground_size));
        all_models.push({
            shape: this.shapes.ground, model_transform: ground_transform,
            material: this.materials.grass_texture, collision: true, shadow: false
        });


        const fixed_square_scale = 0.5;
        const aspect_ratio = context.width / context.height;
        const x_scale = fixed_square_scale / aspect_ratio;
        const y_scale = fixed_square_scale;
        const square_transform = Mat4.translation(1 - x_scale , -(1 - y_scale), -1)
                                     .times(Mat4.scale(x_scale, y_scale, 1.0));
        if(this.show_depth_buffer) {
            all_models.push({
                shape: this.shapes.depth_texture_debug, model_transform: square_transform,
                material: this.materials.depth_texture_debug, shadow: false
            });
        }

        this.shadow_map.render(context, all_models, program_state.lights[0]);

        // draw each shape
        all_models.forEach(({ shape, model_transform, material }) => {
            shape.draw(context, program_state, model_transform, material);
        });
        this.modelPtr.ptr = all_models;
    }
}
