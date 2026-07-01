import math
import os

import bpy
import mathutils


def set_render_engine(scene):
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = engine
            return
        except TypeError:
            continue


def look_at(obj, target):
    direction = mathutils.Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def create_placeholder_mesh():
    vertices = [
        (0.0, 1.2, 0.0),
        (-0.45, -0.75, 0.28),
        (0.45, -0.75, 0.28),
        (-0.45, -0.75, -0.28),
        (0.45, -0.75, -0.28),
        (-1.05, -0.1, -0.08),
        (1.05, -0.1, -0.08),
    ]
    faces = [
        (0, 1, 2),
        (0, 2, 4),
        (0, 4, 3),
        (0, 3, 1),
        (1, 3, 4, 2),
        (3, 5, 1),
        (4, 2, 6),
    ]

    mesh = bpy.data.meshes.new("SmokeShuttleMesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    obj = bpy.data.objects.new("SmokeShuttlePlaceholder", mesh)
    bpy.context.collection.objects.link(obj)
    obj.rotation_euler[2] = math.radians(-8)

    material = bpy.data.materials.new("SmokeShuttleMaterial")
    material.diffuse_color = (0.35, 0.7, 1.0, 1.0)
    obj.data.materials.append(material)
    return obj


def configure_camera(scene):
    camera_data = bpy.data.cameras.new("SmokeCamera")
    camera = bpy.data.objects.new("SmokeCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (3.0, -4.5, 2.8)
    look_at(camera, (0.0, 0.0, 0.0))
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 3.0
    scene.camera = camera


def configure_light():
    light_data = bpy.data.lights.new("SmokeKeyLight", type="AREA")
    light = bpy.data.objects.new("SmokeKeyLight", light_data)
    bpy.context.collection.objects.link(light)
    light.location = (2.0, -3.0, 4.0)
    light_data.energy = 350
    light_data.size = 4.0


def output_path():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    output_dir = os.path.join(
        project_root,
        "public",
        "asset-packs",
        "space-placeholder-v1",
        "smoke-test",
    )
    os.makedirs(output_dir, exist_ok=True)
    return os.path.join(output_dir, "blender_smoke.png")


def main():
    clear_scene()
    scene = bpy.context.scene
    set_render_engine(scene)

    scene.render.film_transparent = True
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1

    create_placeholder_mesh()
    configure_camera(scene)
    configure_light()

    scene.render.filepath = output_path()
    bpy.ops.render.render(write_still=True)
    print(f"Rendered smoke asset: {scene.render.filepath}")


if __name__ == "__main__":
    main()
