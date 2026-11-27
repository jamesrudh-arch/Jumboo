extends SceneTree
const Stick = preload("res://locomotion/touch_stick.gd")
var failures := 0
var latest := Vector2.ZERO
func check(condition: bool, label: String) -> void:
	if condition: print("PASS: ", label)
	else:
		failures += 1
		push_error("FAIL: " + label)
func _initialize() -> void: call_deferred("run")
func on_vector(v: Vector2) -> void: latest = v
func touch(index: int, pressed: bool, position: Vector2) -> InputEventScreenTouch:
	var e := InputEventScreenTouch.new()
	e.index = index
	e.pressed = pressed
	e.position = position
	return e
func drag(index: int, position: Vector2) -> InputEventScreenDrag:
	var e := InputEventScreenDrag.new()
	e.index = index
	e.position = position
	return e
func run() -> void:
	var stick = Stick.new()
	root.add_child(stick)
	stick.vector_changed.connect(on_vector)
	stick._gui_input(touch(2, true, Vector2(100, 100)))
	check(stick.finger == 2 and latest == Vector2.ZERO, "first touch captures pointer")
	stick._gui_input(touch(3, true, Vector2(30, 30)))
	stick._gui_input(drag(3, Vector2(200, 200)))
	check(stick.finger == 2 and latest == Vector2.ZERO, "other pointers do not steal or move the stick")
	stick._gui_input(drag(2, Vector2(140, 100)))
	check(latest.distance_to(Vector2(0.5, 0)) < 0.001, "drag reports proportional direction")
	stick._gui_input(drag(2, Vector2(300, 100)))
	check(latest.distance_to(Vector2.RIGHT) < 0.001, "drag is clamped to unit radius")
	stick._gui_input(touch(3, false, Vector2.ZERO))
	check(stick.finger == 2, "other pointer release is ignored")
	stick._gui_input(touch(2, false, Vector2.ZERO))
	check(stick.finger == -1 and latest == Vector2.ZERO, "release clears input")
	stick._gui_input(touch(5, true, Vector2.ZERO))
	stick._gui_input(drag(5, Vector2(40, 0)))
	stick.notification(Node.NOTIFICATION_APPLICATION_FOCUS_OUT)
	check(stick.finger == -1 and latest == Vector2.ZERO, "focus loss clears input")
	stick._gui_input(touch(6, true, Vector2.ZERO))
	stick._gui_input(drag(6, Vector2(40, 0)))
	stick.hide()
	check(stick.finger == -1 and latest == Vector2.ZERO, "hiding clears input")
	stick.queue_free()
	await process_frame
	print("RESULT: %d failure(s)" % failures)
	quit(1 if failures else 0)
