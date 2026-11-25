extends Node3D

# Vertical-slice blockout. Geometry and characters are temporary; no claim of final art.
const SAVE_PATH := "user://leverage_blockout.json"
const SAVE_VERSION := 2
const CYAN := Color("00f0ff")
const PINK := Color("ff007f")
const WHITE := Color("edf1f4")
const MUTED := Color("a9b7c3")

# 0 call, 1 witness, 2 investigate van, 3 collector, 4 lead recorded.
var stage := 0
var witness_choice := ""
var encounter_choice := ""
var combat_active := false
var player_health := 3
var enemy_health := 3
var enemy_timer := 1.5
var telegraph := false
var guard_timer := 0.0
var guard_cooldown := 0.0
var strike_cooldown := 0.0
var enemy_stagger := 0.0
var encounter: Node3D
var interact_button: Button
var strike_button: Button
var guard_button: Button
var touch_stick: Control
var navigation: Control
var map_button: Button
var camera_yaw := 0.0
var camera_touch_id := -1
var game_started := false
var interaction_open := false
var player: Node3D
var camera: Camera3D
var witness: Node3D
var objective: Label
var hint: Label
var message: Label
var overlay: PanelContainer
var dialog_title: Label
var dialog_text: Label
var button_box: VBoxContainer
var controls: Control
var hud: Control
var call_sequence_id := 0
var call_line_index := 0
const CALL_LINES := [
	"ELI: You still owe me for the window.",
	"MARCUS: Ten years and you're still keeping accounts?",
	"ELI: Somebody in this family has to.",
	"[An engine cuts out.]\n\nELI: If anybody asks about me tonight, you haven't seen me.",
	"MARCUS: Eli, what happened?",
	"ELI: Just promise me.",
	"[Metal scrapes. The call disconnects.]"
]
const CALL_VOICES := [
	"res://assets/voice/eli_window.wav",
	"res://assets/voice/marcus_accounts.wav",
	"res://assets/voice/eli_family.wav",
	"res://assets/voice/eli_seen.wav",
	"res://assets/voice/marcus_happened.wav",
	"res://assets/voice/eli_promise.wav",
	""
]
var audio_director: Node
var cinematic: CanvasLayer
var title_screen: CanvasLayer

func _ready() -> void:
	preload("res://input_setup.gd").configure()
	_build_world()
	_build_ui()
	audio_director = preload("res://audio_director.gd").new()
	add_child(audio_director)
	cinematic = preload("res://cinematic.gd").new()
	add_child(cinematic)
	title_screen = preload("res://title_screen.gd").new()
	add_child(title_screen)
	controls.hide()
	hud.hide()
	overlay.hide()
	cinematic.opening(_show_title)

