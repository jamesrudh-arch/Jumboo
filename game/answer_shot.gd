extends Node3D

# A staged pickup performance for the interim rig: a stock pickup clip followed
# by explicit right-arm pose keys and a hand-relative phone attachment. This is
# still a work-in-progress performance and needs visual review and final art.
var actor: Node3D
var skeletons: Array[Skeleton3D] = []
var phone: Node3D
var camera: Camera3D
var pickup_sound: AudioStreamPlayer
var elapsed := 0.0
var attached := false
var phone_grip := Transform3D.IDENTITY
var speaker := ""
const GRAB_TIME := 0.55
# Local bone quaternions, sampled and refined from the interim rig's pickup
# pose. Times are seconds; both the body and clothing receive identical keys.
const ARM_KEYS := [
	[1.0, Quaternion(-0.294152, -0.680668, 0.469306, 0.479497), Quaternion(0.366220, -0.153889, 0.060890, 0.915693)],
	[1.25, Quaternion(-0.163507, -0.383611, 0.764088, 0.492218), Quaternion(0.705058, -0.114918, 0.114694, 0.690314)],
	[1.65, Quaternion(-0.074560, -0.178811, 0.868286, 0.456670), Quaternion(0.858271, -0.080158, 0.138847, 0.487511)],
	[2.2, Quaternion(-0.037282, -0.093052, 0.895263, 0.434114), Quaternion(0.906403, -0.063742, 0.146517, 0.391029)]
]

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
	# Keep the performance in a workshop context rather than an empty void.
	var floor := _box(self, Vector3(6, 0.1, 5), Vector3(0, -0.05, 0), Color("303538"))
	floor.material_override = preload("res://surface_materials.gd").get_concrete()
	_box(self, Vector3(6, 3.5, 0.12), Vector3(0, 1.75, -1.9), Color("263238"))
	_box(self, Vector3(1.4, 1.2, 0.04), Vector3(-1.65, 2.0, -1.82), Color("526c78"))
	_box(self, Vector3(1.4, 0.06, 0.07), Vector3(-1.65, 2.0, -1.78), Color("1b252b"))
	_box(self, Vector3(0.06, 1.2, 0.07), Vector3(-1.65, 2.0, -1.78), Color("1b252b"))
	_box(self, Vector3(1.2, 0.06, 0.35), Vector3(1.7, 1.7, -1.7), Color("535a54"))
	for i in 4:
		_box(self, Vector3(0.12, 0.22, 0.12), Vector3(1.3 + i * 0.23, 1.84, -1.68), Color("84725d"))
	actor = preload("res://character.gd").new()
	actor.use_legacy_rig = true
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
	var tabletop := (load("res://assets/realistic/wooden_table_02/wooden_table_02_2k.gltf") as PackedScene).instantiate() as Node3D
	tabletop.name = "TexturedWoodTable"
	tabletop.scale = Vector3(1.5, 1.0, 1.2)
	tabletop.position = Vector3(hand.x, hand.y - 0.7994, hand.z)
	add_child(tabletop)
	_box(self, Vector3(1.8, 0.8, 0.06), Vector3(hand.x, hand.y + 0.35, hand.z - 0.45), Color("293138"))
	_add_prop("wooden_crate", Vector3(-2.0, 0, -1.1), 0.55)
	_add_prop("generator", Vector3(2.0, 0, -1.25), 0.55)
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
	pickup_sound = AudioStreamPlayer.new()
	pickup_sound.stream = load("res://assets/audio/phone_pickup.wav")
	pickup_sound.volume_db = -6.0
	add_child(pickup_sound)
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
	if elapsed >= GRAB_TIME and not attached:
		# Sample the grab pose even when a large frame or skip crosses it.
		_pose_animations(GRAB_TIME)
		phone_grip = _hand_transform().affine_inverse() * phone.global_transform
		pickup_sound.play()
		attached = true
	_pose_animations(minf(elapsed, 1.0))
	if elapsed >= 1.0:
		for skel in skeletons:
			_apply_arm_keys(skel, elapsed)
	if attached:
		phone.global_transform = _hand_transform() * phone_grip
	# An understated listening/talking movement, not facial animation or lip sync.
	if speaker != "":
		var nod := sin(elapsed * (2.4 if speaker == "marcus" else 1.5)) * 0.018
		for skel in skeletons:
			var neck := skel.find_bone("neck_01")
			if neck >= 0:
				skel.set_bone_pose_rotation(neck, skel.get_bone_pose_rotation(neck) * Quaternion(Vector3.RIGHT, nod))
				skel.force_update_all_bone_transforms()
	var travel := smoothstep(1.0, 3.5, elapsed)
	camera.position = Vector3(lerpf(-1.6, -1.4, travel), lerpf(1.65, 1.7, travel), lerpf(2.6, 2.3, travel))
	camera.look_at(global_position + Vector3(0, 1.18, -0.1), Vector3.UP)

func _hand_transform() -> Transform3D:
	var skel := skeletons[0]
	return skel.global_transform * skel.get_bone_global_pose(skel.find_bone("hand_r"))

func _apply_arm_keys(skel: Skeleton3D, time: float) -> void:
	var first: Array = ARM_KEYS[0]
	var last: Array = ARM_KEYS[ARM_KEYS.size() - 1]
	for i in ARM_KEYS.size() - 1:
		if time <= float(ARM_KEYS[i + 1][0]):
			first = ARM_KEYS[i]
			last = ARM_KEYS[i + 1]
			break
	var fraction := smoothstep(float(first[0]), float(last[0]), time)
	for i in 2:
		var bone := skel.find_bone(["upperarm_r", "lowerarm_r"][i])
		if bone >= 0:
			var start: Quaternion = first[i + 1]
			var finish: Quaternion = last[i + 1]
			skel.set_bone_pose_rotation(bone, start.normalized().slerp(finish.normalized(), fraction))
	skel.force_update_all_bone_transforms()

func set_speaker(value: String) -> void:
	speaker = value

func complete_pickup() -> void:
	# Confirming skip resolves to the held pose, never a phone left on the table.
	if elapsed < 2.3:
		_process(2.3 - elapsed)

func _add_prop(asset: String, pos: Vector3, factor: float) -> void:
	var scene := load("res://assets/props/" + asset + ".glb") as PackedScene
	if scene == null:
		return
	var prop := scene.instantiate() as Node3D
	prop.position = pos
	prop.scale = Vector3.ONE * factor
	add_child(prop)

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
