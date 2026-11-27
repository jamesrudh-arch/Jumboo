extends SceneTree
var failures := 0
func check(ok: bool, label: String) -> void:
	if ok:
		print("PASS: ", label)
	else:
		failures += 1
		push_error("FAIL: " + label)
func _initialize() -> void:
	call_deferred("run_test")
func run_test() -> void:
	var main = load("res://main.tscn").instantiate()
	check(main.establishing_duration == 30.0, "default placeholder duration is thirty seconds")
	main.studio_duration = .5
	main.title_duration = .5
	root.add_child(main)
	await create_timer(2).timeout
	if main.call_scene == null:
		push_error("call scene did not load")
		quit(1)
		return
	check(main.call_scene.phase == "establishing", "default opening begins establishing phase")
	await create_timer(25).timeout
	check(main.call_scene.phase == "establishing", "no ringing before thirty seconds")
	await create_timer(5.5).timeout
	check(main.call_scene.phase == "ringing", "ring begins after thirty seconds")
	main.queue_free()
	await process_frame
	print("RESULT: %d failure(s)" % failures)
	quit(1 if failures else 0)