func _build_world() -> void:
	var environment := WorldEnvironment.new()
	var world_environment := Environment.new()
	world_environment.background_mode = Environment.BG_COLOR
	world_environment.background_color = Color("101822")
	world_environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	world_environment.ambient_light_color = Color("7691a8")
	world_environment.ambient_light_energy = 0.7
	environment.environment = world_environment
	add_child(environment)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, -35, 0)
	sun.light_color = Color("b7cae4")
	sun.light_energy = 0.55
	add_child(sun)
	var ground := _box(Vector3(30, 0.2, 42), Vector3(0, -0.1, 3), Color("303a43"))
	var ground_mat := preload("res://surface_materials.gd").get_concrete().duplicate() as StandardMaterial3D
	ground_mat.uv1_scale = Vector3(10, 14, 1)
	ground.material_override = ground_mat
	var road := _box(Vector3(7.5, 0.12, 38), Vector3(0, 0.02, 3), Color("19232d"))
	var road_mat := preload("res://surface_materials.gd").get_asphalt().duplicate() as StandardMaterial3D
	road_mat.uv1_scale = Vector3(3, 12, 1)
	road_mat.albedo_color = Color("9ea8aa")
	road.material_override = road_mat
	for z in [-11.0, -7.0, -3.0, 1.0, 5.0, 9.0, 13.0]:
		_box(Vector3(0.10, 0.015, 1.25), Vector3(0, 0.095, z), Color("a99e87"))
	_box(Vector3(3.0, 0.08, 0.4), Vector3(0, 0.12, -3), Color("c5b69b"))
	var district := preload("res://district.gd").new()
	district.name = "CinderDistrict"
	add_child(district)
	player = _person(Color("90c4ca"), Vector3(0, 0, 18.0))
	witness = _person(Color("e8a8bb"), Vector3(-3.8, 0, -7), "res://assets/characters/rocketbox/aisha_formal.glb")
	var witness_marker := Label3D.new()
	witness_marker.name = "WitnessMarker"
	witness_marker.text = "SADE"
	witness_marker.position.y = 2.35
	witness_marker.modulate = Color("ffd0df")
	witness_marker.outline_size = 8
	witness_marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	witness.add_child(witness_marker)
	_box(Vector3(2.0, 1.0, 1.1), Vector3(-5.0, 0.5, -7), Color("65584f"))
	_prop("wooden_crate", Vector3(-4.65, 0, -8.2), 0.8)
	_prop("wooden_crate", Vector3(-4.6, 0, -9.3), 0.6)
	_prop("tyre", Vector3(4.5, 0.35, -4), 0.8)
	_prop("hanging_lamp", Vector3(-3.8, 3.6, -7), 0.65)
	encounter = preload("res://market_encounter.gd").new()
	add_child(encounter)
	var lamp := OmniLight3D.new()
	lamp.position = Vector3(-3, 4, -6)
	lamp.light_color = CYAN
	lamp.light_energy = 1.3
	lamp.omni_range = 10
	add_child(lamp)
	camera = Camera3D.new()
	camera.current = true
	camera.fov = 55
	add_child(camera)
	_update_camera()

func _box(size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	node.mesh = mesh
	node.position = pos
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.78
	node.material_override = material
	add_child(node)
	return node

func _prop(asset: String, pos: Vector3, size_factor: float) -> void:
	var scene := load("res://assets/props/" + asset + ".glb") as PackedScene
	var instance := scene.instantiate() as Node3D
	instance.position = pos
	instance.scale = Vector3.ONE * size_factor
	add_child(instance)

func _person(color: Color, pos: Vector3, model_path := "res://assets/characters/rocketbox/andre_casual.glb") -> Node3D:
	var person := preload("res://character.gd").new()
	person.model_path = model_path
	person.coat_color = color.darkened(0.58)
	person.position = pos
	add_child(person)
	return person

func _update_camera() -> void:
	var offset := Vector3(0, 3.3, 6.2).rotated(Vector3.UP, camera_yaw)
	camera.position = player.position + offset
	var look_offset := Vector3(0, 1.0, -1.0).rotated(Vector3.UP, camera_yaw)
	camera.look_at(player.position + look_offset, Vector3.UP)

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(root)
	var top := VBoxContainer.new()
	hud = top
	top.position = Vector2(32, 24)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(top)
	var brand := _label("LEVERAGE  /  CINDER CITY", 21, CYAN)
	top.add_child(brand)
	objective = _label("", 24, WHITE)
	top.add_child(objective)
	hint = _label("", 17, MUTED)
	top.add_child(hint)
	message = _label("", 16, MUTED)
	top.add_child(message)
	controls = Control.new()
	controls.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	controls.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(controls)
	touch_stick = preload("res://touch_stick.gd").new()
	touch_stick.position = Vector2(44, 446)
	touch_stick.size = Vector2(200, 200)
	controls.add_child(touch_stick)
	navigation = preload("res://navigation_map.gd").new()
	controls.add_child(navigation)
	map_button = _button("Y  MAP")
	map_button.position = Vector2(1040, 125)
	map_button.custom_minimum_size = Vector2(190, 48)
	map_button.size = Vector2(190, 48)
	map_button.pressed.connect(_toggle_map)
	controls.add_child(map_button)
	interact_button = _button("B  INTERACT")
	interact_button.position = Vector2(1020, 570)
	interact_button.size = Vector2(200, 70)
	interact_button.pressed.connect(_interact)
	controls.add_child(interact_button)
	strike_button = _button("A  STRIKE")
	strike_button.position = Vector2(1020, 570)
	strike_button.size = Vector2(200, 70)
	strike_button.pressed.connect(_strike)
	controls.add_child(strike_button)
	guard_button = _button("B  GUARD")
	guard_button.position = Vector2(1020, 485)
	guard_button.size = Vector2(200, 70)
	guard_button.pressed.connect(_guard)
	controls.add_child(guard_button)
	strike_button.hide()
	guard_button.hide()
	overlay = PanelContainer.new()
	overlay.position = Vector2(280, 115)
	overlay.size = Vector2(720, 490)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.04, 0.06, 0.09, 0.97)
	style.border_color = CYAN
	style.set_border_width_all(2)
	style.set_content_margin_all(28)
	overlay.add_theme_stylebox_override("panel", style)
	root.add_child(overlay)
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 18)
	overlay.add_child(content)
	dialog_title = _label("", 29, CYAN)
	content.add_child(dialog_title)
	dialog_text = _label("", 23, WHITE)
	dialog_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dialog_text.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.add_child(dialog_text)
	button_box = VBoxContainer.new()
	button_box.add_theme_constant_override("separation", 8)
	content.add_child(button_box)

