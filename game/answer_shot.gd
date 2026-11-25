extends Node3D

# Experimental performance using the interim licensed rig. Needs rendered review
# and authored animation before it can be considered the final Marcus performance.
var actor: Node3D
var skeletons: Array[Skeleton3D] = []
var phone: Node3D
var camera: Camera3D
var elapsed := 0.0
var attached := false
const GRAB_TIME := 0.55

func _ready() -> void:
	var environment := WorldEnvironment.new()
	var settings := Environment.new()
	settings.background_mode = Environment.BG_COLOR
	settings.background_color = Color("101720")
	settings.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	settings.ambient_light_color = Color("a9bac0")
	settings.ambient_light_energy = 0.8
	environment.environment = settings
	add_child(environment)
	var light := OmniLight3D.new()
	light.position = Vector3(-1.2, 2.7, 1.4)
	light.light_color = Color("ffe0bc")
	light.light_energy = 2.3
	light.omni_range = 6
	add_child(light)
	actor = preload("res://character.gd").new()
	add_child(actor)
	for node in actor.find_children("*", "Skeleton3D", true, false):
		skeletons.append(node as Skeleton3D)
	for player in actor.players:
		player.play("PickUp_Table")
		player.pause()
	# Locate the tabletop at the hand's sampled pickup position, not a guessed
	# screen position. Both body and clothing use the same source skeleton.
	_pose_animations(GRAB_TIME)
	var hand := _hand_position()
	_box(self, Vector3(1.8, 0.08, 0.85), Vector3(hand.x, hand.y - 0.05, hand.z), Color("514940"))
	_box(self, Vector3(1.8, 0.8, 0.06), Vector3(hand.x, hand.y + 0.35, hand.z - 0.45), Color("293138"))
	phone = Node3D.new()
	add_child(phone)
	phone.position = hand
	_box(phone, Vector3(0.075, 0.012, 0.15), Vector3.ZERO, Color("20252c"))
	var screen := _box(phone, Vector3(0.068, 0.003, 0.13), Vector3(0, 0.008, 0), Color("eaf7ff"))
	var mat := screen.material_override as StandardMaterial3D
	mat.emission_enabled = true
	mat.emission = Color("bceeff")
	mat.emission_energy_multiplier = 1.0
	camera = Camera3D.new()
	camera.position = Vector3(-1.6, 1.65, 2.6)
	camera.fov = 35
	add_child(camera)
	camera.look_at(global_position + Vector3(0, 1.15, -0.1), Vector3.UP)
	camera.make_current()
	_pose_animations(0.0)

func _pose_animations(time: float) -> void:
	for player in actor.players:
		player.seek(minf(time, player.get_animation("PickUp_Table").length), true)
	for skeleton in skeletons:
		skeleton.force_update_all_bone_transforms()

func _hand_position() -> Vector3:
	var skel := skeletons[0]
	return to_local(skel.to_global(skel.get_bone_global_pose(skel.find_bone("hand_r")).origin))

func _process(delta: float) -> void:
	elapsed += delta
	_pose_animations(minf(elapsed, 1.0))
	if elapsed >= GRAB_TIME:
		attached = true
		# Experimental CCD reach: rotate upper/lower arm toward the side of
		# the head, applied to both matching rigs to keep the clothing aligned.
		var weight := smoothstep(0.75, 2.0, elapsed)
		for skel in skeletons:
			_reach_ear(skel, weight)
		phone.position = _hand_position()
		phone.rotation_degrees = Vector3(lerpf(0, 80, weight), 0, lerpf(0, -15, weight))

func _reach_ear(skel: Skeleton3D, weight: float) -> void:
	var hand := skel.find_bone("hand_r")
	var head := skel.find_bone("head")
	if head < 0:
		head = skel.find_bone("neck_01")
	if hand < 0 or head < 0:
		return
	var target := skel.get_bone_global_pose(head).origin + Vector3(-0.12, 0.12, 0.02)
	for iteration in 4:
		for bone_name in ["lowerarm_r", "upperarm_r"]:
			var bone := skel.find_bone(bone_name)
			if bone < 0:
				continue
			var pose := skel.get_bone_global_pose(bone)
			var a := (skel.get_bone_global_pose(hand).origin - pose.origin).normalized()
			var b := (target - pose.origin).normalized()
			if a.length_squared() < 0.001 or b.length_squared() < 0.001:
				continue
			var global_delta := Quaternion(a, b)
			var parent := skel.get_bone_parent(bone)
			var parent_basis := Basis.IDENTITY if parent < 0 else skel.get_bone_global_pose(parent).basis.orthonormalized()
			var local_delta := parent_basis.inverse().get_rotation_quaternion() * global_delta * parent_basis.get_rotation_quaternion()
			var rotation := skel.get_bone_pose_rotation(bone)
			skel.set_bone_pose_rotation(bone, Quaternion.IDENTITY.slerp(local_delta, weight * 0.4) * rotation)
			skel.force_update_all_bone_transforms()

func _box(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	node.mesh = mesh
	node.position = pos
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.8
	node.material_override = mat
	parent.add_child(node)
	return node
