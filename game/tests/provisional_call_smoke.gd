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
	check(scene.incoming_display_parts.size() == 7 and scene.connected_display_parts.size() == 4, "incoming and connected display meshes loaded")
	check(not scene.pickup_connected and scene.incoming_display_parts[0].visible and not scene.connected_display_parts[0].visible, "phone starts with incoming display")
	check(scene.pickup_counter_parts.size() == 27 and scene.conversation_counter_parts.size() == 27, "all counter meshes loaded")
	check(_visible_count(scene.pickup_counter_parts) == 0 and _visible_count(scene.conversation_counter_parts) == 0, "counters hidden before connection")
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
	await create_timer(.8).timeout
	check(not scene.pickup_connected and scene.incoming_display_parts[0].visible, "incoming display remains before lift")
	await create_timer(1.1).timeout
	check(scene.pickup_connected and not scene.incoming_display_parts[0].visible and scene.connected_display_parts[0].visible, "phone automatically shows connected display at lift")
	check(_visible_count(scene.pickup_counter_parts) == 1, "exactly one pickup counter is visible")
	await create_timer(2.0).timeout
	check(scene.phase == "conversation" and not scene.pickup.visible and scene.conversation.visible, "pickup automatically cuts to conversation")
	check(scene.voice_player.playing, "dialogue starts with conversation")
	check(_visible_count(scene.conversation_counter_parts) == 1 and scene.current_conversation_second >= 1, "conversation counter continues after pickup")
	scene.conversation_animation.seek(10.0, true)
	await process_frame
	await process_frame
	check(scene.current_conversation_second == 11 and _visible_count(scene.conversation_counter_parts) == 1, "counter advances with conversation")
	# Seek near the end without waiting for the full 24-second dialogue.
	scene.conversation_animation.seek(24.2, true)
	await process_frame
	await process_frame
	check(scene.current_conversation_second == 26 and _visible_count(scene.conversation_counter_parts) == 1, "counter reaches final connected second")
	scene.conversation_animation.seek(24.34, true)
	await create_timer(.2).timeout
	check(scene.phase == "complete", "conversation emits completion")
	scene.queue_free()
	await process_frame
	print("RESULT: %d failure(s)" % failures)
	quit(1 if failures else 0)

func _visible_count(parts: Array) -> int:
	var count := 0
	for part in parts:
		if part.visible:
			count += 1
	return count
