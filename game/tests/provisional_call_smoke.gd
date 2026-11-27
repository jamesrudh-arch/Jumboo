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
	var scene = load("res://provisional_call.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	check(scene.phase == "ringing", "call begins automatically with ringing")
	check(scene.error_message == "", "models and audio loaded")
	if scene.phase != "ringing":
		scene.queue_free()
		quit(1)
		return
	check(scene.pickup.visible and not scene.conversation.visible, "pickup visible and conversation hidden")
	check(scene.ring_player.stream != null and scene.voice_player.stream != null, "ring and dialogue streams loaded")
	check(scene.pickup_phone != null and scene.ringing_light != null, "phone vibration and light are attached")
	check(scene._ring_pulse_at(.2) and not scene._ring_pulse_at(1.0) and scene._ring_pulse_at(1.8) and not scene._ring_pulse_at(2.5), "visual pulses match ring timing")
	scene._update_ringing_visuals(.2)
	check(scene.ringing_light.light_energy > 0.0, "ring pulse lights the phone")
	scene._update_ringing_visuals(1.0)
	check(scene.ringing_light.light_energy == 0.0 and scene.pickup_phone.transform.is_equal_approx(scene.phone_rest_transform), "between pulses phone returns to rest")
	var pickup_name = scene._animation_name(scene.pickup_animation)
	var talk_name = scene._animation_name(scene.conversation_animation)
	check(absf(scene.pickup_animation.get_animation(pickup_name).length - 22.0 / 6.0) < .02, "pickup length matches source")
	check(absf(scene.conversation_animation.get_animation(talk_name).length - 24.3596) < .02, "conversation length matches dialogue")
	await create_timer(3.2).timeout
	check(scene.phase == "pickup", "ring automatically transitions to pickup")
	check(scene.ringing_light.light_energy == 0.0, "ring light stops at pickup")
	await create_timer(3.8).timeout
	check(scene.phase == "conversation" and not scene.pickup.visible and scene.conversation.visible, "pickup automatically cuts to conversation")
	check(scene.voice_player.playing, "dialogue starts with conversation")
	# Seek near the end without waiting for the full 24-second dialogue.
	scene.conversation_animation.seek(24.34, true)
	await create_timer(.2).timeout
	check(scene.phase == "complete", "conversation emits completion")
	scene.queue_free()
	await process_frame
	print("RESULT: %d failure(s)" % failures)
	quit(1 if failures else 0)
