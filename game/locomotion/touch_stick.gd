extends Control
## Analog touch control. The containing gameplay scene owns layout and connects
## vector_changed to the character motor's set_touch_vector method.
signal vector_changed(value: Vector2)

@export_range(30.0, 200.0, 1.0) var radius := 80.0
var finger := -1
var value := Vector2.ZERO
var center := Vector2.ZERO

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and finger == -1:
			finger = event.index
			center = event.position
			_set_value(Vector2.ZERO)
			queue_redraw()
			accept_event()
		elif not event.pressed and event.index == finger:
			_reset()
			accept_event()
	elif event is InputEventScreenDrag and event.index == finger:
		_set_value((event.position - center) / maxf(radius, 1.0))
		accept_event()

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_VISIBILITY_CHANGED and not is_visible_in_tree():
		_reset()

func _exit_tree() -> void:
	_reset()

func _set_value(next: Vector2) -> void:
	value = next.limit_length(1.0)
	vector_changed.emit(value)
	queue_redraw()

func _reset() -> void:
	if finger != -1 or value != Vector2.ZERO:
		finger = -1
		_set_value(Vector2.ZERO)

func _draw() -> void:
	if finger == -1:
		return
	draw_circle(center, radius, Color(0.08, 0.10, 0.12, 0.55))
	draw_arc(center, radius, 0.0, TAU, 48, Color(0.9, 0.93, 0.95, 0.65), 2.0, true)
	draw_circle(center + value * radius, radius * 0.32, Color(0.9, 0.93, 0.95, 0.8))
