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
	var district = main.get_node("CinderDistrict")
	var names := {}
	for sign in district.find_children("*", "Label3D", true, false):
		names[sign.text] = true
	check(names.size() >= 6, "district builds distinct 3D storefronts")
	main.cinematic._skip()
	check(main.cinematic.canvas.visible, "skip requires confirmation")
	main.cinematic._skip()
	check(main.title_screen.canvas.visible, "title menu appears after confirmed skip")
	check(main.audio_director.current_track == main.audio_director.PROLOGUE and main.audio_director.music.stream != null, "licensed prologue score loads in menu")
	main.title_screen._new_game()
	check(main.cinematic.canvas.visible, "new game starts prologue")
	check(is_instance_valid(main.cinematic.shot) and main.cinematic.shot.has_method("_make_ambience"), "prologue starts in the 3D workshop")
	check(main.cinematic.shot.actor.players.size() == 2 and main.cinematic.shot.ambience.stream != null, "workshop contains rigged character and ambience")
	var performer: Node3D = main.cinematic.shot.actor
	var shot_camera: Camera3D = main.cinematic.shot.camera
	check(not shot_camera.is_position_behind(performer.global_position + Vector3(0, 1, 0)), "workshop camera faces the performer")
	check(performer.find_children("*", "MeshInstance3D", true, false).all(func(m): return m.visible and m.extra_cull_margin >= 2.0), "character meshes are enabled with animated cull margin")
	Engine.time_scale = 30.0
	await create_timer(14.0).timeout
	check(is_instance_valid(main.cinematic.shot) and main.cinematic.shot.has_method("_box") and "phone_light" in main.cinematic.shot, "3D phone shot follows workshop")
	check(main.cinematic.shot.phone.has_node("Phone_ELI"), "3D phone displays Eli's name")
	check(not main.hud.visible and main.cinematic.subtitle.text == "", "HUD and subtitles stay hidden during cinematic by default")
	main.cinematic._skip()
	main.cinematic._skip()
	check(is_instance_valid(main.cinematic.shot) and main.cinematic.shot.skeletons.size() == 2, "phone is answered automatically without a choice panel")
	check(not main.overlay.visible, "no incoming-call page interrupts the shot")
	var pickup = main.cinematic.shot
	pickup._process(0.6)
	check(pickup.attached and pickup.phone.position.distance_to(pickup._hand_position()) < 0.001, "phone follows the hand after pickup")
	check(pickup.pickup_sound.stream != null, "pickup effect is loaded")
	var skel: Skeleton3D = pickup.skeletons[0]
	var hand_bone: int = skel.find_bone("hand_r")
	var neck_bone: int = skel.find_bone("neck_01")
	var start_distance: float = skel.get_bone_global_pose(hand_bone).origin.distance_to(skel.get_bone_global_pose(neck_bone).origin)
	pickup._process(1.5)
	var end_distance: float = skel.get_bone_global_pose(hand_bone).origin.distance_to(skel.get_bone_global_pose(neck_bone).origin)
	check(pickup.phone.position.distance_to(pickup._hand_position()) < 0.001, "phone stays attached during arm reach")
	var grip_now: Transform3D = pickup._hand_transform().affine_inverse() * pickup.phone.global_transform
	check(grip_now.origin.distance_to(pickup.phone_grip.origin) < 0.001 and grip_now.basis.is_equal_approx(pickup.phone_grip.basis), "phone keeps its orientation relative to the hand")
	check(end_distance < start_distance and end_distance < 0.25, "keyframed arm reaches toward the head")
	var clothes: Skeleton3D = pickup.skeletons[1]
	check(skel.get_bone_global_pose(hand_bone).origin.distance_to(clothes.get_bone_global_pose(clothes.find_bone("hand_r")).origin) < 0.001, "body and clothing arm poses match")
	main.cinematic._skip()
	main.cinematic._skip()
	check(main.cinematic.hold_answer_shot and is_instance_valid(main.cinematic.shot), "3D performance remains visible during automatic call")
	check(main.cinematic.shot.attached and main.cinematic.shot.speaker == "eli", "skipped pickup resolves to held pose and listening beat")
	check(not main.overlay.visible and not main.cinematic.canvas.visible, "call plays without text by default")
	check(main.audio_director.voice.stream.resource_path.ends_with("eli_window.wav"), "Eli's first voiced line loads automatically")
	await create_timer(35.0).timeout
	check(main.stage == 1 and main.controls.visible and main.hud.visible, "automatic call ends and starts gameplay")
	check(not main.cinematic.hold_answer_shot and not is_instance_valid(main.cinematic.shot), "call completion releases performance and restores gameplay")
	check(main.player.position.z > 15.0, "player begins at the warehouse checkpoint")
	main.player.play_motion("Walk")
	check(main.player.players.all(func(p): return p.current_animation == "Walk"), "body and clothing play same walk clip")
	main.player.position = main.witness.position + Vector3(1, 0, 0)
	check(main.witness.has_node("WitnessMarker"), "witness has a visible name marker")
	main._interact()
	check(main.interaction_open and main.player.players.all(func(p): return p.current_animation == "Idle"), "dialogue stops the walk animation")
	check(main.audio_director.voice.stream.resource_path.ends_with("marcus_witness.wav"), "Marcus speaks to the witness")
	main._witness_reply()
	check(main.audio_director.voice.stream.resource_path.ends_with("sade_intro.wav"), "Sade's response is voiced")
	main._choose_witness("pressure")
	check(main.audio_director.voice.stream.resource_path.ends_with("sade_pressure.wav"), "pressure plays its corresponding Sade line")
	main._choose_witness("reassure")
	check(main.audio_director.voice.stream.resource_path.ends_with("sade_reassure.wav"), "reassurance plays the corresponding Sade line")
	main._follow_lead()
	var previous_x: float = main.player.position.x
	main.touch_directions["right"] = true
	main._process(0.25)
	main.touch_directions["right"] = false
	check(main.stage == 2 and main.player.position.x > previous_x and main.encounter.van.visible, "witness lead unlocks the 3D van")
	main.player.position = main.encounter.van.position + Vector3(0, 0, 2)
	main._interact()
	check(main.stage == 3 and main.audio_director.voice.stream.resource_path.ends_with("marcus_van.wav"), "van investigation yields the voiced route clue")
	main._collector_warning()
	check(main.audio_director.voice.stream.resource_path.ends_with("collector_warning.wav"), "collector confrontation is voiced")
	main._bargain()
	main._bargain_agreement()
	check(main.stage == 3 and main.encounter_choice == "", "bargain is not committed before confirmation")
	main._complete_encounter("bargain")
	check(main.stage == 4 and main._read_save().get("encounter_choice") == "bargain", "confirmed obligation survives save")
	check(main.audio_director.voice.stream.resource_path.ends_with("tessa_bargain.wav"), "Tessa responds to the bargain")
	main._continue_game()
	check(main.stage == 4 and main.encounter_choice == "bargain" and not main.encounter.collector.visible, "continue restores the committed result")
	main.stage = 3
	main.encounter_choice = ""
	main.encounter.set_progress(3)
	main._start_fight()
	main.player.position = main.encounter.collector.position + Vector3(0, 0, 1)
	main.enemy_timer = 0.0
	main._process_fight(0.01)
	check(main.telegraph, "enemy attack has an advance warning")
	main._guard()
	main.enemy_timer = 0.0
	main._process_fight(0.01)
	check(main.player_health == 3, "timed guard prevents an in-range hit")
	main.guard_timer = 0.0
	main.telegraph = true
	main.enemy_timer = 0.0
	main._process_fight(0.01)
	check(main.player_health == 2, "unguarded attack causes damage")
	main.player.position = main.encounter.collector.position + Vector3(0, 0, 4)
	main.telegraph = true
	main.enemy_timer = 0.0
	main._process_fight(0.01)
	check(main.player_health == 2, "moving out of range avoids the telegraphed hit")
	main._fight_failed()
	check(not main.combat_active and main.encounter_choice == "", "defeat offers retry without committing a result")
	main._start_fight()
	main.player.position = main.encounter.collector.position + Vector3(0, 0, 1)
	for i in 3:
		main.strike_cooldown = 0.0
		main._strike()
	check(main.stage == 4 and main.encounter_choice == "fight" and main._read_save().get("encounter_choice") == "fight", "three in-range hits resolve and save the fight")
	main._complete_encounter("withdraw")
	check(main._read_save().get("encounter_choice") == "withdraw" and main.audio_director.voice.stream.resource_path.ends_with("tessa_escape.wav"), "withdrawal records no bargain and plays its response")
	var save_file := FileAccess.open(main.SAVE_PATH, FileAccess.WRITE)
	save_file.store_string(JSON.stringify({"version": 1, "stage": 2, "witness_choice": "pressure", "x": 0.0, "z": -7.0}))
	save_file.close()
	check(main._read_save().get("stage") == 2, "version one witness checkpoint remains readable")
	main._continue_game()
	check(main.stage == 2 and main.witness_choice == "pressure" and main.encounter.van.visible, "legacy checkpoint continues to the van")
	save_file = FileAccess.open(main.SAVE_PATH, FileAccess.WRITE)
	save_file.store_string(JSON.stringify({"version": 2, "stage": 4, "witness_choice": "pressure", "encounter_choice": "unknown", "x": 0.0, "z": 0.0}))
	save_file.close()
	check(main._read_save().is_empty(), "invalid encounter outcomes are rejected")
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
	automatic.title_screen.subtitles_enabled = true
	automatic.title_screen._new_game()
	await create_timer(22.0).timeout
	check(automatic.cinematic.hold_answer_shot and is_instance_valid(automatic.cinematic.shot), "workshop and ringing naturally transition to pickup")
	await create_timer(8.0).timeout
	check(automatic.cinematic.show_captions and automatic.cinematic.canvas.visible and not automatic.overlay.visible, "optional captions display without a choice page")
	await create_timer(30.0).timeout
	check(automatic.stage == 1 and not automatic.cinematic.hold_answer_shot, "voiced call naturally finishes at the checkpoint")
	automatic.queue_free()
	await process_frame
	Engine.time_scale = 1.0
	# Let the audio mixer retire stopped Ogg playback before engine shutdown.
	await create_timer(0.5).timeout
	print("RESULT: ", failures, " failure(s)")
	quit(1 if failures else 0)
