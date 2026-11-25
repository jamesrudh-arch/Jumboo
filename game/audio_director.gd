extends Node

# Separate players ensure that advancing a line interrupts the old performance
# without stopping music or an environmental cue. The mix is provisional.
const PROLOGUE := "res://assets/audio/prologue_theme.ogg"
const TENSION := "res://assets/audio/confrontation.ogg"
const MUSIC_NORMAL := -15.0
const MUSIC_DUCKED := -23.0
var music: AudioStreamPlayer
var voice: AudioStreamPlayer
var effects: AudioStreamPlayer
var music_tween: Tween
var current_track := ""

func _ready() -> void:
	music = AudioStreamPlayer.new()
	music.name = "Music"
	music.volume_db = MUSIC_NORMAL
	add_child(music)
	voice = AudioStreamPlayer.new()
	voice.name = "Voice"
	add_child(voice)
	voice.finished.connect(_voice_finished)
	effects = AudioStreamPlayer.new()
	effects.name = "StoryEffects"
	add_child(effects)

func _exit_tree() -> void:
	if is_instance_valid(music_tween):
		music_tween.kill()
	music.stop()
	voice.stop()
	effects.stop()

func play_music(path: String) -> void:
	if current_track == path and music.playing:
		return
	if is_instance_valid(music_tween):
		music_tween.kill()
	current_track = path
	var stream := (load(path) as AudioStreamOggVorbis).duplicate() as AudioStreamOggVorbis
	# The source identifies only the prologue cue as loopable.
	stream.loop = path == PROLOGUE
	music.stream = stream
	music.volume_db = -40.0
	music.play()
	_fade_music(MUSIC_DUCKED if voice.playing else MUSIC_NORMAL, 1.0)

func play_voice(path: String) -> void:
	voice.stop()
	voice.stream = load(path) as AudioStream
	_fade_music(MUSIC_DUCKED, 0.12)
	voice.play()

func stop_voice() -> void:
	voice.stop()
	_fade_music(MUSIC_NORMAL, 0.7)

func play_effect(path: String) -> void:
	effects.stop()
	effects.stream = load(path) as AudioStream
	effects.volume_db = -5.0
	effects.play()

func _voice_finished() -> void:
	_fade_music(MUSIC_NORMAL, 0.7)

func _fade_music(target: float, seconds: float) -> void:
	if is_instance_valid(music_tween):
		music_tween.kill()
	music_tween = create_tween()
	music_tween.tween_property(music, "volume_db", target, seconds)
