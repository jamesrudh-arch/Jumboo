extends Node3D

# Identity-only build: the previous unapproved gameplay prototype was removed.
var shot: Node3D

func _ready() -> void:
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("10171d")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("8b9b9b")
	environment.ambient_light_energy = 0.7
	world.environment = environment
	add_child(world)
	shot = preload("res://studio_intro_3d.gd").new()
	add_child(shot)
	if shot.load_error != "":
		_show_load_error(shot.load_error)
		return
	await get_tree().create_timer(3.7, false).timeout
	if is_instance_valid(shot):
		shot.reveal_title()

# Error-only diagnostics, not a replacement for the approved 3D identity.
func _show_load_error(message: String) -> void:
	push_error(message)
	var layer := CanvasLayer.new()
	add_child(layer)
	var background := ColorRect.new()
	background.color = Color("10171d")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(background)
	var label := Label.new()
	label.text = "IDENTITY COULD NOT START\n" + message + "\nPlease reopen the project and allow imports to finish."
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(label)
