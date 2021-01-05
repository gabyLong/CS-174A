import {defs, tiny} from './examples/common.js';
import {Axes_Viewer, Axes_Viewer_Test_Scene} from "./examples/axes-viewer.js"
import {Collision_Demo, Inertia_Demo} from "./examples/collisions-demo.js"
import {Many_Lights_Demo} from "./examples/many-lights-demo.js"
import {Obj_File_Demo} from "./examples/obj-file-demo.js"
import {Scene_To_Texture_Demo} from "./examples/scene-to-texture-demo.js"
import {Surfaces_Demo} from "./examples/surfaces-demo.js"
import {Text_Demo} from "./examples/text-demo.js"
import {Transforms_Sandbox} from "./examples/transforms-sandbox.js"
import {MountainScene} from "./mountain_scene.js";

// Pull these names into this module's scope for convenience:
const {
    Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4, Light, Shape, Material, Shader, Texture, Scene,
    Canvas_Widget, Code_Widget, Text_Widget
} = tiny;

// Now we have loaded everything in the files tiny-graphics.js, tiny-graphics-widgets.js, and common.js.
// This yielded "tiny", an object wrapping the stuff in the first two files, and "defs" for wrapping all the rest.

// ******************** Extra step only for when executing on a local machine:
//                      Load any more files in your directory and copy them into "defs."
//                      (On the web, a server should instead just pack all these as well
//                      as common.js into one file for you, such as "dependencies.js")

const Minimal_Webgl_Demo = defs.Minimal_Webgl_Demo;

Object.assign(defs,
    {Axes_Viewer, Axes_Viewer_Test_Scene},
            {Inertia_Demo, Collision_Demo},
            {Many_Lights_Demo},
            {Obj_File_Demo},
            {Scene_To_Texture_Demo},
            {Surfaces_Demo},
            {Text_Demo},
            {Transforms_Sandbox});

// ******************** End extra step

// (Can define Main_Scene's class here)

const Main_Scene = MountainScene;
const Additional_Scenes = [];

export {Main_Scene, Additional_Scenes, Canvas_Widget, Code_Widget, Text_Widget, defs}



//Shadow mapping
// this.webgl_manager = context;      // Save off the Webgl_Manager object that created the scene.
// this.scratchpad = document.createElement('canvas');
// this.scratchpad_context = this.scratchpad.getContext('2d');     // A hidden canvas for re-sizing the real canvas to be square.
// this.scratchpad.width   = 256;
// this.scratchpad.height  = 256;
// this.texture = new Texture ( context.gl, "", false, false );        // Initial image source: Blank gif file
// this.texture.image.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
//
// this.materials =
//     {
//         shadow:         context.get_instance(Shadow_Shader).material( Color.of( 71/255, 59/255, 51/255, 1 ), { ambient: 1, texture: this.texture } ),
//     }
//
//
// if(!this.beginning_animation && !this.ending_animation) {
//     // ***************************** Shadow Map *********************************
//     // Helper function to draw the fish - Scene 1
//     graphics_state.camera_transform =  Mat4.look_at( Vec.of( 0,5,40,1), Vec.of( 0,0,0 ), Vec.of( 0,1,0 ) );
//
//     this.draw_the_fish(graphics_state, t)
//     //transforming camera to light source
//
//     this.scratchpad_context.drawImage( this.webgl_manager.canvas, 0, 0, 256, 256 );
//     this.texture.image.src = this.scratchpad.toDataURL("image/png");        // Clear the canvas and start over, beginning scene 2:
// //               this.texture.image.src = this.result_img.src = this.scratchpad.toDataURL("image/png");
//     this.webgl_manager.gl.clear( this.webgl_manager.gl.COLOR_BUFFER_BIT | this.webgl_manager.gl.DEPTH_BUFFER_BIT);
// //  ******************************* End Shadow Map ****************************
