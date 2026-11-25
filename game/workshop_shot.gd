extends Node3D

# Interim in-engine workshop. Built as a self-contained shot so it can be
# discarded immediately after the phone close-up begins.
var camera: Camera3D
var actor: Node3D
var elapsed := 0.0
var light: OmniLight3D
var ambience: AudioStreamPlayer

func _ready() -> void:
	# Room shell, counter and framing. The rear windows reveal a compressed
	# skyline, keeping the focus on Marcus and his workbench.
	var floor := _box(Vector3(9, 0.12, 7), Vector3(0, -0.06, 0), "303538")
	floor.material_override = preload("res://surface_materials.gd").get_concrete()
	_box(Vector3(9, 3.8, 0.15), Vector3(0, 1.9, -3.1), "263238")
	_box(Vector3(0.15, 3.8, 7), Vector3(-4.4, 1.9, 0), "252f32")
	_box(Vector3(9, 0.16, 7), Vector3(0, 3.8, 0), "232a2d")
	for x in [-2.7, -0.9, 0.9, 2.7]:
		_box(Vector3(1.65, 1.7, 0.04), Vector3(x, 2.25, -3.0), "536a76", true)
		_box(Vector3(1.67, 0.035, 0.08), Vector3(x, 2.2, -2.94), "1b252b")
		_box(Vector3(0.045, 1.7, 0.08), Vector3(x, 2.25, -2.94), "1b252b")
	# Distant dark silhouettes seen through the upper windows, not a final city.
	for i in 17:
		var x := -3.8 + float(i) * 0.46
		var height := 0.35 + float((i * 7) % 8) * 0.10
		_box(Vector3(0.32, height, 0.05), Vector3(x, 1.4 + height * 0.5, -2.95), "263b46", true)
	for x in [-2.6, 0.0, 2.6]:
		_box(Vector3(0.12, 0.14, 6.2), Vector3(x, 3.63, 0), "151f24")
	# Back workbench with drawer seams, steel legs, lamp and practical objects.
	var tabletop := _box(Vector3(3.15, 0.12, 0.9), Vector3(0, 0.89, -1.20), "695c4c")
	tabletop.material_override = preload("res://surface_materials.gd").get_wood()
	_box(Vector3(3.10, 0.18, 0.88), Vector3(0, 0.77, -1.20), "373c3b")
	for x in [-1.40, 1.40]:
		for z in [-1.53, -0.87]:
			_box(Vector3(0.09, 0.70, 0.09), Vector3(x, 0.38, z), "293334")
	for x in [-1.05, -0.35, 0.35, 1.05]:
		_box(Vector3(0.60, 0.035, 0.015), Vector3(x, 0.78, -0.75), "89908b")
	# Personal traces: a framed snapshot, a work order and a sealed envelope.
	_box(Vector3(0.39, 0.31, 0.05), Vector3(-1.15, 1.13, -1.56), "302820")
	_box(Vector3(0.33, 0.25, 0.012), Vector3(-1.15, 1.13, -1.526), "c3b49a")
	_box(Vector3(0.13, 0.20, 0.012), Vector3(-1.22, 1.12, -1.514), "465861")
	_box(Vector3(0.11, 0.16, 0.012), Vector3(-1.07, 1.10, -1.514), "61504b")
	_box(Vector3(0.38, 0.008, 0.27), Vector3(0.75, 0.96, -1.05), "d0c4ac")
	_box(Vector3(0.23, 0.008, 0.14), Vector3(0.27, 0.96, -1.05), "a7a49a")
	for i in 4:
		_box(Vector3(0.27, 0.002, 0.006), Vector3(0.75, 0.966, -1.14 + i * 0.043), "777a75")
	_box(Vector3(0.04, 0.55, 0.04), Vector3(1.35, 1.23, -1.45), "38444a")
	_box(Vector3(0.36, 0.06, 0.22), Vector3(1.22, 1.53, -1.45), "b0a38a")
	_box(Vector3(0.24, 0.01, 0.12), Vector3(1.22, 1.49, -1.45), "f6cc8c", true)
	# Tool board, shelves and a few imported stock objects.
	_box(Vector3(1.5, 1.1, 0.06), Vector3(-2.7, 1.8, -3.0), "485352")
	for i in 7:
		_box(Vector3(0.035, 0.28 + (i % 3) * 0.05, 0.04), Vector3(-3.25 + i * 0.18, 1.86, -2.95), "a1a8a2")
	_box(Vector3(1.6, 0.07, 0.45), Vector3(2.7, 1.5, -2.8), "555a53")
	for i in 5:
		_box(Vector3(0.15, 0.25 + (i % 2) * 0.08, 0.15), Vector3(2.18 + i * 0.25, 1.67, -2.78), "766a55")
	_prop("wooden_crate", Vector3(-2.9, 0, -1.4), 0.65)
	_prop("tyre", Vector3(2.3, 0.35, -1.4), 0.7)
	# Warm work light with cool window-side fill.
	light = OmniLight3D.new()
	light.position = Vector3(1.15, 1.65, -1.1)
	light.light_color = Color("ffd3a1")
	light.light_energy = 1.55
	light.omni_range = 4.2
	add_child(light)
	var fill := OmniLight3D.new()
	fill.position = Vector3(-2.4, 2.3, -2.0)
	fill.light_color = Color("8bbcca")
	fill.light_energy = 0.75
	fill.omni_range = 5.5
	add_child(fill)
	actor = preload("res://character.gd").new()
	actor.position = Vector3(-0.35, 0, -0.10)
	actor.coat_color = Color("56616a")
	add_child(actor)
	var actor_light := OmniLight3D.new()
	actor_light.position = Vector3(-0.4, 2.1, 1.1)
	actor_light.light_color = Color("ffe1ba")
	actor_light.light_energy = 1.4
	actor_light.omni_range = 4.0
	add_child(actor_light)
	actor.play_motion("Idle")
	camera = Camera3D.new()
	camera.position = Vector3(1.9, 1.5, 2.9)
	camera.fov = 43
	add_child(camera)
	camera.look_at(actor.global_position + Vector3(0, 1.05, 0), Vector3.UP)
	camera.make_current()
	ambience = AudioStreamPlayer.new()
	ambience.stream = _make_ambience()
	ambience.volume_db = -19
	add_child(ambience)
	ambience.play()

