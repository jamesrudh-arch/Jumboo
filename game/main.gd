extends Node3D

# Vertical-slice blockout. Geometry and characters are temporary; no claim of final art.
const SAVE_PATH := "user://leverage_blockout.json"
const SAVE_VERSION := 1
const CYAN := Color("00f0ff")
const PINK := Color("ff007f")
const WHITE := Color("edf1f4")
const MUTED := Color("a9b7c3")

var stage := 0 # 0: call, 1: find Sade, 2: complete
var witness_choice := ""
var move_touch := Vector2.ZERO
var touch_directions := {"up": false, "down": false, "left": false, "right": false}
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
var cinematic: CanvasLayer
var title_screen: CanvasLayer

func _ready() -> void:
	_build_world()
	_build_ui()
	cinematic = preload("res://cinematic.gd").new()
	add_child(cinematic)
	title_screen = preload("res://title_screen.gd").new()
	add_child(title_screen)
	controls.hide()
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
	_box(Vector3(24, 0.2, 30), Vector3(0, -0.1, 0), Color("303a43"))
	_box(Vector3(7.5, 0.12, 30), Vector3(0, 0.02, 0), Color("19232d"))
	# Abstract buildings leave the road and footpaths accessible.
	for z in [-10.0, -4.0, 2.0, 8.0]:
		_box(Vector3(5, 4.5, 4.8), Vector3(-8.5, 2.25, z), Color("28303b"))
		_box(Vector3(5, 5.5, 4.8), Vector3(8.5, 2.75, z), Color("33333e"))
		_box(Vector3(1.8, 0.12, 0.05), Vector3(-5.98, 3.5, z), PINK if z == 2.0 else Color("57727b"))
	_box(Vector3(3.0, 0.08, 0.4), Vector3(0, 0.12, -3), Color("c5b69b"))
	player = _person(Color("90c4ca"), Vector3(0, 0, 7))
	witness = _person(Color("e8a8bb"), Vector3(-3.8, 0, -7))
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

func _person(_color: Color, pos: Vector3) -> Node3D:
	var person := preload("res://character.gd").new()
	person.position = pos
	add_child(person)
	return person

func _update_camera() -> void:
	camera.position = player.position + Vector3(0, 7.0, 10.0)
	camera.look_at(player.position + Vector3(0, 0.8, -1.2), Vector3.UP)

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(root)
	var top := VBoxContainer.new()
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
	_direction_button("▲", Vector2(96, 475), "up")
	_direction_button("◀", Vector2(32, 540), "left")
	_direction_button("▼", Vector2(96, 540), "down")
	_direction_button("▶", Vector2(160, 540), "right")
	var interact := _button("B  INTERACT")
	interact.position = Vector2(1020, 570)
	interact.size = Vector2(200, 70)
	interact.pressed.connect(_interact)
	controls.add_child(interact)
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
	button.add_theme_font_size_override("font_size", 20)
	return button

func _direction_button(text: String, pos: Vector2, direction: String) -> void:
	var button := _button(text)
	button.custom_minimum_size = Vector2(58, 58)
	button.position = pos
	button.size = Vector2(58, 58)
	button.button_down.connect(func(): touch_directions[direction] = true)
	button.button_up.connect(func(): touch_directions[direction] = false)
	controls.add_child(button)

func _clear_buttons() -> void:
	for child in button_box.get_children():
		child.queue_free()

func _dialog(title: String, text: String) -> void:
	interaction_open = true
	touch_directions = {"up": false, "down": false, "left": false, "right": false}
	if is_instance_valid(player):
		player.play_motion("Idle")
	controls.hide()
	overlay.show()
	dialog_title.text = title
	dialog_text.text = text
	_clear_buttons()

func _option(text: String, action: Callable) -> void:
	var button := _button(text)
	button.pressed.connect(action)
	button_box.add_child(button)

func _close_dialog() -> void:
	interaction_open = false
	overlay.hide()
	controls.show()
	_update_hud()

func _show_title() -> void:
	interaction_open = true
	overlay.hide()
	controls.hide()
	title_screen.show_menu(_new_game, _continue_game, not _read_save().is_empty())

func _new_game() -> void:
	stage = 0
	witness_choice = ""
	player.position = Vector3(0, 0, 7)
	game_started = true
	overlay.hide()
	controls.hide()
	cinematic.prologue(_call_screen)

func _continue_game() -> void:
	var saved := _read_save()
	if saved.is_empty():
		_show_title()
		return
	stage = int(saved.get("stage", 0))
	witness_choice = str(saved.get("witness_choice", ""))
	player.position = Vector3(float(saved.get("x", 0.0)), 0, float(saved.get("z", 7.0)))
	game_started = true
	_update_camera()
	_close_dialog()

