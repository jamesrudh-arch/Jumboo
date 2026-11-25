extends Control

# Fixed-base, single-finger analog stick. A second finger remains free for
# camera drag or action buttons. Coordinates are in the current viewport.
var finger := -1
var value := Vector2.ZERO
var radius := 76.0
var deadzone := 0.12

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process_input(true)

func _input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	if event is InputEventScreenTouch:
		if event.pressed and finger == -1 and get_global_rect().has_point(event.position):
			finger = event.index
			_set_from_position(event.position)
		elif not event.pressed and event.index == finger:
			reset()
	elif event is InputEventScreenDrag and event.index == finger:
		_set_from_position(event.position)

func _set_from_position(pos: Vector2) -> void:
	var offset := (pos - (global_position + size * 0.5)).limit_length(radius) / radius
	var strength := offset.length()
	value = Vector2.ZERO if strength <= deadzone else offset.normalized() * ((strength - deadzone) / (1.0 - deadzone))
	queue_redraw()

func reset() -> void:
	finger = -1
	value = Vector2.ZERO
	queue_redraw()

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_VISIBILITY_CHANGED and not is_visible_in_tree():
		reset()

func _draw() -> void:
	var center := size * 0.5
	draw_circle(center, radius + 4.0, Color(0.02, 0.06, 0.09, 0.65))
	draw_arc(center, radius, 0, TAU, 48, Color(0.56, 0.82, 0.84, 0.75), 2.0, true)
	draw_circle(center + value * radius * 0.65, 30.0, Color(0.62, 0.88, 0.87, 0.78))
