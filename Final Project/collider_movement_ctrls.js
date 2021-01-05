import {defs, tiny} from './examples/common.js';
const {
    Vector4, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

/**
 * @typedef {Object} ModelProps
 * @property {Shape} shape
 * @property {Matrix} model_transform
 * @property {boolean} collision
 * @property {boolean} shadow
 */

export class Movement_Controls extends Scene {
    /**
     * Takes in a list of objects to check collisions against
     * @param  {{ptr: ModelProps[]}} models 
     */
    constructor(models) {
        super();
        const data_members = {
            roll: 0, look_around_locked: true,
            thrust: vec3(0, 0, 0), pos: vec3(0, 0, 0), z_axis: vec3(0, 0, 0),
            radians_per_frame: 1 / 200, meters_per_frame: 10, speed_multiplier: 1
        };
        Object.assign(this, data_members);

        this.mouse_enabled_canvases = new Set();
        this.will_take_over_graphics_state = true;
        this.models = models
        this.intersectionPoint = undefined
        /**
         * @property {Vector4} playerPosition the intersection point
         */
        this.playerPosition = undefined
    }

    set_recipient(matrix_closure, inverse_closure) {
        // set_recipient(): The camera matrix is not actually stored here inside Movement_Controls;
        // instead, track an external target matrix to modify.  Targets must be pointer references
        // made using closures.
        this.matrix = matrix_closure;
        this.inverse = inverse_closure;
    }

    reset(graphics_state) {
        // reset(): Initially, the default target is the camera matrix that Shaders use, stored in the
        // encountered program_state object.  Targets must be pointer references made using closures.
        this.set_recipient(() => graphics_state.camera_transform,
            () => graphics_state.camera_inverse);
    }

    add_mouse_controls(canvas) {
        // add_mouse_controls():  Attach HTML mouse events to the drawing canvas.
        // First, measure mouse steering, for rotating the flyaround camera:
        this.mouse = {"from_center": vec(0, 0)};
        const mouse_position = (e, rect = canvas.getBoundingClientRect()) =>
            vec(e.clientX - (rect.left + rect.right) / 2, e.clientY - (rect.bottom + rect.top) / 2);
        // Set up mouse response.  The last one stops us from reacting if the mouse leaves the canvas:
        document.addEventListener("mouseup", e => {
            this.mouse.anchor = undefined;
        });
        canvas.addEventListener("mousedown", e => {
            e.preventDefault();
            this.mouse.anchor = mouse_position(e);
        });
        canvas.addEventListener("mousemove", e => {
            e.preventDefault();
            this.mouse.from_center = mouse_position(e);
        });
        canvas.addEventListener("mouseout", e => {
            if (!this.mouse.anchor) this.mouse.from_center.scale_by(0)
        });
    }

    show_explanation(document_element) {
    }

    make_control_panel() {
        // make_control_panel(): Sets up a panel of interactive HTML elements, including
        // buttons with key bindings for affecting this scene, and live info readouts.
        this.control_panel.innerHTML += "Click and drag the scene to spin your viewpoint around it.<br>";
        this.live_string(box => box.textContent = "- Position: " + this.pos[0].toFixed(2) + ", " + this.pos[1].toFixed(2)
            + ", " + this.pos[2].toFixed(2));
        this.new_line();
        // The facing directions are surprisingly affected by the left hand rule:
        this.live_string(box => box.textContent = "- Facing: " + ((this.z_axis[0] > 0 ? "West " : "East ")
            + (this.z_axis[1] > 0 ? "Down " : "Up ") + (this.z_axis[2] > 0 ? "North" : "South")));
        this.new_line();
        this.new_line();

        this.key_triggered_button("Up", [" "], () => this.thrust[1] = -1, undefined, () => this.thrust[1] = 0);
        this.key_triggered_button("Forward", ["w"], () => this.thrust[2] = 1, undefined, () => this.thrust[2] = 0);
        this.new_line();
        this.key_triggered_button("Left", ["a"], () => this.thrust[0] = 1, undefined, () => this.thrust[0] = 0);
        this.key_triggered_button("Back", ["s"], () => this.thrust[2] = -1, undefined, () => this.thrust[2] = 0);
        this.key_triggered_button("Right", ["d"], () => this.thrust[0] = -1, undefined, () => this.thrust[0] = 0);
        this.new_line();
        this.key_triggered_button("Down", ["z"], () => this.thrust[1] = 1, undefined, () => this.thrust[1] = 0);

        const speed_controls = this.control_panel.appendChild(document.createElement("span"));
        speed_controls.style.margin = "30px";
        this.key_triggered_button("-", ["o"], () =>
            this.speed_multiplier /= 1.2, undefined, undefined, undefined, speed_controls);
        this.live_string(box => {
            box.textContent = "Speed: " + this.speed_multiplier.toFixed(2)
        }, speed_controls);
        this.key_triggered_button("+", ["p"], () =>
            this.speed_multiplier *= 1.2, undefined, undefined, undefined, speed_controls);
        this.new_line();
        this.key_triggered_button("Roll left", [","], () => this.roll = 1, undefined, () => this.roll = 0);
        this.key_triggered_button("Roll right", ["."], () => this.roll = -1, undefined, () => this.roll = 0);
        this.new_line();
        this.key_triggered_button("(Un)freeze mouse look around", ["f"], () => this.look_around_locked ^= 1, "#8B8885");
        this.new_line();
        this.key_triggered_button("Go to world origin", ["r"], () => {
            this.matrix().set_identity(4, 4);
            this.inverse().set_identity(4, 4)
        }, "#8B8885");
        this.new_line();

        this.key_triggered_button("Look at origin from front", ["1"], () => {
            this.inverse().set(Mat4.look_at(vec3(0, 0, 10), vec3(0, 0, 0), vec3(0, 1, 0)));
            this.matrix().set(Mat4.inverse(this.inverse()));
        }, "#8B8885");
        this.new_line();
        this.key_triggered_button("from right", ["2"], () => {
            this.inverse().set(Mat4.look_at(vec3(10, 0, 0), vec3(0, 0, 0), vec3(0, 1, 0)));
            this.matrix().set(Mat4.inverse(this.inverse()));
        }, "#8B8885");
        this.key_triggered_button("from rear", ["3"], () => {
            this.inverse().set(Mat4.look_at(vec3(0, 0, -10), vec3(0, 0, 0), vec3(0, 1, 0)));
            this.matrix().set(Mat4.inverse(this.inverse()));
        }, "#8B8885");
        this.key_triggered_button("from left", ["4"], () => {
            this.inverse().set(Mat4.look_at(vec3(-10, 0, 0), vec3(0, 0, 0), vec3(0, 1, 0)));
            this.matrix().set(Mat4.inverse(this.inverse()));
        }, "#8B8885");
        this.new_line();
        this.key_triggered_button("Attach to global camera", ["Shift", "R"],
            () => {
                this.will_take_over_graphics_state = true
            }, "#8B8885");
        this.new_line();
    }
    /**
     * Checks if a line segment is collision free
     * @param {Vector3} pos1 one end of the line segment
     * @param {Vector3} pos2 the other end of the line segment
     * @returns {bool} Returns if the desired position is collision free
     */
    collisionFree(pos1, pos2) {
        if(pos2[1] < -0.8) {
            return false;
        }
        if(pos1.equals(pos2)) {
            return true;
        }
        const rayOrigin = pos1;
        const rayDiff = pos2.minus(pos1)
        const rayDir = rayDiff.normalized()
        const segLen = rayDiff.norm()
        
        let closestHit = null;
        for(let {shape, model_transform, collision} of this.models.ptr) {
            if(!collision) {
                continue
            }
            const positions = shape.arrays.position
            for(let i = 0; i < positions.length - 2; i+=3) {
                const rawV0 = positions[i]
                const rawV1 = positions[i+1]
                const rawV2 = positions[i+2]

                const v0 = model_transform.times(vec4(...rawV0, 1)).to3()
                const v1 = model_transform.times(vec4(...rawV1, 1)).to3()
                const v2 = model_transform.times(vec4(...rawV2, 1)).to3()
                const tri = [v0, v1, v2];
                
                const rayHit = rayTriIntersect(rayOrigin, rayDir, tri);
                const sphHit = sphTriIntersect(pos2, 1.5, tri);
                const segHit = rayHit && rayHit.minus(pos1).norm() <= 2.5;
                if(segHit || sphHit) {
                    return false;
                }
            }
        }
        return true;
    }
    first_person_flyaround(radians_per_frame, meters_per_frame, leeway = 70) {
        // (Internal helper function)
        // Compare mouse's location to all four corners of a dead box:
        const offsets_from_dead_box = {
            plus: [this.mouse.from_center[0] + leeway, this.mouse.from_center[1] + leeway],
            minus: [this.mouse.from_center[0] - leeway, this.mouse.from_center[1] - leeway]
        };
        // Apply a camera rotation movement, but only when the mouse is
        // past a minimum distance (leeway) from the canvas's center:
        if (!this.look_around_locked)
            // If steering, steer according to "mouse_from_center" vector, but don't
            // start increasing until outside a leeway window from the center.
            for (let i = 0; i < 2; i++) {                                     // The &&'s in the next line might zero the vectors out:
                let o = offsets_from_dead_box,
                    velocity = ((o.minus[i] > 0 && o.minus[i]) || (o.plus[i] < 0 && o.plus[i])) * radians_per_frame;
                // On X step, rotate around Y axis, and vice versa.
                this.matrix().post_multiply(Mat4.rotation(-velocity, i, 1 - i, 0));
                this.inverse().pre_multiply(Mat4.rotation(+velocity, i, 1 - i, 0));
            }
        this.matrix().post_multiply(Mat4.rotation(-.1 * this.roll, 0, 0, 1));
        this.inverse().pre_multiply(Mat4.rotation(+.1 * this.roll, 0, 0, 1));
        
        const thisPosition = this.matrix()
            .times(vec4(0, 0, 0, 1))
            .to3();
        const futureMatrix = this.matrix()
            .times(Mat4.translation(...this.thrust.times(-meters_per_frame)));
        const futurePosition = futureMatrix
            .times(vec4(0, 0, 0, 1))
            .to3();
        if(this.collisionFree(thisPosition, futurePosition)) {
            this.matrix().post_multiply(Mat4.translation(...this.thrust.times(-meters_per_frame)));
            this.inverse().pre_multiply(Mat4.translation(...this.thrust.times(+meters_per_frame)));
        }
    }

    third_person_arcball(radians_per_frame) {
        // (Internal helper function)
        // Spin the scene around a point on an axis determined by user mouse drag:
        const dragging_vector = this.mouse.from_center.minus(this.mouse.anchor);
        if (dragging_vector.norm() <= 0)
            return;
        this.matrix().post_multiply(Mat4.translation(0, 0, -25));
        this.inverse().pre_multiply(Mat4.translation(0, 0, +25));

        const rotation = Mat4.rotation(radians_per_frame * dragging_vector.norm(),
            dragging_vector[1], dragging_vector[0], 0);
        this.matrix().post_multiply(rotation);
        this.inverse().pre_multiply(rotation);

        this.matrix().post_multiply(Mat4.translation(0, 0, +25));
        this.inverse().pre_multiply(Mat4.translation(0, 0, -25));
    }

    display(context, graphics_state, dt = graphics_state.animation_delta_time / 1000) {
        // The whole process of acting upon controls begins here.
        const m = this.speed_multiplier * this.meters_per_frame,
            r = this.speed_multiplier * this.radians_per_frame;

        if (this.will_take_over_graphics_state) {
            this.reset(graphics_state);
            this.will_take_over_graphics_state = false;
        }

        if (!this.mouse_enabled_canvases.has(context.canvas)) {
            this.add_mouse_controls(context.canvas);
            this.mouse_enabled_canvases.add(context.canvas)
        }
        // Move in first-person.  Scale the normal camera aiming speed by dt for smoothness:
        this.first_person_flyaround(dt * r, dt * m);
        // Also apply third-person "arcball" camera mode if a mouse drag is occurring:
        if (this.mouse.anchor)
            this.third_person_arcball(dt * r);
        // Log some values:
        this.pos = this.matrix().times(vec4(0, 0, 0, 1));
        this.z_axis = this.inverse().times(vec4(0, 0, 1, 0));
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const EPSILON = 0.000001;
/**
 * Returns null if no ray hit, and a point if it does hit 
 * @param {Vector3} origin 
 * @param {Vector3} dir 
 * @param {Vector3[]} triangle 
 */
function rayTriIntersect (origin, dir, triangle) {
    const edge1 = triangle[1].minus(triangle[0]);
    const edge2 = triangle[2].minus(triangle[0]);
    
    const pvec =  dir.cross(edge2);
    const det = edge1.dot(pvec);
    
    if (Math.abs(det) < EPSILON) return null;
    const tvec = origin.minus(triangle[0]);
    const u = tvec.dot(pvec);
    if (u < 0 || u > det) return null;
    const qvec = tvec.cross(edge1);
    const v = dir.dot(qvec);
    if (v < 0 || u + v > det) return null;
    
    const t = edge2.dot(qvec) / det;
    const out = origin.plus(dir.times(t));
    return out;
}
/**
 * Returns null if no sphere hit, and a point if it does
 * @param {Vector3} origin 
 * @param {Vector3} radius 
 * @param {Vector3[]} triangle 
 */
function sphTriIntersect(origin, radius, triangle) {
    // https://math.stackexchange.com/questions/544946/determine-if-projection-of-3d-point-onto-plane-is-within-a-triangle
    const u = triangle[1].minus(triangle[0]);
    const v = triangle[2].minus(triangle[0]);
    const n = u.cross(v);
    const w = origin.minus(triangle[0]);

    const n2 = n.dot(n);
    const gamma = u.cross(w).dot(n) / n2;
    const beta = w.cross(v).dot(n) / n2;
    const alpha = 1 - gamma - beta;
    
    if(0 <= alpha && alpha <= 1 && 
        0 <= beta && beta <= 1 && 
        0 <= gamma && gamma <= 1) {
        
        const hitLocation = (triangle[0].times(alpha))
            .plus(triangle[1].times(beta))
            .plus(triangle[2].times(gamma));
        if(hitLocation.minus(origin).norm() <= radius) {
            return hitLocation;
        }
    }
    return null;
}