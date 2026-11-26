extends RefCounted

# Two alternating, checksummed snapshots. A failed or interrupted write should
# leave the other slot untouched; physical-device durability still needs tests.
const SLOT_A := "user://leverage_save_a.json"
const SLOT_B := "user://leverage_save_b.json"
const LEGACY := "user://leverage_blockout.json"
# Runtime defaults to the real profile; tests explicitly select an isolated dir.
static var base_dir := "user://"

static func path_for(path: String) -> String:
	return base_dir.path_join(path.get_file())

static func read(validator: Callable) -> Dictionary:
	var best := _best_slot(validator)
	if not best.is_empty():
		return best.data
	# Existing builds used an unwrapped versioned JSON file.
	var old := _read_json(path_for(LEGACY))
	return validator.call(old) if not old.is_empty() else {}

static func write(data: Dictionary, validator: Callable) -> bool:
	if validator.call(data).is_empty():
		return false
	var best := _best_slot(validator)
	var sequence := int(best.get("sequence", 0)) + 1
	var destination := path_for(SLOT_B) if best.get("path", "") == path_for(SLOT_A) else path_for(SLOT_A)
	var payload := {"sequence": sequence, "data": data}
	var encoded := JSON.stringify(payload)
	var envelope := {"payload": encoded, "checksum": encoded.sha256_text()}
	var file := FileAccess.open(destination, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(envelope))
	file.flush()
	file.close()
	var verified := _load_slot(destination, validator)
	return not verified.is_empty() and int(verified.sequence) == sequence

static func _best_slot(validator: Callable) -> Dictionary:
	var a := _load_slot(path_for(SLOT_A), validator)
	var b := _load_slot(path_for(SLOT_B), validator)
	if a.is_empty():
		return b
	if b.is_empty():
		return a
	return a if int(a.sequence) >= int(b.sequence) else b

static func _load_slot(path: String, validator: Callable) -> Dictionary:
	var envelope := _read_json(path)
	var encoded := str(envelope.get("payload", ""))
	if encoded.is_empty() or str(envelope.get("checksum", "")) != encoded.sha256_text():
		return {}
	var parser := JSON.new()
	if parser.parse(encoded) != OK:
		return {}
	var payload: Variant = parser.data
	if not payload is Dictionary or not payload.get("data") is Dictionary:
		return {}
	var sequence := int(payload.get("sequence", 0))
	if sequence < 1:
		return {}
	var data: Dictionary = validator.call(payload.data)
	if data.is_empty():
		return {}
	return {"sequence": sequence, "data": data, "path": path}

static func _read_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parser := JSON.new()
	if parser.parse(file.get_as_text()) != OK:
		return {}
	return parser.data if parser.data is Dictionary else {}
