extends SceneTree

var failures := 0

func check(ok: bool, message: String) -> void:
	if ok:
		print("PASS: ", message)
	else:
		failures += 1
		push_error("FAIL: " + message)

func _initialize() -> void:
	call_deferred("run_test")

func run_test() -> void:
	var main = load("res://main.tscn").instantiate()
	root.add_child(main)
	await process_frame
	var shot = main.shot
	check(shot.phase == "studio" and shot.studio_group.visible, "approved studio mark begins the opening")
	check(shot.studio_group.get_child_count() == 3 and shot.ident.stream != null and shot.audio_path.ends_with("dyoungs_studio_sting.wav"), "studio model and sting loaded")
	await create_timer(3.9).timeout
	check(shot.phase == "title" and shot.title_group.visible and not shot.studio_group.visible, "opening automatically transitions to approved title")
	check(shot.title_group.get_node_or_null("Letter 3 V part 1") is MeshInstance3D, "approved title GLB loaded")
	check(shot.ident.stream != null and shot.audio_path.ends_with("leverage_title_sting.wav"), "title sting loaded")
	await create_timer(2.7).timeout
	check(shot.city_text != null and shot.city_text.visible and shot.tagline != null and shot.tagline.visible, "subtitle and tagline revealed")
	check(shot.icon.visible and shot.icon.get_node_or_null("Rounded icon housing") is MeshInstance3D, "approved 3D icon revealed")
	check(root.get_camera_3d() == shot.camera, "identity camera is active")
	check(shot._load_model("res://assets/brand/not-present.glb") == null and shot.load_error.contains("Missing 3D model"), "missing model produces an actionable diagnostic")
	await create_timer(1.6).timeout
	main.queue_free()
	await process_frame
	print("RESULT: %d failure(s)" % failures)
	quit(1 if failures else 0)
