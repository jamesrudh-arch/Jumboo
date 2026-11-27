extends SceneTree

const CAPTIONS := preload("res://call_caption_data.gd")
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
	check(CAPTIONS.CUES.size() == 7 and CAPTIONS.SAMPLE_RATE == 44100, "approved call has seven sample-timed lines")
	for cue in CAPTIONS.CUES:
		check(CAPTIONS.text_at_sample(cue.start) == cue.text, "caption begins on its clip boundary")
		check(CAPTIONS.text_at_sample(cue.end - 1) == cue.text, "caption holds through last sample")
		check(CAPTIONS.text_at_sample(cue.end) != cue.text, "caption ends at exclusive boundary")
	check(CAPTIONS.text_at_sample(-1) == "" and CAPTIONS.text_at_sample(1074259) == "", "no speech caption outside the mix")
	check(CAPTIONS.text_at_sample(73216) == "" and CAPTIONS.text_at_sample(88650) == "", "inter-line pause has no speech caption")
	var scene = load("res://provisional_call.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	check(scene.phase == "ringing", "fixture starts in ringing phase")
	check(not scene.captions_enabled and not scene.caption_panel.visible, "captions are off by default")
	scene.caption_toggle.button_pressed = true
	check(scene.captions_enabled and scene.caption_panel.visible and scene.caption_label.text == "[Phone ringing]", "opt-in shows ringing caption")
	scene.caption_toggle.button_pressed = false
	check(not scene.captions_enabled and not scene.caption_panel.visible, "opt-out hides captions without blocking call")
	check(scene.phase == "ringing", "caption control does not change call phase")
	scene.caption_toggle.button_pressed = true
	await create_timer(7.0).timeout
	check(scene.phase == "conversation" and scene.caption_panel.visible and scene.caption_label.text.begins_with("MARCUS:"), "caption follows the first live dialogue clip")
	scene.caption_toggle.button_pressed = false
	check(not scene.caption_panel.visible, "captions can be hidden during playback")
	scene.caption_toggle.button_pressed = true
	check(scene.caption_panel.visible, "captions can be restored during playback")
	await create_timer(26.0).timeout
	check(scene.phase == "complete" and not scene.caption_panel.visible, "completion clears captions")
	scene.queue_free()
	await process_frame
	print("RESULT: %d failure(s)" % failures)
	quit(1 if failures else 0)
