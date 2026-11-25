extends CanvasLayer

# Temporary presentation: generated still artwork, real UI text, no character animation.
# The intent is to establish sequence and pacing before a final cinematic is produced.
var canvas: Control
var backdrop: TextureRect
var shade: ColorRect
var headline: Label
var subtitle: Label
var phone: PanelContainer
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
	phone = PanelContainer.new()
	phone.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	phone.offset_left = -150
	phone.offset_right = 150
	phone.offset_top = 95
	phone.offset_bottom = 260
	var style := StyleBoxFlat.new()
	style.bg_color = Color("eafaff")
	style.border_color = Color("95f8ff")
	style.set_border_width_all(4)
	style.set_corner_radius_all(18)
	phone.add_theme_stylebox_override("panel", style)
	var phone_text := Label.new()
	phone_text.text = "INCOMING CALL\nELI"
	phone_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	phone_text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	phone_text.add_theme_font_size_override("font_size", 23)
	phone_text.add_theme_color_override("font_color", Color("172b34"))
	phone.add_child(phone_text)
	canvas.add_child(phone)
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
	phone.hide()
	shade.color = Color(0.01, 0.01, 0.02, 0.94)
	headline.text = "D’YOUNGS GAMES"
	subtitle.text = "PRESENTS"
	await get_tree().create_timer(3.5).timeout
	if current != generation:
		return
	shade.color = Color(0.02, 0.03, 0.05, 0.64)
	headline.text = "LEVERAGE"
	subtitle.text = "C I N D E R   C I T Y\nEVERYONE HAS LEVERAGE ON YOU."
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
	phone.hide()
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
	# Replace the flat phone panel with a real 3D close-up. This is an
	# isolated technical shot, not the missing character pickup performance.
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
	phone.hide()
	var done := completion
	completion = Callable()
	if done.is_valid():
		done.call()
