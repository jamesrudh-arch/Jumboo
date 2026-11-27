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
	main.studio_duration = 2.0
	main.title_duration = 2.0
	main.establishing_duration = 2.0
	root.add_child(main)
	check(main.shot.phase == "studio", "studio identity starts first")
	await create_timer(2.1).timeout
	check(main.shot.phase == "title", "title follows studio identity")
	await create_timer(2.1).timeout
	check(main.call_scene != null, "opening creates call scene after title")
	if main.call_scene == null:
		quit(1)
		return
	check(main.call_scene.phase == "establishing", "placeholder establishing shot precedes ring")
	check(not main.call_scene.ring_player.playing, "ring does not start during establishing shot")
	await create_timer(2.1).timeout
	check(main.call_scene.phase == "ringing", "ring starts automatically after establishing shot")
	await create_timer(3.2).timeout
	check(main.call_scene.phase == "pickup", "pickup follows ringing")
	await create_timer(3.8).timeout
	check(main.call_scene.phase == "conversation", "dialogue follows pickup")
	main.queue_free()
	await process_frame
	print("RESULT: %d failure(s)" % failures)
	quit(1 if failures else 0)