func _label(text: String, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	return label

func _button(text: String) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(180, 52)
	button.focus_mode = Control.FOCUS_NONE
	button.add_theme_font_size_override("font_size", 20)
	return button

func _clear_buttons() -> void:
	for child in button_box.get_children():
		child.queue_free()

func _dialog(title: String, text: String) -> void:
	if is_instance_valid(audio_director):
		audio_director.stop_voice()
	interaction_open = true
	touch_stick.reset()
	camera_touch_id = -1
	if is_instance_valid(player):
		player.play_motion("Idle")
	controls.hide()
	# The answered call stays in the 3D performance instead of replacing it
	# with a full-screen page. Other dialogue retains the existing layout.
	if title == "ELI  /  CALL" and cinematic.hold_answer_shot:
		overlay.position = Vector2(130, 470)
		overlay.size = Vector2(1020, 220)
	else:
		overlay.position = Vector2(280, 115)
		overlay.size = Vector2(720, 490)
	overlay.show()
	dialog_title.text = title
	dialog_text.text = text
	_clear_buttons()

func _option(text: String, action: Callable) -> void:
	var button := _button(text)
	button.focus_mode = Control.FOCUS_ALL
	button.pressed.connect(action)
	var first := true
	for child in button_box.get_children():
		if not child.is_queued_for_deletion():
			first = false
	button_box.add_child(button)
	if first:
		button.call_deferred("grab_focus")

func _close_dialog() -> void:
	audio_director.stop_voice()
	interaction_open = false
	overlay.hide()
	controls.show()
	hud.show()
	_update_hud()
	_update_navigation()
	var focused := get_viewport().gui_get_focus_owner()
	if is_instance_valid(focused):
		focused.release_focus()

func _show_title() -> void:
	audio_director.stop_voice()
	audio_director.play_music(audio_director.PROLOGUE)
	interaction_open = true
	overlay.hide()
	controls.hide()
	title_screen.show_menu(_new_game, _continue_game, not _read_save().is_empty())

func _new_game() -> void:
	audio_director.play_music(audio_director.PROLOGUE)
	stage = 0
	witness_choice = ""
	encounter_choice = ""
	combat_active = false
	camera_yaw = 0.0
	encounter.set_progress(stage)
	player.position = Vector3(0, 0, 18.0)
	_update_camera()
	game_started = true
	overlay.hide()
	controls.hide()
	hud.hide()
	call_sequence_id += 1
	cinematic.show_captions = title_screen.subtitles_enabled
	cinematic.prologue(_automatic_answer)

func _continue_game() -> void:
	cinematic.close_held_shot()
	var saved := _read_save()
	if saved.is_empty():
		_show_title()
		return
	audio_director.play_music(audio_director.TENSION)
	stage = int(saved.get("stage", 0))
	witness_choice = str(saved.get("witness_choice", ""))
	encounter_choice = str(saved.get("encounter_choice", ""))
	combat_active = false
	encounter.set_progress(stage)
	player.position = Vector3(float(saved.get("x", 0.0)), 0, float(saved.get("z", 7.0)))
	game_started = true
	_update_camera()
	_close_dialog()

func _automatic_answer() -> void:
	# Story calls are answered by Marcus; they do not present a choice panel.
	overlay.hide()
	controls.hide()
	hud.hide()
	cinematic.answer_phone(_play_automatic_call)

func _play_automatic_call() -> void:
	call_sequence_id += 1
	var sequence := call_sequence_id
	for i in CALL_LINES.size():
		if sequence != call_sequence_id:
			return
		call_line_index = i
		var speaker := "marcus" if i in [1, 4] else ("eli" if i < 6 else "")
		if cinematic.hold_answer_shot and is_instance_valid(cinematic.shot):
			cinematic.shot.set_speaker(speaker)
		cinematic.show_call_caption(CALL_LINES[i])
		var duration := 1.3
		if CALL_VOICES[i] != "":
			var voice_length: float = audio_director.play_voice(CALL_VOICES[i])
			# Never strand the story on a missing or invalid audio resource.
			# A timed beat does not prove sound was audible on a device.
			duration = clampf(voice_length + 0.3, 1.5, 20.0)
		else:
			audio_director.stop_voice()
			audio_director.play_music(audio_director.TENSION)
			audio_director.play_effect("res://assets/audio/call_lost.wav")
		if i == 3:
			audio_director.play_effect("res://assets/audio/engine_cut.wav")
		await get_tree().create_timer(duration).timeout
	if sequence == call_sequence_id:
		_finish_call()

func _finish_call() -> void:
	call_sequence_id += 1
	cinematic.end_call_captions()
	cinematic.close_held_shot()
	audio_director.stop_voice()
	audio_director.play_music(audio_director.TENSION)
	stage = 1
	_close_dialog()
	_save_game()

func _interact() -> void:
	if not game_started or interaction_open:
		return
	if stage == 1 and player.position.distance_to(witness.position) < 2.8:
		_dialog("SADE  /  MARKET STALL", "MARCUS: I'm looking for my brother. Did you see a man here?")
		audio_director.play_voice("res://assets/voice/marcus_witness.wav")
		_option("NEXT  /  X", _witness_reply)
	elif stage == 2 and player.position.distance_to(encounter.van.position) < 3.2:
		_inspect_van()
	elif stage == 3 and not combat_active and player.position.distance_to(encounter.collector.position) < 3.2:
		_collector_warning()
	elif stage == 1:
		message.text = "Move closer to Sade's stall to interact."
	elif stage == 2:
		message.text = "Move closer to the damaged van to inspect it."
	elif stage == 3 and not combat_active:
		message.text = "Approach the collector to continue."

func _witness_reply() -> void:
	_dialog("SADE  /  MARKET STALL", "SADE: I saw a van. I didn't see who was inside.")
	audio_director.play_voice("res://assets/voice/sade_intro.wav")
	_option("REASSURE  /  Don't reveal her name", func(): _choose_witness("reassure"))
	_option("PRESSURE  /  Demand what she knows", func(): _choose_witness("pressure"))

func _choose_witness(choice: String) -> void:
	witness_choice = choice
	stage = 2
	var line := "SADE: Back corner was dented. Blue tarp over the cargo. It went toward the market."
	if choice == "pressure":
		line = "SADE: I gave you what I saw. Don't bring this to my stall. The van had a dented back corner and a blue tarp."
	_dialog("LEAD FOUND", line)
	var voice_path := "res://assets/voice/sade_pressure.wav" if choice == "pressure" else "res://assets/voice/sade_reassure.wav"
	audio_director.play_voice(voice_path)
	_option("FOLLOW THE LEAD", _follow_lead)

func _follow_lead() -> void:
	encounter.set_progress(stage)
	_save_game()
	_close_dialog()

func _inspect_van() -> void:
	stage = 3
	encounter.set_progress(stage)
	_dialog("DAMAGED VAN  /  ROUTE DOCKET", "MARCUS: Dented corner, blue tarp. Sade's van. Where did they take you, Eli?\n\nA dispatch docket names a garage. It identifies a route, not who took him.")
	audio_director.play_voice("res://assets/voice/marcus_van.wav")
	_option("CONTINUE", _collector_warning)
	_save_game()

func _collector_warning() -> void:
	_dialog("COLLECTOR  /  STREET PRESSURE", "COLLECTOR: Your brother left a debt on our books. Tell me where he is, and this doesn't have to get ugly.")
	audio_director.play_voice("res://assets/voice/collector_warning.wav")
	_option("BARGAIN  /  Promise one delivery", _bargain)
	_option("WITHDRAW  /  Leave with the docket", func(): _complete_encounter("withdraw"))
	_option("FIGHT  /  Stand your ground", _fight_warning)

func _bargain() -> void:
	_dialog("MARCUS  /  AN OFFER", "MARCUS: I don't know where he is. Let me find him, and I'll bring you the delivery he owes.")
	audio_director.play_voice("res://assets/voice/marcus_bargain.wav")
	_option("CONTINUE", _bargain_agreement)

func _bargain_agreement() -> void:
	_dialog("COLLECTOR  /  AGREEMENT", "COLLECTOR: One delivery. You miss it, that debt becomes yours. Take the route docket and don't make me come looking.\n\nA delivery obligation will be recorded.")
	audio_director.play_voice("res://assets/voice/collector_agreement.wav")
	_option("ACCEPT OBLIGATION", func(): _complete_encounter("bargain"))
	_option("BACK", _collector_warning)

func _fight_warning() -> void:
	_dialog("COLLECTOR  /  FIGHT", "COLLECTOR: Fine. You asked for this. Let's see how long you stay standing.\n\nMove to dodge. Strike in range with A; B guards briefly. A red warning appears before an attack.")
	audio_director.play_voice("res://assets/voice/collector_threat.wav")
	_option("FIGHT", _start_fight)
	_option("BACK", _collector_warning)

func _start_fight() -> void:
	player_health = 3
	enemy_health = 3
	enemy_timer = 1.5
	telegraph = false
	guard_timer = 0.0
	guard_cooldown = 0.0
	strike_cooldown = 0.0
	enemy_stagger = 0.0
	encounter.collector.position = Vector3(1.0, 0, -7.4)
	encounter.collector_label.text = "COLLECTOR"
	combat_active = true
	_close_dialog()

func _strike() -> void:
	if not combat_active or interaction_open or strike_cooldown > 0.0:
		return
	strike_cooldown = 0.65
	player.play_motion("Punch_Jab")
	audio_director.play_effect("res://assets/audio/strike.wav")
	if player.position.distance_to(encounter.collector.position) <= 2.3:
		enemy_health -= 1
		preload("res://haptics.gd").pulse(70, 0.25, 0.10)
		enemy_stagger = 0.45
		encounter.collector.play_motion("Hit_Chest")
		telegraph = false
		enemy_timer = 1.4
		encounter.collector_label.text = "COLLECTOR"
		encounter.collector_label.modulate = Color("efc3af")
		if enemy_health <= 0:
			_complete_encounter("fight")
	_update_hud()

func _guard() -> void:
	if not combat_active or interaction_open or guard_cooldown > 0.0:
		return
	guard_timer = 1.0
	guard_cooldown = 1.8
	_update_hud()

func _process_fight(delta: float) -> void:
	guard_timer = maxf(0.0, guard_timer - delta)
	guard_cooldown = maxf(0.0, guard_cooldown - delta)
	strike_cooldown = maxf(0.0, strike_cooldown - delta)
	enemy_stagger = maxf(0.0, enemy_stagger - delta)
	var opponent: Node3D = encounter.collector
	var distance := player.position.distance_to(opponent.position)
	if enemy_stagger <= 0.0:
		if not telegraph and distance > 1.8:
			var target := Vector3(player.position.x, opponent.position.y, player.position.z)
			opponent.position = opponent.position.move_toward(target, delta * 1.3)
			opponent.rotation.y = atan2(player.position.x - opponent.position.x, player.position.z - opponent.position.z)
			opponent.play_motion("Walk")
		else:
			opponent.play_motion("Idle")
		enemy_timer -= delta
		if enemy_timer <= 0.0 and not telegraph and distance <= 2.5:
			telegraph = true
			enemy_timer = 0.85
			encounter.collector_label.text = "INCOMING!"
			encounter.collector_label.modulate = Color("ff867c")
		elif enemy_timer <= 0.0 and telegraph:
			telegraph = false
			enemy_timer = 1.6
			encounter.collector_label.text = "COLLECTOR"
			encounter.collector_label.modulate = Color("efc3af")
			opponent.play_motion("Punch_Jab")
			if distance <= 2.3 and guard_timer <= 0.0:
				player_health -= 1
				preload("res://haptics.gd").pulse(150, 0.4, 0.3)
				audio_director.play_effect("res://assets/audio/impact.wav")
				if player_health <= 0:
					_fight_failed()
					return
	_update_hud()

func _fight_failed() -> void:
	combat_active = false
	_dialog("KNOCKED DOWN", "Marcus loses the fight. Retry from this encounter, or withdraw with the route docket. No bargain has been recorded.")
	_option("RETRY", _start_fight)
	_option("WITHDRAW", func(): _complete_encounter("withdraw"))

func _complete_encounter(choice: String) -> void:
	combat_active = false
	encounter_choice = choice
	stage = 4
	encounter.set_progress(stage)
	_save_game()
	var text := "TESSA: You got away. Good. Don't mistake a route docket for proof of who took Eli. Bring it to me and we'll check the dispatch records."
	var voice_path := "res://assets/voice/tessa_escape.wav"
	if choice == "bargain":
		text = "TESSA: You promised them a delivery? Marcus, that debt has a way of growing. Bring me the route docket and we'll find another way."
		voice_path = "res://assets/voice/tessa_bargain.wav"
	elif choice == "fight":
		text = "TESSA: You didn't have to fight him. Bring me the route docket, Marcus. We need answers, not another debt on the street."
		voice_path = "res://assets/voice/tessa_fight.wav"
	_dialog("TESSA  /  PHONE", text)
	audio_director.play_voice(voice_path)
	_option("CONTINUE", _close_dialog)

func _toggle_map() -> void:
	navigation.set_expanded(not navigation.expanded)

func _update_navigation() -> void:
	var target := Vector3.ZERO
	var label := ""
	match stage:
		1:
			target = witness.position
			label = "SADE"
		2:
			target = encounter.van.position
			label = "VAN"
		3:
			target = encounter.collector.position
			label = "COLLECTOR"
	navigation.set_navigation(player.position, player.rotation.y, target, label, not label.is_empty())

func _update_hud() -> void:
	_update_navigation()
	interact_button.visible = not combat_active
	strike_button.visible = combat_active
	guard_button.visible = combat_active
	if combat_active:
		objective.text = "STREET PRESSURE  /  Marcus %d   •   Collector %d" % [player_health, enemy_health]
		hint.text = "INCOMING! Move away or guard." if telegraph else "A: strike nearby   •   B: guard briefly   •   Move to evade"
		message.text = "GUARDING" if guard_timer > 0.0 else ("Guard recovering" if guard_cooldown > 0.0 else "Guard ready")
	elif stage == 1:
		objective.text = "OBJECTIVE  /  Find the witness at the market stall"
		hint.text = "Follow the map to Sade. B: interact. Drag right side to look."
		message.text = ""
	elif stage == 2:
		objective.text = "OBJECTIVE  /  Inspect the damaged van"
		hint.text = "Follow the road to the vehicle marked DAMAGED VAN."
		message.text = "Sade: " + witness_choice.to_upper()
	elif stage == 3:
		objective.text = "OBJECTIVE  /  Deal with the collector"
		hint.text = "Approach the collector and interact."
		message.text = "The docket shows a route, not who took Eli."
	elif stage == 4:
		objective.text = "LEAD RECORDED  /  Check the garage dispatch"
		hint.text = "This prototype stops here. Outcome: " + encounter_choice.to_upper()
		message.text = "One delivery owed." if encounter_choice == "bargain" else "No delivery obligation recorded."
	else:
		objective.text = "OBJECTIVE  /  Answer Eli's call"
		hint.text = ""
		message.text = ""

func _process(delta: float) -> void:
	if not game_started or interaction_open or stage == 0:
		return
	if combat_active:
		_process_fight(delta)
		if interaction_open:
			return
	var direction := Input.get_vector("move_left", "move_right", "move_forward", "move_back", 0.18)
	if touch_stick.value.length_squared() > direction.length_squared():
		direction = touch_stick.value
	var camera_input := Input.get_axis("camera_left", "camera_right")
	camera_yaw -= camera_input * delta * 1.8
	var world_direction := Vector3(direction.x, 0, direction.y).rotated(Vector3.UP, camera_yaw)
	if world_direction.length_squared() > 0.001:
		player.rotation.y = lerp_angle(player.rotation.y, atan2(world_direction.x, world_direction.z), minf(delta * 9.0, 1.0))
		if not combat_active or strike_cooldown <= 0.30:
			player.play_motion("Walk")
	else:
		if not combat_active or strike_cooldown <= 0.30:
			player.play_motion("Idle")
	player.position.x = clampf(player.position.x + world_direction.x * 2.0 * delta, -10.5, 10.5)
	player.position.z = clampf(player.position.z + world_direction.z * 2.0 * delta, -12.0, 20.5)
	_update_camera()
	_update_navigation()

func _unhandled_input(event: InputEvent) -> void:
	# X advances a single dialogue beat, but never silently selects a choice.
	if interaction_open and overlay.visible:
		if event.is_action_pressed("game_dialogue"):
			var available: Array[Button] = []
			for child in button_box.get_children():
				if child is Button and not child.is_queued_for_deletion():
					available.append(child)
			if available.size() == 1:
				available[0].pressed.emit()
				get_viewport().set_input_as_handled()
		return
	if not game_started or stage == 0:
		return
	if event.is_action_pressed("game_map"):
		_toggle_map()
		get_viewport().set_input_as_handled()
	elif combat_active and event.is_action_pressed("game_strike"):
		_strike()
		get_viewport().set_input_as_handled()
	elif combat_active and event.is_action_pressed("game_guard"):
		_guard()
		get_viewport().set_input_as_handled()
	elif not combat_active and event.is_action_pressed("game_interact"):
		_interact()
		get_viewport().set_input_as_handled()
	elif event is InputEventScreenTouch:
		if event.pressed and camera_touch_id == -1 and event.position.x > 500 and not navigation.get_global_rect().has_point(event.position):
			camera_touch_id = event.index
		elif not event.pressed and event.index == camera_touch_id:
			camera_touch_id = -1
	elif event is InputEventScreenDrag and event.index == camera_touch_id:
		camera_yaw -= event.relative.x * 0.006
		_update_camera()

func _save_game() -> void:
	var data := {"version": SAVE_VERSION, "stage": stage, "witness_choice": witness_choice, "encounter_choice": encounter_choice, "x": player.position.x, "z": player.position.z}
	if not preload("res://save_store.gd").write(data, _validate_save):
		message.text = "Save failed. The last valid checkpoint remains available."

func _read_save() -> Dictionary:
	return preload("res://save_store.gd").read(_validate_save)

func _validate_save(source: Dictionary) -> Dictionary:
	var data := source.duplicate(true)
	var version := int(data.get("version", -1))
	var saved_stage := int(data.get("stage", -1))
	if version not in [1, SAVE_VERSION] or saved_stage < 1 or saved_stage > (2 if version == 1 else 4):
		return {}
	var choice := str(data.get("witness_choice", ""))
	var outcome := str(data.get("encounter_choice", ""))
	if (saved_stage == 1 and choice != "") or (saved_stage >= 2 and choice not in ["reassure", "pressure"]):
		return {}
	if (saved_stage < 4 and outcome != "") or (saved_stage == 4 and outcome not in ["bargain", "withdraw", "fight"]):
		return {}
	if not (data.get("x") is int or data.get("x") is float) or not (data.get("z") is int or data.get("z") is float):
		return {}
	if not is_finite(float(data["x"])) or not is_finite(float(data["z"])):
		return {}
	data["x"] = clampf(float(data["x"]), -10.5, 10.5)
	data["z"] = clampf(float(data["z"]), -12.0, 20.5)
	return data
