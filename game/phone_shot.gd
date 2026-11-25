extends Node3D

# An isolated 3D phone shot. The hero performance and final workshop art are not yet supplied.
var camera: Camera3D
var phone: Node3D
var screen_material: StandardMaterial3D
var phone_light: OmniLight3D
var audio: AudioStreamPlayer
var elapsed := 0.0

func _ready() -> void:
	_box(self, Vector3(4.8, 0.12, 3.4), Vector3(0, -0.06, 0), Color("3b3937"), 0.82)
	# Framing elements are deliberately restrained so the incoming call is the focus.
	_box(self, Vector3(2.4, 1.3, 0.12), Vector3(0, 0.65, -1.15), Color("242a2c"), 0.9)
	_box(self, Vector3(0.65, 0.05, 0.11), Vector3(-0.65, 0.035, -0.45), Color("8b8c87"), 0.38)
	_box(self, Vector3(0.11, 0.04, 0.46), Vector3(0.79, 0.03, -0.35), Color("6a6b64"), 0.48)
	phone = Node3D.new()
	add_child(phone)
	phone.rotation_degrees.y = -12.0
	_box(phone, Vector3(0.34, 0.034, 0.68), Vector3(0, 0.03, 0), Color("20252c"), 0.28)
	_box(phone, Vector3(0.315, 0.004, 0.635), Vector3(0, 0.05, 0), Color("080b0f"), 0.18)
	# A luminous edge and dark call interface preserve the white glow while
	# making the caller readable in the physical phone display.
	var rim := _box(phone, Vector3(0.29, 0.003, 0.55), Vector3(0, 0.054, 0.015), Color("e6f9ff"), 0.32)
	screen_material = rim.material_override as StandardMaterial3D
	screen_material.emission_enabled = true
	screen_material.emission = Color("d5f4ff")
	screen_material.emission_energy_multiplier = 1.2
	var display := _box(phone, Vector3(0.266, 0.002, 0.524), Vector3(0, 0.057, 0.015), Color("101d2b"), 0.3)
	(display.material_override as StandardMaterial3D).shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_phone_text("INCOMING CALL", -0.16, 27, Color("a9d9e1"))
	_phone_text("ELI", -0.06, 66, Color("f1fbff"))
	_phone_text("BROTHER", 0.035, 27, Color("b8c9d1"))
	_phone_text("ANSWERING...", 0.17, 24, Color("a9e6d7"))
	_box(phone, Vector3(0.055, 0.005, 0.012), Vector3(0, 0.057, -0.275), Color("121820"), 0.3)
	phone_light = OmniLight3D.new()
	phone_light.position = Vector3(0, 0.12, 0)
	phone_light.light_color = Color("e8f7ff")
	phone_light.light_energy = 1.2
	phone_light.omni_range = 1.5
	phone.add_child(phone_light)
	var warm := OmniLight3D.new()
	warm.position = Vector3(-1.8, 1.8, -0.7)
	warm.light_color = Color("ffb675")
	warm.light_energy = 1.3
	warm.omni_range = 4.5
	add_child(warm)
	var cool := OmniLight3D.new()
	cool.position = Vector3(1.6, 1.1, -0.4)
	cool.light_color = Color("7cb9d0")
	cool.light_energy = 0.8
	cool.omni_range = 3.5
	add_child(cool)
	camera = Camera3D.new()
	camera.position = Vector3(0.7, 1.15, 1.75)
	camera.fov = 32.0
	add_child(camera)
	camera.look_at(global_position + Vector3(0, 0.02, 0), Vector3.UP)
	camera.make_current()
	audio = AudioStreamPlayer.new()
	audio.stream = load("res://assets/phone_vibration.wav")
	audio.volume_db = -9.0
	add_child(audio)
	audio.finished.connect(audio.play)
	audio.play()

func _phone_text(text: String, z: float, size: int, color: Color) -> void:
	var label := Label3D.new()
	label.name = "Phone_" + text.replace(" ", "_")
	label.text = text
	label.font = load("res://assets/fonts/BebasNeue-Regular.ttf")
	label.font_size = size
	label.pixel_size = 0.00085
	label.modulate = color
	label.outline_size = 0
	label.shaded = false
	label.rotation.x = -PI * 0.5
	label.position = Vector3(0, 0.061, z)
	phone.add_child(label)

func _process(delta: float) -> void:
	elapsed += delta
	# One repeating buzz pattern: motion, sound and light share the same rhythm.
	var phase := fposmod(elapsed, 2.4)
	var buzzing := phase < 0.72 or (phase >= 0.92 and phase < 1.64)
	var amount := 1.0 if buzzing else 0.0
	phone.position.x = sin(elapsed * 85.0) * 0.004 * amount
	phone.rotation_degrees.z = sin(elapsed * 72.0) * 0.55 * amount
	phone_light.light_energy = 0.9 + 0.5 * amount
	screen_material.emission_energy_multiplier = 0.9 + 0.5 * amount

func _box(parent: Node3D, size: Vector3, pos: Vector3, color: Color, roughness: float) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	instance.mesh = mesh
	instance.position = pos
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	instance.material_override = material
	parent.add_child(instance)
	return instance