func _process(delta: float) -> void:
	elapsed += delta
	var travel := smoothstep(0.0, 12.0, elapsed)
	camera.position = Vector3(lerpf(1.9, 1.55, travel), lerpf(1.5, 1.48, travel), lerpf(2.9, 2.35, travel))
	camera.look_at(actor.global_position + Vector3(0, 1.07, 0), Vector3.UP)

func _box(size: Vector3, pos: Vector3, color: String, unlit := false) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	node.mesh = mesh
	node.position = pos
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(color)
	mat.roughness = 0.84
	if unlit:
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	node.material_override = mat
	add_child(node)
	return node

func _prop(asset: String, pos: Vector3, factor: float) -> void:
	var node := (load("res://assets/props/" + asset + ".glb") as PackedScene).instantiate() as Node3D
	node.position = pos
	node.scale = Vector3.ONE * factor
	add_child(node)

func _make_ambience() -> AudioStreamWAV:
	# Seamless, quiet synthesized electrical/ventilation hum; no recording is claimed.
	const RATE := 22050
	const SECONDS := 4
	var data := PackedByteArray()
	data.resize(RATE * SECONDS * 2)
	for i in RATE * SECONDS:
		var t := float(i) / RATE
		var sample := sin(TAU * 55.0 * t) * 0.14 + sin(TAU * 110.0 * t) * 0.04 + sin(TAU * 27.0 * t) * 0.025
		var value := int(clampf(sample, -1.0, 1.0) * 32767.0)
		data.encode_s16(i * 2, value)
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = RATE
	stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
	stream.loop_begin = 0
	stream.loop_end = RATE * SECONDS
	stream.data = data
	return stream
