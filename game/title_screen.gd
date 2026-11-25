extends CanvasLayer

var canvas: Control
var actions: VBoxContainer
var callback_new: Callable
var callback_continue: Callable
var font: Font
var subtitles_enabled := false

func _ready() -> void:
	layer = 5
	font = load("res://assets/fonts/BebasNeue-Regular.ttf")
	canvas = Control.new()
	canvas.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(canvas)
	var image := TextureRect.new()
	image.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	image.texture = load("res://assets/title_character_backdrop.png")
	image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	canvas.add_child(image)
	var veil := ColorRect.new()
	veil.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	veil.color = Color(0.01, 0.025, 0.04, 0.26)
	veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	canvas.add_child(veil)
	var side := ColorRect.new()
	side.position = Vector2.ZERO
	side.size = Vector2(610, 720)
	side.color = Color(0.012, 0.019, 0.025, 0.0)
	side.mouse_filter = Control.MOUSE_FILTER_IGNORE
	canvas.add_child(side)
	var line := ColorRect.new()
	line.position = Vector2(690, 95)
	line.size = Vector2(53, 3)
	line.color = Color("66d6d6")
	canvas.add_child(line)
	_label("D’YOUNGS GAMES", Vector2(690, 110), Vector2(400, 30), 18, Color("b7c8c9"))
	_label("LEVERAGE", Vector2(684, 157), Vector2(550, 122), 86, Color("f0f4ef"))
	_label("C I N D E R   C I T Y", Vector2(691, 278), Vector2(500, 40), 23, Color("71dcd9"))
	_label("EVERYONE HAS LEVERAGE ON YOU.", Vector2(691, 334), Vector2(480, 36), 16, Color("b6c4c5"))
	actions = VBoxContainer.new()
	actions.position = Vector2(691, 422)
	actions.custom_minimum_size = Vector2(350, 0)
	actions.add_theme_constant_override("separation", 12)
	canvas.add_child(actions)
	var captions := CheckButton.new()
	captions.text = "SUBTITLES / CAPTIONS"
	captions.position = Vector2(691, 580)
	captions.custom_minimum_size = Vector2(350, 48)
	captions.add_theme_font_override("font", font)
	captions.add_theme_font_size_override("font_size", 19)
	captions.button_pressed = subtitles_enabled
	captions.toggled.connect(func(enabled: bool): subtitles_enabled = enabled)
	canvas.add_child(captions)
	var haptics := CheckButton.new()
	haptics.text = "VIBRATION"
	haptics.position = Vector2(691, 630)
	haptics.custom_minimum_size = Vector2(300, 44)
	haptics.add_theme_font_override("font", font)
	haptics.add_theme_font_size_override("font_size", 19)
	haptics.button_pressed = preload("res://haptics.gd").enabled
	haptics.toggled.connect(func(enabled: bool): preload("res://haptics.gd").enabled = enabled)
	canvas.add_child(haptics)
	var sound := CheckButton.new()
	sound.text = "SOUND"
	sound.position = Vector2(1020, 630)
	sound.custom_minimum_size = Vector2(180, 44)
	sound.add_theme_font_override("font", font)
	sound.add_theme_font_size_override("font_size", 19)
	sound.button_pressed = not AudioServer.is_bus_mute(AudioServer.get_bus_index("Master"))
	sound.toggled.connect(func(enabled: bool): AudioServer.set_bus_mute(AudioServer.get_bus_index("Master"), not enabled))
	canvas.add_child(sound)
	_label("STORY / M01     •     WORK IN PROGRESS", Vector2(691, 682), Vector2(400, 28), 14, Color("a1b1b4"))
	canvas.hide()

func _label(text: String, pos: Vector2, size: Vector2, points: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.position = pos
	l.size = size
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", points)
	l.add_theme_color_override("font_color", color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	canvas.add_child(l)
	return l

func show_menu(start: Callable, resume: Callable, has_save: bool) -> void:
	callback_new = start
	callback_continue = resume
	for child in actions.get_children():
		child.queue_free()
	_add_button("NEW GAME", _new_game)
	if has_save:
		_add_button("CONTINUE", _continue_game)
	canvas.show()
	var available := actions.get_children().filter(func(child): return not child.is_queued_for_deletion())
	if not available.is_empty():
		available[0].call_deferred("grab_focus")

func _add_button(text: String, action: Callable) -> void:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(350, 56)
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.add_theme_font_override("font", font)
	b.add_theme_font_size_override("font_size", 23)
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.1, 0.17, 0.19, 0.84)
	normal.border_color = Color("66d6d6")
	normal.border_width_left = 3
	normal.set_content_margin_all(14)
	b.add_theme_stylebox_override("normal", normal)
	var hover := normal.duplicate() as StyleBoxFlat
	hover.bg_color = Color("245b60")
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("pressed", hover)
	b.pressed.connect(action)
	actions.add_child(b)

func _new_game() -> void:
	canvas.hide()
	callback_new.call()

func _continue_game() -> void:
	canvas.hide()
	callback_continue.call()
