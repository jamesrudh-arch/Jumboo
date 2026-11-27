extends SceneTree

const Motor = preload("res://locomotion/character_motor.gd")
var failures := 0
func check(condition: bool, label: String) -> void:
	if condition:
		print("PASS: ", label)
	else:
		failures += 1
		push_error("FAIL: " + label)

func _initialize() -> void:
	call_deferred("run")

func box_fixture(parent: Node, pos: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.position = pos
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	body.add_child(shape)
	parent.add_child(body)

func run() -> void:
	var world := Node3D.new()
	root.add_child(world)
	var camera := Camera3D.new()
	world.add_child(camera)
	camera.rotation_degrees = Vector3(-35, 90, 0)
	await process_frame
	var direction := Motor.camera_relative(Vector2(0, -1), camera)
	check(abs(direction.y) < 0.00001 and direction.distance_to(Vector3.LEFT) < 0.001, "camera pitch ignored and yaw rotates forward")
	check(is_equal_approx(Motor.camera_relative(Vector2(0.3, 0), camera).length(), 0.3), "analog strength is preserved")
	box_fixture(world, Vector3(0, -0.25, 0), Vector3(20, 0.5, 20))
	box_fixture(world, Vector3(0, 1, -2), Vector3(6, 2, 0.25))
	var motor = Motor.new()
	motor.keyboard_enabled = false
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.3
	capsule.height = 1.8
	shape.shape = capsule
	shape.position.y = 0.9
	motor.add_child(shape)
	motor.position = Vector3(0, 0.1, 0)
	world.add_child(motor)
	motor.set_touch_vector(Vector2(4, 4))
	check(is_equal_approx(motor.touch_vector.length(), 1.0), "touch vector clamps diagonals")
	motor.set_touch_vector(Vector2(NAN, 0))
	check(motor.touch_vector == Vector2.ZERO, "invalid touch input is cleared")
	motor.set_touch_vector(Vector2(0, -1))
	await create_timer(2.4).timeout
	check(motor.is_on_floor(), "body lands and remains on a real collision floor")
	check(motor.global_position.z < -1.0 and motor.global_position.z > -1.7, "body moves forward and is stopped by a wall")
	motor.set_touch_vector(Vector2(1, -1))
	await create_timer(1.2).timeout
	check(motor.global_position.x > 0.5 and motor.global_position.z > -1.7, "body slides along wall")
	motor.control_enabled = false
	motor.set_touch_vector(Vector2.RIGHT)
	check(motor.touch_vector == Vector2.ZERO, "disabled control ignores stale touch updates")
	await create_timer(0.4).timeout
	check(Vector2(motor.velocity.x, motor.velocity.z).length() < 0.01, "disabled control decelerates to rest")
	motor.control_enabled = true
	await create_timer(0.2).timeout
	check(Vector2(motor.velocity.x, motor.velocity.z).length() < 0.01, "reenabling does not resume stale touch")
	world.queue_free()
	await process_frame
	print("RESULT: %d failure(s)" % failures)
	quit(1 if failures else 0)
