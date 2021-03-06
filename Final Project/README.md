# Team LLST Final Project

![Final version](assets/final_proj2.png)
Unfortunately the moving shadows (due to the day/night cycle) don't really screenshot well...

**The idea:**
* Rather than creating a game, we decided to create an interactive forest scene. Our project allows the user to move through the scene and view the simple world we have created. Our plan is to create trees, a simple mountain range, and clouds to bring depth and visually appealing scenery. As far as our theme goes we want to keep it simple; the user can freely roam around our small forest and appreciate nature during the spring season, albeit it being a simple, artificial one. We chose spring over other seasons as spring is the season where nature is most vibrant. We cannot fully capture blooming flora or fauna, but we wanted to have a more colorful, playful scene. This is something we believe everyone can appreciate given the amount of time most people have spent inside over the past few months.

**The topics:**
* One of our main components in our project is the rendering of the initial scene we plan on working with. This will be achieved using Blender which was introduced in discussion 1B. Additionally, we will be using matrices extensively for our advanced features and the positioning of various objects in the world, which we have discussed in class. Both affine and rigid transformations will be used on clouds, trees, and the mountain range. Matrices will be a key component in both collision detection and shadowing (our advanced features).

**The features:**
* As previously mentioned, we will be implementing shadowing to give our animated environment more depth. It will be done using matrices and shaders. Collision detection will be our second advanced feature. It will primarily be for interaction between the user and the environment. We need to ensure the user cannot walk through a tree, the mountain range, or go through the bottom of the scene, so we will be using basic collision detection between triangles to achieve this. On top of our advanced features we will implement simple movement between the clouds to simulate simple realism and make the scene more visually pleasing.

**The interactivity:**
* Aside from the advanced features we plan on implementing, we also need to ensure that there is an element of interactivity to our project. The main interactive feature will be the ability for the user to “fly” around the scene as a means to explore by using keyboard shortcuts (moving forward, backward, left, right, up, and down). However, we will also allow the user to toggle between having static and dynamic cloud presence; it may be simple, but it will allow us to let the user have some control over the scene itself.
