extends SceneTree

var failures := 0

func _initialize() -> void:
	call_deferred("_run")

func check(condition: bool, message: String) -> void:
	if condition:
		print("PASS: ", message)
	else:
		push_error("FAIL: " + message)
		failures += 1

func _run() -> void:
	var main = load("res://main.tscn").instantiate()
	root.add_child(main)
	await process_frame
	check(main.cinematic.canvas.visible, "opening starts")
	check(main.cinematic.studio_mark.visible, "studio mark displayed during opening")
	check(main.player.players.size() == 2, "rigged body and clothing loaded")
	check(main.player.players.all(func(p): return p.has_animation("Walk") and p.has_animation("Idle")), "walk and idle clips imported")
	main.cinematic._skip()
	check(main.cinematic.canvas.visible, "skip requires confirmation")
	main.cinematic._skip()
	check(main.title_screen.canvas.visible, "title menu appears after confirmed skip")
	main.title_screen._new_game()
	check(main.cinematic.canvas.visible, "new game starts prologue")
	Engine.time_scale = 30.0
	await create_timer(12.5).timeout
	check(is_instance_valid(main.cinematic.shot), "3D phone shot starts")
	main.cinematic._skip()
	main.cinematic._skip()
	await process_frame
	check(not is_instance_valid(main.cinematic.shot), "skipping frees phone shot")
	check(main.overlay.visible, "call choice appears")
	main._answer_call()
	check(main.dialog_title.text.contains("ELI"), "answer opens dialogue")
	main._finish_call()
	check(main.stage == 1 and main.controls.visible, "call completes and movement starts")
	main.player.play_motion("Walk")
	check(main.player.players.all(func(p): return p.current_animation == "Walk"), "body and clothing play same walk clip")
	main.player.play_motion("Idle")
	# Let timers from the skipped opening/prologue resume and release their coroutines.
	await create_timer(9.0).timeout
	Engine.time_scale = 1.0
	main.queue_free()
	await process_frame
	print("RESULT: ", failures, " failure(s)")
	quit(1 if failures else 0)
