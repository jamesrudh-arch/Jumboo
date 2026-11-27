extends Node3D
## Provisional call and placeholder establishing shot. The two animated
## models have a known cut; the proper preceding story cinematic is unfinished.
signal call_completed

const PICKUP_PATH := "res://assets/intro/provisional_pickup.glb"
const TALK_PATH := "res://assets/intro/provisional_conversation.glb"
const VOICE_PATH := "res://assets/intro/first_call_preview.wav"
const RING_PATH := "res://assets/intro/incoming_ring.wav"
const RING_SECONDS := 3.0

# Set by the opening before this node enters the tree. The standalone test
# uses zero; the default opening uses a temporary 30-second establishing shot.
var establishing_duration := 0.0
var establishing_elapsed := 0.0
var camera: Camera3D

var phase := "loading"
var error_message := ""
var pickup: Node3D
var conversation: Node3D
var pickup_animation: AnimationPlayer
var conversation_animation: AnimationPlayer
var ring_player: AudioStreamPlayer
var voice_player: AudioStreamPlayer

func _ready() -> void:
	_setup_stage()
	pickup = _load_model(PICKUP_PATH)
	if not pickup:
		return
	add_child(pickup)
	pickup_animation = _find_animation(pickup)
	if not pickup_animation:
		_fail("Pickup animation is missing")
		return
	conversation = _load_model(TALK_PATH)
	if not conversation:
		return
	add_child(conversation)
	conversation.hide()
	conversation_animation = _find_animation(conversation)
	if not conversation_animation:
		_fail("Conversation animation is missing")
		return
	var ring := _load_audio(RING_PATH)
	var voice := _load_audio(VOICE_PATH)
	if not ring or not voice:
		_fail("Call audio could not be loaded")
		return
	ring_player = AudioStreamPlayer.new()
	ring_player.stream = ring
	add_child(ring_player)
	voice_player = AudioStreamPlayer.new()
	voice_player.stream = voice
	add_child(voice_player)
	pickup_animation.play(_animation_name(pickup_animation))
	pickup_animation.seek(0.0, true)
	pickup_animation.pause()
	if establishing_duration > 0.0:
		phase = "establishing"
		await get_tree().create_timer(establishing_duration, false).timeout
		if phase != "establishing":
			return
		_set_camera_progress(1.0)
	phase = "ringing"
	ring_player.play()
	await get_tree().create_timer(RING_SECONDS, false).timeout
	if phase == "ringing":
		_begin_pickup()

func _begin_pickup() -> void:
	if phase != "ringing":
		return
	phase = "pickup"
	ring_player.stop()
	pickup_animation.animation_finished.connect(_pickup_finished, CONNECT_ONE_SHOT)
	pickup_animation.play()

func _pickup_finished(_name: StringName) -> void:
	if phase != "pickup":
		return
	pickup.hide()
	conversation.show()
	phase = "conversation"
	conversation_animation.animation_finished.connect(_conversation_finished, CONNECT_ONE_SHOT)
	conversation_animation.play(_animation_name(conversation_animation))
	voice_player.play()

func _conversation_finished(_name: StringName) -> void:
	if phase != "conversation":
		return
	phase = "complete"
	call_completed.emit()

func _load_model(path: String) -> Node3D:
	if ResourceLoader.exists(path, "PackedScene"):
		var packed := load(path) as PackedScene
		if packed:
			var instance := packed.instantiate() as Node3D
			if instance:
				return instance
	if not FileAccess.file_exists(path):
		_fail("Missing call model: " + path)
		return null
	var document := GLTFDocument.new()
	var state := GLTFState.new()
	var result := document.append_from_file(path, state)
	if result != OK:
		_fail("Could not load call model: %s (%d)" % [path, result])
		return null
	var model := document.generate_scene(state) as Node3D
	if not model:
		_fail("Could not create call model: " + path)
	return model

func _load_audio(path: String) -> AudioStream:
	if ResourceLoader.exists(path, "AudioStream"):
		var imported := load(path) as AudioStream
		if imported:
			return imported
	return AudioStreamWAV.load_from_file(path)

func _find_animation(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer and _animation_name(node) != "":
		return node as AnimationPlayer
	for child in node.get_children():
		var found := _find_animation(child)
		if found:
			return found
	return null

func _animation_name(player: AnimationPlayer) -> StringName:
	for name in player.get_animation_list():
		if name != "RESET":
			return name
	return &""

func _setup_stage() -> void:
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("10171d")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("e0e6e8")
	environment.ambient_light_energy = 0.7
	world.environment = environment
	add_child(world)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-35, -35, 0)
	light.light_energy = 1.5
	add_child(light)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 1.18
	add_child(camera)
	_set_camera_progress(0.0 if establishing_duration > 0.0 else 1.0)
	camera.make_current()

func _process(delta: float) -> void:
	if phase == "establishing" and establishing_duration > 0.0:
		establishing_elapsed += delta
		_set_camera_progress(clampf(establishing_elapsed / establishing_duration, 0.0, 1.0))

func _set_camera_progress(progress: float) -> void:
	var smooth := smoothstep(0.0, 1.0, progress)
	camera.position = Vector3(2.3, 1.95, 4.5).lerp(Vector3(1.8, 1.8, 4.0), smooth)
	camera.look_at(Vector3(.18, 1.30, .16), Vector3.UP)

func _fail(message: String) -> void:
	error_message = message
	phase = "error"
	push_error(message)
	var layer := CanvasLayer.new()
	add_child(layer)
	var label := Label.new()
	label.text = "CALL TEST COULD NOT START\n" + message
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(label)
