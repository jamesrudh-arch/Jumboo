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
	check(is_instance_valid(main.cinematic.shot), "3D studio shot starts")
	check(main.cinematic.shot.phase == "studio", "3D studio mark displayed during opening")
	var ident_players = main.cinematic.shot.find_children("*", "AudioStreamPlayer", true, false)
	check(ident_players.size() == 1 and ident_players[0].stream != null, "studio ident sound loaded")
	var title_mesh = main.cinematic.shot.studio_group.get_child(1).mesh
	check(title_mesh is TextMesh and title_mesh.depth > 0.0 and title_mesh.get_faces().size() > 0, "studio name has extruded geometry")
	main.cinematic.shot.reveal_title()
	check(main.cinematic.shot.title_group.visible and not main.cinematic.shot.studio_group.visible, "3D game title replaces studio mark")
	var game_title_mesh = main.cinematic.shot.title_group.get_child(0).mesh
	check(game_title_mesh is TextMesh and game_title_mesh.depth > 0.0 and game_title_mesh.get_faces().size() > 0, "game title has extruded geometry")
	main.cinematic.shot._process(1.0)
	check(main.cinematic.shot.city_text.visible, "Cinder City reveal appears")
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
	# Verify the timed reveal without pressing skip.
	Engine.time_scale = 20.0
	var automatic = load("res://main.tscn").instantiate()
	root.add_child(automatic)
	await create_timer(4.0).timeout
	check(is_instance_valid(automatic.cinematic.shot) and automatic.cinematic.shot.phase == "title", "opening naturally advances to 3D title")
	await create_timer(5.0).timeout
	check(automatic.title_screen.canvas.visible and not is_instance_valid(automatic.cinematic.shot), "opening naturally reaches menu and frees shot")
	automatic.queue_free()
	await process_frame
	Engine.time_scale = 1.0
	print("RESULT: ", failures, " failure(s)")
	quit(1 if failures else 0)