func _call_screen() -> void:
	_dialog("INCOMING CALL  /  ELI", "The phone vibrates on the workbench. Eli is calling.\n\nThis blockout uses written dialogue; no voice or cinematic assets are included.")
	_option("ANSWER", _answer_call)
	_option("DECLINE", _decline_call)

func _answer_call() -> void:
	_dialog("ELI  /  CALL", "ELI: You still owe me for the window.\nMARCUS: Ten years and you're still keeping accounts?\nELI: Somebody in this family has to.\n\nAn engine cuts out on Eli's end.\nELI: If anybody asks about me tonight, you haven't seen me.\nMARCUS: Eli—\n\n[Metal scrape. Call disconnects.]")
	_option("CONTINUE", _finish_call)

func _decline_call() -> void:
	_dialog("MISSED CALL", "Eli's call goes unanswered. Tessa catches a second vibration on the workbench.\n\nTESSA: He sent the loading lane location. You should go check on him.")
	_option("CONTINUE", _finish_call)

func _finish_call() -> void:
	stage = 1
	_close_dialog()
	_save_game()

func _interact() -> void:
	if not game_started or interaction_open:
		return
	if stage == 1 and player.position.distance_to(witness.position) < 2.8:
		_dialog("SADE  /  MARKET STALL", "MARCUS: I'm looking for my brother. Did you see a man here?\n\nSADE: I saw a van. I didn't see who was inside.")
		_option("REASSURE  /  Don't reveal her name", func(): _choose_witness("reassure"))
		_option("PRESSURE  /  Demand what she knows", func(): _choose_witness("pressure"))
	else:
		message.text = "Move closer to Sade's stall to interact."

func _choose_witness(choice: String) -> void:
	witness_choice = choice
	stage = 2
	var line := "SADE: Back corner was dented. Blue tarp over the cargo. It went toward the market."
	if choice == "pressure":
		line = "SADE: I gave you what I saw. Don't bring this to my stall. The van had a dented back corner and a blue tarp."
	_dialog("LEAD FOUND", line + "\n\nYour choice and the lead are recorded in the blockout save. Further consequences are not yet implemented.")
	_option("FINISH SLICE", _finish_slice)

func _finish_slice() -> void:
	_save_game()
	_close_dialog()

func _update_hud() -> void:
	if stage == 1:
		objective.text = "OBJECTIVE  /  Find the witness at the market stall"
		hint.text = "Move with touch arrows or WASD. Approach Sade and interact."
	elif stage == 2:
		objective.text = "LEAD RECORDED  /  Dented van, blue tarp"
		hint.text = "Story blockout complete. Your choice: " + witness_choice.to_upper()
	else:
		objective.text = "OBJECTIVE  /  Answer Eli's call"
		hint.text = ""
	message.text = "EARLY BLOCKOUT • No combat, driving, final art or device tuning yet"

func _process(delta: float) -> void:
	if not game_started or interaction_open or stage == 0:
		return
	var x := float(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT) or touch_directions["right"]) - float(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT) or touch_directions["left"])
	var z := float(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN) or touch_directions["down"]) - float(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP) or touch_directions["up"])
	var direction := Vector2(x, z).limit_length(1.0)
	if direction.length_squared() > 0.001:
		player.rotation.y = lerp_angle(player.rotation.y, atan2(direction.x, direction.y), minf(delta * 9.0, 1.0))
		player.play_motion("Walk")
	else:
		player.play_motion("Idle")
	player.position.x = clampf(player.position.x + direction.x * 2.0 * delta, -5.4, 5.4)
	player.position.z = clampf(player.position.z + direction.y * 2.0 * delta, -12.0, 12.0)
	_update_camera()
	if Input.is_action_just_pressed("ui_accept"):
		_interact()

func _save_game() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		message.text = "Save failed. This blockout does not yet provide save recovery."
		return
	file.store_string(JSON.stringify({"version": SAVE_VERSION, "stage": stage, "witness_choice": witness_choice, "x": player.position.x, "z": player.position.z}))
	file.close()

func _read_save() -> Dictionary:
	if not FileAccess.file_exists(SAVE_PATH):
		return {}
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return {}
	var result: Variant = JSON.parse_string(file.get_as_text())
	if not result is Dictionary:
		return {}
	var data: Dictionary = result
	if int(data.get("version", -1)) != SAVE_VERSION or int(data.get("stage", -1)) < 1 or int(data.get("stage", -1)) > 2:
		return {}
	var choice := str(data.get("witness_choice", ""))
	if (int(data["stage"]) == 1 and choice != "") or (int(data["stage"]) == 2 and choice not in ["reassure", "pressure"]):
		return {}
	return data
