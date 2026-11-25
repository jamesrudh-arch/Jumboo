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
	var title_mesh = main.cinematic.shot.studio_group.get_child(2).mesh
	check(title_mesh is TextMesh and title_mesh.depth > 0.0 and title_mesh.get_faces().size() > 0, "studio name has extruded geometry")
	check(main.cinematic.shot.emblem_ring.get_child(0).mesh is TorusMesh, "studio emblem uses three-dimensional ring geometry")
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
	check(is_instance_valid(main.cinematic.shot) and main.cinematic.shot.has_method("_make_ambience"), "prologue starts in the 3D workshop")
	check(main.cinematic.shot.actor.players.size() == 2 and main.cinematic.shot.ambience.stream != null, "workshop contains rigged character and ambience")
	Engine.time_scale = 30.0
	await create_timer(14.0).timeout
	check(is_instance_valid(main.cinematic.shot) and main.cinematic.shot.has_method("_box") and "phone_light" in main.cinematic.shot, "3D phone shot follows workshop")
	main.cinematic._skip()
	main.cinematic._skip()
	await process_frame
	check(not is_instance_valid(main.cinematic.shot), "skipping frees phone shot")
	check(main.overlay.visible, "call choice appears")
	var x_key := InputEventKey.new()
	x_key.keycode = KEY_X
	x_key.pressed = true
	main._unhandled_input(x_key)
	check(main.dialog_title.text.contains("INCOMING CALL"), "X does not choose between answer and decline")
	main._answer_call()
	check(is_instance_valid(main.cinematic.shot) and main.cinematic.shot.skeletons.size() == 2, "answer opens rigged pickup performance")
	var pickup = main.cinematic.shot
	pickup._process(0.6)
	check(pickup.attached and pickup.phone.position.distance_to(pickup._hand_position()) < 0.001, "phone follows the hand after pickup")
	var skel: Skeleton3D = pickup.skeletons[0]
	var hand_bone: int = skel.find_bone("hand_r")
	var neck_bone: int = skel.find_bone("neck_01")
	var start_distance: float = skel.get_bone_global_pose(hand_bone).origin.distance_to(skel.get_bone_global_pose(neck_bone).origin)
	pickup._process(1.5)
	var end_distance: float = skel.get_bone_global_pose(hand_bone).origin.distance_to(skel.get_bone_global_pose(neck_bone).origin)
	check(pickup.phone.position.distance_to(pickup._hand_position()) < 0.001, "phone stays attached during arm reach")
	check(end_distance < start_distance and end_distance < 0.25, "arm reaches toward the head")
	var clothes: Skeleton3D = pickup.skeletons[1]
	check(skel.get_bone_global_pose(hand_bone).origin.distance_to(clothes.get_bone_global_pose(clothes.find_bone("hand_r")).origin) < 0.001, "body and clothing arm poses match")
	main.cinematic._skip()
	main.cinematic._skip()
	check(main.dialog_title.text.contains("ELI"), "answer performance leads to dialogue")
	check(main.dialog_text.text.contains("window"), "call begins with first dialogue beat")
	main._unhandled_input(x_key)
	check(main.call_line_index == 1, "X advances an unambiguous dialogue beat")
	for i in 3:
		main._next_call_line()
	check(main.dialog_text.text.contains("disconnects"), "call dialogue advances to disconnect")
	main._finish_call()
	check(main.stage == 1 and main.controls.visible, "call completes and movement starts")
	main.player.play_motion("Walk")
	check(main.player.players.all(func(p): return p.current_animation == "Walk"), "body and clothing play same walk clip")
	main.player.position = main.witness.position + Vector3(1, 0, 0)
	check(main.witness.has_node("WitnessMarker"), "witness has a visible name marker")
	main._interact()
	check(main.interaction_open and main.player.players.all(func(p): return p.current_animation == "Idle"), "dialogue stops the walk animation")
	main._choose_witness("reassure")
	main._finish_slice()
	var previous_x: float = main.player.position.x
	main.touch_directions["right"] = true
	main._process(0.25)
	main.touch_directions["right"] = false
	check(main.stage == 2 and main.player.position.x > previous_x, "movement continues after finishing the slice")
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
	automatic.title_screen._new_game()
	await create_timer(21.0).timeout
	check(automatic.overlay.visible and automatic.dialog_title.text.contains("INCOMING CALL"), "workshop and phone naturally reach call choice")
	automatic._decline_call()
	check(automatic.dialog_title.text == "MISSED CALL", "decline path remains available")
	automatic.queue_free()
	await process_frame
	Engine.time_scale = 1.0
	print("RESULT: ", failures, " failure(s)")
	quit(1 if failures else 0)
