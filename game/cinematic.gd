extends CanvasLayer

# Studio/title use a 3D shot; the subsequent story setup still uses temporary
# still artwork and does not yet contain the requested character performance.
var canvas: Control
var backdrop: TextureRect
var shade: ColorRect
var headline: Label
var subtitle: Label
var skip_button: Button
var generation := 0
var completion: Callable
var shot: Node3D
var previous_camera: Camera3D
var skip_armed := false

func _ready() -> void:
	layer = 10
	canvas = Control.new()
	canvas.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	canvas.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(canvas)
	backdrop = TextureRect.new()
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	backdrop.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	backdrop.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	backdrop.texture = load("res://assets/opening_city.png")
	canvas.add_child(backdrop)
	shade = ColorRect.new()
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.color = Color(0.02, 0.03, 0.05, 0.7)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	canvas.add_child(shade)
	headline = Label.new()
	headline.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	headline.offset_left = -500
	headline.offset_right = 500
	headline.offset_top = -130
	headline.offset_bottom = -30
	headline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	headline.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	headline.add_theme_font_size_override("font_size", 58)
	headline.add_theme_color_override("font_color", Color("f3f7f7"))
	canvas.add_child(headline)
	subtitle = Label.new()
	subtitle.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	subtitle.offset_left = -510
	subtitle.offset_right = 510
	subtitle.offset_top = 0
	subtitle.offset_bottom = 115
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	subtitle.add_theme_font_size_override("font_size", 25)
	subtitle.add_theme_color_override("font_color", Color("bceff2"))
	canvas.add_child(subtitle)
	skip_button = Button.new()
	skip_button.text = "SKIP INTRO"
	skip_button.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	skip_button.offset_left = -210
	skip_button.offset_top = -76
	skip_button.offset_right = -28
	skip_button.offset_bottom = -24
	skip_button.pressed.connect(_skip)
	canvas.add_child(skip_button)
	canvas.hide()

func opening(done: Callable) -> void:
	generation += 1
	var current := generation
	completion = done
	skip_armed = false
	skip_button.text = "SKIP INTRO"
	canvas.show()
	headline.add_theme_font_override("font", load("res://assets/fonts/Oswald.ttf"))
	headline.text = ""
	subtitle.text = ""
	backdrop.hide()
	shade.color = Color(0, 0, 0, 0)
	previous_camera = get_viewport().get_camera_3d()
	shot = preload("res://studio_intro_3d.gd").new()
	shot.position = Vector3(400, 0, 400)
	get_parent().add_child(shot)
	await get_tree().create_timer(3.5).timeout
	if current != generation:
		return
	shot.reveal_title()
	await get_tree().create_timer(4.5).timeout
	if current == generation:
		_finish()

func prologue(done: Callable) -> void:
	generation += 1
	var current := generation
	completion = done
	skip_armed = false
	skip_button.text = "SKIP CINEMATIC"
	canvas.show()
	shade.color = Color(0.02, 0.03, 0.05, 0.5)
	headline.text = "CINDER CITY"
	subtitle.text = "A city that never forgets what it is owed."
	await get_tree().create_timer(6.0).timeout
	if current != generation:
		return
	headline.text = "HEARTHLINE  /  LATE NIGHT"
	subtitle.text = "Marcus is finishing a late shift at the shop."
	await get_tree().create_timer(6.0).timeout
	if current != generation:
		return
	# Preserve the original ringing close-up. The answer path has a separate
	# experimental pickup performance after the player chooses to answer.
	previous_camera = get_viewport().get_camera_3d()
	shot = preload("res://phone_shot.gd").new()
	# Keep this shot separate from the gameplay street geometry.
	shot.position = Vector3(200, 0, 200)
	get_parent().add_child(shot)
	backdrop.hide()
	shade.color = Color(0.02, 0.03, 0.05, 0.08)
	headline.text = ""
	subtitle.text = "[Phone vibrating]"
	subtitle.offset_top = 220
	subtitle.offset_bottom = 290
	await get_tree().create_timer(6.0).timeout
	if current != generation:
		return
	_close_shot()
	backdrop.show()
	shade.color = Color(0.02, 0.03, 0.05, 0.5)
	subtitle.offset_top = 0
	subtitle.offset_bottom = 115
	headline.text = "LAST CALL"
	subtitle.text = "Some debts follow you home."
	await get_tree().create_timer(5.0).timeout
	if current == generation:
		_finish()

func answer_phone(done: Callable) -> void:
	generation += 1
	var current := generation
	completion = done
	skip_armed = false
	skip_button.text = "SKIP PERFORMANCE"
	canvas.show()
	backdrop.hide()
	shade.color = Color(0, 0, 0, 0)
	headline.text = ""
	subtitle.text = ""
	previous_camera = get_viewport().get_camera_3d()
	shot = preload("res://answer_shot.gd").new()
	shot.position = Vector3(300, 0, 300)
	get_parent().add_child(shot)
	await get_tree().create_timer(4.0).timeout
	if current == generation:
		_finish()

func _unhandled_input(event: InputEvent) -> void:
	if canvas.visible and event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_X:
		_skip()
		get_viewport().set_input_as_handled()

func _skip() -> void:
	if not skip_armed:
		skip_armed = true
		skip_button.text = "CONFIRM SKIP"
		return
	_finish()

func _close_shot() -> void:
	if is_instance_valid(shot):
		shot.queue_free()
		shot = null
	if is_instance_valid(previous_camera):
		previous_camera.make_current()
	previous_camera = null

func _finish() -> void:
	generation += 1
	_close_shot()
	backdrop.show()
	subtitle.offset_top = 0
	subtitle.offset_bottom = 115
	canvas.hide()
	var done := completion
	completion = Callable()
	if done.is_valid():
		done.call()
